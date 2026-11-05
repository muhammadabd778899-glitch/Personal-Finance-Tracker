import {
  buildImportPreview,
  csvCell,
  detectMapping,
  normaliseImportDate,
  parseCSV,
  toCSV,
  transactionSignature,
} from '../../src/domain/csv';
import { buildReport, budgetPerformance, defaultReportRange } from '../../src/domain/reports';
import { allocation, budget, category, transaction } from '../fixtures';

describe('CSV export', () => {
  it('quotes delimiters and strips formula injection risk', () => {
    expect(csvCell('simple')).toBe('simple');
    expect(csvCell('has,comma')).toBe('"has,comma"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-120.50')).toBe('-120.50');
    expect(csvCell(null)).toBe('');
  });

  it('writes CRLF rows with a header', () => {
    const csv = toCSV(['Date', 'Amount'], [['2026-11-01', 1234]]);
    expect(csv).toBe('Date,Amount\r\n2026-11-01,1234');
  });
});

describe('CSV import', () => {
  it('parses BOM, quoted fields, escaped quotes and CRLF', () => {
    const parsed = parseCSV('\uFEFFDate,Description\r\n2026-11-01,"Shop, ""big"""\r\n');
    expect(parsed.errors).toEqual([]);
    expect(parsed.headers).toEqual(['Date', 'Description']);
    expect(parsed.rows).toEqual([['2026-11-01', 'Shop, "big"']]);
  });

  it('reports unclosed quotes and empty files', () => {
    expect(parseCSV('Date,Amount\n"2026-11-01,10').errors[0]).toMatch(/not closed/);
    expect(parseCSV('').errors[0]).toMatch(/empty/);
  });

  it('normalises ISO and slash dates without timezone drift', () => {
    expect(normaliseImportDate('2026-11-05')).toBe('2026-11-05');
    expect(normaliseImportDate('05/11/2026')).toBe('2026-05-11');
    expect(normaliseImportDate('25/12/2026')).toBe('2026-12-25');
    expect(normaliseImportDate('31/02/2026')).toBeNull();
    expect(normaliseImportDate('05.11.26')).toBe('2026-05-11');
  });

  it('detects common bank headers', () => {
    expect(detectMapping(['Date', 'Description', 'Amount', 'Payee', 'Notes', 'Balance'])).toEqual({
      0: 'date',
      1: 'description',
      2: 'amount',
      3: 'payee',
      4: 'notes',
      5: 'ignore',
    });
  });

  it('builds a preview without committing rows and flags duplicates', () => {
    const existing = new Set([
      transactionSignature({
        date: '2026-11-01',
        amount: 1000,
        description: 'Coffee shop',
        accountName: 'Everyday checking',
      }),
    ]);
    const preview = buildImportPreview({
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['2026-11-01', 'Coffee shop', '-10.00'],
        ['2026-11-02', 'Book store', '-25.50'],
        ['2026-11-02', 'Book store', '-25.50'],
        ['bad-date', 'Ignored', '10'],
        ['2026-11-03', 'No amount', ''],
      ],
      mapping: { 0: 'date', 1: 'description', 2: 'amount' },
      existingSignature: (signature) => existing.has(signature),
      defaultAccountName: 'Everyday checking',
    });
    expect(preview.ready).toBe(1);
    expect(preview.duplicates).toBe(2);
    expect(preview.invalid).toBe(2);
    expect(preview.total).toBe(5);
    expect(preview.mappingErrors).toEqual([]);
    expect(preview.results[1].values).toMatchObject({
      date: '2026-11-02',
      amount: 2550,
      type: 'expense',
    });
  });

  it('requires date, amount and description mappings', () => {
    const preview = buildImportPreview({
      headers: ['A', 'B'],
      rows: [['1', '2']],
      mapping: { 0: 'date', 1: 'ignore' },
      existingSignature: () => false,
      defaultAccountName: 'Account',
    });
    expect(preview.results).toEqual([]);
    expect(preview.mappingErrors).toEqual(
      expect.arrayContaining(['Map a column to amount.', 'Map a column to description.']),
    );
  });
});

describe('reports', () => {
  const categories = [
    category({ id: 'cat-groceries', kind: 'expense' }),
    category({ id: 'cat-salary', kind: 'income' }),
  ];

  it('summarises income, net spending and monthly points', () => {
    const report = buildReport(
      [
        transaction({ id: 'shop', amount: 10000, date: '2026-10-02' }),
        transaction({
          id: 'pay',
          type: 'income',
          amount: 500000,
          categoryId: 'cat-salary',
          date: '2026-10-01',
        }),
        transaction({ id: 'refund', type: 'income', amount: 2000, date: '2026-10-03' }),
        transaction({ id: 'shop2', amount: 30000, date: '2026-11-02' }),
        transaction({ id: 'outside', amount: 99999, date: '2026-09-30' }),
      ],
      categories,
      '2026-10-01',
      '2026-11-30',
    );
    expect(report.transactionCount).toBe(4);
    expect(report.income).toBe(500000);
    expect(report.expenses).toBe(40000);
    expect(report.refunds).toBe(2000);
    expect(report.netSpending).toBe(38000);
    expect(report.monthly).toHaveLength(2);
    expect(report.monthly[0]).toMatchObject({
      month: '2026-10-01',
      income: 500000,
      expenses: 8000,
    });
    expect(report.largestExpenses.map((tx) => tx.id)).toEqual(['shop2', 'shop']);
    expect(report.averageExpense).toBe(20000);
  });

  it('returns a six-month default range ending today', () => {
    const range = defaultReportRange('2026-11-05');
    expect(range.to).toBe('2026-11-05');
    expect(range.from).toBe('2026-05-31');
    const empty = buildReport([], categories, range.from, range.to);
    expect(empty.savingsRate).toBe(0);
    expect(empty.categories).toEqual([]);
  });

  it('filters budget performance to overlapping periods', () => {
    const rows = budgetPerformance(
      [budget({ id: 'b1' }), budget({ id: 'b2', startDate: '2026-12-01' })],
      [
        allocation({ id: 'a1', budgetId: 'b1', amount: 25000 }),
        allocation({ id: 'a2', budgetId: 'b2', amount: 40000 }),
      ],
      [transaction({ id: 'shop', amount: 10000, date: '2026-11-02' })],
      categories,
      '2026-11-01',
      '2026-11-30',
    );
    expect(rows).toEqual([{ name: 'Household', budgeted: 25000, spent: 10000, remaining: 15000 }]);
  });
});
