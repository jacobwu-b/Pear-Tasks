// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { db } from '../../src/db/schema';
import { createTask } from '../../src/db/operations';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await clearDatabase();
  useUiStore.setState({ sidebarView: 'inbox', selectedTaskId: null });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('App bootstrap — trash purge', () => {
  it('purges a >30-day-old trashed task on startup', async () => {
    const { data: stale } = await createTask('Long forgotten');
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    await db.tasks.update(stale!.id, { deletedAt: Date.now() - THIRTY_ONE_DAYS_MS });

    render(<App />);

    await waitFor(async () => {
      expect(await db.tasks.get(stale!.id)).toBeUndefined();
    });
  });
});
