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

P2.3's advisory documentation measurements are retained in
[`p23-documentation/`](p23-documentation/summary.json). All 16 scopes completed
three deterministic runs with unchanged indexes from P2.1. The provisional
40-line/300-word trigger produced 551 warnings across the corpus, including
long NumPy API docs and SQLAlchemy dialect references; these are review leads,
not automatic debt or reasons to remove useful documentation. Trellis's own
source has 17 production JSDoc warnings in this slice. The two-source by
two-analyzer self-audit is under
[`self-audit/p23-documentation/`](self-audit/p23-documentation/manifest.json).

P2.2's separate advisory clone population is retained in
[`p22-clones/`](p22-clones/summary.json). Across the 16 deterministic scopes,
940 raw production groups yield 139 candidate executable groups; no scored
index moves from P2.3. The summary compares per-scope raw groups,
independent copies, eligible-line density and stricter postfilters. Rich's
table-heavy source retains raw matches but contributes no executable
candidate group. The four-cell Trellis self-audit is under
[`self-audit/p22-clones/`](self-audit/p22-clones/manifest.json); all cells
score 39.

P3.1's advisory executable-scope and nesting measurements are retained in
[`p31-scopes/`](p31-scopes/summary.json). All 16 pinned scopes passed three
deterministic runs, and every index matches P2.2. The new pass records 957
production initialization decisions and 1,372 production nesting findings
at depth 3 or greater across the corpus. These are located review leads, not
validated debt labels. The four-cell Trellis self-audit is under
[`self-audit/p31-scopes/`](self-audit/p31-scopes/manifest.json); all cells
score 39, with old and new analyzers run against both source snapshots.

P3.2's reporting-only corpus run is retained in
[`p32-reporting/`](p32-reporting/summary.json): three runs for each pinned
scope, all payloads and indexes byte-identical to P3.1. The
[`self-audit/p32-reporting/`](self-audit/p32-reporting/manifest.json) record
keeps the four before/after cells. Trellis's own index moves from 39 to 38
because new presentation code increases clean source denominators; the raw
production erosion mass rises while the eroded-function count stays at 41.
The new comparison display shows that concentration effect explicitly. It
must not be read as a cleanup of existing structural debt.

Phase 4's isolated [formula experiments](formula-experiments/README.md) use
the repaired P3.2 measurements plus production graph and executable-function
signals from the same pinned checkouts. The research baseline reproduces all
16 authoritative indexes. Candidate results include exact contributions,
rank reversals, language/size slices, saturation and run cost; none changes
the production score or selects a formula before independent review.

The archived Phase 5 [study preregistration](study/preregistration.json) pins six
repositories, the blinded deterministic sample, primary endpoint and regression
margins. The project retired the human-review route on 2026-09-22 and replaced it
with the [public labeled-source validation plan](../../docs/research/slopcodebench-labeled-sources.md).
No formula is promoted until that repository-held-out validation passes.
The [generated-artifact record](study/generated-artifacts.json) points to the
5,920-unit census and 120-sample reviewer packet, records source/license
provenance and confirms an identical second generation. The packet remains an
archived reproducibility artifact outside this repository because it contains
third-party source excerpts.

The research-only [Jev study](../../docs/research/jev-index-study.md) reuses the
blinded packet beside all 147 SmellBench pairs. Its committed
[summary record](study/jev-v1-summary.json) pins input/output hashes, model
identity, usage and the non-promotion decision; source-derived model outputs remain
outside the repository.

The [full-context follow-up](../../docs/research/jev-context-study.md) rebuilds
the same 120 samples with complete units, neighboring source, lexical references,
clone relationships and import graph context. Its
[summary record](study/jev-context-v2-summary.json) pins the new packet and output
hashes and reports Python and TypeScript separately. Context improves relative
discrimination, but the result remains research-only and does not change scoring.

The final [Release A self-audit](self-audit/index-release-a/manifest.json)
compares the P3.2 source to the completed research/study/release additions
under analyzer 0.9.0. The index and eroded-function count remain 38 and 41;
three final payload fingerprints match. Added clean source lowers density
and exact points while absolute erosion mass rises, so the record does not
claim a target-code cleanup.

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
