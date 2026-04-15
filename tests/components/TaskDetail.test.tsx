// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createTask, getTask, addChecklistItem, getChecklistItems } from '../../src/db/operations';
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
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('TaskDetail', () => {
  it('shows placeholder when no task is selected', async () => {
    await act(async () => {
      render(<TaskDetail />);
    });

    expect(screen.getByText('Select a task to view details.')).toBeDefined();
  });

  it('loads and displays task data', async () => {
    const { data: task } = await createTask('My Task');

    useUiStore.setState({ selectedTaskId: task!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const titleInput = screen.getByTestId('task-title-input') as HTMLInputElement;
    expect(titleInput.value).toBe('My Task');
  });

  it('saves title on blur', async () => {
    const { data: task } = await createTask('Original Title');
    useUiStore.setState({ selectedTaskId: task!.id });
    await useTaskStore.getState().loadTasksForView('inbox');

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const titleInput = screen.getByTestId('task-title-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
      fireEvent.blur(titleInput);
    });

    const updated = await getTask(task!.id);
    expect(updated!.title).toBe('Updated Title');
  });

  it('does not clobber in-flight title edits when the store refreshes', async () => {
    // Regression test for #12: after a save triggers a store refresh, the
    // newly-fetched task must not reset the title input if the user has
    // already started typing the next edit.
    const { data: task } = await createTask('First');
    useUiStore.setState({ selectedTaskId: task!.id });
    await useTaskStore.getState().loadTasksForView('inbox');

    await act(async () => {
      render(<TaskDetail />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const titleInput = screen.getByTestId('task-title-input') as HTMLInputElement;

    // First edit: commit "Second" via blur (triggers updateTaskField + store refresh)
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Second' } });
      fireEvent.blur(titleInput);
    });

    // User immediately starts typing the next edit *before* re-blurring
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Third-in-progress' } });
    });

    // Simulate any additional store refreshes (e.g. a sibling mutation)
    await act(async () => {
      await useTaskStore.getState().refreshTasks();
      await new Promise((r) => setTimeout(r, 20));
    });

    // The input must still reflect what the user was typing — not snap back
    // to the previously-saved title.
    expect(titleInput.value).toBe('Third-in-progress');
  });

  it('saves notes on blur', async () => {
    const { data: task } = await createTask('Task with notes');
    useUiStore.setState({ selectedTaskId: task!.id });
    await useTaskStore.getState().loadTasksForView('inbox');

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const notesInput = screen.getByTestId('task-notes-input') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(notesInput, { target: { value: '## Some markdown notes' } });
      fireEvent.blur(notesInput);
    });

    const updated = await getTask(task!.id);
    expect(updated!.notes).toBe('## Some markdown notes');
  });

  it('completes a task via the Complete button', async () => {
    const { data: task } = await createTask('Complete me');
    useUiStore.setState({ selectedTaskId: task!.id });
    await useTaskStore.getState().loadTasksForView('inbox');

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-complete-btn'));
    });

    const updated = await getTask(task!.id);
    expect(updated!.status).toBe('completed');
  });

  it('deletes a task and clears selection', async () => {
    const { data: task } = await createTask('Delete me');
    useUiStore.setState({ selectedTaskId: task!.id });
    await useTaskStore.getState().loadTasksForView('inbox');

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('task-delete-btn'));
      await new Promise((r) => setTimeout(r, 50));
    });

    const updated = await getTask(task!.id);
    expect(updated!.deletedAt).toBeTypeOf('number');
    expect(useUiStore.getState().selectedTaskId).toBeNull();
  });

  it('renders and interacts with checklist', async () => {
    const { data: task } = await createTask('Checklist task');
    await addChecklistItem(task!.id, 'Step 1');
    await addChecklistItem(task!.id, 'Step 2');

    useUiStore.setState({ selectedTaskId: task!.id });

    await act(async () => {
      render(<TaskDetail />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Step 1')).toBeDefined();
    expect(screen.getByText('Step 2')).toBeDefined();

    // Add a new checklist item
    const addInput = screen.getByTestId('checklist-add-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(addInput, { target: { value: 'Step 3' } });
      fireEvent.keyDown(addInput, { key: 'Enter' });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const items = await getChecklistItems(task!.id);
    expect(items).toHaveLength(3);
    expect(items[2].title).toBe('Step 3');
  });
});
