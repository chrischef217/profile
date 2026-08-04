-- Unity Global AI Office Stage 11 full runtime hardening
-- Applied to Supabase project ckzwmimmwdnmpohgvcka on 2026-08-04.

begin;

create table if not exists public.ai_office_job_transitions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_office_jobs(id) on delete cascade,
  root_job_id uuid null references public.ai_office_jobs(id) on delete set null,
  from_status text null,
  to_status text not null,
  from_phase text null,
  to_phase text not null,
  from_agent_id text null,
  to_agent_id text null,
  attempt integer not null default 0,
  actor text not null default 'DATABASE',
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_office_job_transitions_job_created_idx on public.ai_office_job_transitions(job_id,created_at desc);
create index if not exists ai_office_job_transitions_root_created_idx on public.ai_office_job_transitions(root_job_id,created_at desc);

create table if not exists public.ai_office_system_test_runs (
  id uuid primary key default gen_random_uuid(),
  test_suite text not null,
  status text not null check (status in ('RUNNING','PASS','FAIL')),
  checks jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);
create index if not exists ai_office_system_test_runs_started_idx on public.ai_office_system_test_runs(started_at desc);

create table if not exists public.ai_office_api_requests (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  method text not null,
  client_hash text not null,
  request_hash text null,
  status_code integer null,
  job_id uuid null references public.ai_office_jobs(id) on delete set null,
  response_body jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
create index if not exists ai_office_api_requests_client_endpoint_created_idx on public.ai_office_api_requests(client_hash,endpoint,created_at desc);
create index if not exists ai_office_api_requests_request_hash_created_idx on public.ai_office_api_requests(request_hash,created_at desc) where request_hash is not null;
create index if not exists ai_office_context_conflicts_left_version_idx on public.ai_office_context_conflicts(left_version_id);
create index if not exists ai_office_context_conflicts_right_version_idx on public.ai_office_context_conflicts(right_version_id);
create index if not exists ai_office_document_versions_supersedes_idx on public.ai_office_document_versions(supersedes_id);

alter table public.ai_office_job_transitions enable row level security;
alter table public.ai_office_system_test_runs enable row level security;
alter table public.ai_office_api_requests enable row level security;
revoke all on public.ai_office_job_transitions,public.ai_office_system_test_runs,public.ai_office_api_requests from anon,authenticated;

create or replace function public.ai_office_log_job_transition()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.ai_office_job_transitions(job_id,root_job_id,from_status,to_status,from_phase,to_phase,from_agent_id,to_agent_id,attempt,actor,reason,metadata)
    values(new.id,new.root_job_id,null,new.status,null,new.phase,null,new.owner_agent_id,new.attempts,'DATABASE_INSERT',new.error_message,jsonb_build_object('risk_level',new.risk_level,'job_type',new.job_type));
  elsif old.status is distinct from new.status or old.phase is distinct from new.phase or old.owner_agent_id is distinct from new.owner_agent_id or old.locked_by is distinct from new.locked_by or old.error_message is distinct from new.error_message then
    insert into public.ai_office_job_transitions(job_id,root_job_id,from_status,to_status,from_phase,to_phase,from_agent_id,to_agent_id,attempt,actor,reason,metadata)
    values(new.id,coalesce(new.root_job_id,old.root_job_id),old.status,new.status,old.phase,new.phase,old.owner_agent_id,new.owner_agent_id,new.attempts,coalesce(new.locked_by,old.locked_by,'DATABASE_UPDATE'),new.error_message,jsonb_build_object('locked_by_before',old.locked_by,'locked_by_after',new.locked_by,'approved_at',new.approved_at,'completed_at',new.completed_at));
  end if;
  return new;
end;$$;

drop trigger if exists ai_office_jobs_transition_audit on public.ai_office_jobs;
create trigger ai_office_jobs_transition_audit after insert or update of status,phase,owner_agent_id,locked_by,error_message on public.ai_office_jobs for each row execute function public.ai_office_log_job_transition();

create or replace function public.ai_office_propagate_dependency_failures()
returns integer language plpgsql security definer set search_path=public as $$
declare v_total integer:=0; v_changed integer:=0;
begin
  loop
    with candidates as (
      select j.id,jsonb_agg(jsonb_build_object('job_id',d.id,'status',d.status,'title',d.title,'error_message',d.error_message) order by d.sequence_no,d.created_at) failed_dependencies
      from public.ai_office_jobs j
      join lateral unnest(coalesce(j.depends_on,'{}'::uuid[])) dep(id) on true
      join public.ai_office_jobs d on d.id=dep.id
      where j.status in ('QUEUED','APPROVED','WAITING_APPROVAL') and d.status in ('BLOCKED','FAILED','CANCELLED')
      group by j.id
    ), updated as (
      update public.ai_office_jobs j set status='BLOCKED',result=coalesce(j.result,'{}'::jsonb)||jsonb_build_object('reason','DEPENDENCY_NOT_COMPLETED','failed_dependencies',c.failed_dependencies,'external_write_performed',false,'stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED'),error_message='DEPENDENCY_NOT_COMPLETED',completed_at=coalesce(j.completed_at,now()),locked_by=null,locked_at=null,lease_expires_at=null,updated_at=now()
      from candidates c where j.id=c.id returning j.id,j.owner_agent_id,j.title,c.failed_dependencies
    ), events as (
      insert into public.ai_office_events(event_type,message,agent_id,job_id,metadata)
      select 'JOB_BLOCKED_DEPENDENCY','의존 업무 실패로 자동 차단: '||title,owner_agent_id,id,jsonb_build_object('failed_dependencies',failed_dependencies,'stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED') from updated returning 1
    ) select count(*) into v_changed from updated;
    v_total:=v_total+v_changed;
    exit when v_changed=0;
  end loop;
  return v_total;
end;$$;

create or replace function public.ai_office_check_rate_limit(p_client_hash text,p_endpoint text,p_method text,p_request_hash text default null,p_window_seconds integer default 60,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer; v_id uuid; v_duplicate record;
begin
  if p_client_hash is null or length(p_client_hash)<16 then raise exception 'INVALID_CLIENT_HASH'; end if;
  if p_window_seconds<1 or p_window_seconds>86400 or p_limit<1 or p_limit>1000 then raise exception 'INVALID_RATE_LIMIT_POLICY'; end if;
  if p_request_hash is not null then
    select id,status_code,response_body,job_id into v_duplicate from public.ai_office_api_requests where client_hash=p_client_hash and endpoint=p_endpoint and request_hash=p_request_hash and created_at>now()-interval '30 seconds' and status_code between 200 and 299 order by created_at desc limit 1;
    if found then return jsonb_build_object('allowed',false,'duplicate',true,'request_id',v_duplicate.id,'status_code',v_duplicate.status_code,'response_body',v_duplicate.response_body,'job_id',v_duplicate.job_id); end if;
  end if;
  select count(*) into v_count from public.ai_office_api_requests where client_hash=p_client_hash and endpoint=p_endpoint and created_at>now()-make_interval(secs=>p_window_seconds);
  if v_count>=p_limit then return jsonb_build_object('allowed',false,'duplicate',false,'remaining',0,'retry_after_seconds',p_window_seconds); end if;
  insert into public.ai_office_api_requests(endpoint,method,client_hash,request_hash,metadata) values(p_endpoint,upper(coalesce(p_method,'POST')),p_client_hash,p_request_hash,jsonb_build_object('window_seconds',p_window_seconds,'limit',p_limit)) returning id into v_id;
  return jsonb_build_object('allowed',true,'duplicate',false,'request_id',v_id,'remaining',greatest(p_limit-v_count-1,0));
end;$$;

create or replace function public.ai_office_finalize_api_request(p_request_id uuid,p_status_code integer,p_job_id uuid default null,p_response_body jsonb default null,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.ai_office_api_requests set status_code=p_status_code,job_id=p_job_id,response_body=p_response_body,metadata=metadata||coalesce(p_metadata,'{}'::jsonb),completed_at=now() where id=p_request_id;
end;$$;

create or replace function public.ai_office_claim_jobs(p_worker_id text,p_limit integer default 3,p_lease_seconds integer default 300)
returns setof public.ai_office_jobs language plpgsql security definer set search_path=public as $$
declare v_integrity jsonb; v_propagated integer;
begin
  if p_worker_id is null or length(btrim(p_worker_id))<3 then raise exception 'INVALID_WORKER_ID'; end if;
  perform pg_advisory_xact_lock(hashtext('ai_office_claim_jobs'));
  v_integrity:=public.ai_office_document_integrity();
  if coalesce(v_integrity->>'status','BLOCKED')<>'PASS' then return; end if;
  v_propagated:=public.ai_office_propagate_dependency_failures();
  with expired as (
    update public.ai_office_jobs set status='FAILED',error_message=coalesce(error_message,'LEASE_EXPIRED_MAX_ATTEMPTS'),result=coalesce(result,'{}'::jsonb)||jsonb_build_object('reason','LEASE_EXPIRED_MAX_ATTEMPTS','stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED','external_write_performed',false),completed_at=coalesce(completed_at,now()),locked_by=null,locked_at=null,lease_expires_at=null,updated_at=now()
    where status='RUNNING' and phase<>'WAITING_CHILDREN' and lease_expires_at is not null and lease_expires_at<now() and attempts>=max_attempts returning id,owner_agent_id,title
  ) insert into public.ai_office_events(event_type,message,agent_id,job_id,metadata) select 'JOB_FAILED_LEASE_EXPIRED','최대 재시도 초과: '||title,owner_agent_id,id,jsonb_build_object('stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED') from expired;
  with requeued as (
    update public.ai_office_jobs set status=case when approved_at is not null then 'APPROVED' else 'QUEUED' end,locked_by=null,locked_at=null,lease_expires_at=null,updated_at=now(),error_message=coalesce(error_message,'LEASE_EXPIRED_REQUEUED')
    where status='RUNNING' and phase<>'WAITING_CHILDREN' and lease_expires_at is not null and lease_expires_at<now() and attempts<max_attempts returning id,owner_agent_id,title,attempts,max_attempts
  ) insert into public.ai_office_events(event_type,message,agent_id,job_id,metadata) select 'JOB_REQUEUED_LEASE_EXPIRED','Lease 만료 재대기: '||title,owner_agent_id,id,jsonb_build_object('attempts',attempts,'max_attempts',max_attempts,'stage','ONLINE_MULTI_AGENT_STAGE_11_HARDENED') from requeued;
  return query
  with ranked as (
    select j.id,row_number() over(partition by coalesce(j.owner_agent_id,j.id::text) order by j.execution_priority,j.created_at,j.id) agent_rank
    from public.ai_office_jobs j
    where j.status in ('QUEUED','APPROVED') and j.attempts<j.max_attempts and (j.lease_expires_at is null or j.lease_expires_at<now())
      and not exists(select 1 from unnest(coalesce(j.depends_on,'{}'::uuid[])) dep(id) left join public.ai_office_jobs d on d.id=dep.id where d.id is null or d.status<>'COMPLETED')
      and not exists(select 1 from public.ai_office_jobs active where active.owner_agent_id=j.owner_agent_id and active.id<>j.id and active.status='RUNNING' and (active.phase='WAITING_CHILDREN' or active.lease_expires_at is null or active.lease_expires_at>now()))
  ), picked as (
    select j.id from ranked r join public.ai_office_jobs j on j.id=r.id where r.agent_rank=1 order by j.execution_priority,j.created_at,j.id limit greatest(1,least(coalesce(p_limit,3),10))
  ), claimed as (
    update public.ai_office_jobs j set status='RUNNING',locked_by=p_worker_id,locked_at=now(),lease_expires_at=now()+make_interval(secs=>greatest(60,least(coalesce(p_lease_seconds,300),1800))),started_at=coalesce(j.started_at,now()),attempts=j.attempts+1,error_message=null,updated_at=now()
    from picked p where j.id=p.id returning j.*
  ) select * from claimed;
end;$$;

alter table public.ai_office_runtime drop constraint if exists ai_office_runtime_environment_mode_check;
alter table public.ai_office_runtime add constraint ai_office_runtime_environment_mode_check check(environment_mode in ('DRY_RUN','ONLINE_STAGE_1','ONLINE_PERSISTENT_STAGE_2','ONLINE_ADMIN_STAGE_3','ONLINE_CAPABILITY_STAGE_4','ONLINE_GOVERNANCE_STAGE_5','ONLINE_CONTROL_STAGE_6','ONLINE_MULTI_AGENT_STAGE_9_PMO_QA','ONLINE_MULTI_AGENT_STAGE_10_DOCUMENT_GROUNDED','ONLINE_MULTI_AGENT_STAGE_11_HARDENED','PRODUCTION'));
update public.ai_office_runtime set environment_mode='ONLINE_MULTI_AGENT_STAGE_11_HARDENED',updated_at=now() where id='primary';

revoke all on function public.ai_office_log_job_transition() from public,anon,authenticated;
revoke all on function public.ai_office_propagate_dependency_failures() from public,anon,authenticated;
revoke all on function public.ai_office_check_rate_limit(text,text,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.ai_office_finalize_api_request(uuid,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.ai_office_claim_jobs(text,integer,integer) from public,anon,authenticated;
grant execute on function public.ai_office_propagate_dependency_failures() to service_role;
grant execute on function public.ai_office_check_rate_limit(text,text,text,text,integer,integer) to service_role;
grant execute on function public.ai_office_finalize_api_request(uuid,integer,uuid,jsonb,jsonb) to service_role;
grant execute on function public.ai_office_claim_jobs(text,integer,integer) to service_role;

do $$ declare r record; begin
  for r in select schemaname,tablename from pg_tables where schemaname='public' and tablename like 'ai_office_%' loop
    execute format('revoke all on table %I.%I from anon, authenticated',r.schemaname,r.tablename);
  end loop;
end $$;

do $$ declare r record; begin
  for r in select n.nspname schemaname,c.relname tablename from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relname like 'ai_office_%' and not exists(select 1 from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname) loop
    execute format('create policy ai_office_service_only on %I.%I as permissive for all to anon, authenticated using (false) with check (false)',r.schemaname,r.tablename);
  end loop;
end $$;

commit;
