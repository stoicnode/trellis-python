# Isolated index formula experiments

Status: research only, 2026-09-22. No candidate in this document changes the
authoritative `0.9.0-provisional` score. The code is isolated in
[`src/research/formula-candidates.ts`](../src/research/formula-candidates.ts),
with a pinned, read-only runner in
[`scripts/index-formula-experiments.ts`](../scripts/index-formula-experiments.ts).

## Frozen experiment rules

These rules were fixed in code before the 16-scope run. No independent human
labels or held-out maintenance pairs were inspected. Every variant retains
the 50/30/20 dimension weights and 50/50 count/density shares. Count
normalization remains `100 log1p(x / scale) / (1 + log1p(x / scale))`.

| ID | Changed input | Fixed scale or rule |
| --- | --- | --- |
| `authoritative` | None | Production `0.9.0-provisional` formula |
| `cycle-scc-burden` | Cycle count | Sum of cyclic SCC size minus one, plus distinct self-loops; scale 5 |
| `cycle-distinct-edges` | Cycle count | Distinct edges internal to a cyclic SCC; scale 5 |
| `complexity-severity` | Eroded count | Sum of `max(0, CC - 10) × sqrt(executable SLOC)`; scale 100 |
| `complexity-severity-smooth` | Eroded count | Sum of `log1p(max(0, CC - 10)) × sqrt(executable SLOC)`; scale 100 |
| `smooth-density` | Three density curves | `100 × (1 - exp(-ln(10) × density / oldCap))`; 90 points at the old cap |
| `clone-candidates` | Clone count/density | Independent executable copies and their covered/eligible lines; count scale 15, density cap 0.15 |
| `edge-class` | Cycle count | Full SCC burden minus half of type-only-only SCC burden; mixed cycles retain full burden |
| `combined-v1` | Small combined candidate | SCC burden, linear complexity severity, independent executable copies, smooth densities |

The cycle count changes only the count term; its density term remains the
existing fraction of production modules in a cycle. The edge-class rule is
an illustrative cost assumption, not a calibrated claim. Type-only-only SCCs
can overlap with full SCCs, so this subtraction is an experiment and may not
have a simple maintenance interpretation. Candidate clone density uses its
own eligible line population. None of these values has a quality label.

## Corpus result

The [compressed result](../corpus/index-utility/formula-experiments/results.json.gz)
contains each scope's raw metrics, SCC and severity signals, exact dimension
points, apportioned integer points, rounded score, language/size, and run
cost. SHA-256 of the compressed bytes:
`f791e358226f93a8b566a473685c359908b624ad9f190f26baa2ac08bb189b13`.
Its input is the [P3.2 three-run record](../corpus/index-utility/p32-reporting/current-measurements.json.gz)
at SHA-256
`83fcf05fa6cc0cc2661ed2b878f90e2e38b86d669479c59c871722e91ac3`.
The runner verifies each source commit/tree and cleanliness before and after
reading it; it does not fetch, install or execute target code.

| Variant | Mean index, 12 Python | Mean index, 4 TS | Rank reversals vs current, of 120 pairs |
| --- | ---: | ---: | ---: |
| Authoritative | 58.92 | 39.50 | 0 |
| SCC burden | 60.92 | 42.50 | 3 |
| Distinct cyclic edges | 61.75 | 43.75 | 3 |
| Complexity severity | 64.75 | 48.75 | 4 |
| Smooth complexity severity | 61.92 | 43.75 | 4 |
| Smooth densities | 59.42 | 40.25 | 0 |
| Clone candidates | 48.83 | 37.25 | 4 |
| Edge-class weighting | 60.75 | 42.25 | 2 |
| Combined v1 | 57.00 | 48.75 | 17 |

At current linear caps, 13/16 scopes saturate the erosion share and 13/16
the cycle density; clone density saturates in 3/16. The result has 8 scopes
with at most 5,000 production executable SLOC, 4 from 5,001–10,000, and
4 above 10,000. The artifact reports per-slice means and exact pairwise rank
reversals. Its scope measurements took 6.24 seconds total; the maximum
observed RSS of the shared research process was 606 MiB. These are additional
signal collection costs, not per-audit overhead for the unchanged product.

SCC burden passes exhaustive edge-addition monotonicity for all directed
graphs on four fixed nodes (including self-edges) and retains mixed
runtime/type-only cycles. Joining two 2-node SCCs raises burden from 2 to 3.
Reducing CC 31 to 11 on a 100-line executable function reduces linear
severity from 210 to 10 even if integer rounding conceals part of the score
change. The smooth density curve does not reach a finite cap. A clean
production addition may reduce density, so only absolute burden and the
existing located cycle findings are protected by the edge invariant. SCC
burden does not measure the minimum feedback edges needed to break a cycle.

The significant language and size differences, especially the combined
candidate's 17 rank reversals, are descriptive. No candidate is selected for
promotion. The Phase 5 blind review must preregister its primary utility
endpoint, regression margin, held-out repositories and maintenance pairs
before labels are opened. Existing reviewed examples are development data.

Reproduce with operator-prepared clean checkouts:

```sh
bun scripts/index-formula-experiments.ts \
  --manifest corpus/index-utility/manifest.json \
  --prepared-root /absolute/prepared-checkouts \
  --measurements corpus/index-utility/p32-reporting/current-measurements.json.gz \
  --out /absolute/artifacts/formula-experiments.json
```
