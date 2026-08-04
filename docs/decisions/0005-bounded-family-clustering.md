# 0005: Use bounded candidate blocking and conservative family merging

- Status: Accepted
- Date: 2026-08-03

## Context

Comparing every pair of files grows quadratically, while merging every plausible relation risks turning a
single false positive into a large incorrect family. Phase 3 also must not infer parent-child version edges,
which belong to the next phase.

## Decision

- Candidate generation uses exact core-name buckets plus bounded windows for shared business-token pairs,
  prefixes, suffixes, directory-local core prefixes, and character n-grams.
- Exact-core buckets use a deterministic anchor relation. This is enough to connect a family without storing
  every redundant pair.
- Only adjusted similarity at or above `0.78` is merged with Union-Find.
- Similarity from `0.65` through `0.78` is retained as a weak relation for later user confirmation and never
  merges families automatically.
- Incompatible formats, size ratios above twenty, and distant paths without version markers add explicit,
  inspectable penalties. They do not become hidden hard exclusions.
- Files without a strong relation remain visible as single-file families.
- File IDs are deterministic scan-local IDs derived from normalized relative paths. No content hash is read.
- Tests use in-memory metadata fixtures rather than adding disposable binary fixture files to the repository.

The clustering result contains evidence and confidence but no parent, root, leaf, or branch claims. Those
remain out of scope until the version-graph phase.
