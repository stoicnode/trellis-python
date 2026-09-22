# Jev model-assisted index study

**Run date:** 2026-09-22  
**Status:** exploratory research evidence; no scoring change

## Why the proposed signal starts optional and unscored

An `ast-grep` match says that a syntax pattern is present. It does not establish
that the pattern is unnecessary, harmful, or safe to replace. Immediately adding
those matches to the index would also double-count some clone, complexity and
nesting evidence already measured by Trellis.

External execution creates a second problem. Trellis's default audit must run
offline without installed project tools, network access or credentials. A score
that changes when an optional binary is absent cannot be compared reliably across
machines or history. The first integration should therefore be an optional,
unscored provider with explicit availability and coverage.

Optional does not mean permanently excluded from scoring. Rules that survive
independent validation can be implemented in Trellis's native syntax inventory so
they run everywhere. Adding them to the index would then require a new measurement
identity, scoring version and baseline.

Jev has a different boundary. It is a hosted model, so it can only label research
data outside the audit surface. The product's no-model audit invariant prevents
Jev from becoming a CLI, SDK, fleet, CI or scoring dependency.

## Study design

The research harness is [`scripts/index-jev-study.ts`](../../scripts/index-jev-study.ts).
It uses OpenRouter's Decisions endpoint with the pinned request model
`typesafe/jev-1.13`. The response resolved to
`typesafe/jev-1.13-20260917`. The key is read from `OPENROUTER_API_KEY` and is never
written to an artifact.

The same frozen rubric asks three questions for every source record:

1. structural maintenance cost on four ordered levels, from no visible problem to
   severe cost;
2. the probability that a behavior-preserving structural refactor would reduce
   future maintenance cost;
3. the probability that the supplied source contains enough context for a reliable
   local judgment.

For SmellBench, the harness pins dataset revision
`12604372b4a89a54b39645b6c82557b3b9e68eca` and reconstructs before and after
source snippets from the 147 smell-injection diffs. It replaces the good/bad
identity with opaque ids and deterministically shuffles record order before sending
records to Jev. For the Trellis packet, it sends the already-blinded 120 excerpts.
Trellis flags and sampling strata are joined only after all model answers are saved.

The complete local artifact hashes, model identity, token use and reported cost are
recorded in
[`jev-v1-summary.json`](../../corpus/index-utility/study/jev-v1-summary.json).
The run used 555,531 input tokens and 42,590 output tokens; OpenRouter reported a
total cost of $0.023332302.

With `OPENROUTER_API_KEY` exported, reproduce the study against the separated
artifacts with:

```sh
bun scripts/index-jev-study.ts --live \
  --packet /absolute/index-study-v1/artifacts/reviewer-packet.json \
  --answer-key /absolute/index-study-v1/artifacts/answer-key.json \
  --out-dir /absolute/index-study-v1/jev-v1
```

The command performs billable network calls. Omitting `--live` fails before any
request, which prevents an ordinary test or audit from starting the model run.

## Results

### SmellBench

Across all 147 pairs:

- the injected bad version received a higher maintenance score in **83.7%** of
  pairs;
- the injected bad version received a higher refactor-value probability in
  **88.4%** of pairs;
- mean maintenance movement was **+0.400** on the 0–3 scale;
- both sides cleared the preregistered-style 0.5 evidence-sufficiency threshold in
  only **2.0%** of pairs.

The absolute ratings explain what “good” meant in this run. The 147 original
versions averaged **0.969/3** maintenance cost (median 0.940, interquartile range
0.635–1.245). Their dominant maintenance levels were 47 at level 0, 63 at level 1,
37 at level 2, and none at level 3. Mean refactor value was 0.354, with 7/147 at
or above 0.5. Mean evidence sufficiency was 0.300, with only 3/147 at or above 0.5.
These are “better side of a controlled pair” labels, not claims of flawless code.

The follow-up [`ast-grep` direction check](ast-grep-smellbench-validation/README.md)
tested the published 197-rule `scb-check` bundle against the same pairs. Its
matched-line coverage increased from 4.67% on the original side to 6.57% on the
injected side, but no individual rule cleared a 0.05 false-discovery threshold
after correction across the full screen.

Direction varied by smell family. Maintenance direction was strongest for dead
code elimination and deeply inlined methods (100% each). Data clumps and shotgun
surgery were weakest (66.7% each). The diff reconstruction therefore supplies a
useful directional check, but insufficient context for a strong absolute label.

### Blinded 120-sample packet

Jev considered 38 of 120 excerpts context-sufficient at probability 0.5: 23 flagged
and 15 matched controls. Across all samples, the maintenance score produced an AUC
of **0.508** for distinguishing flagged units from controls; refactor value produced
an AUC of **0.481**. These results are effectively chance separation.

The result changes by finding kind:

| Trellis finding | Samples | Mean Jev maintenance score |
| --- | ---: | ---: |
| `complexity.hotspot` | 20 | 1.276 |
| `executable.nesting` | 34 | 1.021 |
| `duplication.candidate.independent-executable` | 8 | 1.011 |
| `duplication.clone-group` | 21 | 0.400 |

The clone result has a direct context explanation: one isolated excerpt does not
show its matching copies. Jev cannot judge duplication that is absent from its
input. The combined flagged group consequently mixes locally visible structure
with relationship evidence the packet hides.

The unchanged packet request ran twice while the harness's unrelated SmellBench
ordering was corrected. Maintenance AUC moved from 0.509 to 0.508 and refactor
AUC from 0.479 to 0.481, so the chance-level conclusion was stable. The number of
samples clearing the 0.5 context threshold moved from 42 to 38. Jev probabilities
are therefore useful research observations, but they are not byte-deterministic
measurements suitable for the production index.

## Decision

This run validates Jev as a cheap directional research instrument for several
SmellBench families. It does not validate the 120 excerpt packet as a replacement
ground-truth study and does not support a scoring promotion.

The next run should give Jev complete function or class units and the relationship
context for each signal. Clone cases need all matching members; cross-file signals
need the relevant files or graph facts. Python and TypeScript results must be
reported separately because SmellBench calibrates Python only. The resulting model
labels remain triangulation beside public source labels and deterministic metrics.
