# Advisory executable scopes and nesting

The scored complexity model measures inventoried function bodies. The separate
`trellis.executable-scopes` analysis locates decisions in module and class
initialization and locates control nesting from depth 3, even when a function's
cyclomatic complexity stays below the scored hotspot threshold. Its metrics
and findings are advisory; they do not change the index or its completeness.

## Ownership

Every parsed production or test file has one module unit. Named classes have
class units. A function body, including a nested function or lambda, has its
own unit and starts at depth zero. Definition-time defaults, decorators and
class headers belong to the enclosing unit. Executable class members such as
field initializers belong to the class unit. A nested class starts a separate
class unit. A decision is assigned to one unit only. Bodiless overloads have
no function unit. Unresolved or repeated lexical owners carry an explicit
ambiguous identity; comparison does not guess by line number.

`executable.initialization` findings locate the first decision in a module
or class unit and include the unit's total decision count, maximum nesting,
source set and owner. `executable.nesting` findings locate the deepest control
node in any unit at depth 3 or more. The latter is independent of CC 11.
Summary metrics count initialization units and decisions and give maximum
nesting and the number of nesting findings for production and tests separately.
Parse diagnostics mark the affected scope's metrics incomplete.

## Control depth

One `if`, loop, `switch`/`match`, `try`, conditional expression, or Python
comprehension expression adds one level. `else if` and `elif` chains stay at
the original `if` level. A `case` or exception handler does not add a level
of its own; a control inside one does. Nested functions reset depth. A Python
comprehension's clauses stay within the expression's single level, while a
nested comprehension expression adds another level. This is a structural
review lead, not a cross-language claim about cognitive difficulty.

Decisions use the languages' existing native CC decision rules where those
nodes apply, but function CC and erosion scoring remain unchanged. The
advisory facts can be compared across compatible reports to expose raw
severity changes that integer score rounding hides. Operators can review
these findings and set explicit metric or new-finding policy budgets.
