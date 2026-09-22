/** Prepare blinded good/bad source snippets from the public SmellBench diff pairs. */
import { createHash } from "node:crypto";

const MAX_SOURCE_CHARS = 16_000;
export const SMELLBENCH_REVISION = "12604372b4a89a54b39645b6c82557b3b9e68eca";

export interface StudyRecord {
	id: string;
	language: "python" | "typescript";
	context: Record<string, string | boolean>;
	source: string;
}

export interface SmellPair {
	instanceId: string;
	smellType: string;
	project: string;
	goodId: string;
	badId: string;
	good: StudyRecord;
	bad: StudyRecord;
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

export function truncateStudySource(source: string): { source: string; truncated: boolean } {
	if (source.length <= MAX_SOURCE_CHARS) return { source, truncated: false };
	const half = Math.floor(MAX_SOURCE_CHARS / 2);
	return {
		source: `${source.slice(0, half)}\n# … middle omitted by study harness …\n${source.slice(-half)}`,
		truncated: true,
	};
}

function appendDiffLine(line: string, before: string[], after: string[]): void {
	const marker = line[0];
	const content = line.slice(1);
	if (marker === " " || marker === "-") before.push(content);
	if (marker === " " || marker === "+") after.push(content);
}

export function diffVersions(diff: string): { before: string; after: string } {
	const before: string[] = [];
	const after: string[] = [];
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
		if (isHunk && !line.startsWith("\\ No newline")) appendDiffLine(line, before, after);
	}
	return { before: before.join("\n"), after: after.join("\n") };
}

export async function fetchSmellBenchRows(): Promise<Record<string, unknown>[]> {
	const rows: Record<string, unknown>[] = [];
	for (const offset of [0, 100]) {
		const url = new URL("https://datasets-server.huggingface.co/rows");
		url.search = new URLSearchParams({
			dataset: "critical88/SmellBench",
			config: "default",
			split: "train",
			offset: String(offset),
			length: "100",
			revision: SMELLBENCH_REVISION,
		}).toString();
		const response = await fetch(url);
		if (!response.ok) throw new Error(`SmellBench download failed: HTTP ${response.status}`);
		const payload = requireObject(await response.json(), "SmellBench response");
		if (!Array.isArray(payload.rows)) throw new Error("SmellBench response has no rows");
		for (const entry of payload.rows) {
			const row = requireObject(
				requireObject(entry, "SmellBench row wrapper").row,
				"SmellBench row",
			);
			rows.push(row);
		}
	}
	return rows;
}

export function buildSmellPairs(rows: readonly Record<string, unknown>[]): SmellPair[] {
	return rows.map((row) => {
		const instanceId = requireString(row.instance_id, "instance_id");
		const smellType = requireString(row.type, `${instanceId}.type`);
		const project = requireString(row.project_name, `${instanceId}.project_name`);
		const versions = diffVersions(requireString(row.smell_content, `${instanceId}.smell_content`));
		const goodSource = truncateStudySource(versions.before);
		const badSource = truncateStudySource(versions.after);
		const opaque = createHash("sha256").update(`smellbench\0${instanceId}`).digest("hex");
		const goodId = opaque.slice(0, 16);
		const badId = opaque.slice(16, 32);
		const context = { project, source: "SmellBench unified-diff reconstruction" };
		return {
			instanceId,
			smellType,
			project,
			goodId,
			badId,
			good: {
				id: goodId,
				language: "python",
				context: { ...context, truncated: goodSource.truncated },
				source: goodSource.source,
			},
			bad: {
				id: badId,
				language: "python",
				context: { ...context, truncated: badSource.truncated },
				source: badSource.source,
			},
		};
	});
}
