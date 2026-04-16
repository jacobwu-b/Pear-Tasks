import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, getTodayTasks, getUpcomingTasks } from '../../src/db/operations';
import { clearDatabase } from '../helpers';

beforeEach(async () => {
  await clearDatabase();
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('local date filtering regression', () => {
  it('uses the local calendar date instead of UTC near midnight', async () => {
    vi.setSystemTime(new Date(2026, 3, 14, 23, 30, 0));

    await createTask('Late-night today', { when: '2026-04-14' });
    await createTask('Late-night upcoming', { when: '2026-04-15' });
    await createTask('Deadline today', { deadline: '2026-04-14' });

    const todayTitles = (await getTodayTasks()).map((task) => task.title);
    const upcomingTitles = (await getUpcomingTasks()).map((task) => task.title);

    expect(todayTitles).toContain('Late-night today');
    expect(todayTitles).toContain('Deadline today');
    expect(todayTitles).not.toContain('Late-night upcoming');
    expect(upcomingTitles).toEqual(['Late-night upcoming']);
  });
});
