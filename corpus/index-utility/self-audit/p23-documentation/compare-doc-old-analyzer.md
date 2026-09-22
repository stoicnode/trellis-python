# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.9.0-provisional.

## Metric deltas (16 changed of 38)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.executable-sloc.production | 28397 | 28811 | +414 |
| complexity.executable-sloc.test | 32862 | 33123 | +261 |
| complexity.functions.production | 2119 | 2162 | +43 |
| complexity.functions.test | 3798 | 3828 | +30 |
| duplication.density.production | 0.0336 | 0.0331 | -0.0005 |
| duplication.density.test | 0.1065 | 0.1057 | -0.0008 |
| erosion.eroded-count.production | 38 | 39 | +1 |
| erosion.eroded-share.production | 0.1314 | 0.131 | -0.0004 |
| erosion.eroded-share.test | 0.0178 | 0.0176 | -0.0002 |
| erosion.mass.production | 23501.993 | 23965.66 | +463.667 |
| … | | | +6 more |

## Findings

111 new · 111 resolved · 69 persistent

### New (111)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/documentation/typescript-docs.ts:21-36 | CC 13, mass 52, nesting 1, SLOC 16 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 2 copies of 167 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 3 copies of 164 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:90-112 | 2 copies of 106 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:135-148 | 2 copies of 104 normalized tokens |
| … | | +101 more |
### Resolved (111)

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
| … | | +101 more |
