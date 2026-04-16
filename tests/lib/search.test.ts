// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { searchAll } from '../../src/lib/search';
import { createTask, createProject } from '../../src/db/operations';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('searchAll', () => {
  it('returns empty array for empty query', async () => {
    await createTask('Something');
    expect(await searchAll('')).toEqual([]);
    expect(await searchAll('   ')).toEqual([]);
  });

  it('matches tasks by title (case-insensitive)', async () => {
    await createTask('Buy groceries');
    await createTask('Read a book');
    const results = await searchAll('buy');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Buy groceries');
    expect(results[0].type).toBe('task');
  });

  it('matches tasks by notes content', async () => {
    const { data: task } = await createTask('Weekly review');
    // Add notes via direct db update (createTask doesn't populate notes
    // unless the option is passed, but we need content for this test).
    const { updateTask } = await import('../../src/db/operations');
    await updateTask(task!.id, { notes: 'Check the project board for blockers' });

    const results = await searchAll('blockers');
    expect(results).toHaveLength(1);
    expect(results[0].matchContext).toContain('blockers');
  });

  it('matches projects by title', async () => {
    await createProject('Website Redesign');
    const results = await searchAll('redesign');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('project');
    expect(results[0].title).toBe('Website Redesign');
  });

  it('includes projectTitle for tasks in a project', async () => {
    const { data: project } = await createProject('My Project');
    await createTask('Task inside project', { projectId: project!.id });
    const results = await searchAll('inside');
    expect(results).toHaveLength(1);
    expect(results[0].projectTitle).toBe('My Project');
    expect(results[0].projectId).toBe(project!.id);
  });

  it('excludes soft-deleted tasks', async () => {
    const { data: task } = await createTask('Deleted item');
    const { softDeleteTask } = await import('../../src/db/operations');
    await softDeleteTask(task!.id);
    const results = await searchAll('deleted');
    expect(results).toHaveLength(0);
  });

  it('returns both tasks and projects when both match', async () => {
    await createProject('Alpha launch');
    await createTask('Alpha testing');
    const results = await searchAll('alpha');
    expect(results).toHaveLength(2);
    const types = results.map((r) => r.type);
    expect(types).toContain('task');
    expect(types).toContain('project');
  });

  it('produces a snippet with context around the notes match', async () => {
    const { data: task } = await createTask('Long notes task');
    const { updateTask } = await import('../../src/db/operations');
    const longNotes = 'A'.repeat(60) + 'KEYWORD' + 'B'.repeat(60);
    await updateTask(task!.id, { notes: longNotes });

    const results = await searchAll('keyword');
    expect(results).toHaveLength(1);
    const ctx = results[0].matchContext!;
    expect(ctx).toContain('KEYWORD');
    expect(ctx.startsWith('...')).toBe(true);
    expect(ctx.endsWith('...')).toBe(true);
  });
});
