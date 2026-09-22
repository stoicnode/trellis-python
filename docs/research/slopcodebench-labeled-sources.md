# Pre-labeled code sources for validating trellis

**Research date:** 2026-09-22  
**Scope:** SlopCodeBench, deterministic AST matching, and public datasets that can be
used without commissioning a new human review. Only primary project, paper, and
dataset sources are cited.

## Short answer

Trellis already contains the most important part of the SlopCodeBench score. Its
complexity erosion calculation uses the same function mass, `CC × sqrt(SLOC)`, and
the same `CC > 10` erosion boundary described in the
[SlopCodeBench paper](https://arxiv.org/html/2603.24755v2). Trellis also measures
duplication. It does **not** currently expose SlopCodeBench's standalone verbosity
ratio: the fraction of source lines covered by either clone detection or a set of
AST pattern rules.

`ast-grep` can implement deterministic syntax rules for Python, JavaScript,
TypeScript, and TSX. It can report exact source ranges, so those ranges can be
combined into a unique-line coverage ratio. A match is evidence that a chosen
syntax pattern is present. It is not an independent label that the code is bad,
unnecessary, unreachable, or behaviorally equivalent to a shorter version.

The strongest ready-made paired source found for Trellis's structural purpose is
[MINE-USTC SmellBench](https://github.com/MINE-USTC/SmellBench): 147 Python
instances with an injected smell diff and its reversal across seven projects.
Use it as the primary directional corpus. Add official Ruff and typescript-eslint
rule fixtures for small, explicit syntax labels; CodeReviewer, RefactoringMiner
and Architectural SmellBench as external change or smell checks; SWE-bench as an
accepted-fix non-inferiority check; and CodeNet as a negative control. This gives
useful validation without asking Trellis maintainers to label code themselves.

## SlopCodeBench and the current Trellis score

The paper evaluates 36 software tasks and 196 model checkpoints. Its reported
Python study includes 2,869 agent checkpoints and compares them with 473 Python
repositories and 13,667 human commits. It reports two structural measures:

- **Structural erosion:** a complexity-weighted share of code in functions whose
  cyclomatic complexity exceeds 10. Function mass is `CC × sqrt(SLOC)`.
- **Verbosity:** the number of unique source lines covered by clone detection or
  one or more AST rules, divided by source lines of code. Overlapping matches are
  counted once.

The paper's evaluated rule set contains 137 `ast-grep` rules. The authors report
77% higher structural erosion and 75.5% higher verbosity in agent-generated code
than in their human-code comparison. These are aggregate results from the cited
study; they are not universal thresholds for classifying an individual repository.
See the [paper's metric definition and experiments](https://arxiv.org/html/2603.24755v2).

| Capability | SlopCodeBench | Trellis now | Gap |
| --- | --- | --- | --- |
| Complexity-weighted function mass | `CC × sqrt(SLOC)` | Same calculation | None in the core construct |
| Eroded function boundary | `CC > 10` | Same boundary | None in the core construct |
| Erosion output | Ratio used as a study metric | Raw metrics plus a weighted contribution to the 0–100 index | Trellis could expose a normalized study-compatible field if useful |
| Clone evidence | Included in verbosity line coverage | Duplication density and group count | Trellis does not union clone lines with rule-match lines |
| AST slop patterns | Included in verbosity line coverage | No equivalent provider today | Add as optional evidence first |
| Overall meaning | Research measures of two structural tendencies | Broader sloppiness index: erosion, duplication, and cycles | Scores are related but not interchangeable |

The existing Trellis score should therefore not be described as the
SlopCodeBench verbosity score. Trellis has an exact match for the paper's erosion
construct and partial coverage of its verbosity construct.

### What is actually available from the SlopCodeBench project

- The [runner repository](https://github.com/SprocketLab/slop-code-bench) is MIT
  licensed. The reviewed revision was
  [`31ceea3`](https://github.com/SprocketLab/slop-code-bench/commit/31ceea3add480edb33431e70475c4c70597e6b31).
- The [problem repository](https://github.com/gabeorlanski/scb-problems) is
  Apache-2.0 licensed and contains the task directories, tests, and reference
  solutions.
- The [Hugging Face dataset](https://huggingface.co/datasets/gabeorlanski/slopcodebench)
  is marked MIT and exposes 196 task records for each of Python, JavaScript, C++,
  Rust, and Java. Its rows are specifications and test material, not the evaluated
  agent checkpoints from the paper.
- The paper's [Zenodo record](https://zenodo.org/records/19257129) is marked MIT.
  At the research date its record contains the paper PDF, rather than the 2,869
  checkpoint workspaces or per-checkpoint metric outputs.

This means the public task suite can generate a new Trellis experiment, but it is
not currently a downloadable set of the paper's pre-scored good and bad
workspaces. The human-repository comparison is also a population baseline, not a
per-file expert good/bad annotation.

The metric implementation is in
[`scb-check`](https://github.com/gabeorlanski/scb-check), reviewed at
[`a861822`](https://github.com/gabeorlanski/scb-check/commit/a8618228939def726c2ec48b354693e5aa1999d5).
The reviewed SlopCodeBench
[checkpoint driver](https://github.com/SprocketLab/slop-code-bench/blob/31ceea3add480edb33431e70475c4c70597e6b31/src/slop_code/metrics/checkpoint/driver.py)
invokes `uvx scb-check==0.1.3 check --report --include-all`. That runtime package
resolution can download software, so Trellis cannot reuse the invocation on its
offline audit path. A Trellis provider would need an operator-prepared binary
verified by version and digest.

Inspection of both the pinned 0.1.3 release and the reviewed current revision
found 197 bundled rule ids, whereas paper v2 says 137 rules. This version drift
alone is enough to require a rule-bundle hash in any reproduction. The current
package pins `ast-grep-cli` 0.42.1. Its AST and structural rule support is
Python-specific; the other listed languages receive clone evidence only. The
repository also has conflicting license declarations: the root `LICENSE` is
Apache-2.0 while `pyproject.toml` declares MIT. Trellis should not copy or
redistribute its rule files until the maintainers clarify which license governs
them.

Most importantly, SlopCodeBench's verbosity values are produced by the same kinds
of AST rules and clone matches that an implementation would be trying to validate.
Treating those values as ground truth would only prove implementation agreement.
It would not establish that the matched code is genuinely low quality.

## What `ast-grep` can and cannot do

The official [`ast-grep` rule model](https://ast-grep.github.io/guide/rule-config.html)
supports node patterns, syntax kinds, regular expressions, boolean composition,
and reusable utility rules. Its
[relational rules](https://ast-grep.github.io/guide/rule-config/relational-rule.html)
can constrain a node by ancestors, descendants, and neighboring nodes. The
[supported-language list](https://ast-grep.github.io/reference/languages.html)
includes Python, JavaScript, TypeScript, and TSX. The engine is
[MIT licensed](https://github.com/ast-grep/ast-grep/blob/main/LICENSE).

With a pinned executable, parser, rule bundle, configuration, and input snapshot,
it is suitable for reproducible signals such as:

- redundant boolean comparisons and simple double negations;
- an `else` branch after an unconditional `return`;
- Python `range(len(x))` indexing forms;
- explicit default arguments such as `dict.get(key, None)`;
- redundant conversions whose redundancy is visible in syntax;
- specific deeply nested guard or wrapper idioms;
- exact line ranges for every match, emitted as JSON.

It cannot establish on syntax alone:

- whether a statement is semantically unnecessary or behaviorally redundant;
- whether two implementations are behaviorally equivalent;
- complete symbol use, reachability, or call counts across a workspace;
- runtime types, framework conventions, or architectural intent;
- copy/paste clones; SlopCodeBench uses a separate clone detector;
- a good/bad label independent of the rule author's judgment.

A safe Trellis integration is an optional, unscored provider initially. Pin the
exact executable and artifact digest, run fixed arguments through the controlled
provider process boundary, use the staged read-only workspace, save the rule
bundle hash in evidence identity, and record `unavailable` or `incomplete` when
execution fails. An absent binary must never become a zero-match clean result.
Any later score contribution needs held-out corpus evidence and a new scoring
version.

## Candidate labeled sources

The table separates the meaning of each label. A correctness label and a
maintainability label answer different questions.

| Source | Languages and size | Label provenance | Access and license | Best Trellis use | Main confounds |
| --- | --- | --- | --- | --- | --- |
| [MINE-USTC SmellBench](https://github.com/MINE-USTC/SmellBench) | Python; 147 instances, 294 instruction cases, seven projects and seven smell types | A smell is injected into original project code; `smell_content` is the bad diff and `gt_content` reverses it | Repository and [Hugging Face dataset](https://huggingface.co/datasets/critical88/SmellBench); dataset metadata says Apache-2.0 | Primary full-workspace paired direction test | Bad examples are synthetic; the original is assumed better; small project count; some smells are outside Trellis's measures |
| [Ruff rule fixtures](https://github.com/astral-sh/ruff/tree/main/crates/ruff_linter/resources/test/fixtures) | Python; thousands of rule-specific fixture cases | Maintainer-authored violations with expected diagnostics; documentation supplies corrected examples for fixable rules | Ruff repository, MIT | Small positive and near-miss cases for Python AST-rule tests | Lint validity is narrower than repository quality; do not use rules copied into the detector as held-out confirmation |
| [typescript-eslint rule tests](https://github.com/typescript-eslint/typescript-eslint/tree/main/packages/eslint-plugin/tests/rules) | TypeScript/TSX; rule tests with explicit `valid` and `invalid` cases | Maintainer-authored expectations for each lint rule | Repository, MIT | Small positive and negative cases for TypeScript AST-rule tests | Parser options and type information vary; lint labels are rule-local rather than whole-code quality labels |
| [CodeReviewer](https://arxiv.org/html/2203.09095) | C, C++, C#, Go, Java, JavaScript, PHP, Python, Ruby; hundreds of thousands of review examples | Review-commented hunks versus un-commented hunks; refinement triplets connect a comment to a later revision of the same region | JSONL archives on [Zenodo](https://zenodo.org/records/6900648), CC-BY-4.0; Microsoft CodeBERT code is MIT | Held-out AST-rule calibration and before/after review checks | Comment presence is an imperfect quality proxy; hunks lack full repository context; reviews cover correctness, API, docs, and style too |
| [RefactoringMiner Python oracle](https://github.com/tsantalis/RefactoringMiner/blob/master/documentation/accuracy.md) | Python; 202 commits from three open-source projects | Refactoring instances were manually validated and revalidated for the published oracle | Repository, MIT | Directional before/after checks for extract-method, extract-class and related structural changes | A refactoring label says what changed, not that every after-state is globally better; rename and move-only cases are neutral for Trellis |
| [Architectural SmellBench](https://arxiv.org/html/2605.07001) | Python; 65 hard candidates in scikit-learn 1.7.2 | Three senior developers independently labeled candidates: 41 false positive, 11 true positive, 13 partially valid | [Replication package](https://zenodo.org/records/19247588), CC-BY-4.0 | Independent false-positive and hotspot-ranking calibration | One repository; candidates were preselected by another detector; only moderate agreement on the hardest cases |
| [PySmell](https://github.com/chenzhifei731/Pysmell) | Python; 3,170 labeled examples across ten smells in the published study | Three master's and two doctoral researchers manually inspected candidates | CSVs in the repository; **no repository license was found** | Secondary localized smell test at exact project versions | Old project versions; path and line drift; several labels are defined by metric thresholds, which can contaminate validation |
| [SWE-bench](https://github.com/SWE-bench/SWE-bench/blob/main/docs/guides/datasets.md) and [SWE-bench Multilingual](https://www.swebench.com/multilingual.html) | Original: 2,294 Python issues in 12 repos; Multilingual: 300 tasks in 42 repos and nine languages, including 43 JavaScript/TypeScript tasks | Base commit fails specified tests; accepted gold patch passes fail-to-pass and pass-to-pass tests | Hugging Face records with commit, patch, tests, and repository identity; project and dataset are MIT | Real accepted-fix non-inferiority check for Python and JS/TS | Correctness is not structural quality; a necessary fix can add complexity; repeated repos and large workspaces can dilute local changes |
| [Project CodeNet](https://github.com/IBM/Project_CodeNet) | More than 14 million submissions in over 50 languages, including Python and JavaScript | Online-judge status such as Accepted, Wrong Answer, Compile Error, or Time Limit Exceeded | Source files plus per-problem metadata CSVs; Apache-2.0 project/dataset terms | Matched negative control for construct specificity | Contest correctness is not maintainability; accepted solutions can be terse and rejected solutions can be clean; author/problem leakage is severe unless grouped |
| [CTSSB-1M / TSSB-3M](https://github.com/cedricrupb/TSSB3M) | Python; nearly one million cleaned, isolated single-statement fixes | Bug-fix likelihood inferred from commit messages and filters, with before/after statements and commit identity | Compressed JSONL; [Zenodo record](https://zenodo.org/records/10217373) is CC-BY-4.0; code repository is MIT | Small-change sensitivity or negative-control analysis | Heuristic bug labels; statements rarely affect repository-level structure; source must be recovered under each upstream repository's license |

### 1. MINE-USTC SmellBench: best primary paired corpus

The [paper](https://arxiv.org/abs/2606.05574) defines seven smell categories:
feature envy, data clumps, dead-code elimination, deeply inlined method, god
classes, interface segregation, and shotgun surgery. Each instance identifies a
repository state, target function, tests, the injected smell diff, and the reverse
diff. The reviewed repository revision was
[`91dc08f`](https://github.com/MINE-USTC/SmellBench/commit/91dc08f6ddafcaa68ff36cf6ad764f8cc62da9f9).

This is a better fit than generic bug datasets because it provides a controlled
pair intended to differ in structure. It still does not make every pair relevant
to Trellis: interface segregation and feature envy, for example, may not change
complexity, clones, or cycles. Results should be reported by smell family rather
than forcing every family into one expected direction.

The repository does not expose a root license in the reviewed revision. The
Hugging Face dataset card/API marks the dataset Apache-2.0. Store provenance and
upstream source licenses with any reconstructed workspace, and distribute patches
or identifiers instead of copied repositories unless their own licenses permit it.

### 2. CodeReviewer: large real review signal

The [CodeReviewer paper](https://arxiv.org/html/2203.09095) mines review data from
public repositories and splits data by project. Its quality-estimation task treats
commented diff hunks as suspicious and un-commented hunks as correct, with
downsampling for balance. Its refinement task links an earlier code version,
review comment, and subsequent revision of the same region, while filtering
ambiguous multi-comment cases. The official
[CodeBERT instructions](https://github.com/microsoft/CodeBERT/blob/master/CodeReviewer/README.md)
document fields such as `old_file`, `diff_hunk`, `comment`, and `target`.

The [Zenodo archive](https://zenodo.org/records/6900648) provides separate quality
estimation, comment generation, and code refinement downloads. It is valuable for
evaluating whether a frozen AST rule becomes less prevalent after review. It is
not suitable for calculating a full Trellis repository index directly because the
examples are code hunks and may not parse or resolve independently.

### 3. Maintainer rule fixtures: precise local labels

Ruff and typescript-eslint keep rule-specific examples beside their analyzers.
The TypeScript tests explicitly divide examples into `valid` and `invalid`
collections. Ruff fixtures are checked against expected diagnostics and many rule
pages show a problem and corrected form. These cases are a strong way to test an
`ast-grep` rule's syntax boundaries, including near misses that must remain clean.

They cannot validate a copied rule against itself. Partition by rule family and
source: use one source to design a pattern and a different source or real change
pair to confirm it. Record parser options because TypeScript validity can depend
on JSX mode, language version, or type-aware analysis.

### 4. Architectural SmellBench: existing expert verdicts

This source satisfies the no-new-human-review requirement while still providing
human labels. The authors selected 65 difficult PyExamine candidates from
scikit-learn 1.7.2. Three senior developers labeled them independently. The paper
reports mean pairwise weighted Cohen's kappa of 0.67, binary agreement of 81.5%,
and Fleiss' kappa of 0.45. Its
[replication package](https://zenodo.org/records/19247588) includes the candidate
table, three annotator workbooks, reports, task state, and code.

Use this corpus to ask whether Trellis hotspots rank the confirmed and partially
valid cases above the rejected cases. Predeclare which Trellis finding kinds can
reasonably map to each architecture smell; otherwise a missing match can simply
mean the tools measure different concepts.

### 5. PySmell: useful labels with reuse limits

The PySmell repository contains CSV records with project, version, path, location,
metrics, and labels for ten Python smells. The related
[published study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10280480/) describes
manual inspection by three master's and two doctoral researchers and reports
3,170 labeled examples. Exact tagged sources can often be recovered from the
named upstream projects.

No license file was found at the reviewed PySmell revision
[`233afeb`](https://github.com/chenzhifei731/Pysmell/commit/233afebac24c910be89d065ffa661ec72458a62c).
Use identifiers and locally reconstructed upstream checkouts; do not copy the CSVs
into a distributed Trellis corpus without permission. A later
[metric-only Zenodo dataset](https://zenodo.org/records/7512516) is CC-BY-4.0 but
does not contain enough source identity or code to run Trellis, so it does not
solve this problem by itself.

### 6. Correctness datasets: validation controls, not quality truth

[SWE-bench](https://github.com/SWE-bench/SWE-bench/blob/main/docs/guides/datasets.md)
provides real repository commits, issue text, accepted patches, and tests. This is
enough to reconstruct both sides and run a full audit. The expected result should
be non-inferiority at the corpus level: accepted fixes should not cause a large,
systematic Trellis regression. Requiring every accepted patch to lower the score
would confuse functional correctness with maintainability.

[Project CodeNet](https://github.com/IBM/Project_CodeNet) is useful for the
opposite reason. It has large numbers of accepted and rejected submissions for
the same programming problem, with anonymized author, runtime, memory, language,
and code-size metadata. If Trellis predicts judge acceptance very well after
matching problem, language, and size, the score is probably learning a confound
instead of structural debt. Group all submissions from one problem and author in
the same split to prevent leakage.

## Recommended validation design without new human review

### 1. Freeze the measurement before reading held-out results

Version the Trellis binary, scoring version, parser versions, `ast-grep` binary,
rule files, clone detector, and every corpus snapshot. Write rules only against a
development split. Group splits by repository, never by file or hunk, and remove
exact and near-duplicate patches across splits.

### 2. Make SmellBench the primary directional experiment

For each of the 147 instances:

1. Check out the recorded project revision.
2. Build the original/reversed state and the injected-smell state.
3. Verify both states using the supplied tests and record failures separately.
4. Run the same deterministic Trellis audit on both workspaces.
5. Record `bad − good` for the total index, each raw metric, each score
   contribution, and whether the changed region appears among ranked hotspots.

Use leave-one-project-out development, or reserve whole projects as a locked test
set. Report the paired median change, fraction of pairs in the expected direction,
paired rank statistics, and a repository-level bootstrap confidence interval.
Also report each smell family separately. Pre-register a success rule before the
locked run; for example, a positive median delta with its repository-bootstrap
95% interval above zero and at least 70% directionally correct pairs in the
eligible smell families.

### 3. Evaluate AST rules on real review revisions

Use CodeReviewer refinement pairs in Python and JavaScript. Reconstruct only
parseable before/after units and keep repository groups intact. Hide review text
and target revisions while authoring rules. For every frozen rule, measure:

- match-line coverage before and after the review;
- the fraction of pairs where a match is removed, introduced, or unchanged;
- prevalence by language, repository, and rule;
- false triggers on un-commented or near-miss examples.

This tests external behavior of the rules. Do not train against, or claim
validation from, SlopCodeBench's own rule-generated verbosity labels.

### 4. Check independent expert labels and accepted fixes

- Run Trellis once on scikit-learn 1.7.2 and join its localized evidence to the
  65 Architectural SmellBench candidates. Measure ranking of true/partial cases
  against false positives and report unmapped smell types explicitly.
- Run base and gold snapshots from a repository-grouped sample of SWE-bench
  Python and the JavaScript/TypeScript portion of SWE-bench Multilingual. Use a
  predeclared non-inferiority margin for score regression rather than assuming
  every correct patch is structurally cleaner.

### 5. Add a specificity control

Match CodeNet Accepted and Wrong Answer submissions on problem, language, source
size, and, where possible, author. Trellis should be near chance at classifying
judge correctness after these controls. A proposed guardrail is accepted-versus-
wrong-answer AUC no greater than 0.60 while the paired structural corpus reaches a
materially higher discrimination target, such as paired AUC of at least 0.70.
These thresholds are design proposals and must be fixed before the final run.

### 6. Define a compatible verbosity evidence field

If a SlopCodeBench-style field is added, define it independently from the overall
Trellis index:

```text
verbosityEvidence =
  unique executable source lines covered by clone or frozen AST-rule evidence
  ---------------------------------------------------------------------------
                     executable source lines in scope
```

Store the component line sets as well as the union so overlap is auditable. Keep
generated code, tests, vendored code, comments, blanks, and parse failures governed
by an explicit versioned scope policy. A ratio is only comparable when the scope,
parser, detector, and rule-bundle identities match.

## Recommendation

1. Add `ast-grep` only through Trellis's optional provider seam and keep its
   findings unscored during calibration.
2. Implement a versioned verbosity-evidence ratio as a report field, separate from
   the 0–100 index.
3. Validate the existing erosion and duplication measures first on paired
   MINE-USTC SmellBench workspaces and relevant RefactoringMiner changes.
4. Validate candidate AST rules with independent Ruff/typescript-eslint fixtures,
   project-held-out CodeReviewer revisions and the existing Architectural
   SmellBench expert labels.
5. Use SWE-bench for real-fix non-inferiority and CodeNet as a correctness
   specificity control.
6. Do not copy `scb-check` rules until its license is clarified, and do not use
   its generated verbosity values as independent ground truth.

This design uses existing public labels, preserves Trellis's deterministic and
offline audit contract, and produces evidence about both sensitivity and false
positives without starting a new manual review program.
