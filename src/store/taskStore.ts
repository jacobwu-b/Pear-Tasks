import { create } from 'zustand';
import type { Area, Project, Task, ChecklistItem, DependencyEdge, ProjectTemplate, RecurrenceConfig } from '../types';
import type { SidebarView } from './uiStore';
import {
  getTemplates as dbGetTemplates,
  instantiateTemplate as dbInstantiateTemplate,
  saveAsTemplate as dbSaveAsTemplate,
  updateTemplate as dbUpdateTemplate,
  deleteTemplate as dbDeleteTemplate,
} from '../db/templates';
import { useUiStore } from './uiStore';
import {
  getAreas,
  getProjects,
  createArea as dbCreateArea,
  updateArea as dbUpdateArea,
  deleteArea as dbDeleteArea,
  getInboxTasks,
  getTodayTasks,
  getUpcomingTasks,
  getAnytimeTasks,
  getSomedayTasks,
  getLogbookTasks,
  getTrashTasks,
  getTasksByProject,
  getTasksByArea,
  getTask,
  updateTask as dbUpdateTask,
  createTask as dbCreateTask,
  softDeleteTask as dbSoftDeleteTask,
  restoreTask as dbRestoreTask,
  updateProject as dbUpdateProject,
  softDeleteProject as dbSoftDeleteProject,
  restoreProject as dbRestoreProject,
  getDeletedItems,
  getChecklistItems,
  addChecklistItem as dbAddChecklistItem,
  updateChecklistItem as dbUpdateChecklistItem,
  deleteChecklistItem as dbDeleteChecklistItem,
  addDependency as dbAddDependency,
  removeDependencyByTasks as dbRemoveDependencyByTasks,
  getTaskDependencies as dbGetTaskDependencies,
  getDependencyEdges as dbGetDependencyEdges,
  completeTaskWithRecurrence as dbCompleteTaskWithRecurrence,
  updateRecurrenceForward as dbUpdateRecurrenceForward,
  updateTaskForward as dbUpdateTaskForward,
} from '../db/operations';

/**
 * A dependency edge joined with the "other" task for UI display.
 * `direction` is from the perspective of the task the section is showing:
 * - 'blocks' means this task blocks `task`
 * - 'blockedBy' means this task is blocked by `task`
 */
export interface ResolvedDep {
  edge: DependencyEdge;
  task: Task;
  direction: 'blocks' | 'blockedBy';
}

interface TaskState {
  areas: Area[];
  projects: Project[];
  tasks: Task[];
  /** Dependency edges for the currently loaded project view. Empty for non-project views. */
  edges: DependencyEdge[];
  /** Soft-deleted projects shown in Trash. Populated only when currentView === 'trash'. */
  trashedProjects: Project[];
  /** Currently loaded view (to know when to reload) */
  currentView: SidebarView | null;
  /** Fresh snapshot of the task whose detail panel is open. Null when no task is selected. */
  selectedTaskDetail: Task | null;
  /** Checklist items keyed by taskId. Populated on demand by loadChecklist. */
  checklistByTaskId: Record<string, ChecklistItem[]>;
  /** Resolved (edge + other-task) dependency rows keyed by taskId. Populated on demand by loadResolvedDeps. */
  resolvedDepsByTaskId: Record<string, ResolvedDep[]>;

  loadSidebarData: () => Promise<void>;
  loadTasksForView: (view: SidebarView) => Promise<void>;
  /** Reload tasks for the currently loaded view */
  refreshTasks: () => Promise<void>;

  // Mutation wrappers: write to Dexie, then refresh
  completeTask: (id: string) => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  updateTaskField: (id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<void>;
  createNewTask: (
    title: string,
    options?: Partial<Pick<Task, 'projectId' | 'areaId' | 'when' | 'deadline' | 'tags' | 'notes' | 'recurrence' | 'recurringParentId'>>
  ) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  /**
   * Update the recurrence rule on a recurring task.
   * - scope 'this': update only this task instance.
   * - scope 'forward': update this task and all open future instances in the chain.
   */
  updateTaskRecurrence: (
    id: string,
    recurrence: RecurrenceConfig | null,
    scope: 'this' | 'forward',
  ) => Promise<void>;
  /**
   * Apply arbitrary field changes to a recurring task with scope control.
   * - scope 'this': update only this task instance.
   * - scope 'forward': update this task and all open future instances in the chain.
   * For non-recurring tasks, scope is ignored and the update applies to this task only.
   */
  updateTaskFieldScoped: (
    id: string,
    changes: Partial<Omit<Task, 'id' | 'createdAt'>>,
    scope: 'this' | 'forward',
  ) => Promise<void>;
  completeProject: (id: string) => Promise<void>;
  cancelProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;

  // Selected task detail
  /** Load the task for the detail panel into `selectedTaskDetail`. Pass null to clear. */
  loadSelectedTaskDetail: (id: string | null) => Promise<void>;

  // Checklist
  /** Load checklist items for a task into `checklistByTaskId`. */
  loadChecklist: (taskId: string) => Promise<void>;
  addChecklistItem: (taskId: string, title: string) => Promise<void>;
  toggleChecklistItem: (taskId: string, id: string, completed: boolean) => Promise<void>;
  updateChecklistItemTitle: (taskId: string, id: string, title: string) => Promise<void>;
  deleteChecklistItem: (taskId: string, id: string) => Promise<void>;

  // Dependencies
  addDependency: (fromTaskId: string, toTaskId: string, projectId: string) => Promise<{ error: string | null }>;
  removeDependency: (fromTaskId: string, toTaskId: string) => Promise<void>;
  /** Load edges-joined-with-other-task for a task into `resolvedDepsByTaskId`. */
  loadResolvedDeps: (taskId: string) => Promise<void>;

  // Areas
  createNewArea: (title: string) => Promise<Area | null>;
  renameArea: (id: string, title: string) => Promise<void>;
  removeArea: (id: string) => Promise<void>;

  // Templates
  loadTemplates: () => Promise<ProjectTemplate[]>;
  instantiateTemplate: (templateId: string, projectName: string, areaId: string | null) => Promise<{ projectId: string | null; error: string | null }>;
  saveProjectAsTemplate: (projectId: string, name: string) => Promise<{ error: string | null }>;
  updateTemplate: (id: string, changes: Partial<Pick<ProjectTemplate, 'name' | 'tasks' | 'edges'>>) => Promise<{ error: string | null }>;
  deleteTemplate: (id: string) => Promise<{ error: string | null }>;
}

async function fetchTasksForView(view: SidebarView): Promise<Task[]> {
  if (typeof view === 'string') {
    switch (view) {
      case 'inbox': return getInboxTasks();
      case 'today': return getTodayTasks();
      case 'upcoming': return getUpcomingTasks();
      case 'anytime': return getAnytimeTasks();
      case 'someday': return getSomedayTasks();
      case 'logbook': return getLogbookTasks();
      case 'trash': return getTrashTasks();
    }
  }
  if (view.type === 'project') return getTasksByProject(view.projectId);
  if (view.type === 'area') return getTasksByArea(view.areaId);
  return [];
}

async function fetchTrashedProjects(): Promise<Project[]> {
  const { projects } = await getDeletedItems();
  return projects;
}

async function fetchEdgesForView(view: SidebarView): Promise<DependencyEdge[]> {
  if (typeof view === 'object' && view.type === 'project') {
    return dbGetDependencyEdges(view.projectId);
  }
  return [];
}

async function resolveDepsForTask(taskId: string): Promise<ResolvedDep[]> {
  const edges = await dbGetTaskDependencies(taskId);
  const resolved: ResolvedDep[] = [];
  for (const edge of edges) {
    const isFrom = edge.fromTaskId === taskId;
    const otherId = isFrom ? edge.toTaskId : edge.fromTaskId;
    const otherTask = await getTask(otherId);
    if (otherTask) {
      resolved.push({
        edge,
        task: otherTask,
        direction: isFrom ? 'blocks' : 'blockedBy',
      });
    }
  }
  return resolved;
}

/**
 * Refresh every cached detail slice that's currently loaded: selectedTaskDetail,
 * and every taskId already present in checklistByTaskId / resolvedDepsByTaskId.
 * Called from refreshTasks so any mutation keeps open panels in sync.
 */
async function refreshDetailCaches(state: {
  selectedTaskDetail: Task | null;
  checklistByTaskId: Record<string, ChecklistItem[]>;
  resolvedDepsByTaskId: Record<string, ResolvedDep[]>;
}): Promise<{
  selectedTaskDetail: Task | null;
  checklistByTaskId: Record<string, ChecklistItem[]>;
  resolvedDepsByTaskId: Record<string, ResolvedDep[]>;
}> {
  const selectedId = state.selectedTaskDetail?.id ?? null;
  const checklistKeys = Object.keys(state.checklistByTaskId);
  const depsKeys = Object.keys(state.resolvedDepsByTaskId);

  const [selectedTaskDetail, checklistEntries, depsEntries] = await Promise.all([
    selectedId ? getTask(selectedId) : Promise.resolve(null),
    Promise.all(
      checklistKeys.map(async (id) => [id, await getChecklistItems(id)] as const)
    ),
    Promise.all(
      depsKeys.map(async (id) => [id, await resolveDepsForTask(id)] as const)
    ),
  ]);

  return {
    selectedTaskDetail: selectedTaskDetail ?? null,
    checklistByTaskId: Object.fromEntries(checklistEntries),
    resolvedDepsByTaskId: Object.fromEntries(depsEntries),
  };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  areas: [],
  projects: [],
  tasks: [],
  edges: [],
  trashedProjects: [],
  currentView: null,
  selectedTaskDetail: null,
  checklistByTaskId: {},
  resolvedDepsByTaskId: {},

  loadSidebarData: async () => {
    const [areas, allProjects] = await Promise.all([getAreas(), getProjects()]);
    const projects = allProjects.filter(p => p.status === 'active' || p.status === 'someday');
    set({ areas, projects });
  },

  loadTasksForView: async (view) => {
    const [tasks, edges, trashedProjects] = await Promise.all([
      fetchTasksForView(view),
      fetchEdgesForView(view),
      view === 'trash' ? fetchTrashedProjects() : Promise.resolve([]),
    ]);
    set({ tasks, edges, trashedProjects, currentView: view });
  },

  refreshTasks: async () => {
    const { currentView } = get();
    const [tasks, edges, caches, trashedProjects] = await Promise.all([
      currentView ? fetchTasksForView(currentView) : Promise.resolve(get().tasks),
      currentView ? fetchEdgesForView(currentView) : Promise.resolve(get().edges),
      refreshDetailCaches(get()),
      currentView === 'trash' ? fetchTrashedProjects() : Promise.resolve(get().trashedProjects),
    ]);
    set({ tasks, edges, trashedProjects, ...caches });
  },

  completeTask: async (id) => {
    // Enforce the invariant: blocked tasks cannot be completed until all
    // predecessors are done (completed or canceled).
    const deps = await resolveDepsForTask(id);
    const isBlocked = deps.some(
      (d) => d.direction === 'blockedBy' && d.task.status !== 'completed' && d.task.status !== 'canceled'
    );
    if (isBlocked) return;
    // Use the recurrence-aware completion path. For non-recurring tasks it
    // behaves identically to a plain status update.
    await dbCompleteTaskWithRecurrence(id);
    await get().refreshTasks();
  },

  cancelTask: async (id) => {
    await dbUpdateTask(id, { status: 'canceled', completedAt: Date.now() });
    await get().refreshTasks();
  },

  reopenTask: async (id) => {
    await dbUpdateTask(id, { status: 'open', completedAt: null });
    await get().refreshTasks();
  },

  updateTaskField: async (id, changes) => {
    await dbUpdateTask(id, changes);
    await get().refreshTasks();
  },

  createNewTask: async (title, options) => {
    const result = await dbCreateTask(title, options);
    await get().refreshTasks();
    await get().loadSidebarData();
    return result.data;
  },

  deleteTask: async (id) => {
    await dbSoftDeleteTask(id);
    await get().refreshTasks();
  },

  restoreTask: async (id) => {
    await dbRestoreTask(id);
    await get().refreshTasks();
  },

  completeProject: async (id) => {
    await dbUpdateProject(id, { status: 'completed' });
    const current = useUiStore.getState().sidebarView;
    if (typeof current === 'object' && current.type === 'project' && current.projectId === id) {
      useUiStore.getState().setSidebarView('inbox');
    }
    await get().loadSidebarData();
    await get().refreshTasks();
  },

  cancelProject: async (id) => {
    await dbUpdateProject(id, { status: 'canceled' });
    const current = useUiStore.getState().sidebarView;
    if (typeof current === 'object' && current.type === 'project' && current.projectId === id) {
      useUiStore.getState().setSidebarView('inbox');
    }
    await get().loadSidebarData();
    await get().refreshTasks();
  },

  deleteProject: async (id) => {
    await dbSoftDeleteProject(id);
    // If the deleted project was the current view, fall back to Inbox.
    const current = useUiStore.getState().sidebarView;
    if (typeof current === 'object' && current.type === 'project' && current.projectId === id) {
      useUiStore.getState().setSidebarView('inbox');
    }
    await get().loadSidebarData();
    await get().refreshTasks();
  },

  restoreProject: async (id) => {
    await dbRestoreProject(id);
    await get().loadSidebarData();
    await get().refreshTasks();
  },

  updateTaskRecurrence: async (id, recurrence, scope) => {
    if (scope === 'this') {
      await dbUpdateTask(id, { recurrence });
    } else {
      // 'forward': update this task and all open future siblings
      const task = await getTask(id);
      if (!task) return;
      const rootId = task.recurringParentId ?? task.id;
      const fromWhen = (task.when && task.when !== 'someday') ? task.when as string : '';
      await dbUpdateRecurrenceForward(id, rootId, fromWhen, recurrence);
    }
    await get().refreshTasks();
  },

  updateTaskFieldScoped: async (id, changes, scope) => {
    if (scope === 'this') {
      await dbUpdateTask(id, changes);
    } else {
      // 'forward': update this task and all open future siblings
      const task = await getTask(id);
      if (!task) return;
      const rootId = task.recurringParentId ?? task.id;
      const fromWhen = (task.when && task.when !== 'someday') ? task.when as string : '';
      await dbUpdateTaskForward(id, rootId, fromWhen, changes);
    }
    await get().refreshTasks();
  },

  loadSelectedTaskDetail: async (id) => {
    if (!id) {
      set({ selectedTaskDetail: null });
      return;
    }
    const task = await getTask(id);
    set({ selectedTaskDetail: task ?? null });
  },

  loadChecklist: async (taskId) => {
    const items = await getChecklistItems(taskId);
    set((s) => ({ checklistByTaskId: { ...s.checklistByTaskId, [taskId]: items } }));
  },

  addChecklistItem: async (taskId, title) => {
    await dbAddChecklistItem(taskId, title);
    await get().loadChecklist(taskId);
  },

  toggleChecklistItem: async (taskId, id, completed) => {
    await dbUpdateChecklistItem(id, { completed });
    await get().loadChecklist(taskId);
  },

  updateChecklistItemTitle: async (taskId, id, title) => {
    await dbUpdateChecklistItem(id, { title });
    await get().loadChecklist(taskId);
  },

  deleteChecklistItem: async (taskId, id) => {
    await dbDeleteChecklistItem(id);
    await get().loadChecklist(taskId);
  },

  addDependency: async (fromTaskId, toTaskId, projectId) => {
    const result = await dbAddDependency(fromTaskId, toTaskId, projectId);
    if (result.error) return { error: result.error };
    await get().refreshTasks();
    return { error: null };
  },

  removeDependency: async (fromTaskId, toTaskId) => {
    await dbRemoveDependencyByTasks(fromTaskId, toTaskId);
    await get().refreshTasks();
  },

  loadResolvedDeps: async (taskId) => {
    const resolved = await resolveDepsForTask(taskId);
    set((s) => ({ resolvedDepsByTaskId: { ...s.resolvedDepsByTaskId, [taskId]: resolved } }));
  },

  createNewArea: async (title) => {
    const result = await dbCreateArea(title);
    if (result.error) return null;
    await get().loadSidebarData();
    return result.data;
  },

  renameArea: async (id, title) => {
    await dbUpdateArea(id, { title });
    await get().loadSidebarData();
  },

  removeArea: async (id) => {
    await dbDeleteArea(id);
    // If the deleted area was the current view, fall back to Inbox so the
    // user doesn't land on an empty/nonexistent view.
    const current = useUiStore.getState().sidebarView;
    if (typeof current === 'object' && current.type === 'area' && current.areaId === id) {
      useUiStore.getState().setSidebarView('inbox');
    }
    await get().loadSidebarData();
    // Projects' areaId was nulled — refresh tasks too in case the current
    // view is a project under this area (still valid, but stay consistent).
    await get().refreshTasks();
  },

  loadTemplates: async () => {
    return dbGetTemplates();
  },

  instantiateTemplate: async (templateId, projectName, areaId) => {
    const result = await dbInstantiateTemplate(templateId, projectName, areaId);
    if (result.error) return { projectId: null, error: result.error };
    await get().loadSidebarData();
    return { projectId: result.data!.projectId, error: null };
  },

  saveProjectAsTemplate: async (projectId, name) => {
    const result = await dbSaveAsTemplate(projectId, name);
    if (result.error) return { error: result.error };
    return { error: null };
  },

  updateTemplate: async (id, changes) => {
    const result = await dbUpdateTemplate(id, changes);
    if (result.error) return { error: result.error };
    return { error: null };
  },

  deleteTemplate: async (id) => {
    const result = await dbDeleteTemplate(id);
    if (result.error) return { error: result.error };
    return { error: null };
  },
}));
