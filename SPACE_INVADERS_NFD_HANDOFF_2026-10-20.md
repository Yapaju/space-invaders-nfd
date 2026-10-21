# Space Invaders NFD — Chat Handoff
**Prepared:** 2026-10-20
**Purpose:** Attach this file in a new ChatGPT conversation to resume work without losing project decisions, development workflow, and current deployment status.

## 1. Project and collaboration
- Project: **Space Invaders NFD**, a browser-based, meme-themed Space Invaders game using Phaser 3, Rollup, TypeScript and custom glossy cartoon artwork.
- GitHub repository: `Yapaju/space-invaders-nfd` (branch `master` as shown in Vercel).
- User works with **Codex** to implement changes. ChatGPT helps design, troubleshoot, and prepare detailed ready-to-paste Codex instructions. Do not claim to have inspected the repository unless actually given access.
- **Critical rule: Codex must never commit, push, merge, or deploy without explicit authorization from the user for that specific action.** User personally controls commits, pushes and deployments. Include the prohibition in Codex implementation prompts. This rule was established after an earlier accidental unauthorized commit/push.
- The user appreciates step-by-step, beginner-friendly instructions and specific numerical gameplay specifications.

## 2. Current status: Wave Director V2 completed and pushed
- **Wave Director V1 (WD1)** was approved, finalized and documented in `docs/WAVE_DIRECTOR_V1.md`. Treat that document as frozen: do not edit.
- **Wave Director V2 (WD2)** introduces Premium Invaders and **Premium Wojak**. The user approved WD2, personally committed and pushed it.
- Git commit confirmed by Vercel: **`2ca135f`**, title `feat: Add Premium Wojak and Wave Director V2`.
- `docs/WAVE_DIRECTOR_V2.md` describes the complete WD2 rules. After this approved push, treat WD2 as a stable baseline; future substantive changes should be planned deliberately, without silently modifying frozen historical docs.
- Codex reported seven relevant test scripts, Canvas/WebGL checks, TypeScript, production build and diff checks passing, with 88 asset copies preserved. This is a Codex report, not an independent repository audit.

## 3. WD1 baseline gameplay — preserve unless explicitly changing
- Formation: **6 columns × 4 rows = 24 logical slots**; positions `x = 180 + column*88`, `y = 100 + row*74`. No holes or arbitrary formation geometry changes.
- Regular wave compositions:
  - Wave 1: 24 Pepe.
  - Wave 2: 24 PONKE.
  - Waves 3–5: 12 Pepe + 12 PONKE.
  - Wave 6: 24 Popcat.
  - Wave 7 onward: one of four combinations: 12 Pepe/12 PONKE; 12 Pepe/12 Popcat; 12 PONKE/12 Popcat; or 8 of each. Wave 7–10 compositions including newly introduced Popcat weighted 1.25×; from Wave 11 onward each of four combinations equally likely. Seeded shuffling, repeats allowed.
- Regular movement: `speed = 100 * 1.02**floor((wave-1)/5) * [1,1.10,1.25,1.40,1.50][(wave-1)%5]` px/s. No cap on cycle-to-cycle 2% baseline growth. Survivor acceleration separately reaches up to 1.5× wave-start speed.
- Global regular firing scheduler: `intervalMs = 1610 * 0.98**floor((wave-1)/5) * [1,0.90,0.75,0.60,0.50][(wave-1)%5]`. One random living regular invader fires per event. Pepe fires one aimed shot; PONKE fires one banana; Popcat fires an 80% five-popcorn burst or a 20% golden kernel/giant two-damage popcorn. Popcat reserves five available threat slots. Retry after 250ms if blocked.
- Maximum **15 simultaneous hostile threats from regular invaders**. Premium Wojak's autonomous attacks are excluded from this cap.
- Full Boss Wojak appears after every ten regular waves (10, 20, etc.), in a separate boss encounter. Do not change his original mechanics while adjusting Premium Wojak.

## 4. Premium Wojak — implemented, tested, approved
- One Premium Wojak occupies **four adjacent logical slots (2×2)** in the 6×4 regular formation, with one of 15 valid positions selected by seeded randomness. One Premium wave has **20 regular invaders + 1 Premium** (24 logical slots occupied). A non-Premium wave retains 24 regular invaders. The formation and movement remain consistent; survivor acceleration accounts for 21 actual entities when one Premium is present.
- Premium Wojak uses scaled versions of the full boss artwork, charts, percentage text and lighting, but has distinct smaller hitbox and collision logic.
- **Five successful hits** to defeat: starts +50%; hit 1 → +25%; hit 2 → 0%; hit 3 → −30%; hit 4 → −70%; hit 5 → REKT and defeat.
- On accepted nonlethal hits: **four red flashes over 800ms**, 100ms red + 100ms normal ×4. Invulnerable for all 800ms; player shots striking during immunity are consumed and do not count as hits. Full Boss Wojak is unchanged.
- Autonomous Premium attacks (not part of the regular global firing scheduler; not subject to the 15-threat regular cap):
  - +50%: no attacks.
  - +25%: candle every **1000ms**.
  - 0%: candle every **800ms**.
  - −30%: candle every **~666.67ms**; single tear every **~2333.33ms**.
  - −70%: candle every **400ms**; three-tear spread every **1250ms**.
- Premium dies with an appropriately enlarged *normal invader explosion*; **no boss cinematic**, no PUMP IT/God Candle, no boss transition. Clean up Premium projectiles/effects as needed.
- Original full Boss Wojak remains a separate encounter with its own damage model, attack timings, effects, and behavior.

## 5. Normal Premium spawning — now LIVE (debug forced spawn OFF)
- Premium Wojak remains locked until the player **successfully completes the full Boss Wojak defeat** in the current run.
- Three **complete regular waves** must pass after boss defeat. Example: defeat full boss after Wave 10 → waves 11, 12, 13 cannot contain Premium Wojak → **Wave 14 is first eligible**.
- Each eligible regular wave has an independent **seeded 10% probability** to spawn Premium Wojak. No pity timer, no guarantee every 10 waves, no cooldown, and consecutive appearances allowed.
- Unlocks are **run-local** and reset on a completely new run.
- Test mode, which previously forced Premium Wojak into every regular wave starting at Wave 1, is **OFF by default**. Debug override is retained for development.
- Design supports future Premium boss types with independent spawn rolls and non-overlapping 2×2 placement; only Wojak is implemented so far. Synthetic tests covered future-type packing.
- Codex's final spawning changes were in `src/interface/wave-director.ts`, `tests/premium-spawn.cjs`, `tests/premium-wojak-browser.cjs`, a regression-test comment in `tests/wave-director-browser.cjs`, and `docs/WAVE_DIRECTOR_V2.md`. V1 remained untouched.

## 6. Vercel deployment — successful
- Vercel project: `space-invaders-nfd`, connected to GitHub repository and `master` production branch.
- Production game URL: **https://space-invaders-nfd.vercel.app**.
- Vercel screenshot showed deployment **Ready**, **Production / Current**, source `master`, commit **`2ca135f`**, and a deployment preview of the game on Wave 1.
- Initial Vercel build failed with `[STATIC_BUILD_NO_OUT_DIR]` because it expected a `public` folder. Rollup successfully generated `dist/game.js`. Resolved through Vercel Project Settings → Build and Deployment: Framework Preset **Other**, Build Command default (`npm run build`), Output Directory override **`dist`**, Root Directory `./`. Redeploy then succeeded.
- The screenshot demonstrates a successful production deployment and preview. **No explicit confirmation yet that gameplay, sound, controls and all assets were manually tested in the deployed URL.** Check these before wide distribution.
- Partners can access the URL in a browser without local installs or the developer's computer running. Browser sessions are independent; no multiplayer/shared score is implied.
- Vercel usually automatically builds/deploys pushes to the production branch, meaning the user controls source pushes but should understand that a push to `master` may publish a new production build. A separate preview/staging environment can be added later if desired.
- URL is generally public unless access protection is configured. Hobby plan has terms/limits; avoid promising unconditional permanent free hosting or guaranteed uptime.
- Vercel deployment history/rollback can help recover from problematic updates.

## 7. Art direction and PNUT concept (possible next task)
- The wider project uses a unified vibrant, polished, **glossy/shiny 2D cartoon/comic** look with bold dark outlines and expressive meme characters.
- PNUT squirrel invader artwork was explored but **not established as implemented gameplay**. Concept: orange-brown chibi squirrel with oversized head, **plain brown cowboy hat with NO logo**, only two hands, huge fluffy tail curling away from exhaust. DIY ship based on three peanut shells (central hull and two **closed** peanut-shaped side engines) with scrap metal straps/rivets and glowing engines. Assorted nuts (acorns, walnuts, hazelnuts, etc.) in rear cargo bins, **not peanuts**, and **no nuts in cockpit**. Transparent background PNG; roughly 1356×1024 was used for concept art. User had paused this to finish Premium Wojak.
- Other potential next work: PNUT as fourth regular invader, or another full boss which could later unlock another Premium. These are suggestions, **not approved implementation tasks**.

## 8. Immediate next steps / open items
1. User has successfully pushed WD2 and deployed the game to Vercel for partners to playtest.
2. Share `https://space-invaders-nfd.vercel.app` with partners after checking that the live game loads and plays correctly, including sound, images, controls, wave transitions and boss encounters.
3. Gather partner feedback and bugs; avoid making unsolicited gameplay changes.
4. If user wants private access, investigate Vercel protection options appropriate to their plan. An obscure URL alone is not access control.
5. When starting the next development task, clarify desired scope and prepare a Codex prompt; **never authorize Codex to commit, push, merge, or deploy unless the user expressly says to do so**.

## 9. Conversation style and file/version discipline
- Be practical, collaborative, and precise. Explain steps in beginner-friendly terms.
- For ready-to-paste Codex requests, provide a comprehensive instruction covering scope, preservation requirements, tests, documentation and explicit Git prohibition.
- Preserve `docs/WAVE_DIRECTOR_V1.md` as frozen. WD2 has now been approved/pushed; don't casually overwrite it or invent V3 without a clear new scope/decision. New version documents should have a **Changes from Previous Version** section near the top and be complete standalone specifications.
- Distinguish user/Codex reports from directly verified repo contents.
