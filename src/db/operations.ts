import { db } from './schema';
import { wouldCreateCycle, getBlockedTaskIds } from './graph';
import { getLocalTodayDateString } from '../lib/dates';
import { computeNextOccurrence } from '../lib/recurrence';
import type {
  Area,
  Project,
  Task,
  ChecklistItem,
  DependencyEdge,
  RecurrenceConfig,
} from '../types';

type Result<T> = { data: T; error: null } | { data: null; error: string };

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

function err<T>(message: string): Result<T> {
  return { data: null, error: message };
}

function generateId(): string {
  return crypto.randomUUID();
}

// ── Areas ──────────────────────────────────────────────────────────

export async function createArea(
  title: string
): Promise<Result<Area>> {
  const maxOrder = await db.areas.orderBy('sortOrder').last();
  const area: Area = {
    id: generateId(),
    title,
    sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
    createdAt: Date.now(),
    deletedAt: null,
  };
  await db.areas.add(area);
  return ok(area);
}

export async function updateArea(
  id: string,
  changes: Partial<Pick<Area, 'title' | 'sortOrder'>>
): Promise<Result<Area>> {
  await db.areas.update(id, changes);
  const area = await db.areas.get(id);
  if (!area) return err('Area not found');
  return ok(area);
}

export async function deleteArea(id: string): Promise<Result<void>> {
  // Soft delete: mark the area deleted but keep the row so we could
  // theoretically restore it later. No purge schedule (per product decision).
  await db.areas.update(id, { deletedAt: Date.now() });
  // Orphan projects — set their areaId to null so they appear in "No Area"
  await db.projects.where('areaId').equals(id).modify({ areaId: null });
  // Orphan loose tasks under this area so they remain reachable via
  // Inbox / Today / Anytime depending on their "when" field.
  await db.tasks.where('areaId').equals(id).modify({ areaId: null });
  return ok(undefined);
}

export async function getAreas(): Promise<Area[]> {
  return db.areas
    .orderBy('sortOrder')
    .filter((a) => a.deletedAt === null)
    .toArray();
}

// ── Projects ───────────────────────────────────────────────────────

export async function createProject(
  title: string,
  areaId: string | null = null
): Promise<Result<Project>> {
  const maxOrder = await db.projects.orderBy('sortOrder').last();
  const project: Project = {
    id: generateId(),
    title,
    notes: '',
    status: 'active',
    areaId,
    deadline: null,
    tags: [],
    sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
    createdAt: Date.now(),
    completedAt: null,
    deletedAt: null,
  };
  await db.projects.add(project);
  return ok(project);
}

export async function updateProject(
  id: string,
  changes: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Result<Project>> {
  // Auto-set completedAt when status changes to completed
  if (changes.status === 'completed' && !changes.completedAt) {
    changes.completedAt = Date.now();
  }
  await db.projects.update(id, changes);
  const project = await db.projects.get(id);
  if (!project) return err('Project not found');
  return ok(project);
}

export async function softDeleteProject(id: string): Promise<Result<void>> {
  await db.projects.update(id, { deletedAt: Date.now() });
  // Soft-delete all tasks in the project
  await db.tasks.where('projectId').equals(id).modify({ deletedAt: Date.now() });
  return ok(undefined);
}

export async function restoreProject(id: string): Promise<Result<void>> {
  await db.projects.update(id, { deletedAt: null });
  await db.tasks.where('projectId').equals(id).modify({ deletedAt: null });
  return ok(undefined);
}

export async function getProjects(includeDeleted = false): Promise<Project[]> {
  if (includeDeleted) {
    return db.projects.orderBy('sortOrder').toArray();
  }
  return db.projects
    .filter((p) => p.deletedAt === null)
    .sortBy('sortOrder');
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

// ── Tasks ──────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  options: Partial<
    Pick<Task, 'projectId' | 'areaId' | 'when' | 'deadline' | 'tags' | 'notes' | 'recurrence' | 'recurringParentId'>
  > = {}
): Promise<Result<Task>> {
  const maxOrder = await db.tasks.orderBy('sortOrder').last();
  const task: Task = {
    id: generateId(),
    title,
    notes: options.notes ?? '',
    status: 'open',
    when: options.when ?? null,
    deadline: options.deadline ?? null,
    tags: options.tags ?? [],
    projectId: options.projectId ?? null,
    areaId: options.areaId ?? null,
    sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
    createdAt: Date.now(),
    completedAt: null,
    deletedAt: null,
    recurrence: options.recurrence ?? null,
    recurringParentId: options.recurringParentId ?? null,
  };
  await db.tasks.add(task);
  return ok(task);
}

export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt'>>
): Promise<Result<Task>> {
  if (changes.status === 'completed' && !changes.completedAt) {
    changes.completedAt = Date.now();
  }
  await db.tasks.update(id, changes);
  const task = await db.tasks.get(id);
  if (!task) return err('Task not found');
  return ok(task);
}

export async function softDeleteTask(id: string): Promise<Result<void>> {
  // Edges are intentionally preserved so that restoreTask can bring the full
  // dependency graph back. Live queries filter out edges involving deleted
  // tasks. Edges are only hard-deleted when the task is purged from Trash.
  await db.tasks.update(id, { deletedAt: Date.now() });
  return ok(undefined);
}

export async function restoreTask(id: string): Promise<Result<void>> {
  await db.tasks.update(id, { deletedAt: null });
  return ok(undefined);
}

export async function moveTaskToProject(
  taskId: string,
  projectId: string | null
): Promise<Result<Task>> {
  const task = await db.tasks.get(taskId);
  if (!task) return err('Task not found');

  // Remove dependency edges when moving out of a project (PRD §4.3).
  // Indexed lookups per #11.
  if (task.projectId && task.projectId !== projectId) {
    await Promise.all([
      db.dependencyEdges.where('fromTaskId').equals(taskId).delete(),
      db.dependencyEdges.where('toTaskId').equals(taskId).delete(),
    ]);
  }

  await db.tasks.update(taskId, { projectId, areaId: null });
  const updated = await db.tasks.get(taskId);
  return ok(updated!);
}

export async function getTask(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return db.tasks
    .where('projectId')
    .equals(projectId)
    .filter((t) => t.deletedAt === null)
    .sortBy('sortOrder');
}

export async function getInboxTasks(): Promise<Task[]> {
  return db.tasks
    .filter((t) => t.projectId === null && t.when === null && t.deletedAt === null && t.status === 'open')
    .sortBy('sortOrder');
}

export async function getTodayTasks(): Promise<Task[]> {
  const today = getLocalTodayDateString();
  const tasks = await db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.status === 'open' &&
        (t.when === today || (t.deadline !== null && t.deadline <= today))
    )
    .sortBy('sortOrder');

  // Filter out blocked tasks
  const blocked = await getAllBlockedTaskIds(projectIdsOf(tasks));
  return tasks.filter((t) => !blocked.has(t.id));
}

export async function getDeletedItems(): Promise<{ tasks: Task[]; projects: Project[] }> {
  const tasks = await db.tasks.filter((t) => t.deletedAt !== null).toArray();
  const projects = await db.projects.filter((p) => p.deletedAt !== null).toArray();
  return { tasks, projects };
}

export async function getAnytimeTasks(): Promise<Task[]> {
  const tasks = await db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.status === 'open' &&
        t.when !== 'someday'
    )
    .sortBy('sortOrder');

  // Filter out blocked tasks
  const blocked = await getAllBlockedTaskIds(projectIdsOf(tasks));
  return tasks.filter((t) => !blocked.has(t.id));
}

export async function getSomedayTasks(): Promise<Task[]> {
  return db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.status === 'open' &&
        t.when === 'someday'
    )
    .sortBy('sortOrder');
}

export async function getUpcomingTasks(): Promise<Task[]> {
  const today = getLocalTodayDateString();
  const tasks = await db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.status === 'open' &&
        t.when !== null &&
        t.when !== 'someday' &&
        t.when > today
    )
    .toArray();
  // Sort chronologically by when date
  return tasks.sort((a, b) => (a.when! > b.when! ? 1 : -1));
}

export async function getLogbookTasks(): Promise<Task[]> {
  const tasks = await db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.status === 'completed' || t.status === 'canceled')
    )
    .toArray();
  // Reverse chronological by completedAt
  return tasks.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

export async function getTasksByArea(areaId: string): Promise<Task[]> {
  return db.tasks
    .where('areaId')
    .equals(areaId)
    .filter((t) => t.deletedAt === null && t.status === 'open')
    .sortBy('sortOrder');
}

export async function getTrashTasks(): Promise<Task[]> {
  return db.tasks.filter((t) => t.deletedAt !== null).toArray();
}

// ── Blocked task helper ────────────────────────────────────────────

/**
 * Returns IDs of all tasks that are blocked by at least one incomplete
 * predecessor. Scoped to the given projectIds so Today/Anytime views don't
 * read every edge in the database (#11). Dependencies are project-scoped
 * per PRD §4.3, so tasks with projectId === null are never blocked.
 */
async function getAllBlockedTaskIds(projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();

  const edges = await db.dependencyEdges
    .where('projectId')
    .anyOf(projectIds)
    .toArray();
  if (edges.length === 0) return new Set();

  // Only fetch the task rows referenced by these edges, not every task.
  const taskIds = new Set<string>();
  for (const e of edges) {
    taskIds.add(e.fromTaskId);
    taskIds.add(e.toTaskId);
  }
  const referencedTasks = await db.tasks.where('id').anyOf([...taskIds]).toArray();
  const completedIds = new Set(
    referencedTasks
      // A soft-deleted task can never be "done" in the normal sense, but it
      // should not keep blocking other tasks — treat it as resolved (#20).
      .filter((t) => t.status === 'completed' || t.status === 'canceled' || t.deletedAt !== null)
      .map((t) => t.id)
  );

  return getBlockedTaskIds(edges, completedIds);
}

function projectIdsOf(tasks: Task[]): string[] {
  const ids = new Set<string>();
  for (const t of tasks) {
    if (t.projectId) ids.add(t.projectId);
  }
  return [...ids];
}

// ── Checklist Items ────────────────────────────────────────────────

export async function addChecklistItem(
  taskId: string,
  title: string
): Promise<Result<ChecklistItem>> {
  const existing = await db.checklistItems
    .where('taskId')
    .equals(taskId)
    .sortBy('sortOrder');
  const maxOrder = existing.length > 0 ? existing[existing.length - 1].sortOrder : -1;

  const item: ChecklistItem = {
    id: generateId(),
    taskId,
    title,
    completed: false,
    sortOrder: maxOrder + 1,
  };
  await db.checklistItems.add(item);
  return ok(item);
}

export async function updateChecklistItem(
  id: string,
  changes: Partial<Pick<ChecklistItem, 'title' | 'completed' | 'sortOrder'>>
): Promise<Result<ChecklistItem>> {
  await db.checklistItems.update(id, changes);
  const item = await db.checklistItems.get(id);
  if (!item) return err('Checklist item not found');
  return ok(item);
}

export async function deleteChecklistItem(id: string): Promise<Result<void>> {
  await db.checklistItems.delete(id);
  return ok(undefined);
}

export async function getChecklistItems(taskId: string): Promise<ChecklistItem[]> {
  return db.checklistItems
    .where('taskId')
    .equals(taskId)
    .sortBy('sortOrder');
}

// ── Dependencies ───────────────────────────────────────────────────

export async function addDependency(
  fromTaskId: string,
  toTaskId: string,
  projectId: string
): Promise<Result<DependencyEdge>> {
  // Validate both tasks exist and are in the same project
  const [fromTask, toTask] = await Promise.all([
    db.tasks.get(fromTaskId),
    db.tasks.get(toTaskId),
  ]);
  if (!fromTask || !toTask) return err('One or both tasks not found');
  if (fromTask.projectId !== projectId || toTask.projectId !== projectId) {
    return err('Both tasks must be in the same project');
  }

  // Check for duplicate via indexed lookup (#11).
  const existing = await db.dependencyEdges
    .where('fromTaskId')
    .equals(fromTaskId)
    .and((e) => e.toTaskId === toTaskId)
    .first();
  if (existing) return err('Dependency already exists');

  // Cycle detection
  const edges = await db.dependencyEdges
    .where('projectId')
    .equals(projectId)
    .toArray();

  if (wouldCreateCycle(edges, fromTaskId, toTaskId)) {
    return err('This would create a circular dependency');
  }

  const edge: DependencyEdge = {
    id: generateId(),
    fromTaskId,
    toTaskId,
    projectId,
  };
  await db.dependencyEdges.add(edge);
  return ok(edge);
}

export async function removeDependency(id: string): Promise<Result<void>> {
  await db.dependencyEdges.delete(id);
  return ok(undefined);
}

export async function removeDependencyByTasks(
  fromTaskId: string,
  toTaskId: string
): Promise<Result<void>> {
  // Indexed lookup on fromTaskId, then narrow by toTaskId (#11).
  await db.dependencyEdges
    .where('fromTaskId')
    .equals(fromTaskId)
    .and((e) => e.toTaskId === toTaskId)
    .delete();
  return ok(undefined);
}

export async function getDependencyEdges(projectId: string): Promise<DependencyEdge[]> {
  const edges = await db.dependencyEdges.where('projectId').equals(projectId).toArray();
  if (edges.length === 0) return edges;
  // Exclude edges where either endpoint has been soft-deleted. Edges survive
  // soft-delete so restoreTask can recover the full graph (#20).
  const deletedIds = new Set(
    (await db.tasks.where('projectId').equals(projectId).filter((t) => t.deletedAt !== null).toArray()).map((t) => t.id)
  );
  return edges.filter((e) => !deletedIds.has(e.fromTaskId) && !deletedIds.has(e.toTaskId));
}

export async function getTaskDependencies(taskId: string): Promise<DependencyEdge[]> {
  // Union the two indexed lookups instead of scanning the whole table (#11).
  const [outgoing, incoming] = await Promise.all([
    db.dependencyEdges.where('fromTaskId').equals(taskId).toArray(),
    db.dependencyEdges.where('toTaskId').equals(taskId).toArray(),
  ]);
  const allEdges = [...outgoing, ...incoming];
  if (allEdges.length === 0) return allEdges;
  // Filter out edges whose peer task has been soft-deleted (#20).
  const peerIds = allEdges.map((e) => (e.fromTaskId === taskId ? e.toTaskId : e.fromTaskId));
  const peers = await db.tasks.where('id').anyOf(peerIds).toArray();
  const deletedPeerIds = new Set(peers.filter((t) => t.deletedAt !== null).map((t) => t.id));
  return allEdges.filter((e) => {
    const peerId = e.fromTaskId === taskId ? e.toTaskId : e.fromTaskId;
    return !deletedPeerIds.has(peerId);
  });
}

// ── Recurring Tasks ────────────────────────────────────────────────

/**
 * When a recurring task is completed, spawn the next open instance.
 *
 * The new task is a copy of the completed task with a fresh id, open status,
 * and the next `when` date computed from the recurrence rule. Dependency edges
 * are intentionally NOT copied — the new instance starts with a clean slate.
 *
 * Returns ok(null) if there is no next occurrence (end date reached, or
 * no recurrence config).
 */
export async function spawnNextRecurrence(completedTask: Task): Promise<Result<Task | null>> {
  if (!completedTask.recurrence) {
    return ok(null);
  }

  // Use the task's scheduled date as the reference point for "next occurrence".
  // If the task has no date (null) or is marked someday, fall back to today so
  // that completion still spawns a sensible next instance.
  const fromDate =
    completedTask.when && completedTask.when !== 'someday'
      ? (completedTask.when as string)
      : getLocalTodayDateString();

  const nextDate = computeNextOccurrence(completedTask.recurrence, fromDate);
  if (!nextDate) return ok(null);

  const maxOrder = await db.tasks.orderBy('sortOrder').last();
  const newTask: Task = {
    id: generateId(),
    title:            completedTask.title,
    notes:            completedTask.notes,
    status:           'open',
    when:             nextDate,
    deadline:         completedTask.deadline,
    tags:             [...completedTask.tags],
    projectId:        completedTask.projectId,
    areaId:           completedTask.areaId,
    sortOrder:        (maxOrder?.sortOrder ?? -1) + 1,
    createdAt:        Date.now(),
    completedAt:      null,
    deletedAt:        null,
    recurrence:       completedTask.recurrence,
    // Chain: always point back to the root ancestor, not the intermediate instance.
    recurringParentId: completedTask.recurringParentId ?? completedTask.id,
  };

  await db.tasks.add(newTask);
  return ok(newTask);
}

/**
 * Complete a task and, if it recurs, spawn the next open instance.
 *
 * Completion and spawn are sequential operations. If spawn fails after a
 * successful completion the task remains completed — the user can manually
 * create the next occurrence. We prefer simplicity over strict atomicity here
 * because completion is always the primary intent.
 */
export async function completeTaskWithRecurrence(
  id: string,
): Promise<Result<{ completed: Task; spawned: Task | null }>> {
  // Complete the task
  await db.tasks.update(id, { status: 'completed', completedAt: Date.now() });
  const completed = await db.tasks.get(id);
  if (!completed) return err('Task not found after update');

  // Spawn next occurrence if recurring
  const spawnResult = await spawnNextRecurrence(completed);
  return ok({ completed, spawned: spawnResult.data });
}

/**
 * Apply arbitrary field changes to the given task and all open sibling
 * instances that share the same root and are scheduled on or after `fromWhen`.
 *
 * Used for the "edit this and following occurrences" action for any field
 * (title, notes, deadline, tags, when, etc.).
 *
 * `rootId` is the recurringParentId of the chain, or the task's own id if it
 * is itself the root (recurringParentId === null).
 */
export async function updateTaskForward(
  taskId: string,
  rootId: string,
  fromWhen: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt'>>,
): Promise<Result<void>> {
  // Update the task being edited directly.
  await db.tasks.update(taskId, changes);

  // Update all open siblings at or after fromWhen.
  await db.tasks
    .where('recurringParentId')
    .equals(rootId)
    .filter(
      (t) =>
        t.id !== taskId &&
        t.status === 'open' &&
        t.when !== null &&
        t.when !== 'someday' &&
        (t.when as string) >= fromWhen,
    )
    .modify(changes);

  return ok(undefined);
}

/**
 * Update the recurrence rule on the given task and all open sibling instances
 * that share the same root and are scheduled on or after `fromWhen`.
 *
 * Used for the "edit this and following occurrences" action.
 *
 * `rootId` is the recurringParentId of the chain, or the task's own id if it
 * is itself the root (recurringParentId === null).
 */
export async function updateRecurrenceForward(
  taskId: string,
  rootId: string,
  fromWhen: string,
  recurrence: RecurrenceConfig | null,
): Promise<Result<void>> {
  // Update the task being edited directly (it may be the root, which has
  // recurringParentId === null and therefore won't match the index query).
  await db.tasks.update(taskId, { recurrence });

  // Update all open siblings at or after fromWhen.
  await db.tasks
    .where('recurringParentId')
    .equals(rootId)
    .filter(
      (t) =>
        t.id !== taskId &&
        t.status === 'open' &&
        t.when !== null &&
        t.when !== 'someday' &&
        (t.when as string) >= fromWhen,
    )
    .modify({ recurrence });

  return ok(undefined);
}

/**
 * Return all tasks (including completed and deleted) that belong to a
 * recurring task chain identified by its root id.
 */
export async function getRecurringFamily(rootId: string): Promise<Task[]> {
  return db.tasks.where('recurringParentId').equals(rootId).toArray();
}

// ── Trash cleanup ──────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeOldTrash(): Promise<Result<void>> {
  const cutoff = Date.now() - THIRTY_DAYS_MS;

  // Collect task IDs about to be hard-deleted so we can remove their edges.
  // Edges survive soft-delete to support restore (#20); they must be cleaned
  // up here to avoid leaking orphaned rows.
  const expiredTasks = await db.tasks
    .filter((t) => t.deletedAt !== null && t.deletedAt < cutoff)
    .toArray();
  if (expiredTasks.length > 0) {
    const expiredIds = expiredTasks.map((t) => t.id);
    await Promise.all([
      db.dependencyEdges.where('fromTaskId').anyOf(expiredIds).delete(),
      db.dependencyEdges.where('toTaskId').anyOf(expiredIds).delete(),
    ]);
    await db.tasks.where('id').anyOf(expiredIds).delete();
  }

  await db.projects.filter((p) => p.deletedAt !== null && p.deletedAt < cutoff).delete();
  return ok(undefined);
}
