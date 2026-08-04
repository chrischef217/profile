-- Unity Global AI Office Stage 9 operational hardening
-- Applied to Supabase project ckzwmimmwdnmpohgvcka on 2026-08-04.

alter table public.ai_office_usage_ledger
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.ai_office_runtime
  drop constraint if exists ai_office_runtime_environment_mode_check;

alter table public.ai_office_runtime
  add constraint ai_office_runtime_environment_mode_check
  check (environment_mode = any (array[
    'DRY_RUN'::text,
    'ONLINE_STAGE_1'::text,
    'ONLINE_PERSISTENT_STAGE_2'::text,
    'ONLINE_ADMIN_STAGE_3'::text,
    'ONLINE_CAPABILITY_STAGE_4'::text,
    'ONLINE_GOVERNANCE_STAGE_5'::text,
    'ONLINE_CONTROL_STAGE_6'::text,
    'ONLINE_MULTI_AGENT_STAGE_9_PMO_QA'::text,
    'PRODUCTION'::text
  ]));

update public.ai_office_runtime
set environment_mode='ONLINE_MULTI_AGENT_STAGE_9_PMO_QA', updated_at=now()
where id='primary';

create table if not exists public.ai_office_runtime_modules (
  module_key text primary key,
  version text not null,
  source_text text not null,
  source_sha256 text not null,
  source_origin text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_office_runtime_modules enable row level security;
revoke all on public.ai_office_runtime_modules from anon, authenticated;

create index if not exists ai_office_runtime_modules_active_idx
  on public.ai_office_runtime_modules(is_active, module_key);
create index if not exists ai_office_quality_reviews_job_round_idx
  on public.ai_office_quality_reviews(job_id, review_round desc);
create index if not exists ai_office_execution_steps_job_created_idx
  on public.ai_office_execution_steps(job_id, created_at desc);
create index if not exists ai_office_jobs_parent_status_idx
  on public.ai_office_jobs(parent_job_id, status);

revoke all on function public.ai_office_claim_jobs(text,integer,integer) from public;
revoke all on function public.ai_office_claim_jobs(text,integer,integer) from anon;
revoke all on function public.ai_office_claim_jobs(text,integer,integer) from authenticated;
grant execute on function public.ai_office_claim_jobs(text,integer,integer) to service_role;

drop index if exists public.ai_office_jobs_queue_priority_idx;

create index if not exists ai_office_agent_model_policy_primary_idx
  on public.ai_office_agent_model_policy(primary_model_key);
create index if not exists ai_office_agent_model_policy_planner_idx
  on public.ai_office_agent_model_policy(planner_model_key);
create index if not exists ai_office_agent_model_policy_reviewer_idx
  on public.ai_office_agent_model_policy(reviewer_model_key);
create index if not exists ai_office_agent_model_policy_fallback_idx
  on public.ai_office_agent_model_policy(fallback_model_key);
