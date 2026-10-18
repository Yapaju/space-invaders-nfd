# NOT FLIP DOGE Invaders — Complete Session Handoff

**Checkpoint:** v0.11 Wojak mini-boss prototype committed and pushed by user through GitHub Desktop.  
**Purpose:** Resume design and implementation tomorrow without losing gameplay decisions, approved mechanics, asset locations, temporary overrides, and open questions.  
**Status source:** User's playtest confirmations and discussion; no direct repository inspection was performed for this handoff.

## 1. Collaboration and workflow

- Project: **NOT FLIP DOGE Invaders**, a browser game using **Phaser 3 / TypeScript**.
- Local Windows repository: `C:\Users\The S\Documents\GitHub\space-invaders-nfd`.
- User playtests locally, typically at `localhost:4201`.
- **Codex implements code. ChatGPT helps design features and writes detailed, narrowly scoped Codex prompts.**
- **User handles all commits and pushes personally in GitHub Desktop.** Never give Git terminal commands as the default, and never instruct Codex to commit, push, or deploy.
- When the user asks for GitHub Desktop commit text, provide **title and description only**.
- Avoid unrelated refactors or changing previously approved gameplay. Prefer incremental prototypes and hands-on playtesting.
- Art is prepared/curated by user and sometimes edited in Photoshop; maintain consistent sprite size, alignment, and visible geometry between animation states.

## 2. Game foundation and approved prior features

### Regular gameplay / v0.7
- Standard formation: **24 invaders in 6 columns × 4 rows**.
- **PONKE on odd-numbered waves; PEPE on even-numbered waves**.
- DOGE player near bottom of screen.
- Banana weapon has an arc and yellow 48px explosion; PEPE fires a red orb.
- DOGE flashes red briefly on damage.
- Up to **3 lives**; recover **1 life each wave**. Life icons appear beneath LIVES, aligned right, and deplete right-to-left.

### HUD / v0.8
- Custom golden NOT FLIP DOGE typography:
  - `assets/texts/nfd-hud-score.png`
  - `assets/texts/nfd-hud-wave.png`
  - `assets/texts/nfd-hud-lives.png`
  - `assets/texts/nfd-text-game-over.png` (GAME OVER and PRESS SPACE TO RESTART combined in one transparent image)
- Custom numeric glyphs: `assets/font/nfd-font-0.png` through `nfd-font-9.png`.
- SCORE top-left, WAVE X top-center, LIVES top-right; large centered wave announcements.
- Preserve the existing HUD and GAME OVER appearance/depth unless explicitly asked to change it.

### Elon ally / v0.9
- Elon in red Tesla Roadster with blue rocket thrusters; moves horizontally in lane below HUD and above invader formation.
- Assets in `assets/meme-skins/`:
  - `elon-ally-left.png`, `elon-ally-right.png`
  - `elon-ally-hit-left.png`, `elon-ally-hit-right.png`
  - `elon-ally-escape-left.png`, `elon-ally-escape-right.png`
- Appearance remains in **temporary test mode: 100% of waves starting Wave 2**, max one appearance per wave.
- Spawn timing chosen once per wave based on actual formation downward steps: **40% second descent, 35% third, 25% fourth**. No elapsed-time spawning.
- Direction is 50/50. Flight speed/size/lane were approved after adjustments; do not alter without request.
- Shooting Elon triggers a brief **blue hit flash**, then **1 second** stationary directional hit frame, then directional escape art and a fast off-screen departure.
- Enemy shots ignore Elon; shots after initial hit pass through; he is an ally, not a formation enemy.
- Production intent later: reduce appearance to ~30% of waves starting Wave 3, but **do not change the test override now**.

### Rapid Fire / v0.10 — committed and pushed before Wojak work
- Successful player hit on Elon activates **10 seconds of rapid fire** at **1.5× normal firing rate** (cooldown divided by 1.5).
- No change to damage, projectile velocity, or collision dimensions.
- Boosted shots use **animated electric-red laser**; normal shots remain blue.
- Laser assets: `assets/weapons/rapid-laser/` containing `rapid-laser-01.png` through `rapid-laser-06.png`, `rapid-laser-spritesheet.png`, `rapid-laser-static.png`, and README.
- Previous attempts at a red aura around DOGE and runtime projectile glow were disliked and explicitly removed. **Do not reintroduce them.**
- Circular buff countdown located below WAVE. Ring shrinks smoothly; center displays remaining seconds using the game's custom digit style.
- **Timer and progress ring pause during wave transitions whenever player shooting is disabled**, then resume from exact remaining time. User confirmed this works perfectly. Preserve it.
- Rapid-fire effect persists across normal wave transitions; clears on expiration, GAME OVER, and restart. Repeat activation refreshes duration without stacking speed.
- Timer ring/digits were changed toward electric red to associate buff color with weapon. **Known deferred polish:** red recoloring of countdown digits is not yet ideal. Do not block Wojak work on this; revisit later.
- Future buffs: circular indicators, each with signature color; timed buffs show countdown number and shrinking ring, permanent buffs use a logo and fixed ring. Do not implement additional buffs yet.

## 3. Wojak first mini-boss — creative vision

### Placement and theme
- First mini-boss is **Wojak, the crypto trader**.
- **Intended production placement: between Wave 10 and Wave 11**, with Wojak appearing **alone**, not alongside normal invaders.
- The boss's **portfolio return replaces a conventional health bar**. Percentage is shown on the large central display of his trading spaceship.
- The narrative arc: Wojak arrives ecstatic at **+50%**, takes damage as DOGE shoots him, turns anxious as profits shrink, starts attacking once he falls below zero, then panics/cries as the portfolio plunges toward **−99.9% liquidation**.
- Facial expression is central: smug/happy → calm/confident → concerned/shocked → angry → crying/devastated. Ship lighting green while profitable; red when negative.
- Two side monitors show trading candlestick charts that eventually respond to damage. User wants **matching/identical charts on both monitors**, initially high on screen so there's room for a dramatic decline. Potential approach later: draw charts dynamically with Phaser, updating every X% loss, but **NOT implemented in current prototype**.
- Possible future attacks: falling red candlesticks in negative-portfolio phase and diagonal tears in deeper-loss phase. No attacks yet.
- No separate boss HP bar.

### Art direction
- Polished 2D cartoon/comic style: dark bold outlines, glossy highlights, expressive meme character, sci-fi trading hovercraft with green neon accents, two monitors, central percentage display, orange rocket exhaust.
- User prefers simple/readable details at small in-game size.
- User wants **transparent backgrounds**, no scenery or extra elements. Earlier generated images sometimes had black/gradient/checkerboard backgrounds despite requests, so verify actual alpha/transparency rather than trusting the appearance.
- User found image generation unable to maintain the **exact same spaceship geometry** across expressions; intends to adjust assets personally in Photoshop later.
- Keep character/ship geometry and visual alignment as stable as possible across sprite transitions; artwork differences are an outstanding issue, not a reason to add complex runtime corrections prematurely.

## 4. Wojak v0.11 prototype — CURRENTLY IMPLEMENTED AND PUSHED

### Asset folder and exact filenames
`assets/mini-boss/wojak/`
- `wojak-green-50-right.png` — ecstatic/smug, +50%.
- `wojak-green-40-right.png` — +40%.
- `wojak-green-25-right.png` — calm/confident, +25%.

The filenames and location were confirmed in a Windows Explorer screenshot. These are separately generated PNGs, and their geometry may not perfectly match.

### Encounter and movement
- After clearing the trigger wave, Wojak arrives alone, descending from above into a hovering patrol.
- He moves slowly and smoothly **left ↔ right**, with subtle vertical bobbing (~6–8 px suggested), reversing at safe boundaries, not descending like a standard invader.
- Keep orientation as supplied; do not invent left-facing art.
- Player shooting disabled during entrance, enabled for the fight. Boss currently **does not attack**.
- Exact scale, speed, and patrol bounds are implementation values chosen by Codex; not independently verified in this handoff.

### Portfolio / damage / visual thresholds
- Starts at **+50%**.
- **1 successful DOGE projectile hit = −1 percentage point** of portfolio.
- **+50 through +41**: continue displaying `wojak-green-50-right.png`.
- **On 10th hit, +40**: switch to `wojak-green-40-right.png`.
- **+40 through +26**: retain +40 art (even though internal percentage decreases).
- **On 25th hit, +25**: switch to `wojak-green-25-right.png`.
- Since only three sprites exist, **temporary prototype ends at +25%**: briefly hold the last art (~1–1.5s suggested), clean up Wojak, and resume the next regular wave. This is **not** his eventual death/liquidation point.
- Percentage display is **baked into PNGs**. There is no live percentage text rendering in current prototype.
- Both normal blue shots and electric-red rapid-fire shots can hit the boss; each projectile should register once, with reasonable ship collision body rather than whole transparent canvas.
- Preserve DOGE lives, controls, HUD, Elon, and Rapid Fire mechanics. Clean boss state on GAME OVER/restart.

### CRITICAL TEMPORARY SPAWN OVERRIDE
- The first implementation triggered Wojak **after Wave 10**.
- The most recent change, **implemented, manually tested, and committed/pushed**, moves him **between Wave 1 and Wave 2** for convenient testing.
- Codex was instructed to use named constant:
  `WOJAK_TRIGGER_AFTER_WAVE = 1`
  with comment that intended production value is `10`.
- If a different configuration mechanism already existed, Codex was told to reuse it. **Inspect actual code before assuming the exact constant exists.**
- Current expected sequence: **Wave 1 → Wojak prototype → Wave 2 → Wave 3 → normal progression**, once per run.
- Do **not** revert to Wave 10 until user explicitly approves ending the testing override.

### Current user confirmation
- User said **first Wojak implementation works**.
- User then asked to trigger it after Wave 1; Codex did so; user confirmed **it works**.
- User committed and pushed through **GitHub Desktop**.
- Commit title supplied: `feat: add Wojak mini-boss prototype (v0.11)`.
- The user did not provide the Git hash or Codex test output; don't invent them.

## 5. What remains to design and build

### Immediate next session: inspect/playtest and choose next small milestone
1. Ask user what they noticed in the first Wojak test: **size/readability, hover speed, entrance, hitbox, sprite-switch jumps**.
2. User may want to repair the three sprites in Photoshop to maintain identical ship silhouette and transparent backgrounds. Keep existing image filenames if replacing art so integration remains simple.
3. Agree on next visual milestones below +25% before coding further.

### Next possible art states (NOT created/implemented)
- Near 0%: Wojak's confidence fading; green lights transitioning.
- Below 0%: angry/shocked Wojak, red spaceship lights and terminal, start candlestick attacks.
- Near −50%: crying/panicked Wojak, potentially tear attacks.
- Near −99.9%: devastated/liquidated defeat/escape animation.
- Maintain same spaceship base and positioning across expressions; consider editing one Photoshop master rather than separately generating entire images.

### Live display / chart architecture (concept only)
- Long-term ideal: percentage text and charts rendered live over blank screens, so the art doesn't need a new full-ship PNG for every numeric change. The user currently has baked-in +50/+40/+25 and chose milestone sprite swaps for early tests.
- For dynamic charts, draw matching candlesticks on both monitors, initially high, advancing downward as losses accumulate, perhaps every 5 percentage points. Screens are angled; careful positioning/clipping is needed. Don't promise this is trivial or already implemented.
- Design choice to revisit: whether to retain baked percentage sprites for transitions or switch to a master blank-display asset and runtime display. Don't silently change the current prototype.

### Balance and attacks (NOT locked)
- The user deliberately postponed final numbers; **1 hit = 1% is a test setting**, not necessarily final balance.
- Earlier discussion considered +50% to 0% faster than negative phases, but user explicitly chose **1% per hit for now**. Do not implement earlier 5%-per-hit idea without request.
- Boss should be non-attacking while profitable; starts attacking after going negative. The precise threshold, projectile patterns, rate, boss HP curve, and encounter length remain to be decided.
- Eventually restore boss to after Wave 10 and Elon to production appearance probabilities, only after explicit user agreement.

## 6. Good next Codex prompt practices

- Inspect actual existing files, architecture, scene lifecycle, tests, and asset dimensions first.
- State precise scope and explicitly preserve unrelated systems.
- Use named configurable constants for tuning.
- Include verification: automated tests, TypeScript check, production build; report results without claiming browser playtesting if not performed.
- **Never commit, push, or deploy.** User handles that in GitHub Desktop.
- When asking for a code change, produce a self-contained copyable prompt with exact file paths, thresholds, expected state transitions, cleanup, and tests.

## 7. Outstanding polish and cautions

- Rapid Fire timer **digit coloring** is not quite right yet; user deferred this.
- Electric-red laser looks good; avoid replacing it or reintroducing DOGE aura/glow.
- Timer pause between waves is confirmed working; protect against regression.
- Wojak PNGs are not identical in ship geometry, so sprite swaps may visibly jump. User plans Photoshop fixes.
- Verify actual transparency for Wojak PNGs; prior image-generation attempts sometimes included backgrounds despite transparent requests.
- Current boss at +25% is a temporary demo ending, **not** a final boss defeat.
- Keep Wojak trigger after **Wave 1 for testing** until user says otherwise.
- Current Elon spawn test override (100% Wave 2+, weighted 40/35/25 descents) is still intentional.

## 8. Last user request / state

User confirmed the Wojak trigger-after-Wave-1 implementation works, committed and pushed v0.11 in GitHub Desktop, and requested this complete handoff file for tomorrow's session. No further changes requested tonight.

**Suggested opening tomorrow:** “We have v0.11 pushed, with Wojak appearing after Wave 1 and stopping at +25%. Want to first review his size/movement and sprite transitions, or start designing the 0%/negative-portfolio artwork and attacks?”
