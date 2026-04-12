import type { Task } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { useUiStore } from '../../store/uiStore';

interface TaskRowProps {
  task: Task;
  /** Number of unresolved dependencies (shown as blocked badge) */
  blockedByCount?: number;
}

export default function TaskRow({ task, blockedByCount = 0 }: TaskRowProps) {
  const { completeTask, reopenTask } = useTaskStore();
  const { selectedTaskId, setSelectedTaskId } = useUiStore();
  const isSelected = selectedTaskId === task.id;
  const isCompleted = task.status === 'completed';
  const isCanceled = task.status === 'canceled';
  const isDone = isCompleted || isCanceled;
  const isBlocked = blockedByCount > 0;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBlocked && !isDone) return; // cannot complete blocked tasks
    if (isDone) {
      await reopenTask(task.id);
    } else {
      await completeTask(task.id);
    }
  };

  const deadlineDisplay = task.deadline ? formatDeadline(task.deadline) : null;
  const isOverdue = task.deadline ? task.deadline < new Date().toISOString().split('T')[0] : false;

  return (
    <div
      data-testid={`task-row-${task.id}`}
      onClick={() => setSelectedTaskId(task.id)}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors group"
      style={{
        backgroundColor: isSelected ? 'var(--color-surface-active)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        data-testid={`task-toggle-${task.id}`}
        className="shrink-0 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer"
        style={{
          borderColor: isDone
            ? 'var(--color-status-completed)'
            : isBlocked
              ? 'var(--color-status-blocked)'
              : 'var(--color-border-secondary)',
          backgroundColor: isDone ? 'var(--color-status-completed)' : 'transparent',
          opacity: isBlocked && !isDone ? 0.6 : 1,
        }}
        title={isBlocked && !isDone ? 'Blocked — complete dependencies first' : undefined}
      >
        {isDone && (
          <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Blocked indicator */}
          {isBlocked && !isDone && (
            <span
              className="shrink-0"
              title={`Blocked by ${blockedByCount} task${blockedByCount > 1 ? 's' : ''}`}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'var(--color-status-blocked)' }}>
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 00-3.5 3.5V6H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1h-1.5V4.5A3.5 3.5 0 008 1zm2 5V4.5a2 2 0 10-4 0V6h4z" clipRule="evenodd" />
              </svg>
            </span>
          )}

          {/* Title */}
          <span
            className="truncate text-sm"
            style={{
              color: isDone ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
              textDecoration: isDone ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </span>
        </div>

        {/* Metadata row */}
        {(task.tags.length > 0 || deadlineDisplay) && (
          <div className="flex items-center gap-2 mt-0.5">
            {/* Tags */}
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                }}
              >
                {tag}
              </span>
            ))}

            {/* Deadline */}
            {deadlineDisplay && (
              <span
                className="text-xs"
                style={{
                  color: isOverdue && !isDone ? 'var(--color-status-overdue)' : 'var(--color-text-tertiary)',
                }}
              >
                {deadlineDisplay}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDeadline(date: string): string {
  const today = new Date().toISOString().split('T')[0];
  if (date === today) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
