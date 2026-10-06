export function isoDateOnly(value?: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Business rule: an upcoming instant is at or after the comparison instant. */
export function isUpcoming(value?: Date | null, now: Date = new Date()): boolean {
  return Boolean(value && value.getTime() >= now.getTime());
}

export function futureDateOnly(value?: Date | null, now: Date = new Date()): string | null {
  return isUpcoming(value, now) ? isoDateOnly(value) : null;
}
