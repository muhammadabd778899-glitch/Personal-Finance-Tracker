import {
  goalProgress,
  requiredMonthlyContribution,
  totalGoalSavings,
} from '../../src/domain/goals';
import { buildNetWorth, netWorthAt } from '../../src/domain/networth';
import type { Goal, GoalContribution } from '../../src/domain/types';
import { account, transaction } from '../fixtures';

const holiday: Goal = {
  id: 'goal-holiday',
  name: 'Holiday fund',
  type: 'goal',
  targetAmount: 200000,
  targetDate: '2027-06-01',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function contribution(overrides: Partial<GoalContribution>): GoalContribution {
  return {
    id: 'c1',
    goalId: holiday.id,
    date: '2026-10-01',
    amount: 50000,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('goalProgress', () => {
  it('nets withdrawals and reports contribution totals separately', () => {
    const progress = goalProgress(holiday, [
      contribution({ id: 'c1', amount: 60000 }),
      contribution({ id: 'c2', amount: -10000, date: '2026-11-01' }),
      contribution({ id: 'other', goalId: 'goal-other', amount: 999999 }),
    ]);
    expect(progress.balance).toBe(50000);
    expect(progress.contributed).toBe(60000);
    expect(progress.remaining).toBe(150000);
    expect(progress.progress).toBe(25);
    expect(progress.lastContribution).toBe('2026-11-01');
    expect(progress.contributionCount).toBe(2);
  });

  it('never reports negative remaining and counts only active goals in totals', () => {
    const progress = goalProgress(holiday, [contribution({ amount: 250000 })]);
    expect(progress.remaining).toBe(0);
    expect(progress.progress).toBe(125);
    expect(progress.goal.id).toBe('goal-holiday');
    expect(
      totalGoalSavings(
        [holiday, { ...holiday, id: 'archived', archived: true }],
        [
          contribution({ amount: 10000 }),
          contribution({ id: 'c3', goalId: 'archived', amount: 900 }),
        ],
      ),
    ).toBe(10000);
  });

  it('estimates a monthly contribution from the remaining amount and months', () => {
    expect(
      requiredMonthlyContribution(
        { ...holiday, targetDate: '2027-01-01' },
        [contribution({ amount: 50000 })],
        '2026-11-01',
      ),
    ).toBe(50000);
    expect(
      requiredMonthlyContribution({ ...holiday, targetDate: '2026-01-01' }, [], '2026-11-01'),
    ).toBe(200000);
    expect(
      requiredMonthlyContribution({ ...holiday, targetDate: undefined }, [], '2026-11-01'),
    ).toBe(null);
  });
});

describe('net worth', () => {
  const checking = account({ openingBalance: 100000 });
  const savings = account({
    id: 'acc-savings',
    name: 'Savings',
    type: 'savings',
    openingBalance: 50000,
  });
  const card = account({ id: 'acc-card', name: 'Card', type: 'credit' });

  const transactions = [
    transaction({ id: 'spend', amount: 20000, date: '2026-10-10' }),
    transaction({ id: 'card-spend', amount: 10000, date: '2026-10-12', accountId: 'acc-card' }),
    transaction({
      id: 'pay-card',
      type: 'transfer',
      amount: 4000,
      date: '2026-10-20',
      accountId: 'acc-checking',
      transferAccountId: 'acc-card',
      categoryId: undefined,
    }),
  ];

  it('computes assets, liabilities and net for a date', () => {
    expect(netWorthAt([checking, savings, card], transactions, '2026-10-31')).toEqual({
      assets: 100000 - 20000 - 4000 + 50000,
      liabilities: 6000,
      net: 120000,
    });
    expect(netWorthAt([checking], transactions, '2025-12-31')).toEqual({
      assets: 0,
      liabilities: 0,
      net: 0,
    });
  });

  it('builds a 12 point monthly series ending today', () => {
    const summary = buildNetWorth([checking, savings, card], transactions, 12, '2026-11-05');
    expect(summary.series).toHaveLength(12);
    expect(summary.series[summary.series.length - 1].date).toBe('2026-11-05');
    expect(summary.net).toBe(120000);
    expect(summary.assets).toBe(126000);
    expect(summary.liabilities).toBe(6000);
    expect(summary.change30Days).toBeDefined();
    expect(Number.isFinite(summary.change30DaysPct)).toBe(true);
  });
});
