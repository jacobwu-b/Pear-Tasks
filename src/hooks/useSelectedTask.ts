import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { useTaskStore } from '../store/taskStore';

/**
 * Loads the selected task into the store's `selectedTaskDetail` whenever
 * selectedTaskId changes, and returns the current snapshot.
 */
export function useSelectedTask() {
  const selectedTaskId = useUiStore((s) => s.selectedTaskId);
  const { selectedTaskDetail, loadSelectedTaskDetail } = useTaskStore();

  useEffect(() => {
    loadSelectedTaskDetail(selectedTaskId);
  }, [selectedTaskId, loadSelectedTaskDetail]);

  return selectedTaskDetail;
}
