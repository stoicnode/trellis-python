# Trellis Hotspot Refactors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the high-confidence architecture seams and investigate the two conditional seams while preserving deterministic evidence and scoring.

**Architecture:** Share provider lifecycle accounting and cleanup in the existing staged-run boundary; move import-site extraction into syntax so graph metrics consume already-parsed facts. Only consolidate raw-provider ordering or policy ownership if the interface becomes smaller than the duplicated code. Never change native scoring or provider coverage claims to improve the number.

**Tech Stack:** Bun, strict TypeScript, TypeScript compiler AST, in-process Python grammar, Biome, Trellis self-audit.

Baseline at `305b902`: 1,704 tests pass; audit index 58, partial; score contributions 27 complexity, 11 duplication, 20 cycles. The two deliberate nonliteral dynamic imports in research tests remain honest incomplete coverage. Current branch `feat/python-support` is the designated workspace; retain commits locally.

## Test design contract

Tests must exercise observable evidence and policy, not duplicate implementation or inspect private control flow. Use real temporary directories and the pinned tool seams already used by existing provider suites; mock only the actual process boundary. Reuse fixed corpus/fixtures when they represent the same behavior, keep production and test source sets distinct, and do not change score weights, exclusions, or test classification. Each task uses red→green→refactor: introduce one meaningful failing characterization or regression test, observe that failure, make the smallest production change, then run its focused tests. For a pure move, the red test can assert module ownership/import direction; the existing behavioral suite is the preservation oracle.

After each code change, run `bun run lint`, `bun run typecheck`, `bun test`, and `bun run check:all` with `PATH=/tmp/trellis-python-tooling/node_modules/.bin:$PATH`. Commit each focused concern only after all pass. Final audit JSON should be compared with the baseline for native graph facts, raw metrics, provider conformance, and test-set debt.

### Task 1: Provider lifecycle ownership

**Files:** Modify `src/providers/staged-run.ts`, `src/providers/jscpd/analysis.ts`, `src/providers/dependency-cruiser/analysis.ts`, `src/providers/knip/analysis.ts`; test `src/providers/staged-run.test.ts` and provider lifecycle/conformance tests.

- [x] Add a red test for shared cleanup degradation: a complete result plus `{status: "failed", reason: "disk error"}` becomes incomplete with a located diagnostic and retained evidence; a non-complete result appends the note. Verify the focused test fails because the shared function is absent.
- [x] Add small exported functions to `staged-run.ts` for staged source-set counts, staging diagnostics, and cleanup degradation. Keep lifecycle execution in `withStagedWorkspaceView`; do not introduce a callback registry or a generic provider framework.
- [x] Migrate jscpd, dependency-cruiser, and Knip one by one, deleting only duplicate helpers. Leave each provider's analysis identity, normalization, coverage claim, and failure reasons local. After each migration run its focused lifecycle and conformance suites.
- [x] Compare fixed provider outputs and policy assessments to baseline; run all four gates and commit `providers: share staged analysis bookkeeping`.

### Task 2: Syntax owns import-site facts

**Files:** Create `src/syntax/import-sites.ts`; modify `src/syntax/inventory.ts`, `src/syntax/types.ts`, `src/syntax/sloc.ts`, `src/syntax/index.ts`, `src/metrics/graph-imports.ts`, `src/metrics/graph-types.ts` and relevant imports/tests.

- [x] Add a red architecture regression test (or static import-direction assertion) showing `syntax/inventory.ts` must not import `metrics/graph-imports.ts`; assert import-site extraction still recognizes static, re-export, type-only and nonliteral dynamic sites. Observe the failure.
- [x] Move the extractor and `ImportSite` fact intact to `syntax/import-sites.ts`, importing `rangeAt` directly from its owner and importing edge type only where required. Keep a temporary re-export in graph-imports only if external test/caller compatibility needs it; metric graph reads inventory facts without another parse. Remove the reverse dependency.
- [x] Move `LineKind` to neutral `syntax/types.ts` or a leaf module so `types.ts` does not refer to `sloc.ts`; update all type imports. Verify actual runtime/type graph no longer has the two groups.
- [x] Run syntax, graph, cycles, Python/mixed-language tests; compare fixed-corpus graph metrics/findings and parser counts; run all four gates; commit `syntax: own import sites and line kinds`.

### Task 3: Raw-provider ordering deletion test

**Files:** Inspect `src/providers/jscpd/mode-run.ts`, `src/providers/dependency-cruiser/cruise-run.ts`, `src/providers/process.ts`; conditionally add one private `src/providers/raw-run.ts` and tests.

- [x] Inventory subprocess nonzero, missing report, invalid report, suspect evidence, and partial coverage semantics. Write down which transition is identical in both adapters.
- [x] If a small transaction function removes duplicated ordering while retaining fixed argv, file-vs-stdout source, parser, validation, and coverage locally, add a red test on the public adapters for the shared failure edge, implement and migrate both. Otherwise record a no-change decision with the concrete callback/flag cost; do not make the architecture shallower.
- [x] Preserve `runControlledProcess` unchanged; run provider suites and all four gates for any edit; commit only if the deletion test succeeds.

### Task 4: Provider policy ownership deletion test

**Files:** Inspect and conditionally modify `src/compare/policy-evidence.ts`, `src/compare/policy.ts`, `src/compare/policy-evidence.test.ts`.

- [x] Characterize unknown id, optional/required absent, complete over budget, incomplete value, and noncomparable baseline using existing policy tests; add one red test only for an uncovered observable edge.
- [x] If one internal view can reduce duplicate ownership/availability/comparability decisions while keeping native budgets separate, migrate requirement, budget, and new-finding assessments. Otherwise record a no-change decision with the concrete evidence and stop.
- [x] Preserve exact reason codes/messages/ordering and CLI/SDK parity; run focused suites and all four gates for any edit; commit only if this is a simpler interface.

### Task 5: Whole-change verification

- [x] Compare before/after audit reports (native facts, score, partial reasons, production and test debt); explain legitimate structural changes and unchanged dynamic-import gaps.
- [x] Run `bun run lint`, `bun run typecheck`, `bun test`, `bun run check:all`; check git status and commit lineage. Request independent final review; resolve important findings.

## Execution record (2026-09-22)

- Task 1 completed in `2d1c576` and `d6e9281`; the first independent spec review caught the missing shared outcome fold, and the follow-up resolved it. Test fixture duplication found in quality review was removed in `274bcf3`. The lifecycle, conformance, and policy parity suites plus all nine gates passed. A temporary checkout at `305b902` and the final checkout emitted byte-equal reports (excluding wall-clock `run` metadata) on fixed jscpd incomplete and complete controls, and complete dependency-cruiser and Knip controls; their native scores also matched for each fixed input.
- Task 2 completed in `79ec2d8`. Independent spec and quality reviews found no behavioral regression. The brittle source-string assertion was removed and the 13 extractor behavior tests moved to their syntax owner in `0334d13`. The self-audit's runtime and type-only cycle groups fell from two to zero; the two intentional unresolved dynamic imports still make graph coverage incomplete.
- Task 3 was evaluated and deliberately held. A shared raw-run transaction would centralize only three generic branches while needing at least five tool-specific inputs; report sources, scratch setup, validation, and coverage stay distinct. The 28 focused provider tests passed; independent spec and quality reviews approved the no-change decision.
- Task 4 was evaluated and deliberately held. Requirement IDs, emitted metric ownership, and baseline comparison ownership have different lookup semantics. A shared context would add nullable state and parameters without removing those decisions. The 39 policy and 27 surface parity tests passed; independent spec and quality reviews approved the no-change decision.
- The self-audit baseline at `305b902` was 58 partial, with 35 eroded production functions, 20 production clone groups, two import-cycle groups, and two unresolved graph edges. After the refactors it is 55 partial, with 32 eroded production functions, 17 production clone groups, zero cycle groups, and the same two unresolved graph edges. The import-cycle dimension still carries the full 20 uncertainty points while its metrics are incomplete. Test clone groups remain 117 and eroded test functions remain three; test duplication density changed from 0.110925 to about 0.1106 with the suite's size.
- Final independent review found no critical or important issue. The final `bun run check:all` passed nine of nine gates. The conditional holds were verified by independent reviewers; `src/providers/process.ts` and native scoring were not changed.
