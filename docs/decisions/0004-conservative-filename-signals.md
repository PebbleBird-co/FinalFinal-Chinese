# 0004: Keep filename signals conservative and independently testable

- Status: Accepted
- Date: 2026-08-03

## Context

Filename dates and version markers are ambiguous. A compact date can resemble a revision number, generic
words can make unrelated files appear similar, and an unbounded numeric-version expression can consume a
date that follows a version token.

## Decision

- Filename analysis is implemented as pure functions and attached to scan metadata. It never opens file
  contents and does not infer file families in this phase.
- Numeric versions contain at most three components of at most three digits each. This covers the MVP
  examples while preventing a following four-digit year from being absorbed into the version.
- Full dates are high-confidence syntax signals. Dates without a year are retained as low-confidence
  signals and cannot independently establish a future version relationship.
- Generic stop words are removed from business core names. Empty core names never receive the exact-core
  similarity bonus, preventing unrelated generic names from scoring highly.
- Single-character Chinese markers are recognized only when they are not embedded inside a longer Chinese
  business word.

The similarity API returns both the combined score and every weighted component so later inference can
show its evidence instead of presenting a score as fact.
