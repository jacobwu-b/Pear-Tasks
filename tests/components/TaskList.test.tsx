// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createTask, createProject, getTask } from '../../src/db/operations';
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
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('TaskList', () => {
  it('shows empty message for empty inbox', async () => {
    await act(async () => {
      render(<TaskList />);
    });

    // Wait for tasks to load
    await act(async () => {
      await useTaskStore.getState().loadTasksForView('inbox');
    });

    expect(screen.getByTestId('empty-message')).toBeDefined();
    expect(screen.getByTestId('view-title').textContent).toBe('Inbox');
  });

  it('renders inbox tasks', async () => {
    await createTask('Buy milk');
    await createTask('Call dentist');

    await act(async () => {
      render(<TaskList />);
    });

    // Wait for the hook to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Buy milk')).toBeDefined();
    expect(screen.getByText('Call dentist')).toBeDefined();
  });

  it('renders project tasks when view is a project', async () => {
    const { data: project } = await createProject('My Project');
    await createTask('Project task', { projectId: project!.id });
    await createTask('Inbox task');

    useUiStore.setState({ sidebarView: { type: 'project', projectId: project!.id } });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Project task')).toBeDefined();
    expect(screen.queryByText('Inbox task')).toBeNull();
  });

  it('toggles task completion via checkbox', async () => {
    const { data: task } = await createTask('Toggle me');

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click the toggle button
    await act(async () => {
      fireEvent.click(screen.getByTestId(`task-toggle-${task!.id}`));
    });

    // Task should now be completed in Dexie
    const updated = await getTask(task!.id);
    expect(updated!.status).toBe('completed');
  });

  it('selects a task when clicking its row', async () => {
    const { data: task } = await createTask('Click me');

    await act(async () => {
      render(<TaskList />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`task-row-${task!.id}`));
    });

    expect(useUiStore.getState().selectedTaskId).toBe(task!.id);
  });
});
