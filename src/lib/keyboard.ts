import { useEffect } from 'react';

// ── Shortcut definitions ───────────────────────────────────────────────

export interface ShortcutDef {
  id: string;
  label: string;
  category: 'capture' | 'task' | 'navigation';
  /** Human-readable key display (e.g. "⌘⏎") */
  display: string;
  /** KeyboardEvent.key value to match */
  key: string;
  meta?: boolean;
  shift?: boolean;
  /** When true, only fires when no input/textarea/contenteditable is focused */
  requiresNoTextFocus?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  // ── Capture ─────────────────────────────────────────────────────────
  {
    id: 'quickCapture',
    label: 'Quick capture',
    category: 'capture',
    display: '⌘⏎',
    key: 'Enter',
    meta: true,
  },
  {
    id: 'newTaskForm',
    label: 'New task (full form)',
    category: 'capture',
    display: '⌘⇧⏎',
    key: 'Enter',
    meta: true,
    shift: true,
  },
  // ── Task actions (require a selected task) ──────────────────────────
  {
    id: 'completeTask',
    label: 'Complete task',
    category: 'task',
    display: '⌘.',
    key: '.',
    meta: true,
  },
  {
    id: 'deleteTask',
    label: 'Delete task',
    category: 'task',
    display: '⌘⌫',
    key: 'Backspace',
    meta: true,
  },
  {
    id: 'moveToToday',
    label: 'Move to Today',
    category: 'task',
    display: 'T',
    key: 't',
    requiresNoTextFocus: true,
  },
  {
    id: 'moveToSomeday',
    label: 'Move to Someday',
    category: 'task',
    display: 'S',
    key: 's',
    requiresNoTextFocus: true,
  },
  // ── Search ───────────────────────────────────────────────────────────
  {
    id: 'search',
    label: 'Search',
    category: 'navigation',
    display: '⌘K',
    key: 'k',
    meta: true,
  },
  // ── Navigation ──────────────────────────────────────────────────────
  {
    id: 'toggleSidebar',
    label: 'Toggle sidebar',
    category: 'navigation',
    display: '⌘/',
    key: '/',
    meta: true,
  },
  {
    id: 'toggleGraph',
    label: 'Toggle graph view',
    category: 'navigation',
    display: 'G',
    key: 'g',
    requiresNoTextFocus: true,
  },
  {
    id: 'showHelp',
    label: 'Keyboard shortcuts',
    category: 'navigation',
    display: '?',
    key: '?',
    requiresNoTextFocus: true,
  },
];

// ── Hook ───────────────────────────────────────────────────────────────

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

function matchesShortcut(e: KeyboardEvent, def: ShortcutDef): boolean {
  if (e.key.toLowerCase() !== def.key.toLowerCase() && e.key !== def.key) return false;
  const wantMeta = def.meta ?? false;
  const hasMeta = e.metaKey || e.ctrlKey;
  if (wantMeta !== hasMeta) return false;
  const wantShift = def.shift ?? false;
  if (wantShift !== e.shiftKey) return false;
  return true;
}

/**
 * Register a global `keydown` listener that dispatches to the provided
 * handler map. Keys of `handlers` are shortcut IDs from `SHORTCUTS`.
 *
 * Shortcuts with `requiresNoTextFocus` are skipped when the user is
 * typing in an input, textarea, or contenteditable.
 *
 * Modifier-based shortcuts always fire regardless of focus — if the user
 * holds ⌘ and presses Enter, they're signaling a global intent.
 */
export function useGlobalShortcuts(handlers: Record<string, (() => void) | undefined>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Check more-specific shortcuts first (shift before non-shift).
      for (const def of SHORTCUTS) {
        if (!matchesShortcut(e, def)) continue;
        if (def.requiresNoTextFocus && isTextInput(document.activeElement)) continue;
        const fn = handlers[def.id];
        if (!fn) continue;
        e.preventDefault();
        fn();
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers]);
}
