import { create } from 'zustand';

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

  setSidebarView: (view: SidebarView) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  enterLinkMode: () => void;
  exitLinkMode: () => void;
  setLinkModeFirstTask: (id: string | null) => void;
  setGraphCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarView: 'inbox',
  selectedTaskId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  linkMode: false,
  linkModeFirstTaskId: null,
  graphCollapsed: false,

  setSidebarView: (view) => set({ sidebarView: view, selectedTaskId: null }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  enterLinkMode: () => set({ linkMode: true, linkModeFirstTaskId: null }),
  exitLinkMode: () => set({ linkMode: false, linkModeFirstTaskId: null }),
  setLinkModeFirstTask: (id) => set({ linkModeFirstTaskId: id }),
  setGraphCollapsed: (collapsed) => set({ graphCollapsed: collapsed }),
}));
