# Unity Global AI Office V4 — Independent Agents

## Active baseline

V4 replaces the invalid V3 approach where office workers were baked into one background image and only decorative dots moved.

## Required rendering architecture

1. `office-scene.svg` is a character-free office environment.
2. `agent-engine.js` creates eleven independent inline SVG agent objects.
3. `agents.css` maps live job status to character motion.
4. Existing V2 operation scripts continue to provide state, command, approval, result and scheduler functions.
5. `layout.css` fixes the desktop canvas at 4:3.

## Independent agents

- Sales
- Product
- Design
- Marketing
- Dev
- Finance
- PMO
- Research
- Admin
- System
- PMO Support

Each agent exists as a separate DOM button and SVG character, can be clicked, and is updated from live job/agent state.

## State motion

- `IDLE`: breathing motion
- `QUEUED`: pacing / tool pulse
- `WORKING`, `RUNNING`, `APPROVED`: work motion and arm animation
- `WAITING_APPROVAL`: blue attention pulse
- `BLOCKED`, `FAILED`: red shake and tool error motion
- `COMPLETED`: green completion pop

## Prohibited regression

Do not use a completed office screenshot containing people as the game background. Do not represent agent movement using dots, glows or scan lines alone. Environment and agents must remain separate rendering layers.
