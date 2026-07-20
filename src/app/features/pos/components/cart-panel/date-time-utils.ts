export function normalizeOrderDateValue(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const dateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDateTimeValue(value: string | null | undefined): { date: string; time: string | null } | null {
  if (!value || !value.trim()) {
    return null;
  }

  const normalized = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return { date: normalized, time: null };
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?$/.test(normalized)) {
    const cleaned = normalized.replace(' ', 'T');
    const [date, time] = cleaned.split('T');
    return { date, time: time ?? null };
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: formatDateOnly(parsed),
      time: formatTimeOnly(parsed),
    };
  }

  return null;
}

export function normalizeDateOnlyValue(value: string | null | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed);
  }

  return null;
}

export function createDateTimeString(dateValue: string, timeValue: string | null): string {
  return timeValue ? `${dateValue}T${timeValue}` : dateValue;
}

export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function getTodayDateString(): string {
  return formatDateOnly(new Date());
}

export function getCurrentTimeString(): string {
  return formatTimeOnly(new Date());
}
