import { addDays, addMonthsAnchored, compareDates, parseISO } from './dates';
import type { BillPayment, DateISO, RecurrenceException, RecurringRule } from './types';

/**
 * Recurrence rules and date-only occurrence generation.
 *
 * Monthly/quarterly/yearly rules are anchored to `anchorDay` (or the start date's day of
 * month) so a bill due on the 31st falls on the last day of shorter months but returns to
 * the 31st in longer months. Leap-day yearly rules fall on 28 February in non-leap years and
 * return to 29 February in leap years.
 */

const MAX_OCCURRENCES = 5000;

export function anchorDayOf(rule: Pick<RecurringRule, 'startDate' | 'anchorDay'>): number {
  if (rule.anchorDay && rule.anchorDay >= 1 && rule.anchorDay <= 31) return rule.anchorDay;
  return parseISO(rule.startDate).day;
}

export function stepOccurrence(rule: RecurringRule, index: number): DateISO {
  const interval = Math.max(1, Math.floor(rule.interval));
  switch (rule.frequency) {
    case 'daily':
      return addDays(rule.startDate, index * interval);
    case 'weekly':
      return addDays(rule.startDate, index * interval * 7);
    case 'biweekly':
      return addDays(rule.startDate, index * interval * 14);
    case 'monthly':
      return addMonthsAnchored(rule.startDate, index * interval, anchorDayOf(rule));
    case 'quarterly':
      return addMonthsAnchored(rule.startDate, index * interval * 3, anchorDayOf(rule));
    case 'yearly':
      return addMonthsAnchored(rule.startDate, index * interval * 12, anchorDayOf(rule));
    default:
      return rule.startDate;
  }
}

/** Raw occurrence dates produced by a rule, before exceptions. Inclusive bounds. */
export function ruleOccurrences(rule: RecurringRule, from: DateISO, to: DateISO): DateISO[] {
  if (compareDates(from, to) > 0) return [];
  const results: DateISO[] = [];
  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    const date = stepOccurrence(rule, index);
    if (date > to) break;
    if (date < from) continue;
    if (rule.endDate && date > rule.endDate) break;
    results.push(date);
  }
  return results;
}

export interface ResolvedOccurrence {
  /** Stable key: rule id + original date. */
  id: string;
  recurringId: string;
  /** Date the occurrence originally fell on. */
  originalDate: DateISO;
  /** Effective date after any reschedule. */
  date: DateISO;
  amount: number;
  kind: 'income' | 'expense';
  name: string;
  accountId: string;
  categoryId?: string;
  status: 'unpaid' | 'paid' | 'skipped' | 'overdue';
  payment?: BillPayment;
  exception?: RecurrenceException;
}

/**
 * Applies skip / reschedule / amount exceptions to generated occurrences.
 * A skipped occurrence is omitted. Rescheduled occurrences are included when their new date
 * falls inside the requested window.
 */
export function occurrencesBetween(
  rule: RecurringRule,
  from: DateISO,
  to: DateISO,
  exceptions: RecurrenceException[] = [],
): ResolvedOccurrence[] {
  const byOriginal = new Map<string, RecurrenceException>();
  for (const exception of exceptions) {
    if (exception.recurringId === rule.id) byOriginal.set(exception.originalDate, exception);
  }

  const results: ResolvedOccurrence[] = [];
  for (const originalDate of ruleOccurrences(rule, from, to)) {
    const exception = byOriginal.get(originalDate);
    if (exception?.kind === 'skip') continue;
    let date = originalDate;
    let amount = rule.amount;
    if (exception?.kind === 'reschedule' && exception.newDate) date = exception.newDate;
    if (exception?.kind === 'amount' && exception.newAmount != null) amount = exception.newAmount;
    if (date < from || date > to) continue;
    results.push({
      id: `${rule.id}:${originalDate}`,
      recurringId: rule.id,
      originalDate,
      date,
      amount,
      kind: rule.kind,
      name: rule.name,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      status: 'unpaid',
      exception,
    });
  }
  return results;
}

/**
 * Resolves occurrence status from recorded payments. An occurrence is overdue when its due date
 * has passed and no payment or skip is recorded.
 */
export function scheduleOccurrences(options: {
  rules: RecurringRule[];
  exceptions: RecurrenceException[];
  payments: BillPayment[];
  from: DateISO;
  to: DateISO;
  today: DateISO;
}): ResolvedOccurrence[] {
  const { rules, exceptions, payments, from, to, today } = options;
  const paymentKey = new Map<string, BillPayment>();
  for (const payment of payments) {
    paymentKey.set(`${payment.recurringId}:${payment.occurrenceDate}`, payment);
  }

  const results: ResolvedOccurrence[] = [];
  for (const rule of rules) {
    if (rule.archived) continue;
    for (const occurrence of occurrencesBetween(rule, from, to, exceptions)) {
      const payment = paymentKey.get(`${occurrence.recurringId}:${occurrence.originalDate}`);
      const status = payment ? payment.status : occurrence.date < today ? 'overdue' : 'unpaid';
      results.push({ ...occurrence, status, payment });
    }
  }
  return results.sort((a, b) => {
    const byDate = compareDates(a.date, b.date);
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  });
}

/** Upcoming, still-unsettled occurrences between today and the horizon. */
export function upcomingOccurrences(
  rules: RecurringRule[],
  exceptions: RecurrenceException[],
  payments: BillPayment[],
  today: DateISO,
  horizonDays: number,
): ResolvedOccurrence[] {
  return scheduleOccurrences({
    rules,
    exceptions,
    payments,
    from: today,
    to: addDays(today, horizonDays),
    today,
  }).filter((occurrence) => occurrence.status === 'unpaid' || occurrence.status === 'overdue');
}

export function occurrencesInMonth(
  rules: RecurringRule[],
  exceptions: RecurrenceException[],
  payments: BillPayment[],
  monthStart: DateISO,
  monthEnd: DateISO,
  today: DateISO,
): ResolvedOccurrence[] {
  return scheduleOccurrences({
    rules,
    exceptions,
    payments,
    from: monthStart,
    to: monthEnd,
    today,
  });
}

export function frequencyLabel(rule: RecurringRule): string {
  const n = Math.max(1, rule.interval);
  const labels: Record<string, [string, string]> = {
    daily: ['day', 'days'],
    weekly: ['week', 'weeks'],
    biweekly: ['two weeks', 'two weeks'],
    monthly: ['month', 'months'],
    quarterly: ['quarter', 'quarters'],
    yearly: ['year', 'years'],
  };
  const [singular, plural] = labels[rule.frequency] ?? ['period', 'periods'];
  if (rule.frequency === 'biweekly') return 'Every two weeks';
  if (n === 1) return `Every ${singular}`;
  return `Every ${n} ${rule.frequency === 'monthly' || rule.frequency === 'quarterly' ? plural : singular + 's'}`;
}
