import { create } from 'zustand';
import type { Area, Project } from '../types';
import { getAreas, getProjects } from '../db/operations';

interface TaskState {
  areas: Area[];
  projects: Project[];

  /** Reload areas and projects from Dexie into the store */
  loadSidebarData: () => Promise<void>;
}

export const useTaskStore = create<TaskState>((set) => ({
  areas: [],
  projects: [],

  loadSidebarData: async () => {
    const [areas, projects] = await Promise.all([getAreas(), getProjects()]);
    set({ areas, projects });
  },
}));
