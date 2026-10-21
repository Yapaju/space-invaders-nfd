# NFD Flex Card V1

The Game Over screen keeps its original artwork, position, scale and restart
instruction. A centered `ENTER FOR FLEX CARD` line uses the existing golden
alphabet PNGs and their original painted highlights and shadows. Its visible
letter height is approximately 58% of the restart instruction. Its top is at
the restart artwork's bottom plus `12 * gameOverImage.scaleX + 18` game pixels;
the extra 18px separates the instructions without moving the original artwork.
Space restarts; Enter opens a preview without downloading anything.

## Run results and counting

`MainScene._gameOver()` freezes a snapshot of the current `wave`,
`scoreManager.score` and `invadersKilled`. Repeated Game Over calls preserve that
snapshot. The actual current wave is used, including during its full boss
encounter. The upcoming-wave announcement does not change the recorded wave.

`invadersKilled` starts at zero and resets in `restart()`. It increments directly
after `alien.kill()` in `_bulletHitAliens`, after existing active-entity and
Premium defeat checks. A regular invader counts once; a Premium counts once on
its final accepted hit. Earlier damage, immunity hits, duplicate callbacks,
projectiles, explosions, formation cleanup and Elon ally hits do not count.
Disabling the defeated alien immediately prevents duplicate counting before
deferred destruction runs. Preview open/close never resets any run values.

Full Boss Wojak is **excluded** from Invaders Killed. It has a separate lifecycle
and reports completion after its defeat cinematic in `WojakBoss.update()`;
`MainScene.update()` uses that completion for progression and Premium unlocks.
V1 leaves this behavior and boss scoring untouched. A future design decision can
add a separate boss statistic if desired. No Wave Director rules, formulas,
configuration, scheduling or historical documentation were changed.

## Rendering and export

- `src/interface/flex-card-renderer.ts`: immutable result interface, Canvas 2D
  renderer, shared URL, PNG serialization and download helper.
- `src/interface/flex-card-preview.ts`: accessible DOM dialog, four circular
  icon controls, native sharing and fallbacks, focus containment, keyboard
  isolation, Escape, loading/error feedback
  and lifecycle cleanup.
- `src/interface/flex-card-instruction.ts`: shared `composeNfdLettering()` image-row
  compositor and `nfdInkBounds()` measurement; also builds the unchanged Game Over
  instruction from existing golden alphabet assets.
- `src/interface/manager/score-manager.ts`: positions and shows/hides the new line.
- `src/scenes/main.ts`: captures results, counts defeats and binds Enter/Space.
- `scripts/copy-meme-skins.js`: packages the background, Wave frame, five button
  PNGs and required alphabet letters for both builds; excludes reference mockups.
- `tests/flex-card-browser.cjs`: real Phaser/Chrome integration and PNG tests.

The offscreen canvas uses the background's native dimensions: **1672 × 941**.
The approved `assets/flex-card/flex-card-background-v1.png` is drawn at (0, 0)
without resizing, cropping, recoloring or redrawing. The mockup is never loaded
by game code. The background and available local fonts finish loading before
statistics render. No externally hosted fonts or new runtime packages are used.

Wave now uses the unmodified `assets/flex-card/flex-card-frame.png` (1939 × 811).
The entire transparent image is drawn at a fixed width of 360 native card pixels
and height `811 * 360 / 1939` (about 150.57), with uniform scale `360 / 1939`.
The visible blue-edge reference near source (100,110) remains anchored at
(75,206.91); the complete image, including its margins/glow, starts about
(56.43,186.49). There are no additional Canvas borders, fills or shadows.
The same frame size/position is used for every wave. The frame mockup is
reference-only and is neither loaded nor packaged.

Wave text uses `assets/texts/nfd-hud-wave.png` and the game's existing
`assets/font/nfd-font-<digit>.png` images. `drawFlexWave()` composes the full label
and digits at a common 380px source height, retaining their aspect ratios. The
space after WAVE is `380 * 20 / 96`, and digit gaps are `380 * 4 / 96`, matching
the game's Wave announcement spacing proportions. The complete row's painted
bounds (alpha >= 16) are measured once; the whole row is centered without any
individual character corrections. The lettering layer is centered at source
(971,402.5), mapped through the frame scale, independently of the frame image.
The measured solid outer blue border spans source x=134–1808 and y=144–661,
excluding transparent margins and diffuse glow. A single centered lettering
container insets this rectangle by 10% horizontally on each side (above the 6%
minimum) and 20% vertically. Its maximum width is about 248.64 native card pixels
and maximum height about 57.59. The mockup's inscriptions occupy roughly 75–80%
of their visible frame widths; this container uses 80%. Compared with the earlier
302.4px width limit, the Wave 1/17/100 inscriptions are about 17.8% smaller.
Every wave uses the same uniform fit rule:
`scale = min(targetHeight / inkHeight, maxWidth / inkWidth)`.
The inner border does not constrain or clip the lettering; slight overlap is
allowed, while the visible outer border always retains horizontal clearance.
Single-, double- and triple-digit waves use the same original artwork and
proportional-fit algorithm; wider inscriptions can have a smaller final height.
No lettering is clipped or stretched. The PNG artwork supplies all Wave
highlights and shadows. Wave rows now reuse `composeNfdLettering()` and
`nfdInkBounds()` alongside the kill label and Game Over lettering.

The green score, golden Invaders Killed label and silver/white count retain
their approved x=75 alignment and vertical coordinates. To keep those positions
independent of the PNG's dimensions, the score still uses the former generic
Wave metric's height plus 24px padding, added to frame top 209 and gap 22.
The label's former position (score's measured bottom plus 24px, minimum
y=518) is shifted up by 11px, placing it 24 native pixels below the previous
layout's 35px upward shift. The count moves with it and retains its
5px legacy measured gap below the label's reserved box. The label now uses the
original gold `assets/font/nfd-font-<letter>.png` artwork for I, N, V, A, D, E,
R, S, K and L; all required letters exist. `drawFlexKillLabel()` composes the
13 letters and one 36%-height word space through `composeNfdLettering()`, then
measures the full painted bounds and uniformly fits the row into the former
label box. It preserves x=75 and uses the former 43px label metrics only for
the approved width/height and top inset, never for drawing the inscription.
All gold highlights, outlines and shadows come from the glyph PNGs. There is no
fallback font. Build packaging includes the additional I/V/S/K glyphs.
The count retains its 144px size, 465px maximum width, position, outlines and
shadows, with `SilverPalette`: `#ffffff`, `#e1f2ff`, `#a7c8de`, `#779bb4`.
The score is limited to 730px and its glow is clipped before the right-side
artwork; the kill number is limited to 465px.
Numbers use explicit `en-US` thousands separators. Large values fit horizontally
within their allotted region, including large wave and kill counts. Extremely
long numbers become compressed rather than covering the player artwork.

Score and kill-count typography use a heavy local Arial Black/Arial/sans-serif
stack and Canvas gradients, strokes and shadows. This approximates the approved mockup rather
than reproducing its illustrated letter shapes exactly; system font fallback
can slightly change those shapes. The supplied background also differs from
the mockup's underlying illustration, and V1 preserves the supplied background.

The preview displays the generated canvas directly and reuses it while reopening
the same immutable run snapshot, preserving the exact raster and avoiding repeat
rendering. A different run snapshot creates a new card. Download serializes that
same canvas with `toBlob('image/png')` to
`NFD-Flex-Wave<WAVE>-Score<SCORE>.png`. Preview controls are DOM elements outside
the canvas, so they never appear in the export. No backend is involved.
The Download button adds no visible success message. Download failures are
logged to the console, and the button is re-enabled for retry. The reserved
status spacing is preserved so the four controls retain their placement.

The modal captures keyboard events before Phaser while retaining native button
activation and trapping Tab focus. Repeated held-key events cannot trigger
button actions, reopen the dialog, or restart the run. Enter's initiating
default action is suppressed so it cannot immediately activate the newly
focused CLOSE button. Restart is also guarded while the modal is open. Closing
or Escape restores the prior focus and the same Game Over screen, and resets
Phaser's key flags so a key released inside the dialog cannot remain stuck. An in-flight
render cannot insert its result into a closed/replaced dialog. Scene shutdown
removes the modal and its keyboard listeners.

Four 58px controls sit centered below the image with 16px gaps: Share, Download,
Website and Close. Each layers `flex-card-circle-button.png` beneath its
corresponding `flex-card-share.png`, `flex-card-download.png`,
`flex-card-website.png` or `flex-card-close.png` from `assets/flex-card/`.
All five source images are 512 × 512. Both layers fill the same 58px square
with `object-fit:contain`, preserving the entire artwork and glow with a shared
center and no individual offsets. CSS adds no background, border or shadow.
Hover scales the whole button uniformly to 1.04.
Each has a descriptive native hover tooltip and screen-reader label, plus hover
and visible keyboard-focus styling. Initial programmatic Close focus does not
show an extra ring: the `:focus-visible` outline is enabled by actual Tab
navigation and cleared by pointer interaction, leaving only the artwork's
circle in the normal state. The Website button opens
`https://space-invaders-nfd.vercel.app` in a new tab with `noopener,noreferrer`.

The PNG `File` is prepared after rendering so Share can call the native Web
Share API immediately from a user gesture. With `canShare({files})` support,
it shares that PNG, the game URL, and the actual wave/score challenge message.
If native sharing supports text/links only, those are shared and the UI states
explicitly that the PNG was not attached, downloads it separately and provides
selectable share text for manual use. Missing or failed native sharing uses the
same download/manual-copy fallback. Cancellation (`AbortError`) shows neutral
feedback without a fallback download. If download fails, the message retains
the selectable text and points to Download for retry. No message is posted
automatically and there is no external SDK or backend. Artwork/export errors
leave Close available and report the failure without resetting the run.
The implementation follows the documented [Web Share API activation, file
validation and cancellation behavior](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

## Static avatar limitation

The player avatar is baked into the approved background. V1 does not replace it.
A future skin-aware background/avatar compositor can be added before the
statistics drawing without changing result capture, preview controls or PNG
export. Neither the mockup nor its sample numbers is used as a runtime asset.

## Local review and verification

Run `npm run dev` and open `http://localhost:4201`. Finish a run, then press Enter
to preview. Exercise Share, Download, Website and Close; reopen with Enter
and restart with Space after closing. `npm run build` creates the production
bundle and copies required assets, without publishing it.

Run `node tests/flex-card-browser.cjs <absolute-output-directory>` with Playwright
available (an existing installation can be supplied through `NODE_PATH`). The
test starts a temporary localhost server, transpiles actual project modules in
memory and exposes fixtures only on that test page. It requires Chrome and
permission to access localhost/download files. Production has no test hooks.

The suite checks both Phaser WebGL and Canvas, real regular/Premium defeat
paths, full boss exclusion, immutable run results, Wave 17 / 128,450 / 386,
Wave 1 / zero values, maximum safe integer scores, right-side artwork pixel
preservation, native PNG dimensions, byte-identical preview/download PNGs,
filename, independent keys, reopening, guarded restart, focus wrapping, mobile
preview in portrait/landscape, four icon controls and safe external-link
arguments, native file/text sharing, unsupported/denied sharing, cancellation,
artwork load failure and browser errors. Native share tests inject browser API
fixtures to inspect actual file bytes and payloads; an operating-system share
sheet and delivery to real recipient apps are not automated.
It saves Game Over and preview screenshots plus the sample native-size PNG.

Additional regression checks: `node tests/wave-director.cjs`,
`node tests/premium-spawn.cjs`, `node tests/wave-director-browser.cjs <output>` and
`node tests/premium-wojak-browser.cjs <output>`. These preserve existing wave,
weapon, full boss and Premium combat coverage. Build/type checks use the
project's existing TypeScript/Rollup toolchain.

Verified locally on 2026-10-21: production build, the Flex Card suite in both
renderers, both unit suites above, and both existing browser regression suites
passed. Final visual correction checks cover measured and rasterized Wave
1/17/100 glyph centering and frame growth, preserved Wave/score coordinates,
the kill-block placement, aligned statistics and non-overlap, identical
normal button borders plus actual Tab/pointer focus behavior, mobile checks, native
sharing branches and an uncached missing-artwork failure. Download verification
used an actual local server outside the network sandbox, which otherwise blocks
Chrome's localhost access and can cancel browser downloads.
The final screenshot fixture is Wave 3 / Score 2,660 / 66 kills, saved as
`flex-card-wave3-final.png` (preview and controls) and
`flex-card-wave3-native.png` (full-resolution export) in the test output folder.

Custom button artwork verification on 2026-10-21: production build and the full
Flex Card browser suite passed in WebGL and Canvas. All five packaged PNGs
match their source bytes. Browser checks decode every button layer and verify
58px dimensions, common centers, 16px gaps, transparent CSS backgrounds, no CSS
borders/shadows or SVGs, and unchanged focus, actions and PNG export behavior.
Desktop and mobile screenshots were visually inspected. The supplied download
asset's filename typo (`flex-card-downlad.png`) was corrected to
`flex-card-download.png` without changing its contents.

Three visual adjustments verified on 2026-10-21: `npx tsc --noEmit`, production
build and the full Flex Card browser suite passed. Tests confirm the 24px
downward kill-section move, preserved label/count spacing, at least 20px
clearance above the tagline for the tested Wave 1/17/100 fixtures, and the 18px
downward Enter-instruction move with unchanged Game Over artwork placement and
instruction size/centering. Updated Game Over and Wave 3 preview screenshots
were visually inspected for spacing and the gold/black/blue panel treatment.

Final PNG frame/color update verified on 2026-10-21: TypeScript checks,
production build and the full Flex Card browser suite passed in WebGL and
Canvas. New checks cover Waves 2/17/100 using identical frame geometry and text
scale, proportional sizing, full-row centering and clearance, and source PNG
compositing without added decoration. Native-resolution renders for all three
waves and the updated preview were visually inspected. The packaged frame is
byte-identical to the source; the frame mockup is excluded. Existing preview/
download byte identity, share branches, buttons, Game Over placement and keyboard
behavior continue to pass. Prior screenshots confirm unchanged logo, right-side
artwork, tagline and URL pixels; the green score's sampled region differs only
by browser raster rounding (22 pixels changed by at most one channel level).

NFD typography correction verified on 2026-10-21: TypeScript checks, production
build and the full browser suite passed. Tests prohibit system-font drawing of
Wave/Invaders Killed, check label size and separation from score/count, and
verify maximal safe-area fitting and centering for Waves 2/17/100. Each requested
wave has an actual preview screenshot and a native PNG; a real button download
is byte-compared to each preview canvas. Shared-compositor regression coverage
also compares the Game Over instruction texture against its previous drawing
algorithm byte-for-byte. All required glyphs were present, and no source
artwork, frame geometry, approved stats coordinates, buttons or actions changed.

