// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createTask, createProject, addDependency, getTaskDependencies } from '../../src/db/operations';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import TaskDetail from '../../src/components/tasks/TaskDetail';
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

describe('DependencySection', () => {
  it('shows dependency section for tasks in a project', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: task } = await createTask('Task A', { projectId: project!.id });
    useUiStore.setState({ selectedTaskId: task!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('dependency-section')).toBeDefined();
    expect(screen.getByText('Dependencies')).toBeDefined();
    expect(screen.getByText('No dependencies')).toBeDefined();
  });

  it('does not show dependency section for inbox tasks', async () => {
    const { data: task } = await createTask('Inbox task');
    useUiStore.setState({ selectedTaskId: task!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.queryByTestId('dependency-section')).toBeNull();
  });

  it('adds a dependency via the picker', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    useUiStore.setState({ selectedTaskId: taskA!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Open picker
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-dependency-btn'));
    });

    // Wait for candidates to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByTestId('dependency-picker')).toBeDefined();

    // Select Task B as "blocked by" (default direction)
    await act(async () => {
      fireEvent.click(screen.getByTestId(`dep-candidate-${taskB!.id}`));
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify edge was created in DB
    const edges = await getTaskDependencies(taskA!.id);
    expect(edges.length).toBe(1);
    expect(edges[0].fromTaskId).toBe(taskB!.id);
    expect(edges[0].toTaskId).toBe(taskA!.id);
  });

  it('shows existing dependencies as chips', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Blocker Task', { projectId: project!.id });
    await addDependency(taskB!.id, taskA!.id, project!.id);
    useUiStore.setState({ selectedTaskId: taskA!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Blocked by')).toBeDefined();
    expect(screen.getByText('Blocker Task')).toBeDefined();
  });

  it('removes a dependency via the chip remove button', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    const { data: edge } = await addDependency(taskB!.id, taskA!.id, project!.id);
    useUiStore.setState({ selectedTaskId: taskA!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Remove the dependency
    await act(async () => {
      fireEvent.click(screen.getByTestId(`dep-remove-${edge!.id}`));
    });

    // Verify edge was removed
    const edges = await getTaskDependencies(taskA!.id);
    expect(edges.length).toBe(0);
  });

  it('prevents cycle via picker error message', async () => {
    const { data: project } = await createProject('Test Project');
    const { data: taskA } = await createTask('Task A', { projectId: project!.id });
    const { data: taskB } = await createTask('Task B', { projectId: project!.id });
    const { data: taskC } = await createTask('Task C', { projectId: project!.id });
    // A→B and B→C already exist
    await addDependency(taskA!.id, taskB!.id, project!.id);
    await addDependency(taskB!.id, taskC!.id, project!.id);

    // Now open C's detail and try to add "C blocks A" (C→A) — would create cycle
    useUiStore.setState({ selectedTaskId: taskC!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-dependency-btn'));
    });

    // Wait for candidates to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Switch to "blocks" direction
    await act(async () => {
      fireEvent.click(screen.getByTestId('dep-dir-blocks'));
    });

    // Select Task A — C→A would create A→B→C→A cycle
    await act(async () => {
      fireEvent.click(screen.getByTestId(`dep-candidate-${taskA!.id}`));
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should show error
    expect(screen.getByTestId('dep-picker-error')).toBeDefined();
    expect(screen.getByTestId('dep-picker-error').textContent).toContain('circular');
  });
});
