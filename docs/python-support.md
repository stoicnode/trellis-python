# Python analysis in Trellis

Trellis 0.4.0 audits `.py` files alongside TypeScript and TSX with the same
scoring, reporting, comparison, policy, history and fleet pipeline. Python is
parsed in process with pinned `@lezer/python` 1.1.18; no Python interpreter,
project import, install or subprocess is needed for the native audit. The
audited project is never executed. The parser accepts Python 3 grammar forms
tested here, including `async def`, decorators, comprehensions and `match`.
Newer or interpreter-specific syntax is only covered when the pinned grammar
accepts it; Trellis does not emulate Python's runtime semantics.
Python source must be UTF-8; invalid byte sequences are reported as an
incomplete parse rather than silently decoded with replacement characters.

Discovery includes root packages, `src/` layouts and nested projects. Test
paths and `test_*.py` / `*_test.py` basenames enter the test source set.
Environment/cache directories, including `.venv`, `venv`, `__pycache__`,
`.pytest_cache`, `.mypy_cache`, `.ruff_cache` and directories bearing
`pyvenv.cfg`, are skipped. Existing `source.exclude` and `source.classify`
rules also apply to Python files.

The native adapter measures named, async, decorated and nested functions,
methods, and anonymous lambdas. It counts `if`/`elif`, loops, `except`,
non-default `case`, guards, boolean short-circuit operators, conditional
expressions and comprehension clauses. Nested function and lambda decisions
belong to their own function. Python functions feed the same erosion formula
and hotspot ranking as TypeScript. Clone detection shares the bounded native
engine and its 100-token / 3-line thresholds, with Python-specific lexical
normalization and suite boundaries. Python and TypeScript tokens cannot clone
across languages.

Static imports resolve only against discovered local Python files. Trellis
supports dotted absolute imports, package `__init__.py`, `src/` module roots,
and relative `from` imports. `from pkg import child` targets the child module
when present, otherwise the package containing the imported symbol. A top
level name absent locally is external; a missing descendant of a known local
package or failed relative import is unresolved. Ambiguous module owners are
unresolved. Dynamic `__import__` and `importlib.import_module` calls, including
simple aliases, are located limitations and make cycle coverage incomplete.
Arbitrary dataflow, `sys.path` mutation, installed packages and imports
between Python and TypeScript are not resolved.

Reports include `languageCoverage` rows with discovered/analyzed files, parse
failures, source lines, unresolved imports and dynamic imports. An unresolved
import or parser recovery never silently becomes a clean graph score; required
incomplete dimensions receive their documented partial score contribution.
Schema 1.3.0 records language coverage, analyzer 0.4.0 records the broader
source population, and scoring remains 0.2.0-provisional. Recreate baselines
made by older analyzer versions before using regression policy. Historical
reports remain readable.

The external evidence providers remain optional, unscored and scoped to
TypeScript. They do not claim coverage of Python files. The native Python
adapter is the authoritative Python measurement path.

The [implementation report](python-implementation-report.md) records the
acceptance tests, CLI smoke runs, TypeScript parity and Trellis self-audit.
