# ast-grep direction check against SmellBench

**Run date:** 2026-09-22
**Status:** discovery evidence; no audit or scoring change

## Question

Does the published Python `ast-grep` bundle used by `scb-check` match injected
SmellBench code more often than the corresponding original code? Which individual
rules are strong enough to test on a second, independent labeled source?

This is a paired direction check. It does not assume that original project code is
perfect, and it does not treat an AST match as proof of poor quality.

## Inputs and method

- SmellBench train split: 147 pairs, seven Python projects and seven smell types,
  pinned at revision `12604372b4a89a54b39645b6c82557b3b9e68eca`.
- `ast-grep` 0.42.1.
- The 197-rule `scb-check` bundle at revision
  `a8618228939def726c2ec48b354693e5aa1999d5`, with bundle SHA-256
  `245bebb0d5f925faa4e05fcef7139438a9412bf4c604496fa2191778197fe10c`.

The harness reconstructs the original and injected snippets from each unified
diff. For each side, it unions the nonblank, non-comment source lines covered by
all matches and divides by the corresponding source-line count. This normalization
matters because the injected snippets contain substantially more code.

For each individual rule, the harness counts paired bad-only and good-only hits.
It applies a two-sided exact paired test and Benjamini-Hochberg correction across
all 197 screened rules. The discovery shortlist uses a fixed mechanical screen:
at least five bad-only pairs, at most one good-only pair, positive mean coverage
movement in at least four projects, and positive overall coverage movement.

The upstream repository has conflicting license declarations. Its rules are used
from a temporary checkout and are not copied into Trellis.

## Jev ratings for the original good side

Jev's maintenance rating is a probability-weighted score from 0 to 3:

- 0: no visible structural maintenance problem;
- 1: minor cleanup friction;
- 2: material structural cost;
- 3: severe structural cost.

The original side was better on average, but it was not rated as pristine code.

| Measure | Original good | Injected bad |
| --- | ---: | ---: |
| Mean maintenance rating | 0.969 | 1.370 |
| Median maintenance rating | 0.940 | 1.380 |
| Interquartile range | 0.635–1.245 | 1.075–1.725 |
| Full range | 0.210–2.050 | 0.350–2.440 |
| Dominant level 0 / 1 / 2 / 3 | 47 / 63 / 37 / 0 | 10 / 54 / 83 / 0 |
| Mean refactor-value probability | 0.354 | 0.442 |
| Refactor value at least 0.5 | 7/147 | 32/147 |
| Mean evidence-sufficiency probability | 0.300 | 0.486 |
| Evidence sufficiency at least 0.5 | 3/147 | 81/147 |

Only three original snippets cleared 0.5 evidence sufficiency. Absolute Jev
ratings therefore carry much less weight than the within-pair direction result.
The injected side scored higher on maintenance cost in 83.7% of pairs, with a mean
movement of +0.400.

## Bundle result

| Measure | Original good | Injected bad |
| --- | ---: | ---: |
| Snippets with one or more matches | 53/147 | 103/147 |
| Total matches | 106 | 401 |
| Mean unique-line coverage | 4.67% | 6.57% |
| Median unique-line coverage | 0.00% | 1.93% |

Coverage was higher on the injected side in 69 pairs, higher on the original side
in 34, and tied in 44. The paired coverage change had Pearson correlation 0.162
and Spearman correlation 0.248 with Jev's paired maintenance-rating change. The
bundle detects some of the injected style, but agreement with the independent Jev
signal is weak.

## Individual rule screen

The strongest rules by paired presence were:

| Rule | Good files | Bad files | Bad-only | Good-only | Mean coverage change | Projects positive | Raw p | Adjusted q |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `redundant-return-none` | 3 | 18 | 16 | 1 | +0.082 pp | 7 | 0.000275 | 0.054 |
| `verbose-dict-update` | 3 | 14 | 11 | 0 | +0.085 pp | 4 | 0.000977 | 0.096 |
| `go-style-err-tuple-return` | 0 | 10 | 10 | 0 | +0.177 pp | 4 | 0.001953 | 0.128 |
| `manual-dict-setdefault` | 0 | 7 | 7 | 0 | +0.208 pp | 4 | 0.015625 | 0.440 |
| `except-pass-silence` | 0 | 7 | 7 | 0 | +0.073 pp | 5 | 0.015625 | 0.440 |
| `chained-none-check` | 0 | 6 | 6 | 0 | +0.137 pp | 5 | 0.031250 | 0.616 |
| `dict-get-empty-list-default` | 0 | 6 | 6 | 0 | +0.045 pp | 5 | 0.031250 | 0.616 |
| `dict-get-empty-dict-default` | 0 | 6 | 6 | 0 | +0.029 pp | 4 | 0.031250 | 0.616 |
| `verbose-list-append-loop` | 3 | 8 | 5 | 0 | +0.157 pp | 5 | 0.062500 | 0.947 |

No individual rule remained below a 0.05 false-discovery threshold after screening
197 rules. `redundant-return-none` came closest and moved in the expected direction
in all seven projects.

Several shortlisted patterns are context dependent. A tuple such as
`return value, None`, a chained `is not None` condition, a mutable default passed
to `dict.get`, or an explicit loop can be intentional. Their zero good-side count
in this small corpus does not establish a generally safe quality rule.

The best candidates for independent validation are:

1. `redundant-return-none`, using Ruff's maintainer-labeled RET501 fixtures;
2. `except-pass-silence`, using Ruff's S110 fixtures and real review changes;
3. `verbose-list-append-loop`, using Ruff's PERF401 fixtures;
4. `verbose-dict-update`, using separately sourced before/after review examples.

These concepts have a labeled fixture source or a concrete review-time
transformation. The remaining discovery hits should stay diagnostic research until
a second source shows acceptable good-side precision.

## Decision

The full AST bundle has directional signal against SmellBench, so an `ast-grep`
provider is technically useful as namespaced evidence. This run does not justify a
score contribution. It supplies a four-rule validation queue and rejects treating
all 197 matches as equally meaningful.

## Reproduction

The harness is [`run.mjs`](run.mjs), and the complete machine-readable result is
[`summary.json`](summary.json). It downloads only the pinned public SmellBench
rows; `--jev-labels` reads an existing local research artifact and does not call a
model.

```sh
git clone https://github.com/gabeorlanski/scb-check.git /tmp/scb-check-validation
git -C /tmp/scb-check-validation checkout a8618228939def726c2ec48b354693e5aa1999d5
mkdir -p /tmp/trellis-ast-grep
npm install --prefix /tmp/trellis-ast-grep @ast-grep/cli@0.42.1
node docs/research/ast-grep-smellbench-validation/run.mjs --live \
  --ast-grep /tmp/trellis-ast-grep/node_modules/.bin/ast-grep \
  --rules-dir /tmp/scb-check-validation/src/scb_check/resources/slop_rules \
  --jev-labels /absolute/path/to/smellbench-labels.json \
  --out docs/research/ast-grep-smellbench-validation/summary.json
```
