import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import { addDependency, createArea, createProject, createTask, getProjects, updateTask } from '../../src/db/operations';
import { useTaskStore } from '../../src/store/taskStore';
import { useUiStore } from '../../src/store/uiStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useTaskStore.setState({ areas: [], projects: [], tasks: [], edges: [], trashedProjects: [], currentView: null });
  useUiStore.setState({ sidebarView: 'inbox', selectedTaskId: null, sidebarCollapsed: false, mobileSidebarOpen: false });
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

  it('completeTask does not complete a task blocked by an incomplete predecessor', async () => {
    const { data: project } = await createProject('Blocked test project');
    const { data: predecessor } = await createTask('Predecessor', { projectId: project!.id });
    const { data: blocked } = await createTask('Blocked task', { projectId: project!.id });
    await addDependency(predecessor!.id, blocked!.id, project!.id);

    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });
    await useTaskStore.getState().completeTask(blocked!.id);

    // The blocked task should still be open because its predecessor is incomplete
    const { tasks } = useTaskStore.getState();
    const blockedTask = tasks.find((t) => t.id === blocked!.id);
    expect(blockedTask!.status).toBe('open');
  });

  it('completeTask succeeds when all blocking predecessors are completed', async () => {
    const { data: project } = await createProject('Unblocked test project');
    const { data: predecessor } = await createTask('Predecessor', { projectId: project!.id });
    const { data: dependent } = await createTask('Dependent task', { projectId: project!.id });
    await addDependency(predecessor!.id, dependent!.id, project!.id);
    await updateTask(predecessor!.id, { status: 'completed', completedAt: Date.now() });

    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });
    await useTaskStore.getState().completeTask(dependent!.id);

    const { tasks } = useTaskStore.getState();
    const dependentTask = tasks.find((t) => t.id === dependent!.id);
    expect(dependentTask!.status).toBe('completed');
  });

  it('completeTask succeeds when blocking predecessor is canceled', async () => {
    const { data: project } = await createProject('Canceled blocker project');
    const { data: predecessor } = await createTask('Predecessor', { projectId: project!.id });
    const { data: dependent } = await createTask('Dependent task', { projectId: project!.id });
    await addDependency(predecessor!.id, dependent!.id, project!.id);
    await updateTask(predecessor!.id, { status: 'canceled', completedAt: Date.now() });

    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });
    await useTaskStore.getState().completeTask(dependent!.id);

    const { tasks } = useTaskStore.getState();
    const dependentTask = tasks.find((t) => t.id === dependent!.id);
    expect(dependentTask!.status).toBe('completed');
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

  // -- Edges (store-owned dependency edges) --

  it('loadTasksForView populates edges for a project view', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    await addDependency(t1!.id, t2!.id, project!.id);

    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });

    const { edges } = useTaskStore.getState();
    expect(edges).toHaveLength(1);
    expect(edges[0].fromTaskId).toBe(t1!.id);
    expect(edges[0].toTaskId).toBe(t2!.id);
  });

  it('loadTasksForView clears edges for non-project views', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    await addDependency(t1!.id, t2!.id, project!.id);

    // Seed edges from a project view, then switch to Inbox
    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });
    expect(useTaskStore.getState().edges).toHaveLength(1);

    await useTaskStore.getState().loadTasksForView('inbox');
    expect(useTaskStore.getState().edges).toEqual([]);
  });

  it('refreshTasks keeps edges in sync after dependency mutations', async () => {
    const { data: project } = await createProject('P1');
    const { data: t1 } = await createTask('T1', { projectId: project!.id });
    const { data: t2 } = await createTask('T2', { projectId: project!.id });
    await useTaskStore.getState().loadTasksForView({ type: 'project', projectId: project!.id });
    expect(useTaskStore.getState().edges).toHaveLength(0);

    await useTaskStore.getState().addDependency(t1!.id, t2!.id, project!.id);

    expect(useTaskStore.getState().edges).toHaveLength(1);
  });

  it('deleteTask soft-deletes and refreshes', async () => {
    const { data: task } = await createTask('Delete me');
    await useTaskStore.getState().loadTasksForView('inbox');
    expect(useTaskStore.getState().tasks).toHaveLength(1);

    await useTaskStore.getState().deleteTask(task!.id);

    expect(useTaskStore.getState().tasks).toHaveLength(0);
  });

  // -- Trash: deleted projects --

  it('trash view populates trashedProjects with soft-deleted projects', async () => {
    const { data: active } = await createProject('Active Project');
    const { data: deleted } = await createProject('Deleted Project');

    // Soft-delete one project directly so the trash view can surface it
    await useTaskStore.getState().loadTasksForView('inbox');
    await useTaskStore.getState().deleteProject(deleted!.id);

    await useTaskStore.getState().loadTasksForView('trash');

    const { trashedProjects } = useTaskStore.getState();
    expect(trashedProjects).toHaveLength(1);
    expect(trashedProjects[0].id).toBe(deleted!.id);
    // Active project must not appear in trash
    expect(trashedProjects.map((p) => p.id)).not.toContain(active!.id);
  });

  it('trash view does not include active projects in trashedProjects', async () => {
    await createProject('Live Project A');
    await createProject('Live Project B');

    await useTaskStore.getState().loadTasksForView('trash');

    expect(useTaskStore.getState().trashedProjects).toHaveLength(0);
  });

  it('restoreProject removes project from trashedProjects and reloads sidebar', async () => {
    const { data: project } = await createProject('Restore Me');
    await useTaskStore.getState().deleteProject(project!.id);
    await useTaskStore.getState().loadTasksForView('trash');
    expect(useTaskStore.getState().trashedProjects).toHaveLength(1);

    await useTaskStore.getState().restoreProject(project!.id);

    // trashedProjects should be empty after restore
    expect(useTaskStore.getState().trashedProjects).toHaveLength(0);
    // Project should be back in the sidebar (projects list)
    expect(useTaskStore.getState().projects.map((p) => p.id)).toContain(project!.id);
  });

  it('deleteProject soft-deletes project and it appears in trash view', async () => {
    const { data: project } = await createProject('Soft Delete Me');

    await useTaskStore.getState().loadTasksForView('inbox');
    await useTaskStore.getState().deleteProject(project!.id);

    // Project should no longer appear in sidebar
    expect(useTaskStore.getState().projects.map((p) => p.id)).not.toContain(project!.id);

    // Project should appear in trash
    await useTaskStore.getState().loadTasksForView('trash');
    expect(useTaskStore.getState().trashedProjects.map((p) => p.id)).toContain(project!.id);
  });

  it('restoring a project also restores its tasks', async () => {
    const { data: project } = await createProject('Project With Tasks');
    const { data: task } = await createTask('Task in project', { projectId: project!.id });

    await useTaskStore.getState().deleteProject(project!.id);
    // Task should appear in trash
    await useTaskStore.getState().loadTasksForView('trash');
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toContain(task!.id);

    await useTaskStore.getState().restoreProject(project!.id);

    // After restore, trash tasks should not contain the project task
    await useTaskStore.getState().loadTasksForView('trash');
    expect(useTaskStore.getState().tasks.map((t) => t.id)).not.toContain(task!.id);
  });

  // -- completeProject / cancelProject --

  it('completeProject sets status to completed in the DB', async () => {
    const { data: project } = await createProject('Ship it');

    await useTaskStore.getState().completeProject(project!.id);

    // getProjects() returns non-deleted projects regardless of status
    const all = await getProjects();
    const updated = all.find((p) => p.id === project!.id)!;
    expect(updated.status).toBe('completed');
    expect(updated.completedAt).toBeGreaterThan(0);
  });

  it('completeProject removes project from sidebar', async () => {
    const { data: project } = await createProject('Ship it');
    await useTaskStore.getState().loadSidebarData();
    expect(useTaskStore.getState().projects).toHaveLength(1);

    await useTaskStore.getState().completeProject(project!.id);

    expect(useTaskStore.getState().projects).toHaveLength(0);
  });

  it('completeProject navigates to inbox when the completed project is the active view', async () => {
    const { data: project } = await createProject('Active View Project');
    useUiStore.getState().setSidebarView({ type: 'project', projectId: project!.id });

    await useTaskStore.getState().completeProject(project!.id);

    expect(useUiStore.getState().sidebarView).toBe('inbox');
  });

  it('completeProject does not change the view when a different project is active', async () => {
    const { data: p1 } = await createProject('P1');
    const { data: p2 } = await createProject('P2');
    useUiStore.getState().setSidebarView({ type: 'project', projectId: p2!.id });

    await useTaskStore.getState().completeProject(p1!.id);

    const view = useUiStore.getState().sidebarView;
    expect(view).toEqual({ type: 'project', projectId: p2!.id });
  });

  it('cancelProject sets status to canceled in the DB', async () => {
    const { data: project } = await createProject('Drop it');

    await useTaskStore.getState().cancelProject(project!.id);

    const all = await getProjects();
    const updated = all.find((p) => p.id === project!.id)!;
    expect(updated.status).toBe('canceled');
  });

  it('cancelProject removes project from sidebar', async () => {
    const { data: project } = await createProject('Drop it');
    await useTaskStore.getState().loadSidebarData();
    expect(useTaskStore.getState().projects).toHaveLength(1);

    await useTaskStore.getState().cancelProject(project!.id);

    expect(useTaskStore.getState().projects).toHaveLength(0);
  });

  it('cancelProject navigates to inbox when the canceled project is the active view', async () => {
    const { data: project } = await createProject('Active View Project');
    useUiStore.getState().setSidebarView({ type: 'project', projectId: project!.id });

    await useTaskStore.getState().cancelProject(project!.id);

    expect(useUiStore.getState().sidebarView).toBe('inbox');
  });

  it('loadSidebarData excludes completed projects from the sidebar', async () => {
    const { data: active } = await createProject('Active');
    const { data: completed } = await createProject('Done');
    await useTaskStore.getState().completeProject(completed!.id);
    // Reset and reload to verify the filter is applied fresh
    useTaskStore.setState({ projects: [] });
    await useTaskStore.getState().loadSidebarData();

    const ids = useTaskStore.getState().projects.map((p) => p.id);
    expect(ids).toContain(active!.id);
    expect(ids).not.toContain(completed!.id);
  });

  it('loadSidebarData excludes canceled projects from the sidebar', async () => {
    const { data: active } = await createProject('Active');
    const { data: canceled } = await createProject('Dropped');
    await useTaskStore.getState().cancelProject(canceled!.id);
    useTaskStore.setState({ projects: [] });
    await useTaskStore.getState().loadSidebarData();

    const ids = useTaskStore.getState().projects.map((p) => p.id);
    expect(ids).toContain(active!.id);
    expect(ids).not.toContain(canceled!.id);
  });
});
