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

P1.2 overload association, P1.3–P3.2 and independent formula calibration remain open in
[`index-improvement-plan.md`](index-improvement-plan.md). The exploratory
16-scope baseline is development data, not blinded or held-out validation.
Phase 5 requires independent human review before any formula promotion.
`ml` and `sd` were unavailable on this host, so tracker and memory entries
could not be created here.

## Python typing guards (P1.2, first slice)

The shared Lezer binding scanner now recognizes confirmed `TYPE_CHECKING`
imports, aliases and qualified `typing` imports. It follows nested guards,
provable negation and the corresponding `else` branch. Assignment and lexical
shadowing invalidate a binding, so unknown names are not inferred type-only.
Deferred function bodies require a locally confirmed typing alias because a
global alias could change before execution.
The Python import adapter carries these facts into the existing distinct
runtime/type-only graph edges. A mixed type-only/runtime pair no longer forms
a runtime cycle. Dynamic import binding facts and overload declarations are
recorded by this scanner for the following slices; literal resolution and
overload association are not claimed here. Analyzer 0.6.0, graph policy 1.4.0
and scoring 0.6.0-provisional identify this measurement change; schema 1.5.0
and formula weights are unchanged. Baselines from 0.5.0 remain readable but
are not comparison-compatible with 0.6.0.

The before source revision is `621d0c14a34944965bfaee29d042cbfd2d1aced8`.
The [four-report manifest](../corpus/index-utility/self-audit/p12-typing/manifest.json)
records source and configuration hashes, uncompressed report hashes, and three
equal fixed-clock payload fingerprints. The two same-analyzer comparisons are
retained alongside it. All four reports are complete:

| Analyzer | Before source | After source | Production eroded functions | Production cycle groups |
| --- | ---: | ---: | --- | --- |
| 0.5.0 | 39 | 39 | 37 → 37 | 1 → 1 |
| 0.6.0 | 39 | 39 | 37 → 37 | 1 → 1 |

Under the new analyzer, implementation code adds 408.164 production erosion
mass and reduces clone density from 0.034508 to 0.034131 as the denominator
grows. The unchanged rounded index is not evidence that these changes removed
debt. No new Python binding-scanner function crosses the CC 11 hotspot
threshold. The source-scope caveat in both comparisons reflects the new
source files. No Python files occur in Trellis's own source, so the
same-source comparison cannot exercise this Python semantic correction; the
owned Python regression tests do that.

To migrate a 0.5.0 baseline, audit the same target with 0.6.0 and save a new
report before enabling regression policy. Retain the old artifact and SQLite
series; use 0.5.0 with its matching baseline for rollback.

### Pinned corpus check

Both analyzers ran all 16 pinned scopes three times from the same prepared
checkouts. Each scope was complete and fingerprint-stable within its analyzer;
the [compact side-by-side summary](../corpus/index-utility/p12-typing/summary.json)
and compressed raw measurements preserve exact values and hashes. No target
dependencies or project code were executed.

The correction identifies type-only local edges in eight Python scopes:
Click 16, Requests 24, Flask 30, Rich 87, SQLAlchemy 1,537, Pydantic 128,
Jinja 23 and Packaging 7. The other four Python scopes
and all four TypeScript scopes retain zero such new edges. Source coverage and
graph edge totals do not change. The runtime and type-only partition changes
cycle groups: Click 1 → 2, Flask 2 → 6, SQLAlchemy 6 → 9 and other group
movements are in the summary. These are measurement changes on identical
source, not source-code improvements or regressions. Some rounded indexes
rise even as cycle density falls because the unchanged provisional formula
counts both classes' groups. Whether the two classes deserve equal weight is
the planned Phase 4 experiment. Cross-version scores are displayed for
inspection only; the comparison service correctly refuses to create deltas
between these scoring versions.
