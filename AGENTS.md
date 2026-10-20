# Project development instructions

## Wave Director documentation convention

This convention applies to every future Wave Director implementation and version.

- Create a separate, complete document at `docs/WAVE_DIRECTOR_V<N>.md` for each
  version. Never overwrite, replace, or delete historical Wave Director documents
  when introducing a new version.
- For V2 and every later version, the first section must be titled exactly
  `## Changes from Previous Version`. Place it immediately after the document's
  title, before any overview, table of contents, or other section.
- That opening section must explain all of the following:
  1. **Previous version:** name the version being replaced and the transition
     explicitly, for example `V10 → V11`.
  2. **Main objective:** explain why this version was created and the gameplay
     problem it addresses.
  3. **What changed:** describe every meaningful change to wave rules, difficulty
     formulas, movement speed, firing pressure, formations, enemy composition,
     bosses, safety limits, or other relevant mechanics.
  4. **Before vs. after:** show the previous and new values, formulas, or rules
     wherever applicable. Use comparison tables when helpful.
  5. **What stayed unchanged:** briefly identify the major systems intentionally
     preserved.
- After that opening changelog, document the complete current implementation:
  all rules, formulas, numeric configuration values, caps, unlocks, formations,
  boss scheduling, seed handling, examples, balancing guidance, limitations, and
  actual implementation/configuration references. Each version must stand on
  its own without requiring readers to open previous versions. A change-only
  document or a link back to an older version is insufficient.
- Describe actual implemented behavior, including any deviations, rather than
  only the intended design. Update the new version's documentation alongside its
  implementation and verification.
- **V1 exception:** V1 is the initial baseline, so its first section immediately
  after the title must be `## Initial Implementation`. Explain the initial
  objective and baseline without inventing or comparing against a V0.

## Finalized Wave Director V1 boundary

- Once the WD1 finalization commit is pushed, `docs/WAVE_DIRECTOR_V1.md` is a
  frozen historical reference. Do not edit or overwrite it for future work.
- Any future intentional Wave Director change, including balancing,
  configuration, composition, formation, progression, or behavior changes,
  must create `docs/WAVE_DIRECTOR_V2.md` for the next version. Do not continue
  iterating V1 after publication.
- V2 must begin immediately after its title with
  `## Changes from Previous Version`, explicitly compare `V1 → V2` using every
  required field above, and then document the complete V2 implementation.
- Do not create V2 until a future change is requested. Subsequent versions
  follow the same convention and preserve all earlier version documents.
