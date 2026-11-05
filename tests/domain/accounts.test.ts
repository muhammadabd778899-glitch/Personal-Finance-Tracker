import {
  accountBalance,
  amountOwed,
  balancesForAccounts,
  isLiability,
  netWorth,
  netSpending,
  periodTotals,
  sortTransactions,
  spendingByCategory,
  totalAssets,
  totalLiabilities,
} from '../../src/domain/accounts';
import { account, category, transaction } from '../fixtures';

const checking = account();
const card = account({
  id: 'acc-card',
  name: 'Credit card',
  type: 'credit',
  openingBalance: 0,
});

describe('accountBalance', () => {
  it('applies income, expenses and both sides of transfers', () => {
    const transactions = [
      transaction({ id: 'a', type: 'income', amount: 5000, categoryId: 'cat-salary' }),
      transaction({ id: 'b', type: 'expense', amount: 1200 }),
      transaction({
        id: 'c',
        type: 'transfer',
        amount: 2000,
        accountId: 'acc-checking',
        transferAccountId: 'acc-card',
        categoryId: undefined,
      }),
    ];
    expect(accountBalance(checking, transactions)).toBe(5000 - 1200 - 2000);
    expect(accountBalance(card, transactions)).toBe(2000);
  });

  it('honours an as-of date and ignores unopened history', () => {
    const transactions = [
      transaction({ id: 'a', amount: 1000, date: '2026-10-01' }),
      transaction({ id: 'b', amount: 2500, date: '2026-11-01' }),
    ];
    expect(accountBalance(checking, transactions, '2026-10-15')).toBe(-1000);
    expect(accountBalance(checking, transactions)).toBe(-3500);
  });

  it('stores liabilities as negative balances and exposes the owed amount', () => {
    const spent = transaction({ amount: 8000, accountId: 'acc-card' });
    const payment = transaction({
      id: 'pay',
      type: 'transfer',
      amount: 3000,
      accountId: 'acc-checking',
      transferAccountId: 'acc-card',
      categoryId: undefined,
    });
    const balance = accountBalance(card, [spent, payment]);
    expect(balance).toBe(-5000);
    expect(amountOwed(card, balance)).toBe(5000);
    expect(amountOwed(checking, 5000)).toBe(0);
    expect(isLiability('credit')).toBe(true);
    expect(isLiability('checking')).toBe(false);
  });
});

describe('portfolio totals', () => {
  it('excludes negative asset balances and counts only debt as liabilities', () => {
    const balances = balancesForAccounts(
      [checking, card],
      [
        transaction({ amount: 12000, type: 'income', categoryId: 'cat-salary' }),
        transaction({ id: 'card-spend', amount: 4000, accountId: 'acc-card' }),
      ],
    );
    expect(totalAssets(balances)).toBe(12000);
    expect(totalLiabilities(balances)).toBe(4000);
    expect(netWorth(balances)).toBe(8000);
  });
});

describe('periodTotals', () => {
  const categories = [
    category({ id: 'cat-groceries', kind: 'expense' }),
    category({ id: 'cat-salary', kind: 'income' }),
  ];

  it('excludes transfers and treats refunds separately from income', () => {
    const totals = periodTotals(
      [
        transaction({ id: 'inc', type: 'income', amount: 200000, categoryId: 'cat-salary' }),
        transaction({ id: 'exp', amount: 30000 }),
        transaction({ id: 'refund', type: 'income', amount: 5000, categoryId: 'cat-groceries' }),
        transaction({
          id: 'move',
          type: 'transfer',
          amount: 10000,
          transferAccountId: 'acc-savings',
          categoryId: undefined,
        }),
      ],
      categories,
      '2026-11-01',
      '2026-11-30',
    );
    expect(totals.income).toBe(200000);
    expect(totals.expenses).toBe(30000);
    expect(totals.refunds).toBe(5000);
    expect(totals.transferVolume).toBe(10000);
    expect(totals.net).toBe(170000);
    expect(netSpending(totals)).toBe(25000);
    expect(totals.transactionCount).toBe(4);
  });

  it('respects inclusive date bounds', () => {
    const totals = periodTotals(
      [
        transaction({ id: 'before', amount: 100, date: '2026-10-31' }),
        transaction({ id: 'first', amount: 200, date: '2026-11-01' }),
        transaction({ id: 'last', amount: 300, date: '2026-11-30' }),
        transaction({ id: 'after', amount: 400, date: '2026-12-01' }),
      ],
      categories,
      '2026-11-01',
      '2026-11-30',
    );
    expect(totals.expenses).toBe(500);
    expect(totals.transactionCount).toBe(2);
  });
});

describe('spendingByCategory', () => {
  const categories = [
    category({ id: 'cat-food', name: 'Food', kind: 'expense' }),
    category({ id: 'cat-groceries', name: 'Groceries', kind: 'expense', parentId: 'cat-food' }),
    category({ id: 'cat-salary', name: 'Salary', kind: 'income' }),
  ];

  it('rolls subcategory spending into the parent and nets refunds', () => {
    const rows = spendingByCategory(
      [
        transaction({ id: 'shop', amount: 6000, categoryId: 'cat-groceries' }),
        transaction({ id: 'refund', type: 'income', amount: 1000, categoryId: 'cat-groceries' }),
        transaction({ id: 'salary', type: 'income', amount: 999999, categoryId: 'cat-salary' }),
        transaction({ id: 'unknown', amount: 500, categoryId: undefined }),
      ],
      categories,
    );
    const food = rows.find((row) => row.categoryId === 'cat-food');
    const uncategorised = rows.find((row) => row.categoryId === null);
    expect(food?.amount).toBe(5000);
    expect(food?.transactionIds).toEqual(['shop', 'refund']);
    expect(uncategorised?.categoryName).toBe('Uncategorized');
    expect(rows.some((row) => row.categoryId === 'cat-salary')).toBe(false);
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(5500);
  });
});

describe('sortTransactions', () => {
  it('sorts by date then creation time without mutating the input', () => {
    const input = [
      transaction({ id: 'b', date: '2026-11-01', createdAt: '2026-11-01T10:00:00.000Z' }),
      transaction({ id: 'a', date: '2026-11-02' }),
      transaction({ id: 'c', date: '2026-11-01', createdAt: '2026-11-01T12:00:00.000Z' }),
    ];
    expect(sortTransactions(input).map((tx) => tx.id)).toEqual(['a', 'c', 'b']);
    expect(sortTransactions(input, 'asc').map((tx) => tx.id)).toEqual(['b', 'c', 'a']);
    expect(input.map((tx) => tx.id)).toEqual(['b', 'a', 'c']);
  });
});
