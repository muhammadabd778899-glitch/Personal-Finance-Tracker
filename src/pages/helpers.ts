import { endOfMonth, startOfMonth } from '../domain/dates';
import type { Account, Category, Transaction } from '../domain/types';

export function accountName(accounts: Account[], id?: string): string {
  return accounts.find((account) => account.id === id)?.name ?? 'Missing account';
}

export function categoryName(categories: Category[], id?: string): string {
  if (!id) return 'Uncategorized';
  const category = categories.find((c) => c.id === id);
  if (!category) return 'Missing category';
  if (category.parentId) {
    const parent = categories.find((c) => c.id === category.parentId);
    return parent ? `${parent.name} › ${category.name}` : category.name;
  }
  return category.name;
}

export function accountById(accounts: Account[], id?: string): Account | undefined {
  return accounts.find((account) => account.id === id);
}

export const TX_TYPE_LABEL: Record<Transaction['type'], string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

export function signedAmount(tx: Transaction): number {
  if (tx.type === 'income') return tx.amount;
  if (tx.type === 'expense') return -tx.amount;
  return -tx.amount;
}

export function currentMonthBounds(today: string): { start: string; end: string } {
  return { start: startOfMonth(today), end: endOfMonth(today) };
}

export function accountTypeLabel(type: Account['type']): string {
  const labels: Record<Account['type'], string> = {
    checking: 'Checking',
    savings: 'Savings',
    cash: 'Cash',
    credit: 'Credit card',
    loan: 'Loan',
    investment: 'Investment',
    other: 'Other',
  };
  return labels[type];
}

export function goalTypeLabel(type: 'goal' | 'sinking'): string {
  return type === 'goal' ? 'Savings goal' : 'Sinking fund';
}
