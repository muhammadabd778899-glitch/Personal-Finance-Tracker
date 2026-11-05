import { addDays, compareDates, startOfMonth } from './dates';
import { spendingByCategory } from './accounts';
import { scheduleOccurrences } from './recurrence';
import type {
  BillPayment,
  Category,
  DateISO,
  Goal,
  GoalContribution,
  RecurrenceException,
  RecurringRule,
  Transaction,
} from './types';

export type PulseTone = 'positive' | 'negative' | 'warning' | 'neutral';

export type PulseCategory = 'spending' | 'income' | 'bills' | 'goals' | 'debt' | 'cashflow';

export interface PulseInsight {
  id: string;
  category: PulseCategory;
  tone: PulseTone;
  title: string;
  detail: string;
  transactionIds?: string[];
  goalIds?: string[];
  recurringIds?: string[];
  /** In-app route to the records behind the insight. */
  link?: string;
}

export interface PulseInput {
  today: DateISO;
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringRule[];
  exceptions: RecurrenceException[];
  payments: BillPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  debtChange: number;
  projectedLow: { date: DateISO; balance: number };
  currencyFormat: (minor: number) => string;
}

interface PeriodSummary {
  spending: number;
  income: number;
  byCategory: Map<string, { amount: number; ids: string[] }>;
  transactions: Transaction[];
}

function summarize(input: PulseInput, from: DateISO, to: DateISO): PeriodSummary {
  const scoped = input.transactions.filter((tx) => tx.date >= from && tx.date <= to);
  const rows = spendingByCategory(scoped, input.categories);
  const byCategory = new Map<string, { amount: number; ids: string[] }>();
  for (const row of rows) {
    if (row.categoryId === null) continue;
    byCategory.set(row.categoryId, { amount: row.amount, ids: row.transactionIds });
  }
  let income = 0;
  for (const tx of scoped) {
    if (tx.type === 'transfer') continue;
    if (tx.type === 'income') {
      const category = input.categories.find((c) => c.id === tx.categoryId);
      if (category?.kind !== 'expense') income += tx.amount;
    }
  }
  const spending = rows.reduce((sum, row) => sum + row.amount, 0);
  return { spending, income, byCategory, transactions: scoped };
}

/**
 * Financial Pulse: deterministic, local insights comparing two equal 30-day periods.
 * No AI advice and no opaque score. Every insight names the records behind it.
 */
export function buildPulse(input: PulseInput): PulseInsight[] {
  const format = input.currencyFormat;
  const currentFrom = addDays(input.today, -29);
  const currentTo = input.today;
  const previousTo = addDays(currentFrom, -1);
  const previousFrom = addDays(previousTo, -29);

  const current = summarize(input, currentFrom, currentTo);
  const previous = summarize(input, previousFrom, previousTo);
  const insights: PulseInsight[] = [];

  const spendingDelta = current.spending - previous.spending;
  if (current.spending > 0 || previous.spending > 0) {
    const direction = spendingDelta > 0 ? 'increased' : 'decreased';
    const pct = previous.spending > 0 ? Math.abs(spendingDelta / previous.spending) * 100 : null;
    insights.push({
      id: 'spending-total',
      category: 'spending',
      tone: spendingDelta > 0 ? 'negative' : spendingDelta < 0 ? 'positive' : 'neutral',
      title: `Spending ${direction}${pct ? ` ${pct.toFixed(0)}%` : ''}`,
      detail: `${format(current.spending)} in the last 30 days vs ${format(previous.spending)} in the previous 30 days.`,
      transactionIds: current.transactions.map((tx) => tx.id),
      link: `/transactions?from=${currentFrom}&to=${currentTo}`,
    });
  }

  const movers = [...current.byCategory.entries()]
    .map(([categoryId, bucket]) => {
      const before = previous.byCategory.get(categoryId)?.amount ?? 0;
      return {
        categoryId,
        amount: bucket.amount,
        delta: bucket.amount - before,
        ids: bucket.ids,
      };
    })
    .filter((mover) => Math.abs(mover.delta) > 0 && mover.amount > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  for (const mover of movers) {
    const category = input.categories.find((c) => c.id === mover.categoryId);
    const before = mover.amount - mover.delta;
    insights.push({
      id: `spending-${mover.categoryId}`,
      category: 'spending',
      tone: mover.delta > 0 ? 'warning' : 'positive',
      title: `${category?.name ?? 'Category'} ${mover.delta > 0 ? 'up' : 'down'} ${format(Math.abs(mover.delta))}`,
      detail: `${format(mover.amount)} this period vs ${format(before)} last period.`,
      transactionIds: mover.ids,
      link: `/reports?category=${mover.categoryId}`,
    });
  }

  if (current.income > 0 || previous.income > 0) {
    const delta = current.income - previous.income;
    insights.push({
      id: 'income-total',
      category: 'income',
      tone: delta >= 0 ? 'positive' : 'warning',
      title: delta >= 0 ? 'Income held steady or grew' : 'Income was lower this period',
      detail: `${format(current.income)} received in the last 30 days vs ${format(previous.income)} previously.`,
      link: `/transactions?type=income&from=${currentFrom}&to=${currentTo}`,
    });
  }

  const upcoming = scheduleOccurrences({
    rules: input.recurring,
    exceptions: input.exceptions,
    payments: input.payments,
    from: input.today,
    to: addDays(input.today, 30),
    today: input.today,
  }).filter((o) => o.status === 'unpaid' || o.status === 'overdue');

  const billTotal = upcoming
    .filter((o) => o.kind === 'expense')
    .reduce((sum, o) => sum + o.amount, 0);
  if (upcoming.length > 0) {
    const overdue = upcoming.filter((o) => o.status === 'overdue').length;
    insights.push({
      id: 'bills-upcoming',
      category: 'bills',
      tone: overdue > 0 ? 'warning' : 'neutral',
      title: `${upcoming.length} upcoming commitments`,
      detail: `${format(billTotal)} in scheduled bills and subscriptions over the next 30 days${overdue ? `, including ${overdue} overdue` : ''}.`,
      recurringIds: [...new Set(upcoming.map((o) => o.recurringId))],
      link: `/bills?from=${input.today}&to=${addDays(input.today, 30)}`,
    });
  }

  const goalDelta = input.contributions
    .filter((c) => c.date >= currentFrom && c.date <= currentTo)
    .reduce((sum, c) => sum + c.amount, 0);
  if (goalDelta !== 0) {
    insights.push({
      id: 'goals-progress',
      category: 'goals',
      tone: goalDelta > 0 ? 'positive' : 'warning',
      title: goalDelta > 0 ? 'Savings goals progressed' : 'Savings goals were drawn down',
      detail: `${goalDelta > 0 ? 'Added' : 'Withdrew'} ${format(Math.abs(goalDelta))} across savings goals in the last 30 days.`,
      goalIds: [
        ...new Set(input.contributions.filter((c) => c.date >= currentFrom).map((c) => c.goalId)),
      ],
      link: '/goals',
    });
  }

  if (input.debtChange !== 0) {
    insights.push({
      id: 'debt-change',
      category: 'debt',
      tone: input.debtChange < 0 ? 'positive' : 'warning',
      title:
        input.debtChange < 0
          ? `Debt reduced by ${format(Math.abs(input.debtChange))}`
          : `Debt increased by ${format(input.debtChange)}`,
      detail: 'Compared with the same date 30 days ago, based on recorded payments and charges.',
      link: '/debt',
    });
  }

  if (input.projectedLow.balance < 0) {
    insights.push({
      id: 'cashflow-low',
      category: 'cashflow',
      tone: 'warning',
      title: 'Projected shortfall ahead',
      detail: `The projected balance reaches ${format(input.projectedLow.balance)} around ${input.projectedLow.date}. Review planned bills and transactions.`,
      link: '/bills',
    });
  } else if (input.projectedLow.balance > 0 && input.projectedLow.date > input.today) {
    insights.push({
      id: 'cashflow-low',
      category: 'cashflow',
      tone: 'neutral',
      title: 'Lowest projected balance ahead',
      detail: `${format(input.projectedLow.balance)} around ${input.projectedLow.date}, based on recorded plans.`,
      link: '/bills',
    });
  }

  return insights.slice(0, 8);
}

export function periodLabel(from: DateISO, to: DateISO): string {
  return `${from} → ${to}`;
}

export { compareDates, startOfMonth };
