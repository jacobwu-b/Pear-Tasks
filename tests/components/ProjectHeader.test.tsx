// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createProject, updateProject, getProjects } from '../../src/db/operations';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import ProjectHeader from '../../src/components/projects/ProjectHeader';
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

describe('ProjectHeader', () => {
  it("renders the current project's title and existing notes", async () => {
    const { data: project } = await createProject('Launch Plan');
    await updateProject(project!.id, { notes: 'Roll out v1 to beta users' });
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<ProjectHeader projectId={project!.id} />);
    });

    expect(screen.getByTestId('view-title').textContent).toBe('Launch Plan');
    const input = screen.getByTestId('project-description-input') as HTMLTextAreaElement;
    expect(input.value).toBe('Roll out v1 to beta users');
  });

  it('saves edited description to the project on blur', async () => {
    const { data: project } = await createProject('Launch Plan');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<ProjectHeader projectId={project!.id} />);
    });

    const input = screen.getByTestId('project-description-input') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Ship to enterprise customers in Q3' } });
      fireEvent.blur(input);
      await new Promise((r) => setTimeout(r, 20));
    });

    const [updated] = await getProjects();
    expect(updated.notes).toBe('Ship to enterprise customers in Q3');
  });

  it('does not write to the database when notes are unchanged on blur', async () => {
    const { data: project } = await createProject('Launch Plan');
    await updateProject(project!.id, { notes: 'Original description' });
    await useTaskStore.getState().loadSidebarData();
    const beforeTimestamp = (await getProjects())[0].createdAt;

    await act(async () => {
      render(<ProjectHeader projectId={project!.id} />);
    });

    const input = screen.getByTestId('project-description-input') as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.blur(input);
      await new Promise((r) => setTimeout(r, 20));
    });

    const after = (await getProjects())[0];
    expect(after.notes).toBe('Original description');
    expect(after.createdAt).toBe(beforeTimestamp);
  });
});
