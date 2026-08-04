-- Final Stage 11 security and performance hardening applied on 2026-08-04.

begin;

create index if not exists ai_office_api_requests_job_id_idx
  on public.ai_office_api_requests(job_id);

create or replace function public.ai_office_credential_status()
returns jsonb
language sql
security definer
set search_path = public, vault
as $$
  select jsonb_build_object(
    'configured', exists(
      select 1
      from vault.decrypted_secrets
      where name = 'unity_ai_office_openai_api_key'
        and length(coalesce(decrypted_secret, '')) > 20
    ),
    'storage', 'SUPABASE_VAULT',
    'secret_name', 'unity_ai_office_openai_api_key',
    'updated_at', (
      select max(updated_at)
      from vault.decrypted_secrets
      where name = 'unity_ai_office_openai_api_key'
    )
  );
$$;

revoke all on function public.ai_office_credential_status()
  from public, anon, authenticated;
grant execute on function public.ai_office_credential_status()
  to service_role;

commit;
