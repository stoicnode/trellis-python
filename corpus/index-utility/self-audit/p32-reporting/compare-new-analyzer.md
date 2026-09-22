# trellis compare — @os-eco/trellis-cli → @os-eco/trellis-cli

comparable: yes — measurement semantics match (SPEC §3.5)
caveat (configuration-unverifiable): audit configurations were not supplied: configuration compatibility could not be verified
caveat (source-scope-changed): source coverage differs between the two reports: the compared populations are not identical

## Index

| baseline | current | delta |
| --- | --- | --- |
| 39/100 | 38/100 | -1 |

Lower is better · scoring 0.9.0-provisional.

## Change explanation

Native source snapshot changed; the reports measure different target content.

| dimension | exact points before | exact points after | exact delta | integer points before → after |
| --- | ---: | ---: | ---: | ---: |
| complexity-erosion | 26.147960301 | 25.843260301 | -0.3047 | 26 → 26 |
| duplication | 9.818183632 | 9.761483632 | -0.0567 | 10 → 9 |
| import-cycle | 2.79726405 | 2.77666405 | -0.0206 | 3 → 3 |

Changed density denominators (10):
- duplication.candidate.density.production: 0/18775 → 0/19002
- duplication.candidate.density.test: 1347/23608 → 1370/23687
- duplication.density.production: 965/30106 → 965/30649
- duplication.density.test: 3550/33480 → 3573/33575
- duplication.duplicated-lines.production: 965/30106 → 965/30649

Numeric persistent-finding changes (1):
- complexity.hotspot src/report/audit-markdown.ts mass: 137.477 → 138.293

Saturated density terms: none → none.
Review located findings and set explicit metric budgets; there is no default quality cutoff.

## Metric deltas (27 changed of 70)

| metric | baseline | current | delta |
| --- | --- | --- | --- |
| complexity.executable-sloc.production | 30106 | 30649 | +543 |
| complexity.executable-sloc.test | 33480 | 33575 | +95 |
| complexity.functions.production | 2279 | 2339 | +60 |
| complexity.functions.test | 3872 | 3879 | +7 |
| documentation.blocks.production | 2334 | 2346 | +12 |
| duplication.candidate.covered-lines.test | 1347 | 1370 | +23 |
| duplication.candidate.density.test | 0.0571 | 0.0578 | +0.0008 |
| duplication.candidate.eligible-lines.production | 18775 | 19002 | +227 |
| duplication.candidate.eligible-lines.test | 23608 | 23687 | +79 |
| duplication.candidate.equality-preserving-groups.test | 24 | 25 | +1 |
| … | | | +17 more |

## Findings

141 new · 141 resolved · 170 persistent

### New (141)

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
