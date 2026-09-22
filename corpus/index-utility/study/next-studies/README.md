# Public maintainer validation manifests

These are concrete **design and acquisition specifications**, written 2026-09-22;
no next-study results or populated source lock are claimed. The implementation
must resolve and seal source/tool hashes before measurement. Missing public labels
produce an `incomplete` ledger, without a request for new human quality judgments.

Read the [evidence audit](../../../../docs/research/index-evidence-audit.md) and
[ranked roadmap](../../../../docs/research/index-validation-roadmap.md).

| File | Purpose |
| --- | --- |
| [common.json](common.json) | Shared sample, matching, estimator, uncertainty, decision, packet, repeatability and non-inferiority contract |
| [sources.json](sources.json) | Finite repository universe, public API acquisition, exact label selectors, exclusions, pins, source locks and holdout assignment |
| [c1-complexity.json](c1-complexity.json) | Severity versus threshold count and size |
| [d1-clones.json](d1-clones.json) | Independent executable copies beyond raw clones and other burdens |
| [n1-nesting.json](n1-nesting.json) | Incremental nesting beyond severity and correlated measurements |
| [g1-cycles.json](g1-cycles.json) | SCC burden with identical runtime/type-only graph semantics |
| [a1-syntax.json](a1-syntax.json) | Three independently gated optional syntax lanes |
| [artifact.schema.json](artifact.schema.json) | Draft-07 schema for each source-lock, label, event, block, packet, measurement, prediction and decision record |

Paths in manifests resolve relative to this directory. Paths in produced artifact
records resolve relative to the operator-selected portable artifact root, with no
absolute paths or traversal. Hash **bytes**, not parsed/reformatted JSON. Native
payload canonicalization sorts object keys and stable record identities; remove
only the explicitly listed volatile fields. Persist the canonicalization version.

Apply common settings first, then a study's additional gates. G1's endpoint/decision and A1's
sample/endpoint/decision overrides replace the common logistic-study settings;
common isolation, holdouts, missingness and repeatability still apply. For native
studies, stop gates take precedence over refine; incomplete inputs cannot pass.
Decisions concern the bounded claims in the roadmap and never auto-promote code.

The existing research runners are useful building blocks, but do not yet implement
this complete contract. Proposed future interfaces:

```text
prepare-index-study --manifest <study.json> --out <artifact-root>
lock-index-study --manifest <study.json> --artifacts <artifact-root>
measure-index-study --lock <sealed-lock.json> --prepared-root <sources> --out <outputs>
summarize-index-study --lock <sealed-lock.json> --predictions <sealed-predictions> --out <results>
```

These names specify work to implement; they are not runnable commands in this
checkout. Preparation can fetch public sources explicitly. Measurement and
summary consume prepared bytes offline. Neither phase runs target code. Jev is
disabled by default and is a separate development-only research action.

## Required cross-record validation

- Exact 40-hex source commit/tree ids and 64-hex SHA-256 artifact digests; compare
  every file's bytes. Resolve pinned fixture blobs and tool digests at preparation.
- Every event joins exactly one public label and both snapshots; each label's
  accepted ranges map to those exact bytes. No fixture/model/synthetic label can
  enter a primary public-maintainer validation role.
- All source/destination owners, clone members and graph endpoints remain within
  the declared classified snapshot. Missing/ambiguous mappings cannot become zero.
- Unique event ids, one target per PR/decision, no within-decision control reuse,
  no development/validation/reserve repository/fork/patch/clone-family overlap.
- Verify expected counts in each language, repository, subtype and label class.
  Partial results retain every selected event and exclusions. Do not substitute
  unlabeled code for negatives or JS fixtures for TypeScript cases.
- Range ends follow starts; columns are zero-based and lines one-based; every
  range's blob hash must match the pinned file. Duplicate diagnostic matches
  receive no extra true-positive credit.
- Sealed prediction records predate the label join. Fitted coefficients, RMS
  scales and feature definitions must derive exclusively from development data.
- Include numerator/denominator values and states, contextual limitations, tool
  options, full raw reports and the bootstrap replicate artifact. Any output
  with missing prerequisites must identify them rather than asserting a clean pass.

## Implementation backlog

1. Public acquisition, conservative label extraction and source/split lock.
2. Offline reconstruction, schema/provenance validation and lossless packets.
3. Native feature/control collection and same-class SCC research ablation.
4. Deterministic statistical comparisons, label joins and explicit decision gates.
5. Optional syntax lanes and development-only Jev repeatability diagnostics.

These are implementation tasks for the requested roadmap, not unfinished changes
to production. Tracker bootstrap tools `ml` and `sd` were unavailable during
authoring; the backlog remains here rather than inventing tracker ids.
