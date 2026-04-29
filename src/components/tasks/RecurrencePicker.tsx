import { useState } from 'react';
import type {
  RecurrenceConfig,
  RecurrenceFrequency,
  DayOfWeek,
  OrdinalPosition,
  PositionalTarget,
  MonthlySpec,
} from '../../types';
import { defaultRecurrenceConfig, summarizeRecurrence } from '../../lib/recurrence';

interface RecurrencePickerProps {
  value: RecurrenceConfig | null;
  onChange: (config: RecurrenceConfig | null) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS: { dow: DayOfWeek; label: string; short: string }[] = [
  { dow: 1, label: 'Monday',    short: 'M'  },
  { dow: 2, label: 'Tuesday',   short: 'T'  },
  { dow: 3, label: 'Wednesday', short: 'W'  },
  { dow: 4, label: 'Thursday',  short: 'Th' },
  { dow: 5, label: 'Friday',    short: 'F'  },
  { dow: 6, label: 'Saturday',  short: 'S'  },
  { dow: 0, label: 'Sunday',    short: 'Su' },
];

const ORDINAL_OPTIONS: { value: OrdinalPosition; label: string }[] = [
  { value: 'first',        label: 'First'          },
  { value: 'second',       label: 'Second'         },
  { value: 'third',        label: 'Third'          },
  { value: 'fourth',       label: 'Fourth'         },
  { value: 'last',         label: 'Last'           },
  { value: 'secondToLast', label: 'Second-to-last' },
];

const POSITIONAL_TARGET_OPTIONS: { value: PositionalTarget; label: string }[] = [
  { value: 1,            label: 'Monday'       },
  { value: 2,            label: 'Tuesday'      },
  { value: 3,            label: 'Wednesday'    },
  { value: 4,            label: 'Thursday'     },
  { value: 5,            label: 'Friday'       },
  { value: 6,            label: 'Saturday'     },
  { value: 0,            label: 'Sunday'       },
  { value: 'day',        label: 'Day'          },
  { value: 'weekday',    label: 'Weekday'      },
  { value: 'weekendDay', label: 'Weekend day'  },
  { value: 'fullWeekend',label: 'Full weekend' },
];

const MONTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1,  label: 'January'   },
  { value: 2,  label: 'February'  },
  { value: 3,  label: 'March'     },
  { value: 4,  label: 'April'     },
  { value: 5,  label: 'May'       },
  { value: 6,  label: 'June'      },
  { value: 7,  label: 'July'      },
  { value: 8,  label: 'August'    },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October'   },
  { value: 11, label: 'November'  },
  { value: 12, label: 'December'  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const labelStyle = { color: 'var(--color-text-tertiary)' } as const;
const inputStyle = {
  border: '1px solid var(--color-border-primary)',
  color: 'var(--color-text-primary)',
  backgroundColor: 'transparent',
} as const;

function defaultMonthlySpec(freq: RecurrenceFrequency): MonthlySpec | null {
  if (freq === 'monthly' || freq === 'yearly') {
    return { kind: 'dayOfMonth', day: 1 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IntervalInput({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={labelStyle}>Every</span>
      <input
        type="number"
        min={1}
        max={999}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= 1) onChange(n);
        }}
        className="w-16 text-sm px-2 py-1 rounded outline-none"
        style={inputStyle}
        data-testid="recurrence-interval"
      />
      <span className="text-xs" style={labelStyle}>{unit}{value !== 1 ? 's' : ''}</span>
    </div>
  );
}

function WeekdayCheckboxes({
  selected,
  onChange,
}: {
  selected: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}) {
  const toggle = (dow: DayOfWeek) => {
    const next = selected.includes(dow)
      ? selected.filter((d) => d !== dow)
      : [...selected, dow];
    onChange(next);
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {WEEKDAY_LABELS.map(({ dow, label, short }) => {
        const active = selected.includes(dow);
        return (
          <button
            key={dow}
            type="button"
            onClick={() => toggle(dow)}
            aria-label={label}
            aria-pressed={active}
            data-testid={`recurrence-dow-${dow}`}
            className="w-8 h-8 rounded-full text-xs font-medium cursor-pointer transition-colors"
            style={{
              backgroundColor: active ? 'var(--color-accent)' : 'var(--color-surface-tertiary)',
              color: active ? 'white' : 'var(--color-text-secondary)',
              border: active ? '1px solid var(--color-accent)' : '1px solid var(--color-border-primary)',
            }}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}

function MonthlySpecEditor({
  spec,
  onChange,
}: {
  spec: MonthlySpec;
  onChange: (spec: MonthlySpec) => void;
}) {
  const isDay = spec.kind === 'dayOfMonth';
  const isPositional = spec.kind === 'positional';

  return (
    <div className="space-y-2">
      {/* Radio: day-of-month vs positional */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="monthly-kind"
            checked={isDay}
            onChange={() => onChange({ kind: 'dayOfMonth', day: 1 })}
            data-testid="recurrence-monthly-day"
          />
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Day of month</span>
          {isDay && (
            <input
              type="number"
              min={1}
              max={31}
              value={spec.kind === 'dayOfMonth' ? spec.day : 1}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n) && n >= 1 && n <= 31) onChange({ kind: 'dayOfMonth', day: n });
              }}
              className="w-14 text-sm px-2 py-1 rounded outline-none"
              style={inputStyle}
              data-testid="recurrence-day-of-month"
            />
          )}
          {isDay && spec.kind === 'dayOfMonth' && spec.day > 28 && (
            <span className="text-xs" style={{ color: 'var(--color-status-overdue)' }}>
              ⚠ Some months will be skipped
            </span>
          )}
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="monthly-kind"
            checked={isPositional}
            onChange={() =>
              onChange({ kind: 'positional', position: 'first', target: 1 as DayOfWeek })
            }
            data-testid="recurrence-monthly-positional"
          />
          <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Positional</span>
        </label>
      </div>

      {/* Positional sub-selectors */}
      {isPositional && spec.kind === 'positional' && (
        <div className="flex flex-wrap items-center gap-2 pl-5">
          <select
            value={spec.position}
            onChange={(e) =>
              onChange({ ...spec, position: e.target.value as OrdinalPosition })
            }
            className="text-sm px-2 py-1 rounded outline-none"
            style={inputStyle}
            data-testid="recurrence-position"
          >
            {ORDINAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={typeof spec.target === 'number' ? spec.target : spec.target}
            onChange={(e) => {
              const raw = e.target.value;
              const numericVal = parseInt(raw, 10);
              const target: PositionalTarget = isNaN(numericVal)
                ? (raw as Exclude<PositionalTarget, number>)
                : (numericVal as DayOfWeek);
              onChange({ ...spec, target });
            }}
            className="text-sm px-2 py-1 rounded outline-none"
            style={inputStyle}
            data-testid="recurrence-target"
          >
            {POSITIONAL_TARGET_OPTIONS.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type FrequencyTab = RecurrenceFrequency | 'none';

const FREQ_TABS: { value: FrequencyTab; label: string }[] = [
  { value: 'none',    label: 'Never'   },
  { value: 'daily',   label: 'Daily'   },
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
];

export default function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  // Draft config — only committed via Apply / tab change
  const [draft, setDraft] = useState<RecurrenceConfig>(
    value ?? defaultRecurrenceConfig('daily'),
  );
  const [expanded, setExpanded] = useState(value !== null);

  const currentFreq: FrequencyTab = expanded ? draft.frequency : 'none';

  const handleTabChange = (tab: FrequencyTab) => {
    if (tab === 'none') {
      setExpanded(false);
      onChange(null);
      return;
    }
    const newDraft: RecurrenceConfig = {
      ...defaultRecurrenceConfig(tab),
      monthlySpec: defaultMonthlySpec(tab),
    };
    setDraft(newDraft);
    setExpanded(true);
    // Don't call onChange yet — user must hit Apply
  };

  const handleApply = () => {
    onChange(draft);
  };

  const handleClear = () => {
    setExpanded(false);
    onChange(null);
  };

  const updateDraft = (partial: Partial<RecurrenceConfig>) => {
    setDraft((d) => ({ ...d, ...partial }));
  };

  const unitLabel: Record<RecurrenceFrequency, string> = {
    daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year',
  };

  return (
    <div data-testid="recurrence-picker">
      <label
        className="text-xs font-semibold uppercase tracking-wide block mb-2"
        style={labelStyle}
      >
        Repeat
      </label>

      {/* Summary chip (collapsed view) */}
      {value && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs px-2 py-1 rounded cursor-pointer"
          style={{
            backgroundColor: 'var(--color-accent-subtle)',
            color: 'var(--color-accent)',
            border: '1px solid transparent',
          }}
          data-testid="recurrence-summary"
        >
          {summarizeRecurrence(value)} ▾
        </button>
      )}

      {/* Frequency tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {FREQ_TABS.map((tab) => {
          const active = tab.value === currentFreq;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTabChange(tab.value)}
              data-testid={`recurrence-freq-${tab.value}`}
              className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent-subtle)' : 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-primary)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-3 pb-1">
          {/* Interval */}
          <IntervalInput
            value={draft.interval}
            unit={unitLabel[draft.frequency]}
            onChange={(n) => updateDraft({ interval: n })}
          />

          {/* Weekly: weekday checkboxes */}
          {draft.frequency === 'weekly' && (
            <WeekdayCheckboxes
              selected={draft.daysOfWeek}
              onChange={(days) => updateDraft({ daysOfWeek: days })}
            />
          )}

          {/* Monthly / Yearly: spec editor */}
          {(draft.frequency === 'monthly' || draft.frequency === 'yearly') && draft.monthlySpec && (
            <MonthlySpecEditor
              spec={draft.monthlySpec}
              onChange={(spec) => updateDraft({ monthlySpec: spec })}
            />
          )}

          {/* Yearly: month selector */}
          {draft.frequency === 'yearly' && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={labelStyle}>In</span>
              <select
                value={draft.month ?? 1}
                onChange={(e) => updateDraft({ month: parseInt(e.target.value, 10) })}
                className="text-sm px-2 py-1 rounded outline-none"
                style={inputStyle}
                data-testid="recurrence-month"
              >
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* End date — opt-in only; no end date by default */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.endDate !== null}
                onChange={(e) => {
                  if (e.target.checked) {
                    // Default to 30 days from today when the user first opts in
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    const iso = d.toISOString().slice(0, 10);
                    updateDraft({ endDate: iso });
                  } else {
                    updateDraft({ endDate: null });
                  }
                }}
                data-testid="recurrence-end-date-toggle"
                className="cursor-pointer"
              />
              <span className="text-xs" style={labelStyle}>End on</span>
            </label>
            {draft.endDate !== null && (
              <input
                type="date"
                value={draft.endDate}
                onChange={(e) => updateDraft({ endDate: e.target.value || null })}
                className="text-sm px-2 py-1 rounded outline-none"
                style={inputStyle}
                data-testid="recurrence-end-date"
              />
            )}
          </div>

          {/* Apply / Clear */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleApply}
              data-testid="recurrence-apply"
              className="px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'white',
              }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleClear}
              data-testid="recurrence-clear"
              className="px-3 py-1.5 rounded-md text-xs cursor-pointer"
              style={{
                border: '1px solid var(--color-border-primary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
