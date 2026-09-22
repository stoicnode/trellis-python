# Index improvement implementation record

## Production cycle scope (P1.1)

The 2026-09-22 implementation uses the production-induced dependency graph
for scored cycles. The unsuffixed `import-cycle.*` metrics retain their
historical workspace meaning; `.production` metrics have an explicit scored
scope. Test-only cycles and parse failures remain visible as evidence, and a
production import of a test module is a located finding. The formula weights
and normalization constants remain unchanged. Analyzer 0.5.0, schema 1.5.0,
scoring 0.5.0-provisional, graph policy 1.3.0 and cycle policy 1.2.0 name the
semantic cutover. Old reports remain readable; comparisons across this
transition require a new baseline.

The owned regression tests exercise TypeScript and Python test-only cycle and
parse-failure changes, production-to-test imports, empty production, and
unresolved production edges. Existing cycle tests cover self-edges, type-only
subgraphs, deterministic identity and cross-package cycles. CLI and SDK still
call the same core and retain their deep-equal parity checks.

### Trellis self-audit

The source before this slice is Git revision
`1143172ef17a7e8731fc7847c4535f954876ab1e`; the checked-in
`trellis.yaml` SHA-256 is
`683767b1067eb84150f8020fc6a12e4620561ec0bfd8aadebba107f6d0b874fa`.
The before and after TypeScript source-tree fingerprints, over sorted
`src/` and `scripts/` paths and file hashes, are
`0f67fb0be3d4d19b0da564f8cce6ec4f299cd1311f421ad0b9eecf3212f5b7bc` and
`6b98000694a07d496d631b31ed3eb83e06254b1632a291aab5e8a34ef39888cb`.
The four complete JSON reports are preserved as gzip artifacts in
[`corpus/index-utility/self-audit/`](../corpus/index-utility/self-audit/manifest.json),
with uncompressed SHA-256 hashes. The prepared old source was a `git archive`
of that revision. Both analyzers audited the before and after source with
the same configuration. The old analyzer also audited the changed source;
these are 2-by-2 measurements, with comparisons only within an analyzer
version. The raw Markdown comparisons were generated with
`trellis compare <before> <after> --config trellis.yaml --md`.

| Analyzer | Target source | Index | Workspace cycle groups / density | Production cycle groups / density |
| --- | --- | ---: | --- | --- |
| 0.4.0 | before | 39 | 1 / 0.007371 | unavailable |
| 0.4.0 | after | 38 | 1 / 0.007353 | unavailable |
| 0.5.0 | before | 39 | 1 / 0.007371 | 1 / 0.013699 |
| 0.5.0 | after | 39 | 1 / 0.007353 | 1 / 0.013699 |

All four reports are complete. Under the new analyzer, source changes leave
the index unchanged. The production eroded-function count stays 37, clone
group count stays 17, production cycle burden stays one group, and no
production hotspot is added or worsened. Production total erosion mass rises
from 22365.441 to 22474.945 as the implementation adds functions; eroded
share falls from 0.135716 to 0.135055 and clone density from 0.034662 to
0.034508 because their denominators grow. These density movements do not
establish a reduction in structural debt. The old analyzer's one-point drop
on the changed source illustrates the same caveat. No production-to-test
import finding appears in either self-audit.
Three fresh fixed-clock runs of the final source returned the same measurement
payload fingerprint, recorded in the self-audit manifest.

### Baseline migration and rollback

After installing the new analyzer, capture a new report before applying
regression policy:

```sh
bun src/cli/main.ts audit /absolute/workspace --json --out /absolute/artifacts/baseline-0.5.json
```

Keep old 0.4.0 reports and SQLite history with their original versions. Use
0.4.0 with a matching 0.4.0 baseline to roll back the policy transition;
do not overwrite history or compare across scoring versions. A new analyzer
on a saved old source snapshot can explain measurement changes, but an old
report alone cannot be rescored with facts it never stored.

## Remaining plan

P1.2–P3.2 and independent formula calibration remain open in
[`index-improvement-plan.md`](index-improvement-plan.md). The exploratory
16-scope baseline is development data, not blinded or held-out validation.
Phase 5 requires independent human review before any formula promotion.
`ml` and `sd` were unavailable on this host, so tracker and memory entries
could not be created here.
