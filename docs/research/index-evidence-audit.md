# Index evidence audit

Recorded 2026-09-22 against `c77e1ef51a45b8be2f4dff6fe361a418c6511d3b`.
This is a research assessment, not a scoring change. The next executable research
contract is [the ranked roadmap](index-validation-roadmap.md).

## Decision

The evidence establishes reproducible measurement counterexamples and plausible
signals. It does **not** establish calibrated maintenance cost, a useful global
index cutoff, or independent incremental value for any proposed new score term.
Use public maintainer decisions for the next validation; use Jev only to discover
missing context and possible failure modes. “Pass” in the next studies means
support for a bounded signal, not authorization to change production scoring.

## Findings and consequences

| Evidence | Audit finding | Consequence for the next study |
| --- | --- | --- |
| [Contender register](signal-contenders.md), [Jev report](jev-context-study.md), [summary](../../corpus/index-utility/study/jev-context-v2-summary.json) | The positive class in the AUC is **Trellis-flagged**, not independently established maintenance debt. AUC 0.815 for eight clone candidates and 0.805 for 20 hotspots measure agreement with the sampling detector. | Candidate ranking is discovery evidence. Do not call these validated severity or clone-burden AUCs. Sample public decisions before calculating predictors. |
| [Context builder](../../scripts/index-study-context.ts), `cloneContext` | The packet says “Clone relationship”, includes the measured group id and member count, or explicitly says no measured clone overlaps. Hiding `flagKinds` does not blind this detector-derived cue. Verified in the hash-matching raw packet: 28 records contain explicit clone relationships; 92 report no measured clone. | Treat clone discrimination as exposed to predictor leakage. Neutralize relationship labels and compare context with/without detector cues only on discovery data. |
| Context builder and [Jev runner](../../scripts/index-jev-study.ts), `packetRecords` | Repository names, paths and code identity reach Jev. Public code may also be in model training. Lexical references are name matches, not resolved callers; the first eight favor source order. One clone representative does not show differences among normalized copies. | Mask repository metadata in Jev packets, retain exact copy differences and coverage, and never claim model-training independence. Public labels bypass this model-specific validity problem. |
| Jev excerpt versus full-context runs | Same 120 selected units, one successful run per packet, multiple packet changes, no randomized ordering or repeated crossover. Context sufficiency rises 38→117 and maintenance AUC 0.508→0.703, but packet size, relationships, cue exposure and stochastic variation change together. | Replace “mainly a packet-design failure” with “consistent with context sensitivity; cause not isolated.” Do not spend validation budget on another unreplicated Jev ranking run. |
| Jev summary | Finding-kind sample sizes total 83 across 60 flagged units. Membership overlaps. Each kind is compared against **all** controls, not its own repository/size/matching block. | Eight clone units are not eight independent discoveries. Preserve multi-label membership; cluster shared owners, clone families and repositories. |
| [Summary implementation](../../src/research/jev-packet-summary.ts), `summarizeSlice` | AUC uses all 60 flagged and 60 controls, including insufficient-context records. Evaluable means and actionable rates use the sufficiency filter. This is a denominator difference, not necessarily an erroneous calculation. | Publish all-sampled and evaluable denominators explicitly. Freeze missingness handling; never select evaluable samples using favorable model responses. |
| Jev language and repository slices | Languages have equal sample counts, but only three repositories per language. Repository maintenance AUC spans 0.510–0.870. TS refactor AUC is 0.563 versus Python 0.677. Equal sample counts do not remove repository/language confounding. | Require independent repository groups within each language, equal-language macro estimates, per-language gates, and leave-one-repository-out sensitivity. JS is not a TS holdout. |
| Frozen actionable endpoint | 0/59 flagged and 1/58 controls are actionable. The original [registration](../../corpus/index-utility/study/preregistration.json) specified two reviewers, combined-v1 and actionable precision; the human route was later retired. | Do not convert the post-amendment maintenance AUC into a successful preregistered primary endpoint. Relative discrimination and refactor worth are different claims. |
| [Formula experiments](../index-formula-experiments.md) | The 16 scopes are reused development data: 12 Python, four TS, selected package scopes and correlated language/size/domain. Rank stability, saturation and language means have no public quality labels. | Keep as deterministic regression/resource controls, not independent ranking validation. Neither higher Python means nor 17 combined-v1 reversals prove bias or harm. |
| [Formula implementation](../../src/research/formula-candidates.ts) | `cycle-scc-burden` uses `signals.cycle.all`, while authoritative cycles measure runtime and type-only graphs separately. This changes edge-class semantics as well as the count formula. | First compare SCC size burden with group count on the **same two class graphs**. Evaluate the union graph only as a secondary ablation; no inferred half-weight. |
| Formula severity and clone experiments | Severity changes scale 20→100 and weights CC excess by executable size. Clone replacement changes count definition **and** eligible-line denominator. | Separate raw signal utility, weighting/size confounding, count-only changes and density-only changes. Do not attribute the whole index delta to a single construct. |
| [Improvement plan](../index-improvement-plan.md) | Synthetic counterexamples demonstrate mechanical invariants. Self-audits and familiar-repository examples influenced repairs and candidate design. Selected accepted refactors can also move or delete code or add necessary complexity. | Retain invariants, but reserve all previously inspected projects for development. Track source movement, deleted behavior, coverage changes and helper destinations. “Merged” alone is not a maintenance label. |
| [Four-rule validation](ast-grep-rule-validation/README.md) | Ruff fixtures establish rule/configuration agreement. S110 typed mode has three positives and no useful near-miss set: reported precision 1.0 does not establish low field false-positive rate. Even 3/3 recall has a two-sided exact 95% lower bound of about 0.292. | Separate syntax conformance from contextual utility. Test accepted intentional suppression as a negative for a maintenance recommendation; keep it visible as neutral syntax evidence. |
| [Rule harness](ast-grep-rule-validation/run.mjs), `fixtureResult` | Labels are diagnostic **start lines**; matches are ranges. TP counts covered labels, while precision divides by match count. Many-to-many overlaps can distort precision; broad enclosing matches can earn credit for unrelated diagnostics. | Canonicalize constructs and use one-to-one bipartite matching to compatible diagnostic anchors; preserve duplicates as extra false hits. Current counts are not asserted wrong without a replay. |
| Dictionary review examples | Four changed files come from two merged PRs, one is test code, and one is a generator. The harness accepts overlaps with any changed hunk in each selected file, broader than the four described transformations. All four were already inspected. | Cluster by PR/repository; align the actual review target, distinguish test/generator populations, and reserve these pairs for development. Four files are not four independent production-maintenance labels. |
| [SmellBench screen](ast-grep-smellbench-validation/README.md) | 147 Python synthetic injections from seven projects; original code is not a clean label. Injection adds code, can cause ancillary smells, and can change parse/context completeness. Line normalization controls only one size effect. | Keep as synthetic direction/mechanism controls, not public maintainer validation. Report intended smell, changed mass, parsing and unaffected-region behavior. |
| SmellBench rule selection | No rule passes BH q≤0.05 across 197 tests. Shortlisting by direction/project spread after screening is still selection. S110 0/147 original hits does not estimate specificity against intentional suppression. | Do not reuse these samples as an untouched confirmation set, or generalize the entire bundle from selected hits. |
| SmellBench Jev ratings | Evidence sufficient for only 3/147 originals versus 81/147 injected snippets; presentation and context differ with the intended label. Both model and AST matcher respond to visible injection style. | “Independent Jev signal” means another instrument, not independent truth or unconfounded corroboration. |
| [Public-source catalog](slopcodebench-labeled-sources.md) | RefactoringMiner labels transformations; SWE-bench labels correctness; CodeReviewer un-commented hunks are unlabeled for structural quality; Architectural SmellBench is one preselected Python repository. Bandit/Ruff S110 share rule lineage. | Do not substitute any of these for maintainer-endorsed structural improvement or intentional-negative labels. No cross-source independence claim merely from a different repository name. |

## Conclusions that need narrower wording

1. Full context is associated with higher Jev discrimination; this run cannot
   identify why. Detector relationship cues are a concrete alternative explanation.
2. Complexity **flags**, not severity, were compared with Jev. Nesting's marginal
   AUC is not added value beyond CC/size. Clone AUC does not identify a copy-count
   response curve. SCC monotonicity is a mathematical property, not utility.
3. AST bundle direction does not establish that a provider is useful to operators.
   The engine is capable of deterministic matching; utility and rule scope remain
   separate gates. Reject the current bundle and overbroad patterns, not all syntax
   evidence.
4. Maintainer acceptance is evidence of a stated preference at a specific scope.
   It does not identify future incident reduction, effort saved, semantic
   equivalence, or a cardinal repository quality score. A successful study must
   retain that limitation.
5. CodeNet accuracy above 0.60 would not by itself prove confounding: correctness
   and structure can be related. Omit that expensive, weakly interpreted control
   from the minimal next program. Use exact invariance controls and real accepted
   fixes without assuming that fixes must lower structural burden.

## Reproducibility audit

All seven requested records were read, together with their relevant runners,
SPEC §§5/7/8 and the latest changelog. The three raw artifacts named by the Jev
v2 summary existed on this machine; their byte hashes matched the summary.
Repository-macro maintenance AUC recomputed from the six recorded repository
values is 0.711667, versus pooled 0.703056. This small difference does not remove
the broad between-repository variation. No new Jev run or external validation
was performed.

The committed Jev record still points to an absolute workstation artifact path.
Hash identity proves integrity when bytes are present, not durable availability.
The next program requires a portable content-addressed archive, labels, raw
responses, selection ledger and executable analysis version. Timing/RSS and model
responses are separate from deterministic measurement fingerprints.

## Primary-source checks for the next program

The existing source records supply the historical pins. Additional checks on
2026-09-22 confirmed these sources; availability is not a claim of sufficient
independent samples:

- Ruff [S110 documentation](https://docs.astral.sh/ruff/rules/try-except-pass/)
  defines a rule-level exception-handling check; its security/lint rationale is
  not a generic maintenance-cost label.
- The [RefactoringMiner accuracy record](https://github.com/tsantalis/RefactoringMiner/blob/master/documentation/accuracy.md)
  provides transformation-validation evidence, usable for extraction controls.
- [CodeReviewer’s data description](https://github.com/microsoft/CodeBERT/blob/master/CodeReviewer/README.md)
  describes code/refinement fields; records without recoverable repository and
  public review identity cannot enter the primary validation.
- TypeScript-eslint’s [no-extra-non-null-assertion tests](https://github.com/typescript-eslint/typescript-eslint/blob/33824c112228444e76159ecd317366c8067e40e9/packages/eslint-plugin/tests/rules/no-extra-non-null-assertion.test.ts)
  supply an explicit syntax-only valid/invalid development source. Revision and
  tree were resolved through the GitHub API. No Python-to-TS rule transfer is assumed.
- [Bandit’s exception examples](https://github.com/PyCQA/bandit/blob/68ebe11ef79263be27ec223184b94a4fc394a622/examples/try_except_pass.py)
  are development/conformance controls, not independent S110 validation.
