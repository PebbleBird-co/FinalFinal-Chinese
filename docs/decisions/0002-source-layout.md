# 0002: Separate frontend and backend source trees

- Status: Accepted
- Date: 2026-08-01

## Context

The initial Electron scaffold placed renderer code in `src/`, desktop runtime code in `electron/`, and tests
in a third top-level folder. Although conventional, this made the small project harder to scan.

## Decision

Application code is grouped by runtime boundary:

- `frontend/` owns the React renderer, styles, HTML entry, and renderer tests.
- `backend/` owns the Electron main process and preload security boundary.
- Root-level files are limited to shared build configuration, package metadata, and project documentation.

Empty test placeholders are not retained. Tests that protect implemented behavior stay beside their owning
runtime.
