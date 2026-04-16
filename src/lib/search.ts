import { db } from '../db/schema';
import type { Project } from '../types';

export interface SearchResult {
  type: 'task' | 'project';
  id: string;
  title: string;
  /** Short snippet from notes showing context around the first match. */
  matchContext: string | null;
  projectId: string | null;
  projectTitle: string | null;
  status: string;
}

const CONTEXT_RADIUS = 40;

function snippetAround(text: string, index: number): string {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(text.length, index + CONTEXT_RADIUS);
  let snippet = text.slice(start, end).replace(/\n/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet += '...';
  return snippet;
}

/**
 * Full-text search across non-deleted tasks and projects. Matches
 * against title and notes (case-insensitive substring). Results are
 * returned with enough context for the palette to group by project.
 *
 * With <500 tasks this is a simple scan — no search index needed.
 */
export async function searchAll(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const [tasks, projects] = await Promise.all([
    db.tasks.filter((t) => t.deletedAt === null).toArray(),
    db.projects.filter((p) => p.deletedAt === null).toArray(),
  ]);

  const projectMap = new Map<string, Project>();
  for (const p of projects) projectMap.set(p.id, p);

  const results: SearchResult[] = [];

  for (const project of projects) {
    const titleMatch = project.title.toLowerCase().includes(q);
    const notesIdx = project.notes.toLowerCase().indexOf(q);
    if (titleMatch || notesIdx >= 0) {
      results.push({
        type: 'project',
        id: project.id,
        title: project.title,
        matchContext: notesIdx >= 0 ? snippetAround(project.notes, notesIdx) : null,
        projectId: null,
        projectTitle: null,
        status: project.status,
      });
    }
  }

  for (const task of tasks) {
    const titleMatch = task.title.toLowerCase().includes(q);
    const notesIdx = task.notes.toLowerCase().indexOf(q);
    if (titleMatch || notesIdx >= 0) {
      const proj = task.projectId ? projectMap.get(task.projectId) : null;
      results.push({
        type: 'task',
        id: task.id,
        title: task.title,
        matchContext: notesIdx >= 0 ? snippetAround(task.notes, notesIdx) : null,
        projectId: task.projectId,
        projectTitle: proj?.title ?? null,
        status: task.status,
      });
    }
  }

  return results;
}
