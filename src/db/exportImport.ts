import { db } from './schema';
import type {
  Area,
  Project,
  Task,
  ChecklistItem,
  DependencyEdge,
  ProjectTemplate,
  TaskStatus,
  ProjectStatus,
  RecurrenceFrequency,
} from '../types';

const CURRENT_VERSION = 3;
// Older versions we still know how to import by upgrading the payload in memory.
const SUPPORTED_VERSIONS: readonly number[] = [2, 3];

export interface PearExport {
  app: 'pear-tasks';
  version: number;
  exportedAt: string;
  tables: {
    areas: Area[];
    projects: Project[];
    tasks: Task[];
    checklistItems: ChecklistItem[];
    dependencyEdges: DependencyEdge[];
    templates: ProjectTemplate[];
  };
}

export async function exportDatabase(): Promise<PearExport> {
  const [areas, projects, tasks, checklistItems, dependencyEdges, templates] =
    await Promise.all([
      db.areas.toArray(),
      db.projects.toArray(),
      db.tasks.toArray(),
      db.checklistItems.toArray(),
      db.dependencyEdges.toArray(),
      db.templates.toArray(),
    ]);

  return {
    app: 'pear-tasks',
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    tables: { areas, projects, tasks, checklistItems, dependencyEdges, templates },
  };
}

export function downloadJson(data: PearExport): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `pear-tasks-export-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type ImportResult =
  | { ok: true }
  | { ok: false; error: string };

const TASK_STATUSES: readonly TaskStatus[] = ['open', 'completed', 'canceled'];
const PROJECT_STATUSES: readonly ProjectStatus[] = ['active', 'completed', 'canceled', 'someday'];
const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

// Primitive field checks. Each returns true when the value is acceptable for
// the field. Numbers must be finite so NaN/Infinity can't poison sort/date math.
type FieldCheck = (value: unknown) => boolean;

const str: FieldCheck = (v) => typeof v === 'string';
const nonEmptyStr: FieldCheck = (v) => typeof v === 'string' && v.length > 0;
const num: FieldCheck = (v) => typeof v === 'number' && Number.isFinite(v);
const bool: FieldCheck = (v) => typeof v === 'boolean';
const strOrNull: FieldCheck = (v) => v === null || typeof v === 'string';
const numOrNull: FieldCheck = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
const strArray: FieldCheck = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isArray: FieldCheck = (v) => Array.isArray(v);
const oneOf =
  (allowed: readonly string[]): FieldCheck =>
  (v) => typeof v === 'string' && allowed.includes(v);

// recurrence is absent on v2 payloads (backfilled to null by upgradePayload),
// so undefined is tolerated. When present it must be a config with a valid
// frequency enum, finite interval, and array of weekdays.
const recurrenceField: FieldCheck = (v) => {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return oneOf(RECURRENCE_FREQUENCIES)(r.frequency) && num(r.interval) && Array.isArray(r.daysOfWeek);
};
// recurringParentId is also absent on v2 payloads.
const recurringParentIdField: FieldCheck = (v) => v === undefined || strOrNull(v);

type RecordSchema = Record<string, FieldCheck>;

const SCHEMAS: Record<string, RecordSchema> = {
  areas: { id: nonEmptyStr, title: str, sortOrder: num, createdAt: num, deletedAt: numOrNull },
  projects: {
    id: nonEmptyStr, title: str, notes: str, status: oneOf(PROJECT_STATUSES),
    areaId: strOrNull, deadline: strOrNull, tags: strArray, sortOrder: num,
    createdAt: num, completedAt: numOrNull, deletedAt: numOrNull,
  },
  tasks: {
    id: nonEmptyStr, title: str, notes: str, status: oneOf(TASK_STATUSES),
    when: strOrNull, deadline: strOrNull, tags: strArray, projectId: strOrNull,
    areaId: strOrNull, sortOrder: num, createdAt: num, completedAt: numOrNull,
    deletedAt: numOrNull, recurrence: recurrenceField, recurringParentId: recurringParentIdField,
  },
  checklistItems: { id: nonEmptyStr, taskId: nonEmptyStr, title: str, completed: bool, sortOrder: num },
  dependencyEdges: { id: nonEmptyStr, fromTaskId: nonEmptyStr, toTaskId: nonEmptyStr, projectId: nonEmptyStr },
  templates: { id: nonEmptyStr, name: str, builtIn: bool, tasks: isArray, edges: isArray },
};

function validateRecords(records: unknown[], schema: RecordSchema, table: string): string | null {
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record || typeof record !== 'object') {
      return `Invalid file: ${table}[${i}] is not an object.`;
    }
    const r = record as Record<string, unknown>;
    for (const field in schema) {
      if (!schema[field](r[field])) {
        return `Invalid file: ${table}[${i}] has an invalid "${field}".`;
      }
    }
  }
  return null;
}

export function validateExport(data: unknown): ImportResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid file: not a JSON object.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.app !== 'pear-tasks') {
    return { ok: false, error: 'Invalid file: not a Pear Tasks export.' };
  }
  if (typeof obj.version !== 'number') {
    return { ok: false, error: 'Invalid file: missing version number.' };
  }
  if (!SUPPORTED_VERSIONS.includes(obj.version)) {
    return {
      ok: false,
      error: `Version mismatch: file is v${obj.version}, app supports v${SUPPORTED_VERSIONS.join(', v')}. Cannot import.`,
    };
  }
  if (!obj.tables || typeof obj.tables !== 'object') {
    return { ok: false, error: 'Invalid file: missing tables.' };
  }
  const tables = obj.tables as Record<string, unknown>;
  const required = ['areas', 'projects', 'tasks', 'checklistItems', 'dependencyEdges', 'templates'];
  for (const key of required) {
    if (!Array.isArray(tables[key])) {
      return { ok: false, error: `Invalid file: missing or invalid table "${key}".` };
    }
  }
  for (const key of required) {
    const error = validateRecords(tables[key] as unknown[], SCHEMAS[key], key);
    if (error) return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Bring a payload from any SUPPORTED_VERSIONS up to CURRENT_VERSION in memory.
 * v2 tasks predate recurrence; default both fields to null to match the Dexie
 * v2→v3 upgrade hook in schema.ts.
 */
function upgradePayload(data: PearExport): PearExport {
  if (data.version === CURRENT_VERSION) return data;
  const tasks = data.tables.tasks.map((t) => ({
    ...t,
    recurrence: t.recurrence ?? null,
    recurringParentId: t.recurringParentId ?? null,
  }));
  return {
    ...data,
    version: CURRENT_VERSION,
    tables: { ...data.tables, tasks },
  };
}

export async function importDatabase(data: PearExport): Promise<ImportResult> {
  const validation = validateExport(data);
  if (!validation.ok) return validation;

  const upgraded = upgradePayload(data);

  try {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
      const t = upgraded.tables;
      await db.areas.bulkAdd(t.areas);
      await db.projects.bulkAdd(t.projects);
      await db.tasks.bulkAdd(t.tasks);
      await db.checklistItems.bulkAdd(t.checklistItems);
      await db.dependencyEdges.bulkAdd(t.dependencyEdges);
      await db.templates.bulkAdd(t.templates);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Import failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error('File is not valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}
