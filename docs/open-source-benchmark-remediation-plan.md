# Open-source benchmark remediation plan

## Goal and baseline

Make trellis's native audits of established TypeScript and Python libraries useful for
calibration without weakening its offline, no-model, no-target-execution contract. The
2026-09-22 run used trellis 0.4.0 / scoring 0.2.0-provisional. Complete focused scans
scored Zustand `src` 27, ts-pattern `src` 39, Ky `source` 45, and TanStack Query
`packages/query-core` 47. Full-repository scans were partial: Zod 89, date-fns 79,
TanStack Query 81, and Requests, Flask, and Rich 100 each. A partial index assigns
maximum points to each incomplete dimension; it is not a quality rating.

Pin the external inputs before changing analyzers:

| Repository | Commit | Observed blocker |
|---|---|---|
| Zod | `10dda3a3a4bc76ed0bf83e994de194587e489ef8` | 110 unresolved import sites, mostly workspace exports pointing at build output |
| date-fns | `766dea98b704f119e221b8365909b44301500ae4` | duplication extraction exceeds 100M work units; 4 unresolved import sites |
| TanStack Query | `129955c8fd8e96b61b8cb8b40e1dac3828b4cbee` | 690 unresolved import sites, mostly unsupported or missing workspace exports |
| Requests | `611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60` | 25/37 Python files flagged with parse diagnostics; 177 unresolved imports |
| Flask | `d73fa1cdcbd8b1465c151db8924ba58b1dd14e35` | 40/83 Python files flagged; 160 unresolved imports |
| Rich | `9d8f9a372cc5916fd4781fec207ced7ddac2f08f` | 104/213 Python files flagged; 581 unresolved imports; duplication budget exceeded |

Preparation may fetch pinned source revisions, but every audit and CI fixture must remain
offline and require no target dependencies. Preserve source classification and the
production/test split. Do not improve a result by silently dropping difficult files.

## Work sequence

### 1. Freeze reproductions and diagnostic taxonomy

- Add small, committed fixtures distilled from the pinned projects and a read-only
  benchmark harness that checks snapshot hashes, runs the same `runWorkspaceAudit` core,
  and records complete/partial state, metric reasons, score contributions, wall time,
  peak memory, and unresolved-import reasons. Keep external snapshots outside the repo;
  acquisition is a separate preparation step.
- Compare the Python fixtures with `ast.parse` during preparation only. Production and
  the standard test suite must not require a Python interpreter. The pinned Requests,
  Flask, and Rich snapshots contain no `ast.parse` failures on the preparation host.
- Treat all existing uncommitted source changes as separate work. Re-establish the
  baseline after they land so this plan measures each fix against one analyzer revision.

**Gate:** the baseline harness reproduces the counts above and distinguishes parser
recovery, indentation, static import uncertainty, unsupported exports, and resource
exhaustion. It never equates an unresolved site with an actual import cycle.

### 2. Repair Python parsing before interpreting Python metrics

- In `src/python/layout.ts`, recognize implicit continuation for parenthesized imports
  and other bracketed constructs. Keep the invalid-indent checks: a missing suite and
  an inconsistent dedent must still produce located diagnostics. Requests
  `src/requests/sessions.py:25` is a minimal continuation regression.
- In `src/python/parser.ts`, investigate Lezer recovery on valid empty modules and
  bare `yield` statements, then audit every remaining `PY-SYNTAX` diagnostic against
  valid and invalid fixtures. Fix or replace the pinned in-process grammar where needed;
  do not suppress all recovery nodes or invoke Python during an audit.
- Add adjacent tests for multiline imports, comments within continuations, strings,
  empty files, generators, modern syntax present in the snapshots, and malformed
  counterparts. Ensure the shared syntax inventory still parses each file once.

**Gate:** zero false parse failures on the pinned Requests, Flask, and Rich snapshots;
intentional invalid fixtures still fail. Complexity, erosion, and duplication metrics
become complete when no other resource limit is reached. Version analyzer semantics and
refresh only documented golden artifacts if measurement values change.

### 3. Repair import coverage without inventing edges

- In `src/python/imports.ts`, count only **leading** dots as the relative level of a
  `from` import. Today dots within `from pygments.style import ...` can make an absolute
  external import look relative. In `src/python/resolve.ts`, distinguish external
  packages, local modules, package symbols, genuinely missing local children, and
  ambiguous source-root ownership using only the discovered inventory.
- In `src/metrics/graph-workspace.ts` and `graph-resolve.ts`, support declarative source
  export conditions named by the governing `tsconfig` (`customConditions`), plus the
  nested condition forms seen in TanStack manifests. Resolve only to discovered files;
  preserve exports encapsulation and report absent build outputs honestly. Zod's
  `@zod/source` and TanStack's `@tanstack/custom-condition` are fixed regressions.
- Keep non-literal dynamic imports explicitly unresolved. Decide and document whether
  their uncertainty blocks cycle completeness for the affected source set or whole
  workspace; do not turn an unknown edge into an external or a zero-cycle assertion.

**Decision:** a non-literal dynamic import leaves the whole workspace dependency graph
incomplete. Cycle metrics may still expose cycles found in the known graph, but cannot
assert a complete zero-cycle result while an unknown edge remains. This records the
existing graph-policy behavior; it does not change the policy identity.

**Gate:** the pinned corpus has no false unresolved imports caused by relative-level
parsing or an explicitly declared source condition. Every remaining unresolved site
has a specific, defensible reason. Valid local cycles, external imports, inaccessible
export subpaths, and missing modules remain distinct in tests. If graph policy or
resolution meaning changes, bump its analyzer/policy identity and comparison rules.

### 4. Make large duplication runs complete within the existing bounds

- Profile phase work on pinned date-fns and Rich snapshots. Both currently exhaust
  the 100M-unit cap in extraction. Record token counts, interval/occurrence counts,
  phase work, runtime, and peak memory before optimizing `duplication-extract.ts`.
- Remove repeated work in heavily overlapping suffix intervals while preserving
  maximal normalized-token groups, member locations, containment, and unique covered
  code lines. Do not raise or disable the frozen token, work, cell, group, or occurrence
  limits to make the benchmark pass. Retain charged work and cancellation checks.
- Prove parity with the independent small-input oracle, the fixed corpus, and the
  2/10/40-copy controls, including pathological repetition and forced-limit cases.

**Gate:** date-fns and Rich production duplication finish within the existing limits
on the pinned snapshots, with repeatable byte-identical measurements and a documented
runtime/memory budget. If an input still exceeds a hard bound, the result stays
located `incomplete`; no partial groups are published as complete.

### Phase 4 execution record (2026-09-22)

The bounded extractor now builds one charged min/max segment tree over left contexts
in suffix-array rank order. Within an LCP interval, suffix-array order makes equal
right contexts contiguous. It binary-searches each right-context partition, queries
the left-context ranges outside that partition, and materializes only members that
have a differently left-contexted member outside it. This preserves the former
two-sided context rule without repeatedly constructing left/right/pair maps over
overlapping intervals. The tree, binary searches, range queries and retained members
remain charged; its numeric cells remain within the existing 32M cap.

Representative fresh macOS runs used the pinned snapshots and
`/usr/bin/time -l env PATH=/tmp/trellis-python-tooling/node_modules/.bin:$PATH bun /tmp/trellis-dup-profile.ts <repo>`.
Peak RSS is the operating-system maximum; reported wall time includes discovery and parsing.

| Repository | Before | After |
|---|---|---|
| date-fns `766dea9` | 489,181 tokens; exhausted extraction at 100M work (36.09M extraction); 2,952 groups / 19,617 occurrences retained at stop; ~1.11s; 729.6 MiB peak RSS | complete: ~80.6M work (15.45M extraction), 6,967 intermediate groups / 47,914 occurrences, 1,063 final groups; ~1.08s; 441.5 MiB peak RSS |
| Rich `9d8f9a3` | 193,850 tokens; exhausted extraction at 100M work (73.64M extraction); 181 groups / 12,851 occurrences retained at stop; ~0.95s; 280.7 MiB peak RSS | complete: ~51.0M work (20.36M extraction), 5,052 intermediate groups / 197,156 occurrences, 104 final groups; ~0.83s; 230.1 MiB peak RSS |

The profile telemetry records date-fns' 138,885 intervals / 1,452,275 interval
occurrences and Rich's 25,459 intervals / 13,806,186 interval occurrences. The
independent small-input oracle, 2/10/40-copy controls, periodic repetitions, forced
limits and cancellation checks continue to pass. Repeated complete runs produce
byte-identical clone groups and line metrics. Finalization's comparator-call work
counter varied slightly across fresh processes (less than 0.01% on date-fns), so the
table rounds total work rather than claiming byte-identical telemetry.

### 5. Stop presenting incomplete audits as numerical rankings

- Use SPEC §3.4's permitted **withheld** headline when any required scoring
  dimension is incomplete. Keep complete dimensions' raw metrics and contributions
  visible, name every unknown dimension, and show `incomplete` in terminal, Markdown,
  JSON, SDK, fleet, and history. A missing metric never contributes zero debt.
- Update the report schema, score contract, renderers, comparison, policy, and SQLite
  readers together. `maxIndex` and regression policies must fail closed or report an
  explicit non-comparable state for withheld scores; older partial artifacts remain
  readable and are never silently compared with a complete score. Bump schema and
  scoring semantics as required by SPEC §3.5 and §7.

**Gate:** Requests, Flask, and Rich cannot appear in a ranked table as `100` when
analysis is partial. Complete audits retain their current formula and exact scores.
CLI and SDK deep-equal tests, saved comparison, fleet, and history cover both states.

### 6. Recalibrate only after coverage is trustworthy

- Re-run the pinned full-repository and focused-scope corpus three times per project.
  Review top hotspots and clone groups by source location. Add paired refactors that
  remove a real clone, simplify a function, and break a cycle without unrelated metric
  movement. Record distribution by language and repository size.
- Decide from that evidence whether the provisional thresholds or weights need a
  versioned change. A well-regarded library is a useful calibration input, not an
  assumption that its score should be low. Do not give safeguards or tests score credit.
- Publish before/after measurements, completeness, versions, and known residual
  limitations. Update SPEC, README, changelog, corpus documentation, and golden
  expectations for any contract or scoring change.

**Release gate:** `bun run lint`, `bun run typecheck`, `bun test`, and
`bun run check:all` pass. Native CLI/SDK/fleet parity, offline/no-write behavior,
determinism, compatibility, and the pinned benchmark acceptance all pass. Keep each
phase focused and commit separately; push only on request.

### Phase 6 execution record (2026-09-22)

The read-only `--acceptance --runs 3` mode now checks every pinned full and focused
scope in a fresh process, hashes the report measurement payload without run metadata,
and emits completeness, runtime/RSS, unresolved-reason counts and source-located
hotspot/clone evidence. All ten scopes were repeatable. Requests, Flask and Rich now
have zero Python parse failures; date-fns and Rich duplication complete within the
existing bounds. The four complete focused scopes retain indexes 27, 39, 45 and 47.
The six full repositories with remaining dynamic or unavailable-build graph edges
withhold their numerical headlines rather than appearing as 100. The detailed
distribution, locations, residuals and calibration decision are in
[`open-source-benchmark-acceptance.md`](open-source-benchmark-acceptance.md).

The controlled corpus pairs remain the calibration refactors: clone removal changes
16 to 0, branch growth changes 0 to 26, and cycle introduction changes 0 to 12 with
unrelated metrics unchanged. The same harness explicitly checks their cleanup
directions: function simplification 26 to 0 and cycle break 12 to 0. They and the
benchmark evidence do not justify a new threshold or weight: scoring stays
`0.3.0-provisional`, safeguards and test code add no score credit.
