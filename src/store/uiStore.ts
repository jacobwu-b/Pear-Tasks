import { create } from 'zustand';
import {
  getSyncFileSnapshot,
  type SyncFileSnapshot,
  type SyncError,
} from '../db/syncFile';

export type SidebarView =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'anytime'
  | 'someday'
  | 'logbook'
  | 'trash'
  | { type: 'project'; projectId: string }
  | { type: 'area'; areaId: string };

interface UiState {
  sidebarView: SidebarView;
  selectedTaskId: string | null;
  sidebarCollapsed: boolean;
  /** Mobile-only: controls the slide-over overlay */
  mobileSidebarOpen: boolean;
  /** Link mode: when active, clicking tasks creates dependency edges */
  linkMode: boolean;
  /** The first task selected in link mode (the "from" / blocker task) */
  linkModeFirstTaskId: string | null;
  /** Whether the dependency graph panel is collapsed in project views */
  graphCollapsed: boolean;
  /** Quick Capture modal visibility */
  quickCaptureOpen: boolean;
  /** Full New Task form visibility */
  newTaskFormOpen: boolean;
  /** Sync file: persisted metadata for the connected on-disk JSON file. */
  syncFile: SyncFileSnapshot | null;
  /** Sync file: last error from a connect/save attempt, if any. */
  syncError: SyncError | null;
  /** Sync file: true while a save is in flight. */
  syncSaving: boolean;

  setSidebarView: (view: SidebarView) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  enterLinkMode: () => void;
  exitLinkMode: () => void;
  setLinkModeFirstTask: (id: string | null) => void;
  setGraphCollapsed: (collapsed: boolean) => void;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
  openNewTaskForm: () => void;
  closeNewTaskForm: () => void;
  setSyncFile: (file: SyncFileSnapshot | null) => void;
  setSyncError: (error: SyncError | null) => void;
  setSyncSaving: (saving: boolean) => void;
  hydrateSyncFile: () => Promise<void>;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarView: 'inbox',
  selectedTaskId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  linkMode: false,
  linkModeFirstTaskId: null,
  graphCollapsed: false,
  quickCaptureOpen: false,
  newTaskFormOpen: false,
  syncFile: null,
  syncError: null,
  syncSaving: false,

  setSidebarView: (view) => set({ sidebarView: view, selectedTaskId: null }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  enterLinkMode: () => set({ linkMode: true, linkModeFirstTaskId: null }),
  exitLinkMode: () => set({ linkMode: false, linkModeFirstTaskId: null }),
  setLinkModeFirstTask: (id) => set({ linkModeFirstTaskId: id }),
  setGraphCollapsed: (collapsed) => set({ graphCollapsed: collapsed }),
  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),
  openNewTaskForm: () => set({ newTaskFormOpen: true }),
  closeNewTaskForm: () => set({ newTaskFormOpen: false }),
  setSyncFile: (file) => set({ syncFile: file }),
  setSyncError: (error) => set({ syncError: error }),
  setSyncSaving: (saving) => set({ syncSaving: saving }),
  hydrateSyncFile: async () => {
    const snapshot = await getSyncFileSnapshot();
    set({ syncFile: snapshot });
  },
}));
