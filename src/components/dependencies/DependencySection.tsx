import { useState } from 'react';
import type { Task } from '../../types';
import { useTaskStore, type ResolvedDep } from '../../store/taskStore';
import { useResolvedDeps } from '../../hooks/useResolvedDeps';
import DependencyPicker from './DependencyPicker';

interface DependencySectionProps {
  task: Task;
}

export default function DependencySection({ task }: DependencySectionProps) {
  const removeDependency = useTaskStore((s) => s.removeDependency);
  const deps = useResolvedDeps(task.id, task.projectId);
  const [showPicker, setShowPicker] = useState(false);

  const handleRemove = async (dep: ResolvedDep) => {
    if (dep.direction === 'blockedBy') {
      await removeDependency(dep.task.id, task.id);
    } else {
      await removeDependency(task.id, dep.task.id);
    }
  };

  const handleAdded = () => {
    setShowPicker(false);
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
