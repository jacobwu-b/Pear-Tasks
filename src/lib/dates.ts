import * as chrono from 'chrono-node';
import type { WhenValue, RecurrenceConfig, DayOfWeek } from '../types';

/**
 * Format a Date as YYYY-MM-DD in local time (not UTC). We want
 * "today" at 11pm PST to still resolve to today's calendar date.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalTodayDateString(now: Date = new Date()): string {
  return toLocalDateString(now);
}

export function getLocalTomorrowDateString(now: Date = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalDateString(tomorrow);
}

// ---------------------------------------------------------------------------
// Parsed quick capture result
// ---------------------------------------------------------------------------

export interface ParsedQuickCapture {
  title: string;
  when: WhenValue | null;
  recurrence: RecurrenceConfig | null;
}

// ---------------------------------------------------------------------------
// Natural-language recurrence detection
// ---------------------------------------------------------------------------

const DAY_NAME_TO_DOW: Record<string, DayOfWeek> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/** Day-name alternation for regex, longest first to avoid prefix shadowing. */
const DAY_ALT =
  'sunday|monday|tuesday|wednesday|thursday|friday|saturday';

/**
 * Ordered list of recurrence patterns. Each entry:
 *   - `re`: regex to match (case-insensitive, searches for the pattern anywhere in the string)
 *   - `build`: function that receives the regex match and returns a RecurrenceConfig
 *
 * Evaluated in order — first match wins. More-specific patterns come first.
 */
type RecurrencePattern = {
  re: RegExp;
  build: (m: RegExpExecArray) => RecurrenceConfig;
};

function baseConfig(): Omit<RecurrenceConfig, 'frequency' | 'interval'> {
  return { daysOfWeek: [], monthlySpec: null, month: null, endDate: null };
}

const RECURRENCE_PATTERNS: RecurrencePattern[] = [
  // "every weekday" — must come before "every week" to avoid partial match
  {
    re: /\bevery\s+weekday\b/i,
    build: () => ({ ...baseConfig(), frequency: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5] }),
  },
  // "every weekend" — must come before "every week"
  {
    re: /\bevery\s+weekend\b/i,
    build: () => ({ ...baseConfig(), frequency: 'weekly', interval: 1, daysOfWeek: [0, 6] }),
  },
  // "every monday", "every tuesday", etc. — before plain "every week"
  {
    re: new RegExp(`\\bevery\\s+(${DAY_ALT})\\b`, 'i'),
    build: (m) => ({
      ...baseConfig(),
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [DAY_NAME_TO_DOW[m[1].toLowerCase()]],
    }),
  },
  // "every 2 days", "every 3 day"
  {
    re: /\bevery\s+(\d+)\s+days?\b/i,
    build: (m) => ({ ...baseConfig(), frequency: 'daily', interval: parseInt(m[1], 10) }),
  },
  // "every 2 weeks"
  {
    re: /\bevery\s+(\d+)\s+weeks?\b/i,
    build: (m) => ({ ...baseConfig(), frequency: 'weekly', interval: parseInt(m[1], 10) }),
  },
  // "every 2 months"
  {
    re: /\bevery\s+(\d+)\s+months?\b/i,
    build: (m) => ({ ...baseConfig(), frequency: 'monthly', interval: parseInt(m[1], 10) }),
  },
  // "every 2 years"
  {
    re: /\bevery\s+(\d+)\s+years?\b/i,
    build: (m) => ({ ...baseConfig(), frequency: 'yearly', interval: parseInt(m[1], 10) }),
  },
  // "every day" / "daily"
  {
    re: /\b(every\s+day|daily)\b/i,
    build: () => ({ ...baseConfig(), frequency: 'daily', interval: 1 }),
  },
  // "every week" / "weekly"
  {
    re: /\b(every\s+week|weekly)\b/i,
    build: () => ({ ...baseConfig(), frequency: 'weekly', interval: 1 }),
  },
  // "every month" / "monthly"
  {
    re: /\b(every\s+month|monthly)\b/i,
    build: () => ({ ...baseConfig(), frequency: 'monthly', interval: 1 }),
  },
  // "every year" / "yearly" / "annually"
  {
    re: /\b(every\s+year|yearly|annually)\b/i,
    build: () => ({ ...baseConfig(), frequency: 'yearly', interval: 1 }),
  },
];

/**
 * Attempt to extract a recurrence phrase from `input`.
 * Returns the matched RecurrenceConfig and the input string with the phrase
 * removed, or null if no recurrence phrase was found.
 */
function extractRecurrence(
  input: string,
): { recurrence: RecurrenceConfig; stripped: string } | null {
  for (const { re, build } of RECURRENCE_PATTERNS) {
    // Use exec so we get the match index and length for slicing
    const globalRe = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    const match = globalRe.exec(input);
    if (!match) continue;

    const before = input.slice(0, match.index).trim();
    const after  = input.slice(match.index + match[0].length).trim();
    const stripped = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    return { recurrence: build(match), stripped };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a Quick Capture input into a task title, optional "when" date, and
 * optional recurrence rule.
 *
 * Processing order:
 * 1. Strip recurrence phrase (regex-based, runs first so chrono doesn't
 *    mis-parse "every monday" as a date expression).
 * 2. Pass the remainder to chrono-node to extract a one-off date.
 * 3. Return title = remainder with date also stripped; when = parsed date.
 *
 * If stripping both the recurrence and date phrases would leave the title
 * empty, the original trimmed input is used as the title.
 *
 * Past days-of-week shift forward ("friday" in a Saturday context means
 * next Friday, not yesterday).
 */
export function parseQuickCaptureInput(
  raw: string,
  referenceDate: Date = new Date(),
): ParsedQuickCapture {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '', when: null, recurrence: null };

  // Step 1: try to pull out a recurrence phrase
  const recurrenceResult = extractRecurrence(trimmed);
  const recurrence       = recurrenceResult?.recurrence ?? null;
  const afterRecurrence  = recurrenceResult?.stripped ?? trimmed;

  // Step 2: pass remainder to chrono-node
  const results = chrono.parse(afterRecurrence, referenceDate, { forwardDate: true });
  if (results.length === 0) {
    const title = afterRecurrence.length > 0 ? afterRecurrence : trimmed;
    return { title, when: null, recurrence };
  }

  const match  = results[0];
  const before = afterRecurrence.slice(0, match.index).trim();
  const after  = afterRecurrence.slice(match.index + match.text.length).trim();
  const stripped = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const when  = toLocalDateString(match.start.date());
  const title = stripped.length > 0 ? stripped : (afterRecurrence.length > 0 ? afterRecurrence : trimmed);

  return { title, when, recurrence };
}
