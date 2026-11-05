import { addMonths, todayISO } from './dates';
import type { DateISO } from './types';

export type PayoffStrategy = 'snowball' | 'avalanche' | 'custom';

export interface DebtInput {
  accountId: string;
  name: string;
  /** Amount owed, positive. */
  balance: number;
  apr: number;
  minimumPayment: number;
  customOrder?: number;
}

export interface DebtProjection {
  accountId: string;
  name: string;
  startingBalance: number;
  payoffDate: DateISO | null;
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  paidOff: boolean;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  order: DebtInput[];
  monthlyExtra: number;
  months: number;
  totalInterest: number;
  totalPaid: number;
  debtFreeDate: DateISO | null;
  projections: DebtProjection[];
  schedule: { date: DateISO; totalBalance: number }[];
  monthlyStart: DateISO;
  assumptions: string[];
  estimated: true;
}

/**
 * Simulated debt payoff (estimate only):
 * - Interest accrues monthly at APR / 12 on the outstanding balance.
 * - Every debt receives its minimum payment; the extra amount goes to the first debt in
 *   strategy order. When a debt is paid off, its minimum joins the extra pool.
 * - Payments never exceed balance plus accrued interest.
 * - Snowball orders by smallest balance; avalanche by highest APR; custom by explicit order.
 * - No fees, promotional rates, or new borrowing are modelled.
 */
export function buildPayoffPlan(
  debts: DebtInput[],
  strategy: PayoffStrategy,
  monthlyExtra: number,
  startDate: DateISO = todayISO(),
): PayoffPlan {
  const order = sortDebts(debts, strategy);
  const working = order.map((debt) => ({
    ...debt,
    balance: Math.max(0, Math.round(debt.balance)),
    interest: 0,
    paid: 0,
    paidOffAt: null as DateISO | null,
  }));

  const monthlyStart = startOfMonthDate(startDate);
  const schedule: { date: DateISO; totalBalance: number }[] = [];
  let totalInterest = 0;
  let guard = 0;

  while (working.some((debt) => debt.balance > 0) && guard < 1200) {
    guard += 1;
    let pool = Math.max(0, Math.round(monthlyExtra));

    for (const debt of working) {
      if (debt.balance <= 0) continue;
      const monthlyRate = Math.max(0, debt.apr) / 100 / 12;
      const accrued = Math.round(debt.balance * monthlyRate);
      debt.balance += accrued;
      totalInterest += accrued;
      debt.interest += accrued;
    }

    const active = working.filter((debt) => debt.balance > 0);
    // Minimum payments first, so every debt stays current.
    for (const debt of active) {
      const payment = Math.min(debt.balance, Math.max(0, Math.round(debt.minimumPayment)));
      debt.balance -= payment;
      debt.paid += payment;
      if (debt.balance <= 0) debt.paidOffAt = addMonths(monthlyStart, guard);
    }
    pool += active
      .filter((debt) => debt.balance > 0)
      .reduce((sum, debt) => {
        // Roll any unused minimum into the pool when a debt is nearly settled.
        const minimum = Math.max(0, Math.round(debt.minimumPayment));
        const applied = Math.min(minimum, debt.balance + minimum);
        return sum + Math.max(0, minimum - applied);
      }, 0);

    // Apply the extra pool in strategy order.
    for (const debt of working) {
      if (pool <= 0) break;
      if (debt.balance <= 0) continue;
      const payment = Math.min(debt.balance, pool);
      debt.balance -= payment;
      pool -= payment;
      debt.paid += payment;
      if (debt.balance <= 0) debt.paidOffAt = addMonths(monthlyStart, guard);
    }

    const totalBalance = working.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0);
    schedule.push({ date: addMonths(monthlyStart, guard), totalBalance });
  }

  const projections: DebtProjection[] = working.map((debt) => ({
    accountId: debt.accountId,
    name: debt.name,
    startingBalance: Math.max(0, Math.round(debt.balance + debt.paid - debt.interest)), // initial balance
    payoffDate: debt.paidOffAt,
    monthsToPayoff: debt.paidOffAt ? guard : 0,
    totalInterest: debt.interest,
    totalPaid: debt.paid,
    paidOff: debt.balance <= 0,
  }));

  const lastDate = schedule.length ? schedule[schedule.length - 1].date : null;
  const anyUnpaid = working.some((debt) => debt.balance > 0);

  return {
    strategy,
    order,
    monthlyExtra,
    months: guard,
    totalInterest,
    totalPaid: working.reduce((sum, debt) => sum + debt.paid, 0),
    debtFreeDate: !anyUnpaid && lastDate ? lastDate : null,
    projections,
    schedule,
    monthlyStart,
    assumptions: [
      'Estimate only: assumes no new charges, fees or missed payments.',
      'Interest is applied monthly at APR ÷ 12 on the outstanding balance.',
      'Minimum payments continue and roll into the target debt when one is paid off.',
      'Focus debt follows the selected strategy; extra payments apply after minimums.',
    ],
    estimated: true,
  };
}

export function sortDebts(debts: DebtInput[], strategy: PayoffStrategy): DebtInput[] {
  const copy = [...debts];
  if (strategy === 'avalanche') {
    return copy.sort((a, b) => b.apr - a.apr || a.balance - b.balance);
  }
  if (strategy === 'custom') {
    return copy.sort((a, b) => (a.customOrder ?? 0) - (b.customOrder ?? 0));
  }
  return copy.sort((a, b) => a.balance - b.balance || b.apr - a.apr);
}

function startOfMonthDate(date: DateISO): DateISO {
  const [year, month] = date.split('-');
  return `${year}-${month}-01`;
}
