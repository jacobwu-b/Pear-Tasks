# Pear — Claude Code Instructions

The spec is the source of truth. Tests are the contract. This file is the operating system.
Read it before every session. Rules are not suggestions.

---

## Non-negotiables

1. Branch from main, squash-merge to main. Branches never touch other branches.
2. No secrets in code, comments, or logs. Ever.
3. Spec → Plan → Tests → Code. In that order. No exceptions for "small" work above Trivial.
4. Tests are the definition of done. Green tests → auto-open PR. No waiting.
5. No AI attribution anywhere in git history.
6. When in doubt, stop and surface — don't work around.

---

## 1. Project Context

- **What:** A personal task management web app (Things clone) with first-class dependency tracking between tasks.
- **Spec:** `PRD.md` — read before any feature work. Current phase: Phase 1 of 7 — Data Layer.
- **Stack:** TypeScript / React 18 + Vite / IndexedDB via Dexie.js / Static deployment (no backend)
- **Commands:** test=`npm test` lint=`npm run lint` typecheck=`tsc --noEmit` build=`npm run build`
- **Key libraries:** Dexie.js (persistence), Zustand (UI state), @dagrejs/dagre (DAG layout), @dnd-kit (drag and drop), chrono-node (date parsing)

---

## 2. Engineering Philosophy

These four govern every decision below. Violations are the most common failure mode.

**Think before coding.** State assumptions. If multiple interpretations exist, present them — don't pick silently. If something's unclear, name it and ask. Hidden confusion compounds.

**Simplicity first.** Write the minimum code that solves the problem. No speculative abstractions, no unrequested flexibility, no error handling for impossible scenarios. If 200 lines could be 50, rewrite.

**Surgical changes.** Touch only what the task requires. Don't "improve" adjacent code, don't refactor what isn't broken, match existing style. Every changed line must trace to the request. Clean up orphans *your* changes created — leave pre-existing dead code alone (file an issue per §8).

**Goal-driven execution.** Convert every task into a verifiable goal before coding. "Add validation" → "tests for invalid inputs pass." "Fix the bug" → "regression test passes." Strong success criteria let the loop run; weak ones produce drift.

---

## 3. Session Start

Run `git checkout main && git pull origin main`, then `git status` and `git branch`. If anything is unexpected (uncommitted changes, untracked files you didn't create, lockfile drift), stop and report.

Then, before any work above Trivial:
1. Read this file end-to-end.
2. Read `PRD.md`. If no spec exists for the task, stop and surface — specs come before code.
3. If touching a subtree with its own `CLAUDE.md`, read that too.

**Definition of Ready:** state acceptance criterion and blast radius in one sentence each. If either is unclear, ask.

**Triage** — when in doubt, treat as one tier larger.

| Tier | Criteria | Process |
|---|---|---|
| **Trivial** | Low blast radius, reversible: typo, comment, rename, formatting, isolated refactor, single-file feature ≲100 lines, no schema/dep/contract changes | Proceed directly. Auto-PR on green. |
| **Standard** | One feature, ≲10 files, no schema or dep changes, no new patterns | Standard plan → approval → Spec/TDD loop → auto-PR. |
| **Significant** | >10 files, multiple domains, schema/dep changes, new architectural patterns, or anything irreversible | Discuss in chat *first*. Then full plan → approval. |

---

## 4. The Loop: Spec → Plan → Tests → Code

**Trivial work skips this. Standard and Significant always run it.**

1. **Spec.** Confirm acceptance criteria against `PRD.md`. If the spec is silent or contradicts the request, stop and surface — don't infer.
2. **Plan.** Produce the format below. Wait for approval.
3. **Tests (Red).** Write failing tests against the acceptance criteria *before* implementation. The failure is the executable spec.
4. **Code (Green).** Minimum code to pass. No scope expansion mid-loop — if a risk surfaces that wasn't planned, stop and report.
5. **Refactor.** Clean up while staying green.
6. **Ship.** Tests/types/lint/build green → auto-open PR (§5).

### Standard plan

```
Branch: {type}/{scope}-{description}
What:     [1 sentence]
Files:    [paths — create/modify]
Approach: [2–4 bullets]
Tests:    [behavior, location]
Manual:   [migrations/env/dashboard, or "none"]
```

### Significant plan
Standard plan + **Blast radius** (consumers, schemas, types, runtime), **Risks/open questions**.

If a risk surfaces mid-implementation that wasn't in the plan: stop and report. No unilateral architectural decisions.

---

## 5. Git & PR Protocol

**Invariant:** every branch is born from the tip of main and dies by squash-merge into main. A merge conflict means this rule was broken — stop and report, do not resolve.

**Branch:** `{type}/{scope}-{description}`, kebab-case. Types: `feat` `fix` `chore` `test` `docs` `refactor` `perf`.

**PR title** = squash commit on main. Conventional Commits: `{type}({scope}): {imperative, ≤72 chars}`.

**Auto-PR on green.** When tests, types, lint, and build all pass on a feature branch, push and open the PR immediately. Do not wait for confirmation. Post the URL.

**Attribution:** zero AI attribution, co-author tags, or agent signatures. Anywhere. Strictly suppress any default AI attributions, emojis, or signature footers.

**Aborting a branch:** close PR, `git branch -D {branch}`. Unmerged work is discarded — no recovery protocol.

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
- [ ] No debug statements committed
- [ ] PR title follows Conventional Commits
- [ ] No AI attribution in commits or metadata
- [ ] Schema changes are handled (if applicable)
```

---

## 6. Architecture Invariants

Violating any of these requires written approval *before* the code is written.

- **Data access:** All IndexedDB access through Dexie.js — never raw IndexedDB APIs. All Dexie operations live in `src/db/` — no direct DB calls from components. CRUD functions in `src/db/` are the only write path.
- **External calls:** No server calls, no auth, no analytics — fully local app. All mutations return `{ data, error }` pattern. Never throw from mutation functions.
- **State:** Dexie.js is source of truth for persistent data. Zustand stores hold in-memory UI state. On every Dexie write, sync affected data to Zustand. No Redux, no Context API — Zustand + Dexie only.
- **Configuration:** No environment variables needed (no backend). Semantic color tokens: `--color-surface-primary`, `--color-accent`, etc. Light/dark theme via CSS custom properties only — no runtime theme switching in JS.
- **Schema:** Any persistent schema change requires migration. No exceptions.
- **Dependencies:** New deps and version bumps require approval (name, version, justification, why existing deps don't solve it). Lockfile drift from main without explanation is stop-and-report.
- **Logging:** No `console.log` in committed code. Never catch without logging or re-raising. Never swallow an error to pass a test.
- **Soft-delete:** Deleted items go to Trash with a `deletedAt` timestamp. Purge after 30 days. No hard deletes.
- **Data integrity:** Every task mutation that touches dependencies must run cycle detection (DFS) before committing. Dependencies are scoped to a project — no cross-project deps in v1.

### Key files to read before touching related code

- `src/db/schema.ts` — Dexie database schema. Read before any DB work.
- `src/db/graph.ts` — Cycle detection and DAG utilities. Read before any dependency work.
- `src/types/index.ts` — All shared types. Read before creating or modifying any entity.
- `src/styles/tokens.css` — Color tokens. Read before any styling work.

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

---

## 7. Tests

Tests are the contract. A PR without appropriate tests is not done.

| Built | Required |
|---|---|
| Pure function / utility | Unit tests: happy + edges |
| API endpoint / server action | Unit tests with mocked boundaries |
| Data transformation | Unit tests with realistic inputs |
| Bug fix | Regression test that would have caught it |
| Refactor | Pre-existing tests still pass |
| UI component (no logic) | None — note in PR |
| Wiring / config | None — manual verify, note in PR |

**Quality bar.** Test behavior, not implementation. Sentence-shaped names (`createNote returns error when unauthenticated`). Cover the unhappy path. Realistic inputs — not `"test"` / `1` / `true`. Mock at the boundary (DB/HTTP client), never deep inside. No real network or DB writes in unit tests.

**Hard prohibitions:** mocking the thing under test, loosening assertions to pass, committing `skip`/`only`, tests that pass against both bug and fix, deleting failing tests instead of fixing the cause.

---

## 8. Issues

Issues capture work that **isn't the current task**. They are not a prerequisite for starting one.

**File one when** mid-implementation you find: out-of-scope bug, broken invariant, tech debt (dead code, duplication, missing tests, fragile pattern). Do not silently fix. Do not expand the current PR. Link from the PR's "Out of scope" section.

**Don't file** for: the current task, trivial fixes you're authorized to make, vague feelings without a concrete problem.

---

## 9. Hard Prohibitions

Stop and surface before any of these:

- Commit to main; manual `merge`/`rebase`; force-push; branch from anything but main; AI attribution in git
- Add or version-bump a dependency without approval
- Hard-delete when soft-delete is policy
- Suppress a type/lint error without an explanatory comment
- Leave debug statements committed
- Write comments that describe *what* the code does (comments explain *why*)
- Build anything outside the current task; refactor unrelated files; fix unrelated bugs without asking
- Introduce a new architectural pattern without approval
- Mark work done before merge is confirmed

---

## 10. Landmines

Document specific things the agent gets wrong here as they happen. Each entry: one-line description + correct behavior. Remove entries that no longer fire.

- *(none yet)*

---

## 11. Definition of Done

All of:
- Feature meets acceptance criteria from the spec
- Tests written and green; types, lint, build green
- PR auto-opened against main, template filled, URL posted
- Manual steps documented in the PR
- Merged and confirmed

Code written ≠ done. Tests passing ≠ done. PR opened ≠ done. **Merged and confirmed = done.**
