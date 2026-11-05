import { endOfMonth, startOfMonth } from './dates';
import type { Budget, BudgetAllocation, Category, DateISO, Minor, Transaction } from './types';

/**
 * Budget rules:
 * - A monthly budget starts on the first day of `startDate`'s month and ends on the last day
 *   of that month; `startDate` is normalised on save.
 * - A custom budget uses the exact inclusive `startDate`/`endDate` range.
 * - Spending counts expense transactions minus income transactions assigned to an expense
 *   category (a refund). Transfers are never spending.
 * - Spending on a subcategory counts toward its parent allocation.
 * - Allocations are planned amounts; they never affect account balances.
 * - Period rollover is not enabled in v1 (documented limitation).
 */

export interface BudgetBounds {
  start: DateISO;
  end: DateISO;
}

export function budgetBounds(budget: Budget): BudgetBounds {
  if (budget.period === 'monthly') {
    const start = startOfMonth(budget.startDate);
    return { start, end: endOfMonth(start) };
  }
  return { start: budget.startDate, end: budget.endDate };
}

export function normaliseBudget(budget: Budget): Budget {
  if (budget.period !== 'monthly') return budget;
  const start = startOfMonth(budget.startDate);
  return { ...budget, startDate: start, endDate: endOfMonth(start) };
}

export interface AllocationProgress {
  allocation: BudgetAllocation;
  category?: Category;
  budgeted: Minor;
  /** Net spending (refunds subtract). */
  spent: Minor;
  remaining: Minor;
  progress: number;
  transactionIds: string[];
  overspent: boolean;
}

export interface BudgetView {
  budget: Budget;
  bounds: BudgetBounds;
  totalBudgeted: Minor;
  totalSpent: Minor;
  remaining: Minor;
  progress: number;
  allocations: AllocationProgress[];
  /** Net spending in expense categories with no allocation in this budget. */
  unallocatedSpent: Minor;
  unallocatedTransactionIds: string[];
  transactionCount: number;
}

/** Creates the lookup of every category that counts toward a given category. */
function categoryFamilies(categories: Category[]): Map<string, string[]> {
  const families = new Map<string, string[]>();
  for (const category of categories) {
    const root = category.parentId ?? category.id;
    const list = families.get(root) ?? [];
    list.push(category.id);
    families.set(root, list);
  }
  return families;
}

export function buildBudgetView(options: {
  budget: Budget;
  allocations: BudgetAllocation[];
  transactions: Transaction[];
  categories: Category[];
}): BudgetView {
  const { budget, allocations, categories } = options;
  const bounds = budgetBounds(budget);
  const scoped = options.transactions.filter(
    (tx) => tx.date >= bounds.start && tx.date <= bounds.end,
  );
  const families = categoryFamilies(categories);
  const categoryKind = new Map(categories.map((c) => [c.id, c.kind]));

  const spentByCategory = new Map<string, { amount: number; ids: string[] }>();
  for (const tx of scoped) {
    if (!tx.categoryId || tx.type === 'transfer') continue;
    let amount: number;
    if (tx.type === 'expense') {
      amount = tx.amount;
    } else if (categoryKind.get(tx.categoryId) === 'expense') {
      amount = -tx.amount; // refund
    } else {
      continue;
    }
    const bucket = spentByCategory.get(tx.categoryId) ?? { amount: 0, ids: [] };
    bucket.amount += amount;
    bucket.ids.push(tx.id);
    spentByCategory.set(tx.categoryId, bucket);
  }

  const budgetAllocations = allocations.filter((a) => a.budgetId === budget.id);
  const allocatedCategoryIds = new Set<string>();
  const rows: AllocationProgress[] = budgetAllocations.map((allocation) => {
    const family = families.get(allocation.categoryId) ?? [allocation.categoryId];
    family.forEach((id) => allocatedCategoryIds.add(id));
    let spent = 0;
    const ids: string[] = [];
    for (const id of family) {
      const bucket = spentByCategory.get(id);
      if (bucket) {
        spent += bucket.amount;
        ids.push(...bucket.ids);
      }
    }
    const remaining = allocation.amount - spent;
    return {
      allocation,
      category: categories.find((c) => c.id === allocation.categoryId),
      budgeted: allocation.amount,
      spent,
      remaining,
      progress: allocation.amount > 0 ? (spent / allocation.amount) * 100 : spent > 0 ? 100 : 0,
      transactionIds: ids,
      overspent: spent > allocation.amount,
    };
  });

  let unallocatedSpent = 0;
  const unallocatedTransactionIds: string[] = [];
  for (const [categoryId, bucket] of spentByCategory) {
    if (allocatedCategoryIds.has(categoryId)) continue;
    unallocatedSpent += bucket.amount;
    unallocatedTransactionIds.push(...bucket.ids);
  }

  const totalBudgeted = rows.reduce((sum, row) => sum + row.budgeted, 0);
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0);
  return {
    budget,
    bounds,
    totalBudgeted,
    totalSpent,
    remaining: totalBudgeted - totalSpent,
    progress: totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0,
    allocations: rows.sort((a, b) => b.spent - a.spent),
    unallocatedSpent,
    unallocatedTransactionIds,
    transactionCount: new Set([
      ...unallocatedTransactionIds,
      ...rows.flatMap((r) => r.transactionIds),
    ]).size,
  };
}

/** Total planned budget and net spending for a period, used by dashboard summaries. */
export function budgetSummary(
  budgets: Budget[],
  allocations: BudgetAllocation[],
  transactions: Transaction[],
  categories: Category[],
): { budgeted: Minor; spent: Minor; remaining: Minor } {
  const active = budgets.map((budget) =>
    buildBudgetView({ budget, allocations, transactions, categories }),
  );
  return active.reduce(
    (acc, view) => ({
      budgeted: acc.budgeted + view.totalBudgeted,
      spent: acc.spent + view.totalSpent,
      remaining: acc.remaining + view.remaining,
    }),
    { budgeted: 0, spent: 0, remaining: 0 },
  );
}
