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

## 4. Implementation Planning Protocol

For every task, before writing code, produce a plan in this format
and wait for my approval:

```
Branch: feat/scope-short-description

Understanding: [2-3 sentences stating what I'm building and why]

Files to create:
- path/to/new/file.ts — [what it does]

Files to modify:
- path/to/existing/file.ts — [what changes and why]

Approach:
1. [Step]
2. [Step]
3. [Step]

Tests I will write:
- [test description] in [test file path]
- [test description] in [test file path]

Risks / things I'm unsure about:
- [anything that might require a decision mid-implementation]

External steps required (Supabase, Vercel, etc.):
- [anything I need to do manually]
```

If there are risks or uncertainties, surface them in the plan —
not mid-implementation. Mid-implementation surprises should be
rare. If one occurs, stop and report it rather than making a
unilateral decision.

---

## 5. Git Protocol

This section is a strict protocol, not a set of guidelines.
Every step is required. Order matters.

### 5.1 The Fundamental Invariant

Every branch is born from the tip of main.
Every branch dies by merging into main.
No branch ever touches another branch.

In a sequential single-developer workflow with squash merges,
merge conflicts are impossible if this invariant holds.
A merge conflict means this rule was broken.
If you encounter one, stop and report it. Do not attempt to
resolve it. See Section 5.6.

### 5.2 Starting a New Branch (Required Sequence)

Run these commands in this exact order, every time, with no
exceptions:

```bash
git checkout main
git pull origin main
git log --oneline -3        # Confirm you are on the right commit
git checkout -b {type}/{scope}-{description}
```

After running these commands, report to me:
- The new branch name
- The output of `git log --oneline -3`

Wait for my confirmation before writing any code.

### 5.3 Commit Protocol

Within a feature branch, commit regularly. These are working
notes and do not need to be clean. They will be squashed on merge.

```bash
# Check what changed before staging
git diff

# Stage intentionally — never use `git add .` blindly
git add path/to/file path/to/other/file

# Or, if all changes are intentional:
git add .

# Commit with a working note message
git commit -m "brief description of what this checkpoint does"
```

Before any commit, verify:
- `git status` shows only intentional changes
- No `.env`, `.env.local`, or secret files are staged
- No `node_modules`, `__pycache__`, build artifacts are staged

If `git status` shows unexpected files, stop and report before
committing.

### 5.4 Pre-PR Checklist (Run Before Opening Any PR)

Run every item in order. Do not open the PR until all pass.

```bash
# 1. Ensure you are on the feature branch, not main
git branch

# 2. Ensure all changes are committed
git status
# Expected: "nothing to commit, working tree clean"

# 3. Run the full test suite
[test command]
# Expected: all tests pass, no skipped tests without explanation

# 4. Run the type checker
[typecheck command]
# Expected: zero errors

# 5. Run the linter
[lint command]
# Expected: zero errors (warnings are acceptable if pre-existing)

# 6. Run the build
[build command]
# Expected: successful build, no new warnings

# 7. Push the branch
git push -u origin {branch-name}
```

If any step fails, fix it before proceeding. Do not open a PR
with failing tests, type errors, or lint errors.

### 5.5 Commit Message Format

Individual commits within a branch are working notes and can be
informal. However, the PR title — which becomes the squash commit
on main — must follow Conventional Commits precisely:

```
{type}({scope}): {imperative present-tense description under 72 chars}
```

Types: `feat` | `fix` | `chore` | `test` | `docs` | `refactor` | `perf`

Scopes: [list your project's domain areas, e.g. `auth` | `notes` | `editor`]

**Good PR titles:**
```
feat(auth): add email sign up and sign in with Supabase
fix(editor): prevent auto-save race condition on rapid note switching
chore(deps): upgrade Tiptap to v2.4.0
test(notes): add coverage for createNote and deleteNote actions
```

**Bad PR titles (will be rejected):**
```
updates                         ← not descriptive
fix bug                         ← which bug
feat: added some stuff          ← not imperative, not scoped
WIP: auth                       ← WIP never merges
```

### 5.6 If You Encounter a Merge Conflict

Stop immediately. Do not attempt to resolve it.

Report:
1. Current branch: `git branch`
2. Recent history: `git log --oneline -5`
3. Status: `git status`
4. The exact conflict message

Wait for my instructions. The resolution will be to recreate the
branch from main, not to resolve the conflict in place.

Recovery sequence (only run after I confirm):
```bash
git stash
git checkout main
git pull origin main
git checkout -b {same-name}-v2
git stash pop
git status    # verify clean application of stashed work
git log --oneline -3    # verify correct base
```

### 5.7 Commit Attribution

Commit messages, PR titles, and PR descriptions must contain no
AI attribution, co-author tags, or agent signatures of any kind.

The following pattern is strictly forbidden in any commit or PR
metadata, in any casing or variation:

```
Co-Authored-By: Claude
Signed-off-by: Claude
Generated by: Claude
```

Commits are authored by the developer. The tools used are not
recorded in git history.

### 5.8 Branch Naming

```
{type}/{scope}-{short-description}

# Correct
feat/auth-email-signup
fix/editor-autosave-race-condition
chore/upgrade-tiptap-v2
test/notes-action-coverage
refactor/extract-text-utility
docs/update-setup-instructions

# Wrong — will be rejected
feature-auth               ← wrong format
claude/random-name         ← never use claude/ prefix
fix                        ← not descriptive enough
my-branch                  ← not descriptive
```

---

## 6. Testing Protocol

Tests are not optional. A PR without appropriate tests is not done.

### 6.1 What Requires Tests

| What you built | Minimum required |
|---|---|
| Pure function or utility | Unit tests covering happy path + all edge cases |
| Server Action / API endpoint | Unit tests with mocked DB/externals |
| Data transformation logic | Unit tests with representative inputs |
| Bug fix | Regression test that would have caught the original bug |
| Refactor | All pre-existing tests must continue passing |
| UI component (no logic) | No test required — document in PR instead |
| Config / wiring / plumbing | No test required — verify manually and document |

### 6.2 Test Quality Bar

A test suite that passes but doesn't catch bugs is worse than no
test suite — it creates false confidence.

Each test must:
- Test behavior, not implementation (test what it does, not how)
- Have a descriptive name that reads as a sentence:
  `"createNote returns error when user is not authenticated"`
- Cover the unhappy path, not just the happy path
- Use realistic inputs, not `"test"`, `1`, `true` as placeholders

### 6.3 Test File Conventions

```
# Co-located with source (preferred)
src/app/actions/notes.ts
src/app/actions/notes.test.ts

src/lib/utils/extractText.ts
src/lib/utils/extractText.test.ts
```

### 6.4 Running Tests

```bash
[command: run all tests]
[command: run single file]
[command: run with coverage]
```

Tests must be run and must pass before any PR is opened.
Report the test output summary in the PR description.

### 6.5 Mocking Policy

- Never make real network calls in unit tests
- Never write to a real database in unit tests
- Mock at the boundary (the DB client, the HTTP client) —
  not deep inside the implementation
- Mocks must be reset between tests

---

## 7. PR Protocol

A PR is the unit of work. It must be complete, self-contained,
and reviewable without additional context.

### 7.1 PR Description (Required Template)

Generate this for every PR before asking me to review:

```markdown
## What
[2-3 sentences. What was built and why. A new engineer
understands the purpose in 30 seconds.]

## Changes
[Every file created or meaningfully modified]
- `path/to/file.ts` — [what changed and why]
- `path/to/file.ts` — [what changed and why]

## How to Test
[Numbered, specific steps. Include test credentials or
seed data if needed. I should be able to follow this
without asking you anything.]
1. [Step]
2. [Step]
3. Verify: [exact observable outcome]
4. Verify: [exact observable outcome]

## Manual Steps Required
[External actions I need to take before or after merging.
Be specific and ordered.]
- [ ] [e.g. "Run migration in Supabase SQL editor — SQL in supabase/migrations/001.sql"]
- [ ] [e.g. "Add RESEND_API_KEY to Vercel environment variables"]
- [ ] [e.g. "Enable Email auth in Supabase Dashboard → Auth → Providers"]
None (if nothing is required)

## Test Results
[Paste the actual test output or summary]
- All tests: X passing, 0 failing
- New tests added: [list them]

## Screenshots
[Required for any UI change. Delete if backend-only.]

## Deferred / Out of Scope
[What was intentionally not built, and why. V2 candidates
surfaced during this work.]

## Checklist
- [ ] All tests passing (`[test command]`)
- [ ] Type check passing (`[typecheck command]`)
- [ ] Lint passing (`[lint command]`)
- [ ] Build passing (`[build command]`)
- [ ] No secrets or env vars in code
- [ ] .env.example updated (if new env vars added)
- [ ] No console.log / debug statements committed
- [ ] PR title follows Conventional Commits format
- [ ] No AI attribution in commits or PR metadata
- [ ] [Project-specific rule 1]
- [ ] [Project-specific rule 2]
```

### 7.2 PR Scope Rules

One PR = one logical unit of work.

Signs a PR is too large:
- It touches more than one domain (auth AND notes AND editor)
- It has more than ~15 files changed
- It is hard to write a single-sentence PR title

If scope expands mid-implementation, stop. Report what was found.
We will decide together whether to split into two PRs or continue.
Do not expand scope unilaterally.

### 7.3 After the PR Is Opened

Your job after opening a PR:
1. Post the PR URL
2. Post the PR description (as written above)
3. List any manual steps I need to complete
4. Wait — do not start the next task

My job:
1. Complete any manual steps listed
2. Review the code
3. Merge (squash and merge) or request changes
4. The branch is deleted automatically after merge

Your job for the next task:
1. Start from Section 5.2 — pull from main and create a new branch

---

## 8. Handling Uncertainty and Scope Changes

### If you are unsure about an implementation decision

Stop and ask. Do not make a unilateral architectural decision.
Present the options and your recommendation. Wait for my call.

Format:
```
Decision needed: [what the decision is]
Option A: [description] — [tradeoffs]
Option B: [description] — [tradeoffs]
My recommendation: [A or B] because [reason]
```

### If the task turns out to be larger than planned

Stop when you realize this. Report:
- What was planned
- What the actual scope appears to be
- A revised plan

Do not just keep building. Scope creep is how PRs become
unreviweable and how bugs get introduced.

### If something is already broken that you didn't break

Report it before fixing it. Do not silently fix unrelated bugs
while implementing a feature. If it is clearly a one-line fix,
ask me if I want it in this PR or a separate fix branch.

### If you hit a technical blocker

Report the blocker clearly:
- What you were trying to do
- What you tried
- What happened
- What you think the options are

Do not spin on a blocker for more than two attempts.
Surface it.

---

## 9. What Never To Do

These are hard stops. If you find yourself about to do any of
these, stop and tell me instead.

**Git:**
- Commit directly to main or master
- Run `git merge` manually
- Run `git rebase` manually
- Force-push to any branch
- Create a branch from anything other than the tip of main
- Add Co-Authored-By, Signed-off-by, or any AI attribution to commits

**Code:**
- Add a dependency without my approval
- Read env vars outside of the designated config file
- Write `process.env` / `os.environ` outside of config
- Hard-delete records if soft delete is the policy
- Suppress a type error or lint error without a comment explaining why
- Leave console.log, print, or debug statements in committed code
- Write a comment that describes what the code does
  (code should be self-describing; comments explain why)

**Scope:**
- Build anything not in the current task's spec
- Refactor code outside the files relevant to this task
- Fix unrelated bugs without asking first
- Introduce a new architectural pattern without approval

**Process:**
- Open a PR with failing tests
- Open a PR with type errors
- Skip the PR description template
- Mark work as done before I have confirmed the PR is merged

---

## 10. Definition of Done

A task is done when, and only when:

- [ ] The feature works as described in the spec
- [ ] All tests are written and passing
- [ ] Type checker passes with zero errors
- [ ] Linter passes with zero errors
- [ ] Build succeeds
- [ ] PR description is complete using the template in Section 7
- [ ] All manual steps are documented in the PR
- [ ] PR is open and the URL has been shared with me
- [ ] I have reviewed, approved, and merged the PR
- [ ] The branch has been deleted (automatic after merge)

Work is not done when the code is written.
Work is not done when the tests pass.
Work is done when the PR is merged and I have confirmed
we are ready to move to the next task.
```
