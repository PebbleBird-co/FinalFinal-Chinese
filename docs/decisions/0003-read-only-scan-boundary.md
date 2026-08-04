# 0003: Require user-authorized capabilities for directory scans

- Status: Accepted
- Date: 2026-08-01

## Context

The renderer must not gain general filesystem access. A plain IPC method accepting any path would allow a
compromised renderer to request scans outside a directory the user selected.

## Decision

The main process maintains an in-memory registry of canonical directories authorized by a system directory
dialog or a real file dropped through Electron `webUtils`. Scan requests are accepted only for an exact
authorized root.

The scanner uses directory enumeration and file metadata calls only. It never follows symbolic links or
opens file contents. Individual metadata errors become warnings, while cancellation and configured limits
return structured scan statuses.
