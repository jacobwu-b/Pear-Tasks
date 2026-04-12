import { useEffect, useState, useCallback, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useTaskStore } from '../../store/taskStore';
import { getTask } from '../../db/operations';
import type { Task } from '../../types';
import ChecklistEditor from './ChecklistEditor';
import TagEditor from './TagEditor';

export default function TaskDetail() {
  const { selectedTaskId, setSelectedTaskId } = useUiStore();
  const { updateTaskField, completeTask, cancelTask, reopenTask, deleteTask } = useTaskStore();

  const [task, setTask] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const loadTask = useCallback(async () => {
    if (!selectedTaskId) return;
    const t = await getTask(selectedTaskId);
    if (t) {
      setTask(t);
      setTitle(t.title);
      setNotes(t.notes);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Save title on blur
  const handleTitleBlur = async () => {
    if (!task || title === task.title) return;
    await updateTaskField(task.id, { title });
    await loadTask();
  };

  // Save notes on blur
  const handleNotesBlur = async () => {
    if (!task || notes === task.notes) return;
    await updateTaskField(task.id, { notes });
    await loadTask();
  };

  const handleWhenChange = async (value: string) => {
    if (!task) return;
    const when = value === '' ? null : value;
    await updateTaskField(task.id, { when });
    await loadTask();
  };

  const handleDeadlineChange = async (value: string) => {
    if (!task) return;
    const deadline = value === '' ? null : value;
    await updateTaskField(task.id, { deadline });
    await loadTask();
  };

  const handleTagsChange = async (tags: string[]) => {
    if (!task) return;
    await updateTaskField(task.id, { tags });
    await loadTask();
  };

  const handleComplete = async () => {
    if (!task) return;
    await completeTask(task.id);
    await loadTask();
  };

  const handleCancel = async () => {
    if (!task) return;
    await cancelTask(task.id);
    await loadTask();
  };

  const handleReopen = async () => {
    if (!task) return;
    await reopenTask(task.id);
    await loadTask();
  };

  const handleDelete = async () => {
    if (!task) return;
    await deleteTask(task.id);
    setSelectedTaskId(null);
  };

  if (!task) {
    return (
      <div
        className="p-6 h-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-surface-secondary)' }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          Select a task to view details.
        </p>
      </div>
    );
  }

  const isDone = task.status === 'completed' || task.status === 'canceled';

  return (
    <div
      className="h-full flex flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--color-surface-secondary)' }}
      data-testid="task-detail"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {/* Status badge */}
          {task.status === 'completed' && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--color-status-completed)', color: 'white' }}>
              Completed
            </span>
          )}
          {task.status === 'canceled' && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--color-status-canceled)', color: 'white' }}>
              Canceled
            </span>
          )}
        </div>
        <button
          onClick={() => setSelectedTaskId(null)}
          data-testid="close-detail"
          className="p-1 rounded-md transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <div className="px-4 pb-3">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') titleRef.current?.blur(); }}
          data-testid="task-title-input"
          className="w-full text-lg font-semibold bg-transparent outline-none"
          style={{ color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* Fields */}
      <div className="px-4 space-y-4 pb-4">
        {/* When */}
        <div>
          <label
            className="text-xs font-semibold uppercase tracking-wide block mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            When
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={task.when && task.when !== 'someday' ? task.when : ''}
              onChange={(e) => handleWhenChange(e.target.value)}
              data-testid="task-when-input"
              className="text-sm bg-transparent outline-none px-2 py-1 rounded"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              onClick={() => handleWhenChange(task.when === 'someday' ? '' : 'someday')}
              data-testid="task-someday-btn"
              className="text-xs px-2 py-1 rounded transition-colors cursor-pointer"
              style={{
                border: '1px solid var(--color-border-primary)',
                backgroundColor: task.when === 'someday' ? 'var(--color-accent-subtle)' : 'transparent',
                color: task.when === 'someday' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              Someday
            </button>
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label
            className="text-xs font-semibold uppercase tracking-wide block mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Deadline
          </label>
          <input
            type="date"
            value={task.deadline ?? ''}
            onChange={(e) => handleDeadlineChange(e.target.value)}
            data-testid="task-deadline-input"
            className="text-sm bg-transparent outline-none px-2 py-1 rounded"
            style={{
              border: '1px solid var(--color-border-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Tags */}
        <TagEditor tags={task.tags} onChange={handleTagsChange} />

        {/* Notes */}
        <div>
          <label
            className="text-xs font-semibold uppercase tracking-wide block mb-1"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            data-testid="task-notes-input"
            rows={4}
            placeholder="Add notes (Markdown supported)..."
            className="w-full text-sm bg-transparent outline-none resize-y p-2 rounded"
            style={{
              border: '1px solid var(--color-border-primary)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Checklist */}
        <ChecklistEditor taskId={task.id} />
      </div>

      {/* Actions footer */}
      <div
        className="mt-auto px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid var(--color-border-primary)' }}
      >
        {!isDone ? (
          <>
            <button
              onClick={handleComplete}
              data-testid="task-complete-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: 'var(--color-status-completed)',
                color: 'white',
              }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
              </svg>
              Complete
            </button>
            <button
              onClick={handleCancel}
              data-testid="task-cancel-btn"
              className="px-3 py-1.5 rounded-md text-sm transition-colors cursor-pointer"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Cancel Task
            </button>
          </>
        ) : (
          <button
            onClick={handleReopen}
            data-testid="task-reopen-btn"
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            Reopen
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          data-testid="task-delete-btn"
          className="p-1.5 rounded-md transition-colors cursor-pointer"
          style={{ color: 'var(--color-text-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-status-overdue)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-tertiary)';
          }}
          title="Move to trash"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022 1.005 11.27A2.75 2.75 0 007.77 19h4.46a2.75 2.75 0 002.751-2.527l1.005-11.27.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 5a41.112 41.112 0 00-4.612.34L6.393 16.6c.058.65.608 1.15 1.26 1.15h4.694c.652 0 1.202-.5 1.26-1.15l1.005-11.26A41.1 41.1 0 0010 5z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
