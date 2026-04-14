import { useState, useRef, useEffect } from 'react';
import type { ProjectTemplate, TemplateTask, TemplateEdge } from '../../types';
import { useTaskStore } from '../../store/taskStore';

interface TemplateEditorProps {
  template: ProjectTemplate;
  onClose: () => void;
  onSaved: () => void;
}

export default function TemplateEditor({ template, onClose, onSaved }: TemplateEditorProps) {
  const { updateTemplate } = useTaskStore();
  const [name, setName] = useState(template.name);
  const [tasks, setTasks] = useState<TemplateTask[]>(
    () => template.tasks.map((t) => ({ ...t, checklistTitles: [...t.checklistTitles] }))
  );
  const [edges, setEdges] = useState<TemplateEdge[]>(() => template.edges.map((e) => ({ ...e })));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // For the "add dependency" dropdowns
  const [depFrom, setDepFrom] = useState('');
  const [depTo, setDepTo] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  // ── Task operations ─────────────────────────────────────────────

  const addTask = () => {
    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTasks((prev) => [...prev, { tempId, title: 'New Task', checklistTitles: [] }]);
  };

  const removeTask = (tempId: string) => {
    setTasks((prev) => prev.filter((t) => t.tempId !== tempId));
    setEdges((prev) => prev.filter((e) => e.fromTempId !== tempId && e.toTempId !== tempId));
    if (expandedTaskId === tempId) setExpandedTaskId(null);
  };

  const updateTaskTitle = (tempId: string, title: string) => {
    setTasks((prev) => prev.map((t) => t.tempId === tempId ? { ...t, title } : t));
  };

  // ── Checklist operations ────────────────────────────────────────

  const addChecklistItem = (tempId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.tempId === tempId
        ? { ...t, checklistTitles: [...t.checklistTitles, ''] }
        : t
    ));
  };

  const updateChecklistItem = (tempId: string, index: number, value: string) => {
    setTasks((prev) => prev.map((t) => {
      if (t.tempId !== tempId) return t;
      const updated = [...t.checklistTitles];
      updated[index] = value;
      return { ...t, checklistTitles: updated };
    }));
  };

  const removeChecklistItem = (tempId: string, index: number) => {
    setTasks((prev) => prev.map((t) => {
      if (t.tempId !== tempId) return t;
      const updated = t.checklistTitles.filter((_, i) => i !== index);
      return { ...t, checklistTitles: updated };
    }));
  };

  // ── Edge operations ─────────────────────────────────────────────

  const addEdge = () => {
    if (!depFrom || !depTo || depFrom === depTo) return;
    const exists = edges.some((e) => e.fromTempId === depFrom && e.toTempId === depTo);
    if (exists) return;
    setEdges((prev) => [...prev, { fromTempId: depFrom, toTempId: depTo }]);
    setDepFrom('');
    setDepTo('');
  };

  const removeEdge = (index: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== index));
  };

  const taskLabel = (tempId: string) => {
    return tasks.find((t) => t.tempId === tempId)?.title ?? tempId;
  };

  // ── Save ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (tasks.length === 0) {
      setError('Template must have at least one task');
      return;
    }
    // Strip empty checklist items
    const cleanedTasks = tasks.map((t) => ({
      ...t,
      title: t.title.trim() || 'Untitled Task',
      checklistTitles: t.checklistTitles.filter((c) => c.trim()),
    }));

    setSaving(true);
    setError(null);
    const result = await updateTemplate(template.id, {
      name: name.trim(),
      tasks: cleanedTasks,
      edges,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div
      data-testid="template-editor-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="template-editor"
        className="w-full max-w-lg rounded-lg overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-surface-primary)',
          boxShadow: 'var(--shadow-md)',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Edit Template
          </h2>
          <button
            onClick={onClose}
            data-testid="template-editor-close"
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Template name */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Template Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="template-editor-name"
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* Tasks */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Tasks ({tasks.length})
            </label>
            <div className="space-y-1">
              {tasks.map((task) => (
                <div key={task.tempId}>
                  <div
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    style={{ backgroundColor: 'var(--color-surface-secondary)' }}
                  >
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedTaskId(expandedTaskId === task.tempId ? null : task.tempId)}
                      className="p-0.5 cursor-pointer shrink-0"
                      data-testid={`template-editor-expand-${task.tempId}`}
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`w-3.5 h-3.5 transition-transform ${expandedTaskId === task.tempId ? 'rotate-90' : ''}`}
                      >
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {/* Title input */}
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTaskTitle(task.tempId, e.target.value)}
                      data-testid={`template-editor-task-title-${task.tempId}`}
                      className="flex-1 min-w-0 text-sm bg-transparent outline-none"
                      style={{ color: 'var(--color-text-primary)' }}
                    />
                    {/* Checklist count badge */}
                    {task.checklistTitles.length > 0 && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: 'var(--color-surface-tertiary)', color: 'var(--color-text-tertiary)' }}
                      >
                        {task.checklistTitles.length}
                      </span>
                    )}
                    {/* Delete task */}
                    <button
                      onClick={() => removeTask(task.tempId)}
                      data-testid={`template-editor-remove-task-${task.tempId}`}
                      className="p-0.5 cursor-pointer shrink-0 transition-colors"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-status-overdue)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                      </svg>
                    </button>
                  </div>

                  {/* Expanded checklist items */}
                  {expandedTaskId === task.tempId && (
                    <div className="ml-6 mt-1 mb-2 space-y-1" data-testid={`template-editor-checklist-${task.tempId}`}>
                      {task.checklistTitles.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>-</span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => updateChecklistItem(task.tempId, idx, e.target.value)}
                            data-testid={`template-editor-checklist-item-${task.tempId}-${idx}`}
                            className="flex-1 min-w-0 text-xs bg-transparent outline-none px-1 py-0.5 rounded"
                            style={{
                              color: 'var(--color-text-secondary)',
                              border: '1px solid var(--color-border-primary)',
                            }}
                          />
                          <button
                            onClick={() => removeChecklistItem(task.tempId, idx)}
                            data-testid={`template-editor-remove-checklist-${task.tempId}-${idx}`}
                            className="p-0.5 cursor-pointer shrink-0 transition-colors"
                            style={{ color: 'var(--color-text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-status-overdue)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addChecklistItem(task.tempId)}
                        data-testid={`template-editor-add-checklist-${task.tempId}`}
                        className="text-xs cursor-pointer px-1 py-0.5"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        + Add checklist item
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTask}
              data-testid="template-editor-add-task"
              className="flex items-center gap-1 mt-2 px-2 py-1 rounded-md text-sm font-medium cursor-pointer transition-colors"
              style={{ color: 'var(--color-accent)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
              </svg>
              Add Task
            </button>
          </div>

          {/* Dependencies */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Dependencies ({edges.length})
            </label>

            {/* Existing edges */}
            {edges.length > 0 && (
              <div className="space-y-1 mb-2">
                {edges.map((edge, idx) => (
                  <div
                    key={`${edge.fromTempId}-${edge.toTempId}`}
                    className="flex items-center gap-2 text-sm px-2 py-1 rounded-md"
                    data-testid={`template-editor-edge-${idx}`}
                    style={{ backgroundColor: 'var(--color-surface-secondary)' }}
                  >
                    <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {taskLabel(edge.fromTempId)}
                    </span>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>&rarr;</span>
                    <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {taskLabel(edge.toTempId)}
                    </span>
                    <button
                      onClick={() => removeEdge(idx)}
                      data-testid={`template-editor-remove-edge-${idx}`}
                      className="ml-auto p-0.5 cursor-pointer shrink-0 transition-colors"
                      style={{ color: 'var(--color-text-tertiary)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-status-overdue)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add dependency */}
            {tasks.length >= 2 && (
              <div className="flex items-center gap-2">
                <select
                  value={depFrom}
                  onChange={(e) => setDepFrom(e.target.value)}
                  data-testid="template-editor-dep-from"
                  className="flex-1 min-w-0 text-xs bg-transparent outline-none px-2 py-1.5 rounded-md cursor-pointer"
                  style={{
                    border: '1px solid var(--color-border-primary)',
                    color: depFrom ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  }}
                >
                  <option value="">From task...</option>
                  {tasks.map((t) => (
                    <option key={t.tempId} value={t.tempId}>{t.title || 'Untitled'}</option>
                  ))}
                </select>
                <span className="text-xs shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>&rarr;</span>
                <select
                  value={depTo}
                  onChange={(e) => setDepTo(e.target.value)}
                  data-testid="template-editor-dep-to"
                  className="flex-1 min-w-0 text-xs bg-transparent outline-none px-2 py-1.5 rounded-md cursor-pointer"
                  style={{
                    border: '1px solid var(--color-border-primary)',
                    color: depTo ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  }}
                >
                  <option value="">To task...</option>
                  {tasks.filter((t) => t.tempId !== depFrom).map((t) => (
                    <option key={t.tempId} value={t.tempId}>{t.title || 'Untitled'}</option>
                  ))}
                </select>
                <button
                  onClick={addEdge}
                  disabled={!depFrom || !depTo || depFrom === depTo}
                  data-testid="template-editor-add-dep"
                  className="px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors shrink-0"
                  style={{
                    backgroundColor: 'var(--color-accent)',
                    color: 'var(--color-text-inverse)',
                    opacity: (!depFrom || !depTo || depFrom === depTo) ? 0.4 : 1,
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p
              data-testid="template-editor-error"
              className="text-xs"
              style={{ color: 'var(--color-status-overdue)' }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--color-border-primary)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="template-editor-save"
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
