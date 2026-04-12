import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { useTaskStore } from '../store/taskStore';

/**
 * Loads tasks for the current sidebar view whenever it changes.
 * Returns the tasks array from the store.
 */
export function useViewTasks() {
  const sidebarView = useUiStore((s) => s.sidebarView);
  const { tasks, loadTasksForView } = useTaskStore();

  useEffect(() => {
    loadTasksForView(sidebarView);
  }, [sidebarView, loadTasksForView]);

  return tasks;
}
