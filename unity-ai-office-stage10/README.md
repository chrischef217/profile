# Unity Global AI Office — Stage 10

## Fixed access decision

- Access mode: `NO_LOGIN_DIRECT`
- Password, passcode, login screen and administrator session authentication are removed.
- These functions must not be recreated unless the Managing Director explicitly reverses the decision.
- Removed endpoints return `410 PASSWORD_LOGIN_REMOVED`.

## Fixed frontend decision

- Canonical user frontend: `unity-ai-office-v5/index.html`.
- Game V5 is the primary AI Office screen and must remain visible.
- “Stop design development and prioritize functions” means freeze the current design; it does not authorize deletion, replacement or redesign.
- The Phaser runtime, office map, NPCs, character movement, layout and existing panels may not be visually changed without an explicit Managing Director instruction.
- Backend, PMO, Agent, document, Audit and cost functions must be integrated behind the existing Game V5 command center and panels.
- `unity-ai-office-control/index.html` is no longer a replacement dashboard. It redirects to Game V5.

## Document-grounded runtime

Required source order:

1. `MASTER.md`
2. `SESSION.md`
3. `DECISION_LOG.md`
4. `SOP.md`
5. `TECH.md`
6. `AI_AUDIT.md`
7. `TODO.md`
8. `PROJECT_DASHBOARD.md`
9. `PROMPT_LIBRARY.md`

Every active version stores the original text, SHA-256 hash, authority rank, source timestamp and linked Knowledge chunks.

### Database objects

- `ai_office_document_sources`
- `ai_office_document_versions`
- `ai_office_context_conflicts`
- `ai_office_document_integrity()`
- `ai_office_chunk_document_version(...)`
- `ai_office_enforce_document_integrity_on_job()`

## Enforcement

- A new PMO `ORCHESTRATION / PLAN` job is rejected when document integrity is blocked.
- `ai_office_claim_jobs(...)` returns no jobs when document integrity is blocked.
- High or critical open conflicts block execution.
- Missing required documents block execution.
- Stale sources are surfaced in the runtime state but do not silently replace facts.
- The Game V5 frontend is protected by the source-of-truth, governance, decision, SOP, technical and audit contexts.

## Verified production state — 2026-08-04

- Required documents: 9/9
- Active Knowledge chunks after UI-freeze synchronization: 11
- Missing documents: 0
- Stale documents: 0
- Open conflicts: 0
- Critical conflicts: 0
- Integrity: `PASS`
- Game V5 HTML: `200 text/html`
- Game payload-a runtime: `200 application/javascript`
- Stage 10 state API: `200 application/json`
- Legacy control entry: redirects to Game V5
- Critical-conflict QA: orchestration insertion blocked
- Critical-conflict QA: runner claim returned 0
- Temporary QA data removed

## Gateways

- Public compatibility API: `unity-ai-office-prod`
- Document-grounded gateway: `unity-ai-office-prod-v4`
- No-login operational API: `unity-ai-office-prod-v3`
- Runner: `unity-ai-office-runner-v2`

## Game integration

- Source: `unity-ai-office-v5/index.html`
- Visual payload files remain unchanged: `payload-a.js`, `payload-b.js`, `payload-c.js`
- Only API compatibility routing was added before the existing runtime loads.
- Stage 10 API routing commit: `f1fbac35a8ce2889a2898f88d86626a498c6bcbd`
- Primary-entry restoration commit: `17fe0f61b1c54cf9c18ebb9eb5803d420e0248fb`

## Remaining external activation gates

The paid model E2E cannot be approved until both real values are provided:

1. OpenAI API key stored in Supabase Vault.
2. Managing Director-approved daily and monthly THB cost limits.

No credential or budget value may be invented, inferred or stored in GitHub/MD/browser code.
