import { useState, useEffect, useRef } from 'react';
import type { ProjectTemplate } from '../../types';
import { useTaskStore } from '../../store/taskStore';
import { useUiStore } from '../../store/uiStore';
import { createProject } from '../../db/operations';
import TemplateEditor from './TemplateEditor';

interface TemplatePickerProps {
  onClose: () => void;
}

export default function TemplatePicker({ onClose }: TemplatePickerProps) {
  const { areas, loadSidebarData, instantiateTemplate, loadTemplates, deleteTemplate } = useTaskStore();
  const { setSidebarView } = useUiStore();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, [loadTemplates]);

  useEffect(() => {
    nameRef.current?.focus();
  }, [selectedTemplate]);

  const selected = templates.find((t) => t.id === selectedTemplate);

  const reloadTemplates = async () => {
    const updated = await loadTemplates();
    setTemplates(updated);
  };

  const handleDeleteTemplate = async (id: string) => {
    const result = await deleteTemplate(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (selectedTemplate === id) setSelectedTemplate(null);
    await reloadTemplates();
  };

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
                <div
                  key={t.id}
                  className="flex items-center gap-1"
                >
                  <button
                    onClick={() => setSelectedTemplate(t.id)}
                    data-testid={`template-option-${t.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2 rounded-md text-sm text-left cursor-pointer transition-colors"
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
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t.tasks.length} tasks · {t.edges.length} {t.edges.length === 1 ? 'dependency' : 'dependencies'}
                      </div>
                    </div>
                  </button>

                  {/* Edit/delete controls for custom templates */}
                  {!t.builtIn && (
                    <div className="flex shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); }}
                        data-testid={`template-edit-btn-${t.id}`}
                        className="p-1 rounded cursor-pointer transition-colors"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                        title="Edit template"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L3.462 11.098a.25.25 0 00-.064.108l-.631 2.208 2.208-.63a.25.25 0 00.108-.064l8.61-8.61a.25.25 0 000-.354l-1.086-1.086z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                        data-testid={`template-delete-btn-${t.id}`}
                        className="p-1 rounded cursor-pointer transition-colors"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-status-overdue)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                        title="Delete template"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                          <path fillRule="evenodd" d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75A1.75 1.75 0 016.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19a1.75 1.75 0 001.741-1.575l.66-6.6a.75.75 0 00-1.492-.15l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
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

      {/* Template editor overlay */}
      {editingTemplate && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={reloadTemplates}
        />
      )}
    </div>
  );
}
