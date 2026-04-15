// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createArea, createProject, getAreas } from '../../src/db/operations';
import { db } from '../../src/db/schema';
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
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('Sidebar — Area CRUD', () => {
  it('creates a new area via the New Area button and enters rename mode', async () => {
    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('sidebar-new-area'));
      await new Promise((r) => setTimeout(r, 20));
    });

    const areas = await getAreas();
    expect(areas).toHaveLength(1);
    expect(areas[0].title).toBe('New Area');

    // Rename input should be visible and focused for the newly-created area.
    expect(screen.getByTestId(`sidebar-area-rename-${areas[0].id}`)).toBeDefined();
  });

  it('commits a rename on Enter', async () => {
    const { data: area } = await createArea('Work');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    // Trigger hover to reveal pencil, then click it
    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`sidebar-area-${area!.id}`).parentElement!);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`sidebar-area-rename-btn-${area!.id}`));
    });

    const input = screen.getByTestId(`sidebar-area-rename-${area!.id}`) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Career' } });
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    const areas = await getAreas();
    expect(areas[0].title).toBe('Career');
  });

  it('reverts a rename on Escape', async () => {
    const { data: area } = await createArea('Work');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`sidebar-area-${area!.id}`).parentElement!);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`sidebar-area-rename-btn-${area!.id}`));
    });

    const input = screen.getByTestId(`sidebar-area-rename-${area!.id}`) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });
    });

    const areas = await getAreas();
    expect(areas[0].title).toBe('Work');
  });

  it('opens confirm dialog and deletes the area on confirm (orphaning projects)', async () => {
    const { data: area } = await createArea('Work');
    await createProject('P1', area!.id);
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`sidebar-area-${area!.id}`).parentElement!);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`sidebar-area-delete-btn-${area!.id}`));
    });

    expect(screen.getByTestId('area-delete-confirm')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('area-delete-confirm-btn'));
    });

    // Area is soft-deleted (row still exists with deletedAt set).
    const raw = await db.areas.get(area!.id);
    expect(raw!.deletedAt).toBeTypeOf('number');

    // getAreas hides it.
    const listed = await getAreas();
    expect(listed).toHaveLength(0);

    // The project is orphaned to No Area.
    const p = await db.projects.get((await db.projects.toArray())[0].id);
    expect(p!.areaId).toBeNull();
  });

  it('cancel on confirm dialog does nothing', async () => {
    const { data: area } = await createArea('Work');
    await useTaskStore.getState().loadSidebarData();

    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`sidebar-area-${area!.id}`).parentElement!);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`sidebar-area-delete-btn-${area!.id}`));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('area-delete-cancel'));
    });

    const listed = await getAreas();
    expect(listed).toHaveLength(1);
  });

  it('deleting the currently-selected area resets sidebarView to inbox', async () => {
    const { data: area } = await createArea('Work');
    await useTaskStore.getState().loadSidebarData();
    useUiStore.setState({ sidebarView: { type: 'area', areaId: area!.id } });

    await act(async () => {
      render(<Sidebar />);
    });

    await act(async () => {
      fireEvent.mouseEnter(screen.getByTestId(`sidebar-area-${area!.id}`).parentElement!);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`sidebar-area-delete-btn-${area!.id}`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('area-delete-confirm-btn'));
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(useUiStore.getState().sidebarView).toBe('inbox');
  });
});
