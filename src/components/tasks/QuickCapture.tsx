import { useMemo, useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { useTaskStore } from '../../store/taskStore';
import { parseQuickCaptureInput } from '../../lib/dates';
import { summarizeRecurrence } from '../../lib/recurrence';

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

function formatDateChip(when: string): string {
  const [y, m, d] = when.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Body is split out so it only mounts when the modal opens. Fresh state
 * then comes from mount (not from a state-in-effect reset), which keeps
 * the react-hooks/set-state-in-effect rule happy and avoids cascading
 * renders on open/close transitions.
 */
function QuickCaptureBody({ onClose }: { onClose: () => void }) {
  const createNewTask = useTaskStore((s) => s.createNewTask);
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount. Modal's own focus-on-open targets the
  // first focusable element, which is this input anyway, but running a
  // second focus call here is cheap and explicit.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const parsed = useMemo(() => parseQuickCaptureInput(raw), [raw]);
  const canSubmit = parsed.title.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    await createNewTask(parsed.title, {
      when: parsed.when ?? undefined,
      recurrence: parsed.recurrence ?? undefined,
    });
    onClose();
  };

  return (
    <div className="px-4 py-3 flex items-center gap-3" data-testid="quick-capture-dialog">
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0" style={{ color: 'var(--color-accent)' }} aria-hidden="true">
        <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
      </svg>
      <input
        ref={inputRef}
        data-testid="quick-capture-input"
        type="text"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="New to-do — try 'trash every weekend'"
        aria-label="Task title (natural language dates supported)"
        className="flex-1 text-base bg-transparent outline-none"
        style={{ color: 'var(--color-text-primary)' }}
      />
      {parsed.when && (
        <span
          data-testid="quick-capture-when-chip"
          className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-subtle)',
          }}
        >
          {formatDateChip(parsed.when)}
        </span>
      )}
      {parsed.recurrence && (
        <span
          data-testid="quick-capture-recurrence-chip"
          className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-subtle)',
          }}
        >
          {summarizeRecurrence(parsed.recurrence)}
        </span>
      )}
    </div>
  );
}

export default function QuickCapture({ open, onClose }: QuickCaptureProps) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="Quick capture" testId="quick-capture-backdrop">
      <QuickCaptureBody onClose={onClose} />
    </Modal>
  );
}
