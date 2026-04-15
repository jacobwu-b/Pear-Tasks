import { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';

interface SaveAsTemplateDialogProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function SaveAsTemplateDialog({ projectId, projectName, onClose }: SaveAsTemplateDialogProps) {
  const { saveProjectAsTemplate } = useTaskStore();
  const [name, setName] = useState(projectName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveProjectAsTemplate(projectId, name.trim());
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaved(true);
    setTimeout(onClose, 800);
  };

  return (
    <div
      data-testid="save-template-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="save-template-dialog"
        className="w-full max-w-sm rounded-lg overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface-primary)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Save as Template
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            Save this project's task structure and dependencies as a reusable template.
            Task titles and checklists are captured; notes, dates, and tags are not.
          </p>

          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Template Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              data-testid="save-template-name"
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {error && (
            <p
              data-testid="save-template-error"
              className="text-xs"
              style={{ color: 'var(--color-status-overdue)' }}
            >
              {error}
            </p>
          )}

          {saved && (
            <p
              data-testid="save-template-success"
              className="text-xs font-medium"
              style={{ color: 'var(--color-status-completed)' }}
            >
              Template saved!
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-3"
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
            disabled={saving || saved}
            data-testid="save-template-btn"
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: saved ? 'var(--color-status-completed)' : 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
