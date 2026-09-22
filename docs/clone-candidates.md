# Advisory clone candidates

Trellis keeps its existing normalized-token clone groups and scored
`duplication.density.*` unchanged. `duplication.candidate.*` is a separate,
unscored view for reviewing whether those raw matches look like independent
copies of executable logic. It is provisional research evidence, not a claim
that matching code can safely be extracted.

## Population and counts

The candidate pass uses the same shared TypeScript or Python parse and the
same production/test split as raw duplication. It labels each token as
`executable-logic`, `import-export-list`, `type-declaration`, `literal-data`,
or `mixed-unknown`. Literal collections and calls whose arguments are all
static literals count as data. When an occurrence contains both executable
and data tokens, one role must have at least twice the other's token count
to win; otherwise the occurrence is mixed. Import/export and type roles do
not become executable through that rule. This conservative syntax rule does
not infer semantic intent.

Within each raw clone group, Trellis selects the maximum number of disjoint
half-open token intervals in each file, sorting by ending token position.
Two occurrences can share a physical line and still be independent. A
self-shifted export list whose windows overlap in tokens contributes one
independent occurrence, so it cannot become a candidate copy. A group needs
at least two independent **executable** occurrences to enter candidate
burden. Raw groups remain visible even when they do not meet that rule.

The candidate denominator is the union of code lines containing eligible
executable tokens. The numerator is the union of those same eligible lines
covered by selected candidate occurrences. The line sets prevent overlap
from double counting and keep numerator and denominator on the same
population. `executable-groups`, `independent-copies`, `covered-lines`,
`eligible-lines`, and `density` are reported separately for production and
tests. Finding facts include each member's role and the zero-based indexes
of selected independent members in the original raw group.

## Stricter comparisons

The existing broad normalization detects renamed copies and similar data
shapes. Four postfilters compare independent members of each raw group:

| Postfilter | Question |
| --- | --- |
| `kind-preserving-groups` | Do corresponding tokens retain their original literal/grammar kinds? |
| `equality-preserving-groups` | Is the within-occurrence equality pattern of identifiers and literals the same? |
| `statement-aligned-groups` | Does every selected occurrence start and end on a complete statement boundary? |
| `exact-data-groups` | Are independently repeated literal-data tokens text-identical, rather than only shape-identical? |

These are nested comparisons over raw matches, not a second matcher. A
renamed implementation may preserve kind and equality while differing in
exact text. Distinct emoji or color tables may share normalized structure
but fail exact data agreement. Partial maximal matches often fail statement
alignment even when their inner statements look similar. A failed postfilter
does not erase the raw finding.

The candidate pass has an independent resource limit. If it stops, its
metrics are `incomplete` with a reason; completed raw groups, raw density and
the scored index remain available. Parse diagnostics still mark both views
partial. No candidate metric enters the current scoring formula or default
policy. Operators may review the raw finding and candidate facts together
before setting an explicit budget.

Fixed-corpus measurements and controls are in
[`../corpus/index-utility/p22-clones/summary.json`](../corpus/index-utility/p22-clones/summary.json).
