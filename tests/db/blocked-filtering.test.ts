import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProject,
  createTask,
  addDependency,
  updateTask,
  getTodayTasks,
  getAnytimeTasks,
} from '../../src/db/operations';
import { getLocalTodayDateString } from '../../src/lib/dates';
import { clearDatabase } from '../helpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('blocked task filtering', () => {
  it('excludes blocked tasks from Today view', async () => {
    const today = getLocalTodayDateString();
    const { data: project } = await createProject('P');
    const { data: blocker } = await createTask('Blocker', { projectId: project!.id, when: today });
    const { data: blocked } = await createTask('Blocked', { projectId: project!.id, when: today });
    await addDependency(blocker!.id, blocked!.id, project!.id);

    const todayTasks = await getTodayTasks();
    const ids = todayTasks.map((t) => t.id);

    expect(ids).toContain(blocker!.id);
    expect(ids).not.toContain(blocked!.id);
  });

  it('includes unblocked tasks in Today view after dependency resolved', async () => {
    const today = getLocalTodayDateString();
    const { data: project } = await createProject('P');
    const { data: blocker } = await createTask('Blocker', { projectId: project!.id, when: today });
    const { data: blocked } = await createTask('Blocked', { projectId: project!.id, when: today });
    await addDependency(blocker!.id, blocked!.id, project!.id);

    // Complete the blocker
    await updateTask(blocker!.id, { status: 'completed', completedAt: Date.now() });

    const todayTasks = await getTodayTasks();
    const ids = todayTasks.map((t) => t.id);

    // Blocked task is now unblocked
    expect(ids).toContain(blocked!.id);
  });

  it('excludes blocked tasks from Anytime view', async () => {
    const { data: project } = await createProject('P');
    const { data: blocker } = await createTask('Blocker', { projectId: project!.id });
    const { data: blocked } = await createTask('Blocked', { projectId: project!.id });
    await addDependency(blocker!.id, blocked!.id, project!.id);

    const anytimeTasks = await getAnytimeTasks();
    const ids = anytimeTasks.map((t) => t.id);

    expect(ids).toContain(blocker!.id);
    expect(ids).not.toContain(blocked!.id);
  });

  it('filters correctly when Today view spans multiple projects (scoped edge query)', async () => {
    // Regression test for #11: getAllBlockedTaskIds was rewritten to scope
    // edges to the projects visible in the view rather than scanning the
    // whole dependencyEdges table. Verify blocking still works across
    // projects and that unrelated-project edges do not leak in.
    const today = getLocalTodayDateString();
    const { data: pA } = await createProject('A');
    const { data: pB } = await createProject('B');
    const { data: pC } = await createProject('C');

    const { data: a1 } = await createTask('A blocker', { projectId: pA!.id, when: today });
    const { data: a2 } = await createTask('A blocked', { projectId: pA!.id, when: today });
    await addDependency(a1!.id, a2!.id, pA!.id);

    const { data: b1 } = await createTask('B blocker', { projectId: pB!.id, when: today });
    const { data: b2 } = await createTask('B blocked', { projectId: pB!.id, when: today });
    await addDependency(b1!.id, b2!.id, pB!.id);

    // Project C has an unrelated edge between tasks that are not in the Today view.
    const { data: c1 } = await createTask('C1', { projectId: pC!.id });
    const { data: c2 } = await createTask('C2', { projectId: pC!.id });
    await addDependency(c1!.id, c2!.id, pC!.id);

    const ids = (await getTodayTasks()).map((t) => t.id);
    expect(ids).toContain(a1!.id);
    expect(ids).not.toContain(a2!.id);
    expect(ids).toContain(b1!.id);
    expect(ids).not.toContain(b2!.id);
    // Project C tasks are not in Today at all, but this asserts the scoped
    // edge query didn't throw or miscount when some projects have edges
    // that aren't relevant to the view.
    expect(ids).not.toContain(c1!.id);
    expect(ids).not.toContain(c2!.id);
  });

  it('does not filter tasks without dependencies', async () => {
    const today = getLocalTodayDateString();
    await createTask('Regular task', { when: today });

    const todayTasks = await getTodayTasks();
    expect(todayTasks.length).toBe(1);
    expect(todayTasks[0].title).toBe('Regular task');
  });
});
