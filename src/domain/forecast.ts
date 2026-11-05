import { addDays, compareDates } from './dates';
import type { DateISO, Transaction } from './types';

export type ForecastEventKind = 'transaction' | 'bill' | 'income';

export interface ForecastEvent {
  id: string;
  kind: ForecastEventKind;
  date: DateISO;
  name: string;
  /** Positive minor units. */
  amount: number;
  /** Effect on the selected account: positive in, negative out. */
  signedAmount: number;
  accountId: string;
  transferAccountId?: string;
  sourceId: string;
  recurringId?: string;
  occurrenceDate?: DateISO;
  expected: boolean;
}

export interface ForecastPoint {
  date: DateISO;
  event?: ForecastEvent;
  totalBalance: number;
  accountBalances: Record<string, number>;
}

export interface ForecastResult {
  from: DateISO;
  to: DateISO;
  startingBalance: number;
  endingBalance: number;
  /** Lowest end-of-event projected balance and its date. */
  lowPoint: { date: DateISO; balance: number };
  events: ForecastEvent[];
  points: ForecastPoint[];
  assumptions: string[];
  estimated: true;
}

export interface ForecastOccurrence {
  id: string;
  date: DateISO;
  name: string;
  amount: number;
  kind: 'income' | 'expense';
  accountId: string;
  recurringId: string;
  originalDate: DateISO;
}

export interface ForecastInput {
  from: DateISO;
  to: DateISO;
  startingBalances: Record<string, number>;
  transactions: Transaction[];
  occurrences: ForecastOccurrence[];
  /** Transfers are included when both accounts are tracked. */
  accountIds: string[];
}

/**
 * Deterministic future balance projection (estimate only).
 *
 * - Starts from actual balances at `from`.
 * - Includes future-dated transactions and unpaid recurring occurrences up to `to`.
 * - Same-day events are applied with outflows first, then inflows, so the reported low point is
 *   conservative for available cash.
 * - Transfers affect both the source and destination account but never income/expense totals.
 * - Nothing here is a guarantee: every contributing record is exposed on the event.
 */
export function buildForecast(input: ForecastInput): ForecastResult {
  const { from, to, transactions, occurrences, accountIds } = input;
  const balances: Record<string, number> = {};
  for (const id of accountIds) balances[id] = input.startingBalances[id] ?? 0;

  const events: ForecastEvent[] = [];

  for (const tx of transactions) {
    if (tx.date < from || tx.date > to) continue;
    if (tx.type === 'transfer') {
      if (tx.transferAccountId) {
        events.push({
          id: `tx:${tx.id}`,
          kind: 'transaction',
          date: tx.date,
          name: tx.description,
          amount: tx.amount,
          signedAmount: -tx.amount,
          accountId: tx.accountId,
          transferAccountId: tx.transferAccountId,
          sourceId: tx.id,
          expected: false,
        });
      }
      continue;
    }
    events.push({
      id: `tx:${tx.id}`,
      kind: 'transaction',
      date: tx.date,
      name: tx.description,
      amount: tx.amount,
      signedAmount: tx.type === 'income' ? tx.amount : -tx.amount,
      accountId: tx.accountId,
      sourceId: tx.id,
      expected: false,
    });
  }

  for (const occurrence of occurrences) {
    if (occurrence.date < from || occurrence.date > to) continue;
    if (!accountIds.includes(occurrence.accountId)) continue;
    events.push({
      id: `occ:${occurrence.id}`,
      kind: occurrence.kind === 'income' ? 'income' : 'bill',
      date: occurrence.date,
      name: occurrence.name,
      amount: occurrence.amount,
      signedAmount: occurrence.kind === 'income' ? occurrence.amount : -occurrence.amount,
      accountId: occurrence.accountId,
      sourceId: occurrence.recurringId,
      recurringId: occurrence.recurringId,
      occurrenceDate: occurrence.originalDate,
      expected: true,
    });
  }

  events.sort((a, b) => {
    const byDate = compareDates(a.date, b.date);
    if (byDate !== 0) return byDate;
    // Outflows before inflows on the same day (conservative low point).
    if (a.signedAmount < 0 && b.signedAmount >= 0) return -1;
    if (a.signedAmount >= 0 && b.signedAmount < 0) return 1;
    return a.id.localeCompare(b.id);
  });

  const points: ForecastPoint[] = [];
  let total = 0;
  for (const id of accountIds) total += balances[id] ?? 0;
  const startingBalance = total;
  points.push({ date: from, totalBalance: total, accountBalances: { ...balances } });
  let low = { date: from, balance: total };

  for (const event of events) {
    if (event.accountId && event.accountId in balances) {
      balances[event.accountId] += event.signedAmount;
    }
    if (event.transferAccountId && event.transferAccountId in balances) {
      balances[event.transferAccountId] += event.amount;
    }
    total = 0;
    for (const id of accountIds) total += balances[id] ?? 0;
    points.push({
      date: event.date,
      event,
      totalBalance: total,
      accountBalances: { ...balances },
    });
    if (total < low.balance || (total === low.balance && event.date < low.date)) {
      low = { date: event.date, balance: total };
    }
  }

  const assumptions = [
    'Projection starts from recorded balances at the start date.',
    'Future-dated transactions and unpaid scheduled occurrences are included exactly once.',
    'Transfers move money between accounts and are not counted as income or spending.',
    'Same-day outflows are applied before inflows, so the low point is conservative.',
    'No interest, fees, price changes or unrecorded spending are predicted.',
  ];

  return {
    from,
    to,
    startingBalance,
    endingBalance: total,
    lowPoint: low,
    events,
    points,
    assumptions,
    estimated: true,
  };
}

/** Convenience wrapper used by the dashboard. */
export function projectBalance(input: Omit<ForecastInput, 'to'>, horizonDays = 45): ForecastResult {
  return buildForecast({ ...input, to: addDays(input.from, horizonDays) });
}
