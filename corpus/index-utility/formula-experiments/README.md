# Formula experiment artifact

`results.json.gz` is the Phase 4 research output described in
[`docs/index-formula-experiments.md`](../../../docs/index-formula-experiments.md).
It contains all 16 pinned scopes, the authoritative baseline, eight isolated
candidate variants, raw candidate signals, exact and rounded contributions,
language/size slices, saturation counts, rank reversals, and resource records.

It is evidence only. The authoritative scoring version remains
`0.9.0-provisional`. Decompress with `gzip -dc results.json.gz`; reproduce
with `scripts/index-formula-experiments.ts`. The checkouts are operator
prepared under the manifest repository ids, and the runner requires their
recorded commit and tree with no untracked or ignored source. It never
acquires dependencies or executes target code.

Compressed SHA-256:
`f791e358226f93a8b566a473685c359908b624ad9f190f26baa2ac08bb189b13`.
