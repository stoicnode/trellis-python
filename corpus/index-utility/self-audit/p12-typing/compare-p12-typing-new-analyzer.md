# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.6.0-provisional.

## Metric deltas (15 changed of 32)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.functions.production | 2025 | 2062 | +37 |
| complexity.functions.test | 3735 | 3749 | +14 |
| duplication.density.production | 0.0345 | 0.0341 | -0.0004 |
| duplication.density.test | 0.1061 | 0.1066 | +0.0006 |
| duplication.duplicated-lines.test | 3426 | 3456 | +30 |
| duplication.groups.test | 115 | 116 | +1 |
| erosion.eroded-share.production | 0.1351 | 0.1326 | -0.0024 |
| erosion.eroded-share.test | 0.0182 | 0.0181 | -0.0001 |
| erosion.mass.production | 22474.945 | 22883.109 | +408.164 |
| erosion.mass.test | 19434.529 | 19500.542 | +66.013 |
| … | | | +5 more |

## Findings

109 new · 109 resolved · 67 persistent

### New (109)

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
| … | | +99 more |
### Resolved (109)

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
| … | | +99 more |
