// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createArea, createProject } from '../../src/db/operations';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import Sidebar from '../../src/components/layout/Sidebar';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await clearDatabase();
  useUiStore.setState({
    sidebarView: 'inbox',
    selectedTaskId: null,
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
  });
  useTaskStore.setState({ areas: [], projects: [] });
});

describe('Sidebar', () => {
  it('renders all smart list items', async () => {
    await act(async () => {
      render(<Sidebar />);
    });

    expect(screen.getByTestId('sidebar-inbox')).toBeDefined();
    expect(screen.getByTestId('sidebar-today')).toBeDefined();
    expect(screen.getByTestId('sidebar-upcoming')).toBeDefined();
    expect(screen.getByTestId('sidebar-anytime')).toBeDefined();
    expect(screen.getByTestId('sidebar-someday')).toBeDefined();
    expect(screen.getByTestId('sidebar-logbook')).toBeDefined();
    expect(screen.getByTestId('sidebar-trash')).toBeDefined();
  });

  it('updates uiStore when clicking a smart list', async () => {
    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sidebar-today'));
    });

    expect(useUiStore.getState().sidebarView).toBe('today');
  });

  it('renders areas and projects from the store', async () => {
    const { data: area } = await createArea('Work');
    await createProject('My Project', area!.id);
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    expect(screen.getByTestId(`sidebar-area-${area!.id}`)).toBeDefined();
    expect(screen.getByText('My Project')).toBeDefined();
  });

  it('renders orphan projects (no area)', async () => {
    const { data: project } = await createProject('Standalone');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    expect(screen.getByTestId(`sidebar-project-${project!.id}`)).toBeDefined();
    expect(screen.getByText('Standalone')).toBeDefined();
  });

  it('navigates to a project when clicked', async () => {
    const { data: project } = await createProject('Click Me');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Click Me'));
    });

    expect(useUiStore.getState().sidebarView).toEqual({
      type: 'project',
      projectId: project!.id,
    });
  });
});
