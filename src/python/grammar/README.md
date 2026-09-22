# Trellis Python grammar

`trellis-python.grammar` is a pinned derivative of `@lezer/python` 1.1.18
(MIT). It accepts empty modules, bare `yield`, tuple/list targets in `with`
statements, and starred comprehension targets used by the pinned open-source
corpus.

The checked-in `trellis-parser.ts` and `trellis-parser.terms.ts` are generated
with `@lezer/generator` 1.8.0. They are runtime artifacts: audits import them
directly and never invoke a generator, Python interpreter, target command, or
network request. `tokens.ts` is the paired upstream tokenizer, kept local so
the generated parser has a stable in-process indentation context.
