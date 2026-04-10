import { db } from './schema';
import { wouldCreateCycle } from './graph';
import type {
  Area,
  Project,
  Task,
  ChecklistItem,
  DependencyEdge,
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
  await db.areas.delete(id);
  // Orphan projects — set their areaId to null
  await db.projects.where('areaId').equals(id).modify({ areaId: null });
  // Orphan loose tasks under this area
  await db.tasks.where('areaId').equals(id).modify({ areaId: null });
  return ok(undefined);
}

export async function getAreas(): Promise<Area[]> {
  return db.areas.orderBy('sortOrder').toArray();
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
  options: Partial<Pick<Task, 'projectId' | 'areaId' | 'when' | 'deadline' | 'tags'>> = {}
): Promise<Result<Task>> {
  const maxOrder = await db.tasks.orderBy('sortOrder').last();
  const task: Task = {
    id: generateId(),
    title,
    notes: '',
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
  // Remove dependency edges involving this task
  await db.dependencyEdges
    .filter((e) => e.fromTaskId === id || e.toTaskId === id)
    .delete();
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

  // Remove dependency edges when moving out of a project (PRD §4.3)
  if (task.projectId && task.projectId !== projectId) {
    await db.dependencyEdges
      .filter((e) => e.fromTaskId === taskId || e.toTaskId === taskId)
      .delete();
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
    .filter((t) => t.projectId === null && t.when === null && t.deletedAt === null)
    .sortBy('sortOrder');
}

export async function getTodayTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0];
  return db.tasks
    .filter(
      (t) =>
        t.deletedAt === null &&
        t.status === 'open' &&
        (t.when === today || (t.deadline !== null && t.deadline <= today))
    )
    .sortBy('sortOrder');
}

export async function getDeletedItems(): Promise<{ tasks: Task[]; projects: Project[] }> {
  const tasks = await db.tasks.filter((t) => t.deletedAt !== null).toArray();
  const projects = await db.projects.filter((p) => p.deletedAt !== null).toArray();
  return { tasks, projects };
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

  // Check for duplicate
  const existing = await db.dependencyEdges
    .filter((e) => e.fromTaskId === fromTaskId && e.toTaskId === toTaskId)
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
  await db.dependencyEdges
    .filter((e) => e.fromTaskId === fromTaskId && e.toTaskId === toTaskId)
    .delete();
  return ok(undefined);
}

export async function getDependencyEdges(projectId: string): Promise<DependencyEdge[]> {
  return db.dependencyEdges.where('projectId').equals(projectId).toArray();
}

export async function getTaskDependencies(taskId: string): Promise<DependencyEdge[]> {
  return db.dependencyEdges
    .filter((e) => e.fromTaskId === taskId || e.toTaskId === taskId)
    .toArray();
}

// ── Trash cleanup ──────────────────────────────────────────────────

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeOldTrash(): Promise<Result<void>> {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  await db.tasks.filter((t) => t.deletedAt !== null && t.deletedAt < cutoff).delete();
  await db.projects.filter((p) => p.deletedAt !== null && p.deletedAt < cutoff).delete();
  return ok(undefined);
}
