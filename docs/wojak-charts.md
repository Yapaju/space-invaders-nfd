# Wojak monitor charts

`src/interface/wojak-charts.ts` owns one shared, damage-driven OHLC history.
Both monitors draw the same candles and animation fraction; there are no
independent per-monitor random streams. No combat behavior or spaceship art is
changed by the organic price-action revision.

## Approved pump and rendering

The original four green candles are preserved exactly: price 10 rises by
14, 20, 30, and 46 to 120, with the same OHLC values, widths, wicks, positions,
and scale. The pump remains unchanged from +50% through +25%. Its final edge
occupies 41.4% of the glass, leaving most of the right side empty.

Monitor-local body width remains 5.8%, wick width 1.3%, and slot pitch 7.5%.
Spacing on the chart remains uniform like a financial chart's time axis;
damage intervals, body sizes, and wick lengths vary procedurally. Eleven full
slots fit before scrolling; older candles remain until clipping removes them.
There is no stretching or visible-range fitting. The immutable vertical mapping
is `y = 0.80 - price * 0.006`.

Bodies now use the actual open/close extent and wicks the actual high/low.
The former minimum-body-height floor was removed because it made unequal small
candles look identical and would exaggerate final near-zero candles. Early
selloffs and crashes remain readable rectangular bodies; the final candles
intentionally become tiny and lifeless. No grid, labels, or glow was added.

Monitor homographies, glass clips, source-art registration, layer depth 2.5,
and directional transforms are unchanged. Charts remain above the rear hull,
below Wojak and the foreground hull, and follow the ship's movement and scale.

## Seeded progression

A lightweight xorshift32 generator (fixed default seed, optional constructor
seed) plans a bounded history once per encounter. The plan stays private until
the actual portfolio crosses its damage milestones. No elapsed-time candles
are generated. Different shot batching, upward portfolio fluctuations, and
repeated values cannot change already-published history or duplicate events.

- +25% to 0%: irregular damage groups, initial weakness, a brief green recovery,
  varied selling pressure, and a short consolidation candle. Price ends at 106.
- 0% to -30%: more varied red candles than greens, a small rebound, and declining
  phase highs/lows. Price reaches 94 just before the -30% crash drops it to 76.
- -30% to -70%: renewed selling mixed with a seeded rebound and several short
  consolidation bodies. Price reaches 50 before the -70% crash drops it to 14.
- -70% to -99.9%: a decaying price envelope, irregular damage groups, weak green
  recovery attempts, and progressively smaller absolute bodies/wicks. The final
  fractional milestone closes exactly at zero.

Phase red-body weights, quiet-candle placements, recovery sizes, and upper/lower
wicks are sampled from the seeded stream. Remaining selling pressure is balanced
to each phase endpoint, so randomness cannot move the major price anchors.
The -30% and -70% bodies retain their 18-unit and 36-unit drops. They trigger once
and form over 240ms; ordinary candles retain 110ms formation. Idle time may finish
queued formation, but never creates new candles. The default path has 26 candles,
including the four approved initial greens; seed variants remain bounded.

REKT settles pending damage to the final zero endpoint and freezes the history.
Existing lights-off behavior, character art, static 1000ms hold, weapons cleanup,
removal, and progression are preserved.

## Validation

- `node tests/wojak-charts.cjs`: 100 seeded paths; unchanged pump; valid finite
  OHLC values and continuous opens; red-majority phases with green recoveries;
  varied wicks and damage intervals; anchored prices; shrinking late recoveries;
  exact fractional zero endpoint; shot batching equivalence; one-time animated
  crashes; freeze; both projection transforms; every rendered vertex clipped.
- `node tests/wojak-candles.cjs`
- `node tests/endless-waves.cjs`
- `node tests/ponke-explosion.cjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run build`

Optional actual-game browser test:
`node tests/wojak-charts-browser.cjs <absolute screenshot directory>`.
Requires Chrome and Playwright (an external package directory may be supplied
with `NODE_PATH`). The real source modules are compiled in memory and loaded
with MainScene and its actual assets. All requests are fulfilled from local
files without network access. No production source or encounter-start flag is
modified. Forty unscaled 800x600 captures cover +50%, +25%, 0%, -15%, -30%,
-50%, -70%, -85%, -99.9%, and REKT, both orientations, Canvas and WebGL.
The test checks identical histories across renderers/orientations, zero close,
movement registration, REKT freeze/lights, and exact 1000ms removal. The active
-99.9% screenshot is staged, since combat immediately enters REKT at that value;
the REKT capture follows accepted hits and the real defeat behavior.

The +50% whole-ship crops also match the preceding approved version pixel for
pixel, in both orientations and both renderers. Actual-scale comparison sheets
were inspected for every requested portfolio stage. The near-zero candles are
intentionally subpixel in height; wide body footprints and the preceding crash
retain the visible history without artificially magnifying a lifeless market.
