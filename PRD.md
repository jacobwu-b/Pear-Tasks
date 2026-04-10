# Pear — Product Requirements Document

**Version:** 1.0
**Author:** Product
**Date:** April 9, 2026
**Status:** Draft

---

## 1. Overview

### 1.1 What is Pear?

Pear is a personal task management app inspired by Cultured Code's *Things*, extended with first-class dependency tracking. It is the second entry in a productivity suite that began with *Banana Notes* (an Apple Notes clone) — continuing the tradition of naming apps after fruits that playfully echo the original product. "Pear" is a homophone of *pair*, nodding at the app's core differentiator: the ability to *pair* tasks together through dependency relationships.

### 1.2 Problem Statement

Existing task managers fall into two camps. Lightweight apps like Things and Apple Reminders are beautifully simple but cannot express "Task B is blocked by Task A." Project management tools like Jira and Linear handle dependencies but are heavy, team-oriented, and hostile to personal use. There is no personal task manager that is both pleasant to use and dependency-aware.

For solo practitioners — particularly software engineers, writers, and freelancers — this gap is acute. A developer working alone still follows a phased workflow (PRD → Tech Spec → Implementation → Testing → Launch) where each phase blocks the next. Today, this sequencing lives only in their head.

### 1.3 Target User

Solo knowledge workers who manage structured, multi-step projects for themselves. The primary persona is a software engineer who runs side projects, but the tool should generalize to anyone whose personal work involves ordered phases: writers (outline → draft → edit → publish), students (research → write → revise → submit), and similar workflows.

### 1.4 Design Philosophy

Pear inherits the design values of Things — calm, focused, opinionated — and extends them with exactly one new concept: dependencies. The app should feel like Things with superpowers, not like Jira shrunk down.

---

## 2. Information Architecture

### 2.1 Core Data Model

Pear uses a hierarchical task model with four levels of granularity:

**Area** → **Project** → **Task** → **Checklist Item**

| Entity         | Description                                                                 |
|----------------|-----------------------------------------------------------------------------|
| Area           | A sphere of responsibility (e.g., "Work," "Side Projects," "Personal").     |
| Project        | A goal with a clear finish line, housed inside an Area.                     |
| Task           | A single actionable item inside a Project (or standalone in an Area).       |
| Checklist Item | A sub-step within a Task. Lightweight, not a full task.                     |

Tasks can also exist outside of any Project, directly under an Area or in the Inbox. Checklist items do not participate in the dependency system — they are simple boolean sub-steps.

### 2.2 Task Properties

Each task carries the following attributes:

| Property      | Type                              | Required | Notes                                                       |
|---------------|-----------------------------------|----------|-------------------------------------------------------------|
| Title         | String                            | Yes      | Plain text, single line.                                    |
| Notes         | Rich text                         | No       | Supports Markdown-style formatting (bold, italic, links, lists). |
| Status        | Enum                              | Yes      | One of: `open`, `completed`, `canceled`.                    |
| When          | Date or `someday`                 | No       | Scheduling. `someday` is a distinct non-date state.         |
| Deadline      | Date                              | No       | Hard due date. Independent of "When."                       |
| Tags          | Set of strings                    | No       | User-defined labels for filtering.                          |
| Checklist     | Ordered list of checklist items   | No       | Sub-steps displayed inline.                                 |
| Dependencies  | Set of task references            | No       | Tasks that must be completed before this task can begin. See §3. |
| Created at    | Timestamp                         | Auto     |                                                             |
| Completed at  | Timestamp                         | Auto     | Set when status changes to `completed`.                     |

### 2.3 Project Properties

| Property      | Type                              | Required | Notes                                                       |
|---------------|-----------------------------------|----------|-------------------------------------------------------------|
| Title         | String                            | Yes      |                                                             |
| Notes         | Rich text                         | No       |                                                             |
| Status        | Enum                              | Yes      | `active`, `completed`, `canceled`, `someday`.               |
| Area          | Area reference                    | No       | Unassigned projects appear in a virtual "No Area" group.    |
| Deadline      | Date                              | No       |                                                             |
| Tags          | Set of strings                    | No       |                                                             |

### 2.4 Smart Lists (Navigation Sidebar)

The sidebar provides the following built-in views, matching Things conventions:

| View          | Contents                                                                    |
|---------------|-----------------------------------------------------------------------------|
| Inbox         | Tasks with no project and no scheduled date. The capture bucket.            |
| Today         | Tasks scheduled for today, plus tasks whose deadline is today or overdue.   |
| Upcoming      | Tasks with a scheduled date, shown on a date-scrollable timeline.           |
| Anytime       | All open tasks not deferred to Someday.                                     |
| Someday       | Tasks and projects explicitly deferred.                                     |
| Logbook       | Completed and canceled tasks, reverse chronological.                        |
| Trash         | Soft-deleted items. Purged after 30 days.                                   |

Below the smart lists, the sidebar shows Areas (expandable to reveal their Projects).

---

## 3. Dependency Tracking (Core Differentiator)

### 3.1 Dependency Model

Dependencies are directed edges between tasks within the same project. A dependency `A → B` means "B depends on A" — equivalently, "A blocks B" or "B is blocked by A."

**Rules:**

- A task may have zero or more dependencies (predecessors).
- A task may block zero or more other tasks (successors).
- Dependencies must not form cycles. The system validates this on every mutation and rejects operations that would create a cycle.
- Dependencies are scoped to a project. Cross-project dependencies are out of scope for v1.
- Checklist items cannot participate in dependency relationships.

### 3.2 Blocked Task Behavior

A task is **blocked** if any of its dependencies are not yet completed. Blocked tasks:

- Display a visual "blocked" indicator (a lock icon or similar).
- Are excluded from the Today and Anytime smart lists by default (a toggle in settings can override this).
- Cannot be manually marked as completed while blocked. The user must either complete the predecessors or explicitly remove the dependency.
- Become **unblocked** automatically when all predecessors reach `completed` status.

When a task becomes unblocked, it appears in the appropriate smart list based on its "When" date (or immediately in Anytime if no date is set), providing a natural sense of progression.

### 3.3 Dependency Visualization

Within a project view, dependencies are visualized two ways:

**List View (default):** Tasks are topologically sorted. Each task shows a small badge indicating the count of unresolved dependencies (e.g., "Blocked by 2"). Tapping the badge reveals a popover listing the specific blocking tasks, each clickable to navigate.

**Graph View:** A horizontally-scrolling DAG (directed acyclic graph) rendered as a node-link diagram. Nodes are tasks; edges are dependency arrows. Nodes are color-coded by status: open (neutral), completed (green), blocked (amber), canceled (gray). This view is read-only for v1 — editing dependencies happens through the task detail panel.

The user can toggle between list and graph view via a segmented control at the top of the project view.

### 3.4 Creating and Editing Dependencies

Dependencies are managed from the task detail panel:

- A "Dependencies" section appears below the checklist area.
- Tapping "Add Dependency" opens a picker that lists all other tasks in the same project, filtered by a search field.
- Already-selected dependencies are shown as removable chips.
- If adding a dependency would create a cycle, the operation is rejected with an inline error: "This would create a circular dependency."

**Bulk dependency editing:** When viewing a project in list view, the user can enter a "Link Mode" (via a toolbar button). In link mode, tapping two tasks in sequence creates a dependency from the first to the second. Tapping an existing dependency edge removes it. This allows rapid wiring of sequential workflows.

### 3.5 Dependency Templates

Users can save a project's task structure — including all dependency edges — as a reusable template. Templates capture:

- Task titles (not notes, dates, or tags — those are project-specific).
- Checklist item titles within each task.
- The full dependency graph between tasks.

**Built-in templates** ship with the app:

| Template Name           | Tasks (in dependency order)                                              |
|-------------------------|--------------------------------------------------------------------------|
| Software Project        | PRD → Tech Spec → Implementation → Code Review → Testing → Launch       |
| Blog Post               | Outline → Draft → Edit → Graphics → Publish                             |
| Bug Fix                 | Reproduce → Root Cause → Fix → Test → Deploy                            |
| Research Paper           | Literature Review → Methodology → Data Collection → Analysis → Writing → Peer Review |

When instantiating a template, the user provides a project name and area. All tasks are created in `open` status with no dates — the user schedules them after creation.

Users can also create custom templates from any existing project via "Save as Template" in the project menu.

---

## 4. Core Workflows

### 4.1 Quick Capture

A global keyboard shortcut (configurable, default `Ctrl+N` / `⌘+N`) opens a lightweight capture input that creates a task in the Inbox. The input supports natural language date parsing: typing "Buy milk tomorrow" creates a task titled "Buy milk" scheduled for tomorrow.

A secondary shortcut (`Ctrl+Shift+N` / `⌘+Shift+N`) opens the full task creation form with all fields visible.

### 4.2 Task Lifecycle

```
[Inbox] → (Organize into Project/Area) → (Schedule "When") → [Today] → [Complete] → [Logbook]
```

Tasks can also be moved to Someday, canceled, or deleted at any point. Completing a task that blocks others triggers unblocking (see §3.2).

### 4.3 Drag and Drop

Tasks can be reordered within a project via drag and drop. Tasks can be dragged between projects, between areas, and into/out of the Inbox. Dragging a task out of a project removes its dependency edges (with a confirmation toast: "Dependencies removed — task moved out of project").

### 4.4 Search and Filtering

A global search bar (`Ctrl+F` / `⌘+F`) performs full-text search across task titles and notes. Results are grouped by project.

Within any list view, a filter bar allows narrowing by tag, status, and dependency state (blocked / unblocked / any).

### 4.5 Bulk Actions

Multi-select (via checkboxes or `Shift+Click`) enables bulk operations: move to project, schedule, tag, complete, delete.

---

## 5. User Interface

### 5.1 Layout

The app uses a three-column layout on wide screens (≥1024px) and collapses to a two-column or single-column layout on smaller screens:

| Column   | Contents                                    |
|----------|---------------------------------------------|
| Left     | Navigation sidebar (smart lists, areas, projects). Collapsible. |
| Center   | Task list for the selected view.            |
| Right    | Task detail panel. Opens when a task is selected. |

### 5.2 Visual Language

Pear's visual identity is warm, organic, and uncluttered — reflecting the fruit metaphor. The palette centers on soft greens and warm neutrals, with pear-gold as an accent color. Typography should be clean and sans-serif. Iconography uses rounded, friendly shapes.

### 5.3 Dark Mode

Full dark mode support from v1. The color system should be defined as semantic tokens (e.g., `surface-primary`, `text-secondary`, `accent`) that map to light and dark values.

### 5.4 Keyboard Navigation

Power users can navigate entirely by keyboard. Key bindings follow Things conventions where applicable:

| Action                | Shortcut           |
|-----------------------|--------------------|
| New task (quick)      | `⌘+N`             |
| New task (full)       | `⌘+Shift+N`       |
| New project           | `⌘+Shift+P`       |
| Move to Today         | `⌘+T`             |
| Move to Someday       | `⌘+Shift+S`       |
| Complete task         | `⌘+.`             |
| Delete task           | `⌘+Backspace`     |
| Search                | `⌘+F`             |
| Toggle sidebar        | `⌘+/`             |
| Toggle graph view     | `⌘+G`             |

---

## 6. Platforms and Technology

### 6.1 Platform

Pear v1 ships as a **desktop web app** with responsive design for tablet-width screens. A mobile-optimized layout is planned for v1.1 but not required at launch.

### 6.2 Data Storage

All data is stored locally using IndexedDB (via a wrapper like Dexie.js). There is no server, no account creation, and no sync in v1. Data export (JSON) and import are supported from day one to prevent lock-in.

### 6.3 Technology Considerations

The PRD is deliberately technology-agnostic. The tech spec should evaluate frameworks against the following requirements: fast list rendering (hundreds of tasks), smooth drag-and-drop, efficient DAG layout for the graph view, and offline-first local storage.

---

## 7. Non-Goals (v1)

The following are explicitly out of scope:

- Multi-user collaboration or task assignment.
- Calendar integration or time blocking.
- Cloud sync (iCloud, Google, etc.).
- Recurring tasks.
- File attachments.
- Cross-project dependencies.
- Native mobile apps (responsive web is sufficient for v1).
- Notifications or reminders (push or email).
- Natural language processing beyond basic date parsing in quick capture.

---

## 8. Success Metrics

Since Pear v1 is a personal/portfolio project without a live user base, success is measured qualitatively:

| Metric                        | Target                                                                  |
|-------------------------------|-------------------------------------------------------------------------|
| Feature completeness          | All workflows in §4 are functional and stable.                          |
| Dependency correctness        | Cycle detection, blocking/unblocking, and graph rendering work without error in manual testing. |
| Template usability            | A user can instantiate the "Software Project" template and have a correctly wired project in under 10 seconds. |
| Performance                   | Task list of 500 items renders and scrolls at 60fps. Graph view handles 50-node DAGs without jank. |
| Data safety                   | No data loss on refresh, tab close, or browser crash (IndexedDB persistence verified). |

---

## 9. Open Questions

| #  | Question                                                                                          | Recommendation                              |
|----|---------------------------------------------------------------------------------------------------|---------------------------------------------|
| 1  | Should blocked tasks be completely hidden from Today, or shown with a "blocked" badge?            | Hidden by default with a settings toggle.   |
| 2  | Should the graph view be interactive (drag to reorder, click to create edges) in v1?              | Read-only in v1; interactive in v1.1.       |
| 3  | Should templates support notes and tags, or only titles and edges?                                | Titles and edges only for simplicity.       |

---

## 10. Revision History

| Version | Date           | Author   | Changes           |
|---------|----------------|----------|--------------------|
| 1.0     | April 9, 2026  | Product  | Initial draft.     |
