# Unity Global AI Office — Stage 9 Production Operations

> Effective date: 2026-08-04
> Scope: Unity Global AI Office only. UG SALES remains separate.

## Direction

- V5 game design is frozen at commit `526389e2ea3bb24004bcd49802f510fef24c433d`.
- Current priority is the real AI execution system, not additional game/UI design.
- Every Managing Director command enters PMO orchestration.
- GPT(PMO) governance and final approval remain authoritative.

## Live control console

- Stable review URL: `https://raw.githack.com/chrischef217/profile/main/unity-ai-office-control/index.html`
- Pinned Stage 9 console commit: `a7e55f2cb90487d9e4446940841641382a76e50f`
- Pinned review URL: `https://raw.githack.com/chrischef217/profile/a7e55f2cb90487d9e4446940841641382a76e50f/unity-ai-office-control/index.html`

The console contains:

- Secure administrator login
- PMO command submission
- L2/L3 approval controls
- Supabase Vault OpenAI credential registration and removal
- Daily/monthly THB budget hard stops
- Model selection and activation
- Scheduler and run-now controls
- Quality review scores and defects
- Execution step logs
- Internal self-test

## Deployed Edge Functions

| Function | Current role |
|---|---|
| `unity-ai-office-prod` | Stable compatibility address for the Stage 9 API |
| `unity-ai-office-prod-v2` | Stage 9 secure administrator API |
| `unity-ai-office-runner` | Existing scheduler-compatible runner bridge |
| `unity-ai-office-runner-v2` | PMO, specialist and Audit execution runtime |
| `unity-ai-office-openai-gateway` | Supabase Vault credential and OpenAI Responses proxy |

Development probe and QA functions are not part of the public application contract.

## Runtime flow

```text
Managing Director command
→ PMO PLAN
→ 1–5 governed specialist jobs
→ dependency-aware execution
→ PMO SYNTHESIS
→ independent Audit review
→ one PMO revision when required
→ second Audit review
→ PASS / BLOCKED
→ GPT(PMO) final approval
```

## Quality controls

- Minimum Audit score: 85
- Maximum automatic revisions: 1
- Unsupported claims cannot pass.
- Critical conflicts force `BLOCK`.
- Specialist facts must reference an active Context Key.
- PMO facts must reference specialist Evidence Job IDs.
- Failed or incomplete child jobs cannot be hidden.
- External writes cannot be reported as completed unless an approved tool ledger proves execution.

## Security controls

- OpenAI API keys are stored only in Supabase Vault.
- The key is validated before Vault storage and never returned by APIs.
- OpenAI calls are proxied through the internal gateway with `store:false`.
- Runner and Gateway calls require the 64-character internal runtime token.
- Administrator bearer sessions are stored only as SHA-256 hashes and bound to a client fingerprint.
- Five failed login attempts within 15 minutes trigger rate limiting.
- `ai_office_claim_jobs` is executable only by `service_role`.
- Public development write APIs remain retired.
- External tool execution remains disabled.

## Runtime module supply chain

Stage 9 runner source was originally pinned to commit:

`438a613c9cddd64681de0f325e0d895e3f45aa08`

The deployed runner no longer downloads source from GitHub at runtime. The complete source is stored in `ai_office_runtime_modules`, protected by RLS and verified against SHA-256 before evaluation.

Current internal module:

- Key: `stage9_runner`
- Version: `2026-08-04.1`
- Bytes: `40,810`
- SHA-256: `788e9c4195a102d96779605d4231d409ec1cfb4785dfa15f37e5f0269b776a59`

## Database changes

Migrations applied on 2026-08-04:

1. `ai_office_stage9_operational_hardening`
   - Usage ledger metadata
   - Stage 9 runtime mode constraint
   - Review, step, parent and queue indexes
2. `ai_office_runtime_module_store`
   - Internal runtime module table with RLS
3. `restrict_ai_office_claim_jobs_rpc`
   - Revoke public/anon/authenticated RPC execution
4. `ai_office_advisor_index_cleanup`
   - Remove duplicate queue index
   - Add model policy foreign-key indexes

## Verified checks

- Stable API health: HTTP 200
- Stable API state without login: HTTP 401
- Runner v2 without internal token: HTTP 401
- Runner v2 with internal token: HTTP 200
- Empty queue: `NO_QUEUED_JOB`
- Stage 9 console: HTTP 200, `text/html`
- Console includes Vault and Quality functionality
- Invalid OpenAI key format: HTTP 400 before storage
- Vault status: HTTP 200
- Temporary queued job: claimed once, safely blocked, lock released, Agent returned to IDLE
- Temporary QA Job/Event/Step records deleted
- Current scheduler logs: continuous HTTP 200

## External activation gates

Engineering deployment is complete. Paid model execution remains intentionally blocked until the Managing Director supplies both business inputs through the secure console:

1. A valid OpenAI API key stored in Supabase Vault
2. Positive daily and monthly THB budget limits

After those inputs are saved, activate a verified model and run one paid PMO → specialists → PMO → Audit E2E job. GPT(PMO) must review output, evidence, token usage, THB cost and Audit score before production activation is approved.

Do not describe paid model execution as fully operational before that E2E approval.
