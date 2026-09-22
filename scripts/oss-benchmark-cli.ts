/** CLI argument shaping for the opt-in prepared-checkout benchmark commands. */
export interface PreparationArgs {
	preparedRoot: string;
	artifactRoot?: string;
	runs: number;
}

export function readPreparationArgs(
	args: readonly string[],
	acceptanceRequested: boolean,
): PreparationArgs {
	const preparedIndex = args.indexOf("--prepared-root");
	const artifactIndex = args.indexOf("--artifact-root");
	if (preparedIndex < 0 || (artifactIndex < 0 && !acceptanceRequested)) {
		throw new Error(
			"usage: --prepared-root <repos> --artifact-root <artifacts> [--reaudit|--python-acceptance] | --prepared-root <repos> --acceptance [--runs <positive-int>]",
		);
	}
	const preparedRoot = args[preparedIndex + 1];
	const artifactRoot = artifactIndex < 0 ? undefined : args[artifactIndex + 1];
	if (preparedRoot === undefined || (artifactIndex >= 0 && artifactRoot === undefined))
		throw new Error("prepared roots need values");
	const runsIndex = args.indexOf("--runs");
	const runs = runsIndex < 0 ? 3 : Number.parseInt(args[runsIndex + 1] ?? "", 10);
	if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs needs a positive integer");
	return { preparedRoot, ...(artifactRoot === undefined ? {} : { artifactRoot }), runs };
}
