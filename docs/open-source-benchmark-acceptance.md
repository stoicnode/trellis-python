# Open-source benchmark acceptance (2026-09-22)

This is the post-remediation acceptance record for the operator-prepared,
pinned checkouts named in
[`corpus/oss-benchmark/manifest.json`](../corpus/oss-benchmark/manifest.json).
The checkouts remain outside the repository. Each scope ran three times in a
fresh Bun process through `runWorkspaceAudit`; the harness compares the
versioned measurement payload, excluding run timing metadata, and records
median wall time plus maximum peak RSS. It neither fetches, installs, nor
executes target-project code.

Run it after preparing the pinned checkouts:

```bash
bun scripts/validate-oss-benchmarks.ts \
  --prepared-root /tmp/trellis-oss-audit-20260922/repos \
  --acceptance --runs 3
```

The command exits nonzero for a changed checkout or a non-repeatable
measurement. It prints the full JSON evidence, including the first ten
ranked hotspots and clone groups for each scope. Runtime and RSS are record
metadata, not score inputs.

## Result

All ten scopes had identical measurement payloads across three fresh runs.
The full emitted evidence is retained outside the checkout at
`/tmp/trellis-oss-audit-20260922/post-fix-acceptance.json` on the preparation
host; it can be recreated with the command above.
The six full repositories are correctly incomplete because their known graph
contains non-literal dynamic imports or source declarations that resolve only
to unavailable build output. A withheld headline expresses that uncertainty;
it is not a score of 100. The four focused source scopes are complete and
retain their existing numerical scores.

| scope | language | production files / SLOC | headline | median ms | peak MiB |
|---|---:|---:|---|---:|---:|
| Zod full | TS | 311 / 46,651 | withheld: import-cycle | 1,206 | 690 |
| date-fns full | TS | 1,652 / 83,344 | withheld: import-cycle | 1,217 | 890 |
| TanStack Query full | TS | 664 / 46,718 | withheld: import-cycle | 1,868 | 893 |
| Requests full | Python | 22 / 5,095 | withheld: import-cycle | 173 | 169 |
| Flask full | Python | 35 / 8,074 | withheld: import-cycle | 244 | 170 |
| Rich full | Python | 146 / 36,847 | withheld: import-cycle | 696 | 253 |
| Zustand `src` | TS | 15 / 1,225 | 27 | 53 | 120 |
| ts-pattern `src` | TS | 18 / 3,238 | 39 | 76 | 137 |
| Ky `source` | TS | 31 / 2,527 | 45 | 80 | 140 |
| TanStack Query `query-core` | TS | 25 / 5,946 | 47 | 415 | 304 |

Python parser coverage is complete: Requests (37 files), Flask (83), and
Rich (213) have zero parse-failure files. The duplication detector also
finishes on date-fns and Rich within the existing bounds. Remaining full-run
uncertainty is explicit: Zod has 36 `no-target` and two dynamic imports;
date-fns has three and one; TanStack Query has 220 and one; Requests has one
and two; Flask has two dynamic imports; Rich has three dynamic imports.
TanStack Query's test-set duplication metrics are also incomplete; they remain
visible separately from the production-score unknown dimension.

## Location review and calibration decision

The inspected hotspots are plausible maintenance targets rather than proof
that any library is poor quality: Zod's `from-json-schema.ts:390-806` (CC
122), date-fns' `parse/index.ts:361-532` (CC 52), TanStack Query's
`query-core/src/query.ts:590-820` (CC 32), Requests' `adapters.py:634-748`
(CC 19), Flask's `sansio/blueprints.py:273-377` (CC 22), and Rich's
`pretty.py:621-872` (CC 46). The complete scopes similarly preserve useful
location evidence: Zustand `middleware/devtools.ts:308-420`, ts-pattern
`internals/helpers.ts:32-117`, Ky `core/Ky.ts:387-548`, and query-core
`src/query.ts:590-820`.

Clone evidence remains located and reviewable, including ts-pattern
`types/Pattern.ts:409-468` / `548-607` (two 141-token copies), Ky
`types/ky.ts:22-62` (two 106-token copies), and query-core
`src/types.ts:995-1028` (two 109-token copies). The fixed corpus continues
to provide controlled paired changes. Its acceptance harness also evaluates
the reverse cleanup directions: function simplification (26 to 0) and cycle
break (12 to 0), each with unrelated metrics held unchanged.

No scoring threshold or weight changes are warranted. The complete focused
scores span 27–47 across small and medium TypeScript source sets; the full
scans are deliberately non-rankable until their graph coverage is complete.
The existing pairs show monotonic, isolated movement for the dimensions they
exercise, but do not establish a better distributional calibration. Scoring
therefore remains `0.3.0-provisional`; no safeguards or test-code credit was
added.

Trellis also audited its own checkout separately after the research-test
dynamic-import fixtures were replaced with resolvable controls: that run was
complete with index 39 and zero unresolved sites. It is dogfood evidence, not
an additional open-source benchmark scope.
