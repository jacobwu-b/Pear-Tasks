import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../src/db/schema';
import {
  seedBuiltInTemplates,
  getTemplates,
  getTemplate,
  deleteTemplate,
  updateTemplate,
  instantiateTemplate,
  saveAsTemplate,
} from '../../src/db/templates';
import {
  createProject,
  createTask,
  addChecklistItem,
  addDependency,
  getTasksByProject,
  getChecklistItems,
  getDependencyEdges,
} from '../../src/db/operations';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

// ── Seeding ───────────────────────────────────────────────────────

describe('seedBuiltInTemplates', () => {
  it('seeds 4 built-in templates on first call', async () => {
    await seedBuiltInTemplates();
    const templates = await getTemplates();
    expect(templates.length).toBe(4);
    expect(templates.every((t) => t.builtIn)).toBe(true);
  });

  it('is idempotent — calling twice does not duplicate templates', async () => {
    await seedBuiltInTemplates();
    await seedBuiltInTemplates();
    const templates = await getTemplates();
    expect(templates.length).toBe(4);
  });
});

// ── CRUD ──────────────────────────────────────────────────────────

describe('getTemplate', () => {
  it('returns a template by id', async () => {
    await seedBuiltInTemplates();
    const t = await getTemplate('builtin-software-project');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Software Project');
    expect(t!.tasks.length).toBe(6);
    expect(t!.edges.length).toBe(5);
  });

  it('returns undefined for non-existent id', async () => {
    const t = await getTemplate('does-not-exist');
    expect(t).toBeUndefined();
  });
});

describe('deleteTemplate', () => {
  it('prevents deleting built-in templates', async () => {
    await seedBuiltInTemplates();
    const result = await deleteTemplate('builtin-software-project');
    expect(result.error).toBe('Cannot delete built-in templates');
    const t = await getTemplate('builtin-software-project');
    expect(t).toBeDefined();
  });

  it('deletes a custom template', async () => {
    // Create a project and save it as a template
    const proj = await createProject('Test Project', null);
    await createTask('Task 1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'My Template');
    expect(saved.error).toBeNull();
    const templateId = saved.data!.id;

    const result = await deleteTemplate(templateId);
    expect(result.error).toBeNull();
    const t = await getTemplate(templateId);
    expect(t).toBeUndefined();
  });

  it('returns error for non-existent template', async () => {
    const result = await deleteTemplate('non-existent');
    expect(result.error).toBe('Template not found');
  });
});

// ── Update ────────────────────────────────────────────────────────

describe('updateTemplate', () => {
  it('renames a custom template', async () => {
    const proj = await createProject('Source', null);
    await createTask('Task 1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'Original Name');
    const templateId = saved.data!.id;

    const result = await updateTemplate(templateId, { name: 'Renamed Template' });
    expect(result.error).toBeNull();
    expect(result.data!.name).toBe('Renamed Template');

    const retrieved = await getTemplate(templateId);
    expect(retrieved!.name).toBe('Renamed Template');
  });

  it('rejects renaming a built-in template', async () => {
    await seedBuiltInTemplates();
    const result = await updateTemplate('builtin-software-project', { name: 'Hacked Name' });
    expect(result.error).toBe('Cannot modify built-in templates');

    const t = await getTemplate('builtin-software-project');
    expect(t!.name).toBe('Software Project');
  });

  it('rejects empty name', async () => {
    const proj = await createProject('Source', null);
    await createTask('Task 1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'My Template');

    const result = await updateTemplate(saved.data!.id, { name: '   ' });
    expect(result.error).toBe('Template name is required');
  });

  it('returns error for non-existent template', async () => {
    const result = await updateTemplate('non-existent', { name: 'Whatever' });
    expect(result.error).toBe('Template not found');
  });
});

// ── Instantiate ───────────────────────────────────────────────────

describe('instantiateTemplate', () => {
  it('creates a project with all tasks, checklists, and dependency edges', async () => {
    await seedBuiltInTemplates();
    const result = await instantiateTemplate('builtin-blog-post', 'My Blog', null);
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();

    const projectId = result.data!.projectId;
    const tasks = await getTasksByProject(projectId);
    expect(tasks.length).toBe(5);

    // Verify task titles match template
    const titles = tasks.map((t) => t.title).sort();
    expect(titles).toEqual(['Draft', 'Edit', 'Graphics', 'Outline', 'Publish']);

    // Verify all tasks belong to the project
    expect(tasks.every((t) => t.projectId === projectId)).toBe(true);

    // Verify checklists were created
    const outlineTask = tasks.find((t) => t.title === 'Outline')!;
    const checklist = await getChecklistItems(outlineTask.id);
    expect(checklist.length).toBe(3);
    expect(checklist.map((c) => c.title)).toEqual([
      'Choose topic',
      'Research key points',
      'Draft structure',
    ]);

    // Verify dependency edges
    const edges = await getDependencyEdges(projectId);
    expect(edges.length).toBe(4);
  });

  it('returns error for non-existent template', async () => {
    const result = await instantiateTemplate('non-existent', 'Project', null);
    expect(result.error).toBe('Template not found');
  });
});

// ── Save as Template ──────────────────────────────────────────────

describe('saveAsTemplate', () => {
  it('saves a project with tasks and edges as a custom template', async () => {
    // Create a project with tasks and dependencies
    const proj = await createProject('Source Project', null);
    const pid = proj.data!.id;
    const t1 = await createTask('Step 1', { projectId: pid });
    const t2 = await createTask('Step 2', { projectId: pid });
    const t3 = await createTask('Step 3', { projectId: pid });
    await addDependency(t1.data!.id, t2.data!.id, pid);
    await addDependency(t2.data!.id, t3.data!.id, pid);

    // Add checklists to first task
    await addChecklistItem(t1.data!.id, 'Check A');
    await addChecklistItem(t1.data!.id, 'Check B');

    const result = await saveAsTemplate(pid, 'My Custom Template');
    expect(result.error).toBeNull();
    const template = result.data!;
    expect(template.name).toBe('My Custom Template');
    expect(template.builtIn).toBe(false);
    expect(template.tasks.length).toBe(3);
    expect(template.edges.length).toBe(2);

    // Verify checklist titles were captured
    const step1 = template.tasks.find((t) => t.title === 'Step 1')!;
    expect(step1.checklistTitles).toEqual(['Check A', 'Check B']);

    // Verify the template was persisted to the DB
    const retrieved = await getTemplate(template.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('My Custom Template');
  });

  it('returns error when project has no tasks', async () => {
    const proj = await createProject('Empty Project', null);
    const result = await saveAsTemplate(proj.data!.id, 'Empty Template');
    expect(result.error).toBe('Project has no tasks to save as template');
  });

  it('round-trips: save as template then instantiate produces equivalent project', async () => {
    // Create source project
    const proj = await createProject('Source', null);
    const pid = proj.data!.id;
    const t1 = await createTask('Alpha', { projectId: pid });
    const t2 = await createTask('Beta', { projectId: pid });
    await addDependency(t1.data!.id, t2.data!.id, pid);
    await addChecklistItem(t1.data!.id, 'Item 1');

    // Save as template
    const saved = await saveAsTemplate(pid, 'Round-trip Template');
    expect(saved.error).toBeNull();

    // Instantiate
    const inst = await instantiateTemplate(saved.data!.id, 'Clone', null);
    expect(inst.error).toBeNull();

    // Verify clone matches
    const cloneTasks = await getTasksByProject(inst.data!.projectId);
    expect(cloneTasks.length).toBe(2);
    expect(cloneTasks.map((t) => t.title).sort()).toEqual(['Alpha', 'Beta']);

    const cloneEdges = await getDependencyEdges(inst.data!.projectId);
    expect(cloneEdges.length).toBe(1);

    const alphaClone = cloneTasks.find((t) => t.title === 'Alpha')!;
    const checklist = await getChecklistItems(alphaClone.id);
    expect(checklist.length).toBe(1);
    expect(checklist[0].title).toBe('Item 1');
  });
});
