import { addDays, endOfMonth, eachMonth, startOfMonth, todayISO } from './dates';
import { netSpending, periodTotals, spendingByCategory } from './accounts';
import { buildBudgetView } from './budgets';
import type { Budget, BudgetAllocation, Category, DateISO, Transaction } from './types';

export interface MonthlyPoint {
  month: DateISO;
  income: number;
  expenses: number;
  net: number;
}

export interface ReportSummary {
  from: DateISO;
  to: DateISO;
  income: number;
  expenses: number;
  refunds: number;
  netSpending: number;
  net: number;
  savingsRate: number;
  averageMonthlySpending: number;
  categories: ReturnType<typeof spendingByCategory>;
  transactions: Transaction[];
  monthly: MonthlyPoint[];
  largestExpenses: Transaction[];
  averageExpense: number;
  transactionCount: number;
}

export function defaultReportRange(today: DateISO = todayISO()): { from: DateISO; to: DateISO } {
  return { from: addDays(startOfMonth(today), -5 * 31 + 1), to: today };
}

export function buildReport(
  transactions: Transaction[],
  categories: Category[],
  from: DateISO,
  to: DateISO,
): ReportSummary {
  const scoped = transactions.filter((tx) => tx.date >= from && tx.date <= to);
  const totals = periodTotals(scoped, categories, from, to);
  const rows = spendingByCategory(scoped, categories, from, to);
  const monthly: MonthlyPoint[] = eachMonth(from, to).map((month) => {
    const monthTotals = periodTotals(scoped, categories, startOfMonth(month), endOfMonth(month));
    const spend = netSpending(monthTotals);
    return {
      month: startOfMonth(month),
      income: monthTotals.income,
      expenses: spend,
      net: monthTotals.income - spend,
    };
  });
  const expenseRows = scoped.filter((tx) => tx.type === 'expense');
  const netSpend = netSpending(totals);
  const months = Math.max(1, monthly.length);

  return {
    from,
    to,
    income: totals.income,
    expenses: totals.expenses,
    refunds: totals.refunds,
    netSpending: netSpend,
    net: totals.income - netSpend,
    savingsRate: totals.income > 0 ? ((totals.income - netSpend) / totals.income) * 100 : 0,
    averageMonthlySpending: Math.round(netSpend / months),
    categories: rows,
    transactions: scoped,
    monthly,
    largestExpenses: [...expenseRows].sort((a, b) => b.amount - a.amount).slice(0, 8),
    averageExpense: expenseRows.length
      ? Math.round(expenseRows.reduce((sum, tx) => sum + tx.amount, 0) / expenseRows.length)
      : 0,
    transactionCount: scoped.length,
  };
}

/** Budget performance for budgets that overlap the reporting window. */
export function budgetPerformance(
  budgets: Budget[],
  allocations: BudgetAllocation[],
  transactions: Transaction[],
  categories: Category[],
  from: DateISO,
  to: DateISO,
): { name: string; budgeted: number; spent: number; remaining: number }[] {
  return budgets
    .map((budget) => buildBudgetView({ budget, allocations, transactions, categories }))
    .filter((view) => view.bounds.end >= from && view.bounds.start <= to)
    .map((view) => ({
      name: view.budget.name,
      budgeted: view.totalBudgeted,
      spent: view.totalSpent,
      remaining: view.remaining,
    }));
}
