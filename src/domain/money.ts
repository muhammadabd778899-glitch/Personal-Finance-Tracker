import type { CurrencyCode, Minor } from './types';

/**
 * Money is stored as integer minor units. These helpers are the only sanctioned way to
 * convert between user input, storage and display values.
 */

const DEFAULT_MINOR_DIGITS = 2;

export function minorDigits(currency: CurrencyCode, locale = 'en-US'): number {
  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? DEFAULT_MINOR_DIGITS
    );
  } catch {
    return DEFAULT_MINOR_DIGITS;
  }
}

/**
 * Parses a human-entered amount into integer minor units.
 * Returns null for invalid or ambiguous input instead of guessing silently.
 *
 * Handles: "1,234.56", "1.234,56", "1234", "$ 99", "-12.5", "(12.50)".
 * The last separator is treated as the decimal separator when it is followed by
 * one or two digits; otherwise separators are treated as grouping separators.
 */
export function parseAmountToMinor(input: string, digits = DEFAULT_MINOR_DIGITS): number | null {
  if (input == null) return null;
  let text = String(input).trim();
  if (text === '') return null;
  if (/[eE]/.test(text)) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/[^\d.,\-+]/g, '');
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/^[+]+/, '');

  if (!/^[\d.,]+$/.test(text)) return null;
  if (!/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let decimalSep = '';
  if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastDot !== -1) {
    decimalSep = '.';
  } else if (lastComma !== -1) {
    decimalSep = ',';
  }

  let whole = text;
  let fraction = '';
  if (decimalSep) {
    const sepIndex = text.lastIndexOf(decimalSep);
    const after = text.slice(sepIndex + 1);
    // Only treat as decimal separator when the tail looks like a fraction (1-2 digits by
    // default, or exactly `digits` digits for zero-decimal currencies).
    if (after.length > 0 && after.length <= Math.max(digits, 2) && !/[.,]/.test(after)) {
      whole = text.slice(0, sepIndex);
      fraction = after;
    }
  }

  // Whatever remains in the integer part must be valid grouping (1-3 digits, then groups of
  // three) or plain digits. Anything else is rejected rather than misread as a fraction.
  const normaliseInteger = (part: string): string | null => {
    if (part === '') return '';
    if (!/^[\d.,]+$/.test(part)) return null;
    const separators = part.match(/[.,]/g) ?? [];
    if (separators.length === 0) return part;
    const separator = separators[0];
    if (separator === undefined) return part;
    if (separators.some((candidate) => candidate !== separator)) return null;
    const groups = part.split(separator);
    if (groups[0].length < 1 || groups[0].length > 3) return null;
    if (!groups.slice(1).every((group) => group.length === 3)) return null;
    return groups.join('');
  };

  const normalisedWhole = normaliseInteger(whole);
  if (normalisedWhole === null) return null;
  whole = normalisedWhole;

  if (!/^\d*$/.test(whole)) return null;
  if (!/^\d*$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;

  const scale = 10 ** digits;
  if (digits === 0) {
    if (/[1-9]/.test(fraction)) return null;
    const value = Number(whole);
    if (!Number.isSafeInteger(value)) return null;
    return negative ? -value : value;
  }

  // Normalise or reject over-precise fractions rather than rounding silently.
  if (fraction.length > digits) return null;
  fraction = fraction.padEnd(digits, '0');

  const wholeValue = Number(whole || '0');
  const fractionValue = Number(fraction || '0');
  if (!Number.isSafeInteger(wholeValue) || !Number.isSafeInteger(fractionValue)) return null;

  const total = wholeValue * scale + fractionValue;
  if (!Number.isSafeInteger(total)) return null;
  return negative ? -total : total;
}

export function formatMoney(
  minor: Minor,
  currency: CurrencyCode,
  locale = 'en-US',
  options: { showSign?: boolean; compact?: boolean } = {},
): string {
  const digits = minorDigits(currency, locale);
  const value = minor / 10 ** digits;
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    ...(options.compact
      ? { notation: 'compact', compactDisplay: 'short' }
      : { notation: 'standard' }),
  });
  try {
    const formatted = formatter.format(Math.abs(value));
    const sign = minor < 0 ? '−' : options.showSign && minor > 0 ? '+' : '';
    return `${sign}${formatted}`;
  } catch {
    return `${minor < 0 ? '-' : ''}${value.toFixed(digits)} ${currency}`;
  }
}

export function formatMinorInput(minor: Minor, digits = DEFAULT_MINOR_DIGITS): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const scale = 10 ** digits;
  const whole = Math.floor(abs / scale);
  const fraction = (abs % scale).toString().padStart(digits, '0');
  return `${negative ? '-' : ''}${whole}${digits > 0 ? `.${fraction}` : ''}`;
}

/** Signed effect of a transaction on an account balance, in minor units. */
export function transactionAccountEffect(
  type: 'income' | 'expense' | 'transfer',
  amount: Minor,
): Minor {
  switch (type) {
    case 'income':
      return amount;
    case 'expense':
      return -amount;
    case 'transfer':
      return -amount; // source account of a transfer
    default:
      return 0;
  }
}

export function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
