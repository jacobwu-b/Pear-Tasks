// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import QuickCapture from '../../src/components/tasks/QuickCapture';
import { useUiStore } from '../../src/store/uiStore';
import { useTaskStore } from '../../src/store/taskStore';
import { getInboxTasks } from '../../src/db/operations';
import { clearDatabase } from '../helpers';

afterEach(() => {
  cleanup();
});

beforeEach(async () => {
  await clearDatabase();
  useUiStore.setState({ quickCaptureOpen: false, newTaskFormOpen: false });
  useTaskStore.setState({ areas: [], projects: [], tasks: [], currentView: null });
});

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    render(<QuickCapture open={false} onClose={() => {}} />);
    expect(screen.queryByTestId('quick-capture-input')).toBeNull();
  });

  it('creates an Inbox task on Enter and calls onClose', async () => {
    let closed = false;
    await act(async () => {
      render(<QuickCapture open={true} onClose={() => { closed = true; }} />);
    });

    const input = screen.getByTestId('quick-capture-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Buy milk' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // Let the async createNewTask + store refresh settle.
      await new Promise((r) => setTimeout(r, 30));
    });

    const inbox = await getInboxTasks();
    expect(inbox).toHaveLength(1);
    expect(inbox[0].title).toBe('Buy milk');
    expect(inbox[0].when).toBeNull();
    expect(closed).toBe(true);
  });

  it('parses a trailing date and shows the "when" chip', async () => {
    await act(async () => {
      render(<QuickCapture open={true} onClose={() => {}} />);
    });

    const input = screen.getByTestId('quick-capture-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Buy milk tomorrow' } });
    });

    const chip = screen.getByTestId('quick-capture-when-chip');
    expect(chip).toBeDefined();
    expect(chip.textContent).toBe('Tomorrow');
  });

  it('does not submit an empty input on Enter', async () => {
    let closed = false;
    await act(async () => {
      render(<QuickCapture open={true} onClose={() => { closed = true; }} />);
    });

    const input = screen.getByTestId('quick-capture-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      await new Promise((r) => setTimeout(r, 20));
    });

    const inbox = await getInboxTasks();
    expect(inbox).toHaveLength(0);
    expect(closed).toBe(false);
  });

  it('saves the parsed "when" date on the created task', async () => {
    await act(async () => {
      render(<QuickCapture open={true} onClose={() => {}} />);
    });

    const input = screen.getByTestId('quick-capture-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Review PRD 2030-01-01' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await new Promise((r) => setTimeout(r, 30));
    });

    const { getUpcomingTasks } = await import('../../src/db/operations');
    const upcoming = await getUpcomingTasks();
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].title).toBe('Review PRD');
    expect(upcoming[0].when).toBe('2030-01-01');
  });
});
