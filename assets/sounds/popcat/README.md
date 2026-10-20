# Popcat preview audio - reuse rights unverified

Permission for public redistribution/commercial reuse has not been established.
Clear rights with the recording owner before release. The repository MIT license
does not grant rights to this third-party recording.

Source: https://www.myinstants.com/media/sounds/pop-cat-original-meme_3ObdYkj.mp3
Terms checked 2026-10-20: https://www.myinstants.com/en/terms_of_use.html
Original owner and upload-specific game permissions remain unknown.
Original SHA-256: a1a16c21bfe3182f8e78316a6260d24c2abc896bb3cc8df0fe83c9c9ee3934e4

The same pop recording is normalized for audibility, not replaced. The original
peaked at 0.115 (-18.8 dBFS); former local/master gains reduced that to 0.014.
Processing: decode the original left channel, remove DC offset, apply 0.5ms edge
fades, normalize PCM peak to 0.8, and encode mono MP3 at 48kHz / 192kbps with LAME.
The 42ms source transient decodes to 72ms including codec framing. Browser-measured
peak is 0.775 without clipping. The original is retained outside the repository.
Normalized SHA-256: 05bab6669eb47afccac2d6ed4dc62db3547888ef4a104cd0de67b16dd2c9dab6

Build output: dist/assets/sounds/popcat/popcat-pop.mp3, copied byte-for-byte.
Gameplay uses this local file only; a ?v=2 query invalidates the old quiet cache.
