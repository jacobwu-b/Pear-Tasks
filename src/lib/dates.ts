import * as chrono from 'chrono-node';
import type { WhenValue } from '../types';

/**
 * Format a Date as YYYY-MM-DD in local time (not UTC). We want
 * "today" at 11pm PST to still resolve to today's calendar date.
 */
function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a Quick Capture input into a task title and optional "when" date.
 *
 * Strips a single trailing or embedded date expression from the input and
 * returns what remains as the title. If no date expression is found, the
 * entire (trimmed) input is the title. If stripping the date expression
 * would leave the title empty, the original input is kept as the title
 * AND the parsed date is still returned — users typing just "tomorrow"
 * get a task titled "tomorrow" due tomorrow, which is probably what they
 * meant.
 *
 * Past days-of-week shift forward ("friday" in a Saturday context means
 * next Friday, not yesterday).
 */
export function parseQuickCaptureInput(
  raw: string,
  referenceDate: Date = new Date(),
): { title: string; when: WhenValue | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { title: '', when: null };

  const results = chrono.parse(trimmed, referenceDate, { forwardDate: true });
  if (results.length === 0) return { title: trimmed, when: null };

  // Use the first match. Multiple dates in a quick-capture input is an
  // edge we don't need to support in v1.
  const match = results[0];
  const before = trimmed.slice(0, match.index).trim();
  const after = trimmed.slice(match.index + match.text.length).trim();
  const stripped = [before, after].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const when = toLocalDateString(match.start.date());
  const title = stripped.length > 0 ? stripped : trimmed;

  return { title, when };
}
