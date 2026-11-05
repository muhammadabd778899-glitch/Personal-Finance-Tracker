import {
  anchorDayOf,
  frequencyLabel,
  occurrencesBetween,
  ruleOccurrences,
  scheduleOccurrences,
  stepOccurrence,
} from '../../src/domain/recurrence';
import type { BillPayment, RecurrenceException } from '../../src/domain/types';
import { recurringRule } from '../fixtures';

const rent = recurringRule();

describe('recurrence generation', () => {
  it('anchors monthly occurrences to the requested day', () => {
    expect(anchorDayOf(rent)).toBe(15);
    expect(stepOccurrence(rent, 0)).toBe('2026-01-15');
    expect(stepOccurrence(rent, 1)).toBe('2026-02-15');
    expect(stepOccurrence({ ...rent, anchorDay: 31 }, 1)).toBe('2026-02-28');
    expect(stepOccurrence({ ...rent, anchorDay: 31 }, 2)).toBe('2026-03-31');
  });

  it('supports every frequency without skipping intervals', () => {
    expect(stepOccurrence(recurringRule({ frequency: 'daily', startDate: '2026-01-01' }), 3)).toBe(
      '2026-01-04',
    );
    expect(stepOccurrence(recurringRule({ frequency: 'weekly', startDate: '2026-01-01' }), 2)).toBe(
      '2026-01-15',
    );
    expect(
      stepOccurrence(recurringRule({ frequency: 'biweekly', startDate: '2026-01-01' }), 2),
    ).toBe('2026-01-29');
    expect(
      stepOccurrence(
        recurringRule({ frequency: 'quarterly', startDate: '2026-01-31', anchorDay: 31 }),
        1,
      ),
    ).toBe('2026-04-30');
    expect(
      stepOccurrence(
        recurringRule({ frequency: 'yearly', startDate: '2024-02-29', anchorDay: 29 }),
        1,
      ),
    ).toBe('2025-02-28');
  });

  it('generates inclusive occurrences and respects the rule end date', () => {
    expect(ruleOccurrences(rent, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
    expect(ruleOccurrences({ ...rent, endDate: '2026-02-28' }, '2026-01-01', '2026-06-30')).toEqual(
      ['2026-01-15', '2026-02-15'],
    );
    expect(ruleOccurrences(rent, '2026-05-01', '2026-04-01')).toEqual([]);
  });

  it('applies skip, reschedule and amount exceptions', () => {
    const exceptions: RecurrenceException[] = [
      {
        id: 'ex-skip',
        recurringId: rent.id,
        originalDate: '2026-02-15',
        kind: 'skip',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'ex-move',
        recurringId: rent.id,
        originalDate: '2026-03-15',
        kind: 'reschedule',
        newDate: '2026-03-20',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'ex-amount',
        recurringId: rent.id,
        originalDate: '2026-04-15',
        kind: 'amount',
        newAmount: 160000,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const rows = occurrencesBetween(rent, '2026-01-01', '2026-04-30', exceptions);
    expect(rows.map((row) => row.date)).toEqual(['2026-01-15', '2026-03-20', '2026-04-15']);
    expect(rows[2].amount).toBe(160000);
    expect(rows[2].exception?.id).toBe('ex-amount');
    expect(rows[0].id).toBe('rule-rent:2026-01-15');
  });
});

describe('schedule status', () => {
  const payments: BillPayment[] = [
    {
      id: 'pay-1',
      recurringId: rent.id,
      occurrenceDate: '2026-01-15',
      status: 'paid',
      createdAt: '2026-01-15T00:00:00.000Z',
    },
  ];

  it('marks paid, overdue and upcoming occurrences from the supplied today', () => {
    const rows = scheduleOccurrences({
      rules: [rent],
      exceptions: [],
      payments,
      from: '2026-01-01',
      to: '2026-03-31',
      today: '2026-02-20',
    });
    expect(rows.map((row) => row.status)).toEqual(['paid', 'overdue', 'unpaid']);
    expect(rows[0].payment?.id).toBe('pay-1');
  });

  it('ignores archived rules and sorts by effective date', () => {
    expect(
      scheduleOccurrences({
        rules: [{ ...rent, archived: true }],
        exceptions: [],
        payments: [],
        from: '2026-01-01',
        to: '2026-12-31',
        today: '2026-01-01',
      }),
    ).toEqual([]);
  });

  it('describes frequencies accurately', () => {
    expect(frequencyLabel(rent)).toBe('Every month');
    expect(frequencyLabel({ ...rent, interval: 3, frequency: 'monthly' })).toBe('Every 3 months');
    expect(frequencyLabel({ ...rent, frequency: 'biweekly' })).toBe('Every two weeks');
    expect(frequencyLabel({ ...rent, interval: 2, frequency: 'weekly' })).toBe('Every 2 weeks');
  });
});
