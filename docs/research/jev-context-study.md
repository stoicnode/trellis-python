# Jev full-context follow-up

**Run date:** 2026-09-22
**Status:** exploratory research evidence; no audit or scoring change

## Question

The first 120-sample Jev run sent isolated excerpts. Jev judged only 38/120
excerpts context-sufficient and separated Trellis-flagged units from matched
controls at chance level. This follow-up tests whether the missing structural
context explains that result.

## Packet

[`scripts/index-study-context.ts`](../../scripts/index-study-context.ts) rebuilt
the frozen packet from the same six pinned, clean repository checkouts and the
same hidden answer key. For each selected unit it supplied:

- the complete function or class and up to 12 neighboring lines on each side;
- up to eight deterministic lexical references as possible callers or usages;
- every location in every overlapping clone group, plus the exact source of one
  representative member whose normalized body defines the group;
- outgoing imports and incoming local dependency edges; and
- the original language, repository role and size stratum.

Two preliminary packets included the full source of every clone member. One Zod
locale clone group made a record too large for the model request. A second packet
merged overlapping copies but still exceeded the limit. The final packet keeps
every member location and one exact representative body. This preserves the
relationship and avoids repeating normalized-equivalent source hundreds of
times. The two aborted experiments produced no complete study artifact. The cost
reported below covers the successful run and excludes any provider charge for
those attempts.

The model never received Trellis flags or the sampling stratum. The harness joined
those labels after the response. Python and TypeScript results are reported
separately. [`jev-context-v2-summary.json`](../../corpus/index-utility/study/jev-context-v2-summary.json)
records artifact hashes, model identity, token use, cost and the complete numeric
summary.

## Results

Full context changed both evidence coverage and discrimination:

| Packet | Context sufficient | Maintenance AUC | Refactor-value AUC |
| --- | ---: | ---: | ---: |
| Isolated excerpts | 38/120 | 0.508 | 0.481 |
| Full context | 117/120 | **0.703** | **0.617** |

An AUC of 0.5 is chance ordering; 1.0 is perfect ordering. The full-context
maintenance result means a randomly selected flagged unit received a higher
maintenance score than a randomly selected control about 70% of the time.

| Language | Flagged mean | Control mean | Maintenance AUC | Refactor AUC |
| --- | ---: | ---: | ---: | ---: |
| Python | 0.985 | 0.612 | **0.748** | **0.677** |
| TypeScript | 1.234 | 0.959 | **0.665** | **0.563** |

The finding-level maintenance AUCs against all controls were 0.815 for independent
executable duplication, 0.805 for complexity hotspots, 0.719 for clone groups and
0.697 for executable nesting. Clone-group maintenance moved from a mean of 0.400
in the excerpt study to 1.130 with relationship context.

Repository results were uneven. Maintenance AUC ranged from 0.510 for Hono to
0.870 for HTTPX. The aggregate result therefore does not establish that the
index works equally well in every codebase.

Under the frozen actionable rule, none of 59 evaluable flagged units crossed both
the material-maintenance and refactor-value thresholds. One of 58 evaluable
controls did. Jev distinguished relative maintenance burden while usually judging
that a refactor was not clearly worthwhile.

The successful request used 287,412 input tokens and 12,419 output tokens.
OpenRouter reported $0.012071304 for that run. It resolved the requested
`typesafe/jev-1.13` model to `typesafe/jev-1.13-20260917`.

## Decision

The first run's chance result was mainly a packet-design failure. Complete units
and relationship context produce useful relative discrimination, with stronger
evidence for Python than TypeScript.

This still does not justify adding model output to Trellis. The result is
probabilistic, one repository shows chance separation, and the actionable rule
selected no flagged unit. Jev remains a research instrument. Deterministic rules
need their own public labels before they can become optional evidence, and any
future score promotion requires a versioned native implementation and calibration.
