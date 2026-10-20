# Popcat invader

Waves retain the Popcat -> Pepe -> PONKE rotation. Existing formation movement,
difficulty, rendering scale and collision geometry are unchanged. See
[Popcat weapons](popcat-weapons.md) for the current arc and firing-position rules.

Both closed/open mouth poses and both facings use the original PNG artwork,
fitted unmodified into the existing 337x282 canvas. A launched attack opens that
invader's mouth for 180ms. Rejected edge shots leave the mouth closed. Facing
changes work during a mouth animation, and each invader closes independently.

Experimental bucket lights are disabled. No light cache is generated and no light
phase is updated; sprites select their original static textures directly.
`popcat-lights.ts` retains the experimental definitions for future use, but its
preparation/brightness helpers are not called. No artwork or animation asset is
deleted. Bucket, rings, lights, head and flame retain their original appearance.

`tests/popcat-browser.cjs` verifies all four runtime poses pixel-for-pixel against
an unmodified fit of the original source PNG, checks that no experimental light
textures exist, tests mouth/geometry/direction behavior and 31 wave rotations,
and exports four-pose and formation previews. `tests/endless-waves.cjs` also checks
static textures at the former blink boundaries and during facing reversals.
