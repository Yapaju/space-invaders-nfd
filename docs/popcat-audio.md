# Popcat sound preview

Reuse rights are unverified; see [source and permission notes](../assets/sounds/popcat/README.md).
Do not publish this recording until permission is established or it is replaced.

The existing Phaser loader preloads `sounds/popcat/popcat-pop.mp3`. Successful Popcat
attacks emit one pop after their clearance check and mouth opening. Both weapon
choices and facings share this event. Kernel transformation emits one deeper pop
inside the existing one-time transformation branch. Physics, damage, sprites,
wave configuration, mouth timing and collision handling are unchanged.

`AudioBalance` centralizes normal volume 0.66, giant volume 0.625 and giant
playback rate 0.85. `PopcatAudioSettings` references these values and retains
two simultaneous Popcat voices per game sound manager.
These volumes multiply the existing master volume. Voice capacity is shared by
all emitters and scenes. Excess events are dropped, without stopping or ducking
shoot/explosion/kill sounds. Voices are reused and cleaned up by Phaser's manager.
All effects now share a measured loudness baseline and Web Audio mix headroom;
see [audio balance](audio-balance.md) for calibration, gains and bus settings.

No global mute, volume, rate or context state is changed. Muted, zero-volume,
missing-cache and locked/suspended audio events are dropped without queued replay.
Phaser retains responsibility for user-gesture unlock. Restart, game over and
scene shutdown stop only the Popcat voices, leaving the other audio untouched.

For listening: launch the game normally, click inside it if audio needs unlocking,
and play Wave 1. Successful attacks make a recognizable pop. The kernel's
transformation near Y=322 makes the same sound at lower pitch and matched loudness.

The normalized MP3 of the same reference pop lives at `assets/sounds/popcat/popcat-pop.mp3`.
Both Rollup configurations watch/copy it to
`dist/assets/sounds/popcat/popcat-pop.mp3`, inside the existing static output
folder used for production hosting. Phaser's `assets/` base URL resolves the
local path. No streaming URL or external audio fallback is used at runtime.
The MP3 normalizes the requested recording, with reuse rights still unverified. No public deployment is performed.

Audibility fix: the source peaked at only 0.115. The normalized MP3 peaks at
0.775 after decoding. The later whole-game balance uses mouth/giant gains of
0.66/0.625 and lowers the much louder legacy effects. The original recording is kept
outside the repository; no substitute sound is used. The source transient is
42ms and the encoded MP3 decodes to 72ms with codec framing.

The same Phaser AudioContext is resumed on pointer/keyboard input if a browser
suspends it after initial unlock. This does not bypass autoplay or replay missed
attacks. Load/decode failures, rejected playback and exceptions warn once; failed
voices are released so they cannot exhaust the two-voice cap.

Development builds support ?popcatAudioDebug=1 console info for cache state,
context state, gestures, skip reasons and playback results. Production builds
disable these info logs but keep real failure warnings.
