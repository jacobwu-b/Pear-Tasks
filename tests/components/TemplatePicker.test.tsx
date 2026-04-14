// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createProject, createTask } from '../../src/db/operations';
import { saveAsTemplate, getTemplates, getTemplate } from '../../src/db/templates';
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

  it('shows rename and delete buttons for custom templates but not built-in', async () => {
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

    // Custom template should have rename and delete buttons
    expect(screen.getByTestId(`template-rename-btn-${customId}`)).toBeDefined();
    expect(screen.getByTestId(`template-delete-btn-${customId}`)).toBeDefined();

    // Built-in templates should NOT have these buttons
    expect(screen.queryByTestId('template-rename-btn-builtin-software-project')).toBeNull();
    expect(screen.queryByTestId('template-delete-btn-builtin-software-project')).toBeNull();
  });

  it('renames a custom template inline', async () => {
    const proj = await createProject('Source', null);
    await createTask('T1', { projectId: proj.data!.id });
    const saved = await saveAsTemplate(proj.data!.id, 'Old Name');
    const customId = saved.data!.id;

    const onClose = vi.fn();
    await act(async () => {
      render(<TemplatePicker onClose={onClose} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Click rename button
    await act(async () => {
      fireEvent.click(screen.getByTestId(`template-rename-btn-${customId}`));
    });

    // Should show rename input
    const input = screen.getByTestId(`template-rename-input-${customId}`) as HTMLInputElement;
    expect(input.value).toBe('Old Name');

    // Type new name and press Enter
    await act(async () => {
      fireEvent.change(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify the template was renamed in the DB
    const updated = await getTemplate(customId);
    expect(updated!.name).toBe('New Name');

    // Verify the UI updated
    expect(screen.getByText('New Name')).toBeDefined();
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
