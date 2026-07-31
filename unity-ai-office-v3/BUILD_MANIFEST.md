# Unity Global AI Office V3 — 4:3 Desktop Build

## Fixed visual baseline

- Logical desktop canvas: **1600 × 1200 (4:3)**
- Shell rule: `width:min(100vw,calc(100vh * 4 / 3))`
- Shell rule: `height:min(100vh,calc(100vw * 3 / 4))`
- Main split: office map 58% / operations rail 42%
- Approved office reference is the source of the isometric office map.
- Palette: charcoal/navy surfaces, warm cream text, restrained bronze/gold frame, green/orange/blue status accents.

## Motion baseline

Motion is visual status feedback only and must never imply that a model completed work.

- office map breathing
- monitor light flicker
- PMO pulse rings
- scan sweep
- data courier route
- active department bob/pulse
- status indicator blink

## Functional baseline

- state refresh every 15 seconds
- command and task-template submission
- Jobs / Results / Approval / System tabs
- approve / reject / retry controls
- scheduler activation and pause controls
- 8 bottom sections
- Korean / Thai locale switching

## Execution truthfulness

- No model result is presented as completed without a configured model credential and a verified runner response.
- Missing model credential remains `BLOCKED / OPENAI_API_KEY_NOT_CONFIGURED`.
- AI Office remains separate from UG SALES.

## Active entry

- `unity-ai-office-v3/index.html`
- legacy `unity-ai-office/index.html` and `unity-ai-office/online.html` redirect here.

## Deprecated

- square V2 canvas
- 320 × 382 low-resolution office map
- blue-heavy color drift
- static office scene without ambient/status motion
