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

    // v2: add soft-delete to areas. Backfill existing rows with deletedAt=null.
    this.version(2)
      .stores({
        areas: 'id, sortOrder, deletedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('areas').toCollection().modify((a: Area) => {
          if (a.deletedAt === undefined) a.deletedAt = null;
        });
      });
  }
}

export const db = new PearDatabase();
