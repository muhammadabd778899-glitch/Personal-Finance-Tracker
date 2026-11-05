import {
  addDays,
  addMonths,
  addMonthsAnchored,
  calendarGrid,
  diffDays,
  eachMonth,
  endOfMonth,
  formatDate,
  formatMonth,
  isDateISO,
  monthsBetween,
  startOfMonth,
} from '../../src/domain/dates';

describe('isDateISO', () => {
  it('accepts real calendar dates only', () => {
    expect(isDateISO('2026-02-28')).toBe(true);
    expect(isDateISO('2024-02-29')).toBe(true);
    expect(isDateISO('2026-02-29')).toBe(false);
    expect(isDateISO('2026-13-01')).toBe(false);
    expect(isDateISO('2026-1-01')).toBe(false);
    expect(isDateISO('not-a-date')).toBe(false);
  });
});

describe('date arithmetic', () => {
  it('is timezone-safe across month and year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-01-01', '2026-03-01')).toBe(59);
    expect(diffDays('2026-03-01', '2026-01-01')).toBe(-59);
  });

  it('clamps month arithmetic to the target month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', 13)).toBe('2027-02-15');
  });

  it('keeps an explicit anchor day where the month allows it', () => {
    expect(addMonthsAnchored('2026-01-31', 1, 31)).toBe('2026-02-28');
    expect(addMonthsAnchored('2026-02-28', 1, 31)).toBe('2026-03-31');
    expect(addMonthsAnchored('2026-01-31', 3, 31)).toBe('2026-04-30');
  });

  it('creates inclusive month ranges', () => {
    expect(startOfMonth('2026-11-05')).toBe('2026-11-01');
    expect(endOfMonth('2026-11-05')).toBe('2026-11-30');
    expect(eachMonth('2026-01-15', '2026-03-02')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(monthsBetween('2025-11-01', '2026-02-01')).toBe(3);
  });
});

describe('formatting', () => {
  it('formats date-only values without shifting the day', () => {
    expect(formatDate('2026-11-05', 'iso')).toBe('11/05/2026');
    expect(formatDate('2026-11-05', 'us')).toBe('11/05/2026');
    expect(formatDate('2026-11-05', 'eu')).toBe('05/11/2026');
    expect(formatDate('2026-11-05', 'long')).toBe('5 November 2026');
    expect(formatMonth('2026-11-05')).toBe('November 2026');
    expect(formatMonth('2026-11-05', false)).toBe('Nov 2026');
  });

  it('builds a six-week grid starting on Monday', () => {
    const grid = calendarGrid('2026-11-01');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid[41]).toBe('2026-12-06');
  });
});
