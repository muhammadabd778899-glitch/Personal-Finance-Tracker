import {
  budgetBounds,
  budgetSummary,
  buildBudgetView,
  normaliseBudget,
} from '../../src/domain/budgets';
import { allocation, budget, category, transaction } from '../fixtures';

const groceries = category({
  id: 'cat-groceries',
  name: 'Groceries',
  kind: 'expense',
  parentId: 'cat-food',
});
const dining = category({
  id: 'cat-dining',
  name: 'Dining',
  kind: 'expense',
  parentId: 'cat-food',
});
const food = category({ id: 'cat-food', name: 'Food', kind: 'expense' });
const other = category({ id: 'cat-other', name: 'Other', kind: 'expense' });
const salary = category({ id: 'cat-salary', name: 'Salary', kind: 'income' });

const categories = [groceries, dining, food, other, salary];

describe('budget bounds', () => {
  it('normalises monthly budgets to the whole calendar month', () => {
    const view = normaliseBudget(budget({ startDate: '2026-11-17', endDate: '2026-11-18' }));
    expect(view.startDate).toBe('2026-11-01');
    expect(view.endDate).toBe('2026-11-30');
    expect(budgetBounds(view)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('keeps custom ranges exactly as entered', () => {
    const custom = budget({ period: 'custom', startDate: '2026-03-05', endDate: '2026-04-10' });
    expect(normaliseBudget(custom)).toBe(custom);
    expect(budgetBounds(custom)).toEqual({ start: '2026-03-05', end: '2026-04-10' });
  });
});

describe('buildBudgetView', () => {
  const allocations = [
    allocation({ id: 'alloc-groceries', categoryId: 'cat-groceries', amount: 40000 }),
    allocation({ id: 'alloc-dining', categoryId: 'cat-dining', amount: 15000 }),
  ];

  it('nets refunds, counts child categories and leaves unallocated spending visible', () => {
    const view = buildBudgetView({
      budget: budget(),
      allocations,
      categories,
      transactions: [
        transaction({ id: 'shop', amount: 22000, date: '2026-11-02' }),
        transaction({ id: 'meal', amount: 18000, categoryId: 'cat-dining' }),
        transaction({ id: 'refund', type: 'income', amount: 2000, categoryId: 'cat-groceries' }),
        transaction({ id: 'salary', type: 'income', amount: 500000, categoryId: 'cat-salary' }),
        transaction({ id: 'other', amount: 7000, categoryId: 'cat-other' }),
        transaction({
          id: 'transfer',
          type: 'transfer',
          amount: 50000,
          categoryId: undefined,
          transferAccountId: 'acc-savings',
        }),
        transaction({ id: 'outside', amount: 99999, date: '2026-12-01' }),
      ],
    });

    expect(view.bounds).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(view.totalBudgeted).toBe(55000);
    expect(view.totalSpent).toBe(38000);
    expect(view.remaining).toBe(17000);
    expect(view.allocations.map((row) => row.allocation.id)).toEqual([
      'alloc-groceries',
      'alloc-dining',
    ]);
    const groceryRow = view.allocations.find((row) => row.category?.id === 'cat-groceries');
    expect(groceryRow?.spent).toBe(20000);
    expect(groceryRow?.transactionIds).toEqual(['shop', 'refund']);
    expect(groceryRow?.overspent).toBe(false);
    const diningRow = view.allocations.find((row) => row.category?.id === 'cat-dining');
    expect(diningRow?.overspent).toBe(true);
    expect(view.unallocatedSpent).toBe(7000);
    expect(view.transactionCount).toBe(4);
  });

  it('rolls child category spending into a parent allocation', () => {
    const view = buildBudgetView({
      budget: budget(),
      allocations: [allocation({ id: 'alloc-food', categoryId: 'cat-food', amount: 30000 })],
      categories,
      transactions: [
        transaction({ id: 'shop', amount: 12000, categoryId: 'cat-groceries' }),
        transaction({ id: 'meal', amount: 10000, categoryId: 'cat-dining' }),
      ],
    });
    expect(view.allocations[0].spent).toBe(22000);
    expect(view.allocations[0].remaining).toBe(8000);
    expect(view.unallocatedSpent).toBe(0);
  });

  it('reports zero progress for unused allocations', () => {
    const view = buildBudgetView({
      budget: budget(),
      allocations: [allocation({ amount: 0 })],
      categories,
      transactions: [],
    });
    expect(view.progress).toBe(0);
    expect(view.allocations[0].progress).toBe(0);
    expect(view.remaining).toBe(0);
  });
});

describe('budgetSummary', () => {
  it('adds planned and spent amounts across budgets', () => {
    const summary = budgetSummary(
      [budget({ id: 'b1' }), budget({ id: 'b2', startDate: '2026-12-01' })],
      [
        allocation({ id: 'a1', budgetId: 'b1', amount: 10000 }),
        allocation({ id: 'a2', budgetId: 'b2', amount: 20000 }),
      ],
      [
        transaction({ id: 'one', amount: 4000 }),
        transaction({ id: 'two', amount: 3000, date: '2026-12-02' }),
      ],
      categories,
    );
    expect(summary.budgeted).toBe(30000);
    expect(summary.spent).toBe(7000);
    expect(summary.remaining).toBe(23000);
  });
});
