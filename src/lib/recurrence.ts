/**
 * Recurrence utilities: next-occurrence computation, human-readable summaries.
 *
 * rrule is used internally for standard DAILY/WEEKLY/MONTHLY/YEARLY rules.
 * 'fullWeekend' positional targets bypass rrule and use a custom month-walk
 * algorithm because RFC 5545 has no direct encoding for "Nth contiguous
 * Sat+Sun pair within a month".
 *
 * Timezone note: we work exclusively with local calendar dates (YYYY-MM-DD
 * strings). RRule computations use Date.UTC so that RRule's internal UTC
 * arithmetic lines up with our local-date intent: dtstart is set to UTC
 * midnight for the given calendar date, and results are read back via
 * getUTC* methods.
 */

import { RRule, type Options as RRuleOptions } from 'rrule';
import type {
  RecurrenceConfig,
  RecurrenceFrequency,
  DayOfWeek,
  OrdinalPosition,
  PositionalTarget,
  MonthlySpec,
} from '../types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string into { year, month (1-indexed), day }. */
function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

/** Format UTC date fields back into a YYYY-MM-DD string. */
function utcDateToString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** UTC midnight Date for a given local calendar date string (avoids timezone shift). */
function utcMidnight(dateStr: string): Date {
  const { year, month, day } = parseDate(dateStr);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Number of days in a given month (1-indexed). Handles leap years. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Map OrdinalPosition to a 0-based index for use with arrays.
 * 'last' and 'secondToLast' are handled as negative offsets from array end.
 */
function positionToIndex(position: OrdinalPosition, arrayLength: number): number {
  switch (position) {
    case 'first':       return 0;
    case 'second':      return 1;
    case 'third':       return 2;
    case 'fourth':      return 3;
    case 'last':        return arrayLength - 1;
    case 'secondToLast': return arrayLength - 2;
  }
}

/** RRule bysetpos values for ordinal positions (used for non-fullWeekend positional rules). */
function positionToSetpos(position: OrdinalPosition): number {
  switch (position) {
    case 'first':       return 1;
    case 'second':      return 2;
    case 'third':       return 3;
    case 'fourth':      return 4;
    case 'last':        return -1;
    case 'secondToLast': return -2;
  }
}

/** DayOfWeek (0=Sun…6=Sat) → RRule Weekday constant. */
const DOW_TO_RRULE = [
  RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA,
] as const;

// ---------------------------------------------------------------------------
// Full-weekend algorithm (bypasses RRule)
// ---------------------------------------------------------------------------

/**
 * Find all "full weekends" in a given month — defined as a Saturday where the
 * immediately following Sunday falls within the same month.
 *
 * Returns the Saturday dates (as UTC Date objects) of each qualifying weekend,
 * in calendar order.
 */
function fullWeekendsInMonth(year: number, month: number): Date[] {
  const totalDays = daysInMonth(year, month);
  const weekends: Date[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    // Saturday = 6 in getUTCDay()
    if (date.getUTCDay() === 6 && day < totalDays) {
      // Sunday would be day+1, which is still in the same month
      weekends.push(date);
    }
  }

  return weekends;
}

/**
 * Given an ordinal position and a year/month, return the Saturday date string
 * of the Nth full weekend, or null if the month has fewer weekends than
 * required by the position.
 */
function fullWeekendInMonth(
  position: OrdinalPosition,
  year: number,
  month: number,
): string | null {
  const weekends = fullWeekendsInMonth(year, month);
  if (weekends.length === 0) return null;

  const idx = positionToIndex(position, weekends.length);
  if (idx < 0 || idx >= weekends.length) return null;

  return utcDateToString(weekends[idx]);
}

// ---------------------------------------------------------------------------
// RRule-based next occurrence
// ---------------------------------------------------------------------------

/**
 * Convert a RecurrenceConfig + dtstart into RRule Options for standard rules.
 * fullWeekend targets must NOT be passed here — they use the custom algorithm.
 */
function configToRRuleOptions(config: RecurrenceConfig, dtstart: Date): Partial<RRuleOptions> {
  const freqMap: Record<RecurrenceFrequency, number> = {
    daily:   RRule.DAILY,
    weekly:  RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly:  RRule.YEARLY,
  };

  const opts: Partial<RRuleOptions> = {
    freq:     freqMap[config.frequency],
    interval: config.interval,
    dtstart,
  };

  // Weekly: optional weekday filter
  if (config.frequency === 'weekly' && config.daysOfWeek.length > 0) {
    opts.byweekday = config.daysOfWeek.map((d) => DOW_TO_RRULE[d]);
  }

  // Monthly / yearly: sub-spec
  if (
    (config.frequency === 'monthly' || config.frequency === 'yearly') &&
    config.monthlySpec
  ) {
    const spec = config.monthlySpec;
    if (spec.kind === 'dayOfMonth') {
      opts.bymonthday = [spec.day];
    } else {
      // positional — fullWeekend is handled separately, should not reach here
      const { position, target } = spec;
      opts.bysetpos = [positionToSetpos(position)];

      if (typeof target === 'number') {
        // DayOfWeek
        opts.byweekday = [DOW_TO_RRULE[target]];
      } else if (target === 'weekday') {
        opts.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
      } else if (target === 'weekendDay') {
        opts.byweekday = [RRule.SA, RRule.SU];
      }
      // target === 'day': no byweekday — bysetpos selects by day-of-month ordinal
    }
  }

  // Yearly: also filter by month
  if (config.frequency === 'yearly' && config.month != null) {
    opts.bymonth = [config.month];
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the next occurrence date after `fromDate` according to `config`.
 *
 * `fromDate` is the YYYY-MM-DD of the just-completed instance.
 *
 * Returns the next YYYY-MM-DD, or null if:
 * - No future occurrence exists (e.g. fullWeekend month iteration limit hit)
 * - The computed date exceeds config.endDate
 */
export function computeNextOccurrence(
  config: RecurrenceConfig,
  fromDate: string,
): string | null {
  const isFullWeekend =
    (config.frequency === 'monthly' || config.frequency === 'yearly') &&
    config.monthlySpec?.kind === 'positional' &&
    config.monthlySpec.target === 'fullWeekend';

  let nextDateStr: string | null;

  if (isFullWeekend) {
    // Custom month-walk: skip months by config.interval until we find a match
    // that is strictly after fromDate.
    const spec = config.monthlySpec as Extract<MonthlySpec, { kind: 'positional' }>;
    const { position } = spec;
    const { year: fromYear, month: fromMonth } = parseDate(fromDate);

    let candidateYear = fromYear;
    let candidateMonth = fromMonth;
    nextDateStr = null;

    // Safety: iterate at most 48 months (4 years) before giving up
    for (let i = 0; i < 48; i++) {
      // Advance by interval months
      candidateMonth += config.interval;
      while (candidateMonth > 12) {
        candidateMonth -= 12;
        candidateYear += 1;
      }

      // For yearly: also enforce the configured month
      if (config.frequency === 'yearly' && config.month != null) {
        if (candidateMonth !== config.month) {
          // Jump directly to the configured month in the next year cycle
          candidateMonth = config.month;
          if (candidateMonth <= fromMonth && candidateYear === fromYear) {
            candidateYear += 1;
          }
        }
      }

      const candidate = fullWeekendInMonth(position, candidateYear, candidateMonth);
      if (candidate && candidate > fromDate) {
        nextDateStr = candidate;
        break;
      }
    }
  } else {
    // RRule branch
    const dtstart = utcMidnight(fromDate);
    const opts = configToRRuleOptions(config, dtstart);
    const rule = new RRule(opts);
    const after = rule.after(dtstart, false /* exclusive */);
    nextDateStr = after ? utcDateToString(after) : null;
  }

  if (!nextDateStr) return null;

  // Respect end date
  if (config.endDate && nextDateStr > config.endDate) return null;

  return nextDateStr;
}

// ---------------------------------------------------------------------------
// Human-readable summary
// ---------------------------------------------------------------------------

const DAY_ABBR: Record<DayOfWeek, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

const MONTH_ABBR: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

const ORDINAL_LABEL: Record<OrdinalPosition, string> = {
  first:        '1st',
  second:       '2nd',
  third:        '3rd',
  fourth:       '4th',
  last:         'Last',
  secondToLast: '2nd-to-last',
};

function targetLabel(target: PositionalTarget): string {
  if (typeof target === 'number') return DAY_ABBR[target];
  switch (target) {
    case 'day':         return 'day';
    case 'weekday':     return 'weekday';
    case 'weekendDay':  return 'weekend day';
    case 'fullWeekend': return 'full weekend';
  }
}

function monthlySpecLabel(spec: MonthlySpec): string {
  if (spec.kind === 'dayOfMonth') return `${spec.day}th`;
  const { position, target } = spec;
  return `${ORDINAL_LABEL[position]} ${targetLabel(target)}`;
}

/**
 * Returns a concise human-readable label for a RecurrenceConfig.
 * Examples: "Daily", "Every 2 days", "Weekdays", "Weekly Mon",
 *           "Monthly 15th", "Monthly 1st Mon", "Yearly Mar".
 */
export function summarizeRecurrence(config: RecurrenceConfig): string {
  const { frequency, interval, daysOfWeek, monthlySpec, month } = config;
  const every = interval === 1 ? '' : `Every ${interval} `;

  switch (frequency) {
    case 'daily':
      return interval === 1 ? 'Daily' : `Every ${interval} days`;

    case 'weekly': {
      if (daysOfWeek.length === 0) {
        return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
      }
      const sorted = [...daysOfWeek].sort((a, b) => a - b) as DayOfWeek[];
      // Special aliases
      if (sorted.length === 5 && sorted.join() === '1,2,3,4,5') return `${every}Weekdays`;
      if (sorted.length === 2 && sorted.join() === '0,6')        return `${every}Weekends`;
      const dayStr = sorted.map((d) => DAY_ABBR[d]).join(', ');
      return `${every}Weekly ${dayStr}`;
    }

    case 'monthly': {
      const specStr = monthlySpec ? monthlySpecLabel(monthlySpec) : '';
      return interval === 1
        ? `Monthly ${specStr}`.trim()
        : `Every ${interval} months ${specStr}`.trim();
    }

    case 'yearly': {
      const monthStr = month ? MONTH_ABBR[month] : '';
      const specStr  = monthlySpec ? ` ${monthlySpecLabel(monthlySpec)}` : '';
      return interval === 1
        ? `Yearly ${monthStr}${specStr}`.trim()
        : `Every ${interval} years ${monthStr}${specStr}`.trim();
    }
  }
}

// ---------------------------------------------------------------------------
// Default config factory
// ---------------------------------------------------------------------------

/** Returns a sensible default RecurrenceConfig for a given frequency. */
export function defaultRecurrenceConfig(frequency: RecurrenceFrequency): RecurrenceConfig {
  return {
    frequency,
    interval: 1,
    daysOfWeek: [],
    monthlySpec: frequency === 'monthly' || frequency === 'yearly'
      ? { kind: 'dayOfMonth', day: 1 }
      : null,
    month: frequency === 'yearly' ? 1 : null,
    endDate: null,
  };
}
