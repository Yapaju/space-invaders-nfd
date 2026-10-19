# Default 2x rendering and baseline comparison

Supported WebGL devices now use a fixed 1600 x 1200 backing buffer by default.
Append `?renderBuffer=1` to the game URL (or `&renderBuffer=1` if it already has
a query) and reload to restore the original 800 x 600 rendering for comparison
or lower GPU cost. Remove the parameter and reload to restore 2x rendering.
The previous explicit `?renderBuffer=2` URL also works. There is no persistent
preference or artwork change. The logical game world is always 800 x 600.

## Implementation and limits

- `src/interface/render-buffer-experiment.ts` installs two renderer wrappers at
  post-boot. Only the drawing-buffer dimensions, GL viewport, and GL scissor
  calls use physical pixels. Phaser's scale sizes, renderer projection, cameras,
  input mapping and physics remain in 800 x 600 logical coordinates.
- `src/game.ts` registers the post-boot callback.
- `score-manager.ts` and `rapid-fire.ts` now read logical dimensions from
  `scene.scale.gameSize`, rather than using the physical canvas for UI placement.
  Their baseline values and displayed sizes are unchanged.
- No texture preprocessing or source artwork is changed. Player textures remain
  335 x 320; PONKE textures remain 337 x 282; PEPE remains 337 x 282. Elon and
  normal HUD images still use their original textures. Linear filtering remains.
- This is a narrow adapter for the current Phaser 3.22 main-framebuffer WebGL
  pipeline. The game currently has no render-to-texture cameras or postprocessing
  framebuffers. Do not treat it as general-purpose Phaser high-DPI support.
- Canvas fallback stays at 800 x 600 even when the parameter is present.
- If 1600 x 1200 exceeds the device's reported maximum viewport or renderbuffer
  dimensions, the adapter leaves the original 800 x 600 rendering in place.
  There is no automatic FPS-based quality switching; lower-powered devices can
  use `?renderBuffer=1` if 2x rendering costs too much GPU time or power.
- The multiplier is fixed at 2, not automatically multiplied by devicePixelRatio.
  At DPR 2 and a 1440 x 1080 CSS game area, it still undersamples the physical
  display. It deliberately bounds the experiment's cost.
- Phaser 3.22 fixes ScaleManager.resolution at 1 with an input warning, so this
  experiment does not change that setting or upgrade dependencies.

## Controlled comparison

Run `node tests/render-buffer-browser.cjs <absolute-output-directory>` with
Playwright and installed Chrome available. NODE_PATH can point to an existing
Playwright installation; no new project dependency is required.

The test serves the real page and transpiled game sources. It creates identical
paused scenes with the Gundam player, alternating PONKE/PEPE, Elon, and the HUD.
These are the game's two standard invader types. It compares baseline and 2x at
the same 1920 x 1080 viewport, separately at DPR 1 and DPR 2. Both modes display
at 1440 x 1080 CSS pixels. Screenshots and measurements.json go to the supplied
output directory.

A diagnostic-only 4x render (3200 x 2400) is enabled by substituting the constant
in the test page in memory. Production uses 2x by default or the explicit 1x
override; the 4x reference is not a production mode. Regional RGB
RMSE is measured against the displayed 4x reference, using identical prepared
textures. It measures framebuffer sampling error, not source-art fidelity or
perceived quality. It includes pixels within each object's rectangular region.

Measured on 2026-10-19, Chrome/ANGLE, Intel Arc Graphics / Direct3D 11:

| Region | Error reduction, DPR 1 | Error reduction, DPR 2 |
| --- | ---: | ---: |
| Player | 47.2% | 45.9% |
| PONKE | 56.7% | 55.2% |
| PEPE | 56.7% | 58.9% |
| Elon ally | 38.4% | 38.7% |
| Score label and digits | 43.1% | 43.1% |
| Lives label and icons | 35.9% | 34.8% |

Visually, the enlarged pixel grid and stepped outlines are substantially reduced
throughout the scene. HUD contours and invader faces are much cleaner. The player
and life icons improve too, although their dense small details remain constrained.

## Performance

The benchmark warms the renderer, measures 120 submission calls, then measures
40 completed rendering calls with a one-pixel readback after each. Readback
forces synchronization, avoiding misleading sub-0.1 ms command-queuing timings.
These are static-scene render benchmarks, not whole-game FPS or pure GPU timings.

| Mode | DPR 1 synchronized median / p95 | DPR 2 synchronized median / p95 |
| --- | ---: | ---: |
| Baseline | 1.1 / 1.8 ms | 1.1 / 2.7 ms |
| 2x | 2.2 / 2.9 ms | 1.9 / 2.8 ms |
| 4x diagnostic reference | 5.9 / 7.0 ms | 5.7 / 6.3 ms |

Submission p95 was 0.1-0.2 ms, near the browser timer's resolution. The 2x buffer
contains four times as many pixels (1.92 million vs 0.48 million). A single RGBA8
color buffer is approximately 7.68 MB vs 1.92 MB, excluding MSAA, depth/stencil,
browser/compositor buffers and textures. We did not measure total GPU memory.
Results from this GPU should not be interpreted as a performance guarantee for
other devices or as an FPS estimate.

## Validation and interpretation

Passed build and TypeScript checks; endless-waves, candle, chart and baseline
responsive browser regressions; and the new A/B checks. The A/B test checks exact
scene geometry and physics-body equality, camera/world/scale dimensions, pointer
mapping, movement/shooting, HUD placement, resizing, no scrollbars, REKT/PUMP IT/
God Candle geometry and timing, offscreen exit, restart and one-shot wave progress.
It also checks the unchanged Canvas fallback and the default/explicit 1x paths.
Test scene mocks now supply logical
scale dimensions independently of their canvas dimensions.

The clear gains with unchanged texture inputs confirm a significant framebuffer
limitation. Remaining player/PONKE quality limitations can still come from their
cached downsampled textures and small artwork features. This experiment cannot
recover detail discarded during that preprocessing. PEPE's source is already
337 x 282; high-DPI rendering cannot create new source detail either.

Assessment: the local visual review and gameplay trial confirmed that this is a
useful overall clarity improvement and gameplay remains smooth. It is now the
WebGL default, with the explicit 1x fallback retained. It is not a complete
high-DPI or texture-quality solution. No artwork redesign, preprocessing changes,
commits or pushes are part of this change.

## Finalization review, 2026-10-19

The existing working tree already selected 2x by default. Finalization retained
that narrow adapter and added pointer checks at all four logical corners, the
center and an off-center point at each tested viewport and DPR, plus a 1x
override alongside another query parameter. No gameplay code was changed.

Fresh validation results:

- `npm run build` and `tsc --noEmit`: passed. A temporary external preload
  skipped byte-identical PNG copies and rejected any other PNG copy so the
  existing build could run without replacing artwork.
- `endless-waves.cjs`, `ponke-explosion.cjs`, `wojak-candles.cjs` and
  `wojak-charts.cjs`: passed.
- `responsive-layout-browser.cjs`: passed all seven viewport sizes, portrait
  and landscape layout, logical input mapping and keyboard movement/shooting.
- `render-buffer-browser.cjs`: passed default 2x, explicit 1x/2x, DPR 1/2,
  exact A/B scene and body geometry, camera/world sizes, input, resizing,
  boss sequence, restart, wave progress, Canvas and simulated device limits.
- `wojak-defeat-browser.cjs`: passed Canvas/WebGL, both orientations, full
  defeat timeline and cancellation/restart checks.
- `wojak-charts-browser.cjs`: failed at its old `defeat cleanup` assertion,
  which expects completion at 2600ms. The unchanged boss sequence now completes
  at 6150ms. This test creates its own game without the render-buffer adapter;
  its outdated timing assertion was left unchanged. Chart unit tests and the
  current defeat browser regression passed.
- All 189 PNG files under `assets` and `dist` retained identical paths and
  SHA-256 hashes, including original Pepe/Gundam artwork and pre-existing
  untracked Pepe variants. No PNG was added, rewritten or removed by this run.

This run's synchronized static-render median / p95 was 1.1 / 1.7ms at 1x and
2.4 / 3.4ms at 2x for DPR 1; 1.8 / 2.3ms at 1x and 2.9 / 4.0ms at 2x for
DPR 2. Other regression processes were running concurrently, so these are
indicative local measurements, not an isolated benchmark or whole-game FPS.
Only Chrome/ANGLE on the local Intel Arc GPU was exercised; lower-powered
hardware and other browser/GPU combinations remain unmeasured. Four times the
pixel count can increase GPU work, memory use, power consumption and heat.
Reported viewport/renderbuffer limits trigger 1x fallback, but do not predict
frame rate. Use `?renderBuffer=1` on devices where 2x is too costly.

The adapter remains specific to Phaser 3.22's main framebuffer. Revalidate it
when changing Phaser or adding render-to-texture cameras/postprocessing.
To revert the rendering default at runtime, use the explicit 1x query override;
to remove the adapter, remove its import and post-boot callback in `src/game.ts`.
No commits or pushes were made.
