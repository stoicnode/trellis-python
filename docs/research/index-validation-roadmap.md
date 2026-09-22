# Ranked index validation roadmap

Registered design: 2026-09-22. Status: **designed, not executed**. Existing
scoring remains `0.9.0-provisional`. Read the [evidence audit](index-evidence-audit.md)
before interpreting prior AUCs. The machine-readable contracts are in
[`next-studies/`](../../corpus/index-utility/study/next-studies/README.md).
Those files are acquisition/study specifications, not fabricated populated
datasets or commands that already exist.

## Smallest decisive program

Use one public-change acquisition pipeline, one shared packet builder and one
paired-analysis runner. There are four data panels and five decisions: complexity
and nesting share a panel; executable clones, SCCs and syntax require different
units and controls. Do not run five separate repository surveys, another full
197-rule screen, or a combined formula search.

| Rank | Decision | Why this order | Maximum claim after passing |
| --- | --- | --- | --- |
| 0 | Lock sources, labels, splits and deterministic controls | Prevent reuse of exploratory evidence and false success from coverage loss | Reproducible research inputs |
| 1 | C1: severity beyond threshold count | Existing native facts; cheapest important scoring question | Severity adds sensitivity to maintainer-endorsed structural changes |
| 2 | D1: independent executable clone burden | Highest discovery priority, but eight Jev units and direct relationship cues are weak validation | Independent executable copies improve structural-change discrimination |
| 3 | N1: nesting beyond severity | Reuses C1 context; must test incremental value before double counting | Nesting contributes information beyond the frozen baseline |
| 4 | G1: SCC burden with fixed graph semantics | Mathematical benefit established; public cycle labels harder to acquire | A same-graph burden definition follows documented cycle repairs |
| 5 | A1: three optional syntax lanes | Cheap S110 negatives can run after rank 0, but syntax must not delay native evidence | Only passing language/rule lanes become candidates for optional unscored evidence |

N1 is independently preregistered and does not wait for a favorable C1 result.
Its baseline always includes the existing linear severity definition. If C1
fails, N1 can still establish advisory value; it cannot rescue a scored severity
proposal. Do not change its baseline to whichever formula wins C1. G1 union-edge
and type-cost experiments, smoothing, global thresholds and combined-v1 remain
outside the confirmatory program.

## Labels, acquisition and holdouts

The authoritative source is a public maintainer decision attached to code:
an accepted review suggestion with original/current ranges and accepted code,
or a merged, narrowly scoped PR whose maintainer-authored title/body explicitly
states the structural objective. Acceptance records the maintainer's preference;
it does not prove behavior preservation or future maintenance savings.

`sources.json` fixes repositories, date window, query terms, eligibility rules,
deduplication and finite retrieval limits. Read-only acquisition is a separate
network operation. It writes a source lock containing full commit/tree/blob hashes,
raw API response hashes, labels, licenses and split identities **before** native
predictors are computed. No model classifies labels. No fresh human judgments are
required: ambiguous intent, unlocated review comments, broad mixed-purpose PRs,
unavailable source and missing authority are recorded exclusions. An insufficient
public-label supply returns `incomplete`, not relaxed inclusion criteria.

“Refactor”, “cleanup”, an issue tag, a merged status, an un-commented hunk or a
tool warning alone is insufficient. A comment is eligible only when GitHub records
OWNER/MEMBER/COLLABORATOR authorship, and the accepted suggestion or narrowly scoped
change can be mapped mechanically. Freeze negative labels with equal care:
explicit accepted instructions to retain a structure are intentional controls;
rename/move-only, documentation and test-only changes are neutral **for specified
structural facts**, not labels that all surrounding code is clean.

All previously inspected repositories, their forks, the original 16 scopes, six
Jev repositories, NumPy/Cirq/Ruff and every SmellBench source repository are
development-only. Import their identities from the committed manifests and pinned
SmellBench records, not from names remembered by the implementer. Block exact
patches and normalized token/patch near-duplicates, backports, repeated reviews,
clone families and parent/child snapshots from crossing splits. Conservative
cross-repository duplicate components move together; components touching known
development data are development-only. Avoid counting multiple files in one PR
as independent observations.

For each language, select four development repository groups and eight validation
groups by the frozen SHA-256 ordering in `sources.json`; select eight further
groups as an untouched reserve. Selection can inspect eligible label counts but
not predictor outcomes. A group must support the panel quota; every rejected
group and reason remains in the acquisition ledger. If a selected group later
fails reconstruction, do not replace it after looking at results. Both snapshots
of every event stay together. Multi-language events are excluded from the primary
language panels and retained for future work.

Hold out Python and TypeScript/TSX as separate validation strata. Pool with equal
language weight, never by number of files. Also fit the frozen statistical
comparison on Python development only and test TS validation, then reverse it;
these transfer checks cannot select weights. No claim of language equivalence
unless both language gates pass. A missing TS panel does not permit a Python-only
index promotion. TSX coverage is explicit: no JSX in a panel means no TSX claim.

## Exact context and isolation

Each native run sees the complete pinned repository snapshot with a fixed source
classification and declarative resolver context. It never runs target commands,
imports target configuration code or downloads dependencies. Research artifacts
live outside targets. A before/after pair uses the same analyzer, grammar, graph
policy, clone thresholds and configuration. Hash source trees before and after.

The human-readable/optional Jev packet is a view of that snapshot:

- Complete enclosing executable owner, decorators/defaults/signature, and twelve
  source lines on either side, clipped at file bounds. Nested bodies retain their
  own ownership. Include all changed owners and newly extracted/moved helpers;
  do not credit disappearance of the old function as elimination of its burden.
- Complete enclosing class header and relevant field declarations; explicit
  module/class initialization owners where applicable. Include at most eight
  lexical usages selected by hash of `(path, range, text)` and ±3 lines each.
  Call them lexical usages, never proved callers. Record total and omitted counts.
- All import declarations in changed files and incoming/outgoing local edges,
  with runtime/type-only/deferred/conditional identity and unresolved reasons.
  Include declarative package/source roots and parser coverage, separately from
  labels. Tests referenced by accepted review suggestions are context only.
- D1 adds **all exact bodies** of the linked copy members, token ranges, unique
  source roles, and replacement helper/call sites. Deduplicate only byte-identical
  bodies with lossless references; a normalized representative cannot replace
  semantically different literals or bindings.
- G1 adds complete before/after production adjacency lists, SCC membership, all
  changed edge statements, and one-hop boundary imports for affected modules.
  Full repository measurement remains authoritative, even if the display is local.
- A1 adds the whole `try`/loop/assertion construct and enclosing owner, bindings,
  parser options, explicit suppression/intent context and, separately, exact
  expected diagnostic anchors. Expected anchors are absent from predictor/Jev input.

Store full packets without truncation. Jev packets have a 48,000 UTF-8-byte cap
per event-side; oversized packets are `context-unavailable` for Jev and remain
in deterministic validation. Both sides use the same builder and limit. Never
truncate only the worse-looking side or exclude native outcomes for a model
context failure.

Jev sees individual sides in balanced hash-randomized order, no PR/review text,
timestamps, before/after labels, score/metric values, rule ids, measured “clone”
labels or repository names. Replace paths consistently with opaque ids; retain
source text and disclose residual recognizability. Related code is headed
“Related source”, including for controls. Full source comparison may reveal a
refactor; no blinding procedure can eliminate public-code memorization.

## Shared sampling and statistical contract

The independent observation is a **change event**, grouped by PR and repository.
Each matched block has one public structural-improvement event and one neutral
maintainer change from the same repository/language/source role. Match on before
executable SLOC (ratio 0.5–2), changed executable lines (ratio 0.5–2, add one to
both counts), and merge dates within 730 days. Choose the unused minimum-distance
control; use sum of absolute log ratios, then date distance, then record hash.
If no control qualifies, record an unmatched event before measurement. Do not
match on the candidate, its change, its flags or its significance.

Primary sample per decision: 64 development blocks (four repository groups per
language, eight blocks per group), and 128 locked validation blocks (eight per
repository; eight groups per language). Thus development is 32 blocks/language; validation 64/language.
Each block contains two different PR events. C1 and N1 share cached snapshots and
neutral pools but use disjoint target PRs; no neutral is reused within a decision.
A reused control across decisions retains one cluster id. Syntax has its own
sample below. The precise counts in `common.json` are authoritative.

Define every change as `before − after`: positive means reduced burden. Measure
all features in the same affected scope and retain whole-production scope as a
separate check. Freeze the affected scope before computing candidate metrics:
all production owners intersecting accepted target ranges plus destinations
mapped by accepted suggestion paths or exact moved-token identity; if mapping
is ambiguous, use the union of complete changed production files. Clone and
graph features use the full production repository with localized evidence.

For C1/N1/D1 incremental comparisons, use a **research-only deterministic conditional
logistic comparison**, not Jev and not a deployed classifier. For each block,
compute `x = deltaFeatures(target) − deltaFeatures(control)`, then swap orientation
by the low bit of its SHA-256 id and set `y` accordingly. Fit on development only:
minimize mean binary log loss plus `0.01 × sum(beta²)/2`, no intercept. Scale
features by development RMS (zero RMS→1), without centering; clip standardized
features to ±10. Start beta=0; Newton steps with backtracking by halves until
objective decreases, stop at gradient infinity norm <1e-8 or 200 iterations.
Non-convergence is incomplete. Probabilities clip to [1e-12,1−1e-12] for log loss.
Do not tune penalty, feature sets or thresholds on validation. Report standardized
design-matrix rank (singular-value tolerance 1e-10) and feature correlations. If
the augmented columns add no rank, stop the incremental-information claim; a
different regularization parameterization is not evidence of a new construct.
For a pass, added burden coefficients must be nonnegative and at least one must
be positive in the frozen development fit; an inverse association cannot justify
a positive burden term. A sign failure refines the definition, without refitting
on validation.

Each of those manifests freezes baseline B and augmented A. Primary endpoint is
`gain = macro(logLoss(B) − logLoss(A))`, averaged within repository and then
equally across repositories/languages. Adding a term must improve prediction on
unseen repositories, not merely correlate with CC in the same files. Coefficients
remain research artifacts and never enter audit/scoring. Also publish matched
ordering accuracy (ties 0.5), raw positive-direction recall (ties fail), false
movement on neutral changes, and AUROC as secondary descriptive measures.

Use 20,000 stratified hierarchical bootstrap replicates: sample repository groups
with replacement within language, then blocks within each sampled group, retaining
all shared PR/clone-family observations together. Seed is in the manifest. Report
ordinary 95% intervals and multiplicity-adjusted one-sided bounds. C1/N1/D1/G1
each receive alpha 0.01; A1 receives 0.01 split across its three lanes. This
Bonferroni allocation targets a nominal five-family false-positive rate of 0.05;
bootstrap coverage remains approximate with this small number of repositories.
Slice and control gates are required intersections, not a menu of optional successes.
Eight repository groups per language give limited cluster precision; also report
all leave-one-repository-out estimates. Do not replace them with file-level p-values.

**Pass:** adjusted lower bound of gain >0, gain ≥0.03 nats/block overall,
each language point gain ≥0 and one-sided 95% lower bound >−0.02, and every
leave-one-repository-out pooled gain >0. Raw target burden decreases on ≥70% of
positive events in each language (except A1), with no adverse core-control result.
Pure burden-neutral controls must be exactly invariant; correctness controls
use the non-inferiority gate below. Additional per-study gates also apply.
G1 replaces the logistic endpoint and its
gain thresholds with the direct ordering endpoint specified below; it shares
sampling, multiplicity, coverage, repeatability and control requirements.

**Refine:** complete data and no hard failure, but pass conditions not all met
while the adjusted upper bound still includes a 0.03 gain. One revised definition
may use development data and a new registration; only unused reserve repositories
may validate it. Reserve counts must reach the same quotas by the same frozen
source procedure, or remain incomplete. Never repeatedly open the same holdout.

**Stop current definition:** adjusted upper bound <0.03, a language's one-sided
95% upper gain bound <−0.02, repeatability/invariance failure, or persistent
coverage/gaming failure. `Incomplete` (missing supply, hashes, context needed by
native analysis, convergence or coverage) is separate from evidence against the
hypothesis. Allow no more than one refinement. A second failed confirmation stops.

Sample rationale: this is a screen for useful effects, not tiny advantages. At
128 blocks, mean within-block loss-difference SD 0.15 and design effect 1.7
(eight blocks/group and assumed ICC 0.10), effective n≈75 and SE≈0.017. A true
gain around 0.06 has roughly 80% power against zero at one-sided alpha 0.01;
smaller effects often refine. These are planning assumptions, not measured power.
Publish achieved cluster variance and detectable effect without enlarging the
sample after results. Large heterogeneity or rare labels can make this minimal
study inconclusive. The nesting gate deliberately requires a useful improvement;
the program is not designed to prove every weak correlated signal useful.

## C1 — Complexity severity versus threshold count

**Hypothesis/unit/labels:** adding continuous above-threshold severity improves
identification of accepted complexity-reducing changes over CC>10 count and size.
Unit is the affected executable-owner union for one PR. Public labels must
explicitly request reduced complexity, simpler control flow, or extraction to
simplify named logic; extraction/rename labels alone are neutral transformations.
Repository/language splits, packet, repeatability and sample follow the common
contract. The manifest is [`c1-complexity.json`](../../corpus/index-utility/study/next-studies/c1-complexity.json).

**Predictors:** `C=sum(CC>10)`, `S=sum(max(CC−10,0)*sqrt(L))`, `U=sum(max(CC−10,0))`,
`Q=sum(CC−1)`, executable SLOC L, function count F and current eroded mass
share R. Baseline uses ΔC, ΔL, ΔF and ΔR; augmented adds ΔS. This prevents
crediting severity for information already present in the current density term.
Report count-and-size-only B as a secondary comparison. A preregistered unweighted alternative adds ΔU instead of ΔS;
report whether weighting adds anything over it. Also report CC-sum-only and
SLOC-only comparisons, linear/smooth severity as descriptive ablations and
CC≤10, threshold-crossing, CC>10-on-both-sides strata. Do not select the smooth
curve or scale 100 from these results.

**Controls/additional gates:** docs/comments/formatting, renames, exact code moves,
helper extraction that merely relocates decisions, and accepted feature/bug fixes
that add required branches. Count all helper bodies at destination. At least
16 validation positives/language must remain above CC10 on both sides with
unchanged C; ≥70% must have S decrease, using fixed owner mapping. Lack of this
stratum makes the severity claim incomplete. Weighted S must be non-inferior to
U: one-sided 95% lower bound of loss(U)−loss(S)>−0.02. Otherwise refine to the
simpler unweighted definition on reserve data; no claim for sqrt(L).

**Jev, optional development only:** “What concrete behavior-preserving change
would reduce maintenance cost?”, “Would this only move decisions into helpers?”,
and “Is enough caller/type context present?” Responses diagnose counterexamples,
never supply target labels or select thresholds.

**Implementation:** recover public target ranges; build complete owner unions;
reuse native CC/executable size and `complexitySeverity`; freeze the two nested
comparisons; generate transformed controls; measure both snapshots; run the common
endpoint and no-threshold-crossing slice; write per-owner and event outputs.

## D1 — Independent executable clone burden

**Hypothesis/unit/labels:** independent executable-copy burden discriminates
accepted removal of repeated implementation beyond raw clone groups, CC and size,
without treating repeated data/declarations as implementation debt. Unit is a PR
and all linked copy families, measured over its complete production scope. Accept
explicit maintainer requests to remove duplicated code/share an implementation;
generic “DRY” without located code is discovery-only.
[`d1-clones.json`](../../corpus/index-utility/study/next-studies/d1-clones.json)
uses the common holdouts, sample and endpoint.

**Predictors:** native raw group count and covered lines; candidate independent
copies and unique covered executable lines; candidate eligible lines; ΔCC decision
sum, Δseverity, Δnesting, ΔL and ΔSCC. Use the shipped candidate definition and
postfilters at the frozen analyzer hash, not a newly optimized detector. Baseline
contains raw clone count/coverage/density plus the other burdens; augmented adds candidate
copies/covered lines. Denominators remain raw separate features and outputs.
Count-only and density-only formula replays are descriptive; do not let a smaller
denominator be mistaken for a better clone detector.

**Controls/additional gates:** accepted retained table/locale/schema/export-list
repetition; self-overlapping windows; renamed executable copies; meaningful literal
differences; same-line independent copies; 2/10/40-copy probes; whole-copy moves;
unrelated clean executable additions. At least 32 intentional/declarative controls
per language from ≥4 held-out repositories are required: at least 16 declarative/
data targets must have zero executable candidate matches, and at least 16 retained
executable-copy events must have zero copy-burden delta when bodies are unchanged.
Existing necessary copies remain visible; they are not false geometric measurements
or automatic abstraction recommendations. Any
candidate-only resource stop is incomplete, never zero burden. Removing code from
discovery scope cannot count as clone elimination. The correct-target clearing
rate must be ≥70% per language, with all other copies and helper destinations
still accounted for. Independent membership is a geometry claim, not semantic
equivalence or proof an abstraction is warranted.

**Jev:** ask which differences between exact copy bodies are essential and whether
an abstraction would create coupling. Never say the packet contains a clone finding.

**Implementation:** recover linked targets from review/suggestions; measure the
whole repository; build cross-snapshot family ids from exact ranges/token hashes;
retain raw/candidate membership and rejection reasons; run invariance probes;
evaluate incremental utility and intentional negatives; record numerator and
denominator movement separately.

## N1 — Incremental executable nesting

**Hypothesis/unit/labels:** nesting adds maintenance-change information after
severity, total decisions, size, clone burden and cycles are accounted for. Unit
is the same affected-owner union as C1. Positive public requests explicitly name
flattening control flow, reducing nesting or using guard clauses; extraction alone
does not qualify. C1 and N1 target PRs are disjoint, while reconstruction is shared.
[`n1-nesting.json`](../../corpus/index-utility/study/next-studies/n1-nesting.json)
fixes the common sample/holdouts and a genuinely nested comparison.

**Predictors:** `N=sum(max(maxControlDepth(owner)−2,0))` over native executable
owners, plus maximum depth as descriptive evidence. Baseline includes ΔC, ΔS, ΔQ,
ΔL, ΔF, Δcandidate-copy count and Δsame-class SCC burden; augmented adds only ΔN.
Use [native control-depth ownership](../executable-scopes.md), not AST depth;
definition-time expressions and module/class scopes remain visible. Do not add N
to production severity on the strength of a marginal AUC.

**Controls/additional gates:** accepted retention of nested transaction/resource/
exception scopes, traversal logic, equivalent `elif` chains, comprehensions,
and nested definitions that must reset depth. Include at least 16 validation
positives/language with CC≤10 on both sides, and 16 where severity changes by
≤5% of max(1,before severity). These strata may overlap. Require ≥70% correct
direction in the below-threshold slice. On 32 intentional-retention events/language,
unchanged nesting must have ΔN=0; legitimate high N is not a false measurement or
an automatic refactor recommendation. Necessary increases join the accepted-fix
non-inferiority panel. Publish residual correlations and the severity-stable slice;
do not exclude adverse cases based on CC after results.

**Jev:** “Does the nesting encode required lifetime/order constraints?”, “Can an
early return preserve cleanup and exception semantics?”, “What omitted context
could reverse that conclusion?” Discovery only, no synthetic equivalence labels.

**Implementation:** reuse the common census/context and native executable owners;
compute N without reassigning nested function bodies; build exact/approximate
severity-stable slices; fit B and B+N on development; evaluate on frozen validation
and transfer strata; stop if benefit disappears after adjustment.

## G1 — SCC cycle burden

**Hypothesis/unit/labels:** SCC size burden tracks maintainer-endorsed cycle
removal more reliably than number of cycle groups on identical observed graphs.
Unit is one accepted dependency-change PR and the complete production graph;
nodes/SCCs/files within it are not separate samples. Positive labels explicitly
name breaking/removing circular imports/dependencies at located files. Dependency
reorganization alone is a neutral candidate.
[`g1-cycles.json`](../../corpus/index-utility/study/next-studies/g1-cycles.json)
uses the common quotas/holdouts and its own ordering endpoint; inability to source rare
TS or Python repairs is an honest incomplete result.

**Predictors:** on **each of runtime and type-only graphs separately**, compute
`B=sum(|SCC|−1 for cyclic SCCs)+number(distinct self-loops)`; sum class burdens
using the existing class accounting. Compare B directly with the sum G of the
same class-separated group counts. Preserve affected-module union, per-class
cyclic module counts, nodes/edges, ΔS and ΔL as explanatory covariates. B is
algebraically related to group and cyclic-node counts; a nested regression over
those facts would confuse new information with reparameterization. Distinct
internal cyclic edges is a frozen secondary alternative. A union graph is a
separate descriptive ablation, never folded into the primary result. No half-cost
for type-only edges is assumed.

**Primary endpoint override:** for each block, Q(X)=1 if target ΔX exceeds neutral
ΔX, 0.5 if tied, and 0 otherwise. Gain is equal-repository/equal-language mean
Q(B)−Q(G). Pass requires gain≥0.15, adjusted one-sided lower bound >0, point gain≥0
in each language and each language's one-sided 95% lower bound >−0.10; all pooled
leave-one-repository-out gains must be positive. Raw B must decrease in ≥70% of
positive events/language. Stop if adjusted upper gain bound <0.15 or a language's
95% upper gain bound <−0.10; otherwise refine if complete and hard gates pass.
The same 128 validation blocks screen for a large ordering gain: with SD 0.5 and
design effect 1.7, SE≈0.058, giving roughly 80% power for a gain around 0.20 at
alpha 0.01. This tests a better response definition, not an independent latent
architecture factor. Do not interpret lack of incremental rank over identical
graph facts as evidence that SCC size cannot improve the formula's behavior.

**Controls/additional gates:** unchanged graph under alias/path reorganization,
repeated import statements, adding acyclic production modules, adding tests,
literal static→dynamic conversion, type-only edge identity, unresolved imports,
SCC merges and partial edge removals that leave an SCC intact. Run exhaustive
four-node edge-addition probes per class; repeat enumeration orders. Fixed-node
edge additions must never reduce B; clean additions cannot erase absolute B.
At least 16 public partial-repair events/language must be reported separately;
if too few exist, the general cycle-repair claim is incomplete. B need not detect
every removed redundant edge: measure that ceiling rather than calling it minimum
feedback-edge cost. Coverage degradation or runtime-selected edges may never
earn a successful direction outcome.

**Jev:** normally omit; adjacency completeness and stated maintainer intent are
more useful than a language-model graph-cost opinion. On development only, ask
whether eager initialization versus type coupling changes the rationale.

**Implementation:** reconstruct both complete production graphs under fixed
resolver configuration; implement same-class B in research; compare it with the
existing union candidate to expose semantic differences; test graph invariants;
join public target edges; evaluate grouped events and coverage changes.

## A1 — Optional AST syntax evidence

Three separately gated lanes, never a bundle-level pass:
Python `except-pass-silence`, Python refined `verbose-dict-update`, and TypeScript
`no-extra-non-null-assertion`. The last is intentionally syntax-only; type-aware
rules require another study. The manifest is
[`a1-syntax.json`](../../corpus/index-utility/study/next-studies/a1-syntax.json).

**Hypothesis/unit/labels:** a narrowly scoped rule recognizes independently
maintainer-endorsed cleanup targets while avoiding explicit retained/valid targets.
One construct is the localization unit; one PR and repository are dependence
groups. Ruff/Bandit and typescript-eslint valid/invalid fixtures are development
and conformance evidence. Only untouched public reviews from the held-out
repositories validate contextual utility. The existing Ruff errors and four
NumPy/Cirq files must not reappear as validation.

**Predictors/context:** exact native/ast-grep syntax match, compatible construct
anchor, rule/configuration/parser hash, and explicit applicability state.
Keep diagnostic detection separate from a maintenance recommendation. S110 can
neutrally report a suppressed exception while honoring an explicit source-level
`noqa: S110` suppression for recommendations. A public intentional-negative label
without that source marker is still a negative test; the detector must not read
the label to decide applicability. Such cases may disprove contextual utility.
Fix mode/configuration
and inclusion of typed exceptions before validation. Dictionary scope initially
requires a synchronous loop consisting solely of an assignment to a preexisting
local dictionary, with no filter/else/additional statement or assignment-expression
side effect; binding/type facts not statically established are `unsupported`.
TS scope is nested redundant non-null assertions only, not arbitrary claims about
nullable runtime values. Record output for all syntactic opportunities, including
abstentions, so a rule cannot get perfect precision by declining hard positives.

Use maximum-cardinality one-to-one matching between compatible construct anchors
and diagnostic ranges, tie-breaking by source start/ordinal. Extra matches are
false positives; unmatched expected targets are false negatives. Preserve
suppression/configuration modes and safe/unsafe-fix annotations. Never use broad
line coverage as the matching unit or treat arbitrary unmatched project code as
clean. Full packet contents follow the common contract.

**Sample/holdouts:** per lane, all known fixtures for development plus 64 accepted
positive targets and 128 explicit intentional/valid negatives from eight fresh
repository groups (8 positive and 16 negative targets/group; max one per PR).
Positive before/after sides count as one event, not two independent labels. S110
and dictionary are Python-only; the TS lane stands alone, reporting TSX separately.
At least half the negatives must be near-misses of the syntax family, not unrelated
code. Shortage is incomplete, not a reason to label ordinary code clean.

**Primary endpoint:** contextual target sensitivity at a fixed false-positive-rate
ceiling, evaluated independently per lane. Pass requires sensitivity ≥0.80,
specificity ≥0.95, accepted-target clearing ≥0.80, applicability ≥0.90 overall
and ≥0.80 within every registered subtype. Require one-sided Bonferroni bounds
(alpha 0.01/3) of sensitivity >0.65 and FPR <0.05; use the more conservative of
exact binomial and repository-bootstrap bounds. Zero FP/128 gives an exact upper
bound about 4.36%, so this minimal panel can pass only with very few errors.
Clustering can widen uncertainty; that is a valid refine result. Require 100%
deterministic repeats and no production-score movement from enabling evidence.

**Refine/stop:** refine once if observed rates meet the point thresholds but
intervals do not, or sensitivity ≥0.65 and FPR≤0.10 with correctable development
errors. Stop current lane if sensitivity <0.65, FPR>0.10, coverage gaming,
repeatability failure, or a second confirmation fails. A failed language/rule
does not block a different lane, and a Python pass never implies TS support.

**Controls/Jev/steps:** intentional exception suppression, logging/rethrowing,
typed exceptions, async/filter/side-effect dictionary loops, and necessary single
TS assertions are frozen near-misses. No-op/comments/line shifts preserve anchors.
Jev is optional for development context-sufficiency questions only. First test
fixture extraction and mode binding; refine on known failures; freeze a clean
native definition or separately prepared pinned ast-grep rule; acquire independent
reviews; run one-to-one localization and coverage analysis. Do not redistribute
scb-check rule files while license identity is unsettled. An unavailable artifact
is `unavailable`, not a zero-match pass. Passing supports a provider design with
the existing controlled-process/staging boundary and unscored namespaced evidence.

## Shared controls, repeatability and missingness

Generate five matched metamorphic controls per development and validation source:
comment/docstring-only change, line-ending/whitespace change that preserves parsed
tokens, test-only addition, exact owner move with adjusted static imports, and
unrelated acyclic executable addition. Validate transformation preconditions;
failed construction is an explicit control-generation error. Absolute target
burdens must be equal (tolerance 1e-12 for real-valued aggregates); density and
physical location movement are reported separately. A pure move must preserve
owner-union burden; if it changes measured SCC topology, it is not a graph-neutral
control. These synthetic controls establish invariants, not public quality labels.

Add 64 independent accepted correctness-fix events/language, eight per held-out
repository, from the same public acquisition window and frozen fix selector.
They are not structural positives. For each formula replay, define
`E=(after−before candidate exact index)−(after−before authoritative exact index)`.
Non-inferiority requires one-sided 95% upper bound of equal-repository mean E≤1
index point in each language, and ≤5% of events have E>5. Report necessary burden
increases without calling them bugs in the metric. N1 and A1 stay unscored, so
require exact authoritative-score equality when their evidence is enabled. A
failed margin stops formula promotion, not necessarily raw advisory evidence.

Run every native input three times with fixed clock and stable serialization;
repeat once on a second prepared OS/architecture. Payload fingerprints must be
identical after excluding elapsed time/RSS/absolute checkout path. Compare exact
numeric metrics within 1e-12 across architectures as a separately reported check;
different semantic hashes still block the reproducibility pass. Run a perturbed
file-enumeration order for graph/clone inventories. Record runtime median/p95,
maximum RSS and candidate-only work-limit states; do not borrow shared-process
RSS as per-audit cost.

If Jev is enabled, use only 24 development event pairs balanced by language and
study family, three identical-packet repeats and three reversed-order repeats,
one side/request. Freeze resolved model id, rubric and request settings; report
mean absolute score deviation, SD, Spearman rank correlation, decision agreement
and context-sufficiency flips. Median pairwise rank correlation <0.80 or decision
agreement <0.80 stops Jev use for that discovery question, not the native study.
The questions use the same 0–3 maintenance rubric and separate refactor/context
probabilities as prior work. Define actionable as evidenceSufficient≥0.5,
P(maintenance≥2)≥0.5 and refactorValue≥0.5. No Jev outcome changes inclusion,
endpoints or labels.

Record every selected event, including failures. Comparable native coverage must
be ≥95% in each language and label class, and class coverage difference ≤5 pp.
Also report an intention-to-evaluate sensitivity assigning missing augmented
predictions p=0.5 while retaining available baseline predictions (both missing→0.5),
plus a worst-case ordering analysis where missing positives fail. Primary pass
must survive the p=0.5 sensitivity. Graph observation loss and clone work limits
count as failed direction outcomes, never apparent improvements. An entirely
unobserved metric is null with a reason.

## Artifact and implementation contract

The [JSON Schema](../../corpus/index-utility/study/next-studies/artifact.schema.json)
defines source-lock, event, measurement, prediction and decision records. Retain
full raw reports, packet/source/label hashes, scope maps, matching assignments,
bootstrap seed/replicate hashes, fitted coefficients, omissions and every decision
gate. Source labels live separately from predictor inputs; the outcome join runs
only after prediction files and their hashes are sealed. Schema validation alone
does not prove provenance: verify hashes, unique ids, disjoint clusters, quotas,
public authority and all before/after mappings as cross-record constraints.

Implement in these focused steps, without changing audit entry points:

1. Add research-only acquisition/lock tooling. Resolve exact source/API revisions,
   archive responses and licenses, build labels with frozen literal/regex selectors,
   group duplicates, assign splits, and produce an exclusion/shortfall ledger.
2. Add offline schema/provenance validation and prepared-checkout reconstruction.
   Default research execution refuses unsealed locks. Preparation may fetch public
   sources explicitly; measurement never fetches or executes target tests/scripts.
3. Extend research census/context helpers for owner unions, complete clone bodies,
   same-class graphs, strict fixture anchors and lossless source references. Keep
   product behavior in its existing core; expose no new model or research command
   through CLI/SDK/fleet/CI.
4. Implement frozen feature extraction and controls, then paired statistical
   comparison and decision gates. Analyze development first; write a freeze record
   with tool hashes/configuration/feature set before validation measurements run.
5. Seal validation predictions, join public labels, generate every language/repo/
   size/source-role slice and decision. Cache measurements across panels. Do not
   auto-refine after seeing results; emit the prescribed reserve-study registration.
6. Run lint, typecheck, tests and the canonical quality gates for implementation.
   CI may test owned deterministic research fixtures, but must never launch live
   acquisition, Jev, a public study sweep or consume model-derived grades.

Suggested future commands are `prepare-index-study`, `lock-index-study`,
`measure-index-study` and `summarize-index-study` under research tooling; these are
implementation interfaces, not currently shipped commands. Each accepts explicit
manifest/prepared-root/output paths. No study here automatically changes weights,
versions, policies, provider defaults, source exclusions or published artifacts.
