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
    graphCollapsed: false,
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('GraphView (graph on top, list below)', () => {
  it('shows graph panel when project has dependency edges', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Graph panel is visible
    expect(screen.getByTestId('graph-view')).toBeDefined();
    // List is also visible simultaneously
    expect(screen.getByTestId(`task-row-${taskA!.id}`)).toBeDefined();
    expect(screen.getByTestId(`task-row-${taskB!.id}`)).toBeDefined();
  });

  it('does not show graph panel when project has no edges', async () => {
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

    expect(screen.queryByTestId('graph-view')).toBeNull();
  });

  it('does not show graph panel in non-project views', async () => {
    await createTask('Inbox task');

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('graph-view')).toBeNull();
  });

  it('renders a node for each task in the graph', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task Alpha', { projectId: project!.id });
    const { data: taskB } = await createTask('Task Beta', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
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
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId(`graph-edge-${edge!.id}`)).toBeDefined();
  });

  it('clicking a graph node selects the task', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
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

  it('collapses graph when clicking the toggle header', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Graph canvas is visible
    expect(screen.getByTestId('graph-canvas')).toBeDefined();

    // Collapse
    await act(async () => {
      fireEvent.click(screen.getByTestId('graph-toggle'));
    });

    expect(useUiStore.getState().graphCollapsed).toBe(true);
    expect(screen.queryByTestId('graph-canvas')).toBeNull();

    // Task list is still visible
    expect(screen.getByTestId(`task-row-${taskA!.id}`)).toBeDefined();
  });

  it('expands graph when clicking toggle while collapsed', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    useUiStore.setState({
      sidebarView: { type: 'project', projectId: project!.id },
      graphCollapsed: true,
    });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Canvas is hidden
    expect(screen.queryByTestId('graph-canvas')).toBeNull();

    // Expand
    await act(async () => {
      fireEvent.click(screen.getByTestId('graph-toggle'));
    });

    expect(useUiStore.getState().graphCollapsed).toBe(false);
    expect(screen.getByTestId('graph-canvas')).toBeDefined();
  });

  it('renders completed tasks with different styling in graph', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Done Task', { projectId: project!.id });
    const { data: taskB } = await createTask('Open Task', { projectId: project!.id });
    await addDependency(taskA!.id, taskB!.id, project!.id);
    await updateTask(taskA!.id, { status: 'completed', completedAt: Date.now() });
    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const node = screen.getByTestId(`graph-node-${taskA!.id}`);
    const rect = node.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe('var(--color-status-completed)');
  });
});
