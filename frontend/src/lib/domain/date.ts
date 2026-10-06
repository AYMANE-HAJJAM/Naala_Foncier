const DATE_ONLY_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})/;

export function localDateKey(value: Date = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateTimeInputMin(value: Date = new Date()): string {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${localDateKey(value)}T${hours}:${minutes}`;
}

export function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

export function dateOnlyToIsoAtNoonUtc(value: string): string {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function isDateOnOrAfterToday(value?: string | null, now: Date = new Date()): boolean {
  return Boolean(value && value.slice(0, 10) >= localDateKey(now));
}

export function isAtOrAfterNow(value?: string | null, now: Date = new Date()): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() >= now.getTime();
}

export function formatDate(value?: string | null): string {
  if (!value) return "À confirmer";

  const match = value.trim().match(DATE_ONLY_PATTERN);
  if (!match) return "À confirmer";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "À confirmer";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
