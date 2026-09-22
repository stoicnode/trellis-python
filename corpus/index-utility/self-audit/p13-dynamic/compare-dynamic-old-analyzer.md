# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.7.0-provisional.

## Metric deltas (16 changed of 32)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.functions.production | 2069 | 2104 | +35 |
| complexity.functions.test | 3761 | 3784 | +23 |
| duplication.density.production | 0.034 | 0.0337 | -0.0003 |
| duplication.density.test | 0.1062 | 0.1065 | +0.0003 |
| duplication.duplicated-lines.test | 3456 | 3487 | +31 |
| duplication.groups.test | 116 | 117 | +1 |
| erosion.eroded-count.production | 37 | 38 | +1 |
| erosion.eroded-share.production | 0.1321 | 0.132 | -0.0001 |
| erosion.eroded-share.test | 0.0181 | 0.0179 | -0.0001 |
| erosion.mass.production | 22977.996 | 23399.607 | +421.611 |
| … | | | +6 more |

## Findings

111 new · 108 resolved · 68 persistent

### New (111)

| kind | location | summary |
| --- | --- | --- |
| complexity.hotspot | scripts/validate-oss-benchmarks.test.ts:133-185 | CC 12, mass 87.361, nesting 1, SLOC 53 |
| complexity.hotspot | src/client/duplication-cutover.test.ts:113-171 | CC 12, mass 92.174, nesting 2, SLOC 59 |
| complexity.hotspot | src/contract/metric.ts:33-72 | CC 11, mass 69.57, nesting 1, SLOC 40 |
| complexity.hotspot | src/providers/manifest.ts:82-119 | CC 11, mass 66, nesting 2, SLOC 36 |
| complexity.hotspot | src/python/imports.ts:252-274 | CC 11, mass 52.754, nesting 2, SLOC 23 |
| complexity.hotspot | src/report/audit-json-providers.test.ts:88-130 | CC 11, mass 67.809, nesting 1, SLOC 38 |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 2 copies of 167 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:5-23 | 3 copies of 164 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:90-112 | 2 copies of 106 normalized tokens |
| duplication.clone-group | scripts/check-debt-markers.test.ts:135-148 | 2 copies of 104 normalized tokens |
| … | | +101 more |
### Resolved (108)

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
| … | | +98 more |
