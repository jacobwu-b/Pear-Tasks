import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import { createArea, createProject } from '../../src/db/operations';
import { useTaskStore } from '../../src/store/taskStore';

beforeEach(async () => {
  await db.delete();
  await db.open();
  useTaskStore.setState({ areas: [], projects: [] });
});

describe('taskStore', () => {
  it('starts with empty arrays', () => {
    const state = useTaskStore.getState();
    expect(state.areas).toEqual([]);
    expect(state.projects).toEqual([]);
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
});
