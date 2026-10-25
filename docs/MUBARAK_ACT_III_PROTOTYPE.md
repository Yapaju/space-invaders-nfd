# Mubarak Act III: movement, BNB pumping, random diamond shots, and alpha blocking

## V1 hit and attack polish

Each accepted CZ hit now starts the ordinary invader `Kaboom` effect over his
cockpit, at 1.5 times that effect's normal display scale, before switching the
damage frame. The effect stays at the hit location, above CZ, and plays the
existing animation and sound once. Immunity and escape hits do not retrigger it.
Each black-diamond timer event emits exactly one straight projectile, independently
selected at random from -40°, -20°, 0°, +20°, and +40° relative to down. Speed stays 84 px/s and the
existing 2.5/2/1.5/1-second growth intervals remain unchanged.

## Current playtest refinement

The preceding refinement changed CZ's width from 260 to 130 px (uniform scale 0.16927 to 0.08464).
His lane moves from Y=105 to Y=100; Mubarak's base lane moves from Y=340 to Y=260.
Successful CZ hits now trigger 800 ms of red flashing and immunity. Mubarak drops
existing black diamonds at pump-dependent intervals, and his player-laser shield
now uses actual cached texture alpha instead of the old rectangular body.
These size/lane settings are preserved by the V1 polish. Movement speeds, two-hit CZ defeat, BNB parameters, the 148% growth cap, escape,
collapse, and next-wave completion remain unchanged.

## Entry and lifecycle

Act I remains four diamond-tip hits, followed by the existing five-frame explosion
and Act II shrapnel event. Act II remains three accepted explosive-barrel hits,
with its existing movement, barrel rates, immunity, and hit feedback.

The third accepted Act II hit now enters `act3Entry` rather than ending the boss.
It stops barrel spawning and falling barrels, preserves the existing 800 ms lethal
hit flash, then clears all remaining barrel blasts, impacts, and shrapnel before
entering `act3`. Shooting is disabled during that flash and enabled in Act III.
Act III adds BNB pumping, growth, black-diamond drops, and the final dump described
below. It adds no external timers, input listeners, artwork, health bar, or rewards.

The existing early playtest encounter after Wave 1 is preserved. Normal boss
scheduling, seed draws, Wave Director configuration, and probabilities are unchanged.
The existing development F6 shortcut still previews the Act I finale; finish Act II
normally to reach this prototype.

## Positioning and movement

All tuning values are in `MubarakAct3Settings` in `src/interface/mubarak.ts`.
Coordinates below assume the existing 800 × 600 playable world at (0, 0).

| Parameter | Initial value |
| --- | --- |
| Mubarak base lane center Y | 260 px |
| CZ lane center Y | 100 px |
| Mubarak base width / height | 360 / approximately 263.08 px (existing scale) |
| CZ width / height | 130 / approximately 86.67 px |
| Mubarak speed | 120 px/s |
| CZ speed | 90 px/s |
| Horizontal canvas inset | 24 px |
| Mubarak center X limits | 204–596 px |
| CZ center X limits | 89–711 px |
| Escape initial speed | 360 px/s |
| Escape acceleration | 600 px/s² |

Mubarak keeps his Act II X and direction when the flash ends and takes the lower
lane. CZ starts at that same X in the upper lane, facing the opposite direction.
The initial X therefore depends on the actual Act II hit, rather than a fixed
coordinate or a new random draw. Both characters patrol independently at constant
speed. Reaching a horizontal limit reverses travel and selects the corresponding
dedicated left/right PNG. Overshoot is reflected, including across multiple
boundaries in long frames; the full source canvases stay inside the world.

CZ's full canvas spans Y ≈56.67–143.33 and Mubarak's Y ≈128.46–391.54. Their
transparent canvas padding overlaps, but the first opaque Mubarak pixels begin
at Y≈147.93, below even CZ's full canvas. CZ stays below the existing HUD. These
lanes have no bobbing or vertical following. The
different widths and movement speeds periodically separate their horizontal
positions, opening shot paths without scripted vulnerability windows.

## Act III rendering order

Phaser depth places CZ and his complete rocket-camel sprite at **9**
(`Mubarak depth - 1`), behind Mubarak's unchanged depth **10**. This is assigned
once when CZ is created. Texture switches, patrol, growth, red tint, and escape
retain those depths; there are no per-update depth changes. Normal alpha
compositing lets CZ show through transparent areas of Mubarak while opaque
Mubarak pixels cover him. PNGs, positions, scales, and movement are unchanged.

BNB coins and black diamonds retain depth **12**. CZ's 150% hit explosions retain
their original foreground depth **13**, now expressed relative to Mubarak rather
than CZ. Red flashing stays on CZ's own sprite, visible wherever his art is not
covered by Mubarak. Escape keeps CZ at 9 until full exit, then Mubarak shrinks
at 10 through the unchanged collapse sequence. Acts I and II are unaffected.

Collision continues using the existing alpha masks and first-contact resolution,
with Mubarak winning exact ties when a laser intersects both sprites. Opaque
shield contact consumes the laser without CZ damage; transparent shield pixels
allow the existing CZ alpha test. No hitbox or collision implementation changes
were required for this depth correction.

## Artwork and collisions

All six `assets/mini-boss/mubarak/mubarak-cz-[1-3]-[left|right].png` files are
1536 × 1024. They are loaded directly, without canvas registration, cropping,
flipping, regeneration, or edits. Uniform scale is 130/1536 ≈0.08464. Each frame
has the same source dimensions, preserving scale, position, and aspect ratio when
changing texture. Mubarak retains his existing registered Act II artwork and
360/1664 ≈0.21635 base uniform scale. The packaging allowlist includes the six CZ
files and `mubarak-cz-bnb-coin.png`, the approved 1254 × 1254 transparent artwork.
The coin is loaded directly and uniformly scaled to a 28 × 28 px source canvas;
the artwork's transparent border remains intact.

The existing scene bullet loop continues to consume and destroy contacting player
projectiles. Act III uses Mubarak's actual registered Act II texture alpha as an
invulnerable shield. CZ now uses the same source-alpha architecture over his
complete PNG, including clothing, camel, glass, rocket, and exhaust. His previous
cabin-and-camel rectangle is removed; `czBounds()` provides only full-canvas broad
bounds. The scene resolves only the first contact along each upward beam's
physics path among Mubarak, coins, and CZ. Mubarak wins exact ties. A coin behind
his body therefore cannot be intercepted through the shield. An exposed coin in
front of CZ consumes the shot and prevents the same shot from also damaging CZ.

For upward player beams, Act III sweeps the beam rectangle from its previous
physics Y to its current Y, so a long frame cannot skip the lower shield and hit
CZ behind it. A beam that has already passed above Mubarak is free to hit CZ.
There is no artificial blocking along the entire vertical column. Normal and rapid
beams retain their existing velocity, size, firing rate, and weapon behavior.

`mubarakOpaqueContact` first checks the swept beam against the visible canvas
bounds, then transforms the full beam area into local texture coordinates using
the sprite's current position, origin, and X/Y scale. It examines every covered
source pixel column and row, including beam edges, and respects explicit flipX
and flipY. Registered left and right textures have separate alpha caches. Pixels
with alpha below `blockingAlphaThreshold = 128` do not block Mubarak. CZ uses
`czAlphaThreshold = 16` (16/255, approximately 6.3%) consistently across all three
frames and both directions. This includes faint antialiased edges while ignoring
effectively transparent pixels; sprite flashing/tint does not change source alpha. Bottom-to-top row
traversal finds the first opaque contact along the upward beam, allowing correct
ordering against coins and CZ even in a long frame. Transparent interior holes,
corners, and space beside the body do not consume shots; opaque body and carpet
pixels do. Mubarak remains invulnerable.

`prepareMubarak` reads each existing registered Mubarak canvas and all six CZ
PNGs once. Original PNGs are drawn to a temporary offscreen canvas only to read
alpha; no asset or displayed texture is modified. A WeakMap keyed by texture
retains alpha bytes (about 4 MB for Mubarak and 9 MB for all six CZ frames). Collision
checks only the narrow beam-covered portion of that cached data. There are no
per-frame image reads, replacement hitbox textures, or artwork modifications.
The source-pixel transform automatically follows every growth scale and movement.
The implementation targets this encounter's unrotated sprites and vertical player
weapons; rotated/sheared bosses or diagonal weapons would require an extended
transform/sweep implementation. BNB receipt still uses its established rectangle.
CZ frame switches select the matching cached mask immediately. Collision follows
position, origin, scale, and explicit flips during patrol and escape. Opaque
escape contacts consume lasers without accepting further hits; transparent areas
pass them through. The scene disables and schedules destruction of a consumed
laser immediately, preventing a second accepted contact from that same shot.

## Hits, escape, and completion

CZ starts at zero hits in Frame 1. The first contact changes to Frame 2 in his
current direction, without repositioning or pausing patrol. Each successful hit
resets an encounter-owned 800 ms flash clock. `applyHitFlash` reuses the Premium
Wojak red tint and 100 ms on / 100 ms off timing (four red pulses), without hiding
the sprite. Hits during that interval are consumed but do not advance damage or
restart the clock. Movement and BNB pumping continue. After expiry, a second
successful contacting projectile changes to Frame 3 and enters
`escape`; further CZ contacts have no effect. Mubarak stays invulnerable in both
states and continues patrolling while CZ escapes.

On either accepted hit, `showCZHitExplosion()` runs immediately before the frame
change, in the same collision callback. It creates the existing `Kaboom` class
and plays `AnimationType.Kaboom`: the ordinary invader's 16-frame, 24 fps,
non-looping explosion. `CZ_HIT_EXPLOSION_SCALE_MULTIPLIER = 1.5` multiplies the
fresh effect's normal X/Y display scale; it is independent of CZ's sprite scale
and does not derive a scale from source image dimensions. The current ordinary
effect displays at 128 × 128, so this effect displays at 192 × 192.

`czHitExplosionOrigin = { x: 650, y: 400 }` identifies the visible cockpit in
source coordinates, mirrored for left-facing CZ and transformed by his existing
130/1536 scale. Effect depth is Mubarak depth + 3 = 13, in front of both characters and the
transitioning frame/red tint. Its coordinates are captured once; patrol and escape leave
the explosion behind. No player/boss damage or score is associated with it.
Adding it only to the display/update lists gives it no Arcade body or collision.

Phaser 3.22 emits `SPRITE_ANIMATION_COMPLETE` on the effect. A local one-shot
listener uses the existing sprite destruction lifecycle on completion. The shared
`Kaboom` constructor listens for the general animation event, which is not emitted
on this sprite in the installed engine; this compatibility hook is deliberately
local to CZ so unrelated explosion behavior is preserved.
The encounter tracks these effects in `czHitExplosions`, releases references on
destruction, and destroys unfinished effects on every encounter cleanup. A
second-hit explosion may finish naturally at the impact location while CZ exits
or Mubarak begins collapsing; it cannot survive encounter completion. The same
`InvaderKilled` sound is played once per accepted hit at the shared
`AudioBalance.gains[SoundType.InvaderKilled]`, matching ordinary invaders without
adding another explosion sound. Rejected hits do not reset animation, sound,
immunity, or damage clocks.

Frame 2 continues the same pumping schedule and preserves all accepted growth.
The second hit flashes red immediately, removes every active BNB coin and black
diamond (including its impact effects), and resets attack clocks. The tint continues
on the visible Frame 3 during escape, without interrupting movement. No pumping,
diamond drops, or additional CZ damage can occur during escape or collapse.

Escape keeps CZ's current direction, lane, and Frame 3. Each update moves him by
`direction × (speed × seconds + acceleration × seconds² / 2)` and increases speed
by `acceleration × seconds`. Escape never reflects at a boundary. Collapse
requires the entire source canvas to be past the corresponding world edge.

On full exit, CZ is destroyed and `collapse` starts. Mubarak stops moving and
blocking shots, and player firing pauses for the cinematic. His center stays
fixed while his current uniform scale shrinks to zero over 2000 ms using
`1 - (3t² - 2t³)`. Completion occurs only after the full shrink duration, whether
there were zero pumps, three pumps, or maximum growth. Only then does the controller
destroy Mubarak, set `phase = 'complete'`, and return completion to `MainScene`. The scene
uses its existing completion path: record the completed boss wave, enter
`WaveTransition`, and resume the next ordinary wave through its existing bullet
and delay gates. No victory screen is added. This assumes the current next-wave
flow is the intended post-boss transition; a later bespoke story transition is
outside this prototype. Restart, Game Over, and scene shutdown also clear CZ via
the existing encounter cleanup path. Act III owns no Arcade bodies or persistent
scene listeners; hit effects have only their own completion/destruction listeners.

## BNB pumping and growth

All values below live beside the lane settings in `MubarakAct3Settings`.

| Setting | Value |
| --- | --- |
| `bnbPumpIntervalMs` | 3000 ms |
| `bnbCoinSpeed` | 180 px/s |
| `bnbCoinSize` | 28 px |
| `bnbMaxActiveCoins` | 3 |
| `growthPerPump` | 0.08 of base scale |
| `maxScaleMultiplier` | 1.48 |
| `growthTweenMs` | 200 ms |
| `collapseDurationMs` | 2000 ms |
| `stepMs` | 1000/120 ms maximum simulation step |
| `czPumpOrigin` | source X=650, Y=450; X mirrored for left artwork |

The first coin launches 3000 ms after active Act III starts. Each later interval
launches one coin if fewer than three are active; skipped launches are not queued.
The coin aims at Mubarak's center at launch and keeps a fixed velocity of 180 px/s
without homing. Missed coins are removed when their whole canvas leaves the world.
Coins do not damage the player, award score, or use effects or sounds.

Coin motion uses swept rectangular contacts with the currently scaled Mubarak
body, in simulation steps no larger than 1000/120 ms. On contact the coin is
removed before accepting one pump. Interception removes it from the same owning
array, so it cannot later trigger growth. Pump targets are
`min(1 + successfulPumps × 0.08, 1.48)`: 100%, 108%, 116%, 124%, 132%, 140%, then
148%. Further coins are still consumed. Each accepted pump eases the current
scale to its new additive target over 200 ms using `3t² - 2t³`; overlapping growth
retargets from the current rendered scale, preserving already accepted pumps.

Growth fixes the original full-canvas bottom at Y≈391.54. The center moves upward
as the sprite expands; alpha blocking follows that same rendered transform,
with no extra shield padding. At the cap, canvas dimensions are
532.8 × 389.35 px, center Y≈196.86, top Y≈2.18, and X limits 290.4–509.6. The
bottom never enters the player's normal movement area. Growth intentionally
extends into the upper artwork's vertical range, increasing shielding.

To avoid snapping when growth narrows horizontal limits, the boss retains its
fractional position across the old and new patrol spans as the scale eases. He
continues his independent 120 px/s patrol within the changing span, with a smooth
inward adjustment during growth. Both the visible canvas and shield stay within
the horizontal limits. CZ retains his upper lane and new 89–711 X range; tests
verify exposure still occurs at the approved 148% cap. No cap or movement balance
was silently changed to achieve this.

All pump, growth, and collapse clocks are advanced by the encounter update; no
Phaser timer or tween callbacks can fire after cleanup. `clear()` destroys all
coins and sprites and resets these clocks for restart, Game Over, or shutdown.

## Growth-dependent single black diamond shots

`blackDiamondIntervalsMs` holds `[2500, 2000, 1500, 1000]`. The tier is
`min(3, floor(successfulPumps / 2))`: pumps 0–1 drop every 2.5 s, 2–3 every 2 s,
4–5 every 1.5 s, and 6+ every 1 s. The first drop waits a full interval. Elapsed
progress carries across tier changes; a shorter interval can make the next drop
due immediately after a pump. The emission point is the tunable registered
source coordinate `(832, 1100)`, near the lower carpet, transformed by the current
Mubarak scale and facing.

Act III owns a separate `MubarakShrapnel` instance. Its opt-in `fireBlack`
method emits exactly one `mubarak-diamond-black` projectile per existing timer
event, bypassing the Act II burst, spread targets, and mixed queue. The shared
`dropBlack` primitive creates that projectile at the unchanged emitter, without
horizontal spacing; only Act III attack fragments opt into
constant linear motion and `contactOnly` damage. It reuses the existing 39 px
appearance, 80% rectangular hitbox, 84 px/s speed, and black laser immunity. On
direct overlap with the active player body, it removes the diamond before calling
the existing scene damage callback once. The scene retains its normal damage
protections, life loss, sound, and HUD feedback. No diamond explosion, sound,
BananaBombs impact, secondary hitbox, or lingering damage is created. The existing scene damage callback now admits active Act III as well
as Acts I and II. No Act II burst rules, physics, counts, or mechanics change.

`blackDiamondAnglesDegrees` is `[-40, -20, 0, 20, 40]`, relative to straight down.
For the selected angle θ, velocity is `(84 sin θ, 84 cos θ)` in Phaser's X-right/Y-down
coordinates, so every diamond travels at the same overall speed. There is no
homing, drag, gravity, or boundary bounce for Act III attack fragments. The legacy Act II
fragment branch retains its existing drag, settling, and bounce rules.

| Angle | VX (px/s) | VY (px/s) |
| --- | --- | --- |
| -40° | -53.994159 | 64.347733 |
| -20° | -28.729692 | 78.934180 |
| 0° | 0 | 84 |
| +20° | +28.729692 | 78.934180 |
| +40° | +53.994159 | 64.347733 |

Each scheduled shot consumes one draw from an encounter-owned seeded generator,
`randomForWave(encounterSeed ^ 0x44494133, encounterWave)`. The selected index is
`floor(random() * blackDiamondAnglesDegrees.length)`, giving each direction a
20% chance. Selection is with replacement: consecutive shots can share an angle,
and there is no fixed cycle. This separate stream preserves all other encounter
randomness and makes the shot sequence reproducible for the same seed and wave.
The previous five-shot fan and its horizontal spawn offsets have been removed.

Speed, damage, direction choices, and projectile count do not change with growth
or Mubarak's horizontal facing. The shot spawns below the carpet and above the
normal player lane. Growth changes only the existing interval and emitter
transform. There is no additional scheduler.

Diamonds are removed after their whole canvas leaves any world edge; they
do not turn back into play. A miss continues past player Y without landing or
area damage and is removed once its full canvas leaves the world. Collision uses
the existing projectile rectangle against the player body in 1000/120 ms fixed
steps. Only `fireBlack` sets `contactOnly`; legacy Act II `dropBlack`/mixed-burst
fragments retain their original landing explosions and damage. Neither diamonds
nor CZ effects alter player damage protections.

Drops occur only in active `act3`. CZ's second hit clears flights and impacts;
escape and collapse cannot spawn or damage through them. Misses clean up at the
world boundaries. Restart, Game Over, and shutdown clear the entire separate
owner. Only the single direction-selection draw is introduced per attack; no callbacks
or timer events are added.

## Verification and playtest limits

`tests/mubarak-act3-layering-browser.cjs` compares actual Canvas/WebGL rendered
pixels with each boss rendered alone, checking opaque coverage and transparent
pass-through across all CZ frames, both directions, and 100/124/148% growth. It
also checks separated visibility, display-list ordering, opaque/swept shield
priority, transparent paths to CZ, stable 9/10/12/13 depths, red flash and 150%
explosions, coins/diamonds, escape, and complete collapse.

`tests/mubarak-act3-collision-browser.cjs` verifies all six CZ PNGs against
independent alpha samples and full-beam/sweep scans, faint edges at the 16
threshold, transparent corners, clothing/camel/glass/rocket/flame contacts, scale,
origin, flips, immunity consumption, escape, and cached reads. It also checks
contact-only Act III damage, no blast/area damage, near misses crossing player Y,
offscreen removal, no damage after removal, scene damage protections, and
preserved Act II landing explosions in Canvas and WebGL with both seeds.

`tests/mubarak-act3-browser.cjs` exercises the real Phaser scene in Canvas and
WebGL with both seeded entrance directions. It enters through real Act I diamond
hits and Act II barrel explosions, then checks lanes, speeds, repeated exposure,
facing, shield consumption, swept shots, immunity, both damage textures, escape
through both edges, completion timing, next wave, pause, and cleanup. The existing
barrel and boss-schedule suites now expect Act III and the final collapse before
completion. The movement suite disables pumping only within its isolated fixture.
`tests/mubarak-bnb-browser.cjs` separately checks real Act I/II entry, the 3-second
schedule, aimed motion and cap, interception and shield ordering, one pump per
coin, additive growth and boundaries, max-scale exposure, Frame 2 pumping,
Frame 3 cleanup, zero/three/six-pump collapses, completion timing, and lifecycle.
`tests/mubarak-act3-refinement-browser.cjs` verifies half-size lanes, red pulses
and immunity boundaries, continued pumping, visible red escape, actual alpha
against an independent integral-image oracle at 100/124/148%, both source
facings and explicit flips/origins, transparent pass-through and beam-edge hits,
black-diamond tiers, real player damage, and cleanup.
`tests/mubarak-act3-polish-browser.cjs` checks normal invader effect reuse and
150% display size, directional cockpit position, depth, stationary impact
coordinates, real animation completion and audio gain, rejection during immunity,
unchanged escape, one shot per attack with fresh random selection, all five
normalized direction velocities, repeated choices and seeded replay, all frequency
tiers and scale/facing emitters, diagonal damage, edge cleanup, and lifecycle.

Passed verification: `npx tsc --noEmit`, `npm run build`, the polish, refinement, BNB pump/dump, Act III,
Act I, barrel, shrapnel, and boss-schedule browser suites, `tests/wave-director.cjs`,
and `git diff --check`. Canvas and WebGL screenshots were inspected for
lane spacing and visibility. The six packaged CZ PNGs are byte-identical to their
source files. The packaged BNB coin is also byte-identical to its approved source.
The 30-second maximum-growth fixtures verify that the 148% cap does not
permanently block CZ. These are mechanical checks, not final difficulty tuning.

Speeds, lane heights, BNB collision rectangles, and the initial coincident X are
starting points for in-game tuning. Headless tests verify mechanics and bounds;
they do not establish a final difficulty or guarantee a comfortable exposure
window for every player position. Do not adjust earlier acts or Wave Director
parameters as part of that tuning.
