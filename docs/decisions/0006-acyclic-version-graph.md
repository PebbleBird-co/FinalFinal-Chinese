# 0006: Build an evidence-first acyclic version graph

- Status: Accepted
- Date: 2026-08-03

## Context

Modification times are useful but unreliable, while filename version markers can conflict with copied or
restored timestamps. The graph must remain understandable and must not turn every plausible relation into
a dense network.

## Decision

- Pair direction uses numeric version progression when both files provide comparable numeric versions.
  Otherwise it uses modification time, with a deterministic file ID tie-breaker.
- A numeric-version direction that conflicts with modification time is retained with a low time-order score
  and explicit negative evidence. It is not silently discarded or presented as certain history.
- Edge confidence follows the plan's five weighted components: filename similarity, time order, size
  continuity, directory relation, and version progression.
- Each target keeps at most one main parent and two alternate parents. Alternate edges are serialized and
  visible but do not define graph roots, leaves, or branch points.
- Every main and alternate edge is checked against the graph's current reachability before insertion. An
  edge that would form a cycle is skipped.
- Multiple high-scoring main successors from one source are marked as a possible branch.
- Serialized graph positions are deterministic and require no additional layout engine. React Flow is used
  only as a read-only renderer with zoom, pan, family selection, and edge-evidence inspection.

The graph contains hypotheses, confidence, and evidence. It does not rank an official version or generate
timeline and risk conclusions in this phase.
