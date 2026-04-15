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

## 2. Session Start

Before any work, run `git status` and `git branch` and report both.
If either shows something unexpected (uncommitted changes, wrong branch,
files you didn't create), stop and report — do not proceed.

Then triage the task:

- **Trivial** (typo, comment, rename, formatting): proceed directly.
- **Standard** (one feature, ≲10 files, no schema or dep changes): produce
  the plan in Section 4 and wait for approval.
- **Significant** (>10 files, multiple domains, schema/dep changes,
  new architectural patterns): discuss the approach in chat *before*
  writing the plan or creating a branch.

When in doubt, treat the task as one tier larger than it looks.

---

## 3. Architecture

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

### Project Structure
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

## 4. Implementation Plan Format

For Standard and Significant tasks, produce this and wait for approval:

```
Branch: {type}/{scope}-{description}

Understanding: [2–3 sentences: what and why]

Files to create:
- path — [purpose]

Files to modify:
- path — [change and why]

Approach:
1. [step]
2. [step]

Blast radius:
- [what this could break outside the files above —
   consumers, schemas, types, tests, runtime behavior]

Tests:
- [behavior] in [path]

Risks / open questions:
- [anything that might require a decision mid-implementation]

Manual steps required:
- [migrations, env vars, dashboard changes, etc. — or "none"]
```

If a risk surfaces mid-implementation that wasn't in the plan, stop
and report. Do not make unilateral architectural decisions.

---

## 5. Git Protocol

**Invariant:** every branch is born from the tip of main and dies by
squash-merge into main. Branches never touch other branches. A merge
conflict means this rule was broken — stop and report, do not attempt
to resolve.

### Starting a branch
```
git checkout main && git pull origin main
git checkout -b {type}/{scope}-{description}
```

### Branch and commit format
- Branch: `{type}/{scope}-{description}` — kebab-case, descriptive.
- Commit messages within a branch are working notes; aim to be descriptive.
- PR title is the squash commit on main and **must** follow Conventional
  Commits: `{type}({scope}): {imperative description, ≤72 chars}`
- Types: `feat` `fix` `chore` `test` `docs` `refactor` `perf`

### Before every commit
Verify `git status` shows only intentional changes. No `.env`, no
build artifacts, no `node_modules`. Stage explicitly when in doubt.

### Pre-PR checklist
Run in order. Do not open the PR until all pass.
1. On the feature branch, not main
2. Working tree clean
3. Tests pass: `[test command]`
4. Types pass: `[typecheck command]`
5. Lint passes: `[lint command]` (warnings ok if pre-existing)
6. Build succeeds: `[build command]`
7. Push: `git push -u origin {branch}`

### Attribution
Commit messages, PR titles, and PR descriptions contain **no** AI
attribution, co-author tags, or agent signatures of any kind. The tools
used are not recorded in git history.

---

## 6. Testing

Tests are not optional. A PR without appropriate tests is not done.

| What you built | Required |
|---|---|
| Pure function / utility | Unit tests: happy path + edge cases |
| API endpoint / server action | Unit tests with mocked boundaries |
| Data transformation | Unit tests with realistic inputs |
| Bug fix | Regression test that would have caught the bug |
| Refactor | All pre-existing tests still pass |
| UI component (no logic) | None — note in PR |
| Wiring / config | None — verify manually, note in PR |

### Quality bar
Each test must:
- Test behavior, not implementation
- Have a sentence-shaped name: `"createNote returns error when unauthenticated"`
- Cover the unhappy path
- Use realistic inputs, not `"test"` / `1` / `true`

### Anti-patterns — stop if you find yourself doing any of these
- Mocking the thing under test
- Loosening an assertion to make a test pass
- Adding `skip` or `only` to commit
- Writing a test that passes against both the bug and the fix

### Mocking
Mock at the boundary (DB client, HTTP client), never deep inside.
Reset mocks between tests. Never make real network calls or write to
a real database in unit tests.

---

## 7. PR Protocol

One PR = one logical unit of work. Signs a PR is too large: touches
multiple domains, >~15 files changed, hard to write a single-sentence
title. If scope expands mid-implementation, stop and report — do not
expand unilaterally.

### PR description (required)
```markdown
## What
[2–3 sentences. Purpose understood in 30 seconds.]

## Changes
- `path` — [what changed and why]

## How to test
1. [specific step]
2. Verify: [observable outcome]

## Manual steps
- [ ] [migrations, env vars, etc. — or "None"]

## Test results
- All tests: X passing, 0 failing
- New tests: [list]

## Screenshots
[Required for UI changes. Delete if backend-only.]

## Out of scope
[What was intentionally not built and why.]

## Checklist
- [ ] Tests / types / lint / build all green
- [ ] No secrets or env vars in code
- [ ] `.env.example` updated if new env vars
- [ ] No debug statements committed
- [ ] PR title follows Conventional Commits
- [ ] No AI attribution in commits or metadata
- [ ] Schema changes have migrations (if applicable)
```

### After opening the PR
Post the URL, the description, and any manual steps. Then wait. Do not
start the next task until I confirm the merge.

---

## 8. Stop Conditions

Stop and surface — do not work around — when any of these occur:

- A test passes when you expected it to fail
- A type or lint error you don't understand
- `git status` shows files you didn't touch
- A file is much larger or differently structured than expected
- A dependency is in the project that you didn't know about
- The spec contradicts the code, or promises something that doesn't exist
- An approach can't meet a stated performance target
- You've tried two attempts at a blocker without progress
- You're about to silently do something adjacent to what was asked
  because the literal request seems impossible

When stopping, report: what you were trying, what happened, what the
options look like, what you'd recommend.

---

## 9. Hard Prohibitions

These are absolute. Stop and tell me before doing any of them.

**Git:** commit to main, manual `merge`/`rebase`, force-push, branch
from anything but main, AI attribution in commits.

**Code:** add a dependency without approval, change a dep version
without approval, read env vars outside the config layer, hard-delete
when soft-delete is policy, suppress a type/lint error without an
explanatory comment, leave debug statements committed, write comments
that describe *what* the code does (comments explain *why*).

**Scope:** build anything not in the current task, refactor unrelated
files, fix unrelated bugs without asking, introduce new architectural
patterns without approval.

**Process:** open a PR with failing checks, skip the PR template, mark
work done before merge is confirmed.

---

## 10. Definition of Done

Done means **all** of:
- Feature works as specified
- Tests written and passing; types, lint, build all green
- PR description complete with manual steps documented
- PR open, URL shared, reviewed, merged
- I have confirmed we're ready for the next task

Code written ≠ done. Tests passing ≠ done. PR opened ≠ done.
Merged and confirmed = done.
