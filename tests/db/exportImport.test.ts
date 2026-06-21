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

describe('validateExport per-record validation', () => {
  const validTask = {
    id: 'task-1',
    title: 'Ship release',
    notes: '',
    status: 'open',
    when: null,
    deadline: null,
    tags: ['work'],
    projectId: null,
    areaId: null,
    sortOrder: 0,
    createdAt: 1_700_000_000_000,
    completedAt: null,
    deletedAt: null,
    recurrence: null,
    recurringParentId: null,
  };

  function omit<T extends object>(obj: T, ...keys: (keyof T)[]): Partial<T> {
    const copy = { ...obj };
    for (const key of keys) delete copy[key];
    return copy;
  }

  function envelopeWith(tableName: string, records: unknown[]) {
    return {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [], projects: [], tasks: [], checklistItems: [],
        dependencyEdges: [], templates: [],
        [tableName]: records,
      },
    };
  }

  it('accepts a fully-formed task record', () => {
    expect(validateExport(envelopeWith('tasks', [validTask]))).toEqual({ ok: true });
  });

  it('rejects a task whose status is not a known enum value', () => {
    const result = validateExport(envelopeWith('tasks', [{ ...validTask, status: 'archived' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('status');
  });

  it('rejects a task whose deletedAt is undefined rather than null', () => {
    const result = validateExport(envelopeWith('tasks', [omit(validTask, 'deletedAt')]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('deletedAt');
  });

  it('rejects a task whose tags is not an array', () => {
    const result = validateExport(envelopeWith('tasks', [{ ...validTask, tags: 'work' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('tags');
  });

  it('rejects a task that is missing its when field', () => {
    const result = validateExport(envelopeWith('tasks', [omit(validTask, 'when')]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('when');
  });

  it('rejects a task with a missing id', () => {
    const result = validateExport(envelopeWith('tasks', [omit(validTask, 'id')]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('id');
  });

  it('rejects a project whose status is out of enum', () => {
    const badProject = {
      id: 'project-1',
      title: 'Website',
      notes: '',
      status: 'archived',
      areaId: null,
      deadline: null,
      tags: [],
      sortOrder: 0,
      createdAt: 1_700_000_000_000,
      completedAt: null,
      deletedAt: null,
    };
    const result = validateExport(envelopeWith('projects', [badProject]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('status');
  });

  it('rejects a dependency edge that is missing its projectId', () => {
    const badEdge = { id: 'edge-1', fromTaskId: 'a', toTaskId: 'b' };
    const result = validateExport(envelopeWith('dependencyEdges', [badEdge]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('projectId');
  });

  it('tolerates v2 tasks that omit recurrence fields', () => {
    const v2Task = omit(validTask, 'recurrence', 'recurringParentId');
    const envelope = {
      app: 'pear-tasks',
      version: 2,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [], projects: [], tasks: [v2Task], checklistItems: [],
        dependencyEdges: [], templates: [],
      },
    };
    expect(validateExport(envelope)).toEqual({ ok: true });
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

  it('rejects a malformed record without modifying the database', async () => {
    await createTask('Existing Task');

    // A record with a valid id but a corrupt deletedAt — the exact shape the
    // sync poller would otherwise auto-apply, silently hiding the row from views.
    const malformed = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [],
        tasks: [{
          id: 'corrupt-task',
          title: 'Corrupt Task',
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
          deletedAt: undefined,
          recurrence: null,
          recurringParentId: null,
        }],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
    } as unknown as PearExport;

    const result = await importDatabase(malformed);
    expect(result.ok).toBe(false);

    // The pre-existing data must be untouched — no clear(), no partial write.
    const { getInboxTasks } = await import('../../src/db/operations');
    const tasks = await getInboxTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Existing Task');
  });

  it('preserves the connected sync-file handle row across an import', async () => {
    // Simulate a connected sync file: a persisted singleton handle row.
    await db.syncFile.put({
      id: 'singleton',
      handle: {} as FileSystemFileHandle,
      fileName: 'pear-db.json',
      connectedAt: Date.now(),
      lastSyncVersion: 4,
      lastSavedAt: Date.now(),
    });

    const importData: PearExport = {
      app: 'pear-tasks',
      version: 3,
      exportedAt: new Date().toISOString(),
      tables: {
        areas: [],
        projects: [],
        tasks: [],
        checklistItems: [],
        dependencyEdges: [],
        templates: [],
      },
    };

    const result = await importDatabase(importData);
    expect(result).toEqual({ ok: true });

    // The handle row — and its sync bookkeeping — must survive the import,
    // otherwise the connection is silently destroyed (issue #51).
    const row = await db.syncFile.get('singleton');
    expect(row).toBeDefined();
    expect(row!.fileName).toBe('pear-db.json');
    expect(row!.lastSyncVersion).toBe(4);
  });
});
