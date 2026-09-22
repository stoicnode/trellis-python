/** Advisory oversized-documentation evidence over the shared syntax inventory. */
import type {
	EffectiveDocumentationConfig,
	Finding,
	MetricValue,
	Range,
	SourceSet,
} from "../contract/index.ts";
import { lineStarts, range as pythonRange } from "../python/tree.ts";
import { type FileSyntax, rangeAt, type SyntaxInventory } from "../syntax/index.ts";
import { jsDocContentCounts, pythonContentCounts } from "./content.ts";
import { attachedTypeScriptDocs } from "./typescript-docs.ts";

interface DocumentationBlock {
	path: string;
	sourceSet: SourceSet;
	language: "python" | "typescript";
	range: Range;
	ownerKey: string | null;
	contentLines: number;
	words: number;
}

export interface DocumentationAnalysis {
	metrics: MetricValue[];
	findings: Finding[];
}

function fileBlocks(file: FileSyntax): DocumentationBlock[] {
	if (file.language === "python") {
		const text = file.text ?? "";
		const starts = lineStarts(text);
		return file.docstrings.map((doc) => ({
			path: file.path,
			sourceSet: file.sourceSet,
			language: "python",
			range: pythonRange(starts, doc.from, doc.to),
			ownerKey: doc.ownerKey,
			...pythonContentCounts(doc.contentSpans.map((span) => text.slice(span.from, span.to))),
		}));
	}
	return attachedTypeScriptDocs(file).map((doc) => ({
		path: file.path,
		sourceSet: file.sourceSet,
		language: "typescript",
		range: rangeAt(file.sourceFile, doc.from, doc.to),
		ownerKey: doc.ownerKey,
		...jsDocContentCounts(doc.raw),
	}));
}

function isExcessive(block: DocumentationBlock, config: EffectiveDocumentationConfig): boolean {
	return block.contentLines > config.maxContentLines || block.words > config.maxWords;
}

function blockFinding(
	block: DocumentationBlock,
	config: EffectiveDocumentationConfig,
	ownerCounts: ReadonlyMap<string, number>,
): Finding {
	const identityReason =
		block.ownerKey === null
			? "unresolved-owner"
			: (ownerCounts.get(`${block.path}:${block.ownerKey}`) ?? 0) > 1
				? "duplicate-owner"
				: null;
	return {
		kind: "documentation.excessive",
		path: block.path,
		range: block.range,
		summary: `documentation block exceeds a size threshold (${block.contentLines} lines, ${block.words} words); review repetition or extended tutorials while retaining essential API contracts and examples`,
		facts: {
			language: block.language,
			sourceSet: block.sourceSet,
			contentLines: block.contentLines,
			words: block.words,
			maxContentLines: config.maxContentLines,
			maxWords: config.maxWords,
			exceededLines: block.contentLines > config.maxContentLines,
			exceededWords: block.words > config.maxWords,
			ownerKey: identityReason === null ? block.ownerKey : null,
			identityState: identityReason === null ? "identified" : "ambiguous",
			identityReason,
		},
	};
}

function scopeMetrics(
	set: "production" | "test",
	files: readonly FileSyntax[],
	blocks: readonly DocumentationBlock[],
	config: EffectiveDocumentationConfig,
): MetricValue[] {
	const diagnosticFiles = files.filter((file) => file.diagnostics.length > 0).length;
	const reason =
		diagnosticFiles === 0
			? undefined
			: `${diagnosticFiles} ${set} file(s) produced parse diagnostics; documentation counts are partial`;
	const detail = {
		scope: "python-docstrings-and-attached-typescript-jsdoc",
		...config,
	};
	const metric = (id: string, value: number): MetricValue => ({
		id,
		unit: "count",
		state: reason === undefined ? "complete" : "incomplete",
		value,
		...(reason === undefined ? {} : { reason }),
		detail,
	});
	return [
		metric(`documentation.blocks.${set}`, blocks.length),
		metric(
			`documentation.excessive.${set}`,
			config.enabled ? blocks.filter((block) => isExcessive(block, config)).length : 0,
		),
	];
}

/** Defaults are advisory: no score contribution and no implicit policy failure. */
export function analyzeDocumentation(
	inventory: SyntaxInventory,
	config: EffectiveDocumentationConfig,
): DocumentationAnalysis {
	const files = inventory.files.filter(
		(file) => file.sourceSet === "production" || file.sourceSet === "test",
	);
	const blocks = files.flatMap(fileBlocks);
	const ownerCounts = new Map<string, number>();
	for (const block of blocks) {
		if (block.ownerKey === null) continue;
		const key = `${block.path}:${block.ownerKey}`;
		ownerCounts.set(key, (ownerCounts.get(key) ?? 0) + 1);
	}
	return {
		metrics: (["production", "test"] as const)
			.flatMap((set) =>
				scopeMetrics(
					set,
					files.filter((file) => file.sourceSet === set),
					blocks.filter((block) => block.sourceSet === set),
					config,
				),
			)
			.sort((a, b) => a.id.localeCompare(b.id)),
		findings: config.enabled
			? blocks
					.filter((block) => isExcessive(block, config))
					.map((block) => blockFinding(block, config, ownerCounts))
			: [],
	};
}
