# Handoff: evaluate the practical value of the Trellis index

This is a task brief for another agent, not an evaluation result. Start from
`main` in `/Users/bbr/dev/trellis-python` (the initial handoff commit is
`6bb4bb6`). Read [AGENTS.md](../../AGENTS.md), [SPEC.md](../../SPEC.md), the
[Python calibration record](../python-score-calibration.md), and the
[pinned Python manifest](../../corpus/python-calibration/manifest.json).

The exploratory review's proposed response is the
[index improvement plan](../index-improvement-plan.md). It records reproduced
counterexamples, implementation phases and validation gates; it does not claim
that the independent study below has been completed.

## Assignment

Determine **when the 0–100 Trellis sloppiness index helps a maintainer make a
better decision, and when it misleads them**. Lower is better, but the number
is a structural-debt index, not a percentage of bad code or a general quality
grade. The current scoring contract is `0.4.0-provisional`. The 12 pinned
Python package scopes have complete, repeatable scores; their reputation is
neither validation nor a ground-truth label. Assess both the absolute score
and changes over time. Use other analyzers to investigate disagreements, not
as a scoring oracle.

Answer these questions with evidence:

1. Do high-ranked hotspots point to code a maintainer would reasonably inspect
   or improve? What important problems are absent from the hotspots and score?
2. On projects generally regarded as well maintained, does a high index
   identify real structural costs, reflect scale or intentional architecture,
   or expose a measurement/calibration defect? Conversely, can a low index
   coexist with significant problems outside Trellis's measured scope?
3. Does an index change across Git revisions track a meaningful improvement
   or deterioration? How often does it move after innocuous changes, and how
   often does a substantive maintenance change leave it unchanged?
4. Is an absolute score, a per-project trend, a changed raw metric, or a
   located finding most useful for triage and CI policy? Can any cutoff be
   defended from evidence rather than chosen as an operator preference?
5. What must someone inspect before acting on a score: source coverage,
   completeness, scoring/analyzer versions, dimension contributions, hotspot
   locations, clone overlap, cycle scope, and known blind spots?

## Study design

- Reproduce the [12 pinned Python scopes](../../corpus/python-calibration/manifest.json)
  with the existing [measurement harness](../../scripts/python-calibration-measure.ts).
  Add a small, predeclared set of TypeScript and Python projects with strong
  maintenance reputations and contrasting documented maintenance problems.
  Pin commits and exact audited package roots. Explain why each project was
  selected; popularity, age, and reputation alone are not quality labels.
  Compare similar source populations where possible, and show size and
  unsupported-language coverage rather than implying whole-repository scores.
- Inspect a predeclared sample of top hotspots **and** randomly selected or
  matched unflagged code. Have reviewers assess maintainability and actionability
  without seeing Trellis scores or competitor outputs first. Record review
  criteria, disagreements, and adjudication; distinguish a genuine defect from
  a reasonable design tradeoff. Use issue/refactor history as independent
  context when it exists, without treating every past edit as proof of debt.
- For a few projects, measure pinned revisions before and after known
  maintenance changes, plus controls such as formatting, comments, test-only
  changes, and large clean additions. Compare score and raw-metric deltas to
  the actual changes. Use Wily for additional Python history context where it
  helps, while keeping its metric definitions separate from Trellis's.
- Compare underlying findings on identical supported source scopes with
  **jscpd**, **Lizard**, **dependency-cruiser** (JS/TS), **Import Linter**
  (Python), and **Radon + Xenon** (Python). Include Wily's historical view.
  Verify each tool's actual capabilities and version; align clone thresholds,
  path exclusions, function identity, and dependency rules where feasible.
  Explain non-comparable outputs instead of forcing agreement between scores.
- Quantify useful signal where the review supports it: for example, reviewed
  hotspot hit rate, actionable findings per review hour, missed problems in
  unflagged samples, and how often directional score changes agree with
  documented changes. Report uncertainty and sample size. Separate parser or
  resolver bugs, score-formula behavior, project-scope effects, and blind spots.

## Deliverables and boundaries

Produce a reproducible manifest, commands, pinned tool versions/configuration,
raw artifacts or stable summaries, and an evaluation report. The report should
show both corroboration and concrete counterexamples, state which uses of the
index are supported, and include a short **how to read this imperfect index**
guide. Recommend follow-up changes with evidence, classified as measurement
fixes, calibration experiments, or documentation/product changes. Do not alter
weights or thresholds solely to match another analyzer or a project's
reputation. Keep external-tool setup separate from Trellis's deterministic,
offline default audit; never execute target project code during a native audit.
Follow the repository's validation and commit rules for any changes, and do
not push without a new request.
