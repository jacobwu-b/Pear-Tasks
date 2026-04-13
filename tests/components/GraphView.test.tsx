// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import {
  createTask,
  createProject,
  addDependency,
  updateTask,
} from '../../src/db/operations';
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
    projectViewMode: 'list',
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('GraphView', () => {
  it('shows segmented control only in project view', async () => {
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

    expect(screen.getByTestId('view-mode-toggle')).toBeDefined();
    expect(screen.getByTestId('view-mode-list')).toBeDefined();
    expect(screen.getByTestId('view-mode-graph')).toBeDefined();
  });

  it('does not show segmented control in inbox view', async () => {
    await createTask('Inbox task');

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('view-mode-toggle')).toBeNull();
  });

  it('toggles to graph view when clicking Graph button', async () => {
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

    // Initially in list mode
    expect(screen.queryByTestId('graph-view')).toBeNull();

    // Click graph button
    await act(async () => {
      fireEvent.click(screen.getByTestId('view-mode-graph'));
    });

    expect(useUiStore.getState().projectViewMode).toBe('graph');
    expect(screen.getByTestId('graph-view')).toBeDefined();
  });

  it('renders a node for each task', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task Alpha', { projectId: project!.id });
    const { data: taskB } = await createTask('Task Beta', { projectId: project!.id });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId(`graph-node-${taskA!.id}`)).toBeDefined();
    expect(screen.getByTestId(`graph-node-${taskB!.id}`)).toBeDefined();
  });

  it('renders edges between connected tasks', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    const { data: edge } = await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId(`graph-edge-${edge!.id}`)).toBeDefined();
  });

  it('clicking a node selects the task', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`graph-node-${taskA!.id}`));
    });

    expect(useUiStore.getState().selectedTaskId).toBe(taskA!.id);
  });

  it('shows empty state when project has no tasks', async () => {
    const { data: project } = await createProject('Empty Project');
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('graph-empty')).toBeDefined();
  });

  it('toggles back to list view', async () => {
    const { data: project } = await createProject('Test Project');
    await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('graph-view')).toBeDefined();

    // Click list button
    await act(async () => {
      fireEvent.click(screen.getByTestId('view-mode-list'));
    });

    expect(useUiStore.getState().projectViewMode).toBe('list');
    expect(screen.queryByTestId('graph-view')).toBeNull();
  });

  it('renders completed tasks with different styling', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Done Task', { projectId: project!.id });
    await updateTask(taskA!.id, { status: 'completed', completedAt: Date.now() });
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      projectViewMode: 'graph',
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const node = screen.getByTestId(`graph-node-${taskA!.id}`);
    expect(node).toBeDefined();
    // The completed node should have a rect with the completed fill color
    const rect = node.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('var(--color-status-completed)');
  });
});
