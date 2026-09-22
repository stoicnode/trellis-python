#!/usr/bin/env bun
/** Research-only Jev validation over SmellBench pairs and the blinded index packet. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	buildSmellPairs,
	fetchSmellBenchRows,
	SMELLBENCH_REVISION,
	type SmellPair,
	type StudyRecord,
	truncateStudySource,
} from "../src/research/smellbench-pairs.ts";

const ENDPOINT = "https://openrouter.ai/api/alpha/decisions";
const MODEL = "typesafe/jev-1.13";
const RUBRIC_VERSION = "trellis-maintenance-jev-v1";
const BATCH_SOURCE_CHARS = 48_000;

const QUESTIONS = {
	maintenanceCost: {
		type: "score",
		instructions:
			"Rate the structural maintenance cost visible in this source. Judge complexity, repetition, indirection, and difficulty of safe modification. Do not penalize necessary domain logic, naming style, comments, or formatting.",
		criteria: [
			"No visible structural maintenance problem; leave it as written",
			"Minor friction that may merit a small cleanup",
			"Material structural cost; monitor or refactor when changing this area",
			"Severe structural cost; refactoring is strongly justified",
		],
	},
	refactorValue: {
		type: "noul",
		instructions:
			"Would a behavior-preserving structural refactor of this source probably reduce future maintenance cost? Ignore formatting-only changes.",
		criteria: {
			true: "A concrete structural simplification is likely to make future changes safer or easier",
			false:
				"The visible structure is already appropriate, or a refactor would mostly move complexity around",
		},
	},
	evidenceSufficient: {
		type: "noul",
		instructions:
			"Does this source contain enough context to judge its local structural maintenance cost reliably?",
		criteria: {
			true: "The relevant local structure and behavior are visible",
			false: "The judgment depends heavily on omitted callers, types, files, or runtime behavior",
		},
	},
} as const;

interface Label {
	id: string;
	maintenanceCost: number;
	maintenanceProbabilities: Record<string, number>;
	maintenanceConfidence: number;
	refactorValue: number;
	evidenceSufficient: number;
}

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function requireObject(value: unknown, description: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new Error(`${description} must be an object`);
	return value as Record<string, unknown>;
}

function requireString(value: unknown, description: string): string {
	if (typeof value !== "string") throw new Error(`${description} must be a string`);
	return value;
}

function requireNumber(value: unknown, description: string): number {
	if (typeof value !== "number" || !Number.isFinite(value))
		throw new Error(`${description} must be a finite number`);
	return value;
}

function argument(args: string[], name: string): string {
	const index = args.indexOf(name);
	const value = index < 0 ? undefined : args[index + 1];
	if (value === undefined) throw new Error(`missing ${name}`);
	return resolve(value);
}

function packetRecords(value: unknown): StudyRecord[] {
	if (!Array.isArray(value)) throw new Error("reviewer packet must be an array");
	return value.map((entry, index) => {
		const unit = requireObject(entry, `packet[${index}]`);
		const language = requireString(unit.language, `packet[${index}].language`);
		if (language !== "python" && language !== "typescript")
			throw new Error(`packet[${index}].language is unsupported`);
		const source = truncateStudySource(requireString(unit.excerpt, `packet[${index}].excerpt`));
		return {
			id: requireString(unit.blindId, `packet[${index}].blindId`),
			language,
			context: {
				repository: requireString(unit.repository, `packet[${index}].repository`),
				role: requireString(unit.role, `packet[${index}].role`),
				path: requireString(unit.path, `packet[${index}].path`),
				unitKind: requireString(unit.kind, `packet[${index}].kind`),
				truncated: source.truncated || unit.excerptTruncated === true,
			},
			source: source.source,
		};
	});
}

function batches(records: readonly StudyRecord[]): StudyRecord[][] {
	const result: StudyRecord[][] = [];
	let batch: StudyRecord[] = [];
	let chars = 0;
	for (const record of records) {
		if (batch.length > 0 && chars + record.source.length > BATCH_SOURCE_CHARS) {
			result.push(batch);
			batch = [];
			chars = 0;
		}
		batch.push(record);
		chars += record.source.length;
	}
	if (batch.length > 0) result.push(batch);
	return result;
}

function questionMap(records: readonly StudyRecord[]): Record<string, unknown> {
	return Object.fromEntries(
		records.flatMap((record) =>
			Object.entries(QUESTIONS).map(([name, question]) => [
				`${record.id}__${name}`,
				{
					...question,
					instructions: `For the record with id ${JSON.stringify(record.id)}: ${question.instructions}`,
				},
			]),
		),
	);
}

async function requestBatch(
	records: readonly StudyRecord[],
	apiKey: string,
): Promise<Record<string, unknown>> {
	const body = {
		model: MODEL,
		state: { description: "Source records for local structural-maintenance evaluation", records },
		questions: questionMap(records),
	};
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const response = await fetch(ENDPOINT, {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (response.ok) return requireObject(await response.json(), "Jev response");
		const detail = await response.text();
		if (![429, 529].includes(response.status) || attempt === 3)
			throw new Error(`Jev request failed: HTTP ${response.status}: ${detail.slice(0, 500)}`);
		await Bun.sleep(250 * 2 ** attempt);
	}
	throw new Error("Jev retry loop exhausted");
}

function answerLabel(id: string, answers: Record<string, unknown>): Label {
	const score = requireObject(answers[`${id}__maintenanceCost`], `${id} maintenance answer`);
	const probabilities = requireObject(score.probabilities, `${id} maintenance probabilities`);
	const maintenanceProbabilities = Object.fromEntries(
		Object.entries(probabilities).map(([level, value]) => [
			level,
			requireNumber(value, `${id}.${level}`),
		]),
	);
	const refactor = requireObject(answers[`${id}__refactorValue`], `${id} refactor answer`);
	const evidence = requireObject(answers[`${id}__evidenceSufficient`], `${id} evidence answer`);
	return {
		id,
		maintenanceCost: requireNumber(score.score, `${id}.score`),
		maintenanceProbabilities,
		maintenanceConfidence: requireNumber(score.confidence, `${id}.confidence`),
		refactorValue: requireNumber(refactor.noul, `${id}.refactorValue`),
		evidenceSufficient: requireNumber(evidence.noul, `${id}.evidenceSufficient`),
	};
}

async function labelRecords(records: readonly StudyRecord[], apiKey: string) {
	const labels: Label[] = [];
	let resolvedModel: string | undefined;
	let inputTokens = 0;
	let outputTokens = 0;
	let cost = 0;
	for (const [index, batch] of batches(records).entries()) {
		process.stderr.write(`Jev batch ${index + 1}/${batches(records).length}\n`);
		const response = await requestBatch(batch, apiKey);
		const model = requireString(response.model, "Jev response model");
		if (resolvedModel !== undefined && resolvedModel !== model)
			throw new Error(`Jev model changed during run: ${resolvedModel} -> ${model}`);
		resolvedModel = model;
		const answers = requireObject(response.answers, "Jev answers");
		labels.push(...batch.map((record) => answerLabel(record.id, answers)));
		const usage = requireObject(response.usage, "Jev usage");
		inputTokens += requireNumber(usage.input_tokens, "usage.input_tokens");
		outputTokens += requireNumber(usage.output_tokens, "usage.output_tokens");
		cost += requireNumber(usage.cost, "usage.cost");
	}
	return { resolvedModel, labels, usage: { inputTokens, outputTokens, cost } };
}

function mean(values: readonly number[]): number | null {
	return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values: readonly number[], probability: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const position = (sorted.length - 1) * probability;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	const lowerValue = sorted[lower];
	const upperValue = sorted[upper];
	if (lowerValue === undefined || upperValue === undefined) return null;
	return lowerValue + (upperValue - lowerValue) * (position - lower);
}

function summarizeRatings(selected: readonly Label[]) {
	const maintenance = selected.map((label) => label.maintenanceCost);
	const refactor = selected.map((label) => label.refactorValue);
	const evidence = selected.map((label) => label.evidenceSufficient);
	const dominantLevels = { "0": 0, "1": 0, "2": 0, "3": 0 };
	for (const label of selected) {
		const dominant = Object.entries(label.maintenanceProbabilities).sort(
			([leftLevel, left], [rightLevel, right]) =>
				right - left || leftLevel.localeCompare(rightLevel),
		)[0]?.[0];
		if (dominant !== undefined && Object.hasOwn(dominantLevels, dominant)) {
			dominantLevels[dominant as keyof typeof dominantLevels] += 1;
		}
	}
	return {
		samples: selected.length,
		maintenanceCost: {
			mean: mean(maintenance),
			median: quantile(maintenance, 0.5),
			firstQuartile: quantile(maintenance, 0.25),
			thirdQuartile: quantile(maintenance, 0.75),
			minimum: maintenance.length === 0 ? null : Math.min(...maintenance),
			maximum: maintenance.length === 0 ? null : Math.max(...maintenance),
			dominantLevelCounts: dominantLevels,
		},
		refactorValue: {
			mean: mean(refactor),
			atLeastHalf: refactor.filter((value) => value >= 0.5).length,
		},
		evidenceSufficiency: {
			mean: mean(evidence),
			atLeastHalf: evidence.filter((value) => value >= 0.5).length,
		},
	};
}

function summarizeSmellBench(pairs: readonly SmellPair[], labels: ReadonlyMap<string, Label>) {
	const goodLabels = pairs.map((pair) => labels.get(pair.goodId));
	const badLabels = pairs.map((pair) => labels.get(pair.badId));
	if (
		goodLabels.some((label) => label === undefined) ||
		badLabels.some((label) => label === undefined)
	) {
		throw new Error("missing SmellBench pair labels");
	}
	function summary(selected: readonly SmellPair[]) {
		const deltas = selected.map((pair) => {
			const good = labels.get(pair.goodId);
			const bad = labels.get(pair.badId);
			if (good === undefined || bad === undefined)
				throw new Error(`missing pair ${pair.instanceId}`);
			return {
				maintenance: bad.maintenanceCost - good.maintenanceCost,
				refactor: bad.refactorValue - good.refactorValue,
				evidence: Math.min(good.evidenceSufficient, bad.evidenceSufficient),
			};
		});
		return {
			pairs: deltas.length,
			meanMaintenanceDelta: mean(deltas.map((entry) => entry.maintenance)),
			maintenanceDirectionRate:
				deltas.filter((entry) => entry.maintenance > 0).length / deltas.length,
			meanRefactorDelta: mean(deltas.map((entry) => entry.refactor)),
			refactorDirectionRate: deltas.filter((entry) => entry.refactor > 0).length / deltas.length,
			evidenceCoverage: deltas.filter((entry) => entry.evidence >= 0.5).length / deltas.length,
		};
	}
	const types = [...new Set(pairs.map((pair) => pair.smellType))].sort();
	return {
		ratings: {
			good: summarizeRatings(goodLabels as Label[]),
			bad: summarizeRatings(badLabels as Label[]),
		},
		overall: summary(pairs),
		bySmellType: Object.fromEntries(
			types.map((type) => [type, summary(pairs.filter((pair) => pair.smellType === type))]),
		),
	};
}

function summarizePacket(labels: readonly Label[], answerKeyValue: unknown) {
	if (!Array.isArray(answerKeyValue)) throw new Error("answer key must be an array");
	const strata = new Map(
		answerKeyValue.map((entry, index) => {
			const key = requireObject(entry, `answerKey[${index}]`);
			return [
				requireString(key.blindId, `answerKey[${index}].blindId`),
				requireString(key.stratum, `answerKey[${index}].stratum`),
			];
		}),
	);
	function group(stratum: string) {
		const selected = labels.filter((label) => strata.get(label.id) === stratum);
		const evaluable = selected.filter((label) => label.evidenceSufficient >= 0.5);
		const actionable = evaluable.filter((label) => {
			const material =
				(label.maintenanceProbabilities["2"] ?? 0) + (label.maintenanceProbabilities["3"] ?? 0);
			return material >= 0.5 && label.refactorValue >= 0.5;
		});
		return {
			samples: selected.length,
			evaluable: evaluable.length,
			evidenceCoverage: evaluable.length / selected.length,
			meanMaintenanceCost: mean(evaluable.map((label) => label.maintenanceCost)),
			meanRefactorValue: mean(evaluable.map((label) => label.refactorValue)),
			actionableRate: evaluable.length === 0 ? null : actionable.length / evaluable.length,
		};
	}
	return { flagged: group("flagged"), matchedUnflagged: group("matched-unflagged") };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (!args.includes("--live")) throw new Error("refusing model calls without --live");
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (apiKey === undefined || apiKey.length === 0) throw new Error("OPENROUTER_API_KEY is not set");
	const packetPath = argument(args, "--packet");
	const answerKeyPath = argument(args, "--answer-key");
	const outDir = argument(args, "--out-dir");
	mkdirSync(outDir, { recursive: true });
	const packetText = readFileSync(packetPath, "utf8");
	const answerKeyText = readFileSync(answerKeyPath, "utf8");
	const pairs = buildSmellPairs(await fetchSmellBenchRows());
	const smellRecords = pairs
		.flatMap((pair) => [pair.good, pair.bad])
		.sort((left, right) =>
			sha256(`record-order\0${left.id}`).localeCompare(sha256(`record-order\0${right.id}`)),
		);
	const smellRun = await labelRecords(smellRecords, apiKey);
	const packetRun = await labelRecords(packetRecords(JSON.parse(packetText)), apiKey);
	const smellLabels = new Map(smellRun.labels.map((label) => [label.id, label]));
	const summary = {
		version: 1,
		rubricVersion: RUBRIC_VERSION,
		modelRequested: MODEL,
		modelResolved: smellRun.resolvedModel,
		endpoint: ENDPOINT,
		inputs: {
			packetSha256: sha256(packetText),
			answerKeySha256: sha256(answerKeyText),
			smellBenchDataset: "critical88/SmellBench train",
			smellBenchRevision: SMELLBENCH_REVISION,
			smellBenchRows: pairs.length,
		},
		usage: {
			inputTokens: smellRun.usage.inputTokens + packetRun.usage.inputTokens,
			outputTokens: smellRun.usage.outputTokens + packetRun.usage.outputTokens,
			cost: smellRun.usage.cost + packetRun.usage.cost,
		},
		smellBench: summarizeSmellBench(pairs, smellLabels),
		packet: summarizePacket(packetRun.labels, JSON.parse(answerKeyText)),
	};
	writeFileSync(
		resolve(outDir, "smellbench-labels.json"),
		`${JSON.stringify(smellRun, null, 2)}\n`,
	);
	writeFileSync(resolve(outDir, "packet-labels.json"), `${JSON.stringify(packetRun, null, 2)}\n`);
	writeFileSync(resolve(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (import.meta.main) {
	main().catch((error) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
