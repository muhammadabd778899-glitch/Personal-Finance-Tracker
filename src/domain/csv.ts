import { parseAmountToMinor } from './money';

/**
 * CSV utilities with formula-injection protection.
 *
 * Export: cells starting with = + - @ tab or carriage return are prefixed with an apostrophe,
 * except genuine numeric values (so negative amounts stay machine-readable).
 * Import: quoted fields, escaped quotes, CRLF and a UTF-8 BOM are supported.
 */

export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !isNumericText(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function isNumericText(text: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(text.trim());
}

export function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\r\n');
}

export function parseCSV(text: string): {
  headers: string[];
  rows: string[][];
  errors: string[];
} {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  const errors: string[] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < cleaned.length) {
    const char = cleaned[i];
    if (inQuotes) {
      if (char === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"' && field === '') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (inQuotes) errors.push('A quoted field was not closed before the end of the file.');
  if (field !== '' || row.length > 0) pushRow();

  if (rows.length === 0) return { headers: [], rows: [], errors: ['The file is empty.'] };
  const headers = rows[0].map((h) => h.trim());
  if (headers.some((h) => h === '')) errors.push('One or more column headers are blank.');
  const body = rows.slice(1);
  body.forEach((cells, index) => {
    if (cells.length > headers.length && cells.slice(headers.length).some((c) => c.trim() !== '')) {
      errors.push(
        `Row ${index + 2} has more values (${cells.length}) than columns (${headers.length}).`,
      );
    }
  });
  return { headers, rows: body, errors };
}

export type ImportField =
  | 'ignore'
  | 'date'
  | 'amount'
  | 'description'
  | 'payee'
  | 'type'
  | 'account'
  | 'category'
  | 'notes';

export interface ImportMapping {
  [columnIndex: number]: ImportField;
}

export interface ImportRowResult {
  rowNumber: number;
  status: 'ready' | 'duplicate' | 'invalid';
  reason?: string;
  values?: {
    date: string;
    amount: number;
    description: string;
    payee?: string;
    type: 'income' | 'expense';
    accountName?: string;
    categoryName?: string;
    notes?: string;
  };
}

export function detectMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  headers.forEach((header, index) => {
    const key = header.toLowerCase().trim();
    if (/^(date|transaction date|posted date)$/.test(key)) mapping[index] = 'date';
    else if (/^(amount|value|debit|credit)$/.test(key)) mapping[index] = 'amount';
    else if (/^(description|details|memo|narrative)$/.test(key)) mapping[index] = 'description';
    else if (/^(payee|merchant|name)$/.test(key)) mapping[index] = 'payee';
    else if (/^(type|kind|direction)$/.test(key)) mapping[index] = 'type';
    else if (/^(account|account name)$/.test(key)) mapping[index] = 'account';
    else if (/^(category|category name)$/.test(key)) mapping[index] = 'category';
    else if (/^(notes|note)$/.test(key)) mapping[index] = 'notes';
    else mapping[index] = 'ignore';
  });
  return mapping;
}

export function normaliseImportDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    return validateDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3])) ? date : null;
  }
  const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    // Ambiguous day/month: values above 12 identify the day. Otherwise assume US month-first
    // and let the preview show the parsed date for review.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (!validateDateParts(year, month, day)) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

function validateDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

export interface ImportPreviewOptions {
  headers: string[];
  rows: string[][];
  mapping: ImportMapping;
  existingSignature: (signature: string) => boolean;
  defaultAccountName: string;
  currencyDigits?: number;
}

export interface ImportPreview {
  results: ImportRowResult[];
  ready: number;
  duplicates: number;
  invalid: number;
  total: number;
  mappingErrors: string[];
}

/**
 * Builds a validated preview. Rows are never committed here.
 * Duplicate detection uses date + amount + normalised description + account name.
 * Identity is never guessed: rows that look duplicated are surfaced and excluded by default.
 */
export function buildImportPreview(options: ImportPreviewOptions): ImportPreview {
  const { rows, mapping, existingSignature, defaultAccountName } = options;
  const mappingErrors: string[] = [];
  const assigned = Object.values(mapping).filter((field) => field !== 'ignore');
  for (const required of ['date', 'amount', 'description'] as const) {
    if (!assigned.includes(required)) mappingErrors.push(`Map a column to ${required}.`);
  }
  if (assigned.filter((field) => field === 'date').length > 1) {
    mappingErrors.push('Only one column can be mapped to date.');
  }
  if (assigned.filter((field) => field === 'amount').length > 1) {
    mappingErrors.push('Only one column can be mapped to amount.');
  }
  if (mappingErrors.length > 0) {
    const empty = {
      results: [] as ImportRowResult[],
      ready: 0,
      duplicates: 0,
      invalid: 0,
      total: rows.length,
      mappingErrors,
    };
    return empty;
  }

  const fieldIndex = (field: ImportField): number | undefined => {
    const index = Object.entries(mapping).find(([, value]) => value === field)?.[0];
    return index == null ? undefined : Number(index);
  };
  const dateIndex = fieldIndex('date');
  const amountIndex = fieldIndex('amount');
  const descriptionIndex = fieldIndex('description');
  const payeeIndex = fieldIndex('payee');
  const typeIndex = fieldIndex('type');
  const accountIndex = fieldIndex('account');
  const categoryIndex = fieldIndex('category');
  const notesIndex = fieldIndex('notes');

  const seenInFile = new Set<string>();
  const results: ImportRowResult[] = rows.map((cells, index) => {
    const rowNumber = index + 2;
    const date = dateIndex != null ? normaliseImportDate(cells[dateIndex] ?? '') : null;
    if (!date) {
      return {
        rowNumber,
        status: 'invalid',
        reason: 'Date is missing or not a recognised format.',
      };
    }
    const amountRaw = amountIndex != null ? (cells[amountIndex] ?? '') : '';
    const signed = parseAmountToMinor(amountRaw, options.currencyDigits ?? 2);
    if (signed == null || signed === 0) {
      return {
        rowNumber,
        status: 'invalid',
        reason: 'Amount is missing, zero or not a recognised number.',
      };
    }
    const description = (descriptionIndex != null ? cells[descriptionIndex] : '')?.trim();
    if (!description) {
      return { rowNumber, status: 'invalid', reason: 'Description is required.' };
    }
    let type: 'income' | 'expense' = signed < 0 ? 'expense' : 'income';
    if (typeIndex != null) {
      const typeText = (cells[typeIndex] ?? '').toLowerCase().trim();
      if (/income|credit|deposit|inflow/.test(typeText)) type = 'income';
      if (/expense|debit|withdrawal|outflow|spend/.test(typeText)) type = 'expense';
    }
    const accountName = accountIndex != null ? cells[accountIndex]?.trim() : defaultAccountName;
    const signature = [
      date,
      Math.abs(signed).toString(),
      description.toLowerCase().replace(/\s+/g, ' '),
      (accountName || defaultAccountName).toLowerCase(),
    ].join('|');
    if (existingSignature(signature) || seenInFile.has(signature)) {
      return {
        rowNumber,
        status: 'duplicate',
        reason: existingSignature(signature)
          ? 'A matching date, amount, description and account already exists.'
          : 'This row duplicates another row in the same file.',
      };
    }
    seenInFile.add(signature);
    return {
      rowNumber,
      status: 'ready',
      values: {
        date,
        amount: Math.abs(signed),
        description,
        payee: payeeIndex != null ? cells[payeeIndex]?.trim() || undefined : undefined,
        type,
        accountName: accountName || undefined,
        categoryName: categoryIndex != null ? cells[categoryIndex]?.trim() || undefined : undefined,
        notes: notesIndex != null ? cells[notesIndex]?.trim() || undefined : undefined,
      },
    };
  });

  return {
    results,
    ready: results.filter((r) => r.status === 'ready').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    total: results.length,
    mappingErrors,
  };
}

export function transactionSignature(tx: {
  date: string;
  amount: number;
  description: string;
  accountName: string;
}): string {
  return [
    tx.date,
    tx.amount.toString(),
    tx.description.toLowerCase().replace(/\s+/g, ' '),
    tx.accountName.toLowerCase(),
  ].join('|');
}

export const CSV_HEADERS = [
  'Date',
  'Type',
  'Description',
  'Payee',
  'Category',
  'Account',
  'Amount',
  'Notes',
] as const;
