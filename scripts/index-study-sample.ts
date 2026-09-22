#!/usr/bin/env bun
/** Produce separated reviewer/key files from a prepared Phase 5 unit census. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { buildStudySample } from "../src/research/study-sampling.ts";

const unitSchema = z.strictObject({
	id: z.string().min(1),
	repository: z.string().min(1),
	language: z.enum(["python", "typescript"]),
	role: z.enum(["library", "framework", "developer-tool"]),
	path: z.string().min(1),
	kind: z.string().min(1),
	sizeBucket: z.enum(["small", "medium", "large"]),
	startLine: z.number().int().positive(),
	endLine: z.number().int().positive(),
	excerptStartLine: z.number().int().positive(),
	excerptEndLine: z.number().int().positive(),
	excerpt: z.string(),
	excerptTruncated: z.boolean(),
	flagKinds: z.array(z.string().min(1)),
});
const preregistrationSchema = z
	.strictObject({
		seed: z.string().min(1),
		unitsPerRepository: z.strictObject({
			flagged: z.number().int().positive(),
			matchedUnflagged: z.number().int().positive(),
		}),
	})
	.passthrough();

function argument(args: string[], name: string): string {
	const index = args.indexOf(name);
	const value = index < 0 ? undefined : args[index + 1];
	if (value === undefined) throw new Error(`missing ${name}`);
	return resolve(value);
}

function optionalArgument(args: string[], name: string): string | undefined {
	const index = args.indexOf(name);
	const value = index < 0 ? undefined : args[index + 1];
	return value === undefined ? undefined : resolve(value);
}

function numberedExcerpt(excerpt: string, startLine: number): string {
	return excerpt
		.split("\n")
		.map((line, index) => `${String(startLine + index).padStart(5)} | ${line}`)
		.map((line) => `    ${line}`)
		.join("\n");
}

function markdown(packet: ReturnType<typeof buildStudySample>["reviewerPacket"]): string {
	const introduction = [
		"# Trellis index utility blind review",
		"",
		"Review each sample without consulting Trellis scores, the answer key, or competitor tools.",
		"Record maintenance cost (0 none, 1 minor, 2 material, 3 severe), suggested action",
		"(leave, document tradeoff, monitor, refactor), confidence (low, medium, high),",
		"intentional tradeoff (yes/no and why), minutes spent, and short notes.",
		"",
	];
	const samples = packet.flatMap((unit, index) => [
		`## Sample ${index + 1}: ${unit.blindId}`,
		"",
		`- Context: ${unit.repository} · ${unit.language} · ${unit.role}`,
		`- Location: ${unit.path}:${unit.startLine}-${unit.endLine}`,
		`- Unit: ${unit.kind} · ${unit.sizeBucket} executable size`,
		...(unit.excerptTruncated
			? ["- Excerpt: truncated; inspect the pinned checkout for the full unit"]
			: []),
		"",
		numberedExcerpt(unit.excerpt, unit.excerptStartLine),
		"",
		"**Review**",
		"",
		"- Maintenance cost (0–3):",
		"- Suggested action:",
		"- Confidence:",
		"- Intentional tradeoff:",
		"- Minutes spent:",
		"- Notes:",
		"",
	]);
	return [...introduction, ...samples].join("\n");
}

function main(): void {
	const args = process.argv.slice(2);
	const units = z
		.array(unitSchema)
		.parse(JSON.parse(readFileSync(argument(args, "--units"), "utf8")));
	const preregistration = preregistrationSchema.parse(
		JSON.parse(readFileSync(argument(args, "--preregistration"), "utf8")),
	);
	if (
		preregistration.unitsPerRepository.flagged !==
		preregistration.unitsPerRepository.matchedUnflagged
	)
		throw new Error("sampler requires equal flagged and matched-unflagged strata");
	const sample = buildStudySample(
		units,
		preregistration.seed,
		preregistration.unitsPerRepository.flagged,
	);
	writeFileSync(
		argument(args, "--reviewer-out"),
		`${JSON.stringify(sample.reviewerPacket, null, 2)}\n`,
	);
	writeFileSync(argument(args, "--key-out"), `${JSON.stringify(sample.answerKey, null, 2)}\n`);
	const markdownPath = optionalArgument(args, "--reviewer-md-out");
	if (markdownPath !== undefined)
		writeFileSync(markdownPath, `${markdown(sample.reviewerPacket)}\n`);
}

if (import.meta.main) {
	try {
		main();
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
