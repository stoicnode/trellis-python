# Python support implementation and evaluation

This fork adds native Python analysis to Trellis's existing Bun/TypeScript
application. Astra prepared the [implementation plan](python-support-plan.md);
lower-cost execution agents began the parser, resolver and acceptance work,
and integration/hardening completed in this checkout. No Python project code
is executed during an audit.

## Delivered behavior

- One discovery walk recognizes `.py`, common Python tests, root/`src/`
  projects and `pyproject.toml` package boundaries. It excludes environment
  and cache directories, including custom environments with `pyvenv.cfg`.
- The pinned in-process Lezer parser emits normalized lines, functions,
  identities, decisions/nesting, clone tokens and located import sites. The
  TypeScript compiler path retains its original behavior. Shared metrics,
  scoring, reports, comparison, policy and history consume both languages.
- Python imports resolve locally against discovered modules, package
  `__init__.py` files and relative levels. Ambiguous/missing and dynamic
  imports remain explicit graph limitations. Comma-separated `from` imports
  produce one edge per member. Cross-language edges are outside this release.
- Report schema 1.3.0 adds language coverage. Analyzer/package 0.4.0 records
  the expanded measured population. Scoring remains 0.2.0-provisional;
  thresholds and weights did not change. Old report schemas remain readable,
  while older analyzer baselines require regeneration.
- Optional external evidence providers stage TypeScript files only, so their
  output cannot claim Python coverage.

## Verification evidence

- The original eleven TypeScript corpus fixtures had identical coverage,
  completeness, raw metrics, scores, findings and safeguards before and
  after the implementation, excluding only intentional version/provenance
  metadata.
- Python and mixed acceptance tests cover discovery, `async`/decorated/
  nested functions, all requested decision forms, clone normalization,
  relative cycles, import ambiguity, malformed indentation, dynamic imports,
  hotspot identity, baselines, policy and SQLite history. A 129-file Python
  corpus completed local audits in about 30–41 ms in acceptance runs, below
  the deliberately generous 10-second ceiling. Timings are machine-specific,
  not a throughput guarantee.
- CLI smoke runs emitted JSON and Markdown for a Python-only fixture. Adding
  a Python CC-12 hotspot changed its complete index from 56 to 57; both
  `audit --baseline` and `compare` returned policy exit 2 for one new
  `complexity.hotspot`. `audit --history` exited 0.
- Trellis self-audited the original snapshot and this fork using the same
  current analyzer. The original index was 61/100 partial; the fork was
  59/100 partial after refactoring findings in the new adapter. Both partial
  statuses stem from the repository's existing two non-literal TypeScript
  dynamic imports. The Python adapter itself had no hotspot or clone-group
  findings in the final self-audit. This score is structural evidence, not a
  claim that all Python semantics are covered.
- Final gates: `bun run lint`, `bun run typecheck`, `bun test` (1,704 passing), and
  `bun run verify` (all nine repository gates) passed. No quality budgets
  were relaxed.

## Limits to keep visible

The pinned parser is structural, not a CPython interpreter or type checker.
Interpreter-specific validity and syntax newer than its grammar are not
guaranteed. Its recovery and indentation guard mark detected failures
incomplete, but no static grammar validates every runtime rule. Local import
resolution does not evaluate `sys.path`, installed packages, runtime alias
dataflow or package initialization side effects; an import of a submodule
does not add a separate implicit edge to its package initializer. Dynamic
imports are unresolved by design. The fixed 100-token clone threshold means
small similar Python snippets are intentionally below reporting scope.
