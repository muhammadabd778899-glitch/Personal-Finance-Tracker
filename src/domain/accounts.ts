import { compareDates } from './dates';
import type { Account, Minor, Transaction } from './types';
import { LIABILITY_ACCOUNT_TYPES } from './types';

/**
 * Balance rules (single source of truth):
 *
 * - asset account:   balance = opening + income − expense − transferOut + transferIn
 * - liability account: same arithmetic, but balances are stored negative (money owed).
 *   A purchase on a credit card is an expense, making the balance more negative. A payment
 *   is a transfer to the liability account, making the balance less negative.
 * - Transfers never affect income or expense totals. They debit the source and credit the
 *   destination with the same amount.
 */

export type TransactionLike = Pick<
  Transaction,
  'type' | 'amount' | 'date' | 'accountId' | 'transferAccountId'
>;

export function isLiability(type: Account['type']): boolean {
  return LIABILITY_ACCOUNT_TYPES.includes(type);
}

/** Positive amount owed for a liability account (0 for assets). */
export function amountOwed(account: Account, balance: Minor): Minor {
  return isLiability(account.type) ? Math.max(0, -balance) : 0;
}

export function accountBalance(
  account: Account,
  transactions: TransactionLike[],
  asOf?: string,
): Minor {
  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (asOf && tx.date > asOf) continue;
    if (tx.type === 'transfer') {
      if (tx.accountId === account.id) balance -= tx.amount;
      if (tx.transferAccountId === account.id) balance += tx.amount;
      continue;
    }
    if (tx.accountId !== account.id) continue;
    balance += tx.type === 'income' ? tx.amount : -tx.amount;
  }
  return balance;
}

export interface AccountBalance {
  account: Account;
  balance: Minor;
  owed: Minor;
  transactionCount: number;
}

export function balancesForAccounts(
  accounts: Account[],
  transactions: TransactionLike[],
  asOf?: string,
): AccountBalance[] {
  return accounts.map((account) => {
    const relevant = transactions.filter(
      (tx) =>
        (!asOf || tx.date <= asOf) &&
        (tx.accountId === account.id || tx.transferAccountId === account.id),
    );
    const balance = accountBalance(account, transactions, asOf);
    return {
      account,
      balance,
      owed: amountOwed(account, balance),
      transactionCount: relevant.length,
    };
  });
}

export function totalAssets(balances: AccountBalance[]): Minor {
  return balances
    .filter((b) => !isLiability(b.account.type))
    .reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
}

export function totalLiabilities(balances: AccountBalance[]): Minor {
  return balances
    .filter((b) => isLiability(b.account.type))
    .reduce((sum, b) => sum + Math.max(0, -b.balance), 0);
}

export function netWorth(balances: AccountBalance[]): Minor {
  return balances.reduce((sum, b) => sum + b.balance, 0);
}

export interface PeriodTotals {
  income: Minor;
  expenses: Minor;
  /** Income minus expenses. Transfers excluded. */
  net: Minor;
  /** Expenses refunded by income transactions assigned to expense categories. */
  refunds: Minor;
  transferVolume: Minor;
  transactionCount: number;
}

export function periodTotals(
  transactions: Transaction[],
  categories: { id: string; kind: 'expense' | 'income' }[],
  from?: string,
  to?: string,
): PeriodTotals {
  const categoryKind = new Map(categories.map((c) => [c.id, c.kind]));
  const totals: PeriodTotals = {
    income: 0,
    expenses: 0,
    net: 0,
    refunds: 0,
    transferVolume: 0,
    transactionCount: 0,
  };
  for (const tx of transactions) {
    if (from && tx.date < from) continue;
    if (to && tx.date > to) continue;
    totals.transactionCount += 1;
    if (tx.type === 'transfer') {
      totals.transferVolume += tx.amount;
      continue;
    }
    if (tx.type === 'income') {
      const kind = tx.categoryId ? categoryKind.get(tx.categoryId) : undefined;
      if (kind === 'expense') {
        totals.refunds += tx.amount;
      } else {
        totals.income += tx.amount;
      }
      continue;
    }
    totals.expenses += tx.amount;
  }
  totals.net = totals.income - totals.expenses;
  return totals;
}

/** Spending total used by reports: expenses minus refunds assigned to expense categories. */
export function netSpending(totals: PeriodTotals): Minor {
  return totals.expenses - totals.refunds;
}

export interface CategorySpending {
  categoryId: string | null;
  categoryName: string;
  parentId?: string;
  color?: string;
  amount: Minor;
  share: number;
  transactionIds: string[];
}

export function spendingByCategory(
  transactions: Transaction[],
  categories: {
    id: string;
    name: string;
    kind: 'expense' | 'income';
    parentId?: string;
    color?: string;
  }[],
  from?: string,
  to?: string,
): CategorySpending[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, { amount: number; ids: string[] }>();

  for (const tx of transactions) {
    if (from && tx.date < from) continue;
    if (to && tx.date > to) continue;
    if (tx.type === 'transfer') continue;

    let categoryId: string | null = tx.categoryId ?? null;
    let amount: number;
    if (tx.type === 'expense') {
      amount = tx.amount;
    } else {
      const kind = categoryId ? byId.get(categoryId)?.kind : undefined;
      if (kind !== 'expense') continue; // genuine income, not a refund
      amount = -tx.amount;
    }

    // Roll subcategory spending up into the parent for reporting groups.
    const category = categoryId ? byId.get(categoryId) : undefined;
    if (category?.parentId) categoryId = category.parentId;

    const key = categoryId ?? '__uncategorized__';
    const bucket = buckets.get(key) ?? { amount: 0, ids: [] };
    bucket.amount += amount;
    bucket.ids.push(tx.id);
    buckets.set(key, bucket);
  }

  const total = [...buckets.values()].reduce((sum, b) => sum + b.amount, 0);
  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const category = key === '__uncategorized__' ? undefined : byId.get(key);
      return {
        categoryId: key === '__uncategorized__' ? null : key,
        categoryName: category?.name ?? 'Uncategorized',
        parentId: category?.parentId,
        color: category?.color,
        amount: bucket.amount,
        share: total > 0 ? (bucket.amount / total) * 100 : 0,
        transactionIds: bucket.ids,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function sortTransactions(transactions: Transaction[], direction: 'asc' | 'desc' = 'desc') {
  return [...transactions].sort((a, b) => {
    const byDate = compareDates(a.date, b.date);
    if (byDate !== 0) return direction === 'asc' ? byDate : -byDate;
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    return direction === 'asc' ? byCreated : -byCreated;
  });
}
