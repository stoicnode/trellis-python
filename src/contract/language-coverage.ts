/** Observed native coverage for each language in a workspace audit. */
import { z } from "zod";

export const languageCoverageRowSchema = z.strictObject({
	language: z.enum(["python", "typescript"]),
	discoveredFiles: z.number().int().nonnegative(),
	analyzedFiles: z.number().int().nonnegative(),
	parseFailureFiles: z.number().int().nonnegative(),
	sloc: z.number().int().nonnegative(),
	unresolvedImports: z.number().int().nonnegative(),
	dynamicImports: z.number().int().nonnegative(),
});

export type LanguageCoverageRow = z.infer<typeof languageCoverageRowSchema>;
