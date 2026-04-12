import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/store/uiStore';

beforeEach(() => {
  // Reset store to defaults between tests
  useUiStore.setState({
    sidebarView: 'inbox',
    selectedTaskId: null,
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
  });
});

describe('uiStore', () => {
  it('defaults to inbox view', () => {
    expect(useUiStore.getState().sidebarView).toBe('inbox');
  });

  it('sets sidebar view and clears selected task', () => {
    useUiStore.getState().setSelectedTaskId('task-1');
    useUiStore.getState().setSidebarView('today');

    const state = useUiStore.getState();
    expect(state.sidebarView).toBe('today');
    expect(state.selectedTaskId).toBeNull();
  });

  it('sets sidebar view to a project', () => {
    useUiStore.getState().setSidebarView({ type: 'project', projectId: 'p1' });
    const view = useUiStore.getState().sidebarView;
    expect(view).toEqual({ type: 'project', projectId: 'p1' });
  });

  it('sets sidebar view to an area', () => {
    useUiStore.getState().setSidebarView({ type: 'area', areaId: 'a1' });
    const view = useUiStore.getState().sidebarView;
    expect(view).toEqual({ type: 'area', areaId: 'a1' });
  });

  it('sets selected task id', () => {
    useUiStore.getState().setSelectedTaskId('task-42');
    expect(useUiStore.getState().selectedTaskId).toBe('task-42');
  });

  it('clears selected task id', () => {
    useUiStore.getState().setSelectedTaskId('task-42');
    useUiStore.getState().setSelectedTaskId(null);
    expect(useUiStore.getState().selectedTaskId).toBeNull();
  });

  it('toggles sidebar collapsed state', () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it('sets sidebar collapsed directly', () => {
    useUiStore.getState().setSidebarCollapsed(true);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it('defaults mobileSidebarOpen to false', () => {
    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
  });

  it('opens and closes mobile sidebar', () => {
    useUiStore.getState().setMobileSidebarOpen(true);
    expect(useUiStore.getState().mobileSidebarOpen).toBe(true);

    useUiStore.getState().setMobileSidebarOpen(false);
    expect(useUiStore.getState().mobileSidebarOpen).toBe(false);
  });
});
