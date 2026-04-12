import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import { createArea, createProject, createTask, updateTask } from '../../src/db/operations';
import { useTaskStore } from '../../src/store/taskStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('taskStore', () => {
  it('starts with empty arrays', () => {
    const state = useTaskStore.getState();
    expect(state.areas).toEqual([]);
    expect(state.projects).toEqual([]);
    expect(state.tasks).toEqual([]);
  });

  it('loads areas from Dexie', async () => {
    await createArea('Work');
    await createArea('Personal');

    await useTaskStore.getState().loadSidebarData();

    const { areas } = useTaskStore.getState();
    expect(areas).toHaveLength(2);
    expect(areas[0].title).toBe('Work');
    expect(areas[1].title).toBe('Personal');
  });

  it('loads projects from Dexie', async () => {
    const { data: area } = await createArea('Work');
    await createProject('Project A', area!.id);
    await createProject('Project B');

    await useTaskStore.getState().loadSidebarData();

    const { projects } = useTaskStore.getState();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.title)).toContain('Project A');
    expect(projects.map((p) => p.title)).toContain('Project B');
  });

  it('excludes soft-deleted projects', async () => {
    await createProject('Active');
    const { data: deleted } = await createProject('Deleted');
    await db.projects.update(deleted!.id, { deletedAt: Date.now() });

    await useTaskStore.getState().loadSidebarData();

    const { projects } = useTaskStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0].title).toBe('Active');
  });

  // -- View loading tests --

  it('loads inbox tasks (no project, no when)', async () => {
    await createTask('Inbox task');
    await createTask('Scheduled', { when: '2026-05-01' });
    const { data: project } = await createProject('P1');
    await createTask('Project task', { projectId: project!.id });

    await useTaskStore.getState().loadTasksForView('inbox');

    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Inbox task');
  });

  it('loads tasks for a project view', async () => {
    const { data: project } = await createProject('P1');
    await createTask('T1', { projectId: project!.id });
    await createTask('T2', { projectId: project!.id });
    await createTask('Unrelated');

    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });

    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toContain('T1');
    expect(tasks.map((t) => t.title)).toContain('T2');
  });

  it('loads someday tasks', async () => {
    await createTask('Someday task', { when: 'someday' });
    await createTask('Normal task');

    await useTaskStore.getState().loadTasksForView('someday');

    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Someday task');
  });

  it('loads logbook tasks sorted by completedAt desc', async () => {
    const { data: t1 } = await createTask('First completed');
    const { data: t2 } = await createTask('Second completed');
    await updateTask(t1!.id, { status: 'completed', completedAt: 1000 });
    await updateTask(t2!.id, { status: 'completed', completedAt: 2000 });

    await useTaskStore.getState().loadTasksForView('logbook');

    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Second completed');
    expect(tasks[1].title).toBe('First completed');
  });

  // -- Mutation wrapper tests --

  it('completeTask marks task completed and refreshes', async () => {
    const { data: task } = await createTask('Do this');
    await useTaskStore.getState().loadTasksForView('inbox');

    await useTaskStore.getState().completeTask(task!.id);

    // Inbox should now be empty (completed tasks leave inbox)
    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(0);
  });

  it('reopenTask marks task open and refreshes', async () => {
    const { data: task } = await createTask('Do this');
    await updateTask(task!.id, { status: 'completed', completedAt: Date.now() });
    await useTaskStore.getState().loadTasksForView('logbook');
    expect(useTaskStore.getState().tasks).toHaveLength(1);

    await useTaskStore.getState().reopenTask(task!.id);

    // Should leave logbook after reopening
    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(0);
  });

  it('deleteTask soft-deletes and refreshes', async () => {
    const { data: task } = await createTask('Delete me');
    await useTaskStore.getState().loadTasksForView('inbox');
    expect(useTaskStore.getState().tasks).toHaveLength(1);

    await useTaskStore.getState().deleteTask(task!.id);

    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });
});
