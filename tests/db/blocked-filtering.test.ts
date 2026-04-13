import { describe, it, expect, beforeEach } from 'vitest';
import {
  createProject,
  createTask,
  addDependency,
  updateTask,
  getTodayTasks,
  getAnytimeTasks,
} from '../../src/db/operations';
import { clearDatabase } from '../helpers';

beforeEach(async () => {
  await clearDatabase();
});

describe('blocked task filtering', () => {
  it('excludes blocked tasks from Today view', async () => {
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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

  it('does not filter tasks without dependencies', async () => {
    const today = new Date().toISOString().split('T')[0];
    await createTask('Regular task', { when: today });

    const todayTasks = await getTodayTasks();
    expect(todayTasks.length).toBe(1);
    expect(todayTasks[0].title).toBe('Regular task');
  });
});
