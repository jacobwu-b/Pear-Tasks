// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createTask, createProject, getTaskDependencies } from '../../src/db/operations';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import TaskList from '../../src/components/tasks/TaskList';
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
    linkMode: false,
    linkModeFirstTaskId: null,
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('Link Mode', () => {
  it('shows link button in project view', async () => {
    const { data: project } = await createProject('Test Project');
    await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('enter-link-mode-btn')).toBeDefined();
  });

  it('does not show link button in inbox view', async () => {
    await createTask('Task A');

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('enter-link-mode-btn')).toBeNull();
  });

  it('enters link mode when clicking the link button', async () => {
    const { data: project } = await createProject('Test Project');
    await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('enter-link-mode-btn'));
    });

    expect(useUiStore.getState().linkMode).toBe(true);
    expect(screen.getByTestId('link-mode-toolbar')).toBeDefined();
  });

  it('exits link mode when clicking cancel', async () => {
    const { data: project } = await createProject('Test Project');
    await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      linkMode: true,
      linkModeFirstTaskId: null,
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('link-mode-cancel'));
    });

    expect(useUiStore.getState().linkMode).toBe(false);
  });

  it('creates a dependency by clicking two tasks in link mode', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Blocker', { projectId: project!.id });
    const { data: taskB } = await createTask('Blocked', { projectId: project!.id });
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Enter link mode
    await act(async () => {
      fireEvent.click(screen.getByTestId('enter-link-mode-btn'));
    });

    // Click first task (blocker)
    await act(async () => {
      fireEvent.click(screen.getByTestId(`task-row-${taskA!.id}`));
    });

    expect(useUiStore.getState().linkModeFirstTaskId).toBe(taskA!.id);

    // Click second task (blocked)
    await act(async () => {
      fireEvent.click(screen.getByTestId(`task-row-${taskB!.id}`));
      await new Promise((r) => setTimeout(r, 50));
    });

    // Link mode should exit
    expect(useUiStore.getState().linkMode).toBe(false);

    // Verify dependency was created
    const edges = await getTaskDependencies(taskA!.id);
    expect(edges.length).toBe(1);
    expect(edges[0].fromTaskId).toBe(taskA!.id);
    expect(edges[0].toTaskId).toBe(taskB!.id);
  });

  it('shows toolbar text updates after first task is selected', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      linkMode: true,
      linkModeFirstTaskId: null,
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Click the blocker task first')).toBeDefined();

    // Set first task via store update
    await act(async () => {
      useUiStore.setState({ linkModeFirstTaskId: taskA!.id });
    });

    // Re-render should show updated text
    expect(screen.getByText('Now click the task to be blocked')).toBeDefined();
  });
});
