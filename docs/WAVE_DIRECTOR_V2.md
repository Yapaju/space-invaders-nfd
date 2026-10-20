# Wave Director V2 — Premium Wojak V1 (Normal Premium Spawning)

## Changes from Previous Version

**Previous version:** V1 → V2. Published V1 remains frozen in
`docs/WAVE_DIRECTOR_V1.md`; this document describes the complete current system.

**Main objective:** introduce defeated bosses as larger regular-wave enemies,
starting with Premium Wojak, while reusing the original boss presentation and
weapons. Normal unlock/wait/probability rules are now active after combat
playtesting; the temporary forced-spawn override is retained for debugging.
This is a feature iteration, not a new movement or regular-firing balance pass.

**What changed / before vs. after:**

| System | V1 | V2 |
| --- | --- | --- |
| Formation occupancy | 24 regular entities in 24 slots | Each Premium occupies one contiguous 2 × 2 footprint as one entity; one Wojak leaves 20 regulars and 21 entities in the same 24 logical slots |
| Premium placement | None | Seeded selection across all 15 valid top-left positions; non-overlapping packing for multiple registered types |
| Regular composition counts | 24, 12/12, or 8/8/8 | With one Premium: 20, 10/10, or 7/7/6; deterministic remainder and shuffle; original type-selection rules preserved |
| Survivor acceleration | `1 + .5 * (24-alive)/23` | `1 + .5 * clamp((N-alive)/max(1,N-1),0,1)` using actual initial entity count N; still 1× initially and 1.5× for the last survivor |
| Premium unlock | None | First completed boss defeat unlocks its type for this run, after three subsequent regular waves; defeat after 10 permits 14 onward |
| Premium probability | None | Independent 10% roll per eligible registered type per regular wave; no cooldown or lifetime cap |
| Temporary override | None | **Disabled by default:** optional debug switch forces Wojak from Wave 1; normal unlock/wait/10% rules run in production |
| Premium damage | None | Five accepted hits: +50 → +25 → 0 → −30 → −70 → REKT; each nonlethal hit grants 800 ms immunity with four red pulses |
| Premium presentation | None | Scaled original ship, poses, percentage, charts and lights, all driven by the same stage |
| Premium attacks | None | Shared autonomous stage-dependent candles/tears with Premium-only rate multipliers, independent of regular scheduler and excluded from regular 15-threat budget |
| Premium defeat | None | 2× regular explosion and existing regular kill sound/removal; no boss cinematic or victory transition |
| Shared boss code | Boss-only presentation | Small presentation/scale/lifecycle hooks allow reuse; original encounter retains 150 hits, continuous percentages, patrol, weapons and full cinematic |

**What stayed unchanged:** normal introductions and balanced subset selection;
6 × 4 geometry and spacing; five-wave movement multipliers and uncapped 2%
compounded baseline; five-wave regular-firing multipliers and 2% timer reduction;
regular 15-threat cap; normal invader/player weapons, damage, art, animation and
audio; full Wojak encounters after every ten regular waves. No new assets.

**WD2 playtest balancing adjustment:** the initial Premium implementation used
three flashes / 600 ms protection and the original boss intervals. Premium now
uses four flashes / 800 ms, with attack rate multiplied by 1.5 at +25, 0 and −30,
and by 2 at −70. Candle intervals changed from 1500/1200/1000/800 ms to
1000/800/(1000 ÷ 1.5)/400 ms. Tear intervals changed from 3500/2500 ms to
(3500 ÷ 1.5)/1250 ms. Full Boss Wojak retains all original timings and damage.

**WD2 normal-spawn activation:** after approved combat playtesting,
`testMode.enabled` changed from `true` to `false`. No combat, placement,
probability, movement or firing values changed in this activation. The existing
run-scoped unlock, three-regular-wave wait and seeded 10% rolls now apply by
default. The debug override remains available and tested.

## 1. Status and authoritative configuration

Premium test mode is **OFF by default** in both production and development.
Normal Premium progression is active. The owner has approved Premium Wojak's
combat behavior. The separate development-only full-boss shortcut remains
disabled.

`WaveDirectorConfig` in `src/interface/wave-director.ts` is authoritative:

```typescript
premiumInvaders: {
    testMode: { enabled: false, forceWojakEveryRegularWave: true },
    waitingRegularWaves: 3,
    types: [{ bossType: 'wojak', spawnProbability: 0.10, columns: 2, rows: 2 }],
    wojak: {
        explosionScale: 2, hitFlashCount: 4,
        attackRates: { plus25: 1.5, zero: 1.5, minus30: 1.5, minus70: 2 }
    }
}
```

`enabled: false` is the master gate: the retained
`forceWojakEveryRegularWave: true` setting is dormant and forces nothing.
For deliberate debugging, set `testMode.enabled = true` to force one Wojak in
every regular wave from Wave 1, bypassing unlock, waiting period and probability.
Return it to `false` to restore normal spawning. Setting the force flag to
`false` also prevents that override. Neither flag disables normal Premium rules.

There is no player-performance adaptation, themed-wave system, wave skip UI,
count escalation, premium health scaling or premium projectile-speed scaling.

## 2. Regular invader introduction and composition

| Type | Exclusive regular introduction | Mixed availability |
| --- | ---: | --- |
| Pepe | 1 | 3 onward |
| PONKE | 2 | 3 onward |
| Popcat | 6 | 7 onward |

An introduction determines the **regular** types. Under normal spawning,
Waves 1, 2 and 6 have 24 Pepes, 24 PONKEs and 24 Popcats respectively: Wojak
is still locked. Only when explicitly debugging with forced mode do those
waves have 20 regulars plus one Wojak.
Waves 3–5 select Pepe/PONKE. After 6, choose a pair or all three unlocked types.
No new regular type is registered at Wave 11, so it remains mixed.

`composition.minimumTypes = 2`, `maximumTypes = 3`. Enumerate eligible subsets
and weight each by the product of its member weights. An invader's weight is
`recentUnlockWeight = 1.25` when `wave - introductionWave < recentUnlockWaves = 5`,
otherwise 1. With no recent unlock, PN, PC, NC and PNC each have probability 25%.
Popcat-containing subsets are modestly favored at Waves 7–10.

First select the subset using the original planner. Then distribute free normal
slots evenly: `floor(freeSlots / selectedTypes)` each, with one extra to the first
`freeSlots % selectedTypes` types in a seeded shuffled type order. Shuffle the
result into free slots. With one Premium this yields 20, 10/10 or 7/7/6. With
no Premium, retain the exact original 24-slot plan: 24, 12/12 or 8/8/8.

There are no row quotas, type percentage presets or repeat-prevention rules.
Neighbors may share a type; consecutive waves may select the same composition.
In a mixed one-Premium wave a Popcat subset contains at most ten Popcats at
spawn. The exclusive introduction can contain twenty. Survivor selection can
change those proportions during combat.

## 3. Geometry, movement and survivor acceleration

The logical world remains 800 × 600. The original fixed grid has six columns,
four rows, column spacing 88, row spacing 74 and starting Y 100. Slot centers:

```
slot = row * 6 + column
x = 180 + 88 * column           // columns 0..5
y = 100 + 74 * row             // rows 0..3
```

Regular frames remain 87.36 × approximately 73.10 world pixels. Full grid
extents are 527.36 × approximately 295.10 pixels. There are no omitted logical
slots, splits, central gaps, staggered rows or alternative layouts.

A Premium footprint reserves `[r*6+c, r*6+c+1, (r+1)*6+c, (r+1)*6+c+1]`,
where `r=0..2`, `c=0..4`. The Premium center is the average of the first and
last slot centers. The footprint envelope is 175.36 × approximately 147.10.
Scale the complete 1536 × 1024 Wojak canvas uniformly by the smaller of envelope
width/1536 and height/1024: approximately 0.11417. Preserve aspect ratio and
transparent margins. The visible art fits inside the reserved region.

The Premium has **one** Arcade body, not one per slot. Reuse the original hull
registration and scale its 270 × 82 boss hitbox by `premiumScale / 0.22`, yielding
approximately 140.11 × 42.55. Character, flames and transparent canvas corners
are not additional hitboxes. Direction reversal mirrors the existing hull
registration and art. The body remains smaller than the reserved footprint.

```
cycle = floor((wave - 1) / 5)
position = (wave - 1) % 5
cycleMultiplier = min(1.5, [1, 1.10, 1.25, 1.40, 1.50][position])
startingSpeed = 100 * pow(1.02, cycle) * cycleMultiplier
survivorMultiplier = 1 + .5 * clamp((N - alive) / max(1, N - 1), 0, 1)
actualSpeed = startingSpeed * survivorMultiplier
```

N is the actual spawned entity count, 21 for one Premium and 24 for none.
Premiums count once while alive. Movement starts at 1×; the last survivor gets
1.5×. All entities move together. Swept edge travel uses full rendered-frame
bounds; reverse at world edges and descend 25 pixels once per edge contact.
Descent counters and ally hooks are preserved. Reaching the defensive line
ends the run through the existing game-over path.

There is no gameplay cap on baseline or final speed. `maxMultiplier = 1.5`
limits the five-cycle factor only. Every calculation derives from original
100 px/s and wave number, never previous speed. Numeric overflow beyond finite
JavaScript Number range raises RangeError. Projectiles retain their own speeds;
Premium formation movement is separate from the full boss's 55 px/s patrol.

## 4. Regular firing and threat budget

```
regularIntervalMs = 1610 * pow(.98, floor((wave - 1) / 5))
                   * [1, .90, .75, .60, .50][(wave - 1) % 5]
```

`firing.baseTimerMs = 1610`, `cycleBaselineReduction = .02`,
`timerMultipliers = [1,.9,.75,.6,.5]`. No minimum interval or progression cap.
Initial startup, restart and each regular-wave start wait a full interval.
Boss encounters, clear transitions, shutdown and game over disable the deadline.
The scene clock checks it once per frame; no catch-up burst is generated.

One global permission selects a uniformly random living **regular** emitter.
Premium roots are excluded. A type's chance is its living regular count divided
by the total living regular count. No normal personal cooldowns or row filter.

`firing.maxHostileThreats = 15`. Count active regular bullets/popcorn plus flying
bananas and unspent damaging banana blasts. Inactive shots and spent visual
blasts do not count. Reserve the full attack before firing: Pepe 1, PONKE 1,
Popcat 5. Popcat still reserves five even when the 20% kernel branch uses one.
Refusal for capacity or Popcat clearance uses `retryMs = 250`; retry picks a
fresh emitter. A refused Popcat keeps its mouth closed and plays no pop.

| Regular emitter | Unchanged attack |
| --- | --- |
| Pepe | One shot aimed once at player's launch-time position, speed 120 px/s |
| PONKE | One existing ballistic banana; landing explosion provides damage |
| Popcat | 80% five-popcorn ballistic shotgun, 20% kernel that transforms on descending crossing of starting lowest-row Y=322 |

Popcat retains existing launch/apex world-clearance restrictions, directional
mouth animation, local pop sound and disabled experimental bucket-light
animation. Regular shotgun popcorn deals 1 life; giant popcorn deals 2 through
the existing protected damage system; kernel behavior is unchanged. A giant
collision is consumed once and life count is clamped at zero.

Premium candle/tear collections are **outside** this budget and may attack
while all 15 regular slots are occupied. They neither consume nor reset a
regular firing opportunity. Consequently 15 is not a total screen-wide cap.

## 5. Full boss scheduling and normal Premium eligibility

`boss.interval = 10`, `boss.type = 'wojak'`. After every completed regular wave
divisible by ten, run the original full Wojak encounter before the next regular
wave. All normal and Premium enemies must first be defeated. Preserve the
minimum 1500 ms wave-clear delay and wait for trailing player bullets to finish.
The HUD stays at 10, 20, etc. during the encounter. Completion records
`completedBossWave`, then starts 11, 21, etc. exactly once. Next-wave life recovery
remains once, capped at three lives. Game over cancels the encounter; restart
resets the completion marker and run-scoped Premium progress.

Only completion of the **full boss defeat sequence** records the first defeat
wave for that type. Premium kills do not unlock bosses. Subsequent boss wins do
not overwrite the first defeat or restart the wait.
Entering the encounter, reaching REKT before the sequence finishes, or losing
the encounter does not unlock anything. Unlocks are separate per boss type and
persist through regular waves and later boss encounters in the same run.

With the test override disabled:

```
eligible(type,wave) = firstDefeat[type] exists
                      && wave > firstDefeat[type] + waitingRegularWaves
spawnSelected(type) = eligible(type,wave) && seededRandom() < .10
```

Defeat Wojak after 10 → wait through 11, 12, 13 → first eligible 14. Each eligible
registered type rolls once per regular wave. Consecutive appearances are allowed;
there is no cooldown, appearance counter, lifetime limit or persistence across
runs. Only Wojak currently has an implemented Premium controller.
The chance stays at exactly 10% after both successes and failures: no pity
counter, ten-wave guarantee, probability ramp or success penalty. Seeded plans
can contain long gaps or consecutive appearances. Replanning the same wave and
seed repeats the same result rather than granting a new roll.

Selected types get seeded randomized priority and shuffled candidate footprints.
Backtracking searches non-overlapping footprints, maximizing fitted entity count;
if not all fit, keep the first best solution in that deterministic ordering.
The forced test Wojak gets first priority. There is no artificial one-Premium
limit: this board physically fits at most six 2 × 2 Premiums. One registered
type rolls once, so current production configuration selects at most one Wojak.
Future types require real controller factories as well as configuration entries.

## 6. Premium Wojak combat and shared presentation

| Accepted hits | Portfolio / percentage | Character / lighting | Behavior |
| ---: | --- | --- | --- |
| 0 | +50% | Existing 50 pose / green | No attacks |
| 1 | +25% | Existing 25 pose / green | Candles |
| 2 | 0% | Existing 0 pose / red | Candles |
| 3 | −30% | Existing −30 pose / red | Candles + single tears |
| 4 | −70% | Existing −70 pose / red | Candles + three-tear spread |
| 5 | REKT (shared internal endpoint −99.9) | Existing REKT pose / lights off | Regular destruction |

`PremiumWojak.stage` is authoritative; each accepted hit maps it to one exact
portfolio value. Shared boss methods select art, percentage, perspective and
lights from that value. Both monitor charts use the original seeded damage
history, including −30/−70 crashes. Premium stage jumps settle all newly
published candles immediately so the monitors never trail an older damage stage.
Full boss chart animation remains unchanged.

Every accepted nonlethal hit immediately updates all presentation elements and
starts four pulses: 100 ms red (`0xff7777`), 100 ms normal, repeated four times.
For the full 800 ms, overlapping player shots are consumed without damage or
queued flashes. The next accepted shot advances only one stage. Presentation
timers advance before collision processing, preserving the full protection
window for a newly accepted hit. Player damage still uses its original immunity.

The fifth hit sets REKT, freezes charts and stops weapons, then uses the existing
regular kill path: 2× Kaboom animation, existing balanced `InvaderKilled` sound,
regular scoring, immediate body disable and deferred destruction after overlap
iteration. REKT is immediately destroyed rather than held on screen. No PUMP IT,
God Candle, full-screen effect, boss victory state or boss progress unlock runs.
Wave completion waits for every actual enemy, including a final Premium.

The full boss keeps its original continuous +50 to −99.9 progression over 150
accepted hits. Premium immunity does not alter full boss hit acceptance or
milestone flashes; its entrance, patrol, charts and full defeat cinematic remain.

## 7. Premium weapons

Use the original `WojakCandles` and `WojakTears` instances through shared
`WojakBoss.updateWeapons`. Premium's controller stays in patrol/combat phase but
does not call the full boss movement or cinematic update. Each owner advances
its own clocks every playing frame, including between regular attack permissions.

| Portfolio | Candle interval | Tear interval / count |
| --- | ---: | --- |
| +50 | None | None |
| +25 | 1000 ms (`1500 / 1.5`) | None |
| 0 | 800 ms (`1200 / 1.5`) | None |
| −30 | 666.666… ms (`1000 / 1.5`) | 2333.333… ms (`3500 / 1.5`) / one |
| −70 | 400 ms (`800 / 2`) | 1250 ms (`2500 / 2`) / three at −15°, 0°, +15° |

Candle size weights (smallest → largest) and single/gap/rain pattern weights:

| Stage | Size weights | Pattern weights |
| --- | --- | --- |
| +25 | 50/35/15/0/0 | 100/0/0 |
| 0 | 30/25/20/15/10 | 65/20/15 |
| −30 | 15/20/25/25/15 | 45/30/25 |
| −70 | 5/10/20/30/35 | 30/35/35 |

Original candle speed 160 px/s, scale .32, rain delay 250 ms, safe gap 120,
edge margin 12, release gap 4, visible-top correction 14 and reaction clearance
500 ms are unchanged. The reduced emitter cannot fit multi-candle safe-gap
patterns, so the existing single-candle fallback applies. Pending effects still
update each frame and use relative emitter positions. Flights retain launch X.

Tears keep speed 120 px/s, one-time aiming, 32-pixel source display length,
visual scale .7 and original collision radius/rotation. Reaction clearance remains
500 ms. Both weapon systems discard suspended-frame attack catch-up beyond
their 250 ms maximum frame delta. Phase changes use their original timer resets.

Premium rates come from `premiumInvaders.wojak.attackRates`, divided into the
existing boss intervals without rounding. The +50 stage remains disabled by the
original stage gates. Shared weapon methods default to rate 1 for the full boss.
Only attack intervals change: real frame delta still advances candle flights,
pending rain and tear collision/lifetime processing every frame. Cooldowns reset
when the weapon's phase changes, discarding stale elapsed time; live projectiles
and pending rain remain intact. A stage change does not immediately generate an
attack. Intervals are evaluated once per frame; cadence is frame-quantized and
missed attacks are not accumulated into catch-up bursts.

Premium protection duration is `hitFlashCount * (100 + 100) = 800` ms, sharing
the existing pulse appearance/rhythm. A Premium spawns vulnerable. Full Boss
Wojak still uses three pulses / 600 ms and its original continuous hit acceptance.

Launch positions derive from the current scaled/mirrored ship underside and
face registration, following formation movement. Projectiles retain original
boss sizes, speeds, collision and effects rather than scaling with ship art.
Damage uses the existing player path. Existing world/player clearance can
legitimately prevent attacks when the formation gets too low.

Owner death clears flights and pending effects immediately. Root destruction
disposes all owned presentation/charts; formation replacement/restart does the
same. Game over and shutdown stop all Premium projectiles. Phaser shutdown
destroys remaining scene-owned art. Original boss cleanup stays separate.

## 8. Seeds, configuration and extension

Default seed is `0x4e464431` (1313227825). `?waveSeed=12345` selects another;
valid query seeds are unsigned decimal 32-bit integers, including zero. Invalid
values use default. Restart retains the seed. Base plans remain reproducible
regardless of request order.

Premium planning uses the original `randomForWave` algorithm in a separate
domain: `randomForWave(seed ^ 0x5052454d, wave)`. This preserves original subset
selection while making Premium selection, placement, overflow and normal
remainder assignment reproducible. Live weapon RNG, input and combat outcomes
are not made deterministic. Adding registered types can change future seeded
Premium outcomes because it changes the number/order of rolls.
The original Fisher–Yates loop is extracted as `seededShuffle` and shared by
base and Premium planning, preserving the base planner's random draw order.

To add a regular invader: implement its art/weapon/type, register an exclusive
introduction (normally 11, 16, 21, etc.), add its whole-attack cost and threat
accounting, and test the existing subset/slot rules. Do not register placeholders.

To add a future Premium: implement its actual controller against the small
`PremiumInvader` contract, register its factory by boss type in
`premium-registry.ts`, and add its footprint/probability to `premiumInvaders.types`.
Record that full boss's first completed defeat via `PremiumProgress`. Reuse
boss presentation/weapons where appropriate; adapt damage/lifecycle separately.
No general enemy framework or placeholder future boss is introduced.

Any later intentional Director change must create the next version document,
with its full previous-version comparison and standalone current rules. Preserve
historical documents. `AGENTS.md` already contains that permanent convention.

## 9. Examples and limits

All following rows have 24 occupied logical slots. With normal spawning active,
Waves 1–10 contain 24 regular invaders. After the completed first boss defeat
following Wave 10, Waves 11–13 also contain 24 regulars. Wave 14 onward rolls
10% per eligible wave: a success gives 20 regulars plus one Wojak, while a miss
keeps 24 regulars. Nothing guarantees a success at any particular wave.
Values are rounded only for display.

| Wave | Regular selection | Starting speed px/s | Regular interval ms | Full boss after |
| ---: | --- | ---: | ---: | --- |
| 1 | Pepe | 100.000 | 1610.000 | — |
| 2 | PONKE | 110.000 | 1449.000 | — |
| 3 | Pepe/PONKE | 125.000 | 1207.500 | — |
| 5 | Pepe/PONKE | 150.000 | 805.000 | — |
| 6 | Popcat | 102.000 | 1577.800 | — |
| 10 | Pair/triple | 153.000 | 788.900 | Wojak |
| 11 | Pair/triple | 104.040 | 1546.244 | — |
| 14 | Pair/triple | 145.656 | 927.746 | — |
| 20 | Pair/triple | 159.181 | 757.660 | Wojak |
| 50 | Pair/triple | 179.264 | 671.167 | Wojak |
| 100 | Pair/triple | 218.522 | 548.392 | Wojak |

Current limitations and playtest considerations:

- Forced mode is disabled by default. Manually enabling it bypasses progression
  in production as well as development; keep it off for normal play.
- Autonomous Premium weapons deliberately increase total pressure beyond the
  regular 15-threat cap. Multiple future types could multiply that pressure;
  current probabilities do not guarantee a particular difficulty ceiling.
- Only Wojak is implemented. Multi-type packing is tested with synthetic planner
  registrations, not nonexistent future enemy artwork or combat controllers.
- The body covers the scaled hull, not all four logical cells. Monitor text and
  chart detail are smaller; no new raster art or alternative collision shape.
- Shared ship dimensions and the planner's 87.36 × 73.10 regular-frame reference
  must be revisited if future artwork or grid geometry changes.
- The 24-bit packing mask assumes this fixed 24-slot board. Backtracking is
  intentionally small-board logic, not a general large-level packing framework.
- No repeat prevention, adaptive balancing or seeded live combat. High waves
  retain uncapped speed growth and decreasing regular timer intervals.

## 10. Implementation and verification references

| File | Responsibility |
| --- | --- |
| `src/interface/wave-director.ts` | Central rules, original seeded plans/formulas, Premium test override and registry configuration |
| `src/interface/wave-config.ts` | Original-grid compatibility exports |
| `src/interface/premium-spawn.ts` | Run unlocks, waiting period, rolls, footprint packing, balanced remaining slots |
| `src/interface/premium-invader.ts` | Small common controller contract and single Alien root/lifecycle adapter |
| `src/interface/premium-registry.ts` | Implemented controller factory lookup |
| `src/interface/premium-wojak.ts` | Scaled presentation, discrete stages, immunity, autonomous shared weapons, no cinematic |
| `src/interface/wojak-boss.ts` | Shared presentation/registration/flash/weapon hooks; original full encounter |
| `src/interface/wojak-charts.ts` | Shared history and monitor rendering; immediate Premium stage settling |
| `src/interface/wojak-candles.ts`, `src/interface/wojak-tears.ts` | Shared projectile systems; Premium-only optional attack-rate multiplier, original boss defaults and constants unchanged |
| `src/interface/manager/alien-manager.ts` | Actual entity spawning, movement, survivor normalization, Premium update/cleanup and normal emitter exclusion |
| `src/scenes/main.ts` | Run progress, damage dispatch, wave/boss transitions and existing regular threat scheduler |
| `tests/premium-spawn.cjs` | Default-off and 10,000 locked/forced seeded plans, exact no-Premium placement, all 15 positions with normal rolls, occupancy/balance, unlock/wait/reset, independent 10% sampling, consecutive rolls and multi-type packing |
| `tests/premium-wojak-browser.cjs` | Real Phaser Canvas/WebGL Premium presentation, collision/damage, immunity, movement, autonomous weapons, cleanup, transitions and full boss regression |
| `tests/wave-director.cjs`, `tests/wave-director-browser.cjs` | Original planner/formula/budget/formation/boss regressions |
| `tests/endless-waves.cjs` | Existing player, weapon, movement and run lifecycle regressions |
| `tests/wojak-charts-browser.cjs`, `tests/wojak-defeat-browser.cjs` | Original boss visual/cinematic fixtures explicitly disable forced Premium spawning |
| `tests/popcat-browser.cjs`, `tests/popcat-weapons-browser.cjs`, `tests/popcat-audio-browser.cjs` | Original regular-wave Popcat fixtures explicitly disable forced Premium spawning |
| `tests/responsive-layout-browser.cjs`, `tests/render-buffer-browser.cjs` | Original layout/rendering fixtures explicitly disable forced Premium spawning |

Existing boss, Popcat, audio, explosion and rendering suites remain applicable.
Original normal-wave regression fixtures explicitly turn off forced spawning;
the dedicated Premium suite first verifies actual default-off progression, then
explicitly enables debug spawning for the approved combat regression fixtures. Pure
probability tests mutate configuration only inside their test process. No source
asset is generated, removed or changed by this feature.

Initial verification: all 18 automated scripts passed (the 16 existing suites
plus both Premium suites), as did TypeScript `--noEmit`, diff whitespace checks
and the production Rollup build. All 88 identical existing asset copies were
preserved. Normal spawn sampling produced 1,013 appearances in 10,000 eligible
seeded waves. Browser checks used real Phaser Canvas and WebGL in Chrome,
including active-projectile shutdown and actual Arcade overlap registration;
screenshots were inspected at +50 and left-facing −70. A separate Chrome smoke
test loaded the minified production bundle and 83 routed local production
resources without missing assets or browser exceptions. The environment blocked
direct access to the existing localhost preview, so that smoke test fulfilled
requests directly from `dist`; owner playtesting remains necessary for feel,
small-scale legibility and combined projectile pressure.

WD2 balancing verification: nine relevant automated scripts passed (Premium
spawn/browser, candle/tear weapons, Wave Director unit/browser, boss defeat
browser, charts unit/browser and endless-wave regressions), plus TypeScript
`--noEmit`, diff checks and the production build. Premium browser tests cover
four pulses across 800 ms, consumed immune shots, exact interval boundaries
including unrounded divisions, stale-timer stage transitions, unarmed +50,
unchanged regular scheduling and the original full boss. Weapon tests confirm
the 2× rate leaves flight speed and delayed rain timing unchanged. The build
again preserved all 88 identical existing asset copies.

Normal-spawn activation verification: seven relevant scripts passed (Premium
spawn/browser, Wave Director unit/browser, original boss defeat browser,
candle/tear weapons and endless-wave regressions), plus TypeScript `--noEmit`,
diff checks and the production build. Default-off browser checks cover actual
boss entrance/loss/interrupted defeat, completed unlock, regular-wave transitions
11–14, normal seeded hit/miss formation counts, later-wave/boss persistence and
new-run reset. Explicit debug spawning still passes all approved combat tests in
Canvas and WebGL. Pure checks cover independent 10% outcomes, actual consecutive
appearances, gaps exceeding ten waves, all 15 positions under normal rolls,
per-type waits/probabilities and deterministic non-overlapping overflow packing.
The activation changes only the runtime master override flag, not combat or
normal spawn algorithms. All 88 existing build asset copies were preserved.
