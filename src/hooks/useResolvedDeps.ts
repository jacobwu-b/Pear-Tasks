import { useEffect } from 'react';
import { useTaskStore, type ResolvedDep } from '../store/taskStore';

/**
 * Loads resolved dependency rows (edge joined with the other task) for `taskId`
 * into the store and returns them. Returns an empty array until loaded, and
 * skips the fetch for tasks without a project (dependencies are project-scoped).
 */
export function useResolvedDeps(taskId: string, projectId: string | null): ResolvedDep[] {
  const deps = useTaskStore((s) => s.resolvedDepsByTaskId[taskId]);
  const loadResolvedDeps = useTaskStore((s) => s.loadResolvedDeps);

  useEffect(() => {
    if (!projectId) return;
    loadResolvedDeps(taskId);
  }, [taskId, projectId, loadResolvedDeps]);

  return deps ?? [];
}
