# 0005 — MCP write tools: create/update/complete tasks, add/remove dependencies

**Status:** Approved
**Owner:** jacob
**Created:** 2026-05-25

## Problem

For Claude to be a real collaborator on the task graph, it needs to write — create tasks, update fields, mark complete, and most importantly manage dependency edges with the same cycle-safety guarantee Pear's UI enforces.

## Proposal

Five write tools, all funneled through the CAS storage layer from spec 0003. Each returns the `{ data, error }` shape used in `src/db/operations.ts`.

- **`create_task`** — inputs: `title`, optional `projectId`, `areaId`, `when`, `deadline`, `notes`, `tags`. Respects soft-delete invariants (rejects creation under a trashed project/area). Returns the created task.
- **`update_task`** — patches a task by id; refuses unknown fields; returns the updated task.
- **`complete_task`** — sets `status: 'completed'` and `completedAt`; idempotent (no-op on already-completed tasks).
- **`add_dependency`** — creates a `DependencyEdge`. Calls `wouldCreateCycle` from `src/db/graph.ts` before commit; on rejection returns a typed `CYCLE` error including the offending path. Rejects cross-project edges per PRD invariant (no cross-project deps in v1).
- **`remove_dependency`** — deletes a `DependencyEdge` by id; idempotent.

All five surface storage-layer `CONFLICT` errors to the caller unchanged.

## Out of scope

- Bulk operations (deferred).
- Reordering (`sortOrder` writes are not exposed in v1).
- Template instantiation (deferred to a later spec).
- Trash purge / restore (UI-only in v1).

## Acceptance criteria

- `create_task` produces a record indistinguishable from one created via Pear's UI on the same inputs.
- `update_task` rejects unknown fields with a typed error rather than silently dropping them.
- `complete_task` is idempotent: calling twice produces no second write.
- `add_dependency` rejects any edge that would create a cycle, with the cycle path in the error payload.
- `add_dependency` rejects any edge whose endpoints are in different projects.
- `remove_dependency` is idempotent: removing a non-existent edge returns success with no write.
- All write tools surface storage `CONFLICT` errors to the caller.

## Open questions

- Whether to expose a single `set_dependencies(taskId, blockedBy[])` convenience for graph rewrites — deferred until the simpler tools prove insufficient.

## Related

- Plan: `docs/plans/plan-for-pear-mcp.md`
- Depends on: 0004-mcp-read-tools, 0003-mcp-server
