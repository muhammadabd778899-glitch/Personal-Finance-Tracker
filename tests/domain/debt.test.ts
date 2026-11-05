import { buildPayoffPlan, sortDebts, type DebtInput } from '../../src/domain/debt';

const debts: DebtInput[] = [
  { accountId: 'card', name: 'Credit card', balance: 120000, apr: 22.99, minimumPayment: 5000 },
  { accountId: 'car', name: 'Car loan', balance: 800000, apr: 6.5, minimumPayment: 25000 },
  { accountId: 'store', name: 'Store card', balance: 60000, apr: 14, minimumPayment: 4000 },
];

describe('sortDebts', () => {
  it('orders by balance for snowball and by APR for avalanche', () => {
    expect(sortDebts(debts, 'snowball').map((debt) => debt.accountId)).toEqual([
      'store',
      'card',
      'car',
    ]);
    expect(sortDebts(debts, 'avalanche').map((debt) => debt.accountId)).toEqual([
      'card',
      'store',
      'car',
    ]);
  });

  it('honours an explicit custom order', () => {
    const custom = debts.map((debt, index) => ({ ...debt, customOrder: 3 - index }));
    expect(sortDebts(custom, 'custom').map((debt) => debt.accountId)).toEqual([
      'store',
      'car',
      'card',
    ]);
  });
});

describe('buildPayoffPlan', () => {
  it('pays every debt off and reports when debt freedom occurs', () => {
    const plan = buildPayoffPlan(debts, 'avalanche', 30000, '2026-11-20');
    expect(plan.months).toBeGreaterThan(0);
    expect(plan.debtFreeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(plan.projections.every((projection) => projection.paidOff)).toBe(true);
    expect(plan.projections.every((projection) => projection.payoffDate !== null)).toBe(true);
    expect(plan.schedule[plan.schedule.length - 1].totalBalance).toBe(0);
    expect(plan.totalPaid).toBeGreaterThan(debts.reduce((sum, debt) => sum + debt.balance, 0));
    expect(plan.monthlyStart).toBe('2026-11-01');
  });

  it('charges no interest at 0% APR', () => {
    const plan = buildPayoffPlan(
      [{ accountId: 'a', name: 'Zero', balance: 120000, apr: 0, minimumPayment: 10000 }],
      'snowball',
      0,
      '2026-01-10',
    );
    expect(plan.totalInterest).toBe(0);
    expect(plan.months).toBe(12);
    expect(plan.totalPaid).toBe(120000);
    expect(plan.debtFreeDate).toBe('2027-01-01');
  });

  it('keeps debts open when payments cannot cover interest', () => {
    const plan = buildPayoffPlan(
      [{ accountId: 'a', name: 'Treadmill', balance: 100000, apr: 60, minimumPayment: 100 }],
      'snowball',
      0,
      '2026-01-10',
    );
    expect(plan.debtFreeDate).toBeNull();
    expect(plan.projections[0].paidOff).toBe(false);
    expect(plan.months).toBe(1200);
  });
});
