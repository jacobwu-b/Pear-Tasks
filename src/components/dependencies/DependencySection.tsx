import { useState, useEffect, useCallback } from 'react';
import type { Task, DependencyEdge } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { getTask } from '../../db/operations';
import DependencyPicker from './DependencyPicker';

interface DependencySectionProps {
  task: Task;
  onChanged: () => void;
}

interface ResolvedDep {
  edge: DependencyEdge;
  task: Task;
  direction: 'blocks' | 'blockedBy';
}

export default function DependencySection({ task, onChanged }: DependencySectionProps) {
  const { getTaskDeps, removeDependency } = useTaskStore();
  const [deps, setDeps] = useState<ResolvedDep[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const loadDeps = useCallback(async () => {
    if (!task.projectId) {
      setDeps([]);
      return;
    }
    const edges = await getTaskDeps(task.id);
    const resolved: ResolvedDep[] = [];
    for (const edge of edges) {
      const isFrom = edge.fromTaskId === task.id;
      const otherId = isFrom ? edge.toTaskId : edge.fromTaskId;
      const otherTask = await getTask(otherId);
      if (otherTask) {
        resolved.push({
          edge,
          task: otherTask,
          direction: isFrom ? 'blocks' : 'blockedBy',
        });
      }
    }
    setDeps(resolved);
  }, [task.id, task.projectId, getTaskDeps]);

  useEffect(() => {
    loadDeps();
  }, [loadDeps]);

  const handleRemove = async (dep: ResolvedDep) => {
    if (dep.direction === 'blockedBy') {
      await removeDependency(dep.task.id, task.id);
    } else {
      await removeDependency(task.id, dep.task.id);
    }
    await loadDeps();
    onChanged();
  };

  const handleAdded = async () => {
    setShowPicker(false);
    await loadDeps();
    onChanged();
  };

  // Only show for tasks inside a project
  if (!task.projectId) return null;

  const blockedBy = deps.filter((d) => d.direction === 'blockedBy');
  const blocks = deps.filter((d) => d.direction === 'blocks');

  return (
    <div data-testid="dependency-section">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Dependencies
        </span>
        <button
          onClick={() => setShowPicker(!showPicker)}
          data-testid="add-dependency-btn"
          className="text-xs px-1.5 py-0.5 rounded transition-colors cursor-pointer"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: showPicker ? 'var(--color-accent-subtle)' : 'transparent',
          }}
        >
          + Add
        </button>
      </div>

      {showPicker && (
        <DependencyPicker task={task} onAdded={handleAdded} onCancel={() => setShowPicker(false)} />
      )}

      {/* Blocked by */}
      {blockedBy.length > 0 && (
        <div className="mb-2">
          <div
            className="text-xs mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Blocked by
          </div>
          {blockedBy.map((dep) => (
            <DepChip key={dep.edge.id} dep={dep} onRemove={() => handleRemove(dep)} />
          ))}
        </div>
      )}

      {/* Blocks */}
      {blocks.length > 0 && (
        <div className="mb-2">
          <div
            className="text-xs mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Blocks
          </div>
          {blocks.map((dep) => (
            <DepChip key={dep.edge.id} dep={dep} onRemove={() => handleRemove(dep)} />
          ))}
        </div>
      )}

      {deps.length === 0 && !showPicker && (
        <p
          className="text-xs"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          No dependencies
        </p>
      )}
    </div>
  );
}

function DepChip({ dep, onRemove }: { dep: ResolvedDep; onRemove: () => void }) {
  const isDone = dep.task.status === 'completed' || dep.task.status === 'canceled';

  return (
    <div
      data-testid={`dep-chip-${dep.edge.id}`}
      className="flex items-center gap-1.5 px-2 py-1 rounded mb-1 group"
      style={{
        backgroundColor: 'var(--color-surface-hover)',
      }}
    >
      {/* Status indicator */}
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{
          backgroundColor: isDone
            ? 'var(--color-status-completed)'
            : dep.direction === 'blockedBy'
              ? 'var(--color-status-blocked)'
              : 'var(--color-accent)',
        }}
      />
      <span
        className="flex-1 text-xs truncate"
        style={{
          color: isDone ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      >
        {dep.task.title}
      </span>
      <button
        onClick={onRemove}
        data-testid={`dep-remove-${dep.edge.id}`}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity cursor-pointer"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
        </svg>
      </button>
    </div>
  );
}
