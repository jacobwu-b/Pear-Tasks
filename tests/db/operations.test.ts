import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import {
  createArea,
  updateArea,
  deleteArea,
  getAreas,
  createProject,
  updateProject,
  softDeleteProject,
  restoreProject,
  getProjects,
  getProject,
  createTask,
  updateTask,
  softDeleteTask,
  restoreTask,
  moveTaskToProject,
  getTask,
  getTasksByProject,
  getInboxTasks,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getChecklistItems,
  addDependency,
  removeDependency,
  removeDependencyByTasks,
  getDependencyEdges,
  getTaskDependencies,
  purgeOldTrash,
} from '../../src/db/operations';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ── Areas ──────────────────────────────────────────────────────────

describe('Areas', () => {
  it('creates an area with auto-incrementing sortOrder', async () => {
    const { data: a1 } = await createArea('Work');
    const { data: a2 } = await createArea('Personal');
    expect(a1!.title).toBe('Work');
    expect(a1!.sortOrder).toBe(0);
    expect(a2!.sortOrder).toBe(1);
  });

  it('updates an area title', async () => {
    const { data: area } = await createArea('Work');
    const { data: updated } = await updateArea(area!.id, { title: 'Career' });
    expect(updated!.title).toBe('Career');
  });

  it('deletes an area and orphans its projects/tasks', async () => {
    const { data: area } = await createArea('Work');
    const { data: project } = await createProject('P1', area!.id);
    const { data: task } = await createTask('T1', { areaId: area!.id });

    await deleteArea(area!.id);

    const areas = await getAreas();
    expect(areas).toHaveLength(0);

    const p = await getProject(project!.id);
    expect(p!.areaId).toBeNull();

    const t = await getTask(task!.id);
    expect(t!.areaId).toBeNull();
  });

  it('lists areas in sortOrder', async () => {
    await createArea('B');
    await createArea('A');
    const areas = await getAreas();
    expect(areas[0].title).toBe('B');
    expect(areas[1].title).toBe('A');
  });

  it('initializes deletedAt to null on create', async () => {
    const { data: area } = await createArea('Work');
    expect(area!.deletedAt).toBeNull();
  });

  it('soft-deletes an area: row remains with deletedAt set, hidden from getAreas', async () => {
    const { data: area } = await createArea('Work');
    await deleteArea(area!.id);

    const raw = await db.areas.get(area!.id);
    expect(raw).toBeDefined();
    expect(raw!.deletedAt).toBeTypeOf('number');

    const listed = await getAreas();
    expect(listed).toHaveLength(0);
  });

  it('does not cascade delete into projects — they are orphaned to No Area', async () => {
    const { data: area } = await createArea('Work');
    const { data: project } = await createProject('P1', area!.id);
    await deleteArea(area!.id);

    const p = await getProject(project!.id);
    expect(p).toBeDefined();
    expect(p!.areaId).toBeNull();
    expect(p!.deletedAt).toBeNull();
  });

  it('orphans area-only tasks so they remain reachable in Inbox', async () => {
    const { data: area } = await createArea('Work');
    const { data: task } = await createTask('Loose task', { areaId: area!.id });
    await deleteArea(area!.id);

    const t = await getTask(task!.id);
    expect(t!.areaId).toBeNull();

    // Since the task has no project, no when, no deadline, it should
    // appear in the Inbox view after orphaning.
    const inbox = await getInboxTasks();
    expect(inbox.map((x) => x.id)).toContain(task!.id);
  });
});

// ── Projects ───────────────────────────────────────────────────────

describe('Projects', () => {
  it('creates a project with default values', async () => {
    const { data: project } = await createProject('My Project');
    expect(project!.title).toBe('My Project');
    expect(project!.status).toBe('active');
    expect(project!.areaId).toBeNull();
    expect(project!.deletedAt).toBeNull();
  });

  it('creates a project under an area', async () => {
    const { data: area } = await createArea('Work');
    const { data: project } = await createProject('P1', area!.id);
    expect(project!.areaId).toBe(area!.id);
  });

  it('sets completedAt when marking project completed', async () => {
    const { data: project } = await createProject('P1');
    const { data: updated } = await updateProject(project!.id, { status: 'completed' });
    expect(updated!.completedAt).toBeTypeOf('number');
  });

  it('soft-deletes a project and its tasks', async () => {
    const { data: project } = await createProject('P1');
    await createTask('T1', { projectId: project!.id });
    await createTask('T2', { projectId: project!.id });

    await softDeleteProject(project!.id);

    const projects = await getProjects();
    expect(projects).toHaveLength(0);

    const tasks = await getTasksByProject(project!.id);
    expect(tasks).toHaveLength(0);
  });

  it('restores a soft-deleted project and its tasks', async () => {
    const { data: project } = await createProject('P1');
    await createTask('T1', { projectId: project!.id });

    await softDeleteProject(project!.id);
    await restoreProject(project!.id);

    const projects = await getProjects();
    expect(projects).toHaveLength(1);

    const tasks = await getTasksByProject(project!.id);
    expect(tasks).toHaveLength(1);
  });
});

// ── Tasks ──────────────────────────────────────────────────────────

describe('Tasks', () => {
  it('creates a task with default values', async () => {
    const { data: task } = await createTask('Do something');
    expect(task!.title).toBe('Do something');
    expect(task!.status).toBe('open');
    expect(task!.projectId).toBeNull();
    expect(task!.when).toBeNull();
  });

  it('creates a task with options', async () => {
    const { data: project } = await createProject('P1');
    const { data: task } = await createTask('T1', {
      projectId: project!.id,
      when: '2026-04-10',
      tags: ['urgent'],
    });
    expect(task!.projectId).toBe(project!.id);
    expect(task!.when).toBe('2026-04-10');
    expect(task!.tags).toEqual(['urgent']);
  });

  it('sets completedAt when completing a task', async () => {
    const { data: task } = await createTask('T1');
    const { data: updated } = await updateTask(task!.id, { status: 'completed' });
    expect(updated!.completedAt).toBeTypeOf('number');
  });

  it('soft-deletes a task: row remains with deletedAt set, edges hidden from getDependencyEdges', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    await softDeleteTask(t1!.id);

    // Live query hides the edge because t1 is deleted
    const edges = await getDependencyEdges(project!.id);
    expect(edges).toHaveLength(0);

    const deleted = await getTask(t1!.id);
    expect(deleted!.deletedAt).toBeTypeOf('number');
  });

  it('restores a soft-deleted task and recovers its dependency edges', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    await softDeleteTask(t1!.id);

    // Edge is hidden while t1 is in Trash
    expect(await getDependencyEdges(project!.id)).toHaveLength(0);

    await restoreTask(t1!.id);

    const restored = await getTask(t1!.id);
    expect(restored!.deletedAt).toBeNull();

    // Edge comes back once t1 is restored
    const edges = await getDependencyEdges(project!.id);
    expect(edges).toHaveLength(1);
    expect(edges[0].fromTaskId).toBe(t1!.id);
    expect(edges[0].toTaskId).toBe(t2!.id);
  });

  it('returns inbox tasks (no project, no when)', async () => {
    await createTask('Inbox task');
    await createTask('Scheduled', { when: '2026-04-10' });
    const { data: project } = await createProject('P1');
    await createTask('Project task', { projectId: project!.id });

    const inbox = await getInboxTasks();
    expect(inbox).toHaveLength(1);
    expect(inbox[0].title).toBe('Inbox task');
  });
});

// ── Move task between projects ─────────────────────────────────────

describe('moveTaskToProject', () => {
  it('moves task and strips dependency edges', async () => {
    const { data: p1 } = await createProject('P1');
    const { data: p2 } = await createProject('P2');
    const { data: t1 } = await createTask('T1', { projectId: p1!.id });
    const { data: t2 } = await createTask('T2', { projectId: p1!.id });

    await addDependency(t1!.id, t2!.id, p1!.id);

    const { data: moved } = await moveTaskToProject(t1!.id, p2!.id);
    expect(moved!.projectId).toBe(p2!.id);

    const edges = await getDependencyEdges(p1!.id);
    expect(edges).toHaveLength(0);
  });

  it('returns error for non-existent task', async () => {
    const result = await moveTaskToProject('nonexistent', null);
    expect(result.error).toBe('Task not found');
  });
});

// ── Checklist Items ────────────────────────────────────────────────

describe('Checklist Items', () => {
  it('adds checklist items with auto-incrementing sortOrder', async () => {
    const { data: task } = await createTask('T1');
    const { data: c1 } = await addChecklistItem(task!.id, 'Step 1');
    const { data: c2 } = await addChecklistItem(task!.id, 'Step 2');

    expect(c1!.sortOrder).toBe(0);
    expect(c2!.sortOrder).toBe(1);
  });

  it('toggles checklist item completion', async () => {
    const { data: task } = await createTask('T1');
    const { data: item } = await addChecklistItem(task!.id, 'Step 1');

    const { data: updated } = await updateChecklistItem(item!.id, { completed: true });
    expect(updated!.completed).toBe(true);
  });

  it('deletes a checklist item', async () => {
    const { data: task } = await createTask('T1');
    const { data: item } = await addChecklistItem(task!.id, 'Step 1');

    await deleteChecklistItem(item!.id);

    const items = await getChecklistItems(task!.id);
    expect(items).toHaveLength(0);
  });

  it('lists checklist items in sortOrder', async () => {
    const { data: task } = await createTask('T1');
    await addChecklistItem(task!.id, 'B');
    await addChecklistItem(task!.id, 'A');

    const items = await getChecklistItems(task!.id);
    expect(items[0].title).toBe('B');
    expect(items[1].title).toBe('A');
  });
});

// ── Dependencies ───────────────────────────────────────────────────

describe('Dependencies', () => {
  it('creates a valid dependency edge', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    const { data: edge } = await addDependency(t1!.id, t2!.id, project!.id);
    expect(edge!.fromTaskId).toBe(t1!.id);
    expect(edge!.toTaskId).toBe(t2!.id);
  });

  it('rejects dependency that would create a cycle', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    const result = await addDependency(t2!.id, t1!.id, project!.id);

    expect(result.error).toBe('This would create a circular dependency');
  });

  it('rejects duplicate dependency', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    const result = await addDependency(t1!.id, t2!.id, project!.id);

    expect(result.error).toBe('Dependency already exists');
  });

  it('rejects cross-project dependency', async () => {
    const { data: p1 } = await createProject('P1');
    const { data: p2 } = await createProject('P2');
    const { data: t1 } = await createTask('T1', { projectId: p1!.id });
    const { data: t2 } = await createTask('T2', { projectId: p2!.id });

    const result = await addDependency(t1!.id, t2!.id, p1!.id);
    expect(result.error).toBe('Both tasks must be in the same project');
  });

  it('removes dependency by id', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    const { data: edge } = await addDependency(t1!.id, t2!.id, project!.id);
    await removeDependency(edge!.id);

    const edges = await getDependencyEdges(project!.id);
    expect(edges).toHaveLength(0);
  });

  it('removes dependency by task pair', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    await removeDependencyByTasks(t1!.id, t2!.id);

    const edges = await getDependencyEdges(project!.id);
    expect(edges).toHaveLength(0);
  });

  it('softDeleteTask hides both outgoing and incoming edges from getDependencyEdges', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    const { data: t3 } = await createTask('T3', { projectId: project!.id });

    // t2 has one outgoing edge (t2 -> t3) and one incoming edge (t1 -> t2)
    await addDependency(t1!.id, t2!.id, project!.id);
    await addDependency(t2!.id, t3!.id, project!.id);

    await softDeleteTask(t2!.id);

    // Both edges are hidden because t2 is deleted; t1 and t3 are not blocked
    const edges = await getDependencyEdges(project!.id);
    expect(edges).toHaveLength(0);

    // Restoring t2 makes both edges visible again
    await restoreTask(t2!.id);
    const restoredEdges = await getDependencyEdges(project!.id);
    expect(restoredEdges).toHaveLength(2);
  });

  it('getTaskDependencies returns edges in both directions', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    const { data: t3 } = await createTask('T3', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id); // t2 incoming
    await addDependency(t2!.id, t3!.id, project!.id); // t2 outgoing

    const deps = await getTaskDependencies(t2!.id);
    expect(deps).toHaveLength(2);
    const pairs = deps.map((e) => `${e.fromTaskId}->${e.toTaskId}`).sort();
    expect(pairs).toEqual(
      [`${t1!.id}->${t2!.id}`, `${t2!.id}->${t3!.id}`].sort()
    );
  });

  it('rejects three-node cycle', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    const { data: t3 } = await createTask('T3', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    await addDependency(t2!.id, t3!.id, project!.id);
    const result = await addDependency(t3!.id, t1!.id, project!.id);

    expect(result.error).toBe('This would create a circular dependency');
  });

  it('getTaskDependencies hides edges to/from soft-deleted peers', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);
    await softDeleteTask(t1!.id);

    // t2 should see no incoming edges while t1 is in Trash
    const depsWhileDeleted = await getTaskDependencies(t2!.id);
    expect(depsWhileDeleted).toHaveLength(0);

    await restoreTask(t1!.id);
    const depsAfterRestore = await getTaskDependencies(t2!.id);
    expect(depsAfterRestore).toHaveLength(1);
  });
});

// ── purgeOldTrash ──────────────────────────────────────────────────

describe('purgeOldTrash', () => {
  it('hard-purges expired tasks and cleans up their dependency edges', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });

    await addDependency(t1!.id, t2!.id, project!.id);

    // Back-date t1's deletedAt to over 30 days ago
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    await db.tasks.update(t1!.id, { deletedAt: Date.now() - THIRTY_ONE_DAYS_MS });

    await purgeOldTrash();

    // t1 is gone; t2 survives
    expect(await getTask(t1!.id)).toBeUndefined();
    expect(await getTask(t2!.id)).toBeDefined();

    // The edge was cleaned up when t1 was purged
    const edges = await db.dependencyEdges.where('projectId').equals(project!.id).toArray();
    expect(edges).toHaveLength(0);
  });
});
