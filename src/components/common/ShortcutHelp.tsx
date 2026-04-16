import Modal from './Modal';
import { SHORTCUTS, type ShortcutDef } from '../../lib/keyboard';

interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<ShortcutDef['category'], string> = {
  capture: 'Capture',
  task: 'Task Actions',
  navigation: 'Navigation',
};

const CATEGORY_ORDER: ShortcutDef['category'][] = ['capture', 'task', 'navigation'];

export default function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  const grouped = new Map<ShortcutDef['category'], ShortcutDef[]>();
  for (const s of SHORTCUTS) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Keyboard shortcuts" maxWidthClass="max-w-md" testId="shortcut-help-backdrop">
      <div data-testid="shortcut-help-dialog">
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border-primary)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Keyboard Shortcuts
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

        <div className="px-5 py-4 space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat);
            if (!items?.length) return null;
            return (
              <div key={cat}>
                <h3
                  className="text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-1.5">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {s.label}
                      </span>
                      <kbd
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono"
                        style={{
                          backgroundColor: 'var(--color-surface-tertiary)',
                          color: 'var(--color-text-primary)',
                          border: '1px solid var(--color-border-primary)',
                        }}
                      >
                        {s.display}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
