# Popcat projectile tuning

All parameters are in `PopcornSettings` in `src/interface/popcat-weapons.ts`.
The world is 800x600, with positive Y pointing down.

Both attacks now launch from the exact mouth anchor, with no spawn offsets.
The shotgun retains five pieces, its two random sprite variants, 80% probability,
18x18 runtime frames and 6px collision radii. All five velocities point forward:
X = [12,30,48,66,84] px/s facing right, negated facing left. Y starts at -220 px/s.
Horizontal velocity stays constant so the fan opens progressively.

Arcade applies acceleration using its physics delta time. Ascending acceleration
is 620 px/s squared. Descending acceleration is `620 * (1 - vy/140)`, approaching
140 px/s downward without a speed snap or hovering. Nominal apex time is 0.355s,
with a 39px rise (the fixed-step integrator produces about 37px at 60Hz).
Browser measurements from emitter Y=140 reach projectile Y=520 in about 3.63s,
with 261.6px between the outer centers and 65.4px between adjacent projectiles.

The 20% special launches a kernel at 48 px/s forward using the same vertical
physics. Its normal upward speed is 220 px/s. For late-wave mouths below the
reference line, upward speed is the larger of 220 and
`sqrt(2 * 620 * max(0, mouthY - referenceY + 12))`.
That gives the kernel room to rise above the line before its descending crossing.
There is no player homing or target-distance transformation trigger.

The fixed transformation line comes from the actual shared formation layout:
`FORMATION_START_Y + (FORMATION_ROWS - 1) * FORMATION_ROW_SPACING`, currently
100 + 3*74 = Y=322. It does not follow later descents or surviving row counts.
Only a descending kernel at/below this line can transform, once. Physics-step
sampling can place its first giant frame a few pixels below the line.

Giant size remains 83.2x83.2, with collision diameter 62.4px. Growth remains 140ms
cubic ease-out from 18px, followed by the existing 180ms warning deadline before
the full body activates. The warning body remains 6px across. Circle offsets
compensate Phaser's fractional-radius rounding to keep the hitbox centered.

Before rolling the 80/20 RNG, clearance tests the mouth-to-apex segment for all
five regular paths and the kernel, including their sprite half-sizes. Apex travel
is `vx * upwardSpeed / gravity`; nominal worst shotgun travel is about 29.8px.
A top-boundary check also prevents wasted upward shots. No room means no projectile,
no mouth opening and no random roll. The scene retries after 250ms; successful
volleys retain the existing 2000ms cooldown. No missed-shot queue is accumulated.

The tests cover mirrored real Phaser trajectories, initial ascent, smooth slower
descent, mouth origins, fan spread, edge rejection and retry, probability
boundaries, normal and late-row descending transformations, giant dimensions,
centered collision damage and cleanup in Canvas and WebGL. Original PNGs remain
unchanged. See `tests/popcat-weapons-browser.cjs`, `tests/endless-waves.cjs`, and
`tests/popcat-assets.cjs`.

Giant popcorn deals two lives of damage through the shared enemy-bullet/player
damage path. Regular pieces and untransformed kernels retain one damage. The
projectile is consumed before damage is applied; existing state/activity gates
remain intact. Damage stops at zero lives and triggers game over once.
