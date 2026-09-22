# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.9.0-provisional.

## Metric deltas (19 changed of 42)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.executable-sloc.production | 28811 | 29547 | +736 |
| complexity.executable-sloc.test | 33123 | 33318 | +195 |
| complexity.functions.production | 2162 | 2232 | +70 |
| complexity.functions.test | 3828 | 3851 | +23 |
| documentation.blocks.production | 2306 | 2323 | +17 |
| duplication.density.production | 0.0331 | 0.0327 | -0.0004 |
| duplication.density.test | 0.1057 | 0.1051 | -0.0006 |
| duplication.duplicated-lines.production | 953 | 965 | +12 |
| duplication.groups.production | 17 | 18 | +1 |
| erosion.eroded-count.production | 39 | 41 | +2 |
| … | | | +9 more |

## Findings

129 new · 126 resolved · 71 persistent

### New (129)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/metrics/clone-candidates.ts:89-110 | CC 13, mass 60.975, nesting 3, SLOC 22 |
| complexity.hotspot | src/metrics/clone-semantics.ts:86-123 | CC 13, mass 80.137, nesting 2, SLOC 38 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| documentation.excessive | src/audit/assemble.ts:1-44 | documentation block exceeds a size threshold (38 lines, 347 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/audit/audit.ts:1-55 | documentation block exceeds a size threshold (47 lines, 421 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/audit/providers.ts:1-41 | documentation block exceeds a size threshold (36 lines, 310 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| … | | +119 more |
### Resolved (126)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| documentation.excessive | src/audit/assemble.ts:1-44 | documentation block exceeds a size threshold (38 lines, 347 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/audit/audit.ts:1-55 | documentation block exceeds a size threshold (47 lines, 421 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/audit/providers.ts:1-41 | documentation block exceeds a size threshold (36 lines, 310 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/compare/compatibility.ts:1-44 | documentation block exceeds a size threshold (37 lines, 323 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| documentation.excessive | src/compare/policy.ts:1-56 | documentation block exceeds a size threshold (49 lines, 427 words); review repetition or extended tutorials while retaining essential API contracts and examples |
| … | | +116 more |
