# Unity Global AI Office — Reference V2

## Active design baseline

The visual baseline is the Managing Director-approved modern isometric corporate pixel-office reference. Do not replace it with a different dashboard, flat office, emoji agents, fantasy office, or generic SaaS design.

## Active production files

- `index.html`
- `styles.css`
- `map-v7-01.js`
- `map-v7-02.js`
- `map-v7-03.js`
- `map-v7-04.js`
- `crop-init.js`
- `app-a.js`
- `app-b.js`
- `app-c.js`
- `build-manifest-v2.json`

Only the four `map-v7-*` files form the active office-map asset. Their reassembled WEBP must match:

- Size: 320 × 382
- Bytes: 9,056
- SHA-256: `cff3dcc4b1ea1f1c5f6248edb7e2bb730147d163ff12916f60b952f2343a23da`

## Deprecated files

Any `asset-*`, `office-map-v3*`, `map-v4*`, `map-v5*`, or `map-v6*` file is obsolete and must not be linked, restored, or used as a source of truth. Some are incomplete intermediate uploads retained only in repository history.

## Runtime

- Frontend API: `unity-ai-office-dev-open-v2`
- Development access: no password
- Locales: Korean and Thai
- Refresh interval: 15 seconds
- Scheduler: one-minute governed Runner
- Capability Composition: enabled
- Actual model execution: blocked until a supported model credential and approved execution configuration are securely provisioned
- External write tools: disabled

## Implemented controls

- Jobs / Results / Approval / System
- Command registration and task templates
- Approve / Reject / Retry
- Scheduler pause / activate
- Dashboard / Projects / Agents / Analytics / Knowledge / Resources / Reports / Settings
- Context, capability, tool-policy, event, token and cost visibility

## Truthfulness rule

A job must never be shown as completed merely because it entered the queue. Without a valid model credential or execution authorization, the Runner must return `BLOCKED` with the precise reason.
