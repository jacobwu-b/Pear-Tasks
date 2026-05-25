# Plan — Pear ↔ Claude MCP Integration

## Context

Pear is a personal task manager with first-class dependency tracking, intended for solo use with Claude as a thinking partner. Today Claude has no programmatic access to Pear's state; the user is choosing between adopting Linear (which has an existing MCP) and building a connector to Pear so the dependency graph stays the source of truth.

Exploration confirmed:

- `src/db/exportImport.ts` already serializes/restores all 6 Dexie tables to a versioned JSON envelope, with a UI in `src/components/common/DataManagement.tsx`. It currently uses Blob download + FileReader upload — *not* the File System Access API.
- `src/db/graph.ts` is already framework-free (no React/Zustand/Dexie imports) — directly importable from a Node process.
- No MCP server, sidecar, or monorepo scaffolding exists yet.
- **Latent bug:** Dexie schema is at v3 (recurrence added), but `exportImport.ts` validator only accepts v2. Any MCP read of recurring tasks needs this fixed.

The chosen architecture (per the prior chat):

- **Sibling folder** `pear-mcp/` next to `pear-tasks/`, sharing types and `graph.ts` via relative path import. No monorepo refactor.
- **File bridge** at a user-chosen path (default `~/.pear/db.json`); Pear writes through on mutations and polls for external change; MCP server reads/writes the same file with a lockfile + top-level `version` counter (CAS, one retry).
- **Tracer-bullet milestone 1**: read-only MCP + a manual "Save to sync file" button in Pear. No write-conflict surface until M2.
- **Export format bumped to v3** to include recurrence, fixing the validator bug.

This is **Significant tier** (new sibling package, new architectural surface for file sync, ≳10 files across two packages). It requires an ADR plus a materialized plan in `docs/plans/` after approval.

---

## Spec list

| # | Slug | Summary |
|---|---|---|
| 0001 | `export-v3` | Bump JSON export envelope to v3, including recurrence fields; accept v2 with in-memory migration. |
| 0002 | `sync-file` | Persisted File System Access handle, manual save (M1), poll-on-change reload (M2), debounced write-through (M2). |
| 0003 | `mcp-server` | Sibling `pear-mcp/` Node package: stdio MCP server, JSON storage layer with lockfile + version CAS. |
| 0004 | `mcp-read-tools` | Read tools: `list_tasks`, `get_task`, `list_projects`, `get_project_graph`. |
| 0005 | `mcp-write-tools` | Write tools: `create_task`, `update_task`, `complete_task`, `add_dependency`, `remove_dependency`; cycle detection via shared `graph.ts`. |
| 0006 | `claude-skill` | `pear-tasks` Claude Code skill teaching trigger phrases, conventions, and tool surface. |

---

## Milestones

### M1 — Tracer slice: read-only MCP over manual save
Demonstrable: user clicks **Save to sync file** in Pear; Claude (via MCP) lists tasks, fetches one, prints the project graph.

### M2 — Bi-directional with conflict safety
Demonstrable: Claude creates a task and adds a checklist; Pear's UI reflects it within a few seconds without manual reload. User edits a task in Pear; Claude sees the update on next tool call. Version-CAS rejects stale writes.

### M3 — Dependency-aware writes + skill polish
Demonstrable: Claude proposes a dependency edge; server rejects cycles, accepts valid ones. Skill triggers on natural phrases ("add this to Pear", "what's blocked", project codenames).

---

## Units

### M1 units

**1.1 `feat(db): bump export format to v3 with recurrence`**
- Spec: `0001-export-v3`
- Tier: Standard
- Files: `src/db/exportImport.ts`, `tests/db/exportImport.test.ts`
- Dependencies: none
- Size: S
- Acceptance:
  - Export writes `version: 3` and includes `recurrence` / `recurringParentId` on tasks.
  - Import accepts both v2 (with in-memory upgrade) and v3; rejects v1 and unknown.
  - Round-trip preserves all recurrence fields.
- Risks: existing v2 backup files in user storage — must not break import.
- Complexity: `complexity:haiku`

**1.2 `feat(sync): persisted file handle and manual save`**
- Spec: `0002-sync-file`
- Tier: Standard
- Files: `src/db/syncFile.ts` (new), `src/components/common/DataManagement.tsx`, `src/store/uiStore.ts` (sync state slice), `tests/db/syncFile.test.ts`
- Dependencies: 1.1
- Size: M
- Acceptance:
  - "Connect sync file" picker stores `FileSystemFileHandle` in a dedicated Dexie table (browser policy permits this).
  - "Save to sync file" writes the full v3 envelope atomically (`db.json.tmp` → rename) and bumps the in-envelope `version` counter.
  - Handle survives page reload; if permission lapses, UI re-prompts on next save.
- Risks: Chromium-only API; needs visible "permission lost" path. Permission re-grant UX.
- Complexity: default (Sonnet)

**1.3 `chore(mcp): scaffold pear-mcp package`**
- Spec: `0003-mcp-server`
- Tier: Standard
- Files: `../pear-mcp/package.json`, `tsconfig.json`, `src/index.ts`, `src/storage.ts` (read-only stub), `README.md`
- Dependencies: 1.1 (envelope shape stable)
- Size: S
- Acceptance:
  - `npm run build && node dist/index.js` starts a stdio MCP server.
  - One `ping` tool returns `{ ok: true, version }`.
  - README documents the `claude_desktop_config.json` / `~/.claude.json` snippet and the sync-file path resolution.
- Risks: relative-path imports into the Pear repo couple builds. Mitigation: import only `src/types/index.ts` and `src/db/graph.ts`; flag both as load-bearing in their files' header comments.
- Complexity: `complexity:haiku`

**1.4 `feat(mcp): read-only tools`**
- Spec: `0004-mcp-read-tools`
- Tier: Standard
- Files: `pear-mcp/src/tools/{listTasks,getTask,listProjects,getProjectGraph}.ts`, `pear-mcp/src/index.ts`, `pear-mcp/test/tools.test.ts`
- Dependencies: 1.3
- Size: M
- Acceptance:
  - Each tool has a Zod input schema and returns Zod-validated output.
  - `list_tasks` supports filters: project, area, status (open/completed/trashed), view (Today/Inbox/Anytime/etc.).
  - `get_project_graph` reuses `src/db/graph.ts` (`buildAdjacencyList`, `topologicalSort`, `getBlockedTaskIds`) — not reimplemented.
  - Soft-deleted records hidden by default; `includeTrashed` opt-in.
- Risks: drift between Dexie view semantics in `taskStore.ts` and MCP filter semantics.
- Complexity: default

---

### M2 units

**2.1 `feat(mcp): atomic write with version CAS and lockfile`**
- Spec: `0003-mcp-server`
- Tier: Standard
- Files: `pear-mcp/src/storage.ts`, `pear-mcp/test/storage.test.ts`
- Dependencies: 1.4
- Size: M
- Acceptance:
  - Write path: acquire `db.json.lock` (proper-lockfile or equivalent) → read → check expected `version` → mutate → write `tmp` → rename → release.
  - On version mismatch: re-read once, replay mutation if still semantically valid, else return a typed `CONFLICT` error.
  - Concurrent-write test (two writers, 100 iterations) leaves the file consistent and the version monotonic.
- Risks: lock starvation if Pear's debounced writer is chatty. Mitigate with a max-hold timeout.
- Complexity: `complexity:opus`

**2.2 `feat(sync): poll sync file and reload into Dexie`**
- Spec: `0002-sync-file`
- Tier: Standard
- Files: `src/db/syncFile.ts`, `src/store/taskStore.ts` (rehydrate hook)
- Dependencies: 2.1
- Size: M
- Acceptance:
  - Poll mtime every 3s while tab is visible (Page Visibility API gates the loop).
  - On external version bump, atomically replace Dexie tables in a transaction and notify Zustand.
  - If the local in-memory `version` is ahead of the file, do nothing (we're the source).
- Risks: write-then-poll loop (we write, file changes, we reload our own write). Solve by tagging writes with our session ID and ignoring echoes.
- Complexity: default

**2.3 `feat(sync): debounced write-through on every mutation`**
- Spec: `0002-sync-file`
- Tier: Standard
- Files: `src/db/operations.ts` (post-mutation hook), `src/db/syncFile.ts`
- Dependencies: 2.2
- Size: M
- Acceptance:
  - Every CRUD function in `operations.ts` enqueues a sync write; coalesced with 300ms debounce.
  - Each flush bumps `version` and writes atomically.
  - Failure surfaces a UI toast and retries with exponential backoff up to 3 attempts.
- Risks: write storms during bulk operations (template instantiation, import). Use a single write at the end of any Dexie `transaction('rw', …)` block.
- Complexity: default

**2.4 `feat(mcp): task write tools`**
- Spec: `0005-mcp-write-tools`
- Tier: Standard
- Files: `pear-mcp/src/tools/{createTask,updateTask,completeTask}.ts`, tests
- Dependencies: 2.1
- Size: M
- Acceptance:
  - `create_task` accepts `{ title, projectId?, areaId?, when?, deadline?, notes?, tags? }`; respects soft-delete invariants.
  - `update_task` patches by id; refuses unknown fields.
  - `complete_task` sets `status: 'completed'` and `completedAt`; idempotent.
  - All three go through the CAS storage layer; conflict surfaces as a typed error to Claude.
- Risks: divergence from `src/db/operations.ts` semantics. Mitigate by porting the same shape — same `{ data, error }` discipline.
- Complexity: default

---

### M3 units

**3.1 `feat(mcp): dependency tools with cycle detection`**
- Spec: `0005-mcp-write-tools`
- Tier: Standard
- Files: `pear-mcp/src/tools/{addDependency,removeDependency}.ts`, tests
- Dependencies: 2.4
- Size: S
- Acceptance:
  - `add_dependency` calls `wouldCreateCycle` (from shared `graph.ts`) before commit; rejects with `CYCLE` error including the offending path.
  - Cross-project edges rejected per PRD/CLAUDE.md ("no cross-project deps in v1").
  - `remove_dependency` idempotent.
- Risks: shared-graph drift if Pear edits `graph.ts` signature. Add a contract test in `pear-mcp` that imports and exercises it.
- Complexity: default

**3.2 `docs(skill): pear-tasks Claude Code skill`**
- Spec: `0006-claude-skill`
- Tier: Trivial-bordering-Standard; kept as its own unit because it's the user-facing entrypoint.
- Files: `pear-mcp/skills/pear-tasks.md` (also documented for install to `~/.claude/skills/`)
- Dependencies: 3.1
- Size: XS
- Acceptance:
  - Skill description triggers on: "pear", "my tasks", "what's blocked", project codenames listed in user's memory.
  - Documents the tool surface, the project-scoped-deps invariant, and the "ask before completing" convention.
  - Includes one worked example end-to-end (create task → add dependency → check graph).
- Risks: trigger phrase tuning may need iteration after dogfooding.
- Complexity: `complexity:haiku`

---

## Critical path

`1.1 → 1.3 → 1.4 → 2.1 → 2.4 → 3.1 → 3.2` (7 units, MCP-server line).

The Pear-side sync work (1.2 → 2.2 → 2.3) can proceed in parallel with the MCP line after 1.1 lands, joining only at each milestone's integration demo. 2.2 has a soft dependency on 2.1 for the version-CAS contract — best to land 2.1 first so the polling logic targets the final on-disk format.

## Parallelizable tracks

- **Track A — Pear sync UI:** 1.2 → 2.2 → 2.3
- **Track B — MCP server:** 1.3 → 1.4 → 2.1 → 2.4 → 3.1
- **Track C — Skill + docs:** 3.2 (last, depends on the full surface)

## Totals

- **10 units** (within the 10–25 cap).
- **6 specs.**
- **1 ADR required** (Significant tier): `docs/decisions/0001-pear-mcp-sibling-package.md`, covering the sibling-folder choice, file-bridge sync, and version-CAS conflict policy.

## Top risks

1. **File System Access API permission lifecycle.** Browsers can revoke handle permission on reload; the UX for re-granting must be obvious or sync silently fails. Surfaces in 1.2 and 2.2.
2. **Write echo loops** between Pear's debounced write-through (2.3) and its own external-change poll (2.2). The session-ID tag mitigation is unproven until both land.
3. **Build-time coupling** of `pear-mcp` to Pear's `src/types` and `src/db/graph.ts` via relative path. A future Pear file move silently breaks MCP. Mitigation: pin the imported surface to `graph.ts` + `types/index.ts` only, with header comments in both files marking them as load-bearing for MCP.

---

## Verification

End-to-end, after M1:
- In Pear: connect a sync file at `~/.pear/db.json`, click Save, confirm file exists with `version: 3` envelope.
- Configure `pear-mcp` in `~/.claude.json` pointing at the same file.
- In Claude Code: ask "list my open Pear tasks" → tool call → output matches Pear's UI.

After M2:
- In Claude Code: "create a task called X in project Y" → check Pear UI reloads it within 5s.
- In Pear: rename the task → check Claude's next read sees the new title.
- Force a conflict by editing both within 1s; observe a typed `CONFLICT` error and a clean retry.

After M3:
- Ask Claude: "make task A block task B" → succeeds.
- Ask Claude to make B block A → server rejects with `CYCLE` and reports the path.
- Invoke the skill via natural phrase; confirm it picks the right tools.

Tests across both packages (vitest in Pear, vitest in `pear-mcp`) must all pass; typecheck, lint, and build green in both; manual steps documented in each PR.
