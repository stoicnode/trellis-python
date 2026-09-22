# Python score calibration: pinned open-source survey

Status: **all 12 pinned scopes now have repeatable headline scores; external
quality calibration remains open** (2026-09-22). This is a research record for
the provisional `0.4.0-provisional` scoring contract, not an adjudicated quality
ranking of the projects.

Analyzer 0.8.0's literal dynamic-import correction has a separate 16-scope,
three-run record in
[`corpus/index-utility/p13-dynamic/`](../corpus/index-utility/p13-dynamic/summary.json).
It resolves 29 recognized production calls on the pinned Python scopes;
variable and unsupported calls remain located. Packaging's index rises from
70 to 72 because a newly visible import adds one production cycle. Scores
across scoring versions are side-by-side development evidence, not compatible
baselines or independent quality labels. The table below is the older 0.4.0
survey and retains its original measurement context.

Analyzer 0.9.0's executable-size correction has its own
[`16-scope record`](../corpus/index-utility/p21-docstrings/summary.json). The
scoring population omits actual first-statement docstrings from Python
function mass and clone numerator/denominator while preserving physical SLOC.
All scope scores are complete and deterministic. Several Python indexes move
by one point in either direction; this is a measurement-version change and
does not establish target-code improvement or an externally calibrated cutoff.

## Repaired, three-run measurement

The same pinned trees, package scopes and configuration now produce complete
native scores. Parser repairs cover explicit continuations, empty class
patterns, parenthesized `with` items and a root-level comment recovery artifact.
Python resolution no longer treats a plain local module as a package prefix
(`pydantic/mypy.py` previously shadowed external `mypy.*`). The graph score
now covers declared source targets: runtime-selected imports and imports with
no discovered target remain located unresolved evidence, while ambiguous
targets and parse errors still withhold the score. The bounded duplicate-work
ceiling is 250 million units per source set, raised from 100 million after
complete NumPy test and SQLAlchemy production passes measured 194,260,365 and
135,068,260 units respectively. Token, scratch-cell, stream and output caps
remain unchanged.

The artifact is `/tmp/trellis-python-unwithheld-final.json`, produced by the
same command below with `--runs 3`; sensitivity output is
`/tmp/trellis-python-unwithheld-sensitivity.json`. Every scope's three payload
fingerprints matched. All 12 have zero parse-failure files and complete score
dimensions. The score is for each listed package scope, not for its repository
or unsupported language files.

| Package scope | Index | Unresolved (dynamic) | Median audit / peak RSS |
| --- | ---: | ---: | ---: |
| Click | 58 | 0 (0) | 175 ms / 227 MiB |
| Requests | 46 | 2 (2) | 108 ms / 209 MiB |
| Flask | 59 | 2 (2) | 132 ms / 218 MiB |
| Rich | 77 | 3 (3) | 554 ms / 286 MiB |
| NumPy | 79 | 74 (13) | 3,249 ms / 734 MiB |
| SQLAlchemy | 80 | 41 (41) | 2,093 ms / 535 MiB |
| Pydantic | 78 | 5 (5) | 532 ms / 278 MiB |
| attrs | 45 | 1 (1) | 93 ms / 205 MiB |
| Jinja | 57 | 4 (4) | 203 ms / 232 MiB |
| packaging | 69 | 1 (1) | 214 ms / 231 MiB |
| dateutil | 42 | 2 (1) | 127 ms / 215 MiB |
| Sniffio | 0 | 0 (0) | 25 ms / 156 MiB |

Formula-only sensitivity has 66 eligible project pairs. Across the 20
non-baseline scenarios, at most five pairs reverse; this is relative stability
under those perturbations, not evidence of external validity. No blind human
maintenance labels or threshold precision/recall exist. A score of 50 remains
an operator policy choice, not an empirically validated boundary.

## Design and reproduction

The [manifest](../corpus/python-calibration/manifest.json) pins 12 public Git
commits and trees and declares one package source root per repository. These
scopes are deliberately package roots, not whole-project verdicts. NumPy's
`tests` and `_tests` are explicitly classified as tests. The harness checks the
commit, tree, clean working tree, and ignored source before and after each
measurement; it does not install or execute target project code. A fixed audit
clock and three fresh Bun processes per scope give stable payload fingerprints
independent of timing and RSS. The [measurement script](../scripts/python-calibration-measure.ts)
retains raw metrics, completeness, coverage, unresolved reasons, finding counts,
the first 25 hotspots and clone groups, analyzer/scoring versions, fingerprints,
wall times and peak RSS. Its output is an external JSON artifact; the table
below is the retained compact result. Timings are local medians; memory is the
maximum child-process peak RSS, not an operational limit.

Prepare clean clones named by manifest `id` in a separate directory, check out
each exact `commit`, and verify its tree. Fetching is a deliberate preparation
step, never part of an audit. On this run Bun 1.2.23 and the repo's locked
dependencies were used. From the trellis repository root:

```sh
bun scripts/python-calibration-measure.ts \
  --manifest corpus/python-calibration/manifest.json \
  --prepared-root /absolute/path/to/pinned-clones \
  --out /absolute/path/to/measurements.json --runs 3
bun scripts/python-calibration-sensitivity.ts \
  /absolute/path/to/measurements.json /absolute/path/to/sensitivity.json
bun scripts/validate-corpus.ts --runs 1 --out /absolute/path/to/controls.json
```

These commands use the same `runWorkspaceAudit` core as the CLI/SDK. On the
12-scope run, every three-run measurement fingerprint matched and the Git
checks passed. The external raw artifacts from this execution are
`/tmp/trellis-python-calibration-12-measurements.json` (before the number-token
repair), `/tmp/trellis-python-calibration-12-final.json`, and
`/tmp/trellis-python-calibration-12-final-sensitivity.json`. The first artifact
is an analyzer-before snapshot, not a before/after claim about target code.

## Coverage and score observations

The historical table below reflects the analyzer **after** the number-token repair but
**before** the repairs above. `Production
files / all .py` distinguishes scoring scope from discovered Python files;
SLOC is production only. Unresolved includes dynamic imports in parentheses.
Any unknown score dimension withholds the index; no partial sum is presented as
a project score.

| Package scope | Production / all .py | Production SLOC | Parse failures | Unresolved (dynamic) | Index | Median / peak |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Click | 17 / 17 | 9,895 | 1 | 0 (0) | withheld | 174 ms / 226 MiB |
| Requests | 19 / 19 | 4,945 | 0 | 2 (2) | withheld | 109 ms / 212 MiB |
| Flask | 24 / 24 | 7,646 | 0 | 2 (2) | withheld | 131 ms / 220 MiB |
| Rich | 100 / 100 | 35,254 | 0 | 3 (3) | withheld | 554 ms / 292 MiB |
| NumPy | 191 / 428 | 103,042 | 31 | 74 (13) | withheld | 2,698 ms / 555 MiB |
| SQLAlchemy | 245 / 258 | 199,917 | 0 | 41 (41) | withheld | 1,922 ms / 450 MiB |
| Pydantic | 105 / 105 | 38,080 | 1 | 129 (5) | withheld | 533 ms / 280 MiB |
| attrs | 19 / 19 | 5,357 | 0 | 1 (1) | withheld | 95 ms / 205 MiB |
| Jinja | 25 / 25 | 11,458 | 0 | 4 (4) | withheld | 193 ms / 233 MiB |
| packaging | 22 / 22 | 9,994 | 0 | 1 (1) | withheld | 211 ms / 231 MiB |
| dateutil | 17 / 17 | 6,010 | 1 | 2 (1) | withheld | 130 ms / 217 MiB |
| Sniffio | 4 / 5 | 93 | 0 | 0 (0) | **0** | 25 ms / 156 MiB |

The Sniffio zero means the measured structural signals were zero in this tiny
production scope; it is not an overall quality judgment. SQLAlchemy's
duplication dimension is unknown because its analyzer exhausted a resource
budget. Click, Pydantic and dateutil have parse failures; remaining unresolved
imports also withhold graph completeness. NumPy's 74 unresolved cases comprise
61 `no-target` and 13 `non-literal-dynamic` findings. Its 31 remaining parse
failures are across all 428 `.py` files, including tests; the original 110
included 27 production files. The valid trailing-decimal forms `3.`, `10.**2`
and `1.e2` accounted for a broad grammar gap. Repairing the number token
reduced parse-failure files **110 → 31** under the identical commit and scope;
the score is still withheld. There was no formula or target-code change.

NumPy has substantial non-Python surface: a direct inventory of its pinned
package contains 276 `.pyi`, 12 `.pyx`, 6 `.pxd`, 179 `.c`, 221 `.h`, and
31 `.cpp` files (including tests). Trellis now reports **746 unsupported source
files** here, including 276 `.pyi`, 12 `.pyx` and 6 `.pxd` that its earlier
inventory missed. These are visible counts, not analyzed SLOC or scored
metrics. The native score cannot be represented as coverage of NumPy's whole
implementation; unobserved code is not treated as clean.

The fixed synthetic corpus supplies directional controls, not open-source
labels. The one-run validation passed paired clone removal (16 → 0), branch
growth (0 → 26), cycle introduction (0 → 12), their reverse controls, and
size-only dilution (42 → 42). [Sensitivity scenarios](../scripts/python-calibration-sensitivity.ts)
re-evaluate the actual metric states under 21 formula-only variations: ±25%
term scales, count share 0.25/0.75, and ±0.10 dimension-weight changes with
the remaining weights redistributed. Eleven scopes stay withheld and Sniffio
stays zero: **zero eligible ranked pairs**. Rank correlation and stability,
threshold precision/recall, and comparison against independent maintenance
labels are not estimable. There are no score-blinded human adjudications here.

## Existing analyzer and history tools

The comparison below uses separate, operator-prepared tools. None participates
in Trellis's default audit, score, or installation path. Official contracts:
[Lizard](https://github.com/terryyin/lizard),
[Wily](https://github.com/tonybaloney/wily),
[jscpd](https://github.com/kucherenko/jscpd/blob/master/apps/jscpd/README.md),
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser),
[Import Linter](https://github.com/seddonym/import-linter/blob/main/docs/contract_types/index.md),
[Radon](https://radon.readthedocs.io/), and
[Xenon](https://github.com/rubik/xenon/blob/master/docs/index.rst).

| Tool | Executed comparison and useful role | Boundary for Trellis |
| --- | --- | --- |
| Lizard 1.24.0 | On the same Git-tracked production `.py` selection, its CCN/NLOC/token/function output triangulates hotspots; its `-Eduplicate` found one Flask repeated block (0.83%). It also supports TypeScript/TSX. | Its lightweight parsing truncated NumPy `genfromtxt` at signature line 1743 (CCN 1), while the body ends at 2488; native Trellis CC 164 and Radon CC 168. Require function-span checks before substituting it for native complexity. |
| Radon 6.0.1 + Xenon 0.9.3 | Radon independently computed Python cyclomatic complexity; Xenon with explicitly chosen `-b B -m A -a A` tripped Flask functions including `Blueprint.register`. | Xenon is a threshold over Radon, not an independent score label. Radon cannot cover TypeScript. Reconcile CC semantics for disagreements instead of voting. |
| jscpd 5.2.1 | The pinned optional evidence tool ran `weak` normalized mode over staged Python production sources: 742 NumPy clone pairs (14.38% of its analyzed lines), 26 Flask pairs (6.93%), none for Sniffio. | This execution was external research: Trellis's current opt-in adapter selection is TypeScript-only. Its pair/line denominator differs from native clone groups; public re-export lists and overlapping windows need human review. NumPy report counted 150 of 191 selected files, Flask 22 of 24, Sniffio 1 of 3, subject to token minimums; do not equate this with exhaustive coverage. |
| dependency-cruiser 18.3.1 | Existing pinned optional TypeScript architecture evidence remains useful for graph rule comparison. | JS/TS module resolver; no Python graph substitution. |
| Import Linter 2.15 | With an explicit `acyclic_siblings` contract, a staged Flask package reported a broken contract (21 files, 69 dependencies; 12 edges to remove). A synthetic two-module cycle was also detected without importing an `__init__.py` sentinel. | Operator-authored Python contracts are useful policy evidence, not a general sloppiness label; its graph selection differs from Trellis's 24-file scope and does not resolve dynamic imports for it. |
| Wily 1.25.0 | Git-backed `cyclomatic,raw` history on two pinned Sniffio revisions reported `_impl.py` CC 11, LOC 95, SLOC 37 on each. | Useful reference for optional historical deterioration, but its Git/cache model cannot replace the stateless first audit or prove snapshot score validity. It needed a separate environment because its Radon dependency conflicts with Radon 6. |

For Lizard/Radon, path and start-line matching found **340 Flask functions**
(325 exact CC, mean absolute difference 0.05) and **2,777 NumPy functions**
(2,699 exact, mean absolute difference 0.10). These are conditional agreements
on matched functions, not independent quality labels; unmatched functions and
the NumPy signature-only Lizard example matter. The native Flask top hotspot
`sansio/blueprints.py:273 register` has CC 22, nesting 2 and SLOC 89 and also
appears in Xenon's threshold output. The native Flask first clone group is two
heavily overlapping windows in its `__init__.py` public re-export list (lines
1–38 and 2–39), a poor unreviewed example of actionable maintenance debt.
Keep candidate detections distinct from adjudicated benefit.

External research used a separate Python environment with the versions above,
an empty owned jscpd config and staged copies of the exact Git-tracked
production files. No target project dependencies were installed. The pilot
outputs and selected-file lists are in `/tmp/trellis-python-tool-pilot/` on
the execution host; their commands and version pins should be recorded in a
future provider acceptance protocol before promoting any tool output into
product evidence. The proposed promotion is **unscored, opt-in evidence**:
Lizard function-span corroboration, jscpd Python clone candidates, and
Import Linter declared architecture contracts. Wily's Git history is a
separate opt-in surface. None warrants a scored backend replacement today.

## Initial calibration decision (superseded by the repaired measurement above)

Retain `0.3.0-provisional` and the existing formula. The directional fixtures
pass, but the open-source observations cannot estimate between-project ranking
or a meaningful cutoff. **50 is only an operator-selected policy setting**, not
an empirically established acceptable/poor boundary. Prioritize remaining
valid Python syntax, analyzable `.pyi`/`.pyx` coverage where feasible, narrower
resolution of static imports without fabricating dynamic edges, duplication
overlap review, and resource-bounded SQLAlchemy duplication. Then rerun the
same manifest and conduct score-blinded review of both flagged and unflagged
samples with explicit disagreement and adjudication. Any future change to
normalizations or weights needs a version bump and held-out evidence.
