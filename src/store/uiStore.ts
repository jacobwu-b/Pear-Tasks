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

  setSidebarView: (view: SidebarView) => void;
  setSelectedTaskId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarView: 'inbox',
  selectedTaskId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,

  setSidebarView: (view) => set({ sidebarView: view, selectedTaskId: null }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
