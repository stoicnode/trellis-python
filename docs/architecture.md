# Architecture

[Back to the README](../README.md)

```
src/
├─ cli/            # THIN commander entrypoints; delegate to core (SPEC §13.1)
├─ client/         # typed SDK over the core; mirrors core types
├─ audit/          # deterministic core: discover → parse → measure → score → assemble
├─ guides/         # bundled, read-only task guidance
├─ config/         # declarative audit configuration (trellis.yaml)
├─ contract/       # versioned zod contracts: metrics, findings, report, config
├─ discovery/      # TypeScript/Python discovery → classified workspace inventory
├─ syntax/         # normalized file/function/token inventory and TS compiler adapter
├─ python/         # in-process Lezer parser, Python facts, imports and local resolution
├─ metrics/        # complexity, erosion, duplication, import graph/cycles
├─ safeguards/     # hook/check configuration inspection (non-scoring)
├─ scoring/        # provisional sloppiness formula (pure)
├─ report/         # terminal / JSON / markdown renderers
├─ compare/        # artifact comparison + declarative failure policies
├─ store/          # OPTIONAL SQLite history (append-only; legacy runs separate)
├─ history/        # history dashboard projection
├─ fleet/          # OPTIONAL targets.yaml orchestration over the same core
├─ providers/      # opt-in local tool evidence (unscored)
└─ standards/      # canonical-config drift (separate capability)
```

All behavior lives in the core; `src/cli/` and `src/client/` are thin
pass-throughs (**api>cli>sdk**, SPEC §13.1). See
[`docs/architecture.mmd`](architecture.mmd) for the module graph and
[`docs/corpus-validation.md`](corpus-validation.md) for the fixed-corpus
score-behavior and performance record.

Discovery assigns each `.ts`/`.tsx` or `.py` file a language and source set.
The syntax boundary parses it once and emits normalized line counts, functions,
import sites and clone tokens. TypeScript keeps its compiler AST privately;
Python keeps a Lezer tree privately. The shared complexity, erosion, clone,
graph, score, report, comparison, policy, history and fleet layers consume
normalized facts. Import resolution selects the appropriate local resolver at
the graph boundary; no target module is imported or executed.

The report carries per-language discovered/analyzed files, parse failures and
unresolved/dynamic import counts. Schema 1.3.0 adds that coverage, analyzer
0.4.0 records the expanded source population, and scoring remains
0.2.0-provisional. Older schema artifacts remain readable, while baselines
across analyzer versions require regeneration. Optional external providers
currently stage TypeScript files only; Python is covered by native analysis.
