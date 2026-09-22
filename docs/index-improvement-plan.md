# Index measurement and calibration improvement plan

Status: proposed; implementation has not started. Recorded 2026-09-22 against
`63e71bba0da5ca761898ff03ebec936ffffa668c`, analyzer `0.4.0`, scoring
`0.4.0-provisional`.

## Objective and evidence

Make index changes reflect changes in production structural debt more reliably,
repair Python-specific measurement errors, and expose useful evidence that the
headline currently hides. Correct measurement before tuning weights. Preserve
the deterministic, offline, zero-footprint default, one shared core, no target
execution, and separation of safeguards and optional providers from scoring.

This plan follows the [evaluation handoff](research/index-utility-evaluation-handoff.md)
and [Python calibration record](python-score-calibration.md). The exploratory
review reproduced 12 pinned Python scopes and four existing TypeScript scopes
three times each, plus 22 synthetic audits and five Python syntax probes.
It did not establish independent quality labels or a defensible global cutoff.

The observed regressions to preserve as reproductions are:

| ID | Observation | Required outcome |
| --- | --- | --- |
| I1 | Adding 100 independent tests changes an unchanged production cycle from 12 to 4, in both languages | Test-only changes cannot dilute production cycle debt |
| I2 | Joining four cyclic components into one larger component changes 14 to 12 | Adding edges on a fixed node set cannot reduce cyclic burden |
| I3 | A Python typing-only/runtime pair is labeled a runtime cycle and scores 12; the explicit TypeScript equivalent scores 0 | Preserve confirmed typing-only edge identity |
| I4 | Adding a docstring changes a controlled Python score from 28 to 42 | Documentation-only edits preserve scored structural measurements |
| I5 | Flask export windows overlap themselves; Rich emoji and color tables match as clones | Distinguish independent executable copies from declarative repetition |
| I6 | Replacing a static Python import with a literal dynamic import changes 12 to 0 with a complete score | Resolve provable literals and expose remaining observation limits |
| I7 | Two Python overloads and one implementation become three functions with ambiguous identities | Count one executable implementation and retain its identity |
| I8 | CC 10 to 11 adds 26 complexity points, while CC 11 to 31 leaves that contribution unchanged | Retain useful severity sensitivity above the threshold |
| I9 | A module-level decision expression scores 0; the same expression inside a function scores 26 | Expose executable scopes beyond functions |
| I10 | Nesting below CC 11 has no hotspot; 11 of 12 Python scopes saturate erosion density | Surface missing review leads and evaluate better response curves |

The review bundle currently lives at
`/Users/bbr/.codex/visualizations/2026/09/22/01a0c957-4fa9-77d0-bfba-58d8d255e329/index-review/`.
It contains the evaluation, input manifests, raw measurements, probe source,
probe results, hashes, and a passing nine-gate log. Phase 0 removes reliance on
that machine-specific location. The observations above are sufficient to
understand the plan without that bundle.

## Delivery sequence

| Phase | Deliverable | Depends on | Scoring impact |
| --- | --- | --- | --- |
| 0 | Durable reproductions and acceptance contract | None | None |
| 1 | Production graph scope and Python semantic repairs | 0 | Versioned measurement correction |
| 2 | Documentation and clone measurement populations | 0; integrate with 1 | Documentation correction; clone candidates initially experimental |
| 3 | Additional located evidence and clearer reporting | 1 and relevant parts of 2 | Unscored additions |
| 4 | Candidate cycle, complexity, and clone scoring | 1–2; consume 3 where applicable | Research outputs only |
| 5 | Independent utility validation and scoring decision | 4 | Promotion only if evidence supports it |
| 6 | Release, compatibility, and migration | Each accepted release set | Explicit version transition |

Release A can ship accepted measurement corrections and advisory reporting
through Phase 6 before the human calibration study finishes. Release B changes
the formula or clone scoring only after Phase 5. Neither release needs an
arbitrary new factor or lower Python weights to make familiar libraries score
better. Select exact version numbers at each release cutover.

## Phase 0 — Preserve evidence and define acceptance

1. Convert the synthetic probes into small owned fixtures and adjacent tests;
   retain current behavior as clearly labeled baseline evidence, not permanent
   assertions that the defects are desirable. Add intended-behavior regression
   tests with their fixes so ordinary gates remain green.
2. Add a portable index-utility manifest under `corpus/`, referencing the
   existing 12 Python pins and the TypeScript pins for Zustand `src`, ts-pattern
   `src`, Ky `source`, and TanStack Query `packages/query-core`. Preserve exact
   source classification, commit/tree checks and unsupported-language coverage.
3. Reuse the existing calibration measurement harness and fixed-corpus tools;
   factor shared helpers only where needed. Accept prepared checkout and output
   paths as arguments. Never acquire dependencies or sources during an audit.
4. Retain compact baseline summaries and artifact hashes in the repository.
   Put larger raw results in a documented durable artifact location. Record
   provenance, commands, pinned runtime/tool versions, license obligations for
   any copied source, and three-run payload fingerprints.
5. Create tracker issues for the work items below when `sd` is available. These
   plan IDs are not tracker references and must not be used to satisfy source
   debt-marker rules. `ml` and `sd` were unavailable during the review.

**Exit:** another checkout can reproduce all counterexamples and the 16 scope
summaries without machine-specific imports or executing target code. Freeze
resource budgets and label existing reviewed repositories as development data.

## Phase 1 — Correct graph scope and Python semantics

### P1.1: Production-only scoring graph (I1)

- Construct an explicit production-induced graph view for scored cycle metrics.
  Keep full-workspace, test, and cross-source-set relationships as evidence.
  A production import of a test module must remain a located architectural
  finding even though the test module is outside the scored graph.
- Derive completeness from the selected nodes and relevant edges. Filtering
  nodes after inheriting whole-workspace incompleteness is insufficient: an
  unrelated malformed test must not withhold a complete production score.
  Overall report completeness may still describe that test failure.
- Give production cycle metrics explicit scope identity; retain historical
  repo-level metrics with their original meaning rather than silently changing
  an existing artifact's interpretation. Update formula references at cutover.

**Acceptance:** add/remove/rename independent tests and introduce test-only
cycles or parse failures without changing production score or production
cycle completeness. Production parse failures and ambiguous production edges
still withhold required dimensions. Exercise both languages, mixed workspaces,
empty production, self-edges, and cross-package cycles.

### P1.2: Python binding-aware typing and overload facts (I3, I7)

- Introduce a small shared static binding helper for confirmed imports,
  aliases, lexical scopes and shadowing; do not build a runtime interpreter.
- Recognize `typing.TYPE_CHECKING`, imported aliases, nested guards, negation
  where provable, and the distinction between guarded and `else` branches.
  Unknown or rebound names must not be assumed typing-only.
- Recognize confirmed overload decorators. Associate declarations with their
  implementation; exclude declaration-only bodies from executable function
  mass and preserve implementation identity. Retain distinct conditional
  implementations and orphan declarations as explicit facts.
- Preserve type-only dependencies. Whether they deserve the same scoring
  weight as runtime dependencies remains a Phase 4 experiment.

**Acceptance:** the reviewed mixed typing/runtime pair has no runtime cycle;
true eager cycles remain detected. Cover aliases, rebinding, qualified imports,
methods, async methods, overload-only declarations, and genuine duplicates.
Adding an overload must not inflate executable mass or churn an unchanged
implementation hotspot. `.pyi` support remains explicitly unsupported until
separately implemented; this task must not claim it accidentally.

### P1.3: Literal dynamic imports and graph observation limits (I6)

- Reuse binding facts to resolve literal `importlib.import_module` calls to
  discovered targets, including literal relative-package arguments. Specify
  support for `__import__` separately, accounting for its distinct arguments
  and return semantics. Leave unsupported forms located and unresolved.
- Distinguish eager, deferred, conditional and typing-only context in edge
  evidence without deleting architectural dependencies.
- Report the scored static graph scope and unresolved observation limits
  separately. Document which unknowns withhold which dimensions; do not
  claim a complete runtime graph or invent a numeric confidence percentage.
- Retain the declared-static-scope policy for genuinely runtime-selected
  imports unless a separately versioned policy decision changes it. Surface
  observation degradation on comparison and allow declarative coverage policy
  to gate it; a lower headline alone must not imply improvement.

**Acceptance:** static-to-provably-literal conversion retains the cycle.
Variable arguments, rebinding and ambiguous ownership never fabricate an
edge. Variable conversion produces visible unresolved evidence and coverage
change; both CLI and SDK expose identical semantics.

Primary seams: `src/python/imports.ts`, `resolve.ts`, `parser.ts`,
`src/syntax/`, `src/metrics/analyze-graph.ts`, `graph-types.ts`,
`analyze-cycles.ts`, `src/contract/`, and comparison/policy consumers.

## Phase 2 — Correct documentation and classify clones

### P2.1: Executable size versus documentation (I4)

- Identify actual first-statement docstrings in modules, classes and functions.
  Preserve physical SLOC for explanation and emit executable structural size
  separately. Ordinary runtime strings, including multiline strings, remain
  code under a documented rule.
- Use the executable population consistently in function mass and scored
  clone tokens, covered-line union and denominator. Removing documentation
  from only the denominator is not a valid correction.
- Preserve token/scope boundaries when ignoring docstrings; do not join
  unrelated blocks into an invented clone. Keep ranges on original lines.

**Acceptance:** insertion, removal, expansion and rewrapping of docstrings
preserve scored metrics and hotspot identity; diagnostic ranges may shift.
Cover module/class/function docs, comment-only edits, CRLF/Unicode, adjacent
strings, and real multiline data. Retain TypeScript comment invariance.

### P2.2: Independent executable clones (I5)

- Add AST-derived clone context: executable logic, import/export lists, type
  declarations, literal data, and mixed/unknown context. Preserve current raw
  detections while evaluating a separate candidate scoring population.
- Count independent occurrences using deterministic non-overlapping token
  intervals, with line overlap retained as additional evidence. Require two
  independent occurrences for a copy claim; do not drop a whole group merely
  because some of its members overlap.
- Compare statement-boundary matching and normalization that preserves literal
  kinds and identifier/literal equality relationships. Distinguish identical
  data copies from merely similar table shapes. No blanket file exemptions.
- Define density and copy burden over the same eligible token/line population.
  Keep exact raw clone metrics and candidate metrics separately identified.

**Acceptance:** export-list self-shifts and distinct emoji/color tables are
categorized without asserting duplicated implementation. Real executable
copies in `__init__.py`, dictionary-building code and renamed copies remain
detected. Cover same-line independent occurrences, overlapping and disjoint
copies, 2/10/40-copy cases, mixed contexts and resource exhaustion. Preserve
the independent small-input oracle and bounded work accounting.

Primary seams: `src/python/parser.ts`, normalized syntax facts,
`src/metrics/analyze.ts`, `erosion.ts`, `duplication-*.ts`, and their tests.
Clone population promotion waits for Phase 5; docstring correction can ship
with Release A after its documented semantics and acceptance are satisfied.

## Phase 3 — Cover blind spots and make evidence usable

### P3.1: Executable scopes and nesting (I9, I10)

- Add advisory module/class-initialization units with stable identities and
  explicit ownership. Separate nested function bodies from their enclosing
  initialization; specify ownership of defaults, decorators, class headers
  and comprehensions. Do not count a decision twice.
- Add located nesting findings independently of CC 11. Specify equivalent
  treatment of `elif`/`else if`, comprehensions, `match`/`switch`, exception
  handlers and nested functions rather than assuming parser-tree depth is
  cross-language cognitive difficulty.
- Keep these additions unscored initially; record raw severity and worst-unit
  changes even when the integer index remains unchanged.

**Acceptance:** the module-branching control becomes visible without inventing
a function or changing the authoritative score in this phase. Deep nesting
below CC 11 is locatable. Attribution, identity and TypeScript parity have
fixture coverage.

### P3.2: Explain burden, concentration, scope and change

- Present absolute burden and density together, including denominator changes,
  score saturation, exact dimension changes and top located contributors.
- Show production graph scope, type/deferred relationships, unresolved limits,
  unsupported files, and complete versus unknown dimensions prominently.
- Explain unchanged headlines with changed raw severity and distinguish
  analyzer/configuration changes from target-code changes. Recommend finding
  review and explicit metric budgets; do not introduce quality labels or a
  default global cutoff.

Primary seams: core report/comparison contracts, renderers and policy results.
Keep CLI and SDK as pass-throughs. Verify JSON, terminal, Markdown, fleet,
saved-baseline and history behavior from the same core facts.

## Phase 4 — Run isolated formula experiments

Use repaired measurements, not stale raw values, for every candidate. Retain
the authoritative formula unchanged while generating research artifacts.

| Experiment | Candidate | Acceptance property |
| --- | --- | --- |
| Cycle burden (I2) | Sum of SCC size minus one, plus self-loop burden; alternatively distinct cyclic edges | Adding edges on a fixed node set never reduces burden; SCC merging is not rewarded |
| Complexity severity (I8) | Sum of `max(0, CC - 10) * sqrt(executable SLOC)`; compare smooth variants | Reducing CC 31 to 11 reduces raw burden without needing a threshold crossing |
| Density response (I10) | Smoother bounded curves and separately reported count/density | Quantify saturation and sensitivity across scope sizes |
| Clone burden (I5) | Independent executable copies and their unique coverage | Similar table shapes do not dominate implementation debt; genuine copies remain visible |
| Edge-class treatment | Separate runtime and type-only burden | Preserve evidence without assuming equal maintenance or initialization cost |

Keep dimension weights fixed for the first ablations. Vary one measurement or
normalization at a time, then evaluate a small preregistered combined set.
Publish old/new raw values, exact contributions, rounded scores, saturation,
rank reversals, per-language/source-size slices, and resource costs.

Scope the guarantees precisely: edge-addition monotonicity holds on a fixed
node set; clean production additions may lower concentration but must not
erase absolute burden or existing findings. Integer rounding can hide a small
improvement even when exact burden changes. SCC burden is not a claim about
the minimum edges needed to break cycles. Do not simply add correlated CC,
nesting and size penalties or select constants to fit project reputation.

**Exit:** all structural invariants pass, counterexamples are explained, and
candidate selection rules are frozen before examining held-out labels. A
failed experiment remains an explicit result, not a production change.

## Phase 5 — Validate utility before promoting a formula

1. Predeclare a pilot of six additional repositories, balanced across languages
   and code roles, with ten flagged and ten random/matched unflagged units per
   repository: 120 units, two independent reviewers. Pin sampling seeds,
   audited scopes and commits. Existing reviewed examples are training data,
   not blinded or held-out evidence.
2. Hide Trellis scores and competitor outputs during review. Record structural
   cost, suggested action, confidence and intentional tradeoffs separately;
   adjudicate disagreements. Recruit human reviewers for independent labels;
   this dependency does not block shipping proven measurement corrections.
3. Select at least three TS and three Python maintenance before/after pairs
   from independently documented changes, plus comment, formatting, test-only,
   clean-addition and facade/data controls. Pin revisions before scoring them.
4. Prepare exact-version external tools separately: Radon/Xenon and Lizard for
   function-span/CC triangulation, jscpd for clones, dependency-cruiser and
   Import Linter for declared architecture, and Wily where useful for history.
   Record supported scope and non-comparability; tools are not scoring oracles.
5. Report actionable precision, missed problems in unflagged samples, review
   effort, directional agreement, coverage and uncertainty. Hold out whole
   repositories. Reserve an untouched confirmation set if results trigger
   further tuning; do not repeatedly optimize against the same holdout.

**Promotion gate:** before unblinding, record the primary utility endpoint and
acceptable regression margin. Promote only a candidate that passes every
hard invariant and meets that preregistered endpoint without an unexplained
language/size regression. A 120-unit pilot may be inconclusive: expand the
study or retain provisional scoring. Do not derive a universal cutoff from
rank stability, popularity, or synthetic controls alone.

## Phase 6 — Version and release each accepted change set

- Publish a semantic-change inventory covering metrics, populations, parser
  and graph identities, hotspot identities, clone identities, and formula.
  Bump analyzer/scoring identities when scored meaning changes; bump schema
  for contract shape changes. Do not assign new meanings to historical IDs.
- Update SPEC §§3, 5, 6, 7 and 9, Python support/calibration documentation,
  cleanup guidance and changelog. Name still-open limits and experimental
  metrics. Refresh golden artifacts only through documented update gates.
- Keep old reports readable; incompatible comparisons require fresh baselines
  and produce no invented deltas. Preserve historical versions and nullable
  scores in SQLite. Remeasure saved source snapshots when comparing formulas;
  old reports may not contain sufficient facts for recalculation.
- Verify CLI/SDK equality, policy exit codes, comparison, fleet and history.
  Newly required missing analysis withholds the headline. Optional evidence
  failures remain separate and cannot manufacture zero native debt.
- Run lint, typecheck, tests and `check:all`; rerun the fixed corpus, three-run
  16-scope measurements and self-audit at each release candidate. Review every
  unexplained movement and enforce existing resource budgets. No budget
  relaxation without the repository's tracker and commit requirements.
- Supply baseline migration commands, before/after contribution tables and a
  rollback path to the prior release and matching baseline artifacts. Do not
  overwrite history, silently rescore it, or claim a formula change improved
  the target code. Push or publish only on explicit user request.

## Subsequent advisory backlog

These are separate follow-ups after the correction release, not prerequisites
for it. Each needs a documented finding contract, positive/negative examples,
coverage limits and a review-utility pilot before any scored promotion.

| Work item | First deliverable | Constraint |
| --- | --- | --- |
| A1: Coupling and architecture | Fan-in/out, cross-package edges and declarative layer violations | Hubs are not automatically defects; preserve existing provider boundaries |
| A2: Python behavioral review leads | Bare/broad swallowed exceptions, mutable defaults, obvious global mutation and parameter load | Contextual advisory findings; do not claim a general bug detector |
| A3: Type and interface complexity | Boundary `Any`/suppressions and TS type-level complexity evidence | Annotation volume is not quality; keep dynamic designs valid |
| A4: Historical prioritization | Optional Git-derived change frequency beside structural burden | No Git requirement, cache writes or network in the default audit |
| A5: Refactor confidence | Optional coverage/mutation evidence with provenance | Test evidence never offsets structural debt |
| A6: Python coverage depth | Declared grammar/version conformance and scoped `.pyi`, decorator and async/resource research | No implied support for unmeasured syntax or runtime behavior |

## Suggested commit boundaries and completion

Start with Phase 0, then one focused commit per P1.1, P1.2 typing, P1.2 overloads,
P1.3, P2.1, clone classification, independent clone occurrences, P3.1 and P3.2.
Keep experimental formula tooling, study records, and eventual formula
promotion separate. All runtime behavior belongs in the core; avoid CLI-only
patches. Follow the repository's validation and local commit protocol.

Release A is complete when the accepted corrections pass their invariants,
all surfaces agree, the corpus is reproducible and migration is documented.
Release B is complete only after independent evidence supports a candidate and
the versioned release gates pass. Explicitly report inconclusive calibration
or deferred advisory work rather than treating a runnable score as validated.
