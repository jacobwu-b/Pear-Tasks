# 0002 — Sync file: persisted handle, manual save, polling, write-through

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

Pear's data lives in IndexedDB, which an external Node process (the MCP server) cannot read. We need a shared on-disk file that both the browser app and the MCP server read and write, so Claude can see and act on the same task graph the user sees.

## Proposal

Pear lets the user connect a sync file once (default suggestion: `~/.pear/db.json`) using the File System Access API. The `FileSystemFileHandle` is persisted in a dedicated Dexie table so it survives page reloads. The feature ships in three layers:

1. **Manual save (M1):** a "Save to sync file" button writes the current database to the connected file as a v3 export envelope, atomically (`db.json.tmp` → rename), and bumps the in-envelope `version` counter.
2. **Poll-on-change reload (M2):** while the tab is visible, Pear polls the file's mtime every 3s. On external version bump, Pear replaces its Dexie tables in a single transaction and notifies Zustand. Writes Pear itself made are ignored via a session-ID tag.
3. **Debounced write-through (M2):** every CRUD function in `src/db/operations.ts` enqueues a sync write; writes coalesce on a 300ms debounce so bulk operations (template instantiation, import) produce one file write, not N.

If File System Access permission lapses (browser revoked on reload), the UI surfaces a clear re-grant prompt rather than failing silently.

## Out of scope

- Multi-user / multi-device sync.
- Conflict merging beyond last-writer-wins at the envelope level (handled by the MCP storage layer in spec 0003).
- Non-Chromium browsers (the Blob-download fallback already in `exportImport.ts` covers them).

## Acceptance criteria

- User can connect a sync file via a picker; the handle survives a page reload.
- "Save to sync file" writes a valid v3 envelope to the connected file and bumps `version`.
- A write atomic via `tmp` + rename: no partial files visible to other readers.
- With auto-sync enabled, every Dexie mutation triggers exactly one debounced write within 500ms.
- Bulk operations inside a single `transaction('rw', …)` produce exactly one sync write.
- External changes to the file are reflected in the Pear UI within 5s while the tab is visible.
- A write Pear made itself does not trigger a self-reload (no write-echo loop).
- If the browser revokes file permission, the next save prompts the user to re-grant.

## Open questions

- Default debounce of 300ms: confirm by feel during dogfooding; may tune up to 1s.
- Whether to expose poll interval as a setting (deferred; hard-coded at 3s for now).

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- ADR: `docs/decisions/0001-pear-mcp-sibling-package.md`
- Depends on: 0001-export-v3
