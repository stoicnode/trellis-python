# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.8.0-provisional.

## Metric deltas (15 changed of 36)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.functions.production | 2104 | 2119 | +15 |
| complexity.functions.test | 3784 | 3798 | +14 |
| duplication.density.production | 0.0337 | 0.0336 | -0.0001 |
| duplication.density.test | 0.1065 | 0.1065 | +0 |
| duplication.duplicated-lines.test | 3487 | 3501 | +14 |
| duplication.groups.test | 117 | 118 | +1 |
| erosion.eroded-share.production | 0.132 | 0.1314 | -0.0006 |
| erosion.eroded-share.test | 0.0179 | 0.0178 | -0.0001 |
| erosion.mass.production | 23399.607 | 23501.993 | +102.386 |
| erosion.mass.test | 19730.294 | 19833.664 | +103.37 |
| … | | | +5 more |

## Findings

111 new · 110 resolved · 69 persistent

### New (111)

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
### Resolved (110)

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
| … | | +100 more |
