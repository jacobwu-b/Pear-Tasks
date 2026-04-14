// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createProject, createTask, addDependency } from '../../src/db/operations';
import { saveAsTemplate, getTemplates, getTemplate } from '../../src/db/templates';
import TemplateEditor from '../../src/components/templates/TemplateEditor';
import { seedBuiltInTemplates } from '../../src/db/templates';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import TemplatePicker from '../../src/components/templates/TemplatePicker';
import SaveAsTemplateDialog from '../../src/components/templates/SaveAsTemplateDialog';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await clearDatabase();
  useUiStore.setState({
    sidebarView: 'inbox',
    selectedTaskId: null,
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
  });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('TemplatePicker', () => {
  it('renders the dialog with a blank project option', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    expect(screen.getByTestId('template-picker')).toBeDefined();
    expect(screen.getByTestId('template-option-blank')).toBeDefined();
    expect(screen.getByText('Blank Project')).toBeDefined();
  });

  it('shows built-in templates after seeding', async () => {
    await seedBuiltInTemplates();
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    // Wait for templates to load
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(screen.getByText('Software Project')).toBeDefined();
    expect(screen.getByText('Blog Post')).toBeDefined();
    expect(screen.getByText('Bug Fix')).toBeDefined();
    expect(screen.getByText('Research Paper')).toBeDefined();
  });

  it('shows template preview when a template is selected', async () => {
    await seedBuiltInTemplates();
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click on Blog Post template
    await act(async () => {
      fireEvent.click(screen.getByText('Blog Post'));
    });

    expect(screen.getByTestId('template-preview')).toBeDefined();
    expect(screen.getByText('Tasks in this template:')).toBeDefined();
  });

  it('creates a blank project and closes', async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    // Enter project name
    const nameInput = screen.getByTestId('template-project-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'My Blank Project' } });
    });

    // Click create
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-create-btn'));
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(onClose).toHaveBeenCalled();

    // Verify the sidebar navigated to the new project
    const state = useUiStore.getState();
    expect(typeof state.sidebarView).toBe('object');
    if (typeof state.sidebarView === 'object') {
      expect(state.sidebarView.type).toBe('project');
    }
  });

  it('creates a project from a template with tasks and edges', async () => {
    await seedBuiltInTemplates();
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Select Bug Fix template
    await act(async () => {
      fireEvent.click(screen.getByText('Bug Fix'));
    });

    // Enter project name
    const nameInput = screen.getByTestId('template-project-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Fix Login Bug' } });
    });

    // Create
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-create-btn'));
      await new Promise((r) => setTimeout(r, 200));
    });

    expect(onClose).toHaveBeenCalled();

    // Verify the project was created with correct view
    const state = useUiStore.getState();
    expect(typeof state.sidebarView).toBe('object');
  });

  it('shows error when project name is empty', async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    // Click create with empty name
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-create-btn'));
    });

    expect(screen.getByTestId('template-picker-error')).toBeDefined();
    expect(screen.getByText('Project name is required')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when backdrop is clicked', async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('template-picker-backdrop'));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('closes when close button is clicked', async () => {
    const onClose = vi.fn();

    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('template-picker-close'));
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('shows edit and delete buttons for custom templates but not built-in', async () => {
    await seedBuiltInTemplates();
    // Create a custom template
    const proj = await createProject('Custom', null);
    await createTask('T1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'My Custom');
    const customId = saved.data!.id;

    const onClose = vi.fn();
    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Custom template should have edit and delete buttons
    expect(screen.getByTestId(`template-edit-btn-${customId}`)).toBeDefined();
    expect(screen.getByTestId(`template-delete-btn-${customId}`)).toBeDefined();

    // Built-in templates should NOT have these buttons
    expect(screen.queryByTestId('template-edit-btn-builtin-software-project')).toBeNull();
    expect(screen.queryByTestId('template-delete-btn-builtin-software-project')).toBeNull();
  });

  it('opens template editor when edit button is clicked', async () => {
    const proj = await createProject('Source', null);
    await createTask('T1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'Editable');
    const customId = saved.data!.id;

    const onClose = vi.fn();
    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click edit button
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-edit-btn-${customId}`));
    });

    // Template editor should be open
    expect(screen.getByTestId('template-editor')).toBeDefined();
    const nameInput = screen.getByTestId('template-editor-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Editable');
  });

  it('deletes a custom template from the picker', async () => {
    const proj = await createProject('Source', null);
    await createTask('T1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'Doomed Template');
    const customId = saved.data!.id;

    const onClose = vi.fn();
    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify template is shown
    expect(screen.getByText('Doomed Template')).toBeDefined();

    // Click delete
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-delete-btn-${customId}`));
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify it's gone from the DB
    const deleted = await getTemplate(customId);
    expect(deleted).toBeUndefined();

    // Verify it's gone from the UI
    expect(screen.queryByText('Doomed Template')).toBeNull();
  });
});

describe('SaveAsTemplateDialog', () => {
  it('renders with pre-filled project name', async () => {
    const proj = await createProject('Test Project', null);
    const onClose = vi.fn();

    await act(async () => {
      render(
        <SaveAsTemplateDialog
          projectId={proj.data!.id}
          projectName="Test Project"
          onClose={onClose}
        />
      );
    });

    const input = screen.getByTestId('save-template-name') as HTMLInputElement;
    expect(input.value).toBe('Test Project');
  });

  it('shows error when name is empty', async () => {
    const proj = await createProject('Test Project', null);
    const onClose = vi.fn();

    await act(async () => {
      render(
        <SaveAsTemplateDialog
          projectId={proj.data!.id}
          projectName="Test Project"
          onClose={onClose}
        />
      );
    });

    // Clear the name
    const input = screen.getByTestId('save-template-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });

    // Click save
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-template-btn'));
    });

    expect(screen.getByTestId('save-template-error')).toBeDefined();
    expect(screen.getByText('Template name is required')).toBeDefined();
  });

  it('saves a template and shows success message', async () => {
    const proj = await createProject('My Project', null);
    await createTask('Task A', { projectId: proj.data!.id });
    const onClose = vi.fn();

    await act(async () => {
      render(
        <SaveAsTemplateDialog
          projectId={proj.data!.id}
          projectName="My Project"
          onClose={onClose}
        />
      );
    });

    // Click save
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-template-btn'));
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.getByTestId('save-template-success')).toBeDefined();
    expect(screen.getByText('Template saved!')).toBeDefined();
  });

  it('closes when backdrop is clicked', async () => {
    const proj = await createProject('Test', null);
    const onClose = vi.fn();

    await act(async () => {
      render(
        <SaveAsTemplateDialog
          projectId={proj.data!.id}
          projectName="Test"
          onClose={onClose}
        />
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-template-backdrop'));
    });

    expect(onClose).toHaveBeenCalled();
  });
});

// ── TemplateEditor ────────────────────────────────────────────────

describe('TemplateEditor', () => {
  async function createCustomTemplate(taskCount = 2, withEdge = false) {
    const proj = await createProject('Source', null);
    const pid = proj.data!.id;
    const taskIds: string[] = [];
    for (let i = 0; i < taskCount; i++) {
      const t = await createTask(`Task ${i + 1}`, { projectId: pid });
      taskIds.push(t.data!.id);
    }
    if (withEdge && taskIds.length >= 2) {
      await addDependency(taskIds[0], taskIds[1], pid);
    }
    const saved = await saveAsTemplate(pid, 'My Template');
    return saved.data!;
  }

  it('renders with the template data pre-loaded', async () => {
    const template = await createCustomTemplate(2, true);
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    expect(screen.getByTestId('template-editor')).toBeDefined();
    const nameInput = screen.getByTestId('template-editor-name') as HTMLInputElement;
    expect(nameInput.value).toBe('My Template');

    // Should show 2 tasks
    expect(screen.getByText('Tasks (2)')).toBeDefined();
    // Should show 1 dependency
    expect(screen.getByText('Dependencies (1)')).toBeDefined();
  });

  it('renames a template via the editor', async () => {
    const template = await createCustomTemplate();
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    // Change name
    const nameInput = screen.getByTestId('template-editor-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Renamed Template' } });
    });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
      await new Promise((r) => setTimeout(r, 100));
    });

    // Verify persisted
    const updated = await getTemplate(template.id);
    expect(updated!.name).toBe('Renamed Template');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('adds a new task to the template', async () => {
    const template = await createCustomTemplate(1);
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    expect(screen.getByText('Tasks (1)')).toBeDefined();

    // Add a task
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-add-task'));
    });

    expect(screen.getByText('Tasks (2)')).toBeDefined();

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
      await new Promise((r) => setTimeout(r, 100));
    });

    const updated = await getTemplate(template.id);
    expect(updated!.tasks.length).toBe(2);
  });

  it('removes a task and its associated edges', async () => {
    const template = await createCustomTemplate(2, true);
    const taskToRemove = template.tasks[0];
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    expect(screen.getByText('Tasks (2)')).toBeDefined();
    expect(screen.getByText('Dependencies (1)')).toBeDefined();

    // Remove first task
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-editor-remove-task-${taskToRemove.tempId}`));
    });

    expect(screen.getByText('Tasks (1)')).toBeDefined();
    // Edge should be removed too since it referenced the deleted task
    expect(screen.getByText('Dependencies (0)')).toBeDefined();

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
      await new Promise((r) => setTimeout(r, 100));
    });

    const updated = await getTemplate(template.id);
    expect(updated!.tasks.length).toBe(1);
    expect(updated!.edges.length).toBe(0);
  });

  it('edits a task title', async () => {
    const template = await createCustomTemplate(1);
    const task = template.tasks[0];
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    const titleInput = screen.getByTestId(`template-editor-task-title-${task.tempId}`) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
      await new Promise((r) => setTimeout(r, 100));
    });

    const updated = await getTemplate(template.id);
    expect(updated!.tasks[0].title).toBe('Updated Title');
  });

  it('adds and removes a dependency edge', async () => {
    const template = await createCustomTemplate(3, false);
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    expect(screen.getByText('Dependencies (0)')).toBeDefined();

    // Select from and to tasks in the dropdowns
    const fromSelect = screen.getByTestId('template-editor-dep-from') as HTMLSelectElement;
    const toSelect = screen.getByTestId('template-editor-dep-to') as HTMLSelectElement;

    await act(async () => {
      fireEvent.change(fromSelect, { target: { value: template.tasks[0].tempId } });
    });
    await act(async () => {
      fireEvent.change(toSelect, { target: { value: template.tasks[1].tempId } });
    });

    // Add dependency
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-add-dep'));
    });

    expect(screen.getByText('Dependencies (1)')).toBeDefined();

    // Remove the edge
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-remove-edge-0'));
    });

    expect(screen.getByText('Dependencies (0)')).toBeDefined();
  });

  it('manages checklist items within a task', async () => {
    const template = await createCustomTemplate(1);
    const task = template.tasks[0];
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    // Expand task
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-editor-expand-${task.tempId}`));
    });

    expect(screen.getByTestId(`template-editor-checklist-${task.tempId}`)).toBeDefined();

    // Add a checklist item
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-editor-add-checklist-${task.tempId}`));
    });

    // Type into the new checklist item
    const existingCount = task.checklistTitles.length;
    const newItemInput = screen.getByTestId(`template-editor-checklist-item-${task.tempId}-${existingCount}`) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(newItemInput, { target: { value: 'New Checklist Item' } });
    });

    // Save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
      await new Promise((r) => setTimeout(r, 100));
    });

    const updated = await getTemplate(template.id);
    expect(updated!.tasks[0].checklistTitles).toContain('New Checklist Item');
  });

  it('shows error when saving with empty name', async () => {
    const template = await createCustomTemplate();
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    // Clear name
    const nameInput = screen.getByTestId('template-editor-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '' } });
    });

    // Try save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
    });

    expect(screen.getByTestId('template-editor-error')).toBeDefined();
    expect(screen.getByText('Template name is required')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows error when all tasks are removed', async () => {
    const template = await createCustomTemplate(1);
    const task = template.tasks[0];
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    // Remove the only task
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-editor-remove-task-${task.tempId}`));
    });

    // Try save
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-save'));
    });

    expect(screen.getByTestId('template-editor-error')).toBeDefined();
    expect(screen.getByText('Template must have at least one task')).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancel discards changes', async () => {
    const template = await createCustomTemplate();
    const onClose = vi.fn();
    const onSaved = vi.fn();

    await act(async () => {
      render(<TemplateEditor template={template} onClose={onClose} onSaved={onSaved} />);
    });

    // Change name
    const nameInput = screen.getByTestId('template-editor-name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Changed Name' } });
    });

    // Click close
    await act(async () => {
      fireEvent.click(screen.getByTestId('template-editor-close'));
    });

    expect(onClose).toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();

    // Verify DB was NOT changed
    const unchanged = await getTemplate(template.id);
    expect(unchanged!.name).toBe('My Template');
  });
});
