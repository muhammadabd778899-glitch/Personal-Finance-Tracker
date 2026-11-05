import { addDays, addMonths, endOfMonth, startOfMonth, todayISO } from '../domain/dates';
import { db } from './db';
import { nowISO } from '../domain/ids';
import type {
  Account,
  BillPayment,
  Budget,
  BudgetAllocation,
  Category,
  DebtDetail,
  Goal,
  GoalContribution,
  RecurringRule,
  Transaction,
} from '../domain/types';

/**
 * Clearly-labelled sample data for onboarding. Every record id starts with `sample-`, so
 * removal never touches real records. Sample data cannot be loaded over real accounts.
 */

export const SAMPLE_PREFIX = 'sample-';

function sampleId(kind: string, n: number): string {
  return `${SAMPLE_PREFIX}${kind}-${n}`;
}

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 2 ** 32;
    return value / 2 ** 32;
  };
}

export async function hasRealData(): Promise<boolean> {
  const accounts = await db.accounts.toArray();
  return accounts.some((account) => !account.id.startsWith(SAMPLE_PREFIX));
}

export async function hasSampleData(): Promise<boolean> {
  const accounts = await db.accounts.toArray();
  return accounts.some((account) => account.id.startsWith(SAMPLE_PREFIX));
}

export async function loadSampleData(): Promise<{ ok: boolean; reason?: string }> {
  if (await hasRealData()) {
    return { ok: false, reason: 'Sample data can only be added to an empty workspace.' };
  }
  if (await hasSampleData()) {
    return { ok: false, reason: 'Sample data is already loaded.' };
  }

  const now = nowISO();
  const today = todayISO();
  const currentMonth = startOfMonth(today);
  const startMonth = addMonths(currentMonth, -6);
  const rand = seeded(20260415);

  const accounts: Account[] = [
    {
      id: sampleId('account', 1),
      name: 'Everyday Checking',
      type: 'checking',
      currency: 'USD',
      openingBalance: 320000,
      openingDate: startMonth,
      institution: 'Northbank',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('account', 2),
      name: 'High-Yield Savings',
      type: 'savings',
      currency: 'USD',
      openingBalance: 1240000,
      openingDate: startMonth,
      institution: 'Northbank',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('account', 3),
      name: 'Everyday Credit Card',
      type: 'credit',
      currency: 'USD',
      openingBalance: -185000,
      openingDate: startMonth,
      institution: 'Northbank',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('account', 4),
      name: 'Car Loan',
      type: 'loan',
      currency: 'USD',
      openingBalance: -620000,
      openingDate: startMonth,
      institution: 'City Auto Finance',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const parents: { id: string; name: string; color: string }[] = [
    { id: sampleId('cat', 1), name: 'Housing', color: '#1f6f5c' },
    { id: sampleId('cat', 2), name: 'Groceries', color: '#4f7cac' },
    { id: sampleId('cat', 3), name: 'Dining & Cafés', color: '#c07a3e' },
    { id: sampleId('cat', 4), name: 'Transport', color: '#7a6f9b' },
    { id: sampleId('cat', 5), name: 'Utilities', color: '#8a9a5b' },
    { id: sampleId('cat', 6), name: 'Shopping', color: '#b3647a' },
    { id: sampleId('cat', 7), name: 'Health', color: '#4b8f8f' },
    { id: sampleId('cat', 8), name: 'Entertainment', color: '#c9a227' },
    { id: sampleId('cat', 9), name: 'Subscriptions', color: '#6d7f8c' },
    { id: sampleId('cat', 20), name: 'Salary', color: '#2f7d4f' },
    { id: sampleId('cat', 21), name: 'Freelance', color: '#3f7f9f' },
    { id: sampleId('cat', 22), name: 'Other income', color: '#5c8a5c' },
  ];

  const children: { id: string; name: string; parentId: string }[] = [
    { id: sampleId('cat', 10), name: 'Rent', parentId: sampleId('cat', 1) },
    { id: sampleId('cat', 11), name: 'Home internet', parentId: sampleId('cat', 5) },
    { id: sampleId('cat', 12), name: 'Electricity', parentId: sampleId('cat', 5) },
    { id: sampleId('cat', 13), name: 'Fuel', parentId: sampleId('cat', 4) },
    { id: sampleId('cat', 14), name: 'Streaming', parentId: sampleId('cat', 9) },
  ];

  const categories: Category[] = [
    ...parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      kind: (parent.id === sampleId('cat', 20) ||
      parent.id === sampleId('cat', 21) ||
      parent.id === sampleId('cat', 22)
        ? 'income'
        : 'expense') as 'income' | 'expense',
      color: parent.color,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })),
    ...children.map((child) => {
      const parent = parents.find((p) => p.id === child.parentId)!;
      return {
        id: child.id,
        name: child.name,
        kind: 'expense' as const,
        parentId: child.parentId,
        color: parent.color,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
    }),
  ];

  const transactions: Transaction[] = [];
  let txCounter = 0;

  function addTx(
    partial: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'tags'> & {
      tags?: string[];
    },
  ) {
    txCounter += 1;
    transactions.push({
      ...partial,
      id: sampleId('tx', txCounter),
      tags: partial.tags ?? [],
      createdAt: `${partial.date}T09:00:00.000Z`,
      updatedAt: `${partial.date}T09:00:00.000Z`,
    });
  }

  const checking = sampleId('account', 1);
  const savings = sampleId('account', 2);
  const credit = sampleId('account', 3);
  const loan = sampleId('account', 4);

  for (let monthIndex = 0; monthIndex < 7; monthIndex += 1) {
    const month = addMonths(currentMonth, monthIndex - 6);
    const monthStart = startOfMonth(month);
    const inFuture = monthStart > today;
    const lastDay = Number(endOfMonth(month).slice(8, 10));
    const maxDay = inFuture
      ? 0
      : monthStart === currentMonth
        ? Number(today.slice(8, 10))
        : lastDay;
    const day = (n: number) =>
      `${month.slice(0, 8)}${String(Math.min(Math.max(1, n), Math.max(1, maxDay))).padStart(2, '0')}`;

    if (maxDay > 0) {
      addTx({
        type: 'expense',
        amount: 145000,
        date: day(1),
        accountId: checking,
        categoryId: sampleId('cat', 10),
        description: 'Monthly rent',
        payee: 'Maple Court Apartments',
      });
      addTx({
        type: 'income',
        amount: 420000,
        date: day(25),
        accountId: checking,
        categoryId: sampleId('cat', 20),
        description: 'Salary — Northwind Studio',
        payee: 'Northwind Studio',
      });
      addTx({
        type: 'expense',
        amount: 11000 + Math.round(rand() * 4000),
        date: day(12),
        accountId: credit,
        categoryId: sampleId('cat', 12),
        description: 'Electricity bill',
        payee: 'Bright Energy',
      });
      addTx({
        type: 'expense',
        amount: 6999,
        date: day(4),
        accountId: credit,
        categoryId: sampleId('cat', 11),
        description: 'Home internet',
        payee: 'Fibreline',
      });
      for (let i = 0; i < 3; i += 1) {
        addTx({
          type: 'expense',
          amount: 6500 + Math.round(rand() * 7000),
          date: day(5 + Math.floor(rand() * 20)),
          accountId: credit,
          categoryId: sampleId('cat', 2),
          description: 'Grocery run',
          payee: 'Green Market',
        });
      }
      for (let i = 0; i < 2; i += 1) {
        addTx({
          type: 'expense',
          amount: 1500 + Math.round(rand() * 3500),
          date: day(8 + Math.floor(rand() * 18)),
          accountId: checking,
          categoryId: sampleId('cat', 3),
          description: i === 0 ? 'Coffee & lunch' : 'Dinner out',
          payee: i === 0 ? 'Little Fern Café' : 'Noodle House',
        });
      }
      addTx({
        type: 'expense',
        amount: 4500 + Math.round(rand() * 2000),
        date: day(16),
        accountId: checking,
        categoryId: sampleId('cat', 13),
        description: 'Fuel',
        payee: 'Metro Fuel',
      });
      addTx({
        type: 'expense',
        amount: 1549,
        date: day(7),
        accountId: credit,
        categoryId: sampleId('cat', 14),
        description: 'Streaming subscription',
        payee: 'Streamly',
      });
      addTx({
        type: 'expense',
        amount: 1099,
        date: day(14),
        accountId: credit,
        categoryId: sampleId('cat', 14),
        description: 'Music subscription',
        payee: 'TuneBox',
      });
      if (rand() > 0.45) {
        addTx({
          type: 'expense',
          amount: 4000 + Math.round(rand() * 9000),
          date: day(18),
          accountId: credit,
          categoryId: sampleId('cat', 6),
          description: 'Home & clothing shopping',
          payee: 'Oak & Thread',
        });
      }
      addTx({
        type: 'expense',
        amount: 3200,
        date: day(9),
        accountId: checking,
        categoryId: sampleId('cat', 7),
        description: 'Pharmacy',
        payee: 'Well Pharmacy',
      });
      addTx({
        type: 'transfer',
        amount: 30000,
        date: day(26),
        accountId: checking,
        transferAccountId: savings,
        description: 'Transfer to savings',
      });
      addTx({
        type: 'transfer',
        amount: 15000,
        date: day(20),
        accountId: checking,
        transferAccountId: credit,
        description: 'Credit card payment',
      });
      addTx({
        type: 'expense',
        amount: 18500,
        date: day(21),
        accountId: checking,
        categoryId: sampleId('cat', 4),
        description: 'Car loan payment',
        payee: 'City Auto Finance',
      });
      if (monthIndex === 2 || monthIndex === 5) {
        addTx({
          type: 'income',
          amount: 45000,
          date: day(11),
          accountId: checking,
          categoryId: sampleId('cat', 21),
          description: 'Freelance design project',
          payee: 'Bluebird Co.',
        });
      }
      if (monthIndex === 4) {
        addTx({
          type: 'expense',
          amount: 12900,
          date: day(22),
          accountId: credit,
          categoryId: sampleId('cat', 8),
          description: 'Concert tickets',
          payee: 'The Amphitheatre',
        });
      }
      if (monthIndex === 1) {
        addTx({
          type: 'income',
          amount: 12000,
          date: day(19),
          accountId: checking,
          categoryId: sampleId('cat', 22),
          description: 'Tax refund',
          payee: 'Revenue Service',
        });
      }
      if (monthIndex === 3) {
        addTx({
          type: 'income',
          amount: 2500,
          date: day(23),
          accountId: credit,
          categoryId: sampleId('cat', 2),
          description: 'Grocery refund — duplicated charge',
          payee: 'Green Market',
        });
      }
    }
  }

  const thisMonth = startOfMonth(today);
  const budgetSpecs: { name: string; month: string; allocations: [string, number][] }[] = [
    {
      name: 'Monthly essentials',
      month: thisMonth,
      allocations: [
        [sampleId('cat', 1), 145000],
        [sampleId('cat', 2), 45000],
        [sampleId('cat', 3), 18000],
        [sampleId('cat', 5), 22000],
        [sampleId('cat', 4), 22000],
        [sampleId('cat', 6), 30000],
        [sampleId('cat', 7), 12000],
        [sampleId('cat', 8), 15000],
        [sampleId('cat', 9), 5000],
      ],
    },
    {
      name: 'Monthly essentials',
      month: addMonths(thisMonth, -1),
      allocations: [
        [sampleId('cat', 1), 145000],
        [sampleId('cat', 2), 45000],
        [sampleId('cat', 3), 18000],
        [sampleId('cat', 5), 22000],
        [sampleId('cat', 4), 22000],
        [sampleId('cat', 6), 25000],
        [sampleId('cat', 7), 12000],
        [sampleId('cat', 8), 12000],
        [sampleId('cat', 9), 5000],
      ],
    },
  ];

  const budgets: Budget[] = [];
  const allocations: BudgetAllocation[] = [];
  budgetSpecs.forEach((spec, index) => {
    const budget: Budget = {
      id: sampleId('budget', index + 1),
      name: spec.name,
      period: 'monthly',
      startDate: spec.month,
      endDate: endOfMonth(spec.month),
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    };
    budgets.push(budget);
    spec.allocations.forEach(([categoryId, amount], allocationIndex) => {
      allocations.push({
        id: sampleId('allocation', index * 20 + allocationIndex + 1),
        budgetId: budget.id,
        categoryId,
        amount,
      });
    });
  });

  const rules: RecurringRule[] = [
    {
      id: sampleId('rule', 1),
      name: 'Rent',
      kind: 'expense',
      accountId: checking,
      categoryId: sampleId('cat', 10),
      amount: 145000,
      variableAmount: false,
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(thisMonth, -6),
      anchorDay: 1,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('rule', 2),
      name: 'Salary',
      kind: 'income',
      accountId: checking,
      categoryId: sampleId('cat', 20),
      amount: 420000,
      variableAmount: false,
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(thisMonth, -6),
      anchorDay: 25,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('rule', 3),
      name: 'Home internet',
      kind: 'expense',
      accountId: credit,
      categoryId: sampleId('cat', 11),
      amount: 6999,
      variableAmount: false,
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(thisMonth, -6),
      anchorDay: 4,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('rule', 4),
      name: 'Streamly subscription',
      kind: 'expense',
      accountId: credit,
      categoryId: sampleId('cat', 14),
      amount: 1549,
      variableAmount: false,
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(thisMonth, -6),
      anchorDay: 7,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('rule', 5),
      name: 'Car loan payment',
      kind: 'expense',
      accountId: checking,
      categoryId: sampleId('cat', 4),
      amount: 18500,
      variableAmount: false,
      frequency: 'monthly',
      interval: 1,
      startDate: addMonths(thisMonth, -6),
      anchorDay: 21,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('rule', 6),
      name: 'Car insurance',
      kind: 'expense',
      accountId: checking,
      categoryId: sampleId('cat', 4),
      amount: 7800,
      variableAmount: true,
      frequency: 'quarterly',
      interval: 1,
      startDate: addMonths(thisMonth, -5),
      anchorDay: 15,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const payments: BillPayment[] = [];
  // Mark the most recent past occurrences of recurring bills as paid for a realistic history.
  const recent = transactions.filter(
    (tx) => tx.recurringId === undefined && tx.description === 'Monthly rent' && tx.date <= today,
  );
  recent.slice(-1).forEach((tx) => {
    payments.push({
      id: sampleId('payment', 1),
      recurringId: sampleId('rule', 1),
      occurrenceDate: startOfMonth(tx.date),
      status: 'paid',
      amount: tx.amount,
      paidDate: tx.date,
      transactionId: tx.id,
      createdAt: now,
    });
  });

  const goals: Goal[] = [
    {
      id: sampleId('goal', 1),
      name: 'Emergency fund',
      type: 'goal',
      targetAmount: 1000000,
      targetDate: addMonths(today, 10),
      accountId: savings,
      color: '#1f6f5c',
      notes: 'Six months of essential spending.',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('goal', 2),
      name: 'Japan trip',
      type: 'goal',
      targetAmount: 350000,
      targetDate: addMonths(today, 8),
      accountId: savings,
      color: '#c07a3e',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: sampleId('goal', 3),
      name: 'New laptop',
      type: 'sinking',
      targetAmount: 180000,
      accountId: savings,
      color: '#4f7cac',
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const contributions: GoalContribution[] = [];
  for (let i = 0; i < 6; i += 1) {
    const month = addMonths(thisMonth, -5 + i);
    const date = addDays(startOfMonth(month), 2);
    if (date > today) continue;
    contributions.push({
      id: sampleId('contribution', i * 3 + 1),
      goalId: sampleId('goal', 1),
      date,
      amount: 50000,
      accountId: savings,
      note: 'Monthly transfer',
      createdAt: now,
    });
    contributions.push({
      id: sampleId('contribution', i * 3 + 2),
      goalId: sampleId('goal', 2),
      date,
      amount: 15000,
      accountId: savings,
      createdAt: now,
    });
    if (i % 2 === 0) {
      contributions.push({
        id: sampleId('contribution', i * 3 + 3),
        goalId: sampleId('goal', 3),
        date,
        amount: 10000,
        accountId: savings,
        createdAt: now,
      });
    }
  }

  const debts: DebtDetail[] = [
    {
      accountId: credit,
      apr: 22.99,
      minimumPayment: 6500,
      dueDay: 20,
      originalBalance: 300000,
      updatedAt: now,
    },
    {
      accountId: loan,
      apr: 8.5,
      minimumPayment: 18500,
      dueDay: 21,
      originalBalance: 900000,
      updatedAt: now,
    },
  ];

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.allocations,
      db.recurring,
      db.payments,
      db.goals,
      db.contributions,
      db.debts,
      db.settings,
    ],
    async () => {
      await db.accounts.bulkAdd(accounts);
      await db.categories.bulkAdd(categories);
      await db.transactions.bulkAdd(transactions);
      await db.budgets.bulkAdd(budgets);
      await db.allocations.bulkAdd(allocations);
      await db.recurring.bulkAdd(rules);
      await db.payments.bulkAdd(payments);
      await db.goals.bulkAdd(goals);
      await db.contributions.bulkAdd(contributions);
      await db.debts.bulkAdd(debts);
      await db.settings.update('app', { sampleDataLoaded: true, updatedAt: now });
    },
  );

  return { ok: true };
}

/** Removes only records whose ids start with the sample prefix. */
export async function removeSampleData(): Promise<number> {
  let removed = 0;
  const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);
  await db.transaction(
    'rw',
    [
      db.accounts,
      db.categories,
      db.transactions,
      db.budgets,
      db.allocations,
      db.recurring,
      db.exceptions,
      db.payments,
      db.goals,
      db.contributions,
      db.debts,
      db.settings,
    ],
    async () => {
      const removeFrom = async <T extends { id: string }>(table: {
        toArray: () => Promise<T[]>;
        bulkDelete: (keys: string[]) => Promise<void>;
      }) => {
        const rows = await table.toArray();
        const ids = rows.filter((row) => isSample(row.id)).map((row) => row.id);
        if (ids.length) await table.bulkDelete(ids);
        removed += ids.length;
      };
      await removeFrom(db.accounts);
      await removeFrom(db.categories);
      await removeFrom(db.transactions);
      await removeFrom(db.budgets);
      await removeFrom(db.allocations);
      await removeFrom(db.recurring);
      await removeFrom(db.exceptions);
      await removeFrom(db.payments);
      await removeFrom(db.goals);
      await removeFrom(db.contributions);
      const debtRows = await db.debts.toArray();
      const debtIds = debtRows.filter((row) => isSample(row.accountId)).map((row) => row.accountId);
      if (debtIds.length) await db.debts.bulkDelete(debtIds);
      removed += debtIds.length;
      await db.settings.update('app', { sampleDataLoaded: false, updatedAt: nowISO() });
    },
  );
  return removed;
}

export function sampleTransactionId(): string {
  return sampleId('tx', 0);
}
