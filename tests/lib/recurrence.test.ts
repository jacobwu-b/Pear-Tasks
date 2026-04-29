import { describe, it, expect } from 'vitest';
import { computeNextOccurrence, summarizeRecurrence } from '../../src/lib/recurrence';
import type { RecurrenceConfig, DayOfWeek, OrdinalPosition, PositionalTarget } from '../../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daily(interval = 1, endDate: string | null = null): RecurrenceConfig {
  return { frequency: 'daily', interval, daysOfWeek: [], monthlySpec: null, month: null, endDate };
}

function weekly(daysOfWeek: DayOfWeek[], interval = 1): RecurrenceConfig {
  return { frequency: 'weekly', interval, daysOfWeek, monthlySpec: null, month: null, endDate: null };
}

function monthlyDayOfMonth(day: number, interval = 1): RecurrenceConfig {
  return { frequency: 'monthly', interval, daysOfWeek: [], monthlySpec: { kind: 'dayOfMonth', day }, month: null, endDate: null };
}

function monthlyPositional(position: OrdinalPosition, target: PositionalTarget, interval = 1): RecurrenceConfig {
  return {
    frequency: 'monthly',
    interval,
    daysOfWeek: [],
    monthlySpec: { kind: 'positional', position, target },
    month: null,
    endDate: null,
  };
}

function yearly(month: number, monthlySpec: RecurrenceConfig['monthlySpec'] = null, interval = 1): RecurrenceConfig {
  return { frequency: 'yearly', interval, daysOfWeek: [], monthlySpec, month, endDate: null };
}

// ---------------------------------------------------------------------------
// computeNextOccurrence
// ---------------------------------------------------------------------------

describe('computeNextOccurrence', () => {
  describe('daily', () => {
    it('returns the next day for daily interval=1', () => {
      expect(computeNextOccurrence(daily(1), '2026-04-13')).toBe('2026-04-14');
    });

    it('returns the day after interval for daily interval=3', () => {
      expect(computeNextOccurrence(daily(3), '2026-04-13')).toBe('2026-04-16');
    });

    it('rolls over to the next month', () => {
      expect(computeNextOccurrence(daily(1), '2026-04-30')).toBe('2026-05-01');
    });

    it('returns null when next date exceeds endDate', () => {
      const config = daily(1, '2026-04-14');
      expect(computeNextOccurrence(config, '2026-04-14')).toBeNull();
    });

    it('returns the occurrence when it equals endDate', () => {
      const config = daily(1, '2026-04-14');
      expect(computeNextOccurrence(config, '2026-04-13')).toBe('2026-04-14');
    });
  });

  describe('weekly', () => {
    it('returns the next configured weekday from a Wednesday', () => {
      // Mon(1), Wed(3), Fri(5) — from Wed Apr 15, next is Fri Apr 17
      const cfg = weekly([1, 3, 5]);
      expect(computeNextOccurrence(cfg, '2026-04-15')).toBe('2026-04-17');
    });

    it('wraps to the next week when past the last configured day', () => {
      // Mon(1), Wed(3) — from Wed Apr 15, next is Mon Apr 20
      const cfg = weekly([1, 3]);
      expect(computeNextOccurrence(cfg, '2026-04-15')).toBe('2026-04-20');
    });

    it('handles every-other-week interval', () => {
      // Every 2 weeks on Monday — from Mon Apr 13, next is Mon Apr 27
      const cfg = weekly([1], 2);
      expect(computeNextOccurrence(cfg, '2026-04-13')).toBe('2026-04-27');
    });

    it('returns weekends (Sat=6, Sun=0) correctly', () => {
      // from Friday Apr 17, next weekend day is Saturday Apr 18
      const cfg = weekly([6, 0] as DayOfWeek[]);
      expect(computeNextOccurrence(cfg, '2026-04-17')).toBe('2026-04-18');
    });
  });

  describe('monthly — day of month', () => {
    it('advances to the same day next month', () => {
      const cfg = monthlyDayOfMonth(15);
      expect(computeNextOccurrence(cfg, '2026-04-15')).toBe('2026-05-15');
    });

    it('handles months with fewer days (Feb 30→ next matching month)', () => {
      // RRule skips months that don't have day 31 — so from Jan 31 next is Mar 31
      const cfg = monthlyDayOfMonth(31);
      expect(computeNextOccurrence(cfg, '2026-01-31')).toBe('2026-03-31');
    });

    it('handles every-2-months interval', () => {
      const cfg = monthlyDayOfMonth(1, 2);
      expect(computeNextOccurrence(cfg, '2026-04-01')).toBe('2026-06-01');
    });
  });

  describe('monthly — positional weekday', () => {
    it('returns the first Monday of next month', () => {
      // April 2026: first Monday is Apr 6, so from Apr 13 → next is May 4 (first Mon of May)
      const cfg = monthlyPositional('first', 1 /* Monday */);
      expect(computeNextOccurrence(cfg, '2026-04-13')).toBe('2026-05-04');
    });

    it('returns the last Friday of next month', () => {
      // From Apr 2026, last Friday of May 2026 = May 29
      const cfg = monthlyPositional('last', 5 /* Friday */);
      expect(computeNextOccurrence(cfg, '2026-04-24')).toBe('2026-05-29');
    });

    it('returns second-to-last Monday of next month', () => {
      const cfg = monthlyPositional('secondToLast', 1 /* Monday */);
      const result = computeNextOccurrence(cfg, '2026-04-30');
      // May 2026: Mondays = 4,11,18,25 → second-to-last = May 18
      expect(result).toBe('2026-05-18');
    });

    it('returns the first weekday of next month', () => {
      // May 1 2026 is a Friday → first weekday of May is May 1
      const cfg = monthlyPositional('first', 'weekday');
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-05-01');
    });

    it('returns the last weekend day of next month', () => {
      // May 2026: last day = May 31 (Sunday) → last weekend day = May 31
      const cfg = monthlyPositional('last', 'weekendDay');
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-05-31');
    });
  });

  describe('monthly — full weekend', () => {
    it('returns the Saturday of the first full weekend of the next month', () => {
      // May 2026: Saturdays are 2, 9, 16, 23, 30
      // May 2 → May 3 Sunday, both in May → first full weekend = May 2
      const cfg = monthlyPositional('first', 'fullWeekend');
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-05-02');
    });

    it('returns the Saturday of the last full weekend of the next month', () => {
      // May 2026: last Saturday = May 30, May 31 is Sunday (same month) → last full weekend = May 30
      const cfg = monthlyPositional('last', 'fullWeekend');
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-05-30');
    });

    it('returns the second full weekend', () => {
      // May 2026: full weekends start on May 2, 9, 16, 23, 30 (all have Sunday in May)
      // second = May 9
      const cfg = monthlyPositional('second', 'fullWeekend');
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-05-09');
    });

    it('advances by interval months for full weekend', () => {
      // every 2 months, first full weekend — from Apr 30 → skip May, land on June
      // June 2026: June 6 is Saturday, June 7 is Sunday (same month) → first full weekend = June 6
      const cfg: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 2,
        daysOfWeek: [],
        monthlySpec: { kind: 'positional', position: 'first', target: 'fullWeekend' },
        month: null,
        endDate: null,
      };
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBe('2026-06-06');
    });

    it('skips months where the ordinal position has no full weekend', () => {
      // Feb 2026: Saturdays = 7, 14, 21, 28. Feb 28 is the last day of the month,
      // so Mar 1 would be Sunday (different month) → Feb 28 is NOT a full weekend.
      // Feb 2026 has 3 full weekends: Feb 7, 14, 21.
      // "Fourth" full weekend → Feb has no fourth → skip to March 2026.
      // March 2026: Saturdays = 7, 14, 21, 28 (Mar 29 Sunday is same month) → 4 full weekends.
      // Fourth full weekend of March = Mar 28.
      const cfg = monthlyPositional('fourth', 'fullWeekend');
      const result = computeNextOccurrence(cfg, '2026-01-31');
      expect(result).toBe('2026-03-28');
    });

    it('respects endDate for full weekend', () => {
      const cfg: RecurrenceConfig = {
        frequency: 'monthly',
        interval: 1,
        daysOfWeek: [],
        monthlySpec: { kind: 'positional', position: 'first', target: 'fullWeekend' },
        month: null,
        endDate: '2026-05-01', // before the first full weekend of May (May 2)
      };
      expect(computeNextOccurrence(cfg, '2026-04-30')).toBeNull();
    });
  });

  describe('yearly', () => {
    it('returns the same month and day next year', () => {
      const cfg = yearly(4, { kind: 'dayOfMonth', day: 15 });
      // Apr 15 2026 → Apr 15 2027
      expect(computeNextOccurrence(cfg, '2026-04-15')).toBe('2027-04-15');
    });

    it('returns the first Monday of March next year', () => {
      // First Monday of March 2027 — Mar 1 2027 is Mon → Mar 1
      const cfg = yearly(3, { kind: 'positional', position: 'first', target: 1 });
      expect(computeNextOccurrence(cfg, '2026-03-02')).toBe('2027-03-01');
    });
  });

  describe('end date boundary', () => {
    it('returns null when next occurrence is after endDate', () => {
      const cfg = daily(1, '2026-04-20');
      expect(computeNextOccurrence(cfg, '2026-04-20')).toBeNull();
    });

    it('returns the occurrence when it equals endDate exactly', () => {
      const cfg = daily(1, '2026-04-21');
      expect(computeNextOccurrence(cfg, '2026-04-20')).toBe('2026-04-21');
    });
  });
});

// ---------------------------------------------------------------------------
// summarizeRecurrence
// ---------------------------------------------------------------------------

describe('summarizeRecurrence', () => {
  it('daily interval=1', () => {
    expect(summarizeRecurrence(daily(1))).toBe('Daily');
  });

  it('daily interval=3', () => {
    expect(summarizeRecurrence(daily(3))).toBe('Every 3 days');
  });

  it('weekdays (Mon–Fri)', () => {
    expect(summarizeRecurrence(weekly([1, 2, 3, 4, 5]))).toBe('Weekdays');
  });

  it('weekends (Sat+Sun)', () => {
    expect(summarizeRecurrence(weekly([6, 0]))).toBe('Weekends');
  });

  it('weekly on a single day', () => {
    // Monday
    expect(summarizeRecurrence(weekly([1]))).toBe('Weekly Mon');
  });

  it('every 2 weeks on Monday and Wednesday', () => {
    expect(summarizeRecurrence(weekly([1, 3], 2))).toBe('Every 2 Weekly Mon, Wed');
  });

  it('monthly 15th', () => {
    expect(summarizeRecurrence(monthlyDayOfMonth(15))).toBe('Monthly 15th');
  });

  it('monthly first Monday', () => {
    expect(summarizeRecurrence(monthlyPositional('first', 1))).toBe('Monthly 1st Mon');
  });

  it('monthly last full weekend', () => {
    expect(summarizeRecurrence(monthlyPositional('last', 'fullWeekend'))).toBe('Monthly Last full weekend');
  });

  it('yearly March', () => {
    const cfg = yearly(3, { kind: 'dayOfMonth', day: 15 });
    expect(summarizeRecurrence(cfg)).toBe('Yearly Mar 15th');
  });

  it('every 2 years', () => {
    const cfg: RecurrenceConfig = { frequency: 'yearly', interval: 2, daysOfWeek: [], monthlySpec: null, month: 6, endDate: null };
    expect(summarizeRecurrence(cfg)).toBe('Every 2 years Jun');
  });
});
