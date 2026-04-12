import { db } from './schema';
import {
  createArea,
  createProject,
  createTask,
  addChecklistItem,
  addDependency,
} from './operations';

const SEED_KEY = 'pear-seeded';

/**
 * Seeds the database with a welcome project on first launch.
 * Skips if data has already been seeded.
 */
export async function seedOnFirstLaunch(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return;

  // Only seed if the database is empty
  const existingAreas = await db.areas.count();
  const existingTasks = await db.tasks.count();
  if (existingAreas > 0 || existingTasks > 0) {
    localStorage.setItem(SEED_KEY, '1');
    return;
  }

  // Create a "Getting Started" area
  const { data: area } = await createArea('Getting Started');
  if (!area) return;

  // -- Welcome project with dependency chain --
  const { data: project } = await createProject('Welcome to Pear 🍐', area.id);
  if (!project) return;

  const { data: t1 } = await createTask('Read this task to learn the basics', {
    projectId: project.id,
  });
  await addChecklistItem(t1!.id, 'Tasks live in projects, just like this one');
  await addChecklistItem(t1!.id, 'Check off items in a checklist as you go');
  await addChecklistItem(t1!.id, 'Click a task to open the detail panel');

  const { data: t2 } = await createTask('Explore the sidebar navigation', {
    projectId: project.id,
  });
  await addChecklistItem(t2!.id, 'Inbox holds tasks with no project or date');
  await addChecklistItem(t2!.id, 'Today shows tasks scheduled for today');
  await addChecklistItem(t2!.id, 'Use ⌘/ to toggle the sidebar');

  const { data: t3 } = await createTask('Try scheduling a task', {
    projectId: project.id,
  });
  await addChecklistItem(t3!.id, 'Set a "When" date to schedule a task');
  await addChecklistItem(t3!.id, 'Set a "Deadline" for hard due dates');
  await addChecklistItem(t3!.id, 'Use "Someday" for tasks you\'ll get to later');

  const { data: t4 } = await createTask('Learn about dependencies', {
    projectId: project.id,
  });
  await addChecklistItem(t4!.id, 'Tasks can depend on other tasks');
  await addChecklistItem(t4!.id, 'Blocked tasks show a lock icon');
  await addChecklistItem(t4!.id, 'Completing a predecessor unblocks its successors');

  const { data: t5 } = await createTask('Complete this task to finish the tour!', {
    projectId: project.id,
  });
  await addChecklistItem(t5!.id, 'Mark all previous tasks complete first');
  await addChecklistItem(t5!.id, 'This task is blocked until then — that\'s dependencies in action');

  // Wire up a dependency chain: t1 → t2 → t3 → t4 → t5
  await addDependency(t1!.id, t2!.id, project.id);
  await addDependency(t2!.id, t3!.id, project.id);
  await addDependency(t3!.id, t4!.id, project.id);
  await addDependency(t4!.id, t5!.id, project.id);

  // -- A loose inbox task to show Inbox behavior --
  await createTask('This is an inbox task — organize it into a project when ready');

  localStorage.setItem(SEED_KEY, '1');
}
