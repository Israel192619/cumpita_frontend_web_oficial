import { describe, expect, it } from 'vitest';
import { isWithinDateRange } from './date-range-utils';

describe('isWithinDateRange', () => {
  it('incluye todo cuando el rango está vacío', () => expect(isWithinDateRange('2026-08-17T10:00:00', { from: null, to: null, includeTime: false })).toBe(true));
  it('filtra un único día sin hora', () => {
    const range = { from: '2026-08-17', to: '2026-08-17', includeTime: false };
    expect(isWithinDateRange('2026-08-17T23:59:00', range)).toBe(true);
    expect(isWithinDateRange('2026-08-18T00:00:00', range)).toBe(false);
  });
  it('respeta horas y minutos', () => {
    const range = { from: '2026-08-17T08:30', to: '2026-08-17T18:15', includeTime: true };
    expect(isWithinDateRange('2026-08-17T14:20:00', range)).toBe(true);
    expect(isWithinDateRange('2026-08-17T18:16:00', range)).toBe(false);
  });
});
