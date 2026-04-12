import { useState, useEffect, useCallback } from 'react';
import type { ChecklistItem } from '../../types';
import { useTaskStore } from '../../store/taskStore';

interface ChecklistEditorProps {
  taskId: string;
}

export default function ChecklistEditor({ taskId }: ChecklistEditorProps) {
  const { loadChecklist, addChecklistItem, toggleChecklistItem, updateChecklistItemTitle, deleteChecklistItem } = useTaskStore();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const refresh = useCallback(async () => {
    const loaded = await loadChecklist(taskId);
    setItems(loaded);
  }, [taskId, loadChecklist]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await addChecklistItem(taskId, title);
    setNewTitle('');
    await refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    await toggleChecklistItem(item.id, !item.completed);
    await refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteChecklistItem(id);
    await refresh();
  };

  const completedCount = items.filter((i) => i.completed).length;

  return (
    <div data-testid="checklist-editor">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
          Checklist
        </span>
        {items.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {completedCount}/{items.length}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 group"
            data-testid={`checklist-item-${item.id}`}
          >
            <button
              onClick={() => handleToggle(item)}
              data-testid={`checklist-toggle-${item.id}`}
              className="shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer"
              style={{
                borderColor: item.completed ? 'var(--color-status-completed)' : 'var(--color-border-secondary)',
                backgroundColor: item.completed ? 'var(--color-status-completed)' : 'transparent',
              }}
            >
              {item.completed && (
                <svg viewBox="0 0 12 12" fill="none" className="w-2.5 h-2.5">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <ChecklistItemTitle
              item={item}
              onSave={async (newTitle) => {
                await updateChecklistItemTitle(item.id, newTitle);
                await refresh();
              }}
            />
            <button
              onClick={() => handleDelete(item.id)}
              data-testid={`checklist-delete-${item.id}`}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity cursor-pointer"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add item input */}
      <div className="flex items-center gap-2 mt-2">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
          <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
        </svg>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add item..."
          data-testid="checklist-add-input"
          className="flex-1 text-sm bg-transparent outline-none"
          style={{
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
    </div>
  );
}

function ChecklistItemTitle({
  item,
  onSave,
}: {
  item: ChecklistItem;
  onSave: (title: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.title);

  // Sync if item changes externally
  useEffect(() => {
    setValue(item.title);
  }, [item.title]);

  const commit = async () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== item.title) {
      await onSave(trimmed);
    } else {
      setValue(item.title);
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setValue(item.title);
            setEditing(false);
          }
        }}
        autoFocus
        data-testid={`checklist-edit-${item.id}`}
        className="flex-1 text-sm bg-transparent outline-none"
        style={{
          color: item.completed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          textDecoration: item.completed ? 'line-through' : 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="flex-1 text-sm cursor-text"
      style={{
        color: item.completed ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
        textDecoration: item.completed ? 'line-through' : 'none',
      }}
    >
      {item.title}
    </span>
  );
}
