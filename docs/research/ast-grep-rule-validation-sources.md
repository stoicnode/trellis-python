# Public labels for the next Python AST-rule validation

**Research date:** 2026-09-22
**Status:** source selection and extraction contract; no audit or scoring change

## Decision

The four-rule queue can be evaluated without a new human review. Ruff supplies
committed fixtures, test configuration, exact diagnostic snapshots, and (for the
two comprehension rules) before/after fix snapshots. Two merged lint-enablement
pull requests add four real-project before/after examples for the dictionary
rule.

Use Ruff revision
[`caf021af3e5cb9c1480bc42e0981d65908be5f23`](https://github.com/astral-sh/ruff/commit/caf021af3e5cb9c1480bc42e0981d65908be5f23)
for every fixture result below. It was the `main` revision observed on the
research date. Ruff's root
[`LICENSE`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/LICENSE)
is MIT; redistributed fixture excerpts must retain that notice.

The target `ast-grep` rules remain the `scb-check` definitions at
[`a8618228939def726c2ec48b354693e5aa1999d5`](https://github.com/gabeorlanski/scb-check/commit/a8618228939def726c2ec48b354693e5aa1999d5):
[`redundant-return-none`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/src/scb_check/resources/slop_rules/misc.yaml#L45-L75),
[`except-pass-silence`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/src/scb_check/resources/slop_rules/misc.yaml#L132-L144),
[`verbose-list-append-loop`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/src/scb_check/resources/slop_rules/loops_and_comprehensions.yaml#L281-L304),
and
[`verbose-dict-update`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/src/scb_check/resources/slop_rules/dict_patterns.yaml#L206-L227).
Do not copy those rule files into a redistributed corpus: that repository's
root
[`LICENSE`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/LICENSE)
says Apache-2.0 while
[`pyproject.toml`](https://github.com/gabeorlanski/scb-check/blob/a8618228939def726c2ec48b354693e5aa1999d5/pyproject.toml)
declares MIT. A pinned temporary checkout avoids relying on either declaration
for redistribution.

## Exact Ruff sources

Ruff's test modules bind one rule to one fixture and compare the emitted
diagnostics with a committed snapshot. The
[`flake8_return` registration](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/flake8_return/mod.rs#L21-L35),
[`flake8_bandit` registration](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/flake8_bandit/mod.rs#L83-L96),
and
[`perflint` registration](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/perflint/mod.rs#L20-L45)
make the fixture/snapshot pairing executable rather than an inference from
comments.

| Trellis research rule | Ruff fixture | Authoritative expected output | Labels at the pin |
| --- | --- | --- | --- |
| `redundant-return-none` | [`flake8_return/RET501.py`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/resources/test/fixtures/flake8_return/RET501.py) | [`unnecessary-return-none_RET501.py.snap`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/flake8_return/snapshots/ruff_linter__rules__flake8_return__tests__unnecessary-return-none_RET501.py.snap) | 3 diagnostics: `4:5`, `14:9`, `59:9`; each carries a fix |
| `except-pass-silence` | [`flake8_bandit/S110.py`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/resources/test/fixtures/flake8_bandit/S110.py) | [`S110_typed.snap`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/flake8_bandit/snapshots/ruff_linter__rules__flake8_bandit__tests__S110_typed.snap) | 3 diagnostics: `3:1`, `8:1`, `13:1`; no fixes |
| `verbose-list-append-loop` | [`perflint/PERF401.py`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/resources/test/fixtures/perflint/PERF401.py) | [`manual-list-comprehension_PERF401.py.snap`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__manual-list-comprehension_PERF401.py.snap) and [`preview` fix snapshot](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__preview__manual-list-comprehension_PERF401.py.snap) | 29 diagnostics and 29 preview fix hunks; 42 complete top-level function/class units contain 28 positive and 14 clean units |
| `verbose-dict-update` | [`perflint/PERF403.py`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/resources/test/fixtures/perflint/PERF403.py) | [`manual-dict-comprehension_PERF403.py.snap`](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__manual-dict-comprehension_PERF403.py.snap) and [`preview` fix snapshot](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__preview__manual-dict-comprehension_PERF403.py.snap) | 22 diagnostics and 22 preview fix hunks; 28 complete functions contain 21 positive and 7 clean units |

The exact PERF401 diagnostic starts are `6:13`, `13:9`, `82:13`, `89:9`,
`96:9`, `102:9`, `111:17`, `119:13`, `135:13`, `142:9`, `149:9`,
`156:9`, `162:9`, `169:9`, `189:9`, `198:9`, `210:13`, `222:9`,
`229:9`, `239:9`, `245:13`, `262:13`, `268:9`, `276:13`, `280:13`,
`286:9`, `292:9`, `318:13`, and `328:13`.

The exact PERF403 diagnostic starts are `5:9`, `13:13`, `33:13`, `63:13`,
`78:9`, `85:9`, `94:9`, `106:9`, `115:9`, `122:9`, `129:9`, `137:9`,
`145:13`, `153:9`, `162:13`, `166:13`, `172:9`, `200:9`, `207:9`,
`214:9`, `225:13`, and `233:9`.

### How the labels are encoded

The `.snap` files are the ground truth. Each diagnostic begins with its rule id
and contains an `--> FILE:LINE:COLUMN` location. A diagnostic range is a positive
label. In the preview snapshots, the `help:` block's removed and added lines are
the maintainer-authored before/after transformation; Ruff marks these PERF fixes
unsafe, so fix safety must remain part of the record.

Fixture comments are not labels. For example, PERF401 has a `# PERF401` comment
at a location omitted by its expected snapshot, and PERF403 line 71 is similarly
commented but deliberately omitted. Parsing comments would turn known clean or
unsupported cases into false positives.

Keep the following mode differences in the data:

- RET501's three fixes are not equivalent in safety. The line 59 fix is marked
  unsafe because it discards a comment. The snapshot carries that fact.
- S110's default snapshot has only `3:1` and `8:1`. The typed `ValueError`
  handler at `13:1` becomes positive only when `check_typed_exception: true`.
  Ruff's dedicated
  [`check_typed_exception` test](https://github.com/astral-sh/ruff/blob/caf021af3e5cb9c1480bc42e0981d65908be5f23/crates/ruff_linter/src/rules/flake8_bandit/mod.rs#L141-L154)
  produces `S110_typed.snap`. That typed mode matches the broader
  `except-pass-silence` concept, so it is the preregistered primary label set.
  It has no negative near-miss; it can measure recall but cannot establish
  precision by itself.
- PERF401 and PERF403 run with Python 3.10 in both stable and preview modes.
  Stable snapshots provide the same diagnostic locations; preview adds the fix
  diff. PERF401 includes async loops and cases for which Ruff recommends
  `list.extend`; report those strata separately because the target rule names a
  synchronous comprehension pattern.

## Independent dictionary before/after changes

The Ruff PERF403 fixture is sufficient for rule-local labels. The following
merged project changes add independent directional evidence. Their commit and
pull-request text explicitly name PERF403, so selecting their hunks does not
require a Trellis maintainer to judge code quality.

| Project and license | Accepted review and exact pair | Labeled hunks |
| --- | --- | --- |
| NumPy, modified BSD in [`LICENSE.txt`](https://github.com/numpy/numpy/blob/e8d5153caceed246c378de72e5ebde15b1fc0996/LICENSE.txt) | Merged [`numpy/numpy#28970`](https://github.com/numpy/numpy/pull/28970); before `96cf781e226900ba88592f3a20145d6af63e863a`, after [`e8d5153caceed246c378de72e5ebde15b1fc0996`](https://github.com/numpy/numpy/commit/e8d5153caceed246c378de72e5ebde15b1fc0996) | `numpy/_core/code_generators/genapi.py`: inner `for k, v ...: ret[k] = v` to `ret.update(...)`; `numpy/lib/introspect.py`: filtered assignment loop to a dict comprehension |
| Cirq, Apache-2.0 in [`LICENSE`](https://github.com/quantumlib/Cirq/blob/11b5233093a1a3bb683b4262f4cd07e7a553a63b/LICENSE) | Merged [`quantumlib/Cirq#7895`](https://github.com/quantumlib/Cirq/pull/7895); before `ecffd22e9b6da79493fb7ae2a6136ef11053e92b`, after [`11b5233093a1a3bb683b4262f4cd07e7a553a63b`](https://github.com/quantumlib/Cirq/commit/11b5233093a1a3bb683b4262f4cd07e7a553a63b) | `cirq-core/cirq/ops/pauli_string_test.py`: filtered assignment loop to a dict comprehension; `cirq-core/cirq/transformers/dynamical_decoupling.py`: assignment loop to `dict.update(...)` |

These four pairs are positive direction cases: the parent hunk is the labeled
verbose form and the child hunk is the accepted replacement. They are not clean
negative controls for arbitrary surrounding code. Use the exact named hunks,
not every change in either commit.

## Reproducible extraction

### 1. Pin and verify Ruff

```sh
git clone --filter=blob:none --sparse https://github.com/astral-sh/ruff.git /tmp/ruff-labels
git -C /tmp/ruff-labels checkout --detach caf021af3e5cb9c1480bc42e0981d65908be5f23
git -C /tmp/ruff-labels sparse-checkout set \
  crates/ruff_linter/resources/test/fixtures \
  crates/ruff_linter/src/rules
test "$(git -C /tmp/ruff-labels rev-parse HEAD)" = \
  caf021af3e5cb9c1480bc42e0981d65908be5f23
```

The reviewed files have these SHA-256 digests:

| File | SHA-256 |
| --- | --- |
| `flake8_return/RET501.py` | `437474eb2979891a4d583c8d57c78a0f04cb9f16b8fbfccdd3346e4a27d95ae2` |
| `flake8_bandit/S110.py` | `7ae701e3f1ab8a54370bc6f1a2e575c04af86d21076e5d7afa615f8bbd7404a1` |
| `perflint/PERF401.py` | `e3911aa78232f2eaa4757fe68286b0197226a764c618cf1a6a8f3d4645528d1d` |
| `perflint/PERF403.py` | `bff4e8097b697406161769ba02cb8d4d2323344892ed9dd931bfec5e71b97a72` |
| RET501 snapshot | `6908dca3fa4c97a3badb6fd824ebee27eb69ab710b31d4cb6bfe7695e7d65942` |
| S110 typed snapshot | `149aa52c538dcd7cd133b70232bb33a34e6cadee8adfc53ac6f93db32f7d3569` |
| PERF401 stable / preview snapshots | `924da0b97f45ebd7b1cc17a06735f0eef00be4186ad08897ad21d25715289a77` / `03cdb116c0f0d33e1875e9a30f31bfb005a6bf02ee5df28fe018e06da6663ae5` |
| PERF403 stable / preview snapshots | `98da63f0fe7bf683e76c844a49ae11b4eae4f4902e2ab2149178a47fb8717418` / `81b65208dd7f353a95858e7d9138ece45f299ed7be607ba468afe6a669c35e7d` |

### 2. Build records mechanically

1. Parse only snapshot blocks whose first token is the requested rule id. Read
   the source line and column from the following `-->` record; retain the rendered
   diagnostic range, message, help diff, and unsafe-fix note.
2. Parse the fixture with Python's `ast`. Send the complete enclosing function or
   class for function-scoped examples and the complete top-level `try` for S110.
   Use `(fixture path, start line, end line, ordinal)` as identity because fixtures
   intentionally reuse names such as `f` and `foo`.
3. Preserve the exact diagnostic range inside that complete unit. Do not collapse
   a class or function to one binary label: a class can contain both labeled and
   intentionally unlabeled constructs.
4. Compare a candidate match with a label by source-range overlap. A snapshot
   diagnostic with no candidate overlap is a false negative. A candidate match
   with no snapshot-diagnostic overlap is a false positive. This retains all
   fixture code as context without inventing labels for unrelated statements.
5. Store `ruffRevision`, fixture and snapshot digests, rule id, S110 typed/default
   mode, PERF stable/preview mode, and Python 3.10 target with every output.

For the real-review pairs, fetch the exact parent and child commits, then extract
only the four file hunks named above with `git diff --unified=0 <parent> <child>
-- <path>`. The removed hunk is `before`; the added hunk is `after`; the merged PR
and PERF403 commit message are the pre-existing label. Record the project license
with each pair.

## What this validation can establish

This queue can measure agreement with maintainer-authored lint expectations,
including deliberate near-misses and accepted transformations. It can reject an
overbroad syntax rule. It does not establish that every match is a repository-level
maintenance defect, and it does not justify a score contribution. Report each
rule separately, preserve the mode-specific strata, and keep the four external
dictionary pairs as direction checks rather than adding them to the Ruff fixture
confusion matrix.
