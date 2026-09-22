#!/usr/bin/env node
/** Reproduce the research-only ast-grep direction check over SmellBench pairs. */
import { createHash } from "node:crypto";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const REVISION = "12604372b4a89a54b39645b6c82557b3b9e68eca";
const EXPECTED_AST_GREP_VERSION = "ast-grep 0.42.1";

function argument(name, required = true) {
	const index = process.argv.indexOf(name);
	const value = index < 0 ? undefined : process.argv[index + 1];
	if (required && value === undefined) throw new Error(`missing ${name}`);
	return value === undefined ? undefined : resolve(value);
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}

async function fetchRows() {
	const rows = [];
	for (const offset of [0, 100]) {
		const url = new URL("https://datasets-server.huggingface.co/rows");
		url.search = new URLSearchParams({
			dataset: "critical88/SmellBench",
			config: "default",
			split: "train",
			offset: String(offset),
			length: "100",
			revision: REVISION,
		});
		const response = await fetch(url);
		if (!response.ok) throw new Error(`SmellBench download failed: HTTP ${response.status}`);
		const payload = await response.json();
		rows.push(...payload.rows.map((entry) => entry.row));
	}
	return rows;
}

function diffVersions(diff) {
	const before = [];
	const after = [];
	let path = "unknown";
	let isHunk = false;
	for (const line of diff.split("\n")) {
		if (line.startsWith("diff --git ")) {
			isHunk = false;
			continue;
		}
		if (line.startsWith("+++ b/")) {
			path = line.slice(6);
			continue;
		}
		if (line.startsWith("@@")) {
			isHunk = true;
			before.push(`# file: ${path}`);
			after.push(`# file: ${path}`);
			continue;
		}
		if (!isHunk || line.startsWith("\\ No newline")) continue;
		const content = line.slice(1);
		if (line[0] === " " || line[0] === "-") before.push(content);
		if (line[0] === " " || line[0] === "+") after.push(content);
	}
	return { good: before.join("\n"), bad: after.join("\n") };
}

function run(executable, args, options = {}) {
	const result = spawnSync(executable, args, {
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
		timeout: 60_000,
		...options,
	});
	if (result.error !== undefined) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${basename(executable)} exited ${result.status}: ${result.stderr.slice(0, 500)}`);
	}
	return result.stdout;
}

function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function pearson(left, right) {
	const leftMean = mean(left);
	const rightMean = mean(right);
	const numerator = left.reduce(
		(sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean),
		0,
	);
	const denominator = Math.sqrt(
		left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) *
			right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0),
	);
	return denominator === 0 ? null : numerator / denominator;
}

function rankData(values) {
	const order = values.map((_, index) => index).sort((left, right) => values[left] - values[right]);
	const ranks = Array(values.length).fill(0);
	for (let start = 0; start < order.length; ) {
		let end = start + 1;
		while (end < order.length && values[order[end]] === values[order[start]]) end += 1;
		const rank = (start + 1 + end) / 2;
		for (let index = start; index < end; index += 1) ranks[order[index]] = rank;
		start = end;
	}
	return ranks;
}

function exactPairedP(badOnly, goodOnly) {
	const trials = badOnly + goodOnly;
	if (trials === 0) return 1;
	const tail = Math.min(badOnly, goodOnly);
	let combination = 1;
	let sum = 1;
	for (let index = 1; index <= tail; index += 1) {
		combination *= (trials - index + 1) / index;
		sum += combination;
	}
	return Math.min(1, (2 * sum) / 2 ** trials);
}

function codeLines(source) {
	return new Set(
		source
			.split("\n")
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => line.trim() !== "" && !line.trimStart().startsWith("#"))
			.map(({ index }) => index),
	);
}

function matchedCodeLines(source, hits) {
	const available = codeLines(source);
	const matched = new Set();
	for (const hit of hits) {
		const last = hit.endColumn === 0 ? hit.endLine - 1 : hit.endLine;
		for (let line = hit.startLine; line <= last; line += 1) {
			if (available.has(line)) matched.add(line);
		}
	}
	return { matched: matched.size, available: available.size };
}

function parseHits(output) {
	const hits = new Map();
	for (const line of output.split("\n").filter(Boolean)) {
		const value = JSON.parse(line);
		const file = basename(value.file);
		const byRule = hits.get(file) ?? new Map();
		const matches = byRule.get(value.ruleId) ?? [];
		matches.push({
			startLine: value.range.start.line,
			endLine: value.range.end.line,
			endColumn: value.range.end.column,
		});
		byRule.set(value.ruleId, matches);
		hits.set(file, byRule);
	}
	return hits;
}

function summarizeSide(records, side, hits) {
	const coverage = [];
	let filesWithMatches = 0;
	let matches = 0;
	for (const record of records) {
		const fileHits = hits.get(record.file) ?? new Map();
		const flat = [...fileHits.values()].flat();
		const lines = matchedCodeLines(record[side], flat);
		coverage.push(lines.available === 0 ? 0 : lines.matched / lines.available);
		filesWithMatches += flat.length > 0 ? 1 : 0;
		matches += flat.length;
	}
	return { filesWithMatches, matches, meanCoverage: mean(coverage), medianCoverage: median(coverage) };
}

async function main() {
	if (!process.argv.includes("--live")) throw new Error("refusing network access without --live");
	const astGrep = argument("--ast-grep");
	const rulesDir = argument("--rules-dir");
	const outputPath = argument("--out");
	const labelsPath = argument("--jev-labels", false);
	if (!isAbsolute(astGrep) || !isAbsolute(rulesDir)) throw new Error("tool and rule paths must be absolute");
	const version = run(astGrep, ["--version"]).trim();
	if (version !== EXPECTED_AST_GREP_VERSION) throw new Error(`unexpected ast-grep version: ${version}`);
	const ruleFiles = readdirSync(rulesDir)
		.filter((name) => name.endsWith(".yaml"))
		.sort();
	const ruleTexts = ruleFiles.map((name) => [name, readFileSync(join(rulesDir, name), "utf8")]);
	const ruleIds = ruleTexts.flatMap(([, text]) =>
		[...text.matchAll(/^id: (.+)$/gm)].map((match) => match[1].trim()),
	);
	const rows = await fetchRows();
	const records = rows.map((row, index) => ({
		file: `${String(index).padStart(3, "0")}.py`,
		instanceId: row.instance_id,
		smellType: row.type,
		project: row.project_name,
		...diffVersions(row.smell_content),
	}));
	const work = mkdtempSync(join(tmpdir(), "trellis-ast-grep-smellbench-"));
	try {
		const sides = {};
		for (const side of ["good", "bad"]) {
			const directory = join(work, side);
			mkdirSync(directory);
			for (const record of records) writeFileSync(join(directory, record.file), record[side]);
			const output = ruleFiles
				.map((name) =>
					run(astGrep, ["scan", "--json=stream", "-r", join(rulesDir, name), directory]),
				)
				.join("");
			sides[side] = parseHits(output);
		}
		const rules = ruleIds.map((rule) => {
			let good = 0;
			let bad = 0;
			let badOnly = 0;
			let goodOnly = 0;
			const deltas = [];
			const projects = new Map();
			for (const record of records) {
				const goodHits = sides.good.get(record.file)?.get(rule) ?? [];
				const badHits = sides.bad.get(record.file)?.get(rule) ?? [];
				const goodLines = matchedCodeLines(record.good, goodHits);
				const badLines = matchedCodeLines(record.bad, badHits);
				const goodCoverage = goodLines.available === 0 ? 0 : goodLines.matched / goodLines.available;
				const badCoverage = badLines.available === 0 ? 0 : badLines.matched / badLines.available;
				const delta = badCoverage - goodCoverage;
				good += goodHits.length > 0 ? 1 : 0;
				bad += badHits.length > 0 ? 1 : 0;
				badOnly += badHits.length > 0 && goodHits.length === 0 ? 1 : 0;
				goodOnly += goodHits.length > 0 && badHits.length === 0 ? 1 : 0;
				deltas.push(delta);
				projects.set(record.project, [...(projects.get(record.project) ?? []), delta]);
			}
			return {
				rule,
				goodFiles: good,
				badFiles: bad,
				badOnly,
				goodOnly,
				meanCoverageDelta: mean(deltas),
				projectsWithPositiveMeanDelta: [...projects.values()].filter((values) => mean(values) > 0).length,
				pairedP: exactPairedP(badOnly, goodOnly),
			};
		});
		const ordered = [...rules].sort((left, right) => left.pairedP - right.pairedP);
		let nextQ = 1;
		for (let index = ordered.length - 1; index >= 0; index -= 1) {
			nextQ = Math.min(nextQ, (ordered[index].pairedP * ordered.length) / (index + 1));
			ordered[index].benjaminiHochbergQ = nextQ;
		}
		const summary = {
			version: 1,
			corpus: {
				dataset: "critical88/SmellBench train",
				revision: REVISION,
				pairs: records.length,
				projects: new Set(records.map((record) => record.project)).size,
				smellTypes: new Set(records.map((record) => record.smellType)).size,
			},
			tool: {
				version,
				ruleSourceRevision: "a8618228939def726c2ec48b354693e5aa1999d5",
				ruleBundleSha256: sha256(
					ruleTexts.map(([name, text]) => `${name}\0${text}\0`).join(""),
				),
				rulesTested: ruleIds.length,
			},
			aggregate: {
				good: summarizeSide(records, "good", sides.good),
				bad: summarizeSide(records, "bad", sides.bad),
				pairedDirection: records.reduce(
					(counts, record) => {
						const coverage = (side) => {
							const lines = matchedCodeLines(
								record[side],
								[...(sides[side].get(record.file) ?? new Map()).values()].flat(),
							);
							return lines.available === 0 ? 0 : lines.matched / lines.available;
						};
						const delta = coverage("bad") - coverage("good");
						counts[delta > 0 ? "badHigher" : delta < 0 ? "goodHigher" : "tie"] += 1;
						return counts;
					},
					{ badHigher: 0, goodHigher: 0, tie: 0 },
				),
			},
			multipleTesting: "two-sided exact paired presence test; Benjamini-Hochberg over all rules",
			discoveryShortlist: ordered
				.filter(
					(rule) =>
						rule.badOnly >= 5 &&
						rule.goodOnly <= 1 &&
						rule.projectsWithPositiveMeanDelta >= 4 &&
						rule.meanCoverageDelta > 0,
				)
				.map((rule) => rule.rule),
			rules: ordered,
		};
		if (labelsPath !== undefined) {
			const labels = new Map(JSON.parse(readFileSync(labelsPath, "utf8")).labels.map((item) => [item.id, item]));
			const densityDelta = [];
			const maintenanceDelta = [];
			for (const record of records) {
				const opaque = sha256(`smellbench\0${record.instanceId}`);
				const good = labels.get(opaque.slice(0, 16));
				const bad = labels.get(opaque.slice(16, 32));
				const coverage = (side) => {
					const lines = matchedCodeLines(
						record[side],
						[...(sides[side].get(record.file) ?? new Map()).values()].flat(),
					);
					return lines.available === 0 ? 0 : lines.matched / lines.available;
				};
				densityDelta.push(coverage("bad") - coverage("good"));
				maintenanceDelta.push(bad.maintenanceCost - good.maintenanceCost);
			}
			summary.jevAssociation = {
				pearsonDensityDeltaToMaintenanceDelta: pearson(densityDelta, maintenanceDelta),
				spearmanDensityDeltaToMaintenanceDelta: pearson(
					rankData(densityDelta),
					rankData(maintenanceDelta),
				),
			};
		}
		writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
		process.stdout.write(`${JSON.stringify(summary.aggregate, null, 2)}\n`);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
