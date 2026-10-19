# MOON CARDS / SPACE INVADERS NFD — WOJAK SESSION HANDOFF

**Prepared:** 2026-10-18  
**Status:** Wojak mini-boss is playable and considered good enough for now; next session is dedicated to testing, balancing, and polish.  
**Important:** This handoff summarizes the design discussion and user screenshots, not a direct inspection of the repository. Treat specific implementation details as requirements or reported outcomes, and verify against current code. The user performs GitHub Desktop commits/pushes personally. Never commit or push through Codex unless explicitly asked.

## 1. Project and collaboration

- Repository/folder: `Documents/GitHub/space-invaders-nfd` on the user's Windows computer.
- Game: meme-themed Space Invaders-style shooter, part of the Moon Cards/on-chain meme TCG ecosystem.
- Player ship: Doge-themed ship; existing wave system and other bosses/encounters, including PEPE attack logic and Elon.
- Codex performs coding from detailed prompts; user tests in the browser, sends screenshots and feedback, and handles GitHub Desktop commits/pushes.
- The assistant should be concise, practical, and critical when needed; don't offer generic praise. Provide complete, copyable Codex prompts and do not pretend to have read or changed local code.
- For images: preserve the established glossy 2D cartoon/comic style, bold outlines, strong readable silhouettes, transparent PNGs, and exact requested dimensions. User has been particularly frustrated by accidental backgrounds and visual inconsistencies. Use existing assets as the foundation wherever possible.

## 2. Current Wojak encounter concept

Wojak pilots a large spaceship with a portfolio percentage display on its front and two chart monitors behind him. Player shots decrease his displayed portfolio value, driving his character expression, weapons, and chart evolution. The original testing model was **one successful shot = one percentage point**; confirm in code whether this remains true.

Wojak art phases include +50%, +25%, 0%, -30%, -50%, -70%, and the final REKT expression. Assets exist for left/right facing. The emotional arc is euphoria → confidence → distress → hidden tears behind a smiling mask → visibly devastated → black-eyed REKT. Some thresholds share the same artwork; don't assume a distinct image for every number. The boss was initially positioned after wave 1 for testing; confirm the current wave placement in code.

The ship has separate body and lights assets, with green lights in positive phases and red lights in negative phases. During the REKT state the ship lights should be OFF. The spaceship front display shows `REKT` rather than `-99.9%` once defeated.

## 3. Local asset inventory (based on user screenshots)

### Wojak and spaceship

Directory: `assets/mini-boss/wojak/`

Observed filenames (Windows Explorer may hide `.png`):

- `wojak-boss-0-left`, `wojak-boss-0-right`
- `wojak-boss-25-left`, `wojak-boss-25-right`
- `wojak-boss--30-left`, `wojak-boss--30-right`
- `wojak-boss-50-left`, `wojak-boss-50-right`
- `wojak-boss--70-left`, `wojak-boss--70-right`
- `wojak-boss-rekt-left`, `wojak-boss-rekt-right`
- `wojak-boss-spaceship-left`, `wojak-boss-spaceship-right`
- `wojak-green-25-right`, `wojak-green-40-right`, `wojak-green-50-right`
- `wojak-lights-green-left`, `wojak-lights-green-right`
- `wojak-lights-red-left`, `wojak-lights-red-right`
- `wojak-god-candle` (PNG)

**Filename caveat:** Some filenames above are visually read from Explorer and should be confirmed directly in the repo. In particular, verify negative-number hyphens, and whether the asset names include `boss`/`spaceship` exactly as transcribed. Don't rename working assets casually.

### Red candle projectile assets

Directory: `assets/weapons/wojak-red-candle/`

- `wojak-red-candle-1` through `wojak-red-candle-5` (PNG)
- All are red bearish candlesticks with transparent backgrounds and increasing body length.
- **1** is the shortest and **5** the longest. This is a gameplay distinction, not merely cosmetic: longer falling candles obstruct more space and change dodging.

### Tear projectile

Directory: `assets/weapons/wojak-tear/`

- `wojak-tear` (PNG): glossy blue teardrop projectile.
- Trajectory follows/aims toward the player similarly to the original PEPE attack, but sprite orientation is ALWAYS vertical: pointed/small end UP, round/wide end DOWN. Do not rotate the sprite to align with the velocity vector.

## 4. Approved red candle phase behavior

| Portfolio value | Candles | Cadence | Patterns and design intent |
|---|---|---|---|
| +50% to +25% | None | None | Introductory safe window: player discovers boss and percentage counter. |
| +25% to 0% | Sizes 1–3 | 1 projectile every 1.5 s | Gentle introduction; single drops. |
| 0% to -30% | All 5 | Every 1.2 s | Bigger candles become more likely. Introduce gap volleys and staggered rain as soon as portfolio turns red (below 0). |
| -30% to -70% | All 5 | Every 1.0 s | Bigger candles more frequent; occasional two-candle volleys. |
| -70% to -99.9% | All 5 | Every 0.8 s | Strong emphasis on large candles; mixed volleys, gap volleys, staggered rain. |

The user agreed with this escalation and delegated exact weight distributions and volley proportions to the assistant/Codex. **The exact implemented numeric weights and pattern probabilities were not visible in the provided conversation. Inspect the code before claiming them.**

**Critical spawning rule:** Red candles must originate within the horizontal width of Wojak's spaceship, from its leftmost to rightmost edge, rather than random X positions across the entire game screen. The earlier full-screen random spawn felt disconnected and posed little threat to a player chasing Wojak to shoot him. Candles fall vertically, not homing. The pattern should be legible and dodgeable.

## 5. Tear attack behavior

- Begins at **-30%**, the first visible crying phase.
- Before -70%, relatively rare/low intensity, because Wojak is still hiding his tears behind the smiling mask.
- At **-70%**, much more prominent and dangerous.
- The projectiles use the original PEPE-like player-following / player-aimed trajectory mechanic, unlike vertically falling red candles.
- **Non-negotiable orientation:** tear image remains vertically oriented, narrow tip up, large drop down, regardless of movement direction. This was a specific bug fixed by a later Codex request.
- Exact cooldowns, projectile counts, speeds, and tracking strength were not confirmed in this transcript; inspect current code.

## 6. Visual transitions and threshold flash

Portfolio milestones: **+25%, 0%, -30%, -70%**.

At each milestone, a red flashing visual effect should occur. The last requested adjustment replaces a single too-brief flash with **three rapid flashes**, proposed timing:

- RED ON 100 ms
- RED OFF 100 ms
- Repeat 3 times (~600 ms total)
- Trigger only once per threshold crossing; do not retrigger every frame.
- Do not pause game, stop attacks, or alter existing transition logic.
- Restore normal visuals after flashing; reset cleanly on restart/defeat.
- Preserve the previous flash target (don't expand to a full-screen flash if it was originally confined to Wojak/ship).

**Status:** This was the final Codex request in the conversation. User said things are pretty good and ready for polish, but code was not directly inspected. Verify exact timing and behavior in next session.

## 7. Two synchronized chart monitors

- Both rear spaceship monitors MUST display **the same chart**, mirrored in *content/time evolution* (not necessarily horizontally mirrored as geometry).
- The chart is a hybrid procedural drawing over existing ship artwork, rather than static screenshot assets.
- On ship entrance, only a couple of **large green candles** should be visible near the **left side** of each monitor, forming a strong parabolic initial pump. Do not pre-fill the entire screen with a long green chart.
- As shots land, small red candles begin, gradually pushing the chart downward.
- At **-30%**, include a major red crash candle.
- Follow with smaller candles and natural fluctuations.
- At **-70%**, include an even larger red crash candle.
- Continue with smaller declining candles until final value near zero.
- The user provided a real candlestick reference: natural mixed green/red candles, wicks, variable sizes, sideways retracements, overall downtrend, not a straight diagonal line of red dots. Earlier iterations were rejected as unnatural.
- Current implementation looked significantly better after revisions but may still need polish and checking at all phases.

## 8. REKT defeat and God Candle exit

On reaching the defeat condition near **-99.9%**:

1. Switch Wojak to the final **black, heavily crosshatched, hollow-eyed REKT face** (`wojak-boss-rekt-left/right`) matching the ship's current facing direction.
2. Turn off ship accent lights (not necessarily engine thrusters; see issue below).
3. Front portfolio display shows **REKT** in red instead of a percentage.
4. Wojak spaceship stays on screen for the defeat exit; it must NOT simply disappear after the original one-second timeout.
5. A huge green bullish **God Candle** rises from the **bottom boundary of the game screen**, growing upward with a **flat top** and no upper wick/spike. Its bottom is never visible and remains anchored below the viewport.
6. The rising flat top contacts and pushes the Wojak spaceship upward and entirely off the top of the screen.
7. After Wojak is fully offscreen, clean up the ship and God Candle; no candle lingering on screen.

Asset: `assets/mini-boss/wojak/wojak-god-candle.png`.

**Most recent adjustment:** The original God Candle was too wide and overwhelmed the ship. Last Codex prompt requested reducing **rendered width to 50%** of its previous value, maintaining horizontal center alignment with the spaceship, preserving the existing upward growth and push behavior, and not modifying the PNG itself. The request says to preserve aspect ratio and not distort art; inspect current rendering to ensure that the scaling/cropping behavior actually looks correct.

**Potential polish issue:** Screenshot of REKT state still showed orange engine flames, while accent lights were intended to be off. This may be correct (engines are needed to depict the ship being pushed), but verify the user's intended visual language before changing engine flame rendering.

## 9. Elon appearance rule

- Elon encounter is **not eligible before wave 3**.
- Starting at **wave 3**, a **30% independent chance per wave** for Elon to appear.
- The user specifically asked to restore this original intended behavior in the same Codex job as the God Candle integration.
- Confirm the chance is evaluated once per eligible wave, not once per frame or every spawn tick, and confirm interactions with Wojak and other bosses.

## 10. Screenshots and visual feedback observed

- User showed in-game screenshots of Wojak at +47% with initial green monitor charts and at -54% with red declining charts. Initial chart version was poor, overfilled monitors, and looked like dotted lines; later revisions became recognizable candlesticks.
- User showed a REKT spaceship screenshot with black-eyed Wojak, REKT text, and declining red charts.
- User showed a God Candle pushing the REKT ship upward; the candle initially filled much of the ship width. Requested width halving as the last visual adjustment.
- The user explicitly judged the current implementation **good enough for now** and intends to polish tomorrow.

## 11. Likely next-session priorities

1. Ask the user what looked off during final tests, rather than proposing a broad rewrite. Current build is acceptable and should be treated as a stable baseline.
2. Visually check God Candle at half width: alignment, contact with ship, push motion, clipping at bottom, removal at top.
3. Check 3x threshold flashes: visible but not distracting, correct one-time triggering at +25%, 0%, -30%, -70%.
4. Check candle pattern balance: spawns strictly within ship width, meaningful threats when player follows Wojak, larger candle probabilities rising as portfolio falls, gaps remain dodgeable.
5. Check tear trajectory and **vertical sprite orientation** during diagonal homing; verify early vs late frequency.
6. Check chart naturalness on both monitors, identical series, initial left-edge pump, big crashes at -30/-70, end near zero.
7. Check REKT frame facing, accent lights off, REKT text, boss persistence until pushed off, and whether thruster flames should remain visible.
8. Check Elon spawn behavior starting wave 3 at 30% chance, and boss scheduling interactions.
9. Verify performance, resets, collision boxes, screen sizes, and regressions in existing waves/PEPE weapons.
10. Only after user confirms visual polish, consider tuning balance or next game feature.

## 12. Workflow and guardrails for Codex

- Prompts should state exactly what to change, what to preserve, and how to validate.
- Inspect actual repo code/assets before editing; avoid invented paths for source files.
- Keep changes targeted, don't refactor unrelated systems.
- **Do not commit or push**; user uses GitHub Desktop and asks assistant for commit title/description.
- When implementation finishes, ask Codex to summarize files changed, values used, and tests run; distinguish verified tests from assumptions.
- The user will upload this handoff in a new chat; the new assistant should treat it as context and then ask for fresh screenshot/test feedback, rather than blindly regenerating assets or rewriting existing code.

## 13. Suggested commit metadata for this session

**Title:** `feat: complete Wojak mini-boss combat and defeat sequence`

**Description:**

- Complete Wojak's portfolio-based boss phases and visual transitions.
- Add five red candlestick projectiles with progressive difficulty and attack patterns.
- Integrate player-tracking tear attacks and correct their vertical orientation.
- Add synchronized trading charts to both spaceship monitors.
- Implement the REKT defeat state and green God Candle exit animation.
- Enable Elon's random appearances from wave 3 onward.
- Refine God Candle width and triple red flashes at portfolio thresholds.
- Prepare the Wojak encounter for final gameplay balancing and visual polish.

## 14. Start-of-next-session message suggestion

> We're continuing the Space Invaders NFD Wojak mini-boss work. Read the attached handoff carefully. The current build is working and good enough; today we are polishing, not rebuilding. I will show screenshots or explain test feedback, and you should help me write precise Codex prompts. Never commit or push; I do that in GitHub Desktop. Keep existing art/style/attack mechanics unless I ask for a change.

---

**End of handoff.**
