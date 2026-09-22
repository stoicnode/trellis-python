# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 39/100 | 0 |

Lower is better · scoring 0.9.0-provisional.

## Metric deltas (23 changed of 70)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.executable-sloc.production | 29547 | 30106 | +559 |
| complexity.executable-sloc.test | 33318 | 33480 | +162 |
| complexity.functions.production | 2232 | 2279 | +47 |
| complexity.functions.test | 3851 | 3872 | +21 |
| documentation.blocks.production | 2323 | 2334 | +11 |
| duplication.candidate.density.test | 0.0574 | 0.0571 | -0.0004 |
| duplication.candidate.eligible-lines.production | 18420 | 18775 | +355 |
| duplication.candidate.eligible-lines.test | 23462 | 23608 | +146 |
| duplication.density.production | 0.0327 | 0.0321 | -0.0006 |
| duplication.density.test | 0.1051 | 0.106 | +0.001 |
| … | | | +13 more |

## Findings

142 new · 141 resolved · 168 persistent

### New (142)

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
| … | | +132 more |
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
