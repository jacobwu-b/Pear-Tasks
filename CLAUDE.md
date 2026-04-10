# Pear — Claude Code Instructions

## 0. Before You Write Any Code
1. Read this entire file
2. Read PRD.md
3. State your understanding of the task back to me in 2-3 sentences
4. Propose a branch name and implementation plan
5. Wait for explicit approval before proceeding

---

## 1. Project Context
**What this is:** A personal task management web app (Things clone) with first-class dependency tracking between tasks.
**Spec file(s):** PRD.md
**Current phase / milestone:** Phase 1 of 7 — Data Layer
**Primary language:** TypeScript
**Runtime / framework:** React 18 + Vite
**Database / ORM:** IndexedDB via Dexie.js
**Auth:** None (local-only app)
**Hosting:** Static deployment (no backend)
**Key third-party services:** None — all data local. Key libraries: Dexie.js (persistence), Zustand (UI state), @dagrejs/dagre (DAG layout), @dnd-kit (drag and drop), chrono-node (date parsing)

---

## 2. Architecture Rules

### Data Access
- [x] All IndexedDB access goes through Dexie.js — never use raw IndexedDB APIs
- [x] All Dexie operations live in `src/db/` — no direct DB calls from components
- [x] CRUD functions in `src/db/` are the only write path to the database

### API / External Calls
- [x] No server calls, no auth, no analytics — fully local app
- [x] All mutations return `{ data, error }` pattern. Never throw from mutation functions.

### State Management
- [x] Dexie.js is the source of truth for persistent data
- [x] Zustand stores hold in-memory UI state (selected view, selected task, sidebar state, link mode, etc.)
- [x] On every Dexie write, sync the affected data to Zustand so React re-renders
- [x] No Redux, no Context API for state. Zustand + Dexie only.

### Configuration
- [x] Semantic color tokens from the start: `--color-surface-primary`, `--color-accent`, etc.
- [x] Light/dark theme via CSS custom properties — no runtime theme switching logic in JS
- [x] No environment variables needed (no backend)

### Data Integrity
- [x] Soft deletes only. Deleted items go to Trash with a `deletedAt` timestamp. Purge after 30 days.
- [x] Every task mutation that touches dependencies must run cycle detection (DFS) before committing
- [x] Dependencies are scoped to a project — no cross-project deps in v1

---

## 3. Project Structure
```
pear-tasks/
├── index.html                ← Vite entry point
├── vite.config.ts            ← Vite configuration
├── tailwind.config.ts        ← Tailwind with semantic color tokens
├── tsconfig.json             ← TypeScript config
├── package.json
├── src/
│   ├── main.tsx              ← React entry, mounts <App />
│   ├── App.tsx               ← Root component, layout shell
│   ├── db/
│   │   ├── schema.ts         ← Dexie database definition, table schemas
│   │   ├── operations.ts     ← CRUD functions for all entities
│   │   ├── graph.ts          ← Cycle detection, topological sort, DAG utilities
│   │   └── templates.ts      ← Built-in and custom template definitions
│   ├── store/
│   │   ├── taskStore.ts      ← Zustand store for task/project/area data
│   │   └── uiStore.ts        ← Zustand store for UI state (selection, view, sidebar)
│   ├── components/
│   │   ├── layout/           ← Sidebar, three-column shell, responsive wrappers
│   │   ├── tasks/            ← Task list, task row, task detail panel
│   │   ├── projects/         ← Project list, project header, graph view
│   │   ├── dependencies/     ← Dependency picker, link mode, dep chips
│   │   ├── templates/        ← Template picker, save-as-template dialog
│   │   └── common/           ← Shared UI primitives (buttons, inputs, modals, badges)
│   ├── hooks/                ← Custom React hooks
│   ├── lib/
│   │   ├── dates.ts          ← chrono-node date parsing helpers
│   │   ├── search.ts         ← Full-text search over titles/notes
│   │   └── keyboard.ts       ← Keyboard shortcut registration
│   ├── types/
│   │   └── index.ts          ← Shared TypeScript types and enums
│   └── styles/
│       └── tokens.css        ← CSS custom properties for light/dark themes
├── tests/
│   ├── db/                   ← Unit tests for CRUD, cycle detection, graph utils
│   ├── store/                ← Store sync tests
│   └── components/           ← Component tests
└── public/                   ← Static assets (favicon, etc.)
```

**Key files Claude must read before touching related code:**
- `src/db/schema.ts` — Dexie database schema. Read before any DB work.
- `src/db/graph.ts` — Cycle detection and DAG utilities. Read before any dependency work.
- `src/types/index.ts` — All shared types. Read before creating or modifying any entity.
- `src/styles/tokens.css` — Color tokens. Read before any styling work.

---

## 4. Git Workflow

### Mandatory Branch Creation Sequence

Every branch starts from the tip of main. Every branch merges back
into main. No branch ever starts from another branch. No exceptions.
Before creating any branch, you must run these three commands
in exactly this order:

```bash
git checkout main
git pull origin main
git checkout -b {type}/{scope}-{description}
```

### Rules
1. **Never commit directly to `main` or `master`.** No exceptions.
2. **One branch per logical feature or fix.**
3. **Confirm branch name with me before starting any work.**
4. **Run tests before marking work complete.**
5. **Prepare a PR description before asking me to review.**

### Branch Naming
```
{type}/{scope}-{short-description}

Types:  feat | fix | chore | test | docs | refactor | perf | spike
Scope:  db | store | ui | deps | graph | templates | infra

Examples:
  feat/db-schema-and-crud
  feat/ui-navigation-shell
  feat/deps-cycle-detection
  feat/graph-dag-visualization
  feat/templates-built-in-templates
  chore/infra-vite-tailwind-setup
```

### Commit Messages
Follow Conventional Commits:
```
{type}({scope}): {imperative present-tense description}

[optional body: what and why, not how — wrap at 72 chars]

[optional footer: BREAKING CHANGE: ..., Closes #123]
```

**Examples:**
```
feat(db): add Dexie schema for areas, projects, tasks, and deps

Defines IndexedDB tables and indexes for the full data model
per PRD §2. Includes checklist items and dependency edges.
```
```
feat(deps): implement cycle detection with DFS

Adjacency-list-based DFS that rejects mutations creating cycles.
All dependency writes must pass through this check.
```
```
feat(ui): add three-column layout shell with sidebar

Sidebar with smart lists and collapsible area/project tree.
Center column filters based on sidebar selection.
```

### Commit hygiene within a branch

Within a feature branch, commit often. These commits are
working notes — they do not need to be clean or meaningful.
They will be squashed on merge.

What matters:
- The PR title (becomes the squash commit on main)
- The PR description (becomes the squash commit body)

The PR title must follow Conventional Commits format.
Claude is responsible for generating a correct PR title
and complete PR description before asking for review.

---

## 5. Testing Requirements

### What to test
| Code type | Test type | Notes |
|---|---|---|
| Cycle detection, topological sort, DAG utils | Unit | Pure functions, no I/O |
| CRUD operations in `src/db/operations.ts` | Unit with fake-indexeddb | Use `fake-indexeddb` for Dexie in tests |
| Zustand store sync | Unit | Verify Dexie writes sync to Zustand |
| Component rendering and interaction | Component tests | Vitest + Testing Library |

### Test file conventions
```
src/db/graph.ts
tests/db/graph.test.ts    ← Mirror structure in /tests directory
```

### Running tests
```bash
npx vitest run              # run all tests
npx vitest run tests/db     # run tests in a directory
npx vitest --coverage       # run with coverage
```

### Coverage expectations
- New features: tests required before PR is ready
- Bug fixes: regression test required
- Refactors: existing tests must continue passing
- Untestable code: comment explaining why, get explicit approval

---

## 6. PR Description Template
```markdown
## What
[2-3 sentences: what changed and why. A new engineer should understand in 30 seconds.]

## Changes
- `path/to/file.ts` — [what changed and why]
- `path/to/other.ts` — [what changed and why]

## How to Test
1. [Step]
2. [Step]
3. Verify: [exact expected outcome]

## Test Coverage
- [ ] [Test file]: [what scenarios are covered]
- [ ] All existing tests pass: `npx vitest run`

## Screenshots / recordings
<!-- Required for any UI change. Delete section if backend-only. -->

## Notes & Follow-up
<!-- Intentional omissions, known edge cases, v2 candidates -->

## Checklist
- [ ] Tests written and passing
- [ ] No secrets or API keys in code
- [ ] All DB access goes through src/db/ — no direct Dexie calls in components
- [ ] All mutations return { data, error }
- [ ] Soft deletes only — deletedAt timestamp, never hard-delete
- [ ] Dependency mutations run cycle detection before committing
- [ ] No console.log / debug statements in committed code
- [ ] PR title follows conventional commits format
```

---

## 7. What NOT to Do
- Do not add npm packages without confirming with me first
- Do not use component libraries (MUI, Ant Design, Chakra, shadcn) — Tailwind + hand-built components only
- Do not introduce a new pattern not already in the codebase without flagging it
- Do not leave `console.log` / debug statements in committed code
- Do not hard-code color values — use semantic CSS custom properties
- Do not write a comment explaining *what* the code does — write *why*
- Do not generate placeholder/lorem ipsum content in production code paths
- Do not ignore TypeScript / lint errors by suppressing them without explanation
- Do not use raw IndexedDB APIs — all persistence through Dexie.js
- Do not make direct Dexie calls from React components — go through `src/db/` functions
- Do not allow dependency mutations without cycle detection
- Do not hard-delete — soft delete to Trash with `deletedAt`

---

## 8. Definition of Done
A task is complete when:
- [ ] Feature works as described in PRD.md
- [ ] Tests written and passing locally (`npx vitest run`)
- [ ] PR description filled out completely
- [ ] No new lint errors introduced
- [ ] No new TypeScript errors
- [ ] I have reviewed and approved the PR
