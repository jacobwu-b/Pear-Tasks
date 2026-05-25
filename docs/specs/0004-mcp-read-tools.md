# 0004 — MCP read tools: list_tasks, get_task, list_projects, get_project_graph

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

Before Claude can mutate the task graph, it needs to read it. The reads must mirror the views Pear's UI exposes — Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash — so conversations with Claude line up with what the user sees on screen.

## Proposal

Four read-only MCP tools, each with a Zod-validated input and output:

- **`list_tasks`** — filters by `projectId`, `areaId`, `status` (open/completed/trashed), and `view` matching the sidebar views in `src/store/taskStore.ts`. Soft-deleted records hidden unless `includeTrashed: true`.
- **`get_task`** — fetches one task by id, including checklist items and outgoing/incoming dependency edges.
- **`list_projects`** — filtered by `areaId`, `status`, and `includeTrashed`.
- **`get_project_graph`** — for a given project, returns nodes (tasks), edges (dependencies), the topological sort, and the set of currently blocked task ids. Reuses `buildAdjacencyList`, `topologicalSort`, and `getBlockedTaskIds` from `src/db/graph.ts` — not reimplemented.

Each call re-reads the sync file fresh (no in-memory cache in v1).

## Out of scope

- Full-text search (deferred; planned via `src/lib/search.ts` in a later spec).
- Tool-side pagination (the dataset is small for personal use).
- Streaming output.

## Acceptance criteria

- Each tool has a Zod schema for both input and output; invalid inputs are rejected before disk read.
- `list_tasks` view filters produce the same task sets as Pear's UI for the same data.
- `get_project_graph` results match `graph.ts` outputs exactly on identical inputs (contract test).
- Soft-deleted records are hidden by default and surfaced only with `includeTrashed: true`.
- Each tool re-reads the file on every call (no stale-cache bugs).

## Open questions

- Whether `list_tasks` should support a `since` (updatedAt) filter — deferred until a real workflow demands it.

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- Depends on: 0003-mcp-server
