import Dexie, { type Table } from 'dexie';
import type {
  Area,
  Project,
  Task,
  ChecklistItem,
  DependencyEdge,
  ProjectTemplate,
} from '../types';

export class PearDatabase extends Dexie {
  areas!: Table<Area, string>;
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  checklistItems!: Table<ChecklistItem, string>;
  dependencyEdges!: Table<DependencyEdge, string>;
  templates!: Table<ProjectTemplate, string>;

  constructor() {
    super('PearDatabase');

    this.version(1).stores({
      areas: 'id, sortOrder',
      projects: 'id, areaId, status, sortOrder, deletedAt',
      tasks: 'id, projectId, areaId, status, when, deadline, sortOrder, deletedAt, *tags',
      checklistItems: 'id, taskId, sortOrder',
      dependencyEdges: 'id, fromTaskId, toTaskId, projectId',
      templates: 'id, builtIn',
    });
  }
}

export const db = new PearDatabase();
