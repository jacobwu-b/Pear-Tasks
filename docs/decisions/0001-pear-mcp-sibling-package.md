# 0001 — pear-mcp as sibling package over file-bridge with version-CAS

**Status:** Accepted
**Date:** 2026-05-25
**Deciders:** jacob

## Context

Pear's data lives in IndexedDB inside a browser tab. Claude, via MCP, runs as a Node process. There is no shared substrate by default. We have to choose three things at once:

1. **Where the MCP code lives.** Inside Pear, as a sibling repo, or via a full monorepo refactor.
2. **How the two processes share state.** A file on disk, a local HTTP sidecar, or a full backend.
3. **How concurrent writes are made safe.** Lockfile only, version-CAS, or a per-record CRDT-style merge.

Pear is a personal, local-only app (`CLAUDE.md` §1: "No server calls, no auth, no analytics — fully local"). The user is solo. Adding any networked service violates the project's stated architecture.

## Decision

1. **Sibling folder.** `pear-mcp/` lives next to `pear-tasks/`. It imports `src/types/index.ts` and `src/db/graph.ts` from the Pear repo via relative path. Pear's build tooling is unchanged.
2. **File bridge.** Both processes read and write a single v3 export envelope at a user-chosen path (default `~/.pear/db.json`). Pear uses the File System Access API for handle persistence; the MCP server uses Node `fs`.
3. **Version-CAS with lockfile.** Each envelope carries a top-level `version` counter. Every writer acquires a lockfile, reads, checks expected `version`, mutates, writes `tmp`, renames, releases. On mismatch, one re-read and replay; second mismatch returns `CONFLICT`.

## Alternatives considered

- **pnpm monorepo (apps/web + packages/mcp + packages/shared).** Cleanest long-term, but a full restructure of an already-working app for a feature that ships fine without it. Tooling churn dwarfs the benefit at one-user scale. Rejected for now; reconsider if a second consumer of the shared code appears.
- **Subfolder inside Pear repo with its own `package.json`.** Couples the repos in git without separating build artifacts cleanly. The Pear `tsc -b` would have to learn about the subpackage. More moving parts than the sibling option for no visible gain.
- **Local HTTP sidecar over SQLite.** Solves the IndexedDB visibility problem more elegantly than a file, but introduces a long-running service Pear's PRD specifically excludes ("No server calls … fully local"). Big phase-shift, not a feature.
- **Lockfile only, no version counter.** Cheaper, but a stale-read race exists when Pear's poll cycle lags. The CAS counter is a few lines of code and removes the race entirely.
- **Per-record `updatedAt` with field-level merge.** True CRDT-ish merging. Overkill for one user on one machine; the implementation cost is real and the benefit is nil at this scale.

## Consequences

**Easier:**
- Zero changes to Pear's build, dep graph, or repo layout.
- The MCP server is a tiny independent unit; can be rewritten or replaced without touching Pear.
- The same v3 file format powers user-visible export/import *and* the MCP bridge — one source of truth, one test surface.

**Harder:**
- Pear must own browser-side complexity (handle persistence, polling, debouncing, echo suppression).
- Build-time coupling of `pear-mcp` to two specific Pear files (`graph.ts`, `types/index.ts`). A future Pear file move silently breaks MCP unless caught by tests. Mitigation: pin the imported surface, mark both files load-bearing via header comments, and run an MCP contract test against the real graph utilities.
- The browser tab must be open for Pear to react to MCP writes. Closed tab = stale UI until reopened. Acceptable for a daily-driver app.

**Committed maintenance:**
- The v3 envelope schema is now an inter-process contract, not just a backup format. Any future schema change must bump the envelope and migrate.
- Lockfile semantics (max hold time, retry policy) must be documented in `pear-mcp/README.md` so future contributors do not lower the safety bar.

## Related

- Spec(s): `docs/specs/0001-export-v3.md`, `docs/specs/0002-sync-file.md`, `docs/specs/0003-mcp-server.md`, `docs/specs/0004-mcp-read-tools.md`, `docs/specs/0005-mcp-write-tools.md`, `docs/specs/0006-claude-skill.md`
- Plan: `docs/plans/plan-for-pear-mcp.md`
