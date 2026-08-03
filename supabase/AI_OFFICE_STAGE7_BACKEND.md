# Unity Global AI Office — Stage 7 Backend

## Deployment state

- Supabase project: `ckzwmimmwdnmpohgvcka`
- Runtime stage: `ONLINE_MULTI_AGENT_STAGE_7`
- Public development API: `unity-ai-office-dev-open` version 3
- Frontend gateway: `unity-ai-office-dev-open-v2` version 2
- Internal runner: `unity-ai-office-runner` version 7
- Scheduler: immediate trigger after command/approval/retry plus `pg_cron` recovery every minute
- Maximum batch concurrency: 3
- Maximum concurrency per agent: 1

## Current activation state

The execution pipeline is deployed but paid AI execution remains disabled until both conditions are satisfied:

1. `OPENAI_API_KEY` exists in Supabase Edge Function secrets.
2. Positive daily and monthly THB budget limits are set through `/admin/budget`.

`/admin/model` rejects activation if the key, verified price, or budget limits are missing.

## Model registry

- `openai_standard` — `gpt-5-mini-2025-08-07`
- `openai_reasoning` — `gpt-5.4-mini`
- `openai_review` — `gpt-5.4-mini`

Agent model policy is stored in `ai_office_agent_model_policy`. PMO, Design, Development and Audit use the reasoning profile by default. Other specialist agents use the standard profile. PMO and Audit have a separate review profile.

## Job flow

1. A free-form command creates a PMO `ORCHESTRATION` job in phase `PLAN`.
2. The PMO calls the OpenAI Responses API with strict JSON Schema output.
3. The plan creates one to five specialist child jobs.
4. The atomic claim RPC leases up to three runnable jobs, with no duplicate execution for one agent.
5. Child jobs execute against their Capability Package and selected company Context.
6. When every child job is terminal, the parent is re-queued in phase `SYNTHESIS`.
7. PMO produces one integrated decision-ready report.
8. Tokens, estimated THB cost, model, context versions, events and failures are recorded.

## Database migration

Migration `ai_office_multi_agent_runtime_v1` added:

- Parent/root job hierarchy
- Job type and execution phase
- Dependency arrays and execution priority
- Worker lock and lease fields
- `ai_office_model_registry`
- `ai_office_agent_model_policy`
- `ai_office_knowledge_chunks` with pgvector-compatible embeddings
- Atomic `ai_office_claim_jobs` RPC
- Verified model pricing records

Existing Agent, Job, Event, Capability, Context and Template records were preserved.

## Safety controls

- API keys never appear in browser code or repository files.
- OpenAI calls use `store:false`.
- External tool execution remains disabled.
- Verified model pricing is mandatory.
- Daily and monthly THB budget limits are mandatory.
- Atomic leases prevent duplicate workers.
- Stale jobs are recovered or failed after maximum attempts.
- L2/L3 jobs require approval.
- Payments, transfers, deletion, external publishing and production deployment are not automatically executed.

## Validation completed

- Gateway health: HTTP 200
- Frontend state gateway: HTTP 200
- Runner authorization: HTTP 200
- Empty queue: `NO_QUEUED_JOB`
- Model activation without key: HTTP 409 `OPENAI_API_KEY_NOT_CONFIGURED`
- Invalid budget: HTTP 400 and no database mutation
- Temporary job flow: command 202 → immediate runner → atomic claim → safe model gate → lock release → Agent returned to IDLE
- Temporary QA records were deleted after validation

## Required manual activation

In Supabase Dashboard, add the Edge Function secret named `OPENAI_API_KEY`. Do not commit it to GitHub or send it through the browser application. Then set explicit budget limits and enable the `openai_standard` model profile through the admin API.
