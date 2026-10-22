# Wave Director V4 — Mubarak Act I Test Encounter

## Changes from Previous Version

**Previous version:** V3 → V4. V1, V2 and V3 remain historical references.

**Main objective:** make the first Diamond Fortress act playable immediately after
Wave 1, so scale, carpet movement, diamond targeting and five-hit feedback can be
tested without reaching a later boss milestone.

**What changed / before vs. after:**

| System | V3 | V4 |
| --- | --- | --- |
| Wave 1 completion | After the 1500ms clear delay and trailing shots, start Wave 2 | Same gates, then one Mubarak entrance/fight/final hold; start Wave 2 afterward |
| Extra encounter | None | `MubarakSettings.testSpawn = { enabled: true, afterWave: 1 }`, deterministic once per run |
| Damage | Regular enemies and Wojak only | Independent diamond polygon, five accepted hits; frame sequence 1→2→3→4→4→5 |
| Feedback | Wojak layered tint logic | Extract identical tint calculation to `applyHitFlash`; Mubarak reuses Premium four-pulse/800ms settings, including its final held hit |
| Encounter movement | Full Wojak patrol only | Mubarak 1800ms smooth descent; sinusoidal horizontal cruise, vertical wave and bob |
| Artwork loading | No Mubarak textures | Five source PNGs registered without cropping on 1664×1216 canvases, scale 360/1664 |
| Completion | No Mubarak completion marker | 1200ms Frame 5 hold, no explosion; clear sprite and resume pending regular progression |
| Cleanup | Existing boss/formation lifecycle | Clear Mubarak on game over, restart and scene shutdown; no owned timers or Arcade colliders |

**What stayed unchanged:** all regular formations, movement speeds, survivor
acceleration, firing formulas/caps, unlocks, composition, seed streams, regular
rewards, and full Wojak encounters after Waves 10/20/etc. Premium spawn probability,
footprints, waiting period, hit acceptance and weapons are unchanged. Mubarak
neither unlocks Premium Wojak nor changes the regular wave number or RNG draws.
It introduces no hostile shots, player-contact damage, additional rewards,
explosion, ricochet, fragment system or Acts II/III.

## 1. Status and authoritative configuration

The experimental equal-four-way (25% each) formation selection is active by default. There is no
player-facing switch or forced alternation. Premium test mode is **OFF by
default** in both production and development.
Normal Premium progression is active. The owner has approved Premium Wojak's
combat behavior. The separate development-only full-boss shortcut remains
disabled.

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
spawnSelected(type) = formation !== 'SNAKE' && eligible(type,wave) && seededRandom() < .10
```

Defeat Wojak after 10 → wait through 11, 12, 13 → first eligible 14. Each eligible
registered type rolls once per compatible regular wave. Snake waves count toward
normal wave-number progression/waiting but do not roll or spawn Premiums. Consecutive appearances are allowed;
there is no cooldown, appearance counter, lifetime limit or persistence across
runs. Only Wojak currently has an implemented Premium controller. Mubarak is a separate test encounter, not a Premium invader.
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

## 5a. Mubarak Mini-Boss — Act I: The Diamond Fortress

### Test progression and lifecycle

`src/interface/mubarak.ts` contains the authoritative `MubarakSettings`, artwork
registration and encounter controller. `MainScene` owns the controller and its
`completedMubarak` run marker. The flag starts false, becomes true only after the
final hold, and resets on restart/new scene creation/shutdown. All Wave 1 enemies
must be inactive. The existing wave-clear 1000-point bonus and individual kills
are awarded normally. The HUD remains Wave 1 during the test.

The usual 1500ms wave-clear delay and zero-active-player-bullet gate apply.
`_startNextWave()` checks the Mubarak gate before the unchanged ten-wave boss gate.
`_startMubarak()` also guards its state, pending marker and living enemies, so it
cannot double spawn or replace a living formation. It stops movement, Premium
weapons and regular firing (`Infinity`), clears both projectile groups and old
aliens, bombs and ally, and hides the next-wave announcement. The dedicated
`mubarakEncounter` state returns before all regular enemy updates/weapon paths.

Player movement remains available. Shooting is enabled only during cruise.
After the fifth hit new shots are disabled; any existing shot contacting the
diamond is consumed. After the hold, destroy the sprite, set the completion marker
and announce Wave 2. The existing trailing-shot gate still applies before
spawning its 24 ordinary enemies. The usual capped one-life recovery happens
once when Wave 2 starts, not when Mubarak enters or completes. No separate
mini-boss score or kill count is added for this first gameplay test.

Disable the insertion with `MubarakSettings.testSpawn.enabled = false`.
Change `afterWave` to move it to another completed wave. If it coincides with a
full-boss milestone, the full boss remains pending and runs after Mubarak, before
the next regular wave. No seed/query/development gate is involved; it is enabled
in local development and local production builds. It is a temporary playtest rule.

All encounter clocks are local elapsed gameplay delta, with negative delta
clamped to zero. Scene pause stops updates; there are no TimerEvents, tweens,
persistent overlap registrations or callbacks to cancel. `clear()` destroys the
sprite and drops the reference, making the derived polygon disappear too; a
cleared controller's `update()` cannot complete an encounter. Restart, game over
and shutdown call it, including while entering, flashing or holding Frame 5.
The five reusable padded textures are scene texture-manager resources and remain
cached across restarts, matching existing texture preparation conventions.

### Artwork registration, alpha and scale

Source files are under `assets/mini-boss/mubarak/`. Only `mubarak-act1-[1-5].png`
is loaded/copied into build assets; `mubarak scene 1 reference.png` is not packaged.
The originals are unchanged. Actual inspected source properties:

| Frame | Source dimensions | Mode / alpha range | Registration offset X,Y |
| --- | --- | --- | --- |
| 1 | 1536×1024 | RGBA, 0–254 | 64,80 |
| 2 | 1536×1024 | RGBA, 0–254 | 84,108 |
| 3 | 1443×1090 | RGBA, 0–255 | 120,60 |
| 4 | 1536×1024 | RGBA, 0–254 | 90,110 |
| 5 | 1536×1024 | RGBA, 0–254 | 92,105 |

All five are drawn at native size into transparent 1664×1216 canvases using the
offsets above. No trimming, stretch, per-frame scale or source cropping occurs.
Padding aligns the diamond tips near canvas (910,1040), with one (0.5,0.5) origin,
one common texture size and one scale `360/1664 ≈ 0.216346`. Rendered canvas size
is **360×263.077 world pixels**, versus approximately 87.36×73.10 for a regular
invader, 175.36×116.91 for Premium Wojak and 337.92×225.28 for the full Wojak.
Frame changes never modify position, scale or origin. Source compositions differ
slightly in diamond shape, carpet contour and baked glow; registration prevents
texture-size jumps but does not morph or redraw those artistic differences.
Frame 3's background/glow differs from the other four, which retain broad
partially transparent glow regions. Existing alpha and all tassels are preserved.

### Entrance, motion and safe envelope

All positions use the existing 800×600 physics world, not browser CSS size.

| Setting | Value |
| --- | --- |
| Rendered canvas width | 360 px |
| Initial center | world center X=400; Y=world.top−height/2≈−131.538 |
| Entrance | 1800ms; smoothstep `t²(3−2t)` from initial Y to top+190 |
| Horizontal edge margin | 24 px outside the complete canvas |
| Horizontal period | 14000ms; radius=`max(0,world.width/2−displayWidth/2−24)`=196 |
| Horizontal X | world.centerX + 196·sin(2π·cruiseElapsed/14000) |
| Base cruise Y | world.top+190 |
| Vertical wave | 14·sin(2π·cruiseElapsed/7000) |
| Bob | 3·sin(2π·cruiseElapsed/2200) |
| Final hold | 1200ms, at least the shared flash duration |

Cruise begins at X=400 and initially travels right, smoothly reverses at X=596,
returns through center and reverses at X=204. Maximum horizontal speed is
`196·2π/14 ≈ 87.965 px/s`, smoothly falling to zero at turns. Both carpet tassels
remain inside the padded canvas; its horizontal envelope is X=24..776. The
conservative full-canvas vertical cruise envelope is Y≈41.462..338.538, leaving
the player lane clear. Entrance is intentionally offscreen until descent.
Overflow delta at the end of entrance carries into cruise rather than being
lost. Holding Frame 5 freezes movement. There is no random movement or facing
flip; artwork keeps its original orientation on both travel directions.

Tune width, margin, periods, amplitudes and Y in `MubarakSettings`. Width controls
uniform display scale and the world-space polygon simultaneously. Keep Y minus
amplitudes above half the rendered height and keep its bottom clear of the
player lane. The current safe envelope targets the existing fixed logical world;
changing that world's dimensions requires rebalancing these values.

### Diamond-only collision and five-hit mapping

The collision approximation is a conservative convex six-point polygon in the
registered canvas, inset to avoid both hands, the head, body and carpet:

```
(680,470), (940,330), (1180,470), (1180,600), (910,1010), (700,710)
```

Its local bounding rectangle is X=680..1180, Y=330..1010: 500×680 source pixels,
or **108.173×147.115 world pixels**. Relative to the sprite center that rectangle
starts at **(−32.885, −60.144)**; its far corner is (+75.288,+86.971).
Each point becomes `sprite top-left + point × uniformScale` on every collision
check. A separating-axis intersection tests the convex polygon against the
current player's Arcade projectile rectangle, preserving the existing blue and
rapid laser body's 6×36 world pixels. There is no whole-sprite Arcade body,
player-contact collider or collision with hostile shots. Hits outside the
polygon pass through untouched; grazing the outer diamond silhouette may miss
because this intentionally conservative first approximation excludes the hands.
It uses discrete frame overlap, as do the existing projectile conventions.

| Successful hits | Displayed frame | Damage acceptance |
| ---: | ---: | --- |
| 0 | 1 | Only after entrance |
| 1 | 2 | After previous immunity ends |
| 2 | 3 | After previous immunity ends |
| 3 | 4 | After previous immunity ends |
| 4 | 4 | Full visible hit feedback despite unchanged texture |
| 5 | 5 | No further damage; hold, then complete |

`successfulHits = 5` and `framesByHits = [1,2,3,4,4,5]` are explicit tuning values;
change them together, retaining one mapping entry for each hit count.
Every accepted hit switches texture before applying feedback and immediately
starts the exact shared tint helper used by Wojak's layers:
`WaveDirectorConfig.premiumInvaders.wojak.hitFlashCount = 4`,
`WojakSettings.milestoneFlashOnDuration = 100`, off duration=100, tint=`0xff7777`.
Total immunity is `4*(100+100)=800ms`, read from the same live configuration.
Elapsed 0–99,200–299,400–499,600–699ms is red; the alternate intervals are normal.
At 799ms a hit is rejected; at 800ms the sprite is untinted and can take its next
hit. No queue or additional flashes can be triggered during immunity.

The scene advances feedback before processing collisions, so a newly accepted
hit gets its full window. All diamond-contact projectiles are disabled immediately
and destroyed after iteration, including rejected immunity/final-hold contacts,
matching Premium consumption. A projectile cannot advance two states. Frame 5
also receives all four pulses, then remains normally colored for the rest of its
1200ms hold. This is the requested held final-hit feedback; Premium Wojak itself
still uses immediate regular destruction on its fifth hit without a final hold.

### Scope and tuning limitations

This is a passive targeting/movement test: Mubarak fires nothing and cannot
hurt the player. No explosion, ricochet, diamond shards, additional acts, boss
health bar, special audio or reward is introduced. The hold simply removes the
sprite and resumes ordinary progression. Source-pose/glow differences remain;
frame registration, hitbox inset and movement should be assessed by playtesting.
The controller has no independent difficulty scaling and does not consume RNG.

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
| 1 | Pepe | 100.000 | 1610.000 | Mubarak test (separate from full boss schedule) |
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
| `src/interface/mubarak.ts` | Test gate, five source assets and canvas registration, movement/damage/hold controller, derived diamond polygon and SAT |
| `src/interface/hit-flash.ts` | Shared exact tint sampling for Wojak and Mubarak |
| `src/interface/game-state.ts` | Separate Mubarak encounter state |
| `scripts/copy-meme-skins.js` | Copy only the five playable Mubarak PNGs into build assets |
| `tests/mubarak-browser.cjs` | Enabled Wave 1 encounter, real blue/rapid bodies, damage mapping/immunity/hold, movement/pause, lifecycle and normal milestones |
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
probability tests mutate configuration only inside their test process. No original source artwork is edited. Build packaging copies the five Mubarak PNGs; runtime textures are padded canvases.

## 11. V4 verification (2026-10-22)

`tests/mubarak-browser.cjs` passes in real Chrome Canvas and WebGL. It verifies:
ordinary Wave 1 start; living-enemy/1500ms/trailing-shot gates; single entrance;
1800ms descent; constant texture canvas/origin/scale across all damage states;
14-second cruise bounds and upper-screen envelope over two cycles; pause;
negative/zero delta; conservative diamond misses through head/body/carpet/tassels;
real blue and rapid laser damage; exact frame mapping; four alternating 100ms
red/normal pulses for every successful hit; immune-contact consumption; protection
at 799ms and expiry at 800ms; fifth-hit rejection; full 1200ms hold; removal and
exactly one Wave 2; disable switch; no Premium unlock; restart/game-over cleanup
at entrance/cruise/final phases; scene shutdown; unchanged Waves 10/20 bosses.

Ten existing regression suites pass: `wave-director.cjs`, `premium-spawn.cjs`,
`wojak-candles.cjs`, `wojak-charts.cjs`, `endless-waves.cjs`,
`wave-director-browser.cjs`, `premium-wojak-browser.cjs`, `snake-browser.cjs`,
`twin-squads-browser.cjs` and `wojak-defeat-browser.cjs`. Existing regular-wave
progression fixtures explicitly disable only the temporary Mubarak test gate;
the dedicated new suite exercises its actual enabled default. All other
assertions remain intact. Formation counts remain 2467/2376/2524/2633 over 10,000
waves; original composition/Classic Premium hashes and the 759/7522 compatible
normal Premium-roll sample are unchanged.

TypeScript `node node_modules/typescript/bin/tsc --noEmit`, production
`npm run build`, and `git diff --check` passed. Browser artifacts are saved outside
the repository under this task's visualization folder, `mubarak/` (JSON and
Canvas/WebGL screenshots including each registered frame and a diagnostic diamond
overlay) and `mubarak-regression/` (existing regression artifacts). The overlay is
test-only and is never displayed in gameplay.

Original Mubarak artwork and historical V1–V3 documents remain unchanged. The
build copies five new PNG assets to `dist/assets/mini-boss/mubarak/`; these are
local generated copies of the supplied assets. No commit, push, merge or deploy
was performed.
