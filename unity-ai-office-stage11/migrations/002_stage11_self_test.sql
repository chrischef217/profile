-- Deterministic, non-billable Stage 11 integration test.
create or replace function public.ai_office_run_stage11_self_test()
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_run_id uuid:=gen_random_uuid(); v_parent uuid; v_dep_failed uuid; v_dep_blocked uuid;
  v_finance_1 uuid; v_sales_1 uuid; v_finance_2 uuid; v_approval uuid;
  v_job_ids uuid[]:='{}'::uuid[]; v_integrity jsonb; v_propagated integer;
  v_claimed public.ai_office_jobs[]; v_claim_count integer; v_owner_count integer;
  v_block_reason text; v_transition_count integer; v_duplicate jsonb;
  v_rate_1 jsonb; v_rate_2 jsonb; v_rate_3 jsonb;
  v_client_hash text:=encode(digest(v_run_id::text,'sha256'),'hex');
  v_checks jsonb:='[]'::jsonb; v_error text;
begin
  insert into public.ai_office_system_test_runs(id,test_suite,status) values(v_run_id,'STAGE11_FULL_WORKFLOW','RUNNING');
  v_integrity:=public.ai_office_document_integrity();
  if coalesce(v_integrity->>'status','BLOCKED')<>'PASS' then raise exception 'SELF_TEST_DOCUMENT_INTEGRITY_NOT_PASS'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','DOCUMENT_INTEGRITY','status','PASS'));

  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,job_type,phase,sequence_no,execution_priority,payload)
  values('[STAGE11-SELFTEST] parent','RUNNING','pmo','pmo_core','L1','SYSTEM_SELF_TEST','ORCHESTRATION','PLAN',0,1,jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_parent;
  v_job_ids:=array_append(v_job_ids,v_parent);
  update public.ai_office_jobs set root_job_id=v_parent,phase='WAITING_CHILDREN',payload=payload||jsonb_build_object('phase','WAITING_CHILDREN') where id=v_parent;

  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,payload,result,error_message,completed_at)
  values('[STAGE11-SELFTEST] dependency failed','BLOCKED','research','research_core','L1','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',1,101,jsonb_build_object('self_test_run_id',v_run_id),jsonb_build_object('reason','SELF_TEST_EXPECTED_BLOCK'),'SELF_TEST_EXPECTED_BLOCK',now()) returning id into v_dep_failed;
  v_job_ids:=array_append(v_job_ids,v_dep_failed);

  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,depends_on,payload)
  values('[STAGE11-SELFTEST] dependent must auto-block','QUEUED','marketing','marketing_core','L1','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',2,102,array[v_dep_failed],jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_dep_blocked;
  v_job_ids:=array_append(v_job_ids,v_dep_blocked);

  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,payload)
  values('[STAGE11-SELFTEST] finance one','QUEUED','finance','finance_core','L1','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',3,103,jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_finance_1;
  v_job_ids:=array_append(v_job_ids,v_finance_1);
  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,payload)
  values('[STAGE11-SELFTEST] sales one','QUEUED','sales','sales_core','L1','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',4,104,jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_sales_1;
  v_job_ids:=array_append(v_job_ids,v_sales_1);
  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,payload)
  values('[STAGE11-SELFTEST] finance two','QUEUED','finance','finance_core','L1','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',5,105,jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_finance_2;
  v_job_ids:=array_append(v_job_ids,v_finance_2);
  insert into public.ai_office_jobs(title,status,owner_agent_id,capability_key,risk_level,requested_by,parent_job_id,root_job_id,job_type,phase,sequence_no,execution_priority,payload)
  values('[STAGE11-SELFTEST] approval gate','WAITING_APPROVAL','admin','admin_core','L2','SYSTEM_SELF_TEST',v_parent,v_parent,'TASK','EXECUTE',6,106,jsonb_build_object('self_test_run_id',v_run_id)) returning id into v_approval;
  v_job_ids:=array_append(v_job_ids,v_approval);

  v_propagated:=public.ai_office_propagate_dependency_failures();
  select status,error_message into strict v_block_reason,v_error from public.ai_office_jobs where id=v_dep_blocked;
  if v_block_reason<>'BLOCKED' or v_error<>'DEPENDENCY_NOT_COMPLETED' or v_propagated<1 then raise exception 'SELF_TEST_DEPENDENCY_PROPAGATION_FAILED'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','DEPENDENCY_PROPAGATION','status','PASS','propagated',v_propagated));

  select array_agg(c order by c.owner_agent_id) into v_claimed from public.ai_office_claim_jobs('stage11-selftest-worker-1',10,120)c;
  v_claim_count:=coalesce(array_length(v_claimed,1),0);
  select count(distinct x.owner_agent_id) into v_owner_count from unnest(coalesce(v_claimed,'{}'::public.ai_office_jobs[]))x;
  if v_claim_count<>2 or v_owner_count<>2 then raise exception 'SELF_TEST_ONE_JOB_PER_AGENT_FAILED:%/%',v_claim_count,v_owner_count; end if;
  if exists(select 1 from public.ai_office_jobs where id=v_approval and status<>'WAITING_APPROVAL') then raise exception 'SELF_TEST_APPROVAL_GATE_BYPASSED'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','CLAIM_CONCURRENCY_AND_APPROVAL','status','PASS','claimed',v_claim_count));

  update public.ai_office_jobs set status='COMPLETED',phase='DONE',result=jsonb_build_object('self_test',true),completed_at=now(),locked_by=null,locked_at=null,lease_expires_at=null where id in(v_finance_1,v_sales_1);
  update public.ai_office_jobs set status='APPROVED',approved_at=now() where id=v_approval and status='WAITING_APPROVAL';
  select array_agg(c order by c.owner_agent_id) into v_claimed from public.ai_office_claim_jobs('stage11-selftest-worker-2',10,120)c;
  v_claim_count:=coalesce(array_length(v_claimed,1),0);
  if v_claim_count<>2 then raise exception 'SELF_TEST_SECOND_CLAIM_FAILED:%',v_claim_count; end if;
  if not exists(select 1 from public.ai_office_jobs where id=v_approval and status='RUNNING') then raise exception 'SELF_TEST_APPROVED_JOB_NOT_CLAIMED'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','APPROVAL_RESUME','status','PASS','claimed',v_claim_count));
  update public.ai_office_jobs set status='COMPLETED',phase='DONE',result=jsonb_build_object('self_test',true),completed_at=now(),locked_by=null,locked_at=null,lease_expires_at=null where id in(v_finance_2,v_approval);

  insert into public.ai_office_quality_reviews(job_id,root_job_id,review_round,reviewer_agent_id,provider,model,response_id,verdict,score,criteria,defects,unsupported_claims,conflicts,revision_instructions,usage,context_snapshot,stage)
  values(v_parent,v_parent,1,'audit','MOCK','deterministic-stage11',null,'PASS',95,jsonb_build_object('source_grounding',95,'factual_consistency',95,'instruction_compliance',95,'risk_disclosure',95,'decision_usefulness',95),'[]','[]','[]','','{}','[]','ONLINE_MULTI_AGENT_STAGE_11_HARDENED');
  insert into public.ai_office_execution_steps(job_id,root_job_id,agent_id,step_key,status,details,completed_at) values(v_parent,v_parent,'audit','STAGE11_SELF_TEST','COMPLETED',jsonb_build_object('self_test_run_id',v_run_id),now());
  insert into public.ai_office_usage_ledger(job_id,provider,model,input_tokens,output_tokens,total_tokens,estimated_cost_thb,response_id,metadata) values(v_parent,'MOCK','deterministic-stage11',0,0,0,0,null,jsonb_build_object('self_test_run_id',v_run_id,'non_billable',true));

  select count(*) into v_transition_count from public.ai_office_job_transitions where job_id=any(v_job_ids);
  if v_transition_count<12 then raise exception 'SELF_TEST_TRANSITION_AUDIT_INCOMPLETE:%',v_transition_count; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','QUALITY_USAGE_TRANSITION_AUDIT','status','PASS','transitions',v_transition_count));

  v_duplicate:=public.ai_office_check_rate_limit(v_client_hash,'/command','POST','duplicate-hash',60,10);
  perform public.ai_office_finalize_api_request((v_duplicate->>'request_id')::uuid,202,v_parent,jsonb_build_object('ok',true,'job_id',v_parent),jsonb_build_object('self_test_run_id',v_run_id));
  v_duplicate:=public.ai_office_check_rate_limit(v_client_hash,'/command','POST','duplicate-hash',60,10);
  if coalesce((v_duplicate->>'duplicate')::boolean,false)is not true then raise exception 'SELF_TEST_IDEMPOTENCY_FAILED'; end if;
  v_rate_1:=public.ai_office_check_rate_limit(v_client_hash,'/rate-test','POST','r1',60,2);
  v_rate_2:=public.ai_office_check_rate_limit(v_client_hash,'/rate-test','POST','r2',60,2);
  v_rate_3:=public.ai_office_check_rate_limit(v_client_hash,'/rate-test','POST','r3',60,2);
  if coalesce((v_rate_1->>'allowed')::boolean,false)is not true or coalesce((v_rate_2->>'allowed')::boolean,false)is not true or coalesce((v_rate_3->>'allowed')::boolean,true)is not false then raise exception 'SELF_TEST_RATE_LIMIT_FAILED'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','IDEMPOTENCY_AND_RATE_LIMIT','status','PASS'));

  if has_table_privilege('anon','public.ai_office_jobs','select') or has_table_privilege('authenticated','public.ai_office_jobs','select') or has_table_privilege('anon','public.ai_office_model_registry','insert') then raise exception 'SELF_TEST_DIRECT_DATA_API_PRIVILEGE_PRESENT'; end if;
  v_checks:=v_checks||jsonb_build_array(jsonb_build_object('check','RLS_AND_PRIVILEGE_HARDENING','status','PASS'));
  update public.ai_office_jobs set status='COMPLETED',phase='DONE',result=jsonb_build_object('self_test',true,'quality_score',95),completed_at=now(),locked_by=null,locked_at=null,lease_expires_at=null where id=v_parent;

  delete from public.ai_office_api_requests where client_hash=v_client_hash;
  delete from public.ai_office_events where job_id=any(v_job_ids);
  delete from public.ai_office_execution_steps where job_id=any(v_job_ids);
  delete from public.ai_office_quality_reviews where job_id=any(v_job_ids);
  delete from public.ai_office_usage_ledger where job_id=any(v_job_ids);
  delete from public.ai_office_jobs where id=any(v_job_ids);
  update public.ai_office_system_test_runs set status='PASS',checks=v_checks,result=jsonb_build_object('document_integrity',v_integrity,'dependency_propagated',v_propagated,'transition_count',v_transition_count,'temporary_jobs_removed',not exists(select 1 from public.ai_office_jobs where id=any(v_job_ids))),completed_at=now() where id=v_run_id;
  return(select to_jsonb(r) from public.ai_office_system_test_runs r where id=v_run_id);
exception when others then
  v_error:=sqlerrm;
  begin
    delete from public.ai_office_api_requests where client_hash=v_client_hash;
    delete from public.ai_office_events where job_id=any(v_job_ids);
    delete from public.ai_office_execution_steps where job_id=any(v_job_ids);
    delete from public.ai_office_quality_reviews where job_id=any(v_job_ids);
    delete from public.ai_office_usage_ledger where job_id=any(v_job_ids);
    delete from public.ai_office_jobs where id=any(v_job_ids);
  exception when others then null; end;
  update public.ai_office_system_test_runs set status='FAIL',checks=v_checks,error_message=v_error,result=jsonb_build_object('temporary_jobs_removed',not exists(select 1 from public.ai_office_jobs where id=any(v_job_ids))),completed_at=now() where id=v_run_id;
  return(select to_jsonb(r) from public.ai_office_system_test_runs r where id=v_run_id);
end;$$;

revoke all on function public.ai_office_run_stage11_self_test() from public,anon,authenticated;
grant execute on function public.ai_office_run_stage11_self_test() to service_role;
