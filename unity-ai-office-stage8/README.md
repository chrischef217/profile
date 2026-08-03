# Unity Global AI Office — Stage 8 Secure Control

## Current status — 2026-08-03

The visual game design is deferred. Operational activation is the current priority.

AI Office remains technically and operationally separate from UG SALES.

## Deployed components

- Secure administrator API: Supabase Edge Function `unity-ai-office-prod` version 3
- Secure web console: `unity-ai-office-control/index.html`
- Internal multi-agent runner: `unity-ai-office-runner` version 7
- Recovery scheduler: every minute
- Orchestration: PMO PLAN → 1–5 specialist jobs → PMO SYNTHESIS
- Concurrency: maximum 3 jobs, maximum 1 concurrent job per agent
- Knowledge: 12 active context packages, 10 active capabilities, versioned 2026-08-03
- Usage, token, THB cost, approval, result, error and event logging

## Security state

- Administrator passcode is stored only as a SHA-256 hash.
- Login returns an expiring bearer session; old sessions were revoked during transition.
- Public development write APIs were retired and return HTTP 410.
- `OPENAI_API_KEY` is not stored in GitHub, browser code, Markdown or chat.
- Verified model pricing and positive daily/monthly THB limits are mandatory before model activation.
- External tool execution remains disabled.
- OpenAI requests use `store:false` in the internal runner.

## Verified checks

- Secure API health: HTTP 200
- Invalid administrator login: HTTP 401
- Authenticated session check: HTTP 200
- Authenticated preflight: HTTP 200
- Authenticated state: HTTP 200
- Public development state endpoint: HTTP 410
- Secure control console: HTTP 200, `text/html`
- Runner schedule: HTTP 200 every minute

## Not yet complete

Actual paid model execution is not active. The remaining gates are:

1. Add `OPENAI_API_KEY` through Supabase Edge Function Secrets. Never commit or paste it into chat.
2. Managing Director approves and saves positive daily and monthly THB limits.
3. Enable a verified model profile through the secure console.
4. Run a real PMO → specialist agents → PMO synthesis end-to-end job.
5. Review tokens, THB cost, output, errors and approval logs, then obtain GPT(PMO) final approval.

Do not describe the system as fully operational until all five gates are completed.
