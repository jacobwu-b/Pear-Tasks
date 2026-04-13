import { useState, useEffect, useRef } from 'react';
import type { ProjectTemplate } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { useUiStore } from '../../store/uiStore';
import { createProject } from '../../db/operations';

interface TemplatePickerProps {
  onClose: () => void;
}

export default function TemplatePicker({ onClose }: TemplatePickerProps) {
  const { areas, loadSidebarData, instantiateTemplate, loadTemplates } = useTaskStore();
  const { setSidebarView } = useUiStore();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, [loadTemplates]);

  useEffect(() => {
    nameRef.current?.focus();
  }, [selectedTemplate]);

  const selected = templates.find((t) => t.id === selectedTemplate);

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    setCreating(true);
    setError(null);

    if (selectedTemplate) {
      // Instantiate from template
      const result = await instantiateTemplate(selectedTemplate, projectName.trim(), areaId);
      if (result.error) {
        setError(result.error);
        setCreating(false);
        return;
      }
      setSidebarView({ type: 'project', projectId: result.projectId! });
    } else {
      // Blank project
      const result = await createProject(projectName.trim(), areaId);
      if (result.error) {
        setError(result.error);
        setCreating(false);
        return;
      }
      await loadSidebarData();
      setSidebarView({ type: 'project', projectId: result.data!.id });
    }

    onClose();
  };

  return (
    <div
      data-testid="template-picker-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="template-picker"
        className="w-full max-w-md rounded-lg overflow-hidden"
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
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text-primary)' }}
          >
            New Project
          </h2>
          <button
            onClick={onClose}
            data-testid="template-picker-close"
            className="p-1 rounded-md cursor-pointer"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Project name */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Project Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="My New Project"
              data-testid="template-project-name"
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            />
          </div>

          {/* Area selector */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Area
            </label>
            <select
              value={areaId ?? ''}
              onChange={(e) => setAreaId(e.target.value || null)}
              data-testid="template-area-select"
              className="w-full text-sm bg-transparent outline-none px-3 py-2 rounded-md cursor-pointer"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-primary)',
              }}
            >
              <option value="">No Area</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          {/* Template selection */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-wide block mb-1"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Template
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {/* Blank project option */}
              <button
                onClick={() => setSelectedTemplate(null)}
                data-testid="template-option-blank"
                className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-left cursor-pointer transition-colors"
                style={{
                  backgroundColor: selectedTemplate === null ? 'var(--color-accent-subtle)' : 'transparent',
                  color: 'var(--color-text-primary)',
                  border: selectedTemplate === null ? '1px solid var(--color-accent)' : '1px solid transparent',
                }}
              >
                <span
                  className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-base"
                  style={{ backgroundColor: 'var(--color-surface-tertiary)' }}
                >
                  +
                </span>
                <div>
                  <div className="font-medium">Blank Project</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    Start from scratch
                  </div>
                </div>
              </button>

              {/* Template options */}
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  data-testid={`template-option-${t.id}`}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-left cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedTemplate === t.id ? 'var(--color-accent-subtle)' : 'transparent',
                    color: 'var(--color-text-primary)',
                    border: selectedTemplate === t.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                  }}
                >
                  <span
                    className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                    style={{
                      backgroundColor: t.builtIn ? 'var(--color-accent-subtle)' : 'var(--color-surface-tertiary)',
                      color: t.builtIn ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontSize: '14px',
                    }}
                  >
                    {t.builtIn ? '📋' : '✨'}
                  </span>
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t.tasks.length} tasks · {t.edges.length} {t.edges.length === 1 ? 'dependency' : 'dependencies'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview of selected template */}
          {selected && (
            <div
              className="text-xs rounded-md p-3"
              data-testid="template-preview"
              style={{
                backgroundColor: 'var(--color-surface-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <div className="font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Tasks in this template:
              </div>
              {selected.tasks.map((t, i) => (
                <div key={t.tempId} className="flex items-center gap-1">
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}.</span>
                  {t.title}
                  {i < selected.tasks.length - 1 && (
                    <span style={{ color: 'var(--color-text-tertiary)' }}> →</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              data-testid="template-picker-error"
              className="text-xs"
              style={{ color: 'var(--color-status-overdue)' }}
            >
              {error}
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
            className="px-4 py-2 rounded-md text-sm cursor-pointer transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            data-testid="template-create-btn"
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: 'var(--color-accent)',
              color: 'var(--color-text-inverse)',
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
