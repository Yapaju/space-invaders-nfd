# Wojak candles and tears

The first Wojak weapon activates at +25%. All settings, asset registration,
probabilities, and patterns live in `src/interface/wojak-candles.ts`. Independent
tear settings live in `src/interface/wojak-tears.ts`. Source-art registrations
for ship bounds, the hull underside, and face emitters live in
`WojakWeaponRegistration` in `src/interface/wojak-boss.ts`.

| Portfolio | Pattern interval | Sizes 1–5 (%) | Single / gap / rain (%) |
| --- | --- | --- | --- |
| Above +25% | Disabled | — | — |
| +25% to above 0% | 1500 ms | 50 / 35 / 15 / 0 / 0 | 100 / 0 / 0 |
| 0% to above −30% | 1200 ms | 30 / 25 / 20 / 15 / 10 | 65 / 20 / 15 |
| −30% to above −70% | 1000 ms | 15 / 20 / 25 / 25 / 15 | 45 / 30 / 25 |
| −70% through −99.9% | 800 ms | 5 / 10 / 20 / 30 / 35 | 30 / 35 / 35 |

All five original PNGs use scale 0.32 and fall at 160 px/s. Player movement is
200 px/s. Sprite dimensions are 51.2 pixels wide and 45.44 / 56.96 / 71.04 /
97.6 / 128 pixels high. Contact rectangles cover the solid red bodies, excluding
glow, padding, and thin wicks. Swept vertical collision checks prevent tunneling.
Candles use the existing player damage path and disappear on contact. The
existing game has no damage invulnerability window; visual hit feedback alone
does not grant immunity. Player shots pass through candles.

Each pattern samples sizes independently. Rain drops appear at 0, 250, and
500 ms. Phase changes reset the next pattern interval while preserving pending
rain sizes and relative positions. Scheduling uses update deltas without timer callbacks. Frames longer than
250 ms are discarded for this weapon, so suspension cannot accumulate attacks.
Boss completion, removal, GAME OVER, restart, and scene shutdown clear both
pending drops and flying candles.

Candles release within the spaceship's current rendered width. Source-art alpha
bounds are X=[11,1528) for right-facing ships and [8,1525) for left-facing ships.
World positions use the existing sprite origin, scale, and position; the character
art is not used for ship bounds. Y=900 on the ship source canvas marks the solid
hull underside, above engine flames. The visible candle top (source Y=14) is
placed 4px below that underside, so transparent padding never changes the release
height. Original PNGs are unchanged.

Gap volleys leave at least 120px between full image edges (or the player body
width plus 48px, whichever is larger). Rain alternates sides with randomized relative
positions, resolving each pending drop against the ship's current bounds when
it releases. Once released, candles keep a fixed world X. Narrow patterns fall
back to a single drop; impossible placements are skipped. Spawns leave at least
500ms before the full sprite reaches the player's body. Sampling never aims at
the player. Full images remain within both the ship width and playfield bounds.

Tears start at exactly -30%: one aimed tear every 3500ms. At exactly -70%, the
schedule resets to a simultaneous three-tear spread every 2500ms, with offsets
-15°, 0°, and +15°. These schedules do not modify candle timing. Tears reuse
PEPE's `physics.moveToObject` aiming at firing time and its 120px/s speed; no
later player or boss movement changes their velocity. Arcade overlap feeds the
same player damage path, with a tight circular body on the solid droplet bulb.
No invulnerability mechanics were added or changed.

The exact `weapons/wojak-tear/wojak-tear.png` asset has a 1536x1024 canvas.
Uniform scale 32/1120 gives approximately 32px of visible projectile length
(43.89x29.26px padded canvas before rotation). Its origin is the source bulb
center (650,650), and the point is near (1240,150). A fixed rotation compensates
for that diagonal so the point always faces screen-up and the bulb faces down,
independent of velocity. The source collision radius is 250 (about 7.14px in game), excluding
transparent padding and keeping contact forgiving at the narrow point.

Face coordinates are registered per pose and direction. Masked Wojak releases
from the exposed crying cheek at (805,260) right / (731,260) left; unmasked Wojak
uses (850,260) right / (686,260) left. The current character offsets and scale are
applied using the same source-to-world transform as the artwork. Tears are drawn
above the face layers and have at least 500ms clearance from the player at spawn.
Offscreen tears, both weapons on defeat/removal, and pending attacks on encounter
cleanup are removed. Both systems discard suspended timer deltas.

Browser testing should evaluate face alignment, release height, and combined
attack difficulty. The old permanent screen-wide safe corridor is removed;
gap volleys retain their own passage, while overlapping patterns and tears can
require moving away from directly beneath the ship. No global pathfinding
guarantee is provided. Existing combat artwork, lighting, patrol, and percentage
damage remain in place. At -99.9%, both weapons and pending rain are cleared immediately.
The boss switches to its directional REKT character artwork, hides the lighting
overlay, clears any remaining milestone tint, and replaces the existing display
text with `REKT` without its phase glow. The entire ship stays at its final
position/orientation for exactly 1000ms, then all layers are removed and the
existing progression signal fires once. `beginDefeat()` and the Complete update
branch isolate this temporary ending for later extension.

Run `node node_modules/typescript/bin/tsc --noEmit`,
`node tests/wojak-candles.cjs`, `node tests/endless-waves.cjs`,
`node tests/ponke-explosion.cjs`, and `npm run build` for validation.
The build copies the candle and tear PNGs into their matching `dist/assets/weapons/` folders.
For browser testing, use the existing Wave 1 encounter trigger or the development
shortcut described in `docs/wojak-prototype.md`.
