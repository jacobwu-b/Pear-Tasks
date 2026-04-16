import { db } from './schema';
import type {
  Area,
  Project,
  Task,
  ChecklistItem,
  DependencyEdge,
  ProjectTemplate,
} from '../types';

const CURRENT_VERSION = 2;

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
  if (obj.version !== CURRENT_VERSION) {
    return {
      ok: false,
      error: `Version mismatch: file is v${obj.version}, app expects v${CURRENT_VERSION}. Cannot import.`,
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
  return { ok: true };
}

export async function importDatabase(data: PearExport): Promise<ImportResult> {
  const validation = validateExport(data);
  if (!validation.ok) return validation;

  try {
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
      const t = data.tables;
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
