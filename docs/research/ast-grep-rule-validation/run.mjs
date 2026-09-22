#!/usr/bin/env node
/** Validate four discovered Python ast-grep rules against public maintainer labels. */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const AST_GREP_VERSION = "ast-grep 0.42.1";
const RUFF_REVISION = "caf021af3e5cb9c1480bc42e0981d65908be5f23";
const SCB_REVISION = "a8618228939def726c2ec48b354693e5aa1999d5";

const FIXTURES = [
	{
		rule: "redundant-return-none",
		fixture: "resources/test/fixtures/flake8_return/RET501.py",
		snapshot:
			"src/rules/flake8_return/snapshots/ruff_linter__rules__flake8_return__tests__unnecessary-return-none_RET501.py.snap",
		ruleFile: "misc.yaml",
	},
	{
		rule: "except-pass-silence",
		fixture: "resources/test/fixtures/flake8_bandit/S110.py",
		snapshot:
			"src/rules/flake8_bandit/snapshots/ruff_linter__rules__flake8_bandit__tests__S110_typed.snap",
		ruleFile: "misc.yaml",
	},
	{
		rule: "verbose-list-append-loop",
		fixture: "resources/test/fixtures/perflint/PERF401.py",
		snapshot:
			"src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__manual-list-comprehension_PERF401.py.snap",
		ruleFile: "loops_and_comprehensions.yaml",
	},
	{
		rule: "verbose-dict-update",
		fixture: "resources/test/fixtures/perflint/PERF403.py",
		snapshot:
			"src/rules/perflint/snapshots/ruff_linter__rules__perflint__tests__manual-dict-comprehension_PERF403.py.snap",
		ruleFile: "dict_patterns.yaml",
	},
];

const REVIEW_PAIRS = [
	{
		project: "numpy",
		before: "96cf781e226900ba88592f3a20145d6af63e863a",
		after: "e8d5153caceed246c378de72e5ebde15b1fc0996",
		paths: ["numpy/_core/code_generators/genapi.py", "numpy/lib/introspect.py"],
	},
	{
		project: "cirq",
		before: "ecffd22e9b6da79493fb7ae2a6136ef11053e92b",
		after: "11b5233093a1a3bb683b4262f4cd07e7a553a63b",
		paths: [
			"cirq-core/cirq/ops/pauli_string_test.py",
			"cirq-core/cirq/transformers/dynamical_decoupling.py",
		],
	},
];

function argument(name) {
	const index = process.argv.indexOf(name);
	const value = index < 0 ? undefined : process.argv[index + 1];
	if (value === undefined) throw new Error(`missing ${name}`);
	return resolve(value);
}

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
		timeout: 60_000,
		...options,
	});
	if (result.error !== undefined) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${basename(command)} exited ${result.status}: ${result.stderr.slice(0, 500)}`);
	}
	return result.stdout;
}

function git(root, args) {
	return run("git", ["-C", root, ...args]).trim();
}

function verifyCheckout(root, revision, name) {
	if (git(root, ["rev-parse", "HEAD"]) !== revision)
		throw new Error(`${name}: checkout does not match the pinned revision`);
	if (git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "")
		throw new Error(`${name}: checkout is dirty`);
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

function scan(astGrep, ruleFile, fixture, ruleId) {
	return run(astGrep, ["scan", "--json=stream", "-r", ruleFile, fixture])
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line))
		.filter((hit) => hit.ruleId === ruleId)
		.map((hit) => ({
			startLine: hit.range.start.line + 1,
			endLine: hit.range.end.line + 1,
		}));
}

function diagnosticLines(snapshot) {
	return [...snapshot.matchAll(/--> [^:]+:(\d+):\d+/g)].map((match) => Number(match[1]));
}

function covers(hit, line) {
	return hit.startLine <= line && line <= hit.endLine;
}

function fixtureResult(astGrep, rulesRoot, ruffRoot, test) {
	const fixturePath = join(ruffRoot, test.fixture);
	const snapshotPath = join(ruffRoot, test.snapshot);
	const labels = diagnosticLines(readFileSync(snapshotPath, "utf8"));
	const matches = scan(astGrep, join(rulesRoot, test.ruleFile), fixturePath, test.rule);
	const falseNegativeLines = labels.filter((line) => !matches.some((match) => covers(match, line)));
	const falsePositiveRanges = matches.filter(
		(match) => !labels.some((line) => covers(match, line)),
	);
	const truePositives = labels.length - falseNegativeLines.length;
	return {
		rule: test.rule,
		fixtureSha256: sha256(readFileSync(fixturePath)),
		snapshotSha256: sha256(readFileSync(snapshotPath)),
		labels: labels.length,
		matches: matches.length,
		truePositives,
		falsePositives: falsePositiveRanges.length,
		falseNegatives: falseNegativeLines.length,
		precision: matches.length === 0 ? null : truePositives / matches.length,
		recall: labels.length === 0 ? null : truePositives / labels.length,
		falseNegativeLines,
		falsePositiveRanges,
	};
}

function changedRanges(diff) {
	return [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)].map(
		(match) => ({
			before: { startLine: Number(match[1]), count: Number(match[2] ?? 1) },
			after: { startLine: Number(match[3]), count: Number(match[4] ?? 1) },
		}),
	);
}

function overlapsChanged(hit, changed) {
	if (changed.count === 0) return false;
	return hit.startLine <= changed.startLine + changed.count - 1 && changed.startLine <= hit.endLine;
}

function reviewResults(astGrep, rulesRoot, roots) {
	const ruleFile = join(rulesRoot, "dict_patterns.yaml");
	const work = mkdtempSync(join(tmpdir(), "trellis-ast-grep-review-pairs-"));
	try {
		return REVIEW_PAIRS.flatMap((pair) => {
			const root = roots[pair.project];
			verifyCheckout(root, pair.after, pair.project);
			return pair.paths.map((path, index) => {
				const beforeSource = run("git", ["-C", root, "show", `${pair.before}:${path}`]);
				const afterSource = run("git", ["-C", root, "show", `${pair.after}:${path}`]);
				const diff = run("git", [
					"-C",
					root,
					"diff",
					"--unified=0",
					pair.before,
					pair.after,
					"--",
					path,
				]);
				const ranges = changedRanges(diff);
				const beforePath = join(work, `${pair.project}-${index}-before.py`);
				const afterPath = join(work, `${pair.project}-${index}-after.py`);
				writeFileSync(beforePath, beforeSource);
				writeFileSync(afterPath, afterSource);
				const beforeHits = scan(astGrep, ruleFile, beforePath, "verbose-dict-update");
				const afterHits = scan(astGrep, ruleFile, afterPath, "verbose-dict-update");
				return {
					project: pair.project,
					path,
					beforeCommit: pair.before,
					afterCommit: pair.after,
					beforeSha256: sha256(beforeSource),
					afterSha256: sha256(afterSource),
					changedHunks: ranges.length,
					beforeTargetMatches: beforeHits.filter((hit) =>
						ranges.some((range) => overlapsChanged(hit, range.before)),
					).length,
					afterTargetMatches: afterHits.filter((hit) =>
						ranges.some((range) => overlapsChanged(hit, range.after)),
					).length,
				};
			});
		});
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

function main() {
	const astGrep = argument("--ast-grep");
	const rulesRoot = argument("--rules-dir");
	const scbRoot = argument("--scb-root");
	const ruffCheckout = argument("--ruff-root");
	const ruffRoot = join(ruffCheckout, "crates/ruff_linter");
	const output = argument("--out");
	const roots = { numpy: argument("--numpy-root"), cirq: argument("--cirq-root") };
	const version = run(astGrep, ["--version"]).trim();
	if (version !== AST_GREP_VERSION) throw new Error(`unexpected ast-grep version: ${version}`);
	verifyCheckout(ruffCheckout, RUFF_REVISION, "Ruff");
	verifyCheckout(scbRoot, SCB_REVISION, "scb-check");
	const expectedRulesRoot = join(scbRoot, "src/scb_check/resources/slop_rules");
	if (rulesRoot !== expectedRulesRoot)
		throw new Error("--rules-dir must name the pinned scb-check rule directory");
	const fixtures = FIXTURES.map((test) => fixtureResult(astGrep, rulesRoot, ruffRoot, test));
	const reviews = reviewResults(astGrep, rulesRoot, roots);
	const summary = {
		version: 1,
		tool: { astGrep: version, scbCheckRevision: SCB_REVISION },
		labels: { ruffRevision: RUFF_REVISION },
		fixtures,
		reviewDirection: {
			pairs: reviews,
			beforeMatched: reviews.filter((pair) => pair.beforeTargetMatches > 0).length,
			afterClean: reviews.filter((pair) => pair.afterTargetMatches === 0).length,
		},
	};
	writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
