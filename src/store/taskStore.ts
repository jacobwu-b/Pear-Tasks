import { create } from 'zustand';
import type { Area, Project, Task, ChecklistItem, DependencyEdge, ProjectTemplate } from '../types';
import type { SidebarView } from './uiStore';
import {
  getTemplates as dbGetTemplates,
  instantiateTemplate as dbInstantiateTemplate,
  saveAsTemplate as dbSaveAsTemplate,
  updateTemplate as dbUpdateTemplate,
  deleteTemplate as dbDeleteTemplate,
} from '../db/templates';
import {
  getAreas,
  getProjects,
  getInboxTasks,
  getTodayTasks,
  getUpcomingTasks,
  getAnytimeTasks,
  getSomedayTasks,
  getLogbookTasks,
  getTrashTasks,
  getTasksByProject,
  getTasksByArea,
  updateTask as dbUpdateTask,
  createTask as dbCreateTask,
  softDeleteTask as dbSoftDeleteTask,
  restoreTask as dbRestoreTask,
  getChecklistItems,
  addChecklistItem as dbAddChecklistItem,
  updateChecklistItem as dbUpdateChecklistItem,
  deleteChecklistItem as dbDeleteChecklistItem,
  addDependency as dbAddDependency,
  removeDependencyByTasks as dbRemoveDependencyByTasks,
  getTaskDependencies as dbGetTaskDependencies,
} from '../db/operations';

interface TaskState {
  areas: Area[];
  projects: Project[];
  tasks: Task[];
  /** Currently loaded view (to know when to reload) */
  currentView: SidebarView | null;

  loadSidebarData: () => Promise<void>;
  loadTasksForView: (view: SidebarView) => Promise<void>;
  /** Reload tasks for the currently loaded view */
  refreshTasks: () => Promise<void>;

  // Mutation wrappers: write to Dexie, then refresh
  completeTask: (id: string) => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  reopenTask: (id: string) => Promise<void>;
  updateTaskField: (id: string, changes: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<void>;
  createNewTask: (title: string, options?: Partial<Pick<Task, 'projectId' | 'areaId' | 'when' | 'deadline' | 'tags'>>) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;

  // Checklist
  loadChecklist: (taskId: string) => Promise<ChecklistItem[]>;
  addChecklistItem: (taskId: string, title: string) => Promise<void>;
  toggleChecklistItem: (id: string, completed: boolean) => Promise<void>;
  updateChecklistItemTitle: (id: string, title: string) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;

  // Dependencies
  addDependency: (fromTaskId: string, toTaskId: string, projectId: string) => Promise<{ error: string | null }>;
  removeDependency: (fromTaskId: string, toTaskId: string) => Promise<void>;
  getTaskDeps: (taskId: string) => Promise<DependencyEdge[]>;

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

export const useTaskStore = create<TaskState>((set, get) => ({
  areas: [],
  projects: [],
  tasks: [],
  currentView: null,

  loadSidebarData: async () => {
    const [areas, projects] = await Promise.all([getAreas(), getProjects()]);
    set({ areas, projects });
  },

  loadTasksForView: async (view) => {
    const tasks = await fetchTasksForView(view);
    set({ tasks, currentView: view });
  },

  refreshTasks: async () => {
    const { currentView } = get();
    if (!currentView) return;
    const tasks = await fetchTasksForView(currentView);
    set({ tasks });
  },

  completeTask: async (id) => {
    await dbUpdateTask(id, { status: 'completed', completedAt: Date.now() });
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

  loadChecklist: async (taskId) => {
    return getChecklistItems(taskId);
  },

  addChecklistItem: async (taskId, title) => {
    await dbAddChecklistItem(taskId, title);
  },

  toggleChecklistItem: async (id, completed) => {
    await dbUpdateChecklistItem(id, { completed });
  },

  updateChecklistItemTitle: async (id, title) => {
    await dbUpdateChecklistItem(id, { title });
  },

  deleteChecklistItem: async (id) => {
    await dbDeleteChecklistItem(id);
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

  getTaskDeps: async (taskId) => {
    return dbGetTaskDependencies(taskId);
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
