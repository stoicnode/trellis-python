/** A root-level newline after a complete comment can be a Lezer skip-token recovery artifact. */
interface RecoveryNode {
	name: string;
	from: number;
	to: number;
	error: boolean;
	children: RecoveryNode[];
}

export function isTriviaRecovery(root: RecoveryNode, error: RecoveryNode, text: string): boolean {
	if (root.name !== "Script" || text.slice(error.from, error.to) !== "\n") return false;
	const index = root.children.indexOf(error);
	const previous = root.children[index - 1];
	const next = root.children[index + 1];
	if (previous?.name !== "Comment" || previous.to !== error.from || next === undefined)
		return false;
	const lineStart = text.lastIndexOf("\n", previous.from - 1) + 1;
	return text.slice(lineStart, previous.from).trim() === "" && !next.error;
}
