// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import TaskRow from '../../src/components/tasks/TaskRow';
import type { Task } from '../../src/types';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function buildTask(deadline: string | null): Task {
  return {
    id: 'task-1',
    title: 'Review issue',
    notes: '',
    status: 'open',
    when: null,
    deadline,
    tags: [],
    projectId: null,
    areaId: null,
    sortOrder: 0,
    createdAt: Date.now(),
    completedAt: null,
    deletedAt: null,
  };
}

describe('TaskRow deadline labels', () => {
  it('shows Today using the local calendar date near midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 14, 23, 30, 0));

    render(<TaskRow task={buildTask('2026-04-14')} />);

    expect(screen.getByText('Today')).toBeDefined();
  });

  it('shows Tomorrow using the local calendar date near midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 14, 23, 30, 0));

    render(<TaskRow task={buildTask('2026-04-15')} />);

    expect(screen.getByText('Tomorrow')).toBeDefined();
  });
});
