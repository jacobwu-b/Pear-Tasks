import { useEffect } from 'react';
import type { ChecklistItem } from '../types';
import { useTaskStore } from '../store/taskStore';

/**
 * Loads the checklist for `taskId` into the store and returns the current items.
 * Returns an empty array until the first load resolves.
 */
export function useChecklist(taskId: string): ChecklistItem[] {
  const items = useTaskStore((s) => s.checklistByTaskId[taskId]);
  const loadChecklist = useTaskStore((s) => s.loadChecklist);

  useEffect(() => {
    loadChecklist(taskId);
  }, [taskId, loadChecklist]);

  return items ?? [];
}
