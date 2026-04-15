import { describe, it, expect } from 'vitest';
import { parseQuickCaptureInput } from '../../src/lib/dates';

// Fixed reference: Monday, April 13, 2026 at 10:00 local time.
// Chrono's `forwardDate` option shifts past weekdays forward, so "friday"
// from this reference means Friday, April 17.
const REF = new Date(2026, 3, 13, 10, 0, 0);

describe('parseQuickCaptureInput', () => {
  it('returns the raw input as title when no date phrase is present', () => {
    const { title, when } = parseQuickCaptureInput('Buy milk', REF);
    expect(title).toBe('Buy milk');
    expect(when).toBeNull();
  });

  it('strips a trailing "tomorrow" and returns the next-day date', () => {
    const { title, when } = parseQuickCaptureInput('Buy milk tomorrow', REF);
    expect(title).toBe('Buy milk');
    expect(when).toBe('2026-04-14');
  });

  it('strips a trailing "today" and returns the reference date', () => {
    const { title, when } = parseQuickCaptureInput('Review PR today', REF);
    expect(title).toBe('Review PR');
    expect(when).toBe('2026-04-13');
  });

  it('parses an explicit ISO-ish date and strips it from the title', () => {
    const { title, when } = parseQuickCaptureInput('Review PRD 2026-05-01', REF);
    expect(title).toBe('Review PRD');
    expect(when).toBe('2026-05-01');
  });

  it('shifts past weekdays forward with forwardDate', () => {
    // "friday" from Monday Apr 13 forward-resolves to Fri Apr 17.
    const { title, when } = parseQuickCaptureInput('Call mom friday', REF);
    expect(title).toBe('Call mom');
    expect(when).toBe('2026-04-17');
  });

  it('keeps the original input as title when the date phrase is the entire input', () => {
    // User typed only "tomorrow" — stripping would leave an empty title,
    // so fall back to the original text as title (and still return the date).
    const { title, when } = parseQuickCaptureInput('tomorrow', REF);
    expect(title).toBe('tomorrow');
    expect(when).toBe('2026-04-14');
  });

  it('handles empty and whitespace-only input', () => {
    expect(parseQuickCaptureInput('', REF)).toEqual({ title: '', when: null });
    expect(parseQuickCaptureInput('   \t  ', REF)).toEqual({ title: '', when: null });
  });

  it('collapses internal whitespace after stripping a middle date phrase', () => {
    const { title, when } = parseQuickCaptureInput('Email tomorrow the team', REF);
    expect(title).toBe('Email the team');
    expect(when).toBe('2026-04-14');
  });
});
