#!/usr/bin/env bun
/**
 * Per-file line-count guard (L5 toolkit ratchet).
 *
 * Walks every TypeScript file under the configured scan roots (default:
 * `src/` and `scripts/`) and enforces a budget recorded in
 * `scripts/file-size-budgets.json`:
 *
 *   - Files NOT listed in `budgets` must be ≤ `threshold` lines.
 *   - Files listed in `budgets` must be ≤ their listed budget. The
 *     listed budget is a frozen ceiling (the file's line count at the
 *     time it was grandfathered in) — the ratchet only goes down.
 *
 * To shrink a budget, refactor the file then lower the number (or remove
 * the entry once the file is below `threshold`). To grow past the
 * ceiling: refactor first; do NOT raise the number — that would defeat
 * the guard. This script never auto-edits its own budget; loosening
 * requires an explicit commit by a human.
 *
 * CLI:
 *   bun run scripts/check-file-sizes.ts                 # scan defaults
 *   bun run scripts/check-file-sizes.ts --budget P.json --root src --root scripts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanTsFiles } from "./scan-ts-files.ts";

const SCRIPT_DIR = import.meta.dir;
const DEFAULT_REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_BUDGETS_PATH = resolve(SCRIPT_DIR, "file-size-budgets.json");
const DEFAULT_SCAN_ROOTS = ["src", "scripts"] as const;
const DEFAULT_EXCLUDE_PATH_PREFIXES = [] as const;

export interface BudgetsFile {
	threshold: number;
	budgets: Record<string, number>;
}

export interface ScanOptions {
	repoRoot?: string;
	budgetsPath?: string;
	scanRoots?: readonly string[];
	excludePathPrefixes?: readonly string[];
}

export interface Failure {
	path: string;
	lines: number;
	budget: number;
	reason: string;
}

export interface ScanResult {
	failures: Failure[];
	staleBudgetEntries: string[];
}

export function loadBudgets(path: string): BudgetsFile {
	const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
	const threshold = raw.threshold;
	const budgets = raw.budgets;
	if (typeof threshold !== "number" || threshold <= 0) {
		throw new Error(`${path}: "threshold" must be a positive number`);
	}
	if (budgets === null || typeof budgets !== "object" || Array.isArray(budgets)) {
		throw new Error(`${path}: "budgets" must be an object`);
	}
	const normalized: Record<string, number> = {};
	for (const [p, value] of Object.entries(budgets)) {
		if (typeof value !== "number" || value <= 0) {
			throw new Error(`${path}: budgets["${p}"] must be a positive number`);
		}
		normalized[p] = value;
	}
	return { threshold, budgets: normalized };
}

export function countLines(filePath: string): number {
	const buf = readFileSync(filePath);
	if (buf.length === 0) return 0;
	let count = 0;
	for (let i = 0; i < buf.length; i++) {
		if (buf[i] === 0x0a) count++;
	}
	if (buf[buf.length - 1] !== 0x0a) count++;
	return count;
}

export function scan(options: ScanOptions = {}): ScanResult {
	const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
	const budgetsPath = options.budgetsPath ?? DEFAULT_BUDGETS_PATH;
	const scanRoots = options.scanRoots ?? DEFAULT_SCAN_ROOTS;
	const excludePathPrefixes = options.excludePathPrefixes ?? DEFAULT_EXCLUDE_PATH_PREFIXES;

	const { threshold, budgets } = loadBudgets(budgetsPath);
	const failures: Failure[] = [];
	const seenInWalk = new Set<string>();

	for (const { absPath, relPath } of scanTsFiles({
		repoRoot,
		scanRoots,
		excludePathPrefixes,
	})) {
		seenInWalk.add(relPath);

		const lines = countLines(absPath);
		const explicit = budgets[relPath];
		if (explicit !== undefined) {
			if (lines > explicit) {
				failures.push({
					path: relPath,
					lines,
					budget: explicit,
					reason: `exceeds frozen budget (${lines} > ${explicit}); refactor instead of raising the budget`,
				});
			}
		} else if (lines > threshold) {
			failures.push({
				path: relPath,
				lines,
				budget: threshold,
				reason: `exceeds default threshold (${lines} > ${threshold}); split the file or add a justified entry to the budget JSON`,
			});
		}
	}

	const staleBudgetEntries: string[] = [];
	for (const p of Object.keys(budgets)) {
		if (!seenInWalk.has(p)) staleBudgetEntries.push(p);
	}

	return { failures, staleBudgetEntries };
}

interface ParsedArgs {
	budgetsPath?: string;
	repoRoot?: string;
	scanRoots: string[];
}

function parseArgs(argv: readonly string[]): ParsedArgs {
	const out: ParsedArgs = { scanRoots: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--budget") {
			out.budgetsPath = argv[++i];
		} else if (a === "--root") {
			const v = argv[++i];
			if (v) out.scanRoots.push(v);
		} else if (a === "--repo-root") {
			out.repoRoot = argv[++i];
		}
	}
	return out;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const options: ScanOptions = {};
	if (args.budgetsPath) options.budgetsPath = resolve(args.budgetsPath);
	if (args.repoRoot) options.repoRoot = resolve(args.repoRoot);
	if (args.scanRoots.length > 0) options.scanRoots = args.scanRoots;

	const { failures, staleBudgetEntries } = scan(options);

	if (staleBudgetEntries.length > 0) {
		console.error("file-size budget has entries for files that no longer exist:");
		for (const p of staleBudgetEntries) console.error(`  - ${p}`);
		console.error("Remove these entries to keep the budget honest.");
		console.error("");
	}

	if (failures.length > 0) {
		console.error("File-size guard failed:");
		for (const f of failures) {
			console.error(`  ${f.path}: ${f.reason}`);
		}
		console.error("");
		console.error(
			"Tip: the ratchet only goes down. Refactor large files into smaller modules rather than raising their budget.",
		);
		process.exit(1);
	}

	if (staleBudgetEntries.length > 0) process.exit(1);

	console.log("File-size guard ok.");
}

if (import.meta.main) main();
