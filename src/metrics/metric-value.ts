/** Shared state rules for metrics emitted by the complexity and duplication analyzers. */
import type { MetricValue } from "../contract/index.ts";

function stateAndValue(
	value: number | null,
	reason: string | undefined,
): Pick<MetricValue, "state" | "value" | "reason"> {
	if (reason !== undefined) {
		return value === null
			? { state: "incomplete", reason }
			: { state: "incomplete", value, reason };
	}
	return value === null ? { state: "not-applicable" } : { state: "complete", value };
}

/** Emit one contract metric while keeping null and incomplete states distinct. */
export function metric(
	id: string,
	unit: string,
	value: number | null,
	reason: string | undefined,
	extra?: Partial<Pick<MetricValue, "numerator" | "denominator" | "detail">>,
): MetricValue {
	return { id, unit, ...stateAndValue(value, reason), ...extra };
}
