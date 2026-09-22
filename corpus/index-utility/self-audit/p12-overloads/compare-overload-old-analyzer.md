# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.6.0-provisional.

## Metric deltas (13 changed of 32)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.functions.production | 2062 | 2069 | +7 |
| complexity.functions.test | 3749 | 3761 | +12 |
| duplication.density.production | 0.0341 | 0.034 | -0.0001 |
| duplication.density.test | 0.1066 | 0.1062 | -0.0004 |
| erosion.eroded-share.production | 0.1326 | 0.1321 | -0.0005 |
| erosion.eroded-share.test | 0.0181 | 0.0181 | -0.0001 |
| erosion.mass.production | 22883.109 | 22977.996 | +94.887 |
| erosion.mass.test | 19500.542 | 19596.709 | +96.167 |
| graph.edges.external | 713 | 719 | +6 |
| graph.edges.local | 1325 | 1337 | +12 |
| … | | | +3 more |

## Findings

107 new · 107 resolved · 69 persistent

### New (107)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 2 copies of 167 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 3 copies of 164 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:90-112 | 2 copies of 106 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:135-148 | 2 copies of 104 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:136-151 | 2 copies of 103 normalized tokens |
| … | | +97 more |
### Resolved (107)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 2 copies of 167 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 3 copies of 164 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:90-112 | 2 copies of 106 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:135-148 | 2 copies of 104 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:136-151 | 2 copies of 103 normalized tokens |
| … | | +97 more |
