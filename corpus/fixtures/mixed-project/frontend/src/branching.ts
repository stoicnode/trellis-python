export function renderValue(value: number): string {
	if (value < 0) return "negative";
	if (value === 0) return "zero";
	if (value > 100) return "large";
	if (value % 2 === 0) return "even";
	if (value % 3 === 0) return "three";
	if (value % 5 === 0) return "five";
	if (value % 7 === 0) return "seven";
	if (value % 11 === 0) return "eleven";
	if (value % 13 === 0) return "thirteen";
	if (value % 17 === 0) return "seventeen";
	if (value % 19 === 0) return "nineteen";
	return "other";
}
