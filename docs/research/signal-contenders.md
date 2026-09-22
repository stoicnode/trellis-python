# Signal contender register

**Updated:** 2026-09-22

This is the running decision register for possible Trellis measurements, formula
changes and optional syntax evidence. It summarizes completed research; linked
records remain authoritative for methods and exact results.

Status meanings:

- **advance** — run the named independent validation next;
- **refine** — the idea has useful direction, but its current definition fails;
- **hold** — deterministic and plausible, but independent utility evidence is absent;
- **reject current** — do not implement or score the current definition.

No contender below changes scoring version `0.9.0-provisional`.

The [evidence audit](index-evidence-audit.md) qualifies the discovery results below,
including detector-derived clone cues in Jev packets and the edge-class confound
in the SCC experiment. The [ranked validation roadmap](index-validation-roadmap.md)
and its machine-readable manifests now define the next study execution order,
public-label holdouts, controls and decision gates. Earlier queue lists below
remain the historical candidate rationale, not a replacement validation contract.

## Measurement and formula contenders

| Contender | Evidence now | Status | Next independent gate |
| --- | --- | --- | --- |
| Independent executable clone burden | Full-context Jev maintenance AUC 0.815 on 8 flagged units; native 16-scope corpus separates executable copies from declaration/data repetition | **advance** | Pin real clone-removal changes and unchanged declarative repetition controls; require positive movement without penalizing controls, separately by language |
| Complexity severity above CC 10 | Existing hotspot flag: maintenance AUC 0.805 and refactor-value AUC 0.818 on 20 units; isolated formula is monotonic and responsive above the threshold | **advance** | Evaluate the severity formula on repository-held-out complexity-reducing refactors and behavior-preserving controls; compare with current eroded count |
| Executable nesting | Maintenance AUC 0.697 and refactor AUC 0.696 on 34 units; native finding already exists and is unscored | **advance after the first two** | Use accepted guard-clause/extract-method changes plus cases where nesting is necessary; measure added value beyond CC severity |
| SCC cycle burden | Passes fixed-node edge-addition monotonicity and avoids rewarding SCC merges; no independent labeled cycle-removal set | **hold** | Build accepted cycle-breaking before/after pairs and unchanged dependency-reorganization controls; require correct direction without using project reputation |
| Smooth density response | Removes finite-cap saturation and causes no rank reversals in the 16-scope experiment; no external utility labels | **hold** | Test change sensitivity on accepted structural cleanups and clean code additions before selecting a curve or constant |
| Runtime/type-only edge weighting | Preserves edge identity, but the proposed half-weight is only an assumed cost | **hold** | Find independently documented type-cycle and runtime-cycle removals; do not tune the weight without separate outcome evidence |
| `combined-v1` formula | Produces 17/120 corpus rank reversals and mixes several unvalidated changes | **reject current** | Rebuild only after individual components pass their own gates |

The Jev study measures relative ordering rather than score usefulness. Under its
frozen actionable threshold, 0/59 evaluable flagged units and 1/58 controls were
actionable. Jev therefore prioritizes deterministic validation; it is not a score
label or audit dependency.

## Optional syntax-evidence contenders

| Rule or bundle | Public labels now | Status | Next independent gate |
| --- | --- | --- | --- |
| `except-pass-silence` | Ruff S110: 3 TP, 0 FP, 0 FN; SmellBench: 0/147 original and 7/147 injected snippets matched | **advance** | Add a larger public clean-code negative set, including intentional exception suppression; then design optional unscored evidence with explicit coverage |
| `verbose-dict-update` | Ruff PERF403: precision 0.750, recall 0.955; all 4 accepted NumPy/Cirq changed regions matched before and cleared after | **refine** | Use the seven Ruff false positives and one miss as development cases, then confirm the revised rule on untouched accepted reviews |
| `verbose-list-append-loop` | Ruff PERF401: precision 0.676, recall 0.862 | **reject current** | Reconsider only with a narrower semantic pattern and a separate holdout |
| `redundant-return-none` | Ruff RET501: precision 0.250, recall 0.667 | **reject current** | Replace the current syntax pattern rather than tuning thresholds around it |
| Full 197-rule `scb-check` bundle | SmellBench coverage moves in the expected direction, but no rule survived the 0.05 multiple-testing threshold and rule/license identity is unsettled | **reject current bundle** | Validate selected rules independently; never treat all bundle matches as equivalent debt |

## Next queue

Run these in order because each can produce a clear stop or advance decision:

1. **Clone-removal pairs:** collect pinned accepted changes that remove executable
   copies, with declarative/data repetition controls and Python/TypeScript strata.
2. **Complexity-refactor pairs:** use public accepted extract-method, guard-clause
   and complexity-reduction changes to compare current count with severity.
3. **S110 negative controls:** test `except-pass-silence` against intentional
   suppression examples before building an optional provider/native prototype.
4. **Dictionary-rule refinement:** revise `verbose-dict-update` on known Ruff
   errors and confirm it on untouched accepted changes.
5. **TypeScript syntax queue:** select a small set of typescript-eslint rules with
   explicit valid/invalid fixtures so Python evidence is not generalized to TS.

For every queue, freeze revisions, rule identity, endpoint, language strata and
acceptance thresholds before reading the held-out result. Keep public labels and
model-assisted research separate in the report.

## Evidence records

- [Isolated formula experiments](../index-formula-experiments.md)
- [Full-context Jev study](jev-context-study.md)
- [SmellBench ast-grep screen](ast-grep-smellbench-validation/README.md)
- [Four-rule public-label validation](ast-grep-rule-validation/README.md)
- [Public labeled-source catalog](slopcodebench-labeled-sources.md)
