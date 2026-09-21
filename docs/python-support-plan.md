# Python support implementation plan

This plan implements the supplied Python-support brief. It supersedes the
TypeScript-only release scope in SPEC §§2 and 15, while preserving the offline,
no-model, no-target-execution, shared-core, and conservative completeness rules.
This is a design and execution plan, not a claim that Python support is delivered.

## Existing architecture and TypeScript assumptions

The actual pipeline is `auditWorkspace` → source discovery → shared syntax
inventory → registered native analyses → safeguards → pure scoring → validated
report assembly. `runWorkspaceAudit` adds configuration, baselines, policy and
optional history. The `src/analysis/` capability registry is an existing seam;
language adapters are a lower-level seam, not a replacement registry or new
metric owners.

| Area | Current assumption | Change required |
| --- | --- | --- |
| `discovery/classify.ts` | TS extensions; `.py` explicitly unsupported; TS test/declaration names | Adapter extension recognition and Python default test names; preserve override precedence |
| `discovery/inventory.ts` | `tsFiles`, only package.json boundaries, node_modules ignored | One shared walk with supported source files; ignore Python environments/caches; retain deterministic ownership |
| `syntax/types.ts`, `inventory.ts` | Every file owns `ts.SourceFile`; every function owns `ts.Node`; one `compilerVersion` | Normalized per-file facts and parser provenance; parser-private AST types remain private |
| `syntax/parse.ts`, `functions.ts`, `identity.ts`, `sloc.ts` | Compiler API parsing, TS function kinds, AST ancestry, scanner SLOC | Retain as TS implementation behind adapter; add Python counterparts |
| `metrics/complexity.ts` | TS node kinds and `walkOwnNodes` | Keep exact existing implementation for TS; adapter supplies normalized CC/nesting/SLOC |
| `metrics/analyze.ts` | Reclassifies TS lines and computes AST complexity | Aggregate normalized function facts with existing erosion and metric/finding machinery |
| `metrics/graph-imports.ts`, `graph-resolve.ts`, `graph-assets.ts`, `graph-workspace.ts` | TS AST import syntax, tsconfig aliases and package exports | TS adapter delegates unchanged; Python adapter supplies static sites/resolution |
| `metrics/analyze-graph.ts` | Extracts every import from `file.sourceFile` | Assemble graph from adapter output; preserve graph metrics and cycle algorithm |
| `metrics/duplication.ts` | TS leaf tokens and `ts.SyntaxKind[]` | Extract TS token adapter; shared engine consumes numeric normalized tokens |
| `metrics/duplication-account.ts` | Calls TS scanner for line accounting | Consume normalized line classifications with unchanged interval accounting |
| `analysis/provenance.ts`, `native.ts` | Hashes `sourceFile.text`; hardcodes `trellis.typescript` | Hash normalized source text; record all enabled parser/adapter identities honestly |
| `contract/coverage.ts`, `report.ts`, `audit/assemble.ts`, report renderers | Source-set counts only; strict report schema | Add versioned language coverage and preserve historical schemas |
| `providers/` | Staging now inherits newly recognized files; jscpd line normalization parses TS | Explicit provider language selection/unsupported evidence; never claim Python capability accidentally |

Already language-neutral: erosion arithmetic, percentile aggregation, scoring
formula/catalog, suffix-array/LCP clone matching, clone finalization and overlap
facts, graph SCC/cycle algorithms, comparison identity matching, policy engine,
SQLite artifact persistence, CLI/SDK/fleet orchestration. These should not be
rewritten. Safeguard inspection remains separate and retains its existing
configuration scope; this delivery does not imply Python linter/test wiring support.

## Parser decision

Recommend exact-pinned `@lezer/python` **1.1.18**, with a directly declared
`@lezer/common` dependency if its types are imported. It is an MIT-licensed
in-process JavaScript parser with TypeScript declarations. It avoids Python
installation, subprocesses, native addons, WASM assets and runtime downloads.
Its concrete syntax tree supplies positions, recovery nodes, identifiers,
operators, function/class nesting, imports and string boundaries needed here.

The inspected upstream grammar includes async definitions, decorators,
comprehensions, match clauses/guards, exception groups and type parameters.
Treat this as structural grammar support, not CPython semantic validation. Pin
the exact installed artifact and commit the lockfile; verify its tree shape in
small fixture tests before writing visitors. Inspect `node.type.isError` even
for zero-width recovery nodes. A recovered tree must never mean a clean parse.
The GitHub repository moved to the maintainer's own forge in April 2026; its
archive status is not evidence of abandoned maintenance.

Alternatives:

| Parser | Assessment |
| --- | --- |
| Python stdlib `ast` + `tokenize` | Excellent AST fidelity, but introduces interpreter/version availability, process isolation and batching; conflicts with the current default no-subprocess invariant |
| Tree-sitter Python + native bindings | Mature grammar, but adds native-platform/Bun compatibility and installation concerns |
| Tree-sitter Python + WASM | Reasonable fallback if Lezer fails acceptance; ships grammar/runtime assets and needs ABI/load/lifecycle handling |
| Pyright parser | TypeScript implementation but larger analyzer coupling and internal parser integration for only structural facts |

Before committing to Lezer, smoke-test: nested decorated async methods,
match/case guards, comprehensions, f-string embedded expressions, invalid
indentation, malformed strings and non-ASCII positions. If any required fact
cannot be represented reliably, use tree-sitter WASM rather than regex or a
partial homegrown parser. This checkpoint happens before publishing an adapter
API dependent on Lezer nodes.

Primary-source references reviewed for this decision:

- [Lezer Python package](https://github.com/lezer-parser/python/blob/main/package.json)
- [Lezer Python grammar](https://github.com/lezer-parser/python/blob/main/src/python.grammar)
- [Lezer Python change history](https://github.com/lezer-parser/python/blob/main/CHANGELOG.md)
- [Tree-sitter WASM integration](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md)

Document a tested Python 3 structural subset, initially ordinary Python 3
through the tested 3.12 constructs. Do not claim all Python 3.13/3.14 syntax.
Unsupported newer constructs and parse errors produce located limitations.
Non-UTF-8 coding-cookie input must be explicitly unsupported unless decoded
correctly; do not silently analyze replacement characters as source.

## Normalized seam

Keep one filesystem walk and one parse per file. Do not give each adapter its
own recursive discovery. Add `src/languages/` for types, fixed registration and
language implementations. Discovery asks the registry which adapter recognizes
an extension; syntax inventory delegates to that adapter. No language branching
in score, comparison, policy, history or renderers beyond coverage labels.

The normalized file model reuses `Range`, `SourceSet`, `LineCounts`, existing
hotspot identities and graph edge/resolution contracts. It carries:

- Language id, relative path, package owner, source set and original text.
- Parser/adapter identity, located parse diagnostics, line classifications.
- Function facts: existing function kind/name/identity/ranges/parent index,
  measured CC, max nesting and function SLOC. No model-derived measurement.
- Import sites or resolved graph edges with exact range, edge kind, specifier,
  type-only flag and explicit resolution state.
- A normalized token-collection operation over the retained private parse,
  accepting shared syntax-work accounting. Keep lazy/bounded collection so
  tokenizing during parse cannot evade the clone engine's resource ceilings.

The adapter owns recognition, default classification hints, parsing, function
facts, import semantics and tokenization. Workspace-aware import resolution is
prepared once per adapter per audit. Preserve legacy TS parse/functions helper
exports for focused tests and callers, but shared metric code consumes only
the normalized model. Do not fake a `ts.SourceFile` for Python or put optional
Python fields throughout TS AST types. Avoid two permanent competing models
for the same normalized facts.

Language coverage belongs in a typed report field rather than an invented
metric that could change the scored catalog. A row should identify language,
discovered/analyzed files, parse-failure files, SLOC, unresolved imports and
dynamic-import limitations. Distinguish files attempted from successfully
parsed files; retain existing per-source-set coverage.

## Python semantics to freeze in tests

Discovery: recognize `.py`; apply current exclude/classify overrides first.
Keep vendored/generated precedence. Add `test_*.py`, `*_test.py`, and existing
test directories. Ignore `.venv`, `venv`, `__pycache__`, `.pytest_cache`,
`.mypy_cache`, `.ruff_cache` and environment directories identified by
`pyvenv.cfg`; do not inspect installed packages. Preserve current build-output
exclusion accounting. `pyproject.toml` can establish a package boundary by
presence alone; do not execute or parse `setup.py`. At minimum support root,
`src/`, and nested project/source roots without requiring configuration.

Functions: inventory `def`, `async def`, instance/static/class methods and
nested definitions. Reuse class and function scope components so names are
stable across comment/line movement and distinct across classes. Duplicate
same-scope definitions must be ambiguous, not assigned line-based identities.
Static methods use the existing static member identity; class methods can use
that class-bound category with a separate display fact. Python lambdas should
be inventoried as anonymous function expressions, or explicitly declared a
coverage gap; silently omitting their decision paths is unacceptable. Exclude
nested function bodies from parent CC. Preserve current whole-function-range
SLOC behavior (including nested code) rather than silently changing TS mass.

CC starts at 1. Add one per `if`/`elif`, `for`/`async for`, `while`, `except`
handler, conditional expression, short-circuit `and`/`or` operator, comprehension
`for` and comprehension filter. Count a non-default match case once; an
irrefutable unguarded final capture/wildcard case is the default and adds zero.
A match guard adds one decision, plus its boolean operators. Do not count
plain else/finally, match container, with/async with, await, return, yield,
raise, break, continue, assert or unary not as independent decisions. Explicitly
document chained comparison/OR-pattern treatment; avoid implicit new CC rules.
Nesting mirrors TS control structures: conditionals, loops, match and try;
handler/finally bodies remain at their try level. Use fixture expectations for
elif and comprehension nesting rather than counting arbitrary CST depth.

SLOC uses token spans, not regex text classification. Comments never count as
code; literals including multiline strings and docstrings count as code under
the existing literal rule. Ignore indentation/blank lines for SLOC. Keep
1-based ranges with tested CRLF, Unicode and final-newline behavior.

Imports: index discovered local `.py` modules and package `__init__.py` against
root/source-layout bases, choosing the nearest owning project. Handle dotted
imports, aliases, comma lists, from-import names, parenthesized lists, relative
levels and star imports. For `from pkg import child`, resolve a local child
module when present, otherwise the package/module containing the symbol; do
not require a Python type checker to resolve symbols. Preserve package
initialization dependencies where applicable. A bare top-level name absent
from the local module index is external, not probed in installed packages;
a relative import or a missing descendant of a known local package is
unresolved. Ambiguous source roots/colliding modules must be unresolved rather
than chosen silently. Namespace packages can use discovered directory prefixes
without fabricated `__init__.py` files.

Recognize direct `__import__` and importlib import-module calls, including
straightforward aliases, as located unresolved dynamic-import limitations;
never execute or pretend to fully resolve them. Conditional imports remain
conservative static edges. State that arbitrary alias/dataflow/sys.path tricks
cannot be determined statically. Cross-language resolution is out of scope.
Feed all resulting edges to existing graph/cycle algorithms.

Duplication: preserve the suffix-array engine, source-set isolation, 100-token
and 3-line thresholds, maximal-run grouping and budgets. Generalize token ids
to numbers; preserve TS ids and accounting exactly. Give Python a disjoint
token alphabet so cross-language accidental clones cannot appear. Normalize
identifiers and literals like TS while preserving operators/keywords. Derive
indent/dedent or equivalent suite-boundary markers from the CST: discarding
Python block structure would create false clones. Strings normalize as one
literal; f-string expression structure must remain visible, like TS template
expressions. Exclude comments and whitespace. Use the same unique-code-line
accounting, not raw matched spans. Small examples below 100 tokens correctly
produce no finding; acceptance clones must exceed the existing thresholds.

## Versions, completeness and compatibility

Keep scoring version `0.2.0-provisional`, metric ids, thresholds, weights,
erosion mass formula and policy meaning unchanged. Combine Python and TS
production facts in the same aggregates; test source remains separate.
This broadens the measured population and needs an analyzer version bump even
when the formula does not change. Recommend package/analyzer `0.4.0` and schema
`1.3.0` for mandatory language coverage, retaining readers for 1.0/1.1/1.2.

Be careful: current report validation keys identity requirements to equality
with `SCHEMA_VERSION`. When adding 1.3, explicitly preserve hotspot identity
requirements for 1.2 too; do not accidentally reinterpret historic reports.
Old artifacts remain readable. Comparison across the analyzer transition
fails closed with a fresh-baseline reason. Compare 0.4-era Python/mixed reports
normally. SQLite stores report JSON; do not invent a new history table unless
actual schema constraints require it. Verify compatible-run selection and
historical artifact loading.

Represent native parser provenance as a stable multi-language analyzer engine
with exact parser versions/options for all supported adapters. Do not change
producer semantics merely because one run contains no Python and the next adds
its first file: that is a source-population change, not a parser-version
change. Fingerprints remain exact source text, never absolute paths or clocks.

Parse failures make affected complexity/duplication/graph dimensions incomplete.
Unresolved/dynamic imports make graph/cycles incomplete while preserving other
measurements. Existing scoring already charges incomplete required dimensions
at full weight. Ensure native evidence state also reflects graph resolution
gaps and duplication exhaustion rather than only syntax diagnostics. Provider
tools remain opt-in and unscored; explicit language selection prevents TS-only
tools claiming observed Python coverage after the discovery change.

## Phased implementation and ownership

1. **Architecture and TS preservation — primary Terra.** Introduce normalized
   contracts and adapter registration, migrate TS facts/token/import production,
   then update shared aggregators to consume them. Freeze original TS fixture
   metrics, findings, scores and token streams. No Python discovery yet. Keep
   all existing tests green, allowing only intentional metadata changes later.
2. **Python discovery and parse — primary Terra.** Pin/parser-smoke-test Lezer,
   add discovery/exclusions, private parse/CST helpers, diagnostics, lines,
   function inventory and stable identities. Mark unsupported measured
   capabilities incomplete until the next phases land. Add focused tests.
3. **Complexity and erosion — primary Terra.** Implement the documented Python
   decision/nesting table and function SLOC; reuse `metrics/analyze.ts` and
   erosion. Prove nested attribution, mass, hotspots and partial failures.
4. **Imports and cycles — second Terra after seam is frozen.** Own only
   `src/languages/python/imports.ts`, `resolve.ts`, supporting module-index
   helpers and their adjacent tests. Supply normalized sites/edges; primary
   integrates graph assembly. Cover relative/package/src/namespace/ambiguous
   paths, external/missing modules, dynamic imports and actual cycle findings.
5. **Duplication — primary Terra.** Add Python token producer and line support,
   preserve shared engine/accounting, prove normalized identifier/literal
   clones, suite distinctions, no cross-language clones and budget failures.
6. **Integration — primary Terra.** Own versioned report coverage, provenance,
   renderers, provider scoping, compatibility and old report readers. Exercise
   saved baselines, policy exit 2, history, CLI/SDK parity and fleet. Avoid
   language-specific behavior in CLI or client.
7. **Hardening and docs — Luna independently after contracts settle.** Own
   README, architecture/metrics/CLI docs, SPEC scope revisions, Python parser
   decision/limits documentation and reproducible corpus/performance evidence.
   A separate Luna acceptance task may add isolated Python/mixed integration
   test files. Primary Terra owns shared fixtures and final gate repairs.

Parent coordinates gates and coherent commits. Do not have multiple executors
edit syntax types, package/lock files, report schemas or analysis provenance
concurrently. Hand off the exact normalized seam before import implementation.
No broad rewrites, threshold reductions, coverage-budget relaxations, skipped
tests or edits to canonical `scripts/check-all.ts`.

## Acceptance and risks

Required tests: `.py`/mixed discovery and overrides; environment exclusion;
ordinary/async/decorated/static/nested functions; scope collision/replacement
identity; all CC constructs with hand-calculated expectations; syntax recovery
and Unicode/CRLF lines; import/package/src/external/unresolved/dynamic/cycle
cases; above-threshold renamed Python clones; comments/indentation/string
normalization; mixed report with both languages' hotspots/cycles and Python
clones; partial-score honesty; determinism; old schema reads; new/resolved/
persistent Python findings; metric/score deltas; policy regression; SQLite and
CLI/SDK/fleet equivalence.

Keep the original TS measurement snapshot and compare before/after excluding
only intentionally changed analyzer/schema/provenance/coverage metadata.
Investigate every changed TS metric/finding/score. Re-run the bounded clone
oracle/accounting tests: moving token production can accidentally evade work
budgets or alter TS off-by-one ranges. Include a source marker that would write
a file if executed and prove audits create no target artifacts or subprocesses.

Add a deterministic representative Python corpus and benchmark script with
recorded file/function/token counts, elapsed time and peak memory. Measure
repeated warm/cold audits, and a mixed corpus, without per-file process costs.
Record actual results and a generous enforced ceiling comparable to existing
corpus validation; do not invent performance claims from tiny unit fixtures.
Parser recovery on pathological/deep input must fail visibly rather than
overflow or hang silently.

For every phase commit run `bun run lint`, `bun run typecheck`, `bun test`,
and `bun run check:all` (final `bun run verify` is the alias). Run audit commands
against committed TS, Python and mixed fixtures with JSON and Markdown output;
save a Python baseline, introduce complexity/cycle changes in a temp copy,
prove regression policy and compare behavior, then verify history. Run the
trellis self-audit against the saved baseline and inspect any structural score
regression. Keep transient reports outside the repository. Record all gates,
parser limits, platform and corpus outcomes in the final implementation report.

Highest risks are tolerant-parser false completeness, Python suite-token
normalization, incorrect package/from-import edges, absent-parser provenance,
historical schema identity reinterpretation, optional provider scope expansion,
and changed TS resource accounting. Address those with direct assertions rather
than snapshots that simply bless new output.
