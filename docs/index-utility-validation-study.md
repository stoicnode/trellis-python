# Archived human-review index utility pilot

Status: archived on 2026-09-22. The project will not recruit human reviewers for
this study. The generated 120-sample packet and preregistration remain as a
reproducibility record and must not be treated as completed validation.

The replacement is the
[public labeled-source validation plan](research/slopcodebench-labeled-sources.md):
paired code-smell injections and reversals, existing expert labels, maintainer
rule fixtures, accepted-fix controls and iterative SlopCodeBench trajectories.
Any Release B scoring promotion must pass that repository-held-out validation;
the Release A measurement corrections remain independent of it.

## Archived protocol

The census and reviewer packet were generated before the protocol was retired.
The [artifact record](../corpus/index-utility/study/generated-artifacts.json)
locates them outside the repository and records their hashes. It contains
5,920 production function units and a 120-sample blind packet: 20 per
repository, split into 60 flagged and 60 matched-unflagged units. A repeated
generation produced identical census, JSON packet, Markdown packet, answer
key and source-record hashes. They are retained for auditability only.

The machine-readable [preregistration](../corpus/index-utility/study/preregistration.json)
pins six repositories that are absent from the development corpus: three
Python and three TypeScript scopes, with one library, framework and developer
tool per language. It pins exact commits, scope paths, seed, sample size and
regression margins. The commit pins were recorded on 2026-09-22. Source must
be acquired and license obligations recorded outside an audit, then verified
clean before census generation. Auditing never downloads it.

## Sampling and blinding

Each repository contributes 10 signal-positive production units and 10
unflagged controls, matched greedily by unit kind and size bucket, for 120
units total. [`buildStudySample`](../src/research/study-sampling.ts) hashes the
fixed seed, domain and stable unit id to select and order units. It emits a
reviewer packet with opaque ids and a separate answer key. The reviewer
packet contains no finding kinds, metric values, Trellis scores, candidate
scores or competitor outputs. A short source excerpt and necessary lexical
context may be attached without revealing selection strata.

The prepared census is a JSON array matching `StudyUnit`: stable unit id,
repository, language, role, path, kind, `small|medium|large` size bucket and
all applicable flag kinds. Generate the two separated files outside the
audited checkout:

```sh
bun scripts/index-study-sample.ts \
  --units /absolute/study/unit-census.json \
  --preregistration corpus/index-utility/study/preregistration.json \
  --reviewer-out /absolute/study/reviewer-packet.json \
  --reviewer-md-out /absolute/study/reviewer-packet.md \
  --key-out /absolute/study/answer-key.json
```

Two reviewers independently record for every unit:

- structural maintenance cost: 0 none, 1 minor, 2 material, 3 severe;
- suggested action: leave, document tradeoff, monitor, or refactor;
- confidence: low, medium, or high;
- whether the structure is an intentional tradeoff, with free-text reason;
- minutes spent.

An **actionable** unit has cost 2 or 3 and action `monitor` or `refactor`.
Reviewers may not discuss cases before submitting their first judgments.
Disagreements on actionable status are adjudicated after both submissions;
the original judgments remain in the result.

## Frozen decision rule

The primary candidate is `combined-v1` from the Phase 4 artifact. The primary
endpoint is actionable precision among its flagged units, estimated with a
repository-clustered bootstrap and a 90% interval. It must be no more than
5 percentage points below the authoritative population. Neither language nor
any preregistered size slice may regress more than 10 points. Report missed
actionable problems in matched controls, review minutes, agreement before
adjudication, coverage, and every interval. These are promotion requirements,
not evidence that `combined-v1` is expected to pass.

The candidate must also pass every hard measurement invariant and show
directional agreement on at least 5 of the 6 independently documented
maintenance pairs with no opposite movement larger than 0.5 exact index
points. The [pairs](../corpus/index-utility/study/maintenance-pairs.json) pin
three changes per language before scoring. Add comment-only, formatting-only,
test-only, clean production addition, and facade/literal-data controls from
immutable copies before running any formula; report them separately and do
not count them as documented maintenance improvements.

If the interval or a slice is inconclusive, retain the provisional formula
and expand with whole repositories. Any tuning after unblinding uses a new
development set and leaves an untouched confirmation set. A universal cutoff
cannot be derived from this pilot.

## External triangulation

The [tool manifest](../corpus/index-utility/study/external-tools.json) pins
Radon 6.0.1, Xenon 0.9.3, Lizard 1.24.0, Import Linter 2.15 and Wily 1.25.0
by primary wheel digest, plus the repository-locked jscpd 5.2.1 and
dependency-cruiser 18.3.1. Install these into a separate research environment
with a generated transitive lock before use. Their outputs remain hidden from
reviewers and are reported as triangulation:

- parser spans and CC definitions differ across Radon, Lizard and Trellis;
- clone tokenization and copy accounting differ in jscpd;
- dependency-cruiser and Import Linter assess declared architecture rules,
  not generic cycle quality;
- Wily requires Git history and therefore cannot describe the default audit.

None is a scoring oracle, and absence of an external finding is not a clean
label. The final record must include exact commands, resolved transitive
versions, supported files, failures and excluded scope.
