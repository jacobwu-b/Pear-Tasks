// -- Enums --

export type TaskStatus = 'open' | 'completed' | 'canceled';

export type ProjectStatus = 'active' | 'completed' | 'canceled' | 'someday';

/** "When" scheduling: a date string (YYYY-MM-DD) or the special 'someday' value */
export type WhenValue = string | 'someday';

// -- Entities --

export interface Area {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: number;
  deletedAt: number | null;
}

export interface Project {
  id: string;
  title: string;
  notes: string;
  status: ProjectStatus;
  areaId: string | null;
  deadline: string | null; // YYYY-MM-DD
  tags: string[];
  sortOrder: number;
  createdAt: number;
  completedAt: number | null;
  deletedAt: number | null;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  when: WhenValue | null;
  deadline: string | null; // YYYY-MM-DD
  tags: string[];
  projectId: string | null;
  areaId: string | null;
  sortOrder: number;
  createdAt: number;
  completedAt: number | null;
  deletedAt: number | null;
}

export interface ChecklistItem {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
}

/**
 * A directed dependency edge: `fromTaskId` blocks `toTaskId`.
 * Both tasks must be in the same project.
 */
export interface DependencyEdge {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  projectId: string;
}

// -- Templates --

export interface TemplateTask {
  tempId: string; // local ID within the template for wiring edges
  title: string;
  checklistTitles: string[];
}

export interface TemplateEdge {
  fromTempId: string;
  toTempId: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  builtIn: boolean;
  tasks: TemplateTask[];
  edges: TemplateEdge[];
}
