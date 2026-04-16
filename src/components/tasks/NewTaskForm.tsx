import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../common/Modal';
import { useTaskStore } from '../../store/taskStore';
import type { WhenValue } from '../../types';

interface NewTaskFormProps {
  open: boolean;
  onClose: () => void;
}

type WhenMode = 'none' | 'date' | 'someday';

/**
 * Body is split out so it only mounts when the modal opens. Fresh state
 * then comes from mount rather than state-in-effect resets — see the
 * matching comment in QuickCapture.tsx.
 */
function NewTaskFormBody({ onClose }: { onClose: () => void }) {
  const createNewTask = useTaskStore((s) => s.createNewTask);
  const areas = useTaskStore((s) => s.areas);
  const projects = useTaskStore((s) => s.projects);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [whenMode, setWhenMode] = useState<WhenMode>('none');
  const [whenDate, setWhenDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [projectId, setProjectId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Render projects grouped by area so the picker is navigable even with
  // many projects across several areas.
  const projectGroups = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active' && p.deletedAt === null);
    const byArea = new Map<string | null, typeof active>();
    for (const p of active) {
      const key = p.areaId;
      const list = byArea.get(key) ?? [];
      list.push(p);
      byArea.set(key, list);
    }
    return { byArea, areas };
  }, [projects, areas]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    let when: WhenValue | undefined;
    if (whenMode === 'someday') when = 'someday';
    else if (whenMode === 'date' && whenDate) when = whenDate;

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await createNewTask(title.trim(), {
      notes: notes.trim() || undefined,
      when,
      deadline: deadline || undefined,
      tags: tags.length ? tags : undefined,
      projectId: projectId || undefined,
    });
    onClose();
  };

  const labelStyle = { color: 'var(--color-text-tertiary)' } as const;
  const inputStyle = {
    border: '1px solid var(--color-border-primary)',
    color: 'var(--color-text-primary)',
  } as const;

  return (
    <div data-testid="new-task-dialog">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            New Task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
              Title
            </label>
            <input
              ref={titleRef}
              data-testid="new-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
              Notes
            </label>
            <textarea
              data-testid="new-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md resize-y"
              style={inputStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
                When
              </label>
              <div className="flex gap-1 mb-1">
                {(['none', 'date', 'someday'] as WhenMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setWhenMode(m)}
                    data-testid={`new-task-when-${m}`}
                    className="flex-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: whenMode === m ? 'var(--color-accent-subtle)' : 'transparent',
                      color: whenMode === m ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border-primary)',
                    }}
                  >
                    {m === 'none' ? 'Inbox' : m === 'date' ? 'Date' : 'Someday'}
                  </button>
                ))}
              </div>
              {whenMode === 'date' && (
                <input
                  data-testid="new-task-when-date"
                  type="date"
                  value={whenDate}
                  onChange={(e) => setWhenDate(e.target.value)}
                  className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
                  style={inputStyle}
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
                Deadline
              </label>
              <input
                data-testid="new-task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
              Project
            </label>
            <select
              data-testid="new-task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={inputStyle}
            >
              <option value="">No project (Inbox / Anytime)</option>
              {Array.from(projectGroups.byArea.entries()).map(([areaId, group]) => {
                const areaTitle =
                  areaId === null ? 'No Area' : (areas.find((a) => a.id === areaId)?.title ?? 'Area');
                return (
                  <optgroup key={areaId ?? 'none'} label={areaTitle}>
                    {group.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={labelStyle}>
              Tags (comma-separated)
            </label>
            <input
              data-testid="new-task-tags"
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="deep-work, quick"
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={inputStyle}
            />
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
          style={{ borderTop: '1px solid var(--color-border-primary)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="new-task-submit"
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            Create Task
          </button>
        </div>
    </div>
  );
}

export default function NewTaskForm({ open, onClose }: NewTaskFormProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="New task" maxWidthClass="max-w-lg" testId="new-task-backdrop">
      <NewTaskFormBody onClose={onClose} />
    </Modal>
  );
}
