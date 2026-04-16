// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { useGlobalShortcuts, SHORTCUTS } from '../../src/lib/keyboard';

afterEach(() => {
  cleanup();
});

function fireKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  window.dispatchEvent(event);
  return event;
}

function TestHarness({ handlers }: { handlers: Record<string, () => void> }) {
  useGlobalShortcuts(handlers);
  return null;
}

describe('SHORTCUTS definitions', () => {
  it('contains all expected shortcut IDs', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(ids).toContain('quickCapture');
    expect(ids).toContain('newTaskForm');
    expect(ids).toContain('completeTask');
    expect(ids).toContain('deleteTask');
    expect(ids).toContain('moveToToday');
    expect(ids).toContain('moveToSomeday');
    expect(ids).toContain('toggleSidebar');
    expect(ids).toContain('toggleGraph');
    expect(ids).toContain('showHelp');
  });

  it('has unique IDs', () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('useGlobalShortcuts', () => {
  it('fires the handler for a modifier shortcut', () => {
    const handler = vi.fn();
    render(createElement(TestHarness, { handlers: { toggleSidebar: handler } }));
    fireKey('/', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires Shift+Meta shortcuts (newTaskForm) before Meta-only (quickCapture)', () => {
    const quick = vi.fn();
    const full = vi.fn();
    render(createElement(TestHarness, { handlers: { quickCapture: quick, newTaskForm: full } }));
    fireKey('Enter', { metaKey: true, shiftKey: true });
    expect(full).toHaveBeenCalledTimes(1);
    expect(quick).not.toHaveBeenCalled();
  });

  it('fires single-key shortcuts when no text input is focused', () => {
    const handler = vi.fn();
    render(createElement(TestHarness, { handlers: { showHelp: handler } }));
    fireKey('?');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire single-key shortcuts when an input is focused', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    render(createElement(TestHarness, { handlers: { showHelp: handler } }));
    fireKey('?');
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does NOT fire single-key shortcuts when a textarea is focused', () => {
    const handler = vi.fn();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    render(createElement(TestHarness, { handlers: { moveToToday: handler } }));
    fireKey('t');
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('DOES fire modifier shortcuts even when an input is focused', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    render(createElement(TestHarness, { handlers: { completeTask: handler } }));
    fireKey('.', { metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });

  it('does nothing for handlers not in the map', () => {
    render(createElement(TestHarness, { handlers: {} }));
    // Should not throw.
    fireKey('/', { metaKey: true });
    fireKey('?');
  });

  it('cleans up the listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = render(createElement(TestHarness, { handlers: { toggleSidebar: handler } }));
    unmount();
    fireKey('/', { metaKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
