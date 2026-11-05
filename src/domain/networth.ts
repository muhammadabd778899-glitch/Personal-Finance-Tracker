import { addDays, addMonths, endOfMonth, eachMonth, todayISO } from './dates';
import { accountBalance, isLiability } from './accounts';
import type { Account, DateISO, Transaction } from './types';

export interface NetWorthPoint {
  date: DateISO;
  assets: number;
  liabilities: number;
  net: number;
}

export interface NetWorthSummary {
  assets: number;
  liabilities: number;
  net: number;
  change30Days: number;
  change30DaysPct: number;
  series: NetWorthPoint[];
}

/**
 * Net worth = assets − liabilities, computed from signed account balances.
 * Assets are non-liability accounts with positive balances. Liabilities are the positive
 * amounts owed on credit/loan accounts. Historical points include transactions on or before
 * each month end; accounts are included from their opening date.
 */
export function netWorthAt(
  accounts: Account[],
  transactions: Transaction[],
  date: DateISO,
): { assets: number; liabilities: number; net: number } {
  let assets = 0;
  let liabilities = 0;
  for (const account of accounts) {
    if (account.openingDate > date) continue;
    const balance = accountBalance(account, transactions, date);
    if (isLiability(account.type)) {
      liabilities += Math.max(0, -balance);
    } else {
      assets += Math.max(0, balance);
    }
  }
  return { assets, liabilities, net: assets - liabilities };
}

export function buildNetWorth(
  accounts: Account[],
  transactions: Transaction[],
  months = 12,
  today: DateISO = todayISO(),
): NetWorthSummary {
  const series: NetWorthPoint[] = eachMonth(addMonths(endOfMonth(today), -(months - 1)), today).map(
    (month) => {
      const end = endOfMonth(month);
      const date = end > today ? today : end;
      return { date, ...netWorthAt(accounts, transactions, date) };
    },
  );

  const current = netWorthAt(accounts, transactions, today);
  const pastDate = addDays(today, -30);
  const past = netWorthAt(accounts, transactions, pastDate);
  const change = current.net - past.net;
  return {
    ...current,
    change30Days: change,
    change30DaysPct: past.net !== 0 ? (change / Math.abs(past.net)) * 100 : 0,
    series,
  };
}
