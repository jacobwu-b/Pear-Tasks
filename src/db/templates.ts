import { db } from './schema';
import {
  createProject,
  createTask,
  addChecklistItem,
  addDependency,
  getTasksByProject,
  getChecklistItems,
  getDependencyEdges,
} from './operations';
import type { ProjectTemplate, TemplateTask, TemplateEdge } from '../types';

type Result<T> = { data: T; error: null } | { data: null; error: string };

function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

function err<T>(message: string): Result<T> {
  return { data: null, error: message };
}

// ── Built-in template definitions ─────────────────────────────────

const BUILT_IN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'builtin-software-project',
    name: 'Software Project',
    builtIn: true,
    tasks: [
      { tempId: 'sw-1', title: 'PRD', checklistTitles: ['Define problem statement', 'Identify target user', 'List requirements', 'Define success metrics'] },
      { tempId: 'sw-2', title: 'Tech Spec', checklistTitles: ['Choose architecture', 'Define data model', 'Plan API endpoints', 'Identify risks'] },
      { tempId: 'sw-3', title: 'Implementation', checklistTitles: ['Set up project scaffold', 'Implement core features', 'Handle edge cases'] },
      { tempId: 'sw-4', title: 'Code Review', checklistTitles: ['Self-review diff', 'Address feedback', 'Verify CI passes'] },
      { tempId: 'sw-5', title: 'Testing', checklistTitles: ['Write unit tests', 'Write integration tests', 'Manual QA pass'] },
      { tempId: 'sw-6', title: 'Launch', checklistTitles: ['Deploy to production', 'Monitor for errors', 'Announce release'] },
    ],
    edges: [
      { fromTempId: 'sw-1', toTempId: 'sw-2' },
      { fromTempId: 'sw-2', toTempId: 'sw-3' },
      { fromTempId: 'sw-3', toTempId: 'sw-4' },
      { fromTempId: 'sw-4', toTempId: 'sw-5' },
      { fromTempId: 'sw-5', toTempId: 'sw-6' },
    ],
  },
  {
    id: 'builtin-blog-post',
    name: 'Blog Post',
    builtIn: true,
    tasks: [
      { tempId: 'bp-1', title: 'Outline', checklistTitles: ['Choose topic', 'Research key points', 'Draft structure'] },
      { tempId: 'bp-2', title: 'Draft', checklistTitles: ['Write introduction', 'Write body sections', 'Write conclusion'] },
      { tempId: 'bp-3', title: 'Edit', checklistTitles: ['Proofread for clarity', 'Check grammar and spelling', 'Get peer feedback'] },
      { tempId: 'bp-4', title: 'Graphics', checklistTitles: ['Create hero image', 'Add inline diagrams', 'Optimize for web'] },
      { tempId: 'bp-5', title: 'Publish', checklistTitles: ['Format in CMS', 'Add meta description', 'Share on social media'] },
    ],
    edges: [
      { fromTempId: 'bp-1', toTempId: 'bp-2' },
      { fromTempId: 'bp-2', toTempId: 'bp-3' },
      { fromTempId: 'bp-3', toTempId: 'bp-4' },
      { fromTempId: 'bp-4', toTempId: 'bp-5' },
    ],
  },
  {
    id: 'builtin-bug-fix',
    name: 'Bug Fix',
    builtIn: true,
    tasks: [
      { tempId: 'bf-1', title: 'Reproduce', checklistTitles: ['Identify steps to reproduce', 'Confirm on latest version', 'Document expected vs actual behavior'] },
      { tempId: 'bf-2', title: 'Root Cause', checklistTitles: ['Read relevant code', 'Add debug logging', 'Identify the faulty logic'] },
      { tempId: 'bf-3', title: 'Fix', checklistTitles: ['Implement the fix', 'Add regression test', 'Self-review changes'] },
      { tempId: 'bf-4', title: 'Test', checklistTitles: ['Run full test suite', 'Manual verification', 'Test edge cases'] },
      { tempId: 'bf-5', title: 'Deploy', checklistTitles: ['Merge to main', 'Deploy to production', 'Verify fix in prod'] },
    ],
    edges: [
      { fromTempId: 'bf-1', toTempId: 'bf-2' },
      { fromTempId: 'bf-2', toTempId: 'bf-3' },
      { fromTempId: 'bf-3', toTempId: 'bf-4' },
      { fromTempId: 'bf-4', toTempId: 'bf-5' },
    ],
  },
  {
    id: 'builtin-research-paper',
    name: 'Research Paper',
    builtIn: true,
    tasks: [
      { tempId: 'rp-1', title: 'Literature Review', checklistTitles: ['Search databases', 'Read key papers', 'Identify gaps'] },
      { tempId: 'rp-2', title: 'Methodology', checklistTitles: ['Choose research method', 'Define variables', 'Plan data collection'] },
      { tempId: 'rp-3', title: 'Data Collection', checklistTitles: ['Gather data', 'Organize datasets', 'Clean and validate'] },
      { tempId: 'rp-4', title: 'Analysis', checklistTitles: ['Run statistical analysis', 'Create visualizations', 'Interpret results'] },
      { tempId: 'rp-5', title: 'Writing', checklistTitles: ['Write abstract', 'Write methods and results', 'Write discussion'] },
      { tempId: 'rp-6', title: 'Peer Review', checklistTitles: ['Submit for review', 'Address feedback', 'Finalize manuscript'] },
    ],
    edges: [
      { fromTempId: 'rp-1', toTempId: 'rp-2' },
      { fromTempId: 'rp-2', toTempId: 'rp-3' },
      { fromTempId: 'rp-3', toTempId: 'rp-4' },
      { fromTempId: 'rp-4', toTempId: 'rp-5' },
      { fromTempId: 'rp-5', toTempId: 'rp-6' },
    ],
  },
];

// ── Seed built-in templates ───────────────────────────────────────

export async function seedBuiltInTemplates(): Promise<void> {
  for (const template of BUILT_IN_TEMPLATES) {
    const existing = await db.templates.get(template.id);
    if (!existing) {
      await db.templates.add(template);
    }
  }
}

// ── Template CRUD ─────────────────────────────────────────────────

export async function getTemplates(): Promise<ProjectTemplate[]> {
  return db.templates.toArray();
}

export async function getTemplate(id: string): Promise<ProjectTemplate | undefined> {
  return db.templates.get(id);
}

export async function updateTemplate(
  id: string,
  changes: Partial<Pick<ProjectTemplate, 'name'>>
): Promise<Result<ProjectTemplate>> {
  const template = await db.templates.get(id);
  if (!template) return err('Template not found');
  if (template.builtIn) return err('Cannot modify built-in templates');
  if (changes.name !== undefined && !changes.name.trim()) return err('Template name is required');

  await db.templates.update(id, changes);
  const updated = await db.templates.get(id);
  return ok(updated!);
}

export async function deleteTemplate(id: string): Promise<Result<void>> {
  const template = await db.templates.get(id);
  if (!template) return err('Template not found');
  if (template.builtIn) return err('Cannot delete built-in templates');
  await db.templates.delete(id);
  return ok(undefined);
}

// ── Instantiate template → creates a new project ──────────────────

export async function instantiateTemplate(
  templateId: string,
  projectName: string,
  areaId: string | null
): Promise<Result<{ projectId: string }>> {
  const template = await db.templates.get(templateId);
  if (!template) return err('Template not found');

  // Create the project
  const projectResult = await createProject(projectName, areaId);
  if (projectResult.error) return err(projectResult.error);
  const project = projectResult.data!;

  // Create tasks and map tempId → real taskId
  const tempIdToTaskId = new Map<string, string>();

  for (let i = 0; i < template.tasks.length; i++) {
    const tmplTask = template.tasks[i];
    const taskResult = await createTask(tmplTask.title, { projectId: project.id });
    if (taskResult.error) continue;
    const task = taskResult.data!;
    tempIdToTaskId.set(tmplTask.tempId, task.id);

    // Create checklist items
    for (const checkTitle of tmplTask.checklistTitles) {
      await addChecklistItem(task.id, checkTitle);
    }
  }

  // Wire dependency edges
  for (const edge of template.edges) {
    const fromId = tempIdToTaskId.get(edge.fromTempId);
    const toId = tempIdToTaskId.get(edge.toTempId);
    if (fromId && toId) {
      await addDependency(fromId, toId, project.id);
    }
  }

  return ok({ projectId: project.id });
}

// ── Save existing project as template ─────────────────────────────

export async function saveAsTemplate(
  projectId: string,
  name: string
): Promise<Result<ProjectTemplate>> {
  const tasks = await getTasksByProject(projectId);
  if (tasks.length === 0) return err('Project has no tasks to save as template');

  const edges = await getDependencyEdges(projectId);

  // Map real taskId → tempId
  const taskIdToTempId = new Map<string, string>();
  const templateTasks: TemplateTask[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const tempId = `t-${i}`;
    taskIdToTempId.set(task.id, tempId);

    const checklists = await getChecklistItems(task.id);
    templateTasks.push({
      tempId,
      title: task.title,
      checklistTitles: checklists.map((c) => c.title),
    });
  }

  const templateEdges: TemplateEdge[] = [];
  for (const edge of edges) {
    const fromTempId = taskIdToTempId.get(edge.fromTaskId);
    const toTempId = taskIdToTempId.get(edge.toTaskId);
    if (fromTempId && toTempId) {
      templateEdges.push({ fromTempId, toTempId });
    }
  }

  const template: ProjectTemplate = {
    id: crypto.randomUUID(),
    name,
    builtIn: false,
    tasks: templateTasks,
    edges: templateEdges,
  };

  await db.templates.add(template);
  return ok(template);
}
