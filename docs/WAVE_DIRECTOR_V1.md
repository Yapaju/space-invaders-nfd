# Wave Director V1

## Initial Implementation

V1 establishes the initial Wave Director baseline; there is no previous Wave
Director version or V0 comparison. Its objective is to replace repetitive wave
rotation and escalating movement speed with varied, configurable progression
with explicit rules and threat limits that support future implemented invaders.

This baseline introduces exclusive invader introductions, seeded mixed waves,
a five-wave speed cycle, the original rectangular formation, cycling firing
pressure, a shared hostile-projectile budget, and Wojak after every ten completed
regular waves.
Existing invader weapons, projectile physics and damage, player mechanics,
survivor acceleration, boss mechanics, artwork, and audio are preserved.
The complete implemented V1 rules, values, formulas, and source references follow.

**Finalized baseline:** this document becomes a frozen historical reference when
the WD1 finalization commit is pushed. Future intentional Wave Director changes
must create `docs/WAVE_DIRECTOR_V2.md`, beginning with a detailed
`Changes from Previous Version` comparison against V1. V2 is not created as part
of this finalization.

## A. Overview

Wave Director V1 replaces the repeating single-invader rotation with reproducible
wave plans. Each plan chooses unlocked invaders for the fixed original grid, a starting
movement speed, and an attack interval. The standard count remains 24 enemies.
Five-wave chapters reset the cycle multiplier while their RS baseline grows by
2% compounded per chapter. Firing pressure follows its own five-wave timer cycle
on a decreasing baseline. Wojak interrupts progression after each ten completed
regular waves. This is a balancing foundation, without player-performance adaptation.

The authoritative settings are `WaveDirectorConfig` in
`src/interface/wave-director.ts`. Changing a documented numeric value below means
updating that configuration and its tests, and creating the next version's
complete documentation. After finalization, preserve this V1 document unchanged.

## B. Invader unlock rules

| Invader | Exclusive introduction | Eligible mixed waves |
| --- | ---: | --- |
| Pepe | 1 | 3 onward |
| PONKE | 2 | 3 onward |
| Popcat | 6 | 7 onward |

Waves 3–5 contain both Pepe and PONKE. After Wave 6, mixed waves choose one of
the three pairs or the triple. An introduction always overrides mixed selection:
Wave 6 contains only Popcat. Wave 11 has no registered new invader, so it is mixed.
No placeholder invaders exist in the running game.

Mixed composition selects subsets of `minimumTypes = 2` through
`maximumTypes = 3` from the unlocked registry. Each subset's weight is the
product of its members' selection weights. A type has weight 1.25 for
`wave - introductionWave < 5`, otherwise 1. Thus Popcat-containing subsets have
a modest preference in Waves 7–10. With three types and no recent introduction,
each pair and the triple has equal probability (25% each).

Chosen types receive equal slot counts: 12/12 for a pair, 8/8/8 for the triple.
Slots are shuffled, so individual positions vary without accidentally producing
a nearly all-Popcat mixed wave.

The final composition review accepted this balanced selection unchanged. There
are no per-type percentage quotas, themed-wave presets, row-placement quotas,
or repeat-avoidance rules. Adjacent waves can select the same composition.
In mixed waves, a selected type occupies 12 or 8 slots; Popcat cannot exceed
12 at spawn, although its exclusive Wave 6 contains 24. Slot shuffling can
place same-type invaders next to one another without changing geometry.

## C. Five-wave speed cycle

Original RS is **100 logical world pixels/second**, matching the original Wave 1
baseline. Each five-wave cycle increases that baseline by **2% compounded**.
Every speed calculation starts from original RS and the wave number, never from
the previous wave's speed or a previously updated speed.

```
multipliers = [1.00, 1.10, 1.25, 1.40, 1.50]
speedMultiplier = min(1.50, multipliers[(waveNumber - 1) % 5])
cycleIndex = floor((waveNumber - 1) / 5)
baselineMultiplier = pow(1 + 0.02, cycleIndex)
startingSpeed = 100 * baselineMultiplier * speedMultiplier
chapter = cycleIndex + 1
```

The five cycle multipliers remain unchanged. At Waves 6, 11, 16, 21, etc., the
cycle multiplier returns to 1.00, while its baseline is respectively 1.02,
1.0404, 1.061208, 1.08243216, etc. times original RS. There is no gameplay cap on
baseline growth or final speed. `maxMultiplier = 1.50` applies only to the five
cycle multipliers, not to the baseline or final result. Repeated planning/reset
calls for the same wave yield the same speed without additional compounding.
The fixed rectangular geometry, shared movement, boundary sweeps and 25 px descent
are unchanged. Extreme values beyond JavaScript's finite Number range raise a
RangeError rather than silently clamping speed or passing Infinity to movement.

| Wave | Starting speed (px/s) | Percentage of original RS |
| ---: | ---: | ---: |
| 1 | 100.00000 | 100.00000% |
| 5 | 150.00000 | 150.00000% |
| 6 | 102.00000 | 102.00000% |
| 10 | 153.00000 | 153.00000% |
| 11 | 104.04000 | 104.04000% |
| 15 | 156.06000 | 156.06000% |
| 16 | 106.12080 | 106.12080% |
| 20 | 159.18120 | 159.18120% |
| 50 | 179.26389 | 179.26389% |
| 100 | 218.52168 | 218.52168% |

Configuration: `WaveDirectorConfig.movement.regularSpeed = 100`,
`cycleBaselineGrowth = 0.02`, `multipliers`, and `maxMultiplier`, all in
`src/interface/wave-director.ts`. `getWavePlan()` exposes `baselineMultiplier`
and calculates `movementSpeed`; `AlienManager.reset()` assigns that speed.

The existing elimination acceleration is preserved separately:

```
survivorMultiplier = 1 + 0.5 * clamp((24 - aliveCount) / 23, 0, 1)
actualMovementSpeed = startingSpeed * survivorMultiplier
```

The final survivor can move at 150% of its wave's starting speed. For example,
Wave 5 reaches 225 px/s and Wave 100 reaches approximately 327.78 px/s. This
existing within-wave multiplier does not change the baseline calculation.
Projectiles and Wojak do not inherit any regular-wave speed multiplier;
Wojak's separately configured patrol speed remains 55 px/s.

## D. Boss scheduling

`boss.interval = 10`, `boss.type = 'wojak'`. The only boss implementation is Wojak.
A milestone is `wave > 0 && wave % 10 === 0`.

The last regular invader must be destroyed first. The existing minimum 1,500 ms
transition delay and natural cleanup of all active player shots still apply.
Then Wojak starts while the regular-wave counter and HUD remain at 10, 20, 30,
etc. Boss health, movement, weapons, effects and defeat sequence are unchanged.

When the full defeat sequence finishes, `completedBossWave` records that
milestone. The next regular wave starts exactly once, at 11, 21, 31, etc., after
any trailing player shots finish. Repeated start/update calls cannot respawn the
completed milestone. Existing one-life recovery happens at the next regular
wave, once, rather than at boss entrance. Game over cancels the encounter;
restart clears the completion marker and returns to Wave 1.

The existing disabled development-only boss shortcut remains available and uses
the configured first milestone. It remains disabled in production.

## E. Difficulty progression

### Attack permission frequency

For regular waves only, use the same one global scheduler with this new timer:

```
cycleIndex = floor((waveNumber - 1) / 5)
timerMultipliers = [1.00, 0.90, 0.75, 0.60, 0.50]
positionInCycle = (waveNumber - 1) % 5
baselineTimerMs = 1610 * pow(0.98, cycleIndex)
intervalMs = baselineTimerMs * timerMultipliers[positionInCycle]
nominalPermissionRate = 1000 / intervalMs   // attacks per second
```

Configuration is `WaveDirectorConfig.firing`: `baseTimerMs = 1610`,
`cycleBaselineReduction = 0.02`, and the five `timerMultipliers`, all in
`src/interface/wave-director.ts`. `firingIntervalForWave()` calculates directly
from the wave number; it never multiplies a previously calculated interval.
The old diminishing-returns progression and its 1,200 ms minimum are removed.
There is no minimum interval cap for this experiment.

Each cycle starts with a longer interval than the preceding cycle's final wave,
but a baseline 2% shorter than the preceding cycle's baseline. Movement is still
calculated independently using its unchanged 2% baseline increase. Wojak weapons
continue using their own system.

| Wave | Shared interval ms |
| ---: | ---: |
| 1 | 1610 |
| 2 | 1449 |
| 3 | 1207.5 |
| 4 | 966 |
| 5 | 805 |
| 6 | 1577.8 |
| 7 | 1420.02 |
| 8 | 1183.35 |
| 9 | 946.68 |
| 10 | 788.9 |
| 11 | 1546.244 |
| 15 | 773.122 |
| 20 | 757.65956 |
| 50 | 671.166949 |
| 100 | 548.392263 |

Initial startup, restart, and every actual regular-wave start set the deadline
once to `now + intervalMs`. Initial Wave 1 therefore waits 1,610 ms; the former
immediate first attack is removed. Repeated transition calls do not shorten or
recompound the timer. Wave-clear transitions, boss entrance, game over and scene
shutdown invalidate the regular timer with Infinity. Boss completion schedules
the next regular wave normally, using that wave's formula.

There is at most one emitter selected per update, so sub-frame intervals do not
queue catch-up bursts. Actual frequency is limited by frame timing, clearance
and the threat budget. At extreme wave numbers JavaScript's exponential
underflow can produce zero; there is deliberately no numerical minimum clamp.
Blocked attempts still retry after 250 ms even if the nominal interval later
becomes shorter. These limits do not change the requested uncapped formula.

### Projectile safety

`maxHostileThreats = 15`. Before granting an attack, count:

- Active hostile bullets, including regular popcorns and special kernels/giants.
- In-flight bananas and active, unspent, unexpired damaging banana explosions.

Reserve 1 slot for Pepe, 1 for PONKE, or **5 for Popcat**, then require
`activeThreats + reservedSlots <= 15`. Popcat reserves the maximum attack cost
before its original 80% shotgun / 20% special choice. A single-kernel choice
subsequently occupies only one actual slot. An entire attack is refused if it
cannot fit; shotguns are never truncated and existing projectiles are not removed.

Capacity refusals and Popcat's existing firing-position refusals retry after
250 ms. No mouth animation or pop sound is launched for a refused attack.
Inactive pooled bullets do not consume capacity. A banana becoming an explosion
continues consuming one slot; its slot is released when it is spent or expires.
Boss weapons keep their own existing scheduling and limits, outside this budget.

Weapon damage, velocities, arcs, firing origins, individual attack probabilities,
animations, and cleanup remain owned by the existing weapons. The director does
not change them. There is no enemy-count growth: 6 columns × 4 rows, capped at 24.

## F. Formation generation

Every regular wave uses the original complete **6-column × 4-row rectangle**.
All 24 slots are occupied at spawn, including mixed waves. WD1 controls the type
assigned to each slot, not the formation's geometry. There are no split,
central-gap, staggered, alternate, or randomly omitted slots.

The original AlienManager positioning formula is reused:

```
originX = (bounds.left + bounds.right) / 2 - (6 - 1) * 88 / 2
x = originX + column * 88       // columns 0–5
y = 100 + row * 74             // rows 0–3
```

In the existing 800 × 600 logical playfield, column centers are 180, 268, 356,
444, 532, 620; row centers are 100, 174, 248, 322. The visual frame bounds span
527.36 px horizontally and approximately 295.10 px vertically, centered at X=400.
The final row remains at Y=322, preserving Popcat's fixed transformation reference.
Sprite artwork, frame sizes, hitboxes, and movement/descent logic are unchanged.

The central formation configuration contains `columns = 6`, `rows = 4`,
`startY = 100`, `columnSpacing = 88`, `rowSpacing = 74`, and `maxEnemies = 24`.
There are no layout weights or layout-selection families. Composition choices
may repeat across consecutive waves; geometry always remains identical.
Only defeated invaders leave empty slots during combat. Survivors never repack.
The game still scales its fixed logical playfield through Phaser.

This corrects the initial WD1 formation-gap bug within V1. The first playtest
implementation selected layouts that deliberately inserted 40/88 px central
gaps or shifted alternate rows. Those variations have been removed. Unlocks,
speed cycling, firing pressure, projectile limits and boss scheduling are preserved.

## G. Wave examples

P = Pepe, N = PONKE, C = Popcat. `PN` means both types; `pairs/triple` means any
of PN, PC, NC, PNC, not a guaranteed specific random outcome. Every row has 24
enemies and the same 15-threat cap. Intervals below are rounded to three decimals;
runtime uses the unrounded formulas. Speed is the final starting-speed multiplier
relative to original RS, including compounded baseline growth.

| Wave | Unlocked | Status / eligible composition | Speed | Interval ms | Boss after completion |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | P | Introduction: Pepe only | 1.00000× | 1610.000 | — |
| 2 | P, N | Introduction: PONKE only | 1.10000× | 1449.000 | — |
| 3 | P, N | Mixed: PN | 1.25000× | 1207.500 | — |
| 4 | P, N | Mixed: PN | 1.40000× | 966.000 | — |
| 5 | P, N | Mixed: PN | 1.50000× | 805.000 | — |
| 6 | P, N, C | Introduction: Popcat only | 1.02000× | 1577.800 | — |
| 7 | P, N, C | Mixed: pairs/triple | 1.12200× | 1420.020 | — |
| 8 | P, N, C | Mixed: pairs/triple | 1.27500× | 1183.350 | — |
| 9 | P, N, C | Mixed: pairs/triple | 1.42800× | 946.680 | — |
| 10 | P, N, C | Mixed: pairs/triple | 1.53000× | 788.900 | Wojak → Wave 11 |
| 11 | P, N, C | Mixed: pairs/triple | 1.04040× | 1546.244 | — |
| 12 | P, N, C | Mixed: pairs/triple | 1.14444× | 1391.620 | — |
| 13 | P, N, C | Mixed: pairs/triple | 1.30050× | 1159.683 | — |
| 14 | P, N, C | Mixed: pairs/triple | 1.45656× | 927.746 | — |
| 15 | P, N, C | Mixed: pairs/triple | 1.56060× | 773.122 | — |
| 16 | P, N, C | Mixed: pairs/triple | 1.06121× | 1515.319 | — |
| 17 | P, N, C | Mixed: pairs/triple | 1.16733× | 1363.787 | — |
| 18 | P, N, C | Mixed: pairs/triple | 1.32651× | 1136.489 | — |
| 19 | P, N, C | Mixed: pairs/triple | 1.48569× | 909.191 | — |
| 20 | P, N, C | Mixed: pairs/triple | 1.59181× | 757.660 | Wojak → Wave 21 |
| 21 | P, N, C | Mixed: pairs/triple | 1.08243× | 1485.013 | — |
| 22 | P, N, C | Mixed: pairs/triple | 1.19068× | 1336.511 | — |
| 23 | P, N, C | Mixed: pairs/triple | 1.35304× | 1113.760 | — |
| 24 | P, N, C | Mixed: pairs/triple | 1.51541× | 891.008 | — |
| 25 | P, N, C | Mixed: pairs/triple | 1.62365× | 742.506 | — |

Every example uses the complete original grid described in section F. Wave
30 is about 1.65612× / 727.656 ms, Wave 50 is 1.79264× / 671.167 ms, and
Wave 100 is 2.18522× / 548.392 ms. Each is followed by Wojak. Wave 101 returns
to cycle multiplier 1.00×, on a baseline of about 1.48595× original RS, while
its firing interval resets to the new baseline of approximately 1,074.849 ms.

## H. Balancing guide

**Invaders move too fast:** change `movement.regularSpeed`,
`movement.cycleBaselineGrowth` (currently 0.02), or the five
`movement.multipliers`. `maxMultiplier` limits only cycle positions; baseline
growth is intentionally uncapped. Remember the final
survivor's separate 1.5× acceleration; changing that is a distinct mechanic change
in `AlienManager.update`, not a director progression setting.

**Too many projectiles:** increase `firing.baseTimerMs`, raise the cycle
`timerMultipliers`, reduce `cycleBaselineReduction` toward zero for a slower
chapter ramp, or lower `maxHostileThreats`. Keep the cap at least 5 or Popcat's reserved shotgun
can never fire. Do not reduce Popcat's cost below five. `retryMs` controls when
a blocked emitter is reconsidered, not the normal successful-attack frequency.

**Waves feel repetitive:** tune composition min/max and recent-unlock
weight/duration. Preserve at least two distinct types in mixed waves. Keep the
original complete rectangular geometry on every wave; layout variation is not
part of the corrected V1 behavior.

**A newly introduced invader is too difficult:** its registry entry chooses its
exclusive wave; chapter starts (6, 11, 16, etc.) provide the slowest movement.
PONKE is the explicit Wave 2 exception. Later chapter baselines still grow by 2%.
Raise `firing.baseTimerMs` or
lower the threat cap to reduce attack pressure without changing its weapon.
Reduce `recentUnlockWeight` toward 1 to reduce its presence in subsequent mixed
chapters. V1 has no separate per-invader introduction damage/speed/weapon nerfs.

**A formation overlaps or develops spawn gaps:** verify all 24 original slots,
88/74 px spacing, and the centering formula in section F. Enemy selection must
not alter coordinates or omit slots. Run exact-geometry and movement tests.

**Reproduce a wave:** use the default seed `0x4e464431` (1313227825), or open the
game with `?waveSeed=12345`. Valid query seeds are decimal unsigned 32-bit integers
(including zero); invalid values use the default. Restart keeps the selected
seed. `getWavePlan(wave, seed)` yields identical plans regardless of request order.
The seed controls composition and enemy-type placement within fixed slots, not live Phaser weapon RNG,
player input, or combat outcomes. A live attack still uses existing randomness.

## I. How to add a new invader

1. Implement the real invader's assets, enum type and weapon behavior using the
   existing enemy systems. Do not register a placeholder.
2. Add `{ type: EnemyType.YourInvader, wave: 11 }` (or 16, 21, etc.) to
   `WaveDirectorConfig.introductions`. Use one distinct type per introduction wave.
3. Register its maximum attack projectile cost in `firing.projectileCost` and
   connect its already-implemented weapon in the existing attack dispatcher.
4. Keep any non-bullet threats observable for the shared safety budget.
5. Run the unlock/mix/formation/weapon tests and document the new registry and
   examples in the next version's document, preserving this frozen V1 reference.
   No change to the director's selection algorithm is needed.

Only real types in the registry are eligible. Without a Wave 11 registration,
Wave 11 remains mixed indefinitely. The default mixed subset maximum of three
continues to apply if more implemented invaders are registered later.

## J. Implementation reference

| File | Responsibility |
| --- | --- |
| `src/interface/wave-director.ts` | Central configuration, seeded compositions, original fixed grid, unlocks, speed/pressure formulas and boss milestones |
| `src/interface/wave-config.ts` | Compatibility exports and original formation reference constants |
| `src/interface/manager/alien-manager.ts` | Spawn planned types/slots and assign calculated starting speed; existing movement and survivor acceleration |
| `src/scenes/main.ts` | Attack permission/budget, seed selection and repeated boss/regular-wave transitions |
| `src/interface/banana-bomb.ts` | Read-only active threat count; existing flight/blast mechanics unchanged |
| `src/interface/wojak-boss.ts` | Existing boss; first-milestone compatibility constant references central interval |
| `tests/wave-director.cjs` | 10,000 seeded plans, exact original geometry, unlocks, both compounded cycles, threat limit and registry extension |
| `tests/wave-director-browser.cjs` | Real Phaser Canvas/WebGL formations, seed URL, threat reservations and repeated bosses |
| `tests/endless-waves.cjs` | Existing mechanics plus attack-cap, banana accounting, speed and actual wave 1–31 transition regressions |
| `tests/popcat-audio-browser.cjs` | Audio regression updated to respect the new shotgun budget |
| `tests/popcat-browser.cjs`, `tests/popcat-weapons-browser.cjs` | Popcat art/weapon regressions use WD1 introductions and the approved firing interval |
| `tests/wojak-defeat-browser.cjs` | Boss overlays/cancellation at synthetic viewport sizes, with regular-wave resets in the original logical world |

Other weapon/audio/player test suites remain applicable. Production sources
introduce no debug wave-skip UI, new artwork, new audio or enemy placeholders.

## K. Version history

**V1 — Initial implementation**

- Exclusive Pepe/PONKE/Popcat introductions at 1/2/6; seeded balanced mixed waves.
- Fixed RS 100 px/s and repeating 1.00/1.10/1.25/1.40/1.50 cycle.
- Original complete 6 × 4 grid with fixed 88/74 px spacing and 24 enemies.
- Bounded 2,000→1,200 ms attack curve and shared 12-threat budget.
- Wojak after every ten completed regular waves, with regular numbering preserved.
- No adaptation, count escalation, new enemies, or weapon/art/audio changes.

**V1 bug fix — Restore original formation**

- Removed WD1's split/central-gap/staggered layout definitions and random selection.
- Restored original row/column counts, spacing, centering, dimensions and every
  occupied spawn slot on all regular waves, while retaining seeded enemy mixes.
- Preserved all unlock, speed, firing-pressure, safety-limit and Wojak rules.
- Updated V1 documentation in place for this explicitly requested baseline bug fix;
  no V2 was created and the permanent rules in `AGENTS.md` remain unchanged.

**V1 adjustment — Compounded chapter baseline**

- Before: every chapter used RS 100 px/s; maximum starting speed was 150 px/s.
- After: starting speed is `100 * 1.02^floor((wave-1)/5) * cycleMultiplier`, with
  no baseline/final-speed gameplay cap and the same five cycle multipliers.
- Centralized `movement.cycleBaselineGrowth = 0.02`; repeated calculations/reset
  calls derive speed from original RS and wave number rather than prior speed.
- Preserved fixed grid, unlocks, survivor acceleration, firing system, projectile
  speeds, and Wojak behavior/scheduling. This is still V1, not V2.
- Investigated attack frequency without changing attack mechanics; see section L.

**V1 adjustment — Five-wave firing cycle**

- Before: `2000 - 800*(wave-1)/(wave-1+20)` ms, minimum approaching 1200 ms,
  with a 12-threat budget and an immediate initial Wave 1 firing opportunity.
- After: `1610 * 0.98^floor((wave-1)/5) * [1,.9,.75,.6,.5][(wave-1)%5]` ms,
  no minimum interval, and a 15-threat budget. Initial Wave 1 waits its 1610 ms.
- Preserved one global scheduler, uniform living-emitter selection, threat
  accounting, 1/1/5 reservations, Popcat 80/20 weapons, clearance and 250 ms retry.
- Explicitly reset regular deadlines at startup/new waves/restarts and disable
  them during clear transitions, boss encounters, game over and shutdown.
- Preserved anchored movement formula, fixed grid, boss weapons, player mechanics,
  projectiles, artwork, animations and audio. Still V1; no V2 created.

**V1 finalization — Approved stable baseline**

- Retained balanced pair/triple composition without further gameplay changes.
- Reviewed the final rules, limitations, configuration references and numerical
  examples against the implemented code.
- Recorded the post-push historical freeze and mandatory V1-to-V2 comparison
  for any future intentional Wave Director changes in `AGENTS.md`.
- Final verification passed TypeScript, all 16 existing automated test scripts,
  numerical documentation/configuration checks, and the production Rollup build.
  The build preserved all 88 identical existing asset copies without rewriting.

## L. Attack-frequency investigation and future design (analysis only)

### Current shared scheduler

Regular invaders do not have separate firing timers. In `MainScene.update()`,
when scene time is greater than `firingTimer`, `_enemyFires()` asks
`AlienManager.getRandomAliveEnemy()` for one uniformly random living invader.
Any living row can be selected. It then checks the shared threat budget and
dispatches that enemy's existing weapon. A successful attack sets
`firingTimer = now + firingIntervalForWave(wave)`. This is a scene-wide cooldown,
so other invaders wait too. Timing is checked once per game update and can be
slightly later than the formula due to frames or refused attacks.

The current interval is `I = 1610 * 0.98^floor((wave-1)/5) *
[1, 0.9, 0.75, 0.6, 0.5][(wave-1)%5]` milliseconds. All three types share it.
The five-wave multiplier resets while the baseline decreases by 2% each cycle.
The old diminishing-returns formula is historical and no longer executes.

| Wave | Shared interval ms | Nominal attacks/s | Nominal attacks/min |
| ---: | ---: | ---: | ---: |
| 1 | 1610.000 | 0.6211 | 37.27 |
| 5 | 805.000 | 1.2422 | 74.53 |
| 10 | 788.900 | 1.2676 | 76.06 |
| 20 | 757.660 | 1.3199 | 79.19 |
| 30 | 727.656 | 1.3743 | 82.46 |
| 50 | 671.167 | 1.4899 | 89.40 |
| 100 | 548.392 | 1.8235 | 109.41 |

Nominal rates assume every attempt fits the budget and launch clearance. They
are not guaranteed realized rates. There is no longer an asymptotic rate ceiling
or a minimum interval; the shared budget and frame checks still constrain play.
Startup, new waves and restart schedule `now + I`; transitions, boss entrance,
game over and shutdown disable the regular deadline until a regular wave starts.
These are scene-clock deadlines, not independent browser timers.

### Rules for each regular invader

| Type | First exclusive wave / shared interval | Weapon when selected | Extra firing restriction |
| --- | --- | --- | --- |
| Pepe | 1 / 1610 ms | One projectile aimed at the player's launch-time position, speed 120 px/s | One free threat slot |
| PONKE | 2 / 1449 ms | One banana using its existing arc and landing explosion | One free threat slot; bananas/blasts are included in the budget |
| Popcat | 6 / 1577.8 ms | 80% five-projectile shotgun, 20% one kernel | Five free slots reserved before the branch, plus `canPopcatFire()` clearance |

All three require `GameState.Playing`, an active player and a living emitter.
There is no separate per-invader cooldown, attack-rate probability, bottom-row
requirement, or per-type frequency setting. Popcat's 80/20 probability chooses
its weapon, not whether a permitted attack happens. Its clearance check requires
the launch/apex paths to fit the world bounds, including the top edge. Blocked
launches leave its mouth closed and do not emit sound. Its transformation is a
continuation of the kernel attack, not another scheduler permission.

The emitter's selection chance is `1 / livingInvaderCount`. A type's aggregate
selection chance is `livingOfThatType / livingInvaderCount`. In an unconstrained
mix, its approximate attack rate is that fraction times `1000 / I`. For example,
equal pairs receive about half the permissions each, equal triples one third.
Kills change those fractions. A particular living invader has an approximate
mean interval `I * livingInvaderCount`, not a guaranteed personal deadline.
There are no independent attack clocks to become synchronized across enemies.

Composition affects projectile pressure despite the shared permission frequency:
Pepe and PONKE create one initial threat per attack, while Popcat averages
`0.8 * 5 + 0.2 * 1 = 4.2` initial projectiles per accepted attack before capacity
effects. Different trajectories and lifetimes also affect how quickly the budget
fills. The expected projectile rate is not the same as the attack rate.

### Simultaneous activity and safety

Only one emitter starts an attack per successful scheduler opportunity. Several
enemies' earlier attacks may remain active together, and a shotgun creates five
simultaneous projectiles. There is no separate per-type active-threat cap.

The shared limit is 15 active hostile threats: bullets/popcorn plus in-flight
bananas and unspent, unexpired damaging banana explosions. An attack must fit
its full reserved cost (Pepe 1, PONKE 1, Popcat 5). A kernel/giant occupies only
one actual slot, even though five were required to grant Popcat permission.
Inactive bullets and spent/expired visual blasts do not count. Therefore 15 is
a damage-threat budget, not a strict count of every visible visual effect.
Wojak weapons are separate and do not use this regular-wave budget.

Capacity or Popcat-clearance refusal sets a 250 ms retry. On retry a fresh random
emitter is selected; the rejected enemy is not queued. No active attack is cut
short to free capacity. If no living emitter exists, the function simply returns;
if Pepe's group cannot provide a projectile, it also returns without starting
a normal cooldown. These paths can be reconsidered on the next eligible frame.

### Where to tune or inspect

- `WaveDirectorConfig.firing` and `firingIntervalForWave()` in
  `src/interface/wave-director.ts`: base timer 1610 ms, multipliers 1/0.9/0.75/0.6/0.5,
  baseline reduction 0.02, retry 250 ms, threat limit 15 and maximum attack costs 1/1/5.
- `MainScene.update()`, `_enemyFires()`, `_startNextWave()`, `restart()` and
  `firingTimer` in `src/scenes/main.ts`: permission timing and dispatch.
- `AlienManager.getRandomAliveEnemy()` in
  `src/interface/manager/alien-manager.ts`: uniform living-emitter selection.
- `canPopcatFire()`, `firePopcatAttack()` and `PopcornSettings.shotgunProbability`
  in `src/interface/popcat-weapons.ts`: Popcat clearance and 0.8 weapon choice.
- `BananaBombs.activeThreatCount` in `src/interface/banana-bomb.ts`: threat
  accounting while preserving banana lifecycles.

There are currently **no values to tune each type's frequency independently**.
Changing the global interval affects all types. Attack costs are reservations,
not cooldowns; changing shotgun probability changes its weapon mix. Independent
frequency tuning would require an explicitly approved scheduler/config addition.

### Proposed attack levels — recommendation, not implemented

A wave-wide Attack Difficulty Level fits the existing director: wave planning
could expose a level, and a central per-type table could map levels 1–5 to
intervals. Prefer time-based cooldowns to per-frame probability rolls so rates
are understandable and frame-rate independent. Optional small timing jitter
could be considered later without changing the mean rate.

Use one central scheduler with per-type next-eligible times, rather than giving
every individual alien a freely running timer. This avoids multiplying total
pressure by the number of living invaders. Select a ready type, choose one of
its eligible living emitters, and retain whole-attack reservations plus the
shared threat budget and an aggregate rate limit. Empty types and blocked
emitters need explicit skip/retry/fairness rules; failed attempts should not
consume a full successful-attack cooldown.

The level-based table would replace the current type-agnostic firing cycle as
the main frequency control. Do not blindly multiply the current firing cycle and
new cooldown tables together, which could unintentionally apply two difficulty
ramps. Keep the current cycle as the behavior until the level-to-wave mapping,
per-type intervals, aggregate rate limit, and reset rules are agreed. Five levels
would saturate at level 5 unless another explicit progression rule is chosen.

Balance Popcat by both attack rate and its 4.2 average projectiles/attack;
otherwise equal intervals create unequal pressure. Also consider projectile
lifetimes, banana explosions, low-population selection, mixed-wave fairness,
simultaneous bursts, boundary retries, restart/boss transitions, and caps that
could starve Popcat permanently. No attack-level code is implemented. The investigation originally accompanied
the speed-only adjustment; this section now reflects the subsequently approved
firing-cycle update. Weapon behavior and probabilities remain unchanged.
