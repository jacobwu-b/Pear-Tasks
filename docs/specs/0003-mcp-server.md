# 0003 — pear-mcp server: stdio package, storage with lockfile and version CAS

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

Claude Code (and Claude Desktop) speak MCP. To give Claude programmatic access to Pear's task graph, we need a process that exposes MCP tools backed by the sync file from spec 0002. The process must be safe to run alongside the Pear browser tab — concurrent writes cannot corrupt the file or silently drop updates.

## Proposal

Create a sibling Node package at `../pear-mcp/` (next to `pear-tasks/`, not inside it). The package ships:

- An MCP stdio server using `@modelcontextprotocol/sdk`, registered in `~/.claude.json` via a documented snippet.
- A storage module that reads/writes the same v3 envelope Pear uses, with a lockfile (e.g., `proper-lockfile`) and top-level `version` CAS. The write path is: acquire lock → read → check expected `version` → mutate → write `tmp` → rename → release. On version mismatch, the server reads once more and replays the mutation if still semantically valid, otherwise returns a typed `CONFLICT` error.
- Shared types and graph utilities imported via relative path from the Pear repo: `../pear-tasks/src/types/index.ts` and `../pear-tasks/src/db/graph.ts`. Those two files are marked load-bearing for MCP via header comments.
- A `ping` smoke tool returning `{ ok: true, version }` to validate wiring before any real tools are added.

## Out of scope

- HTTP / SSE transport (stdio only for v1).
- Authentication (single-user local tool).
- Non-Pear data sources.

## Acceptance criteria

- `npm run build && node dist/index.js` starts a working MCP stdio server.
- `ping` tool round-trips through Claude Code.
- Storage writes are atomic: a crashed writer never leaves the file truncated.
- Concurrent-write stress test (two writers, 100 iterations each) leaves the file consistent, the `version` strictly monotonic, and no updates lost (each writer's intended mutations are present).
- A version-mismatch on write triggers exactly one re-read + replay; a second mismatch returns `CONFLICT` to the caller.
- README documents the `~/.claude.json` registration snippet and the default sync-file path resolution.

## Open questions

None.

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- ADR: `docs/decisions/0001-pear-mcp-sibling-package.md`
- Depends on: 0001-export-v3
