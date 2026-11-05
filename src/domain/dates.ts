import type { DateISO } from './types';

/**
 * Timezone-safe, date-only helpers. Dates are ISO `YYYY-MM-DD` strings. We only ever use
 * `Date` for calendar arithmetic by constructing UTC dates, then extracting UTC parts.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateISO(value: unknown): value is DateISO {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [, y, m, d] = ISO_DATE.exec(value)!;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

export function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toISO(year: number, month: number, day: number): DateISO {
  return `${year.toString().padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

export function parseISO(date: DateISO): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Invalid ISO date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function utcDate(date: DateISO): Date {
  const { year, month, day } = parseISO(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function fromUTCDate(date: Date): DateISO {
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayISO(): DateISO {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(date: DateISO, days: number): DateISO {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTCDate(d);
}

export function addMonths(date: DateISO, months: number): DateISO {
  const { year, month, day } = parseISO(date);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return toISO(targetYear, targetMonth, clampedDay);
}

/** Adds months keeping an explicit anchor day (e.g. the 31st stays the 31st where possible). */
export function addMonthsAnchored(date: DateISO, months: number, anchorDay: number): DateISO {
  const { year, month } = parseISO(date);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const clampedDay = Math.min(anchorDay, daysInMonth(targetYear, targetMonth));
  return toISO(targetYear, targetMonth, clampedDay);
}

export function addYears(date: DateISO, years: number): DateISO {
  return addMonths(date, years * 12);
}

export function compareDates(a: DateISO, b: DateISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBefore(a: DateISO, b: DateISO): boolean {
  return a < b;
}

export function isAfter(a: DateISO, b: DateISO): boolean {
  return a > b;
}

export function isSameOrAfter(a: DateISO, b: DateISO): boolean {
  return a >= b;
}

export function isSameOrBefore(a: DateISO, b: DateISO): boolean {
  return a <= b;
}

export function startOfMonth(date: DateISO): DateISO {
  const { year, month } = parseISO(date);
  return toISO(year, month, 1);
}

export function endOfMonth(date: DateISO): DateISO {
  const { year, month } = parseISO(date);
  return toISO(year, month, daysInMonth(year, month));
}

export function startOfYear(date: DateISO): DateISO {
  return toISO(parseISO(date).year, 1, 1);
}

export function endOfYear(date: DateISO): DateISO {
  return toISO(parseISO(date).year, 12, 31);
}

export function monthKey(date: DateISO): string {
  return date.slice(0, 7);
}

export function eachMonth(start: DateISO, end: DateISO): DateISO[] {
  const months: DateISO[] = [];
  let cursor = startOfMonth(start);
  const last = startOfMonth(end);
  let guard = 0;
  while (cursor <= last && guard < 1000) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return months;
}

export function diffDays(from: DateISO, to: DateISO): number {
  const a = utcDate(from).getTime();
  const b = utcDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function weekday(date: DateISO): number {
  return utcDate(date).getUTCDay();
}

export function monthsBetween(from: DateISO, to: DateISO): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export type DateFormat = 'iso' | 'us' | 'eu' | 'long';

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

export function formatDate(date: DateISO, format: DateFormat = 'iso', locale = 'en-US'): string {
  const { year, month, day } = parseISO(date);
  switch (format) {
    case 'us':
      return `${pad2(month)}/${pad2(day)}/${year}`;
    case 'eu':
      return `${pad2(day)}/${pad2(month)}/${year}`;
    case 'long':
      return `${day} ${MONTHS_LONG[month - 1]} ${year}`;
    case 'iso':
    default:
      try {
        return new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'UTC',
        }).format(utcDate(date));
      } catch {
        return date;
      }
  }
}

export function formatMonth(date: DateISO, long = true): string {
  const { year, month } = parseISO(date);
  const name = long ? MONTHS_LONG[month - 1] : MONTHS_SHORT[month - 1];
  return `${name} ${year}`;
}

export function monthShortName(monthIndex: number): string {
  return MONTHS_SHORT[monthIndex];
}

/** Builds the visible calendar grid (6 weeks) starting on `weekStartsOn`. */
export function calendarGrid(monthOf: DateISO, weekStartsOn: 0 | 1 = 1): DateISO[] {
  const first = startOfMonth(monthOf);
  const offset = (weekday(first) - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
