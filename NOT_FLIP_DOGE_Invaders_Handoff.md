# NOT FLIP DOGE INVADERS — COMPLETE PROJECT HANDOFF

**Date:** October 17, 2026  
**Project:** NOT FLIP DOGE Invaders  
**Status:** v0.3 playtested; preparing PONKE (proposed v0.4)  
**Purpose:** Import this document into a new ChatGPT conversation to resume work accurately.

## 1. Project overview

NOT FLIP DOGE Invaders is a meme-themed browser Space Invaders game, forked from `trungvose/space-invaders-phaser-3` (MIT license). It is associated with the broader NOT FLIP DOGE meme/crypto universe and a planned fully on-chain trading card game (TCG). No blockchain, NFT, wallet, or DogeOS integration has been implemented in this game; do not add any without a separate request.

The playable game currently features DOGE as the player, PEPE as the enemy, endless waves, classic coordinated invader movement, custom sprites, and directional DOGE poses. The aim is a polished, funny, playable game, developed incrementally.

## 2. Repository and tools

- GitHub: https://github.com/Yapaju/space-invaders-nfd
- Branch: `master`
- Local Windows repository: `C:\Users\The S\Documents\GitHub\space-invaders-nfd`
- Stack: Phaser 3, TypeScript, Rollup, npm, Node.js 22.14.0.
- Tools: Codex desktop for code changes; GitHub Desktop for commits/pushes; VS Code for inspecting code; Photoshop for precise asset preparation.
- Existing artwork folder: `assets/meme-skins/`.
- User is a beginner developer: give practical, sequential instructions, preferably a single clear copy-paste Codex prompt for one implementation step at a time. Do not pretend to have direct access to their local files.

**Dependency caution:** Initial `npm install` showed approximately 15 vulnerabilities in legacy dependencies. An earlier install modified `package-lock.json` from lockfile v1 to v3; that unintended change was discarded. Do not blindly run `npm audit fix`, upgrade dependencies, or modify `package-lock.json` without explicit permission. Do not deploy publicly or add wallets without a security review.

## 3. Development workflow — essential

1. Discuss and agree on **one** feature.
2. Prepare and approve artwork separately where relevant.
3. Give Codex a tightly scoped implementation prompt; instruct it to inspect the real code first.
4. Codex changes code and runs relevant tests/build.
5. User playtests locally.
6. Fix only issues actually observed.
7. Commit/push through GitHub Desktop only after user approves.
8. Move to the next feature.

Do not bundle multiple large features, refactor unrelated systems, invent file paths or APIs, commit/push/deploy without permission, or silently change gameplay. Keep answers direct and avoid repetitive explanation.

## 4. Completed milestones

### v0.1 — Endless Waves

- 40 invaders per wave, endless waves, wave counter.
- Score and lives persist between waves.
- 1,000-point wave completion bonus.
- Wave difficulty increases.
- Minimum 1.5-second inter-wave transition; wait for player bullets to clear naturally.
- Centered `WAVE X` display.
- Player can move but not shoot during transition.
- Game-over and restart behavior; relevant tests (including `tests/endless-waves.cjs` created during development).
- Playtested, committed and pushed.

### v0.2 — Classic Invader Movement

- Invaders move as a coordinated horizontal formation.
- Reverse at the edges based on leftmost/rightmost **surviving** invaders.
- Descend by half the original row spacing on reversal.
- Game Over when an invader reaches DOGE's line.
- Speed increases within a wave, up to approximately 1.5× with one remaining; retains inter-wave progression.
- Playtested and approved. Verify repository commit state if needed; do not assume a push from an instruction alone.

### v0.3 — Custom DOGE & PEPE Graphics

- DOGE player in glossy blue/white/gold jetpack suit.
- PEPE invaders in red UFOs.
- DOGE fires a straight yellow laser; PEPE fires red energy/plasma orbs.
- Existing pixelated explosions retained for now.
- DOGE sprites:
  - `doge-player.png` — front/idle
  - `doge-player-left.png` — left movement
  - `doge-player-right.png` — right movement
  - `doge-player-turn-left.png` — direct reversal from right to left
  - `doge-player-turn-right.png` — direct reversal from left to right
- Turn sprites show for **33 ms**, only for direct left↔right reversals. Stopping immediately returns to front; moving from idle immediately shows normal directional pose. Preserve physics, hitboxes, positioning, scale, and shooting.
- User playtested and approved final appearance/timing.
- User was given commit/push instructions with proposed message `feat: add custom DOGE and PEPE graphics (v0.3)`. **The conversation does not independently confirm the final push.** Verify if necessary.

## 5. Foundational enemy-design rule

**Each invader type must have its own recognizable skin, signature weapon, and distinctive behavior where applicable.**

Distinct behavior may involve projectile trajectory, firing pattern, special effect, or other mechanic; not every enemy needs different formation movement. Avoid hardcoding future invaders to PEPE's projectile or graphics. Extend existing code minimally; do not prematurely perform a major refactor.

## 6. Current invader: PONKE — Banana Bomber

PONKE was selected as the second invader. Artwork has been iterated and approved. **Do not redesign or regenerate the approved sprite without a request.** The user is currently using Photoshop to mirror an accepted image and save both directions into the GitHub repository.

### Approved visual direction

- Recognizable orange-brown PONKE monkey, **very oversized face** relative to ship so it reads at tiny gameplay size.
- Half-lidded mischievous eyes, evil/smug **closed-mouth** smile.
- Compact bright yellow banana-shaped spacecraft, bold dark outlines, glossy 2D cartoon shading, metal/rivets, red/orange engine accents.
- **Closed transparent bubble cockpit** (space setting), both hands inside.
- Clean silhouette; playful meme proportions, not realistic anatomy.
- Sprite must have **real transparent pixels**, not a baked-in checkerboard or black backdrop.
- No scenery, title, stats, card frame, or other background.

### Two invader directions

User requests **left-facing and right-facing invader skins**, switched based on formation's horizontal travel direction. They are preparing a deterministic Photoshop horizontal flip so the artwork is identical apart from direction.

Suggested filenames: `ponke-left.png` and `ponke-right.png`, but confirm actual names when ready. Use equal canvas dimensions, visual scale, and alignment. **Directional invader rendering is not yet confirmed implemented.** It can later apply to PEPE and other invaders. Do not change movement physics to support directional visuals.

**Lesson from artwork iterations:** AI-generated “mirror” versions changed facial features and ship details, and some image outputs had checkerboard/dark backgrounds. For exact mirroring, cropping, resizing, alignment, and alpha cleanup, use Photoshop/deterministic editing rather than regeneration. Never promise an exact match or real transparency without verification.

## 7. PONKE weapon — small exploding bananas

**Approved concept:** PONKE launches **small bananas** that travel along a **curved arc** and **explode upon reaching the player's horizontal line**. The explosion has a **small damaging hitbox**, forcing DOGE to avoid its landing area. Bananas must be visually distinct from PEPE's red orbs and DOGE's yellow lasers.

**Not implemented yet.** Do not describe it as existing gameplay.

Important details **not finalized** and to discuss before coding:
- Arc direction, height/curvature, and horizontal displacement.
- Whether the arc aims at DOGE's position at launch or follows a fixed path.
- Whether a banana can damage DOGE during flight or only in its explosion.
- Explosion radius, duration, and visual effect.
- How often PONKE fires.
- Damage once per explosion vs. any sustained damage.
- Separate transparent banana and explosion sprites vs. code-generated effect.
- How PONKE and PEPE are distributed across formations/waves.

Prefer tunable parameters and playtest-friendly small steps. Explosion collision should be fair and consistent; clean up projectiles/effects on wave transitions and restart.

## 8. Future invader ideas (not approved for implementation)

- **Crying Wojak:** blue tears, possibly three-projectile diagonal spread. User likes the idea but chose PONKE first.
- **WIF:** spinning pink hats, potentially drifting horizontally.
- **SHIB:** fake DOGE lasers, potentially rapid double shots.

These are brainstorming concepts, not committed roadmap items.

## 9. Visual standards

Across the NOT FLIP DOGE universe: polished, vivid, glossy 2D cartoon/comic, bold dark outlines, clean shapes, shiny highlights, expressive recognizable meme faces, cinematic polish where appropriate. Game sprites should favor **readability at small sizes** over realistic proportions and excessive detail. For sprite assets, use genuine transparency and consistent sizing/centering.

Once an image is approved, treat it as **locked**. For an exact edit or flip, use deterministic tools, not an image model that redraws it. The user's previous frustrations came from changing unrequested details and presenting generated checkerboards as transparent. Follow instructions literally and acknowledge limitations clearly.

## 10. Coding and testing rules

Codex prompts should:
- Tell Codex to inspect the actual repository and reuse existing patterns.
- Limit changes to one agreed feature.
- Preserve DOGE, PEPE, movement, collisions, score, wave logic, transitions, restart, and gameplay except where explicitly changed.
- Avoid dependencies and `package-lock.json` changes.
- Run appropriate tests/build and summarize changed files/results.
- **Not commit, push, or deploy** unless asked.

Eventually test PONKE direction switches without sprite jumps, PEPE unaffected, banana arc, explosion location, small hitbox, single-hit behavior, clean projectile lifecycle, and all existing game systems.

## 11. GitHub Desktop workflow

When a milestone is accepted, inspect Changes, include relevant source and PNG assets, exclude unrelated files and unintended lockfile changes, enter a concise summary, **Commit to master**, **Push origin**, and confirm clean state. Do not claim a push happened without confirmation.

## 12. Recommended next steps (one at a time)

**A. Confirm assets:** User finishes Photoshop mirror and saves both directional PONKE PNGs in repo. Confirm actual names and alpha transparency.

**B. Plan and implement directional invader sprite switching:** Decide whether to support all invader types now or just PONKE initially. Preserve formation mechanics. Playtest.

**C. Introduce PONKE into formation:** Decide PONKE/PEPE mix or wave appearance before coding. Integrate approved skins. Playtest.

**D. Create banana projectile artwork:** Small, legible, real transparency; optional explosion effect. Approve assets.

**E. Implement banana arc:** Agree on path and firing logic; playtest.

**F. Implement small explosion hitbox:** Agree on exact damage and radius; playtest/balance.

**G. Commit proposed v0.4:** Only after approval.

These are a proposed sequence, **not** authorization to implement all at once.

## 13. Communication preferences

- **Answer the actual question first.** Clear, honest, practical, efficient.
- One change at a time, no surprises or unrelated redesigns.
- When asking for implementation, provide a single easy-to-copy Codex prompt.
- Distinguish clearly between **proposed, approved, implemented, tested, and pushed**.
- Don't overpromise image precision/transparency or repository access.
- Keep a friendly meme/game tone without letting enthusiasm replace accuracy.
- User is understandably frustrated by recent inaccurate image iterations. Restore trust by following the exact request and using deterministic tools for exact transformations.

## 14. Starting point for the new chat

The user is preparing a mirrored PONKE sprite in Photoshop. The approved PONKE design is **locked**. Wait for confirmation that `ponke-left.png` and `ponke-right.png` (or their actual filenames) are saved in the repository. Then proceed with the next **single** agreed implementation step, most likely directional invader sprite support, before tackling banana projectile mechanics.

**Core vision:** Every meme invader has its own skin, weapon, and behavior where applicable. Build a fun game carefully, one playtested improvement at a time.
