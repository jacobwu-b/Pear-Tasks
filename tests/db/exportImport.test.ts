// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  exportDatabase,
  importDatabase,
  validateExport,
  type PearExport,
} from '../../src/db/exportImport';
import { createTask, createProject, createArea, getAreas, getTask } from '../../src/db/operations';
import { db } from '../../src/db/schema';
import type { RecurrenceConfig } from '../../src/types';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('exportDatabase', () => {
  it('exports all tables with the correct envelope', async () => {
    await createArea('Work');
    await createProject('Website');
    await createTask('Design homepage');

    const data = await exportDatabase();
    expect(data.app).toBe('pear-tasks');
    expect(data.version).toBe(3);
    expect(data.exportedAt).toBeTruthy();
    expect(data.tables.areas).toHaveLength(1);
    expect(data.tables.projects).toHaveLength(1);
    expect(data.tables.tasks).toHaveLength(1);
    expect(data.tables.checklistItems).toHaveLength(0);
    expect(data.tables.dependencyEdges).toHaveLength(0);
  });

  it('exports an empty database with empty arrays', async () => {
    const data = await exportDatabase();
    expect(data.tables.tasks).toEqual([]);
    expect(data.tables.projects).toEqual([]);
    expect(data.tables.areas).toEqual([]);
  });
});

describe('validateExport', () => {
  it('rejects non-objects', () => {
    expect(validateExport(null)).toEqual({ ok: false, error: expect.stringContaining('not a JSON object') });
    expect(validateExport('hello')).toEqual({ ok: false, error: expect.stringContaining('not a JSON object') });
  });

  it('rejects wrong app identifier', () => {
    expect(validateExport({ app: 'other-app', version: 3, tables: {} })).toEqual({
      ok: false,
      error: expect.stringContaining('not a Pear Tasks export'),
    });
  });

  it('rejects version mismatch on unknown versions', () => {
    const result = validateExport({
      app: 'pear-tasks',
      version: 99,
      tables: {
        areas: [], projects: [], tasks: [], checklistItems: [],
        dependencyEdges: [], templates: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Version mismatch');
  });

  it('rejects v1 envelopes', () => {
    const result = validateExport({
      app: 'pear-tasks',
      version: 1,
      tables: {
        areas: [], projects: [], tasks: [], checklistItems: [],
        dependencyEdges: [], templates: [],
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Version mismatch');
  });

  it('rejects missing tables', () => {
    expect(validateExport({ app: 'pear-tasks', version: 3, tables: {} })).toEqual({
      ok: false,
      error: expect.stringContaining('missing or invalid table'),
    });
  });

  it('accepts a v3 export', () => {
    const valid = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [], projects: [], tasks: [], checklistItems: [],
        dependencyEdges: [], templates: [],
      },
    };
    expect(validateExport(valid)).toEqual({ ok: true });
  });

  it('accepts a v2 export for backward compatibility', () => {
    const valid = {
      app: 'pear-tasks',
      version: 2,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [], projects: [], tasks: [], checklistItems: [],
        dependencyEdges: [], templates: [],
      },
    };
    expect(validateExport(valid)).toEqual({ ok: true });
  });
});

describe('importDatabase', () => {
  it('replaces all data with the imported data', async () => {
    // Pre-populate with existing data that should be wiped.
    await createArea('Old Area');
    await createTask('Old Task');

    // Build an export with different data.
    const importData: PearExport = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [{
          id: 'imported-area-1',
          title: 'Imported Area',
          sortOrder: 0,
          createdAt: Date.now(),
          deletedAt: null,
        }],
        projects: [],
        tasks: [{
          id: 'imported-task-1',
          title: 'Imported Task',
          notes: '',
          status: 'open',
          when: null,
          deadline: null,
          tags: [],
          projectId: null,
          areaId: null,
          sortOrder: 0,
          createdAt: Date.now(),
          completedAt: null,
          deletedAt: null,
          recurrence: null,
          recurringParentId: null,
        }],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
    };

    const result = await importDatabase(importData);
    expect(result).toEqual({ ok: true });

    // Old data should be gone.
    const areas = await getAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].title).toBe('Imported Area');

    const task = await getTask('imported-task-1');
    expect(task).toBeDefined();
    expect(task!.title).toBe('Imported Task');
  });

  it('upgrades v2 envelopes by defaulting recurrence fields to null', async () => {
    // v2 task literal — no recurrence or recurringParentId fields.
    const v2Import = {
      app: 'pear-tasks',
      version: 2,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [],
        tasks: [{
          id: 'v2-task-1',
          title: 'Legacy Task',
          notes: '',
          status: 'open',
          when: null,
          deadline: null,
          tags: [],
          projectId: null,
          areaId: null,
          sortOrder: 0,
          createdAt: Date.now(),
          completedAt: null,
          deletedAt: null,
        }],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
    } as unknown as PearExport;

    const result = await importDatabase(v2Import);
    expect(result).toEqual({ ok: true });

    const task = await getTask('v2-task-1');
    expect(task).toBeDefined();
    expect(task!.recurrence).toBeNull();
    expect(task!.recurringParentId).toBeNull();
  });

  it('round-trips a non-trivial recurrence config through export and import', async () => {
    await createTask('Weekly review');
    // Fetch the task to get its generated id, then attach a recurrence rule.
    const { getInboxTasks } = await import('../../src/db/operations');
    const inbox = await getInboxTasks();
    const created = inbox[0];

    const recurrence: RecurrenceConfig = {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5], // Mon/Wed/Fri
      monthlySpec: null,
      month: null,
      endDate: '2026-12-31',
    };
    await db.tasks.update(created.id, {
      recurrence,
      recurringParentId: null,
    });

    const exported = await exportDatabase();
    expect(exported.version).toBe(3);
    const exportedTask = exported.tables.tasks.find((t) => t.id === created.id);
    expect(exportedTask?.recurrence).toEqual(recurrence);

    await clearDatabase();
    const result = await importDatabase(exported);
    expect(result).toEqual({ ok: true });

    const reimported = await getTask(created.id);
    expect(reimported).toBeDefined();
    expect(reimported!.recurrence).toEqual(recurrence);
    expect(reimported!.recurringParentId).toBeNull();
  });

  it('rejects invalid data without modifying the database', async () => {
    await createTask('Existing Task');

    const result = await importDatabase({ app: 'wrong' } as unknown as PearExport);
    expect(result.ok).toBe(false);

    // Data should still be intact.
    const { getInboxTasks } = await import('../../src/db/operations');
    const tasks = await getInboxTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Existing Task');
  });
});
