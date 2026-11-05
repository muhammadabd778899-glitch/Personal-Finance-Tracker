import { db } from './db';
import { backupSchema, validateRelationships } from './schemas';
import { checksum, nowISO } from '../domain/ids';
import type {
  Account,
  AppSettings,
  BillPayment,
  Budget,
  BudgetAllocation,
  Category,
  DebtDetail,
  Goal,
  GoalContribution,
  RecurrenceException,
  RecurringRule,
  Transaction,
} from '../domain/types';

export const BACKUP_APP = 'ultimate-personal-finance-tracker';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 60 * 1024 * 1024;

export interface BackupData {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  allocations: BudgetAllocation[];
  recurring: RecurringRule[];
  exceptions: RecurrenceException[];
  payments: BillPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  debts: DebtDetail[];
  settings?: AppSettings;
}

export interface BackupFile {
  meta: {
    app: string;
    version: number;
    exportedAt: string;
    checksum: string;
    counts: Record<string, number>;
  };
  data: BackupData;
}

export async function snapshotData(): Promise<BackupData> {
  const [
    accounts,
    categories,
    transactions,
    budgets,
    allocations,
    recurring,
    exceptions,
    payments,
    goals,
    contributions,
    debts,
    settings,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.allocations.toArray(),
    db.recurring.toArray(),
    db.exceptions.toArray(),
    db.payments.toArray(),
    db.goals.toArray(),
    db.contributions.toArray(),
    db.debts.toArray(),
    db.settings.get('app'),
  ]);
  return {
    accounts,
    categories,
    transactions,
    budgets,
    allocations,
    recurring,
    exceptions,
    payments,
    goals,
    contributions,
    debts,
    settings,
  };
}

export async function createBackup(): Promise<BackupFile> {
  const data = await snapshotData();
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) counts[key] = value.length;
  }
  return {
    meta: {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: nowISO(),
      checksum: backupChecksum(data),
      counts,
    },
    data,
  };
}

/** Key-order-independent JSON, so the checksum survives a schema round trip. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function backupChecksum(data: unknown): string {
  return checksum(stableStringify(data));
}

export function backupToText(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

export interface ValidatedBackup {
  file: BackupFile;
  warnings: string[];
}

/**
 * Validates a backup before anything is written.
 * Checks: size, JSON, app identity, version, checksum, schema, duplicate IDs and relationships.
 */
export function validateBackupText(text: string): ValidatedBackup {
  if (text.length > MAX_BACKUP_BYTES) {
    throw new BackupValidationError('This file is larger than the 60 MB restore limit.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupValidationError(
      'This is not valid JSON. Choose a backup file exported by this app.',
    );
  }
  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BackupValidationError(
      `The backup is missing or has invalid data (${issue.path.join('.') || 'root'}: ${issue.message}).`,
    );
  }
  const file = result.data as BackupFile;
  if (file.meta.app !== BACKUP_APP) {
    throw new BackupValidationError('This backup was created by a different app.');
  }
  if (file.meta.version > BACKUP_VERSION) {
    throw new BackupValidationError(
      `This backup uses a newer format (version ${file.meta.version}). Update the app before restoring it.`,
    );
  }
  const expected = backupChecksum(file.data);
  if (expected !== file.meta.checksum) {
    throw new BackupValidationError(
      'The backup checksum does not match. The file may be corrupted or edited.',
    );
  }
  const problems = validateRelationships(file.data);
  if (problems.length > 0) {
    throw new BackupValidationError(`The backup contains broken references: ${problems[0]}`);
  }
  const warnings: string[] = [];
  if (!file.data.settings) warnings.push('The backup has no settings; app defaults will be used.');
  if (file.data.accounts.length === 0) warnings.push('The backup contains no accounts.');
  return { file, warnings };
}

/**
 * Restores a validated backup in a single IndexedDB transaction. If any write fails the
 * transaction rolls back and the existing database is left untouched.
 *
 * The UI must download a fresh backup of the current data before calling this.
 */
export async function restoreBackupText(text: string): Promise<{ restored: BackupFile }> {
  const { file } = validateBackupText(text);
  const data = file.data;
  await db.transaction(
    'rw',
    [
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
    ],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.allocations.clear(),
        db.recurring.clear(),
        db.exceptions.clear(),
        db.payments.clear(),
        db.goals.clear(),
        db.contributions.clear(),
        db.debts.clear(),
      ]);
      await db.accounts.bulkAdd(data.accounts);
      await db.categories.bulkAdd(data.categories);
      await db.transactions.bulkAdd(data.transactions);
      await db.budgets.bulkAdd(data.budgets);
      await db.allocations.bulkAdd(data.allocations);
      await db.recurring.bulkAdd(data.recurring);
      await db.exceptions.bulkAdd(data.exceptions);
      await db.payments.bulkAdd(data.payments);
      await db.goals.bulkAdd(data.goals);
      await db.contributions.bulkAdd(data.contributions);
      await db.debts.bulkAdd(data.debts);
      if (data.settings) await db.settings.put(data.settings);
    },
  );
  return { restored: file };
}

export async function wipeAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
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
    ],
    async () => {
      await Promise.all([
        db.accounts.clear(),
        db.categories.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.allocations.clear(),
        db.recurring.clear(),
        db.exceptions.clear(),
        db.payments.clear(),
        db.goals.clear(),
        db.contributions.clear(),
        db.debts.clear(),
      ]);
    },
  );
}
