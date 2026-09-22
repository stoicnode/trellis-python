/** Shared file selection for the debt-marker and file-size guards. */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const EXCLUDE_DIR_SEGMENTS = new Set(["node_modules", "__golden__"]);
const EXTENSIONS = [".ts", ".tsx"] as const;

export interface ScanFile {
	absPath: string;
	relPath: string;
}

export interface ScanFilesOptions {
	repoRoot: string;
	scanRoots: readonly string[];
	excludePathPrefixes: readonly string[];
	selfExclude?: ReadonlySet<string>;
}

function* walk(dir: string): Generator<string> {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		if (EXCLUDE_DIR_SEGMENTS.has(entry)) continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) yield* walk(full);
		else if (stat.isFile()) yield full;
	}
}

/** Yield selected TypeScript files in scan-root and filesystem order. */
export function* scanTsFiles(options: ScanFilesOptions): Generator<ScanFile> {
	for (const root of options.scanRoots) {
		for (const absPath of walk(resolve(options.repoRoot, root))) {
			const relPath = relative(options.repoRoot, absPath).replaceAll("\\", "/");
			if (!EXTENSIONS.some((extension) => relPath.endsWith(extension))) continue;
			if (options.selfExclude?.has(relPath)) continue;
			if (options.excludePathPrefixes.some((prefix) => relPath.startsWith(prefix))) continue;
			yield { absPath, relPath };
		}
	}
}
