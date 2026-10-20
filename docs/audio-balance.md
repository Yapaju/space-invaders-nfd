# Gameplay audio balance

All runtime tuning lives in `src/interface/audio-balance.ts`. The existing Phaser
sound manager, local asset loader, master volume (default 0.5), mute, and Popcat's
shared two-voice pool are preserved. No recordings or gameplay were changed.

## Calibration

`tests/audio-levels-browser.cjs` decodes the actual bundled WAV/MP3 files in
Chromium, renders them at 48 kHz, applies BS.1770 K-weighting, and measures the
maximum energy in a common 400 ms window. Short sounds include silence in that
window. These are **ungated event loudness values**, not integrated programme
LUFS: the 72 ms pop is too short for a useful gated programme comparison. The
mono sounds are rendered to the same stereo output, including both channels in
the energy sum. Giant popcorn is measured at its actual 0.85 playback rate.

| Effect | Previous gain | New gain | Previous event level | New event level |
| --- | ---: | ---: | ---: | ---: |
| Laser (normal and rapid) | 1 | 0.093 | -3.41 | -24.04 |
| Player explosion | 1 | 0.082 | -2.27 | -24.00 |
| Invader death | 1 | 0.069 | -0.75 | -23.98 |
| Popcat mouth | 0.45 | 0.66 | -27.36 | -24.03 |
| Giant transformation (0.85 rate) | 0.60 | 0.625 | -24.34 | -23.99 |

Levels are dB on the comparison metric, before master volume and output trim.
The maximum difference is 0.063 dB. This is a repeatable starting balance;
perceived loudness also depends on speakers, masking, duration and listener.
There are no additional gameplay recordings: explosions drawn for other enemy
attacks do not introduce another sound asset.

## Mix headroom

For the normal Web Audio backend, Phaser's existing master mute/volume output
feeds a compressor (threshold -6 dB, ratio 20:1, zero knee/attack, 80 ms release)
followed by a fixed 0.8 output trim (-1.94 dB). The trim accounts for compressor
transient overshoot; the compressor is not claimed to be a brick-wall limiter.
Individual effects generally stay below its threshold. At the default master
volume, the solo baseline is approximately -31.96 on the event metric.

The graph is installed once per sound manager, survives scene restarts, and is
disconnected when the game is destroyed. No replacement AudioContext is made.
HTML5 Audio fallback retains the same calibrated individual gains and existing
mute/volume behavior; its native element outputs cannot use this Web Audio bus.
The extreme mix headroom measurements therefore apply to Web Audio.

The offline browser stress test overlaps 55 invader deaths, ten shots, one
player explosion and two pops (68 voices, more than an ordinary encounter).
Measured output sample peaks: 0.863 at full master, 0.779 at default 0.5, 0.685
at 0.2, and exactly zero at zero master. This checks a deliberately difficult
coherent mix; it does not guarantee every arbitrary future asset/mix is safe.

## Verification

- `node tests/audio-levels-browser.cjs [output.json]` measures actual assets,
  checks calibrated loudness spread, overlapping output, zero volume, and
  idempotent installation.
- `node tests/popcat-audio-browser.cjs <output-directory>` checks real Web Audio
  and HTML5 playback, actual attack/transform events, both facings, cancellation,
  concurrency, mute/unmute, volume, gesture unlock and cleanup.
- TypeScript, `tests/popcat-audio.cjs`, `tests/popcat-assets.cjs`,
  `tests/endless-waves.cjs`, and the production Rollup build cover integration.

Browser tests validate decoded/mixed audio signals and playback events, not a
human listening judgment. Listen to the running production preview before
approving the final balance. Popcat recording reuse rights remain unverified;
see `assets/sounds/popcat/README.md`.
