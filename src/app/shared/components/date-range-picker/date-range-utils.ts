import { DateRangeValue } from './date-range-picker';

export function isWithinDateRange(value: string | null | undefined, range: DateRangeValue): boolean {
  if (!range.from && !range.to) return true;
  if (!value) return false;
  const normalized = value.trim().replace(' ', 'T');
  const candidate = range.includeTime ? normalized.slice(0, 16) : normalized.slice(0, 10);
  const from = normalizeBoundary(range.from, range.includeTime);
  const to = normalizeBoundary(range.to, range.includeTime);
  return (!from || candidate >= from) && (!to || candidate <= to);
}

function normalizeBoundary(value: string | null, includeTime: boolean): string | null {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  return includeTime ? normalized.slice(0, 16) : normalized.slice(0, 10);
}
