import 'fake-indexeddb/auto';
import { db } from '../../src/db/db';
import {
  BACKUP_APP,
  BackupValidationError,
  backupToText,
  createBackup,
  restoreBackupText,
  validateBackupText,
  wipeAllData,
} from '../../src/db/backup';
import { createAccount, createCategory, getSettings } from '../../src/db/repositories';
import { createTransaction } from '../../src/db/transactions';

const TABLES = [
  db.accounts,
  db.categories,
  db.transactions,
  db.budgets,
  db.allocations,
  db.recurring,
  db.exceptions,
  db.payments,
  db.goals,
  db.contributions,
  db.debts,
  db.settings,
  db.meta,
] as const;

async function seed() {
  await getSettings();
  const account = await createAccount({
    name: 'Checking',
    type: 'checking',
    currency: 'USD',
    openingBalance: 50000,
    openingDate: '2026-01-01',
  });
  const category = await createCategory({ name: 'Groceries', kind: 'expense' });
  await createTransaction({
    type: 'expense',
    amount: 2500,
    date: '2026-11-02',
    accountId: account.id,
    categoryId: category.id,
    description: 'Market',
  });
  return { account, category };
}

beforeEach(async () => {
  await Promise.all(TABLES.map((table) => table.clear()));
});

afterAll(async () => {
  await db.close();
  await db.delete();
});

describe('backup validation', () => {
  it('round-trips a backup through validation and restore', async () => {
    await seed();
    const backup = await createBackup();
    expect(backup.meta.app).toBe(BACKUP_APP);
    expect(backup.meta.counts).toMatchObject({ accounts: 1, categories: 1, transactions: 1 });

    const text = backupToText(backup);
    const validated = validateBackupText(text);
    expect(validated.warnings).toEqual([]);

    await wipeAllData();
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);

    await restoreBackupText(text);
    expect(await db.accounts.count()).toBe(1);
    expect(await db.categories.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
    expect((await db.transactions.toArray())[0].description).toBe('Market');
  });

  it('rejects non-JSON, foreign and future backups', async () => {
    expect(() => validateBackupText('not json')).toThrow(BackupValidationError);

    const backup = await createBackup();
    const foreign = { ...backup, meta: { ...backup.meta, app: 'another-app' } };
    expect(() => validateBackupText(JSON.stringify(foreign))).toThrow(/different app/);

    const future = { ...backup, meta: { ...backup.meta, version: 99 } };
    expect(() => validateBackupText(JSON.stringify(future))).toThrow(/newer format/);
  });

  it('detects edited data through the checksum', async () => {
    await seed();
    const backup = await createBackup();
    const parsed = JSON.parse(backupToText(backup));
    parsed.data.accounts[0].name = 'Tampered';
    expect(() => validateBackupText(JSON.stringify(parsed))).toThrow(/checksum/);
  });

  it('rejects broken relationships before touching existing data', async () => {
    await seed();
    const backup = await createBackup();
    const parsed = JSON.parse(backupToText(backup));
    const edited = {
      ...parsed,
      data: {
        ...parsed.data,
        transactions: [{ ...parsed.data.transactions[0], accountId: 'missing' }],
      },
    };
    const { backupChecksum } = await import('../../src/db/backup');
    edited.meta.checksum = backupChecksum(edited.data);
    await expect(restoreBackupText(JSON.stringify(edited))).rejects.toThrow(/broken references/);
    expect(await db.accounts.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
  });

  it('reports schema problems with a readable message', async () => {
    await seed();
    const backup = await createBackup();
    const parsed = JSON.parse(backupToText(backup));
    parsed.data.transactions[0].amount = -5;
    const { backupChecksum } = await import('../../src/db/backup');
    parsed.meta.checksum = backupChecksum(parsed.data);
    expect(() => validateBackupText(JSON.stringify(parsed))).toThrow(/invalid data/);
  });
});
