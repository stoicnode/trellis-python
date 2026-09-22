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
}

if (import.meta.main) {
	try {
		main();
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
