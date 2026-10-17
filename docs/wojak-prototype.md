# Wojak prototype (v0.11)

The temporary testing configuration inserts Wojak after clearing Wave 1, before Wave 2.
`WOJAK_TRIGGER_AFTER_WAVE` in `src/interface/wojak-boss.ts` is the single trigger
setting: currently `1`, with intended production value `10`. Wojak appears once per run.
The existing transition waits for player missiles to leave naturally. The HUD
stays on Wave 1 until the encounter ends; Wave 2 then starts normally and
grants its usual capped one-life recovery exactly once.

## Development shortcut

1. In `src/interface/wojak-boss.ts`, set
   `WojakDevelopment.startAtEncounter` to `true`.
2. Run `npm run dev` and open the local URL printed by Rollup.
3. A fresh game enters the encounter with the HUD on the configured trigger wave and three lives.

The flag defaults to `false`. The production build replaces `__NFD_DEV__` with
`false`, so the shortcut is disabled in production even if the flag is enabled.
Restore the flag to `false` after testing. GAME OVER → restart returns to Wave 1.

## Starting settings

- Full +50% image: 337.92 × 225.28 display pixels (uniform scale 0.22).
- Registered +40% image: 336.49 × 224.33; +25% image: 334.60 × 223.07.
  The registered chassis width stays 310.2 pixels across all three poses.
- Front-panel anchor: Y=255; horizontal patrol anchor: X=205–595.
- Speed: 55 px/s; hover: ±7 px at 0.5 Hz.
- Entrance: 1,500 ms smooth descent; +25% completion hold: 1,250 ms.
- Collision rectangle: 270 × 82 world pixels, centered on the main hull panel.

Each supplied PNG keeps its original aspect ratio and orientation. Per-image
front-panel anchors and chassis-width registration compensate for padding and
ship-geometry differences without cropping or editing the artwork.

During entrance and the final hold, shooting is disabled and rapid fire freezes
through its existing shooting-state gate. Patrol enables normal and boosted
shots. Exactly 25 projectile hits reach +25%; no boss attacks, death effect,
score reward, or additional life bonus is implemented.

## Manual playtesting

Check the entrance and HUD clearance, apparent ship/head alignment at +40% and
+25%, hull hit coverage, reversals and bobbing, and the final-state hold. Try
normal and boosted shots, ensure rapid-fire ring/digits freeze during entrance
and completion, then check Wave 2's normal 24-PEPE formation, Wave 3's PONKE
formation, life recovery, and the absence of any second boss appearance.
Also test GAME OVER/restart during the encounter. Automated tests do not confirm
the subjective visual alignment of these independently drawn images.
