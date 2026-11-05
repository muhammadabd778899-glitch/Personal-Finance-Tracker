import { buildForecast, projectBalance, type ForecastOccurrence } from '../../src/domain/forecast';
import { transaction } from '../fixtures';

const occurrences: ForecastOccurrence[] = [
  {
    id: 'occ-rent',
    date: '2026-11-15',
    name: 'Rent',
    amount: 150000,
    kind: 'expense',
    accountId: 'acc-checking',
    recurringId: 'rule-rent',
    originalDate: '2026-11-15',
  },
  {
    id: 'occ-pay',
    date: '2026-11-20',
    name: 'Salary',
    amount: 300000,
    kind: 'income',
    accountId: 'acc-checking',
    recurringId: 'rule-pay',
    originalDate: '2026-11-20',
  },
];

describe('buildForecast', () => {
  it('projects future transactions and unpaid occurrences from actual starting balances', () => {
    const result = buildForecast({
      from: '2026-11-01',
      to: '2026-11-30',
      startingBalances: { 'acc-checking': 200000 },
      accountIds: ['acc-checking'],
      transactions: [
        transaction({ id: 'future', type: 'expense', amount: 25000, date: '2026-11-05' }),
        transaction({ id: 'past', type: 'expense', amount: 999999, date: '2026-10-01' }),
      ],
      occurrences,
    });

    expect(result.startingBalance).toBe(200000);
    expect(result.endingBalance).toBe(200000 - 25000 - 150000 + 300000);
    expect(result.events.map((event) => event.id)).toEqual([
      'tx:future',
      'occ:occ-rent',
      'occ:occ-pay',
    ]);
    expect(result.lowPoint).toEqual({ date: '2026-11-15', balance: 25000 });
    expect(result.points).toHaveLength(4);
    expect(result.estimated).toBe(true);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('applies same-day outflows before inflows for a conservative low point', () => {
    const result = buildForecast({
      from: '2026-11-01',
      to: '2026-11-30',
      startingBalances: { 'acc-checking': 10000 },
      accountIds: ['acc-checking'],
      transactions: [
        transaction({ id: 'in', type: 'income', amount: 5000, date: '2026-11-10' }),
        transaction({ id: 'out', type: 'expense', amount: 12000, date: '2026-11-10' }),
      ],
      occurrences: [],
    });
    expect(result.events.map((event) => event.id)).toEqual(['tx:out', 'tx:in']);
    expect(result.lowPoint.balance).toBe(-2000);
    expect(result.endingBalance).toBe(3000);
  });

  it('moves transfers between tracked accounts without changing total cash', () => {
    const result = buildForecast({
      from: '2026-11-01',
      to: '2026-11-30',
      startingBalances: { 'acc-checking': 50000, 'acc-savings': 100000 },
      accountIds: ['acc-checking', 'acc-savings'],
      transactions: [
        transaction({
          id: 'move',
          type: 'transfer',
          amount: 20000,
          date: '2026-11-07',
          transferAccountId: 'acc-savings',
          categoryId: undefined,
        }),
      ],
      occurrences: [],
    });
    expect(result.endingBalance).toBe(150000);
    const last = result.points[result.points.length - 1];
    expect(last.accountBalances['acc-checking']).toBe(30000);
    expect(last.accountBalances['acc-savings']).toBe(120000);
  });

  it('ignores occurrences for accounts outside the forecast', () => {
    const result = buildForecast({
      from: '2026-11-01',
      to: '2026-11-30',
      startingBalances: { 'acc-savings': 10000 },
      accountIds: ['acc-savings'],
      transactions: [],
      occurrences: [{ ...occurrences[0], accountId: 'acc-checking' }],
    });
    expect(result.events).toEqual([]);
    expect(result.endingBalance).toBe(10000);
  });

  it('defaults projectBalance to a 45 day horizon', () => {
    const result = projectBalance({
      from: '2026-11-01',
      startingBalances: {},
      accountIds: ['acc-checking'],
      transactions: [],
      occurrences: [],
    });
    expect(result.to).toBe('2026-12-16');
  });
});
