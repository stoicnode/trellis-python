# Index correction Release A

Status: implementation complete for analyzer 0.9.0. Publish and push remain
operator actions. The scoring formula is still `0.9.0-provisional`; Phase 4
candidates remain research-only until the independent Phase 5 pilot finishes.

## Semantic change inventory

| Release | Changed meaning | New identity / migration |
| --- | --- | --- |
| 0.5.0 | Scored cycle metrics use a production-induced graph; historical unsuffixed workspace metrics remain evidence | New `.production` metric ids, graph 1.3.0, cycle 1.2.0, schema 1.5.0, scoring 0.5.0-provisional |
| 0.6.0 | Binding-confirmed Python typing guards preserve type-only edges | Graph 1.4.0, scoring 0.6.0-provisional |
| 0.7.0 | Confirmed overload declarations attach to one executable implementation; orphans remain evidence | Scoring 0.7.0-provisional; implementation hotspot identity is retained |
| 0.8.0 | Binding-confirmed literal `importlib.import_module` and `__import__` calls become typed graph edges; unknown targets remain located limits | Graph 1.5.0, scoring 0.8.0-provisional |
| 0.9.0 | Python first-statement docstrings leave executable function mass and both clone populations; physical SLOC remains evidence | Python parser `1.1.18-trellis.2`, scoring 0.9.0-provisional |
| 0.9.0 additive | Oversized source documentation, independent executable clone candidates, initialization decisions, nesting, and report/change context | Existing report schema carries additive metrics/findings; none is a score input |

No historical metric id was assigned a new meaning. Workspace cycle ids keep
their earlier scope; scored production cycle ids are separate. Raw clone
groups remain authoritative while `duplication.candidate.*` names the
advisory population. Executable-scope and documentation findings have stable
owner facts and explicit ambiguity. Provider evidence and safeguards remain
outside native scoring.

Schema 1.5.0 readers retain reports from schema 1.0.0 through 1.5.0 with each
version's original interpretation. Comparison fails closed across analyzer,
scoring, graph or scored-analysis identities. A fresh baseline is required;
an old report cannot be silently supplied with facts it never contained.
SQLite rows retain their recorded analyzer, schema, scoring version and
nullable score.

## Fixed-corpus transition

Every release slice ran the same 16 pinned scopes three times. The current
P3.2 artifact is byte-identical in measurement payload to P3.1, and all
scopes are complete and deterministic. Mean exact contributions across the
16 development scopes around the scored 0.8.0 → 0.9.0 docstring transition:

| Analyzer | Complexity/erosion | Duplication | Import cycles | Exact index | Rounded mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0.8.0 | 32.921461 | 10.565190 | 10.389224 | 53.875874 | 53.8125 |
| 0.9.0 | 32.921461 | 10.788245 | 10.389224 | 54.098930 | 54.0625 |
| Change | 0.000000 | +0.223055 | 0.000000 | +0.223055 | +0.2500 |

This is an analyzer correction on unchanged source. Documentation leaves
both duplicated-line numerator and eligible denominator; depending on the
removed regions, density may rise or fall. The movement is not target-code
degradation. Per-scope metrics, payload hashes and resource records are under
[`corpus/index-utility/`](../corpus/index-utility/README.md).

The final [Trellis self-audit](../corpus/index-utility/self-audit/index-release-a/manifest.json)
holds analyzer 0.9.0 constant across the P3.2 and completed Release A source.
Both score 38 with 41 eroded production functions. The completed source has
19 raw clone groups, one more than the P3.2 source, after adding the generated
study tooling. Raw erosion mass rises from 25,918.668 to 26,651.773. Larger
density denominators lower the complexity and cycle contributions while the
new clone raises duplication, leaving the rounded index unchanged; this is
source movement, not a cleanup. Three final measurement payload fingerprints
are identical. An intermediate run exposed two new research-helper hotspots
and a one-point regression; those helpers were split, and the final source has
no index-study complexity hotspot.

## Baseline migration

Keep the old baseline and capture a uniquely named 0.9.0 report before
enabling regression or new-finding policy:

```sh
trellis audit /absolute/workspace --json \
  --out /absolute/artifacts/baseline-0.9.0.json
trellis audit /absolute/workspace --json \
  --baseline /absolute/artifacts/baseline-0.9.0.json
```

For fleet targets, regenerate each target's baseline with that target's
source classification and configuration. Do not copy a baseline between
scopes. Preserve old report files and history rows. When a saved source
snapshot exists, auditing that snapshot with old and new analyzers can
separate measurement movement from source movement; comparison still occurs
only within compatible versions.

## Rollback

Rollback means reinstalling the prior release and pairing it with its prior
baseline. Use 0.8.0 with a 0.8.0 baseline to restore pre-docstring measurement,
or the earlier matching release for an earlier semantic transition. Do not
overwrite 0.9.0 reports, delete history, force incompatible comparison, or
recalculate old artifacts. npm and Git tags remain immutable under the normal
runbook.

Before a release cut, run:

```sh
bun run lint
bun run typecheck
bun test
bun run check:all
bun run smoke:package
```

Then rerun the 16-scope three-run harness and Trellis self-audit. CLI, SDK,
fleet, saved-baseline, history and policy behavior must share the same core;
a required missing native dimension withholds the headline, while optional
provider failure cannot manufacture zero debt.
