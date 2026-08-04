# 0008: Keep main-version ranking explainable and non-authoritative

- Status: Accepted
- Date: 2026-08-03

## Context

A filename containing "final" is easy to overvalue, while graph position, recency, directory intent, and
conflicting risks can provide stronger contrary evidence. The user-correction phase is not implemented yet.

## Decision

- Candidate score follows the plan's seven weighted components exactly. Final or submitted filename markers
  contribute only sixteen percent before penalties.
- Backup, copy, temporary, known-successor, revived-branch, timeline-conflict, and isolated-file penalties are
  stored individually and shown to the user.
- `userConfirmationScore` is fixed at zero until the user-correction phase provides real confirmation data.
  No confirmation is inferred from clicks or UI state.
- Each family returns at most three candidates. Every candidate stores all score components, penalties, at
  least three evidence items, confidence language, and linked risk warnings.
- Candidates below 0.40 remain visible for investigation but are marked `recommended: false` and use the
  phrase "not recommended as an official candidate". They are not silently removed.
- The UI always displays the required disclaimer that final, approved, or submitted filename markers are
  weak evidence and cannot prove official status.

Ranking never changes files and does not claim that the top candidate is the confirmed official version.
