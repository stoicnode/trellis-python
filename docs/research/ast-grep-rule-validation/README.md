# Public-label validation of four Python ast-grep rules

**Run date:** 2026-09-22
**Status:** completed research queue; no audit or scoring change

## Method

This queue uses existing public labels and no new human review. The exact sources,
licenses, revisions and source hashes are recorded in
[`ast-grep-rule-validation-sources.md`](../ast-grep-rule-validation-sources.md).

[`run.mjs`](run.mjs) executes `ast-grep 0.42.1` with four rules from `scb-check`
revision `a8618228939def726c2ec48b354693e5aa1999d5`. It compares match ranges with
diagnostic start lines in Ruff's committed snapshots at revision
`caf021af3e5cb9c1480bc42e0981d65908be5f23`. Fixture comments are never treated
as labels. [`summary.json`](summary.json) contains the machine-readable confusion
counts, unmatched lines and hashes.

For `verbose-dict-update`, the harness also checks four accepted changes from
NumPy and Cirq. It requires a match in each changed region before the maintainer
change and no match in that region afterward.

## Results

| Rule | Public labels | TP | FP | FN | Precision | Recall | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `redundant-return-none` | 3 | 2 | 6 | 1 | 0.250 | 0.667 | reject current pattern |
| `except-pass-silence` | 3 | 3 | 0 | 0 | 1.000 | 1.000 | provisional evidence candidate |
| `verbose-list-append-loop` | 29 | 25 | 12 | 4 | 0.676 | 0.862 | reject current pattern |
| `verbose-dict-update` | 22 | 21 | 7 | 1 | 0.750 | 0.955 | refine before use |

Ruff's S110 fixture establishes positive recall for `except-pass-silence`, but it
does not provide a broad balanced negative set. The independent SmellBench screen
adds supporting direction: the rule matched 0/147 original snippets and 7/147
injected bad snippets. That is enough to retain it as a provisional optional,
unscored evidence candidate. It is not enough for index scoring.

The dictionary pattern found all four accepted before-change regions from NumPy
and Cirq, and all four regions were clean after the changes. This confirms useful
direction. Its seven Ruff-fixture false positives show that the current syntax
pattern is still too broad for general use.

## Decision

Only `except-pass-silence` advances to an implementation design for optional,
unscored evidence. Its design still needs an explicit coverage contract and a
larger clean-code negative corpus.

The other three definitions do not advance. Their public-label misses and false
positives are concrete refinement cases. `verbose-dict-update` remains the best
next refinement target because accepted maintainer changes support its direction.

No result changes the production index. A future scoring proposal must validate a
refined native rule on independent labels, measure overlap with current metrics,
and introduce a new measurement and scoring version.

## Reproduction

Prepare the pinned checkouts described in the source record, install exactly
`ast-grep 0.42.1`, then run:

```sh
node docs/research/ast-grep-rule-validation/run.mjs \
  --ast-grep /absolute/node_modules/.bin/ast-grep \
  --rules-dir /absolute/scb-check/src/scb_check/resources/slop_rules \
  --scb-root /absolute/scb-check \
  --ruff-root /absolute/ruff \
  --numpy-root /absolute/numpy \
  --cirq-root /absolute/cirq \
  --out docs/research/ast-grep-rule-validation/summary.json
```
