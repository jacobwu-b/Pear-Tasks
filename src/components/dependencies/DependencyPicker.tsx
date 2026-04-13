import { useState, useEffect, useRef } from 'react';
import type { Task } from '../../types';
import { getTasksByProject, getTaskDependencies } from '../../db/operations';
import { useTaskStore } from '../../store/taskStore';

interface DependencyPickerProps {
  task: Task;
  onAdded: () => void;
  onCancel: () => void;
}

type Direction = 'blockedBy' | 'blocks';

export default function DependencyPicker({ task, onAdded, onCancel }: DependencyPickerProps) {
  const { addDependency } = useTaskStore();
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('blockedBy');
  const [candidates, setCandidates] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load candidate tasks (same project, excluding self and already-linked)
  useEffect(() => {
    if (!task.projectId) return;
    (async () => {
      const [projectTasks, existingEdges] = await Promise.all([
        getTasksByProject(task.projectId!),
        getTaskDependencies(task.id),
      ]);

      const linkedIds = new Set<string>();
      linkedIds.add(task.id);
      for (const e of existingEdges) {
        linkedIds.add(e.fromTaskId);
        linkedIds.add(e.toTaskId);
      }

      setCandidates(
        projectTasks.filter((t) => !linkedIds.has(t.id) && t.status === 'open')
      );
    })();
  }, [task.id, task.projectId]);

  const filtered = query
    ? candidates.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
    : candidates;

  const handleSelect = async (other: Task) => {
    setError(null);
    const fromId = direction === 'blockedBy' ? other.id : task.id;
    const toId = direction === 'blockedBy' ? task.id : other.id;
    const result = await addDependency(fromId, toId, task.projectId!);
    if (result.error) {
      setError(result.error);
    } else {
      onAdded();
    }
  };

  return (
    <div
      data-testid="dependency-picker"
      className="rounded-md p-2 mb-2"
      style={{
        border: '1px solid var(--color-border-primary)',
        backgroundColor: 'var(--color-surface-primary)',
      }}
    >
      {/* Direction toggle */}
      <div className="flex items-center gap-1 mb-2">
        <button
          onClick={() => setDirection('blockedBy')}
          data-testid="dep-dir-blocked-by"
          className="text-xs px-2 py-0.5 rounded transition-colors cursor-pointer"
          style={{
            backgroundColor: direction === 'blockedBy' ? 'var(--color-accent-subtle)' : 'transparent',
            color: direction === 'blockedBy' ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
          }}
        >
          Blocked by
        </button>
        <button
          onClick={() => setDirection('blocks')}
          data-testid="dep-dir-blocks"
          className="text-xs px-2 py-0.5 rounded transition-colors cursor-pointer"
          style={{
            backgroundColor: direction === 'blocks' ? 'var(--color-accent-subtle)' : 'transparent',
            color: direction === 'blocks' ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
          }}
        >
          Blocks
        </button>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          data-testid="dep-picker-cancel"
          className="text-xs cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          Cancel
        </button>
      </div>

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tasks..."
        data-testid="dep-picker-search"
        className="w-full text-xs bg-transparent outline-none px-2 py-1 rounded mb-1"
        style={{
          border: '1px solid var(--color-border-secondary)',
          color: 'var(--color-text-primary)',
        }}
      />

      {/* Error */}
      {error && (
        <p
          data-testid="dep-picker-error"
          className="text-xs mb-1 px-1"
          style={{ color: 'var(--color-status-overdue)' }}
        >
          {error}
        </p>
      )}

      {/* Results */}
      <div className="max-h-32 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs px-1 py-2" style={{ color: 'var(--color-text-tertiary)' }}>
            {candidates.length === 0 ? 'No other tasks in this project' : 'No matches'}
          </p>
        ) : (
          filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              data-testid={`dep-candidate-${t.id}`}
              className="w-full text-left text-xs px-2 py-1.5 rounded cursor-pointer transition-colors"
              style={{ color: 'var(--color-text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {t.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
