# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 38/100 | 38/100 | 0 |

Lower is better · scoring 0.9.0-provisional.

## Change explanation

Native source snapshot changed; the reports measure different target content.
Index unchanged while 24 raw metric values and 0 numeric persistent-finding facts changed; integer rounding or saturated terms can hide movement.

| dimension | exact points before | exact points after | exact delta | integer points before → after |
| --- | ---: | ---: | ---: | ---: |
| complexity-erosion | 25.843260301 | 25.585860301 | -0.2574 | 26 → 25 |
| duplication | 9.761483632 | 9.690683632 | -0.0708 | 9 → 10 |
| import-cycle | 2.77666405 | 2.75666405 | -0.02 | 3 → 3 |

Changed density denominators (10):
- duplication.candidate.density.production: 0/19002 → 0/19423
- duplication.candidate.density.test: 1370/23687 → 1370/23791
- duplication.density.production: 965/30649 → 965/31354
- duplication.density.test: 3573/33575 → 3573/33726
- duplication.duplicated-lines.production: 965/30649 → 965/31354

Saturated density terms: none → none.
Review located findings and set explicit metric budgets; there is no default quality cutoff.

## Metric deltas (24 changed of 70)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.executable-sloc.production | 30649 | 31354 | +705 |
| complexity.executable-sloc.test | 33575 | 33726 | +151 |
| complexity.functions.production | 2339 | 2434 | +95 |
| complexity.functions.test | 3879 | 3905 | +26 |
| documentation.blocks.production | 2346 | 2354 | +8 |
| duplication.candidate.density.test | 0.0578 | 0.0576 | -0.0003 |
| duplication.candidate.eligible-lines.production | 19002 | 19423 | +421 |
| duplication.candidate.eligible-lines.test | 23687 | 23791 | +104 |
| duplication.density.production | 0.0315 | 0.0308 | -0.0007 |
| duplication.density.test | 0.1064 | 0.1059 | -0.0005 |
| … | | | +14 more |

## Findings

146 new · 141 resolved · 171 persistent

### New (146)

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
| … | | +136 more |
### Resolved (141)

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
| … | | +131 more |
