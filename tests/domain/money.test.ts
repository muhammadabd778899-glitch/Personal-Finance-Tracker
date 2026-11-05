import {
  clamp,
  formatMinorInput,
  formatMoney,
  minorDigits,
  parseAmountToMinor,
  percent,
  transactionAccountEffect,
} from '../../src/domain/money';

describe('parseAmountToMinor', () => {
  it('parses plain and grouped amounts into minor units', () => {
    expect(parseAmountToMinor('1234')).toBe(123400);
    expect(parseAmountToMinor('1,234.56')).toBe(123456);
    expect(parseAmountToMinor('1.234,56')).toBe(123456);
    expect(parseAmountToMinor('$ 99')).toBe(9900);
    expect(parseAmountToMinor('0.05')).toBe(5);
  });

  it('handles negative and parenthesised amounts', () => {
    expect(parseAmountToMinor('-12.5')).toBe(-1250);
    expect(parseAmountToMinor('(12.50)')).toBe(-1250);
    expect(parseAmountToMinor('- 4.20')).toBe(-420);
  });

  it('respects zero-decimal currencies', () => {
    expect(parseAmountToMinor('1200', 0)).toBe(1200);
    expect(parseAmountToMinor('1,200', 0)).toBe(1200);
  });

  it('rejects ambiguous, empty and over-precise input instead of guessing', () => {
    expect(parseAmountToMinor('')).toBeNull();
    expect(parseAmountToMinor('abc')).toBeNull();
    expect(parseAmountToMinor('1.2345')).toBeNull();
    expect(parseAmountToMinor('.')).toBeNull();
    expect(parseAmountToMinor('1e5')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats minor units without losing the sign', () => {
    expect(formatMoney(123456, 'USD')).toContain('1,234.56');
    expect(formatMoney(-123456, 'USD')).toContain('1,234.56');
    expect(formatMoney(-123456, 'USD')).toMatch(/^−/);
    expect(formatMoney(123456, 'USD', 'en-US', { showSign: true })).toMatch(/^\+/);
  });

  it('round-trips through the editable input format', () => {
    expect(formatMinorInput(123456)).toBe('1234.56');
    expect(formatMinorInput(-5)).toBe('-0.05');
    expect(formatMinorInput(1200, 0)).toBe('1200');
    expect(parseAmountToMinor(formatMinorInput(-98765))).toBe(-98765);
  });
});

describe('money helpers', () => {
  it('derives currency digits and falls back for unknown currencies', () => {
    expect(minorDigits('USD')).toBe(2);
    expect(minorDigits('JPY')).toBe(0);
    expect(minorDigits('NOT-A-CURRENCY')).toBe(2);
  });

  it('applies transaction direction to account balances', () => {
    expect(transactionAccountEffect('income', 500)).toBe(500);
    expect(transactionAccountEffect('expense', 500)).toBe(-500);
    expect(transactionAccountEffect('transfer', 500)).toBe(-500);
  });

  it('clamps and calculates percentages defensively', () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(1, 0)).toBe(0);
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
  });
});
