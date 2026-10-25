# Wave Director V12 — Temporary Mubarak Test Encounter and Yellow Barrel

## Changes from Previous Version

**Previous version:** V11 → V12. V1–V11 remain unchanged historical references.

**Main objective:** make the full Mubarak encounter available immediately after
Wave 1 for local playtesting, and identify explosive barrels with the supplied
yellow biohazard artwork while preserving their gameplay.

**What changed / before vs. after:**

| Rule | V11 | V12 |
| --- | --- | --- |
| Early test override | testSpawn.enabled=false, afterWave=1 | enabled=true, afterWave=1; temporary in both build modes |
| Wave 1 completion | Wave 2 | Full Mubarak encounter, then Wave 2 after victory |
| Explosive barrel visual | Black PNG with red 0xff0000 tint | mubarak-barel-yellow.png, original colors, black biohazard symbol |
| Barrel preloading | Black PNG | Black and yellow PNGs |
| Restoration | Checkpoint-only schedule | Set testSpawn.enabled=false and rebuild |

**What stayed unchanged:** the production bossForWave schedule (Wojak after
10/30/50..., Mubarak after 20/40/60...), all boss acts, transitions, health,
attacks, immunity and victory handling; normal black barrel artwork and laser
pass-through; barrel scale, hitboxes, drop speed, rates, RNG calls, cap and
explosion animation/damage; all regular-wave rules, seeds, formations, Premium
progression, score and lives. No Act III is introduced. This document includes
the complete current configuration and mechanics below.

## 1. Status and authoritative configuration

The experimental equal-four-way (25% each) formation selection is active by default. There is no
player-facing switch or forced alternation. Premium test mode is **OFF by
default** in both production and development.
Normal Premium progression is active. The owner has approved Premium Wojak's
combat behavior. The temporary full-boss playtest override is enabled: Wave 1 → Mubarak → Wave 2.
It applies in both local build modes until explicitly disabled. F6 remains development-only.

`WaveDirectorConfig` in `src/interface/wave-director.ts` is authoritative:

```typescript
formation: {
    columns: 6, rows: 4, startY: 100, columnSpacing: 88, rowSpacing: 74,
    choices: ['grid', 'diamond', 'TWIN_SQUADS', 'SNAKE'],
    diamond: { rowCounts: [2, 4, 6, 6, 4, 2] },
    twinSquads: { columns: 4, rows: 3, descentIntervalMs: 4000, descentPixels: 25 },
    snake: { staggerColumns: 0.5 },
    maxEnemies: 24
},
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
every compatible regular wave from Wave 1, bypassing unlock, waiting period and
probability. Snake is always excluded, including under this override.
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

The logical world remains 800 × 600. Every regular-wave plan selects exactly
one layout, using a separate seeded roll. This does not run in the full boss
encounter, which retains its original independent patrol and presentation.

```typescript
const choices = ['grid', 'diamond', 'TWIN_SQUADS', 'SNAKE'];
formation = choices[Math.floor(randomForWave(seed ^ 0x464f524d, wave)() * 4)];
```

CLASSIC is internally named `grid`. It keeps the original four rows, six
columns, row-major ordering, starting Y=100, horizontal spacing=88 and vertical
spacing=74. Its exact centers remain:

```
slot = row * 6 + column
x = 180 + 88 * column           // columns 0..5
y = 100 + 74 * row             // rows 0..3
```

DIAMOND is internally named `diamond` and uses compact row-major indices 0..23
for occupied cells only. Each row is centered on the playable horizontal center
`centerX = (bounds.left + bounds.right) / 2`:

```
rowCounts = [2, 4, 6, 6, 4, 2]
x = centerX - (rowCounts[row] - 1) * 88 / 2 + column * 88
y = 100 + row * 74
```

| Row (zero-based) | Count | X centers in 800-wide world | Y | Compact slot indices |
| ---: | ---: | --- | ---: | --- |
| 0 | 2 | 356, 444 | 100 | 0–1 |
| 1 | 4 | 268, 356, 444, 532 | 174 | 2–5 |
| 2 | 6 | 180, 268, 356, 444, 532, 620 | 248 | 6–11 |
| 3 | 6 | 180, 268, 356, 444, 532, 620 | 322 | 12–17 |
| 4 | 4 | 268, 356, 444, 532 | 396 | 18–21 |
| 5 | 2 | 356, 444 | 470 | 22–23 |

Regular frames remain 87.36 × approximately 73.10 world pixels, leaving positive
clearance at both 88-pixel horizontal and 74-pixel vertical spacing. Each layout
has 24 logical cells and symmetric spawn geometry.
CLASSIC's full-frame envelope is 527.36 × approximately 295.10; DIAMOND's is
527.36 × approximately 443.10, with spawn bounds X≈136.32..663.68 and
Y≈63.45..506.55. Both fit the existing world and spawn above the player's actual
defensive line. The existing fit check rejects horizontal worlds narrower than
`max(rowCounts) * 88 = 528`. Classic/Diamond have no new vertical offset, scale or movement pattern. Enemy types use the identical original 24-entry seeded composition,
assigned in occupied row-major order; no special diamond distribution applies.

### Twin Squads geometry and membership

The internal formation name is exactly `TWIN_SQUADS`. Use physics-world playable
bounds, not viewport or visual screen coordinates. With bounds [L,R], define
`M=(L+R)/2`. Spawn centers remain `(L+M)/2` and `(M+R)/2`, but both
movement areas are now [L,R]. The logical 800-wide world therefore uses M=400
only to center the starting squads, not as a collision boundary.

```
for side = 0,1:
    centerX = center of that side's playable half
    x = centerX - 3*88/2 + column*88       // columns 0..3
   y = 100 + row*74                      // rows 0..2
```

| Squad | X centers | Y centers | Compact slot indices | Spawn frame bounds X |
| --- | --- | --- | --- | --- |
| left | 68,156,244,332 | 100,174,248 | 0–11 (row-major) | 24.32..375.68 |
| right | 468,556,644,732 | 100,174,248 | 12–23 (row-major) | 424.32..775.68 |

Each group is 351.36 × approximately 221.10; initial center gap between frame
edges is 48.64. Frames are unchanged 87.36 × approximately 73.10, with the same
88/74 spacing. Both starting halves fit without reducing spacing. Squads may
cross M and exchange horizontal sides when their individual hitboxes are vertically
separated; squad IDs and membership never swap. Spawn fit validation
requires at least `4*88=352` pixels per half, a full width of at least 704;
the exact frame extent is slightly smaller, ensuring nonzero movement clearance.

`WavePlan.squads` exists only for Twins as original spawn/Premium-placement
metadata (ID, 12 original slots, full-world bounds, initial direction); it is not
a movement controller. `WavePlan.rowGroups` records six groups ordered left rows
1–3 then right rows 1–3, each with ID, original `squad`, zero-based `row`, four
slot indices, full-world bounds and its side’s initial direction. Normal enemies retain the
original 24-entry shuffled composition in squad-major/row-major order; there
are no separate per-squad composition rolls or quotas. A squad may consequently
have a different enemy mix from its sibling. Controllers retain root references
for each row; casualties do not repack or reassign remaining slots.

### Snake geometry, row membership and movement

The internal name is exactly `SNAKE`. Keep four rows of six, horizontal spacing
88, vertical spacing 74 and original 87.36 × approximately 73.10 frames.
The stagger is `88 * snake.staggerColumns = 44`; center the complete envelope
by offsetting row centers alternately −22/+22 around the playable midpoint M.

```
x = M - 220 + (row % 2 ? 22 : -22) + column*88
 y = 100 + row*74                  // rows 0..3, columns 0..5
```

| Rows (human-numbered) | X centers in the 800-wide world | Y centers |
| --- | --- | --- |
| 1 and 3 | 158,246,334,422,510,598 | 100 and 248 |
| 2 and 4 | 202,290,378,466,554,642 | 174 and 322 |

The overall frame envelope is 571.36 × approximately 295.10, centered at X=400,
with horizontal bounds 114.32..685.68. Positive vertical clearance between rows
prevents inter-row overlap even while they pass horizontally. The fit check
requires `6*88+44=572` pixels of playable width. No sprite scaling occurs.

`WavePlan.rowGroups` contains four full-world movement groups named row-1
through row-4, each with six original slot indices. Reuse the existing direction
stream: sign +1 gives Configuration A (+1,−1,+1,−1); sign −1 gives B
(−1,+1,−1,+1). Each row subsequently reflects at its own occupied world edge,
without reversing siblings, horizontal snapping or repacking. The existing
swept travel loop handles multiple reflections in long frames.

Rows share an event-based movement controller with Twins, but have no inter-row
collision or local descent branch. Each row retains its original six-root N and
uses the existing multiplier `1 + .5 * clamp((N-alive)/max(1,N-1),0,1)`.
It starts at 1× and reaches 1.5× for its last survivor. Sibling casualties do not
change its speed. Wave speed remains the existing five-wave/chapter formula.
Zero/negative delta adds no travel. Firing and completion still use one shared
enemy group, not four timers or separate completion conditions.

#### Synchronized descent: uppermost surviving original row

The active trigger is the first original `rowGroups` entry with an active root:
Row 1, then Row 2, Row 3, Row 4. Selection never sorts by current Y and consumes
no RNG. When the trigger reaches either world edge, reverse that row normally,
then move ALL living rows down exactly 25 via the existing sprite/body
reset/preUpdate path. Other rows reverse only on their own wall events. Their
horizontal offsets and directions are never reset by a shared descent.

Consume the same time slice for every living row up to the earliest wall event;
reverse all rows contacting walls at that instant once each. Only a trigger
contact advances shared descent count and `onDescent`. Non-trigger contacts
never descend. Check invasion immediately after shared descent and stop the
whole formation before the ally hook on a fatal step. Multiple contacts in long
frames are handled chronologically. Row-local descent counters remain zero.

Trigger transfer after casualties preserves the next row’s existing position,
direction and bounce count. Original row identity survives destruction without
repacking. New waves/restart rebuild groups and reset counters; stop/game over
advances no movement, and actual scene pause skips updates. No invisible Classic
reference, canonical-column mapping or reference-specific state remains.

With all six roots alive in the trigger row, its frame span is 527.36 in the
800-wide world and later traversal distance is 272.64, the same as intact Classic.
Opening A starts Row 1 moving right, with 158.32 pixels to its wall; opening B
moves left, with 114.32 pixels to its wall. At Wave 1 (100 px/s), first descents
are therefore 1.5832s / 1.1432s respectively; later intervals are 2.7264s. The
Wave 5/10/20 intact intervals remain 1.8176 / 1.781961 / 1.712765 seconds.
These are gameplay-time intervals excluding pauses, transitions and bosses.
After casualties, trigger-row width and its own survivor acceleration determine
timing. It is intentionally no longer matched to a hypothetical global Classic.

Premium compatibility is explicit: before rolling/packing Premiums, Snake
returns the unchanged 24 regular type assignments and an empty Premium list.
This is the owner's approved policy, not an accidental empty-candidate outcome.
It preserves run unlock progress and the configured 10% chance on compatible
formations, consumes no live RNG, and does not replace or re-roll the selected
Snake layout. Staggered neighboring row centers differ by 44 pixels, so there
are no aligned 2×2 positions; even an aligned pair would have incompatible
independent directions. No cross-row Premium controller is introduced.

Premium footprints are found in a map of the actual occupied cells, reconstructed
from slot positions and the same 88/74 spacing. The planner enumerates top-left
anchors in row/column order and accepts only rectangles with every cell present.
For Twins it builds a separate lattice per squad, enumerating left then right;
no position lookup can bridge the gap or use the other squad's cells.
CLASSIC retains precisely its old candidate list and seeded placement. DIAMOND
cannot reserve missing corners or stretch a footprint across nonadjacent slots.
The existing non-overlapping packing/search and regular remainder rules apply.

For the current 2 × 2 Wojak, anchors are:

| Layout | Valid top-left row and columns | Total |
| --- | --- | ---: |
| CLASSIC | Rows 0,1,2: columns 0,1,2,3,4 | 15 |
| DIAMOND | Row 0: column 2; row 1: columns 1,2,3; whole footprint in geometric rows 0..2 | 4 |
| TWIN_SQUADS | Each squad: rows 0,1 and columns 0,1,2 | 12 |

Diamond/Classic columns refer to their six-column bounding lattice, not compact
slot indices. Twin columns are local to their four-column squad. Diamond's
human-numbered valid upper-half footprints have these exact compact indices:

| Top-left (row,column, zero-based) | Compact slots | Center (X,Y) |
| --- | --- | --- |
| (0,2) | 0,1,3,4 | (400,137) |
| (1,1) | 2,3,7,8 | (312,211) |
| (1,2) | 3,4,8,9 | (400,211) |
| (1,3) | 4,5,9,10 | (488,211) |

Every reserved Diamond slot has Y<=248; rows 4–6 in human numbering are never
used. Coordinates, rather than equal row-array column indices, establish
adjacency. The filter is `row + footprint.rows <= 3`. These four valid choices
exist, so no forced invalid fallback is needed.

Each Twin Premium footprint records `squad: 'left' | 'right'`. Its root is
added only to the row matching its original squad and footprint top row, using
that row’s horizontal direction, full-world bounds and acceleration, plus shared timed descent. The owner
row has two regulars + one Premium (N=3); the lower covered row has two regulars
(N=2); other rows have N=4. All four logical cells remain reserved by the original
2×2 footprint, but the complete Premium root follows only its owner; lower-row
holes are not repacked. There are 20 regulars + one Premium (21 roots) total. Both visible canvas
and registered Arcade hull participate in its movement limits; attack code is
unchanged. There is still only one chance roll for Wojak, not one roll per
squad. The existing seeded placement shuffle can select either side.

 Four adjacent reserved cells form the unchanged 175.36 × approximately
147.10 footprint. The Premium center is the average of its first and last cell
centers. Scale the complete 1536 × 1024 Wojak canvas uniformly by the smaller of
width/1536 and height/1024, approximately 0.11417. Transparent margins and aspect
ratio are preserved. Regular entities remain in the other 20 cells: 24 logical
slots and 21 actual entities, with no artwork overlaps or expansion into missing
corners. The occupied-cell silhouette is preserved; art within four reserved
cells is represented by the same single scaled Premium as before.

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

For Classic/Diamond, N is the actual spawned entity count, 21 for one Premium
and 24 for none.
Premiums count once while alive. Movement starts at 1×; the last survivor gets
1.5×. All Classic/Diamond entities move together. Swept edge travel uses full rendered-frame
bounds; reverse at world edges and descend 25 pixels once per edge contact.
Descent counters and ally hooks are preserved. Reaching the defensive line
ends the run through the existing game-over path.

Initial direction is part of the wave plan as `initialDirection: -1 | 1`:

```typescript
const roll = randomForWave(seed ^ 0x444952, wave)();
const initialDirection = roll < 0.5 ? -1 : 1;
```

The manager applies it before configuring any regular or Premium entity in
`_sortAliens`, covering both constructor startup and every `reset(wave)`.
All Classic/Diamond entities start facing and traveling in that direction. The
existing update loop reverses that shared direction at either boundary and
descends once per contact; it never re-rolls on movement frames or bounces.
The chosen direction does not mirror or reposition the selected initial layout.
Full boss patrol direction is separate and unchanged. Restart resets descent and movement
state and reuses Wave 1's seeded result, regardless of the previous direction.

### Twin Squads movement, descent and acceleration

There are SIX independent horizontal movement groups. Squad metadata is used
only for original identity and Premium placement. Inward starts every left row
rightward and every right row leftward; outward reverses those signs, each 50%.
Rows of a square initially look coordinated, then naturally diverge with kills,
walls, contacts and descent. No extra RNG draw or forced synchronization occurs.

Each row freezes N at its original actual root count: 4 normally, 3 for the
Premium owner, 2 for its lower covered row. Speed uses the unchanged formula
`movementSpeed * (1 + .5 * clamp((N-alive)/max(1,N-1),0,1))`.
A Premium counts once. Speed starts at 1× and reaches 1.5× for the last root.
Other row/squad elimination never changes this denominator or speed. Wave speed
progression remains unchanged.

#### Pair-local swept movement

Each row retains original identity, membership, direction, fixed N and horizontal
bounce count. Twin rows have no descent count, pending queue or independent Y
offset. The shared vertical position below governs every regular and Premium.

`_updateMovingGroups` advances every living row by the time to the earliest
wall or row contact event within each timer slice. Exterior bounds use all active frame
and body extents of that row and the full world [L,R]. There is no center wall,
empty-cell boundary or original 4×3 collision rectangle.

For EVERY unordered pair of different row controllers, compare live root pairs,
including rows in the same original squad or with different original row indices.
`_twinBounds` protects the union of each root’s full sprite and actual Arcade
body (including Premium hulls). Damage-body dimensions remain unchanged. Ignore
pairs whose actual clearance rectangles do not overlap vertically; such rows
can pass horizontally and exchange relative sides without swapping IDs.

For A left of B with closing relative speed vA−vB>0, contact time is
`(B.left-A.right)/(vA-vB)`; use the opposite ordering for a negative relative
speed. This also detects faster same-direction catch-up. Separating or equal-speed
pairs do not retrigger. Advance all rows to the earliest event, then reverse and
increment ONLY participating rows. A wall affects its owner; a row-pair contact
affects its two participants. Simultaneous contacts coalesce per involved row
once, using 1e-7 pixels divided by maximum speed as time tolerance. No persistent
squad collision state is used. Remaining delta is consumed chronologically,
preventing high-speed or long-frame horizontal tunneling.

#### One authoritative timed vertical position

`WaveDirectorConfig.formation.twinSquads` sets `descentIntervalMs=4000` and
`descentPixels=25`. Horizontal bounce counts are diagnostics only: walls and
collisions NEVER trigger descent.

At each spawn, record original Y of EVERY root in `twinSpawnY`, including Premium
midpoint Y, and initialize `twinDescentElapsedMs=0` and `twinVerticalOffset=0`.
`_updateTwin` consumes `max(0, gameplayDeltaMs)` in slices ending at the next
four-second deadline. Advance horizontal rows for that slice; at the deadline,
add 25 to the shared offset, reset the elapsed remainder for the next interval,
and increment the shared completed descent count once.

ALL active roots in the single Arcade group synchronize at the deadline:

`spriteY = twinSpawnY.get(root) + twinVerticalOffset`

`_move` uses this authoritative Y for Twin horizontal movement as well as timed
descent, instead of accumulating root/row Y deltas. Every survivor is visited
once per timed event. Body reset followed by `preUpdate(false,0)` synchronizes
collision bounds; existing Premium synchronization updates its presentation.
Timed descent never changes horizontal X, directions or bounce counts.

| Active gameplay time | Shared offset |
| --- | --- |
| Before 4s | 0 |
| 4s | 25 |
| 8s | 50 |
| 12s | 75 |
| 4k seconds | 25k pixels |

All six rows preserve original relative Y spacing after casualties, including
Premium's midpoint relative to its reserved cells. Uniform translation cannot
introduce inter-row overlap. No independent vertical offsets, blocked-step queue,
clearance-release events or every-second-bounce rule remain for Twins.

Long frames consume EVERY interval in order, retaining leftover time: 12500ms
gives three steps and a 500ms remainder. After each step, check invasion after all
sprites/bodies synchronize. Fatal invasion stops at that deadline before later
frame movement or ally hooks. Safe events invoke `onDescent` once per completed
shared step. A 1e-7ms floating-point tolerance makes 30/60/144 FPS updates agree
at nominal four-second boundaries. Effective vertical speed is always
25/4 = 6.25 logical pixels per active gameplay second.

Only regular active gameplay advances the timer. Actual scene pause, transitions,
boss encounters and game over consume no time. Stop/empty checks return before
advancing; zero/negative delta adds no time. New waves/restart clear remainder,
offset, spawn-Y mapping and completed count. No wall-clock timer, extra random
draw or new difficulty modifier is introduced. Completion, firing, scoring and
Premium eligibility remain unchanged.

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
| Popcat | 80% five-popcorn ballistic shotgun, 20% kernel that transforms on descending crossing of the unchanged CLASSIC reference Y=322 |

Popcat retains existing launch/apex world-clearance restrictions, directional
mouth animation, local pop sound and disabled experimental bucket-light
animation. Regular shotgun popcorn deals 1 life; giant popcorn deals 2 through
the existing protected damage system; kernel behavior is unchanged. A giant
collision is consumed once and life count is clamped at zero.

The reference remains Y=322 for all four layouts; it is not moved to DIAMOND's
bottom row. Existing kernel lift already handles emitters below that line:
`max(220, sqrt(2 * 620 * max(0, mouthY - 322 + 12)))` px/s upward. The same
launch/apex world-clearance check still gates an attack. This uses the original
low-emitter behavior, without a new firing rule or projectile balance value.

Premium candle/tear collections are **outside** this budget and may attack
while all 15 regular slots are occupied. They neither consume nor reset a
regular firing opportunity. Consequently 15 is not a total screen-wide cap.

## 5. Full boss scheduling and normal Premium eligibility

`boss.interval=10`. `bossForWave(wave)` returns undefined for non-milestones.
For a positive multiple of 10, checkpoint number is `wave / interval`:

```
checkpoint % 2 === 1 → 'wojak'
checkpoint % 2 === 0 → 'mubarak'
```

Examples: 10/30/50/70 → Wojak; 20/40/60/80 → Mubarak. There is no finite
checkpoint list, new RNG draw, boss-health scaling or reset of regular difficulty.
`WavePlan.bossAfter` remains the boolean `isBossMilestone(wave)`; existing
`boss.type='wojak'` retains the original Wojak Premium unlock identity.

All regular/Premium enemies must be cleared through the existing wave-clear
path. Preserve the 1500 ms minimum clear delay and trailing-player-bullet gate.
`MainScene._startNextWave()` checks pending encounters before incrementing wave.
The HUD remains at the completed checkpoint during combat. Either actual boss
completion sets `completedBossWave=wave`, enters WaveTransition, announces
`wave+1` and waits for active player shots. Subsequent pending checks for that
same checkpoint return false. The next regular wave increments once, resets its
formation/firing deadline and recovers one life capped at three. There is no
additional boss score, kill count or extra life reward. Gold-fragment scoring
remains independent. Repeated starts during combat cannot create another boss.

Retained production checkpoint route: Wave 10 → Wojak → 11; Wave 20 → Mubarak → 21; Wave 30 → Wojak → 31;
Wave 40 → Mubarak → 41; Wave 50 → Wojak → 51; Wave 60 → Mubarak → 61. Ordinary
waves insert no full boss except the temporary Wave 1 override described below. A run-reset clears completion
markers and Premium progress; a loss never marks a checkpoint completed.

`MubarakSettings.testSpawn={enabled:true,afterWave:1}` enables the temporary
combat-test override in both build modes. Wave 1 plays normally, then its existing
1500 ms transition and trailing-player-bullet gates lead into the complete Mubarak
encounter. The wave counter stays at 1 throughout both acts. Victory sets
`completedBossWave=1` and `completedMubarak=true`; the next transition advances
once to Wave 2. Set only `testSpawn.enabled=false` in `src/interface/mubarak.ts`
and rebuild to restore checkpoint-only scheduling. `bossForWave()` is unchanged.
Only the early test uses the one-off `completedMubarak` boolean; scheduled
Mubarak checkpoints use the shared wave marker, so winning at 20 cannot block 40.
F6 remains a development-only reset/preview through `_startMubarak(true)`, without
mutating the configured override.

### Existing full Wojak V1 encounter

The unchanged boss starts at portfolio +50, enters for 1500 ms, then patrols
X=205..595 at 55 px/s around Y=255 with amplitude 7 and frequency 0.5 Hz.
Display scale is 0.22; the source hull body is 270×82 before transform. Player
lasers subtract one portfolio point per accepted hit, clamped to -99.9: 150 hits
from +50 reach the original REKT endpoint. Art/weapon thresholds stay +25, 0,
-30, -70. Milestone flash settings remain 600 ms, 100 ms on/off, tint 0xff7777;
the full boss keeps continuous hit acceptance rather than Premium immunity.
Existing candles/tears and charts remain owned by the unchanged boss code.

REKT stops weapons and freezes charts. The existing pump sequence retains
2000 ms entrance, 650 ms pause, 250 ms bubble pop, 1000 ms command hold,
200 ms fade (launch at 4100 ms), 500 ms character exit, then god-candle rise
1200 ms and push 2000 ms. Completion is returned only after the full 7300 ms
sequence. God-candle size multiplier stays 0.5. No scheduling change touches
Wojak textures, layered presentation, movement, damage or victory artwork.

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
spawnSelected(type) = formation !== 'SNAKE' && eligible(type,wave) && seededRandom() < .10
```

Defeat Wojak after 10 → wait through 11, 12, 13 → first eligible 14. Each eligible
registered type rolls once per compatible regular wave. Snake waves count toward
normal wave-number progression/waiting but do not roll or spawn Premiums. Consecutive appearances are allowed;
there is no cooldown, appearance counter, lifetime limit or persistence across
runs. Only Wojak currently has an implemented Premium controller. Mubarak is a scheduled full encounter, not a registered Premium invader. Its victory does not unlock a nonexistent Premium controller.
The chance stays at exactly 10% after both successes and failures: no pity
counter, ten-wave guarantee, probability ramp or success penalty. Seeded plans
can contain long gaps or consecutive appearances. Replanning the same wave and
seed repeats the same result rather than granting a new roll.

Selected types get seeded randomized priority and shuffled candidate footprints.
Backtracking searches non-overlapping footprints, maximizing fitted entity count;
if not all fit, keep the first best solution in that deterministic ordering.
The forced test Wojak gets first priority. There is no artificial one-Premium
limit: CLASSIC physically fits at most six 2 × 2 Premiums, upper-only DIAMOND at most
two, and TWIN_SQUADS at most four (two per squad). One registered type rolls once, so current production configuration
selects at most one Wojak on compatible layouts and zero on Snake.
Future types require real controller factories as well as configuration entries.

## 5a. Mubarak V1.1 Acts I and II — complete current encounter

### Integration, checkpoint and completion

`mubarak.ts` owns the unchanged encounter. `mubarak-barrels.ts` owns oil flights
and blasts; `mubarak-shrapnel.ts` owns the Big Bang. MainScene loads original
assets, prepares registered canvases, routes bullets and score/player-damage
callbacks, and clears all owners on restart, game over and shutdown. Scheduling
invokes it after 20,40,60,... and temporarily also after Wave 1.
Player movement stays available; shooting is enabled only in cruise and Act II.
No boss-body contact damage is added. Bullet processing checks shootable
fragments, shootable barrels, then the boss; each accepted projectile is consumed
once. Direct Act II lasers are consumed with no boss damage or flash.

The current V1 temporary victory is four accepted barrel-explosion hits in Act II.
The fourth stops/removes falling barrels and freezes Mubarak for the full 800 ms
feedback. After it, all remaining encounter visuals/projectiles are cleared and
MainScene resumes checkpoint+1 through its existing wave-transition path. This
is a complete playable V1 endpoint; there is no Act III, invented phase or boss
reward. No Mubarak Premium controller/unlock is added.

### Nineteen PNG assets and common character registration

All source artwork is under `assets/mini-boss/mubarak/`. Runtime keys and filenames
are `mubarak-act1-<1..6>-<right|left>` and `mubarak-act2-1-<right|left>`, with `.png` file extensions. Build packaging
matches only `^mubarak-(act1-([1-6]-(left|right)|explosion-[1-5])|act2-1-(left|right))\.png$`; it excludes
the scene reference. `MainScene.preload()` loads fourteen character `-source` textures
and the five explosion images directly. `prepareMubarak()` draws all fourteen
character sources into transparent **1664×1216** canvases. Originals are never rewritten.

| Frame / side | Inspected source size | Alpha range | Canvas X,Y | Source draw scale |
| --- | --- | --- | --- | --- |
| 1 right | 1536×1024 | 0–254 | 64,80 | 1 |
| 1 left | 1536×1024 | 0–254 | 64,80 | 1 |
| 2 right | 1536×1024 | 0–254 | 84,108 | 1 |
| 2 left | 1536×1024 | 0–255 | 44,108 | 1 |
| 3 right | 1443×1090 | 0–255 | 120,60 | 1 |
| 3 left | 1536×1024 | 0–255 | 5,60 | 1090/1024 = 1.064453125 |
| 4 right | 1536×1024 | 0–254 | 90,110 | 1 |
| 4 left | 1536×1024 | 0–254 | 38,110 | 1 |
| 5 right | 1536×1024 | 0–254 | 92,105 | 1 |
| 5 left | 1536×1024 | 0–254 | 36,105 | 1 |
| 6 right | 1536×1024 | 0–254 | 64,80 | 1 |
| 6 left | 1536×1024 | 0–254 | 64,80 | 1 |
| Act II 1 right | 1536×1024 | 0–254 | 64,80 | 1 |
| Act II 1 left | 1536×1024 | 0–254 | 64,80 | 1 |

Every source is RGBA. Nothing is cropped, stretched, flattened, flipped or
background-removed. Source scale for left Frame 3 is uniform in both axes; it
compensates for the artwork's smaller export, matching the right Frame 3's
apparent figure size. Other left offsets reflect the right composition into the
same canvas (`1664−rightX−1536`). Left Frame 3's visible bounds register near
the reflected right Frame 3 bounds after its uniform enlargement.

The sprite always uses origin (0.5,0.5), scale `360/1664≈0.216346`, and dimensions
**360×263.077** world pixels; texture switches never alter its position or scale.
Regular invaders remain about 87.36×73.10, Premium Wojak 175.36×116.91, full Wojak
337.92×225.28. Right diamond tips register near (910,1040); left tips near
(754,1040), reflecting the whole composition rather than centering only its face.
The diamond's horizontal displacement on facing change follows the supplied
artwork; the collision polygon changes with it in the same frame.

The sources still differ in pose/contour/glow. In particular, the supplied left
Frames 2/3 have visibly different background/edge treatment. Registration keeps
a common full-canvas anchor and comparable figure scale but cannot eliminate
those source-art differences without editing artwork, which is outside this fix.
Both carpet tassels and the entire character source image remain inside the common canvas.
The new Frame 6 is a distinct no-diamond shocked pose; its dedicated left/right
assets use the same origin, render scale and padded canvas as the other frames.
Both Act II Frame 1 assets are also 1536×1024 RGBA, registered at (64,80) without
trimming or scaling their source. Their alpha bounds are (0,8)..(1524,1024) right
and (12,8)..(1536,1024) left; the full source image is retained. The pose switch
changes only the existing sprite texture: no origin, position, dimensions, depth,
scale, visibility or identity changes. Dedicated source artwork is used, never
`flipX`, for both acts.

### Seeded 50/50 side selection

`mubarakEntranceDirection(seed,wave)` uses the existing `randomForWave`:

```
roll = randomForWave(seed ^ 0x4d554241, wave)()
direction = roll < 0.5 ? +1 : -1
```

+1 means upper-left entry, flying right with dedicated right art. −1 means
upper-right entry, flying left with dedicated left art. Exactly one draw uses a
separate domain, consuming no formation/composition/direction/Premium/live RNG.
The scene passes the retained `waveSeed` and current completed wave to `start()`.
The same seed/wave, including restart, repeats the same entrance; 50/50 describes
the threshold across seeds, not a fresh reroll or forced alternation per restart.
Use the existing unsigned decimal `?waveSeed=` query to reproduce either side.

### Diagonal entrance and continuous cruise

The logical physics world remains 800×600; CSS viewport scaling does not change
motion or collision geometry. `entranceMargin=16`, `entranceMs=3600`.
Start center X is −196 for the left entry or 996 for the right entry, with center
Y≈−147.538. The full canvas initially sits just beyond both relevant world edges.
Entrance starts at rest, moving diagonally inward, and ends fully visible at
X≈261.407 (left entry) or 538.593 (right entry), Y=190.

Let `d` be the selected entrance direction, `R=196`, `q=−π/4`, and `t` be active
cruise milliseconds. Cruise is:

```
R = max(0, world.width/2 − displayWidth/2 − edgeMargin)
x = world.centerX + d * R * sin(q + 2π*t/14000)
y = world.top + 190 + 14*sin(2π*t/7000) + 3*sin(2π*t/2200)
```

The following values remain directly tunable in `MubarakSettings`:

| Setting | Value |
| --- | --- |
| displayWidth / canvas dimensions | 360 / 1664×1216 |
| entranceMs / entranceMargin | 3600ms / 16px |
| cruiseStartPhase | −π/4 |
| patrolY / edgeMargin | 190 / 24px |
| cruisePeriodMs | 14000ms |
| waveAmplitude / wavePeriodMs | 14px / 7000ms |
| bobAmplitude / bobPeriodMs | 3px / 2200ms |
| diamond sequence | 528.75ms; then playable Act II |

The entrance uses cubic Hermite interpolation for each axis. For normalized
entrance progress u, `S=3u²−2u³`, `H=u³−u²`, duration T=3600:
`position = start + (end−start)*S + H*T*endVelocity`.
Start velocity is zero. The endpoint is the cruise formula at t=0. End velocities
are `vx=d*R*cos(q)*2π/14000≈d*0.062200 px/ms` and
`vy=14*2π/7000 + 3*2π/2200≈0.021134 px/ms`. Position and both velocity components
therefore match at the join. Entrance overflow delta advances cruise immediately;
large and partitioned frames follow the same elapsed-time trajectory.

Cruise speed magnitude remains at most `R*2π/14≈87.965 px/s`. Reversals occur at
X=204 and 596, preserving full-canvas X=24..776 clearance. The first turn occurs
5250ms after cruise entry, then every 7000ms. Vertical cruise canvas envelope is
Y≈41.462..338.538, safely above the player lane. The diamond explosion freezes movement; Act II then resumes the same patrol at twice the horizontal phase rate.

During entrance, facing is the inward travel direction. During cruise, facing
uses `sign(d*cos(q+2π*t/14000))`, the actual instantaneous horizontal velocity.
At a near-zero turning-point velocity (`abs(value) <= 1e-10`), retain prior facing;
switch immediately when the sign reverses. `mubarakTexture(frame,direction)` chooses
the dedicated source-derived texture and never sets `flipX`. Reversals do not
modify hit count, damage frame, flash elapsed, immunity, scale, origin or position.

### Act I tip, reflection, barrels and final hit

Act I health is four successful tip hits, frames 1→2→3→4→5. Only the bottom tip
is vulnerable: a 96×64 registered-canvas rectangle (20.769×13.846 world pixels),
centered horizontally at the source-art tip and extending upward. Transform
through the same per-pose padding/export scale as the rendered sprite. The tip
sources (right / left, before registration) are frame 1 (846,955)/(690,955),
frame 2 (826,930)/(710,930), frame 3 (790,980)/(704,922), frame 4
(818,930)/(718,930). Left Frame 3 uses its registered 1090/1024 source scale.

The right source outlines are:

| Frame | Ordered outline vertices in original source pixels |
| --- | --- |
| 1 | (340,450),(650,230),(910,190),(1150,240),(1360,430),(846,955) |
| 2 | (350,470),(650,270),(880,220),(1150,285),(1325,455),(826,930) |
| 3 | (310,500),(610,285),(840,240),(1080,290),(1290,485),(790,980) |
| 4 | (350,475),(645,270),(890,220),(1125,290),(1305,470),(818,930) |

For left outline points, subtract right-tip-relative X from the left tip and add
right-tip-relative Y to its Y; use ratio 1024/1090 for frame 3, otherwise 1.
Then apply that left pose's normal registration. SAT tests these convex polygons
against the existing 6×36 normal/rapid laser body. Non-diamond body/head/carpet
misses do not damage the boss. A valid tip hit during immunity is consumed but
does not add damage. First three hits retain four 100 ms red/100 ms normal pulses,
800 ms immunity and tint 0xff7777 via shared hit-flash configuration.

Every other diamond contact consumes its original laser and creates an uncapped
encounter-owned reflection. It copies that shot's texture, animation/frame,
origin, scale, alpha, tint and effects; rotation follows velocity. No Pepe weapon
art, ricochet cooldown, global-cap suppression, homing or repeated boss collision.
The impact side uses the actual world outline's horizontal bounding center;
center band is 8% of diamond width. Select one launch-time destination on the
actual player Y line, inset from world edges by `hypot(body.width,body.height)/2+1`.
For left hits, random target lies 35–65% through [leftBound,min(center,impactX)];
right hits use [max(center,impactX),rightBound]. Clamp both to playable bounds.
Center hits use impactX plus `(roll-.5)*centerBand*.6`, clamped. Normalize vector
to that destination and multiply by the original incoming speed (normal 400 px/s).
The rotated AABB retains the incoming body dimensions. Only player collision and
natural offscreen cleanup own the reflected shots; destinations never track X.

No Act I barrels spawn before the first tip hit. Shared baseline interval is
450 ms, with Act I frequency multiplier .3 times `[1,1.25,1.5]` in frames 2/3/4:
2/3, 5/6, 1 barrel per second, or 1500/1200/1000 ms. Fractional elapsed time is
retained; vertical speed stays 120 px/s. All Act I barrels are black and cannot
be shot. Spawn X is uniform across the transformed usable carpet bounds
left=180,right=1484; Y is below carpet bottom=1150, with half barrel canvas height
and 2 px margin. Clamp X by full-image half width and world boundaries. Each
barrel keeps its launch X while falling. No warning/homing is introduced.

Final tip hit immediately freezes Act I frame 5, disables shooting and clears
all Act I barrels/reflections. Unrelated art/player shots are preserved. The next
update begins the original frame-6/diamond-overlay cinematic. Underlying movement
and facing remain frozen; the sprite switches to the angry Act II pose during
explosion frame 3. Source images are the existing five `.png` explosion assets.

| Overlay | Duration ms | Elapsed interval ms | Width | Underlying sprite |
| --- | ---: | --- | ---: | --- |
| 1 | 67.5 | 0–67.5 | 360 | Act I frame 6 |
| 2 | 67.5 | 67.5–135 | 450 | Act I frame 6 |
| 3 | 131.25 | 135–266.25 | 600 | Act II frame 1 |
| 4 | 131.25 | 266.25–397.5 | 600 | Act II frame 1 |
| 5 | 131.25 | 397.5–528.75 | 600 | Act II frame 1 |

The 3:2 images keep native proportions. Anchor=(910,660), reflected X for left;
offset=(0,0), depth=boss+1. Total 528.75 ms. Overlay removal starts Act II;
overflow delta advances it only after that boundary. Frame 5 cleanup is a
separate preceding update and does not shorten any overlay frame duration.

### Act II movement, oil barrels and damage

Health=4, stepMs=1000/120, horizontalSpeedMultiplier=2. Reconstruct the patrol
sine phase and hover offset from the frozen pose so there is no teleport.
The same 196 px radius has 7 s horizontal period and peak 175.929 px/s, with
unchanged vertical hover. Visible boss body is registered x=86,y=90,width=1492,
height=1011, transformed at 360/1664. A direct shot touching it disappears but
cannot damage the boss. Accepted barrel blasts preserve 800 ms red flash/immunity.

Original oil artwork is `weapons/mubarak-barrels/mubarak-barel-black.png`
(single-r `barel`), source canvas 1254². Body x=256,y=8,width=742,height=1237;
scale=48/1237, yielding body width 28.792 and height 48 world pixels. Cap=32
falling barrels. Black artwork and body size remain unchanged in both acts.
Explosive Act II barrels use `weapons/mubarak-barrels/mubarak-barel-yellow.png`
(single-r `barel`), also 1254², with a black biohazard symbol. Both assets are
preloaded in MainScene. Spawn positioning is still computed from the black source;
only the selected shootable sprite texture changes. Both retain scale 48/1237
and the same sourceBody rectangle. No red tint or filter is applied.

Act II interval is shared baseline 450 ms divided by frequency .828 =
543.478260869565 ms (1.84 barrels/s), vertical speed 120 px/s. This weighted
implementation preserves one shared timer: old black rate 2*.9=1.8/s becomes
1.8*.90=1.62/s; old explosive rate 2*.1=.2/s becomes .2*1.10=.22/s. Their sum is 1.84/s,
so the new normalized explosive probability is .22/1.84=11/92. The configured frequency
multiplier is the old .9 times (.9*.90+.1*1.10)=.828. These are relative color-rate
changes, not percentage-point adjustments or independent timers. Spawn just above the world's top with
margin 2; random full-world X avoids full-image edges. Up to 8 X candidates
maximize separation from near-top neighbors, accepting gap ≥1.2 body widths.
Each Act II spawn independently rolls 11/92 (11.9565217391%) shootable yellow
(original asset colors, no tint) and 81/92 (88.0434782609%) unshootable black. These probabilities
produce the requested rates in expectation; finite samples need not match them. Black lasers pass through; only yellow barrels detonate.

Act II new spawns are gated until every pending Big Bang diamond is released
and every surviving fragment center is at/below `world.top+2*world.height/3`,
or has been destroyed/removed. In 800×600 this threshold is Y=400. This is
position-based, not a fixed delay; boss movement and fragments continue. Gate
latches open once satisfied, resets on cleanup/restart, and banks no spawn time.
First subsequent barrel waits the nominal 543.478260869565 ms interval. On the
120 Hz simulation this first appears at 550 ms, with fractional timer remainder
retained for later spawns rather than rounding every interval to 550 ms. Empty survivors with
no pending releases unblock immediately. Act I rates are not affected.

Shot yellow barrels use actual `ponke-explosion`, 16 frames at 24 fps (666.667 ms),
scale 1.6875: 216 px full frame, approximately 162 px visible diameter. Damage
circle radius=81 px, matching the visible banana fireball. Circle/rectangle
intersection can damage Mubarak at most once per blast; an immune contact may
still succeed later during that blast's lifetime. Barrel explosions do not damage
players/other enemies/diamonds. An accepted fourth hit stops falling barrels;
full existing defeat flash precedes completion.

A falling barrel reaching actual player-line Y invokes the existing BananaBombs
impact handler and disappears. This is used in both acts: scale 1.6875, radius
81, player-damage window 150 ms, existing player body/active/life guards. A distant
landing does not cost a life; one impact can damage once. Normal invader/banana
artwork is unchanged. There is no second barrel-only player-damage system.

### Diamond Big Bang: current prototype configuration and formulas

At the start of climax frame 3 (135 ms), begin a 240 ms staggered burst from the
same world diamond center. Release exactly 100 existing PNGs from
`weapons/mubarak-diamonds/mubarak-diamond-{gold,black,red}.png`: 70 gold,
15 black, 15 red. Shuffle a fixed type queue; do not probability-roll counts.
All types retain 39 px rendered width, proportional scale, and body ratio .8
(31.2 px width). Origin jitter is 20 px. No source image is edited.

Independent shuffled horizontal strata cover the usable world width:
`targetX=L+19.5+(i+random)/100*(worldWidth-39)`. Independently sample
`targetY=T+19.5+random*(.85*worldHeight-39)`, then shuffle target release order.
All fragments physically originate at the explosion; no random-position teleport,
rigid grid or single cone. Motion uses fixed 1000/120 ms steps. Set launch velocity
from the target one second later under the same damping formulas:

```
drag=1.6; fall=84 px/s; gravity=240; k=gravity/fall; launchTime=1 second
vx0=(targetX-x0)*drag/(1-exp(-drag*launchTime))
vy0=fall+(targetY-y0-fall*launchTime)*k/(1-exp(-k*launchTime))
x += vx*(1-exp(-drag*dt))/drag; vx *= exp(-drag*dt)
y += fall*dt + (vy-fall)*(1-exp(-k*dt))/k
vy = fall+(vy-fall)*exp(-k*dt)
```

This preserves broad trajectories while settling toward 84 px/s (30% below the
original 120). At left/right full-sprite boundaries, clamp and reflect horizontal
velocity with .5 restitution; at top, clamp and turn upward velocity downward
with .5 restitution. Fragments cannot remain lost outside the world. Offscreen
bottom cleanup removes missed gold/red without score or red detonation.

Gold is nonhostile: shooting or a red blast removes it and awards exactly 200
through ScoreManager, once. A complete gold clear is 14,000 points, without
changing invader kills or unrelated multipliers. Black cannot be shot; reaching
the player line or overlapping its body removes it and invokes the same banana
impact handler (radius 81, scale 1.6875, 150 ms window), once per impact. Destroying
black with red removes it safely without a black explosion.

Red shots trigger an instantaneous radius-140 circle/rectangle destruction pass
against fragments only. Nearby gold scores once; black disappears safely; red
queues another detonation. Remove before queue/score processing; iterative chains
process each red once, maximum fifteen per original event. Existing yellow animation
is scaled to 280 px visible diameter (`280/96` scale; 373.333 px full frame),
with 666.667 ms clocked visuals. These red effects do not damage boss, barrels
or player. They do not continue damaging new entrants after detonation.

Fragments persist into Act II rather than being cleared with the giant overlay.
All fragment sprites, pending queue/targets, banana impacts and red visuals are
owned by the encounter and cleared on boss completion, game over, restart or
shutdown. No timer can leak into another wave. Scene pause freezes all gameplay
clocks. During the existing 800 ms boss-defeat freeze the event is not advanced;
completion clears any survivors. This existing behavior is retained.

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
regardless of request order. Initial direction uses a separate, independent
stream: `randomForWave(seed ^ 0x444952, wave)`, with exactly one draw and a
0.5 threshold. It uses the same hash/PRNG as existing planning: FNV-style
32-bit hashing of the decimal seed and wave key, then the existing 32-bit mixer
to produce a value in [0,1). The direction stream is recreated per plan; it
consumes neither base/Premium planning draws nor Phaser live RNG. For a fixed
seed and wave, re-planning and restarting reproduce the same direction rather
than re-rolling. The default seed therefore has a repeatable sequence across
runs. Independence means separate per-wave choices, not fresh entropy on restart.
No consecutive-wave direction constraint or history is maintained.

Formation uses its own stream, `randomForWave(seed ^ 0x464f524d, wave)`, with
exactly one draw. `floor(roll * 4)` selects index 0 CLASSIC, 1 DIAMOND,
2 TWIN_SQUADS, 3 SNAKE. The intervals [0,.25), [.25,.5), [.5,.75), [.75,1)
have exactly equal 25% weights;
there is no rounded percentage or leftover probability. It is independent
of the direction stream (`seed ^ 0x444952`), the base stream, the Premium stream
and live Phaser RNG. Formation and direction each allow repeat streaks. The
same wave/seed repeats both choices on reset/restart; there is no run-history
counter, forced alternation or fresh-entropy re-roll on restart. Both selections
apply to all regular waves, including boss milestone regular waves; the following
full boss encounter itself never uses formation selection.

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
following Wave 10, Waves 11–13 also contain 24 regulars. Wave 14 onward on compatible formations rolls
10% per eligible wave (Snake remains 24 regulars): a success gives 20 regulars plus one Wojak, while a miss
keeps 24 regulars. Nothing guarantees a success at any particular wave.
Every example independently allows any of the four formations and either starting direction/state; all listed speeds
are magnitudes. For the default seed, Waves 1–5 start left, right, left, left,
left respectively. For seed 12345, Wave 1 starts right. These examples also
show that consecutive waves can share a direction. Values are rounded only
for display.

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
| 20 | Pair/triple | 159.181 | 757.660 | Mubarak |
| 50 | Pair/triple | 179.264 | 671.167 | Wojak |
| 100 | Pair/triple | 218.522 | 548.392 | Mubarak |

Current limitations and playtest considerations:

- Direction is seeded, not cryptographic or fresh entropy per run. The exact
  50/50 rule is the PRNG threshold; finite samples need not split exactly evenly.
- Opening direction changes the first contacted edge and later encounter
  positions/timing. Other mechanics remain unchanged; playtest both openings.
- To tune future direction rules, create the next version document. Do not
  change this probability indirectly through another system's random draws.

- Forced mode is disabled by default. Manually enabling it bypasses progression
  in production as well as development; keep it off for normal play.
- Autonomous Premium weapons deliberately increase total pressure beyond the
  regular 15-threat cap. Multiple future types could multiply that pressure;
  current probabilities do not guarantee a particular difficulty ceiling.
- Only Wojak is implemented as a Premium invader. Multi-type packing is tested with synthetic planner
  registrations, not nonexistent future enemy artwork or combat controllers.
- The body covers the scaled hull, not all four logical cells. Monitor text and
  chart detail are smaller; no new raster art or alternative collision shape.
- Shared ship dimensions and the planner's 87.36 × 73.10 regular-frame reference
  must be revisited if future artwork or spacing changes. All four layouts use the
  same frame dimensions and spacing.
- The 24-bit packing mask assumes exactly 24 occupied logical cells; it does not
  treat the diamond as a filled 36-cell bounding rectangle. Backtracking is
  intentionally small-board logic, not a general large-level packing framework.
- No repeat prevention, adaptive balancing or seeded live combat. High waves
  retain uncapped speed growth and decreasing regular timer intervals.

## 10. Implementation and verification references

| File | Responsibility |
| --- | --- |
| `src/interface/wave-director.ts` | Central rules, four layouts/squad/row membership, equal selection, isolated formation/direction RNG, seeded formulas, Premium test override and registry configuration |
| `src/interface/wave-config.ts` | Original-grid compatibility exports |
| `src/interface/premium-spawn.ts` | Run unlocks, waiting period, rolls, occupied-cell footprint candidates/packing, balanced remaining slots |
| `src/interface/premium-invader.ts` | Small common controller contract and single Alien root/lifecycle adapter |
| `src/interface/premium-registry.ts` | Implemented controller factory lookup |
| `src/interface/premium-wojak.ts` | Scaled presentation, discrete stages, immunity, autonomous shared weapons, no cinematic |
| `src/interface/wojak-boss.ts` | Shared presentation/registration/flash/weapon hooks; original full encounter |
| `src/interface/wojak-charts.ts` | Shared history and monitor rendering; immediate Premium stage settling |
| `src/interface/wojak-candles.ts`, `src/interface/wojak-tears.ts` | Shared projectile systems; Premium-only optional attack-rate multiplier, original boss defaults and constants unchanged |
| `src/interface/manager/alien-manager.ts` | Actual entity spawning and shared direction initialization, movement, survivor normalization, Premium update/cleanup and normal emitter exclusion |
| `src/scenes/main.ts` | Run progress, damage dispatch, wave/boss/Mubarak transitions and existing regular threat scheduler |
| `src/interface/mubarak.ts` | Test gate, fourteen character assets, preserved diamond cinematic, 2× Act II patrol/HP and oil-barrel lifecycle, seeded corner entrance, four-hit controller, reflected diamond and SAT |
| `src/interface/hit-flash.ts` | Shared exact tint sampling for Wojak and Mubarak |
| `src/interface/game-state.ts` | Separate Mubarak encounter state |
| `scripts/copy-meme-skins.js` | Copy fourteen directional character PNGs and five explosion overlay PNGs into build assets |
| `tests/mubarak-browser.cjs` | Both seeded corners, continuous entrance/cruise join, Act I/diamond cinematic, covered pose switch, playable Act II activation and lifecycle |
| `tests/premium-spawn.cjs` | Default-off and 10,000 locked/forced seeded plans, exact no-Premium placement, all 15 CLASSIC / 4 upper DIAMOND / 12 Twin positions with normal rolls, occupancy/balance, unlock/wait/reset, independent 10% sampling, consecutive rolls and multi-type packing |
| `tests/premium-wojak-browser.cjs` | All 15 CLASSIC / 4 upper DIAMOND footprints in both directions, real Phaser Canvas/WebGL Premium presentation, collision/damage, immunity, movement, autonomous weapons, cleanup, transitions and full boss regression |
| `tests/wave-director.cjs`, `tests/wave-director-browser.cjs` | Formation/direction distributions and symmetry, unchanged V2 rules/composition hash, both live layouts/directions/bounces/sparse bounds/scoring/completion plus boss regressions |
| `tests/snake-browser.cjs` | Canvas/WebGL stagger, alternating independent rows, visible original-row trigger/handoff, synchronized descent, speed, approved Premium exclusion, scheduler/completion and lifecycle |
| `tests/twin-squads-browser.cjs` | Canvas/WebGL both openings and boundaries, six independent rows, pair-local sprite/body contacts, upper-row Premium owner, shared 4-second/25-pixel descent, per-row horizontal acceleration, every Premium anchor, shared firing, actual combat/completion and lifecycle |
| `tests/endless-waves.cjs` | Both initial directions, edge reversals/descent, restart initialization, survivor movement and existing player/weapon/run lifecycle regressions |
| `tests/wojak-charts-browser.cjs`, `tests/wojak-defeat-browser.cjs` | Original boss visual/cinematic fixtures explicitly disable forced Premium spawning |
| `tests/popcat-browser.cjs`, `tests/popcat-weapons-browser.cjs`, `tests/popcat-audio-browser.cjs` | Original regular-wave Popcat fixtures explicitly disable forced Premium spawning |
| `tests/responsive-layout-browser.cjs`, `tests/render-buffer-browser.cjs` | Original layout/rendering fixtures explicitly disable forced Premium spawning |

Existing boss, Popcat, audio, explosion and rendering suites remain applicable.
Original normal-wave regression fixtures explicitly turn off forced spawning;
the dedicated Premium suite first verifies actual default-off progression, then
explicitly enables debug spawning for the approved combat regression fixtures. Pure
probability tests mutate configuration only inside their test process. No original source artwork is edited. Build packaging copies the nineteen Mubarak character/overlay PNGs, black and yellow barrel PNGs and three existing diamond PNGs; runtime textures are padded canvases.

## 11. V12 focused verification and limitations

Relevant checks are TypeScript --noEmit, the local production build, and the
boss-schedule and mubarak-barrels browser suites. The schedule suite exercises
real Wave 1 kill dispatch, the transition delay, full Mubarak combat/victory,
Wave 2 resumption, single-flag restoration and the alternating production
checkpoints through Wave 60, with pure schedule parity checked through 10000.
The barrel suite exercises both entrance seeds in Canvas/WebGL, original black
art and laser pass-through, untinted yellow textures, unchanged 48 px body height
and scale, weighted spawn rolls, 120 px/s drops, banana animation/radius,
indirect boss damage, immunity, four-hit victory and encounter cleanup.

Passed on 2026-10-23: TypeScript `node node_modules/typescript/bin/tsc --noEmit`,
local `npm run build`, both focused browser suites above, and `git diff --check`.
The schedule suite passed in Canvas/WebGL; the barrel suite passed in both
renderers with both entrance seeds. The packaged yellow PNG's SHA-256 matches
the owner-supplied source. Manual interactive playtesting remains with the owner.
The retained two-act endpoint is
four accepted Act II barrel blasts followed by the existing 800 ms defeat flash.
There is no Act III. Independent color rolls mean short samples can contain gaps
in yellow opportunities. Expected black/yellow rates are 1.62/.22 per second;
the 32-barrel cap can reduce actual spawning. The 100 diamond counts remain exact.

## 12. Local iteration references and restoration

- src/interface/mubarak.ts: temporary testSpawn flag; disable to restore scheduling.
- src/interface/mubarak-barrels.ts: yellow asset selection; existing mechanics preserved.
- src/scenes/main.ts: preload both original barrel PNGs.
- assets/weapons/mubarak-barrels/mubarak-barel-yellow.png: owner-supplied asset, unmodified.
- scripts/copy-meme-skins.js: existing PNG copier includes both barrels without changes.
- tests/boss-schedule-browser.cjs and tests/mubarak-barrels-browser.cjs: focused regressions.
- docs/WAVE_DIRECTOR_V12.md: complete current version; earlier documents are preserved.

The local build regenerates ignored dist/game.js and copies the yellow PNG into
dist/assets/weapons/mubarak-barrels/. No commit, push, merge or deployment is
part of this iteration. Returning the early override to false does not remove
the yellow artwork; restoring only scheduling requires that one flag and a rebuild.
