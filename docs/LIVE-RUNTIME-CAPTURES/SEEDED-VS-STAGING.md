# Seeded runtime vs staging (Batch 10.8)

- **Seeded canonical**: `docs/LIVE-RUNTIME-CAPTURES/*.live.json` with `trustTier: seeded-runtime-explicit-provenance-v3` — derived from `docs/RUNTIME-QUERY-CAPTURES` (supertest).
- **Staging tier**: `docs/STAGING-RUNTIME-CAPTURES/_staging-runtime-separated.placeholder.json` — `trustTier: staging-sanitized`, `payload: null` until a real capture is checked in. **Do not** place staging files under LIVE.
- Do **not** call seeded files "production live" in reviewer copy; use tier labels from `captureMeta.trustTier`.

## Truth pack layering (v6)

- **LIVE-RUNTIME-CAPTURES**: seeded supertest-derived tier (`seeded-runtime-explicit-provenance-v3`); canonical for review ZIP truth ladder.
- **STAGING-RUNTIME-CAPTURES**: separate sanitized tier placeholder; never mixed into LIVE paths.
