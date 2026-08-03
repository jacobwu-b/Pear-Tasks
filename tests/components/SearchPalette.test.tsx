// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import SearchPalette from '../../src/components/common/SearchPalette';
import { useUiStore } from '../../src/store/uiStore';
import { searchAll, type SearchResult } from '../../src/lib/search';

vi.mock('../../src/lib/search', () => ({
  searchAll: vi.fn(),
}));

const mockedSearchAll = vi.mocked(searchAll);

const kitchenProject: SearchResult = {
  type: 'project',
  id: 'proj-kitchen',
  title: 'Kitchen Remodel',
  matchContext: null,
  projectId: null,
  projectTitle: null,
  status: 'active',
};

const orderTiles: SearchResult = {
  type: 'task',
  id: 'task-tiles',
  title: 'Order subway tiles',
  matchContext: null,
  projectId: 'proj-kitchen',
  projectTitle: 'Kitchen Remodel',
  status: 'open',
};

const callPlumber: SearchResult = {
  type: 'task',
  id: 'task-plumber',
  title: 'Call the plumber back',
  matchContext: 'quote for the sink rough-in',
  projectId: 'proj-kitchen',
  projectTitle: 'Kitchen Remodel',
  status: 'open',
};

const renewPassport: SearchResult = {
  type: 'task',
  id: 'task-passport',
  title: 'Renew passport',
  matchContext: null,
  projectId: null,
  projectTitle: null,
  status: 'open',
};

/** Debounce is 100ms; wait past it and let the awaited search settle. */
async function flushDebounce() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150));
  });
}

async function renderPalette(onClose: () => void = () => {}) {
  await act(async () => {
    render(<SearchPalette open={true} onClose={onClose} />);
  });
  return screen.getByTestId('search-palette-input') as HTMLInputElement;
}

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
}

function activeResultTitle(): string | null {
  const active = document.querySelector('[data-testid^="search-result-"][data-active="true"]');
  return active?.querySelector('div > div')?.textContent ?? null;
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockedSearchAll.mockReset();
  mockedSearchAll.mockResolvedValue([]);
  useUiStore.setState({ sidebarView: 'inbox', selectedTaskId: null });
});

describe('SearchPalette', () => {
  it('clearing the query empties the result list', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles]);
    const input = await renderPalette();

    await type(input, 'kitchen');
    await flushDebounce();
    expect(screen.getByTestId('search-result-project-proj-kitchen')).toBeDefined();

    await type(input, '');

    expect(screen.queryByTestId('search-result-project-proj-kitchen')).toBeNull();
    expect(screen.queryByTestId('search-result-task-task-tiles')).toBeNull();
    expect(screen.queryByTestId('search-no-results')).toBeNull();
  });

  it('clearing the query resets the active row so Enter does nothing', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles]);
    const onClose = vi.fn();
    const input = await renderPalette(onClose);

    await type(input, 'kitchen');
    await flushDebounce();
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await type(input, '');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).not.toHaveBeenCalled();
    expect(useUiStore.getState().sidebarView).toBe('inbox');
    expect(useUiStore.getState().selectedTaskId).toBeNull();
  });

  it('debounces typing into a single search for the final query', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject]);
    const input = await renderPalette();

    await type(input, 'k');
    await type(input, 'ki');
    await type(input, 'kit');
    await flushDebounce();

    expect(mockedSearchAll).toHaveBeenCalledTimes(1);
    expect(mockedSearchAll).toHaveBeenCalledWith('kit');
  });

  it('ArrowDown moves the active row down and clamps at the last result', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles, callPlumber]);
    const input = await renderPalette();

    await type(input, 'kitchen');
    await flushDebounce();
    expect(activeResultTitle()).toBe('Kitchen Remodel');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeResultTitle()).toBe('Order subway tiles');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeResultTitle()).toBe('Call the plumber back');
  });

  it('ArrowUp moves the active row up and clamps at the first result', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles, callPlumber]);
    const input = await renderPalette();

    await type(input, 'kitchen');
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(activeResultTitle()).toBe('Call the plumber back');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeResultTitle()).toBe('Order subway tiles');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(activeResultTitle()).toBe('Kitchen Remodel');
  });

  it('Enter on a task result navigates to its project and selects the task', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles]);
    const onClose = vi.fn();
    const input = await renderPalette(onClose);

    await type(input, 'kitchen');
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useUiStore.getState().sidebarView).toEqual({ type: 'project', projectId: 'proj-kitchen' });
    expect(useUiStore.getState().selectedTaskId).toBe('task-tiles');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter on a task with no project navigates to Inbox and selects the task', async () => {
    mockedSearchAll.mockResolvedValue([renewPassport]);
    const onClose = vi.fn();
    const input = await renderPalette(onClose);

    await type(input, 'passport');
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useUiStore.getState().sidebarView).toBe('inbox');
    expect(useUiStore.getState().selectedTaskId).toBe('task-passport');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter on a project result navigates to the project without selecting a task', async () => {
    mockedSearchAll.mockResolvedValue([kitchenProject, orderTiles]);
    const onClose = vi.fn();
    const input = await renderPalette(onClose);

    await type(input, 'kitchen');
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useUiStore.getState().sidebarView).toEqual({ type: 'project', projectId: 'proj-kitchen' });
    expect(useUiStore.getState().selectedTaskId).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter with no results does not navigate or close', async () => {
    mockedSearchAll.mockResolvedValue([]);
    const onClose = vi.fn();
    const input = await renderPalette(onClose);

    await type(input, 'nothing matches this');
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(useUiStore.getState().sidebarView).toBe('inbox');
    expect(useUiStore.getState().selectedTaskId).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the no-results message for a query with no matches', async () => {
    mockedSearchAll.mockResolvedValue([]);
    const input = await renderPalette();

    await type(input, 'quokka');
    await flushDebounce();

    expect(screen.getByTestId('search-no-results').textContent).toBe('No results for "quokka"');
  });
});
