import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTask,
  getTask,
  spawnNextRecurrence,
  completeTaskWithRecurrence,
  updateRecurrenceForward,
  getRecurringFamily,
} from '../../src/db/operations';
import type { RecurrenceConfig } from '../../src/types';
import { getLocalTodayDateString } from '../../src/lib/dates';
import { clearDatabase } from '../helpers';

// Fixed reference date used in tests so results are deterministic.
const TODAY = '2026-04-13';

const dailyConfig: RecurrenceConfig = {
  frequency: 'daily',
  interval: 1,
  daysOfWeek: [],
  monthlySpec: null,
  month: null,
  endDate: null,
};

const weeklyMondayConfig: RecurrenceConfig = {
  frequency: 'weekly',
  interval: 1,
  daysOfWeek: [1],
  monthlySpec: null,
  month: null,
  endDate: null,
};

beforeEach(async () => {
  await clearDatabase();
});

// ---------------------------------------------------------------------------
// spawnNextRecurrence
// ---------------------------------------------------------------------------

describe('spawnNextRecurrence', () => {
  it('returns ok(null) for a non-recurring task', async () => {
    const { data: task } = await createTask('Regular task', { when: TODAY });
    const result = await spawnNextRecurrence(task!);
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('spawns from today when the task has no when date', async () => {
    // A recurring task without a scheduled date should still spawn a next
    // instance when completed, using today as the reference point.
    const { data: task } = await createTask('Recurring without date', {
      recurrence: dailyConfig,
    });
    const result = await spawnNextRecurrence(task!);
    expect(result.error).toBeNull();
    // Should have spawned for tomorrow (daily from today).
    // Use getLocalTodayDateString to match the same local-clock logic used in
    // spawnNextRecurrence so the assertion is timezone-safe.
    expect(result.data).not.toBeNull();
    const todayLocal = getLocalTodayDateString();
    const [ty, tm, td] = todayLocal.split('-').map(Number);
    const tomorrowDate = new Date(ty, tm - 1, td + 1);
    const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
    expect(result.data!.when).toBe(tomorrowStr);
    expect(result.data!.status).toBe('open');
  });

  it('creates the next day for a daily recurring task', async () => {
    const { data: task } = await createTask('Daily standup', {
      when: TODAY,
      recurrence: dailyConfig,
    });

    const result = await spawnNextRecurrence(task!);
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const spawned = result.data!;
    expect(spawned.when).toBe('2026-04-14');
    expect(spawned.status).toBe('open');
    expect(spawned.completedAt).toBeNull();
    expect(spawned.deletedAt).toBeNull();
  });

  it('copies title, notes, tags, projectId, areaId, deadline, recurrence from parent', async () => {
    const { data: task } = await createTask('Team standup', {
      when: TODAY,
      notes: 'Agenda: ...',
      tags: ['work', 'recurring'],
      deadline: '2026-12-31',
      recurrence: dailyConfig,
    });

    const result = await spawnNextRecurrence(task!);
    const spawned = result.data!;

    expect(spawned.title).toBe('Team standup');
    expect(spawned.notes).toBe('Agenda: ...');
    expect(spawned.tags).toEqual(['work', 'recurring']);
    expect(spawned.deadline).toBe('2026-12-31');
    expect(spawned.recurrence).toEqual(dailyConfig);
  });

  it('sets recurringParentId to the root task id for a first-generation spawn', async () => {
    const { data: root } = await createTask('Root task', {
      when: TODAY,
      recurrence: dailyConfig,
    });
    expect(root!.recurringParentId).toBeNull(); // root has no parent

    const { data: child } = await spawnNextRecurrence(root!);
    expect(child!.recurringParentId).toBe(root!.id);
  });

  it('preserves the root id when spawning from a second-generation instance', async () => {
    // Simulate: root → child → grandchild
    const { data: root } = await createTask('Root', {
      when: TODAY,
      recurrence: dailyConfig,
    });
    const { data: child } = await spawnNextRecurrence(root!);
    // child.recurringParentId === root.id

    const { data: grandchild } = await spawnNextRecurrence(child!);
    // grandchild.recurringParentId must still be root.id (not child.id)
    expect(grandchild!.recurringParentId).toBe(root!.id);
  });

  it('does not copy dependency edges to the spawned task', async () => {
    // Verify spawned task has a fresh id (different from parent), which means edges
    // referencing the parent ID won't affect it.
    const { data: task } = await createTask('With edges', {
      when: TODAY,
      recurrence: dailyConfig,
    });
    const { data: spawned } = await spawnNextRecurrence(task!);
    expect(spawned!.id).not.toBe(task!.id);
  });

  it('returns ok(null) when next occurrence is past the endDate', async () => {
    const config: RecurrenceConfig = {
      ...dailyConfig,
      endDate: TODAY, // endDate is the same as fromDate, so next (tomorrow) > endDate
    };
    const { data: task } = await createTask('Ending today', {
      when: TODAY,
      recurrence: config,
    });
    const result = await spawnNextRecurrence(task!);
    expect(result.data).toBeNull();
  });

  it('returns the spawned task at the endDate boundary', async () => {
    const tomorrow = '2026-04-14';
    const config: RecurrenceConfig = { ...dailyConfig, endDate: tomorrow };
    const { data: task } = await createTask('One more', {
      when: TODAY,
      recurrence: config,
    });
    const result = await spawnNextRecurrence(task!);
    expect(result.data?.when).toBe(tomorrow);
  });
});

// ---------------------------------------------------------------------------
// completeTaskWithRecurrence
// ---------------------------------------------------------------------------

describe('completeTaskWithRecurrence', () => {
  it('returns error when task is not found', async () => {
    const result = await completeTaskWithRecurrence('nonexistent-id');
    expect(result.error).toBeTruthy();
  });

  it('marks a non-recurring task as completed and returns null for spawned', async () => {
    const { data: task } = await createTask('One-off task');
    const result = await completeTaskWithRecurrence(task!.id);

    expect(result.error).toBeNull();
    expect(result.data!.completed.status).toBe('completed');
    expect(result.data!.completed.completedAt).not.toBeNull();
    expect(result.data!.spawned).toBeNull();

    const inDb = await getTask(task!.id);
    expect(inDb!.status).toBe('completed');
  });

  it('marks a recurring task as completed and spawns the next instance', async () => {
    const { data: task } = await createTask('Daily standup', {
      when: TODAY,
      recurrence: dailyConfig,
    });

    const result = await completeTaskWithRecurrence(task!.id);
    expect(result.error).toBeNull();
    expect(result.data!.completed.status).toBe('completed');

    const spawned = result.data!.spawned!;
    expect(spawned.when).toBe('2026-04-14');
    expect(spawned.status).toBe('open');

    // Verify spawned is persisted in the DB
    const inDb = await getTask(spawned.id);
    expect(inDb).not.toBeUndefined();
    expect(inDb!.status).toBe('open');
  });

  it('does not spawn when recurring task is past its endDate', async () => {
    const config: RecurrenceConfig = { ...dailyConfig, endDate: TODAY };
    const { data: task } = await createTask('Last occurrence', {
      when: TODAY,
      recurrence: config,
    });

    const result = await completeTaskWithRecurrence(task!.id);
    expect(result.data!.spawned).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateRecurrenceForward
// ---------------------------------------------------------------------------

describe('updateRecurrenceForward', () => {
  it('updates only the specified task for scope "this" (via updateTaskField)', async () => {
    // updateRecurrenceForward is "this and forward" — test via the store action;
    // here test the DB function directly.
    const { data: root } = await createTask('Root', { when: TODAY, recurrence: dailyConfig });

    const newConfig: RecurrenceConfig = { ...dailyConfig, interval: 2 };
    await updateRecurrenceForward(root!.id, root!.id, TODAY, newConfig);

    const updated = await getTask(root!.id);
    expect(updated!.recurrence?.interval).toBe(2);
  });

  it('updates sibling open instances at or after fromWhen', async () => {
    const { data: root } = await createTask('Root', {
      when: '2026-04-10',
      recurrence: dailyConfig,
    });
    // Simulate two spawned siblings
    const { data: child1 } = await createTask('Child 1', {
      when: '2026-04-13', // >= fromWhen
      recurrence: dailyConfig,
      recurringParentId: root!.id,
    });
    const { data: child2 } = await createTask('Child 2', {
      when: '2026-04-20', // >= fromWhen
      recurrence: dailyConfig,
      recurringParentId: root!.id,
    });
    const { data: pastChild } = await createTask('Past child', {
      when: '2026-04-11', // < fromWhen — should NOT be updated
      recurrence: dailyConfig,
      recurringParentId: root!.id,
    });

    const newConfig: RecurrenceConfig = { ...dailyConfig, interval: 3 };
    const fromWhen = '2026-04-13';
    await updateRecurrenceForward(child1!.id, root!.id, fromWhen, newConfig);

    const updatedRoot   = await getTask(root!.id);
    const updatedChild1 = await getTask(child1!.id);
    const updatedChild2 = await getTask(child2!.id);
    const updatedPast   = await getTask(pastChild!.id);

    // child1 (the one we edited) + child2 (same root, open, when >= fromWhen) updated
    expect(updatedChild1!.recurrence?.interval).toBe(3);
    expect(updatedChild2!.recurrence?.interval).toBe(3);
    // root was NOT in the siblings query (has recurringParentId=null), not updated
    expect(updatedRoot!.recurrence?.interval).toBe(1);
    // past child not updated (when < fromWhen)
    expect(updatedPast!.recurrence?.interval).toBe(1);
  });

  it('can clear recurrence forward', async () => {
    const { data: root } = await createTask('Root', { when: TODAY, recurrence: dailyConfig });

    await updateRecurrenceForward(root!.id, root!.id, TODAY, null);

    const updated = await getTask(root!.id);
    expect(updated!.recurrence).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getRecurringFamily
// ---------------------------------------------------------------------------

describe('getRecurringFamily', () => {
  it('returns all tasks with the given recurringParentId', async () => {
    const { data: root } = await createTask('Root', { when: TODAY, recurrence: dailyConfig });
    const { data: a } = await createTask('Child A', { when: '2026-04-14', recurrence: dailyConfig, recurringParentId: root!.id });
    const { data: b } = await createTask('Child B', { when: '2026-04-15', recurrence: dailyConfig, recurringParentId: root!.id });
    await createTask('Unrelated', { when: TODAY });

    const family = await getRecurringFamily(root!.id);
    const ids = family.map((t) => t.id).sort();
    expect(ids).toEqual([a!.id, b!.id].sort());
  });

  it('includes soft-deleted instances', async () => {
    const { data: root } = await createTask('Root', { when: TODAY, recurrence: dailyConfig });
    const { data: child } = await createTask('Deleted child', {
      when: '2026-04-14',
      recurrence: dailyConfig,
      recurringParentId: root!.id,
    });

    // Simulate soft delete by updating directly
    const { updateTask } = await import('../../src/db/operations');
    await updateTask(child!.id, { deletedAt: Date.now() });

    const family = await getRecurringFamily(root!.id);
    expect(family.some((t) => t.id === child!.id)).toBe(true);
  });

  it('returns empty array when no children exist', async () => {
    const { data: root } = await createTask('Lone root', { when: TODAY, recurrence: dailyConfig });
    const family = await getRecurringFamily(root!.id);
    expect(family).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Recurrence field in createTask
// ---------------------------------------------------------------------------

describe('createTask with recurrence', () => {
  it('stores null recurrence for a plain task', async () => {
    const { data: task } = await createTask('Plain task');
    expect(task!.recurrence).toBeNull();
    expect(task!.recurringParentId).toBeNull();
  });

  it('stores the recurrence config and parentId when provided', async () => {
    const { data: task } = await createTask('Recurring', {
      recurrence: weeklyMondayConfig,
      recurringParentId: 'some-root-id',
    });
    expect(task!.recurrence).toEqual(weeklyMondayConfig);
    expect(task!.recurringParentId).toBe('some-root-id');
  });
});
