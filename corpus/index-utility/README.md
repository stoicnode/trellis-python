# Index utility baseline

This directory preserves the 2026-09-22 exploratory review used by
[`docs/index-improvement-plan.md`](../../docs/index-improvement-plan.md). It is
development evidence, not independently labeled validation data. The 12 Python
pins come from [`../python-calibration/manifest.json`](../python-calibration/manifest.json);
the four TypeScript pins are TanStack Query `packages/query-core`, Zustand
`src`, ts-pattern `src`, and Ky `source`. `manifest.json` combines all 16
scopes for the existing measurement harness. Each repository commit and tree
hash must match before a run; each scope records its source classification
and unsupported-language coverage in `baseline-summary.json`.

The reviewed analyzer was 0.4.0, schema 1.4.0, scoring
0.4.0-provisional, on Bun 1.2.23 at revision
`63e71bba0da5ca761898ff03ebec936ffffa668c`. Each scope was audited in
three fresh processes with a fixed audit clock. All 16 were score-complete
and had identical measurement payload fingerprints across the three runs.
`baseline-summary.json` records those fingerprints, the index and source
coverage. The exact uncompressed JSON artifacts are stored as deterministic
gzip files under `baseline/`, with SHA-256 hashes of the uncompressed bytes
recorded in the summary. They contain numeric reports and synthetic probe
source generated for this evaluation; no third-party source was copied, so
no additional source-license obligations attach to these artifacts.

P1.3's analyzer 0.8.0 measurement is retained in
[`p13-dynamic/`](p13-dynamic/summary.json): the same 16 pinned scopes, three
fresh-process runs each, with all payload fingerprints stable and all scores
complete. Its compressed raw result is hashed in the summary. Fifteen scopes
retain their 0.7.0 index; packaging moves from 70 to 72 when a provable
literal import exposes one additional production cycle. These are side-by-side
measurements across scoring versions, not a compatible report comparison.
[`self-audit/p13-dynamic/`](self-audit/p13-dynamic/manifest.json) retains the
two-analyzer by two-source Trellis self-audit, source/configuration fingerprints,
compatible within-analyzer comparisons and three-run current payload hashes.
All four self-audit cells score 39; the added source raises raw production
erosion mass, with no new complexity hotspot in the dynamic-import code.

P2.1's analyzer 0.9.0 measurement is retained in
[`p21-docstrings/`](p21-docstrings/summary.json), again over all 16 pins with
three identical payload fingerprints per scope and complete scores. It records
physical and executable production SLOC, erosion mass, clone density and
side-by-side indexes. The raw result is a deterministic compressed artifact
with its uncompressed SHA-256 in the summary. The same-source TypeScript
scopes retain their scored measurements. Python changes are measurement
corrections, not proof of source improvement; clone density can increase when
documentation leaves the denominator. The self-audit for this slice is under
[`self-audit/p21-docstrings/`](self-audit/p21-docstrings/manifest.json).

To rerun against operator-prepared, clean checkouts under a directory with
repository ids as folder names:

```sh
bun scripts/python-calibration-measure.ts \
  --manifest corpus/index-utility/manifest.json \
  --prepared-root /absolute/prepared-checkouts \
  --out /absolute/artifacts/index-utility.json \
  --runs 3
```

The harness verifies commit/tree and ignored-source cleanliness, uses the
same deterministic audit core for both languages, and neither fetches nor
executes target code. Its output path must be outside the audited source.
Use `gzip -dc baseline/python-measurements.json.gz` and the matching file for
TypeScript or probes to inspect the exact reviewed artifacts. Their hashes
can be checked with `shasum -a 256` on the decompressed bytes.

The synthetic probe artifact holds 22 audit scenarios and five Python syntax
probes. Its original runner used absolute paths and is not the reproduction
entry point; source text for each scenario is embedded in the artifact.
Owned regression fixtures are added beside each implementation fix. The
historical probe results are baseline observations, never assertions that the
defects should remain.
