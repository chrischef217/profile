# Unity Global AI Office — Stage 11 Hardened

## Fixed execution decision — 2026-08-04

- Build the full approved functional scope before reporting.
- Run integrated QA, fix discovered bugs, rerun the complete test suite, then provide one final result report.
- Do not fragment development into artificial one-feature-at-a-time reporting.
- Never invent credentials, THB limits, approvals or external facts.
- Game V5 remains the canonical frontend and its visual design is frozen.

## Runtime scope

Stage: `ONLINE_MULTI_AGENT_STAGE_11_HARDENED`

Implemented as one integrated runtime:

- PMO orchestration and specialist Agent execution
- Capability and Context validation
- Document integrity enforcement
- Independent Audit quality gate and revision cycle
- Dependency-failure propagation
- Job transition audit history
- Lease recovery and maximum-attempt enforcement
- One active job per Agent
- Approval gate and approval resume
- API mutation rate limiting
- Command idempotency
- Credential replacement lock after initial Vault configuration
- Usage, token and THB cost ledger
- Execution steps and system test records
- Public Data API privilege removal for all AI Office tables
- Explicit deny RLS policies for service-only tables
- Scheduled live deployment QA

## Database additions

- `ai_office_job_transitions`
- `ai_office_system_test_runs`
- `ai_office_api_requests`
- `ai_office_propagate_dependency_failures()`
- `ai_office_check_rate_limit(...)`
- `ai_office_finalize_api_request(...)`
- `ai_office_run_stage11_self_test()`
- Hardened `ai_office_claim_jobs(...)`

## Edge Functions

- Public compatibility API: `unity-ai-office-prod` version 9
- Stage 11 front door: `unity-ai-office-prod-v5`
- Runner bridge with scheduled QA: `unity-ai-office-runner` version 9
- Internal runtime runner: `unity-ai-office-runner-v2`
- Scheduled live QA: `unity-ai-office-stage11-live-qa`
- OpenAI Vault gateway: `unity-ai-office-openai-gateway`

## Verified deterministic integration test

`STAGE11_FULL_WORKFLOW`: PASS

- Document integrity: PASS
- Dependency failure propagation: PASS
- One job per Agent concurrency: PASS
- Approval gate and resume: PASS
- Quality, usage and transition audit: PASS
- Command idempotency and rate limiting: PASS
- RLS and privilege hardening: PASS
- Transition records generated: 18
- Temporary QA jobs removed: true
- Required documents: 9/9
- Active document chunks: 32
- Missing documents: 0
- Stale documents: 0
- Open critical conflicts: 0

## Canonical frontend

- `unity-ai-office-v5/index.html`
- Live URL: `https://raw.githack.com/chrischef217/profile/main/unity-ai-office-v5/index.html`
- Game V5 visual files were not modified by Stage 11.

## Remaining external activation gates

Paid model execution is intentionally blocked until both real values exist:

1. OpenAI API key stored in Supabase Vault.
2. Managing Director-approved daily and monthly THB cost limits.

After both inputs exist, run one real paid PMO → specialist Agents → PMO synthesis → Audit review E2E job and obtain GPT(PMO) final approval.

No key or budget value may be invented, inferred, committed to GitHub or stored in browser code.
