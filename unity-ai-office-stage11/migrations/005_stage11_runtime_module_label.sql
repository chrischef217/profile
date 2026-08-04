-- Align the signed internal runner module with the Stage 11 runtime label.

with updated as (
  select module_key,
         replace(
           source_text,
           'ONLINE_MULTI_AGENT_STAGE_9_PMO_QA',
           'ONLINE_MULTI_AGENT_STAGE_11_HARDENED'
         ) as new_source
  from public.ai_office_runtime_modules
  where module_key = 'stage9_runner'
    and is_active = true
)
update public.ai_office_runtime_modules m
set source_text = u.new_source,
    source_sha256 = encode(extensions.digest(u.new_source, 'sha256'), 'hex'),
    version = '2026-08-04.2-stage11',
    updated_at = now()
from updated u
where m.module_key = u.module_key;
