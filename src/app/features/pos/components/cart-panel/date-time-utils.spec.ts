import { createDateTimeString, normalizeDateOnlyValue, normalizeDateTimeValue, normalizeOrderDateValue } from './date-time-utils';

describe('date-time-utils', () => {
  it('normalizes a date-only string', () => {
    expect(normalizeOrderDateValue('2026-07-20')).toBe('2026-07-20');
  });

  it('normalizes a full datetime string', () => {
    expect(normalizeDateTimeValue('2026-07-20T14:30:45')).toEqual({ date: '2026-07-20', time: '14:30:45' });
  });

  it('creates a datetime string from date and time', () => {
    expect(createDateTimeString('2026-07-20', '14:30:45')).toBe('2026-07-20T14:30:45');
  });

  it('normalizes a date-only value', () => {
    expect(normalizeDateOnlyValue('2026-07-20T14:30:45')).toBe('2026-07-20');
  });
});
