import type { RecurrenceConfig } from '../../types';
import { summarizeRecurrence } from '../../lib/recurrence';

interface RecurrenceBadgeProps {
  config: RecurrenceConfig;
  /** When true, shows only the icon (no text label). */
  compact?: boolean;
}

/** Inline repeat icon + optional text label shown on recurring tasks. */
export default function RecurrenceBadge({ config, compact = false }: RecurrenceBadgeProps) {
  const label = summarizeRecurrence(config);

  return (
    <span
      className="inline-flex items-center gap-0.5 shrink-0"
      style={{ color: 'var(--color-accent)' }}
      title={label}
      aria-label={`Recurring: ${label}`}
      data-testid="recurrence-badge"
    >
      {/* Repeat / cycle icon */}
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3 h-3 shrink-0"
        aria-hidden="true"
      >
        <path d="M3.5 3.5A.5.5 0 0 1 4 3h8a.5.5 0 0 1 .5.5v2h1V3.5A1.5 1.5 0 0 0 12 2H4a1.5 1.5 0 0 0-1.5 1.5v2h1v-2ZM2 7.5v-1h12v1H2Zm0 1h12v2.5A1.5 1.5 0 0 1 12.5 12.5H4A1.5 1.5 0 0 1 2.5 11V8.5H2Zm1 0v2.5a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V8.5H3ZM1 6.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13a.5.5 0 0 1-.5-.5Z" />
      </svg>
      {!compact && (
        <span className="text-xs">{label}</span>
      )}
    </span>
  );
}
