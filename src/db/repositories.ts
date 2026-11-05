import { db } from './db';
import { accountSchema, categorySchema, settingsSchema } from './schemas';
import type { Account, AppSettings, Category } from '../domain/types';
import { newId, nowISO } from '../domain/ids';

export class ValidationError extends Error {
  details?: string[];
  constructor(message: string, details?: string[]) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export function validate<T>(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      error?: { issues: { message: string; path: (string | number)[] }[] };
      data?: unknown;
    };
  },
  value: unknown,
  label = 'record',
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error?.issues.map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    );
    throw new ValidationError(
      `Some ${label} details are invalid.`,
      details?.length ? details : undefined,
    );
  }
  return result.data as T;
}

export function defaultSettings(): AppSettings {
  const now = nowISO();
  return {
    id: 'app',
    currency: 'USD',
    locale: 'en-US',
    theme: 'dark',
    dateFormat: 'iso',
    firstDayOfWeek: 1,
    sampleDataLoaded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;
  const settings = defaultSettings();
  await db.settings.put(settings);
  return settings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = validate<AppSettings>(
    settingsSchema,
    { ...current, ...patch, id: 'app', updatedAt: nowISO() },
    'settings',
  );
  await db.settings.put(next);
  return next;
}

export interface AccountInput {
  name: string;
  type: Account['type'];
  currency: string;
  openingBalance: number;
  openingDate: string;
  institution?: string;
  notes?: string;
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const now = nowISO();
  const account = validate<Account>(
    accountSchema,
    {
      id: newId(),
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      openingDate: input.openingDate,
      institution: input.institution?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    'account',
  );
  await db.accounts.add(account);
  return account;
}

export async function updateAccount(
  id: string,
  input: AccountInput & { archived?: boolean },
): Promise<Account> {
  const existing = await db.accounts.get(id);
  if (!existing) throw new ValidationError('Account not found.');
  const account = validate<Account>(
    accountSchema,
    {
      ...existing,
      name: input.name.trim(),
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      openingDate: input.openingDate,
      institution: input.institution?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      archived: input.archived ?? existing.archived,
      updatedAt: nowISO(),
    },
    'account',
  );
  await db.accounts.put(account);
  return account;
}

/**
 * Accounts with transactions are archived instead of deleted, so balances and history are
 * never silently lost. Empty accounts can be deleted permanently.
 */
export async function deleteAccount(
  id: string,
  options: { force?: boolean } = {},
): Promise<{ deleted: boolean; archived: boolean }> {
  const account = await db.accounts.get(id);
  if (!account) throw new ValidationError('Account not found.');
  if (options.force) {
    await db.transaction(
      'rw',
      [db.accounts, db.transactions, db.recurring, db.goals, db.debts],
      async () => {
        const linked = await db.transactions
          .filter((tx) => tx.accountId === id || tx.transferAccountId === id)
          .toArray();
        await db.transactions.bulkDelete(linked.map((tx) => tx.id));
        await db.recurring.where('accountId').equals(id).delete();
        await db.goals.filter((goal) => goal.accountId === id).delete();
        await db.debts.delete(id);
        await db.accounts.delete(id);
      },
    );
    return { deleted: true, archived: false };
  }
  const linked = await db.transactions
    .filter((tx) => tx.accountId === id || tx.transferAccountId === id)
    .count();
  if (linked > 0) {
    await db.accounts.update(id, { archived: true, updatedAt: nowISO() });
    return { deleted: false, archived: true };
  }
  await db.accounts.delete(id);
  return { deleted: true, archived: false };
}

export async function restoreAccount(id: string): Promise<void> {
  await db.accounts.update(id, { archived: false, updatedAt: nowISO() });
}

export interface CategoryInput {
  name: string;
  kind: Category['kind'];
  parentId?: string;
  color?: string;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const now = nowISO();
  const category = validate<Category>(
    categorySchema,
    {
      id: newId(),
      name: input.name.trim(),
      kind: input.kind,
      parentId: input.parentId || undefined,
      color: input.color || undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    'category',
  );
  if (category.parentId) {
    const parent = await db.categories.get(category.parentId);
    if (!parent) throw new ValidationError('Parent category not found.');
    if (parent.parentId) throw new ValidationError('Subcategories can only be one level deep.');
    if (parent.kind !== category.kind) {
      throw new ValidationError('A subcategory must match its parent type.');
    }
  }
  await db.categories.add(category);
  return category;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  const existing = await db.categories.get(id);
  if (!existing) throw new ValidationError('Category not found.');
  const category = validate<Category>(
    categorySchema,
    {
      ...existing,
      name: input.name.trim(),
      kind: input.kind,
      parentId: input.parentId || undefined,
      color: input.color || undefined,
      updatedAt: nowISO(),
    },
    'category',
  );
  if (category.parentId === id) throw new ValidationError('A category cannot be its own parent.');
  if (category.parentId) {
    const parent = await db.categories.get(category.parentId);
    if (!parent) throw new ValidationError('Parent category not found.');
    if (parent.parentId) throw new ValidationError('Subcategories can only be one level deep.');
  }
  const children = await db.categories.where('parentId').equals(id).toArray();
  if (children.some((child) => child.kind !== category.kind)) {
    throw new ValidationError('Change the child categories before changing this category type.');
  }
  await db.categories.put(category);
  return category;
}

export async function deleteCategory(
  id: string,
  options: { force?: boolean } = {},
): Promise<{ deleted: boolean; archived: boolean }> {
  const category = await db.categories.get(id);
  if (!category) throw new ValidationError('Category not found.');
  const used =
    (await db.transactions.where('categoryId').equals(id).count()) +
    (await db.allocations.where('categoryId').equals(id).count()) +
    (await db.recurring.filter((rule) => rule.categoryId === id).count());
  const children = await db.categories.where('parentId').equals(id).count();
  if (used > 0 || children > 0) {
    if (children > 0 && options.force) {
      throw new ValidationError('Move or delete subcategories before deleting this category.');
    }
    await db.categories.update(id, { archived: true, updatedAt: nowISO() });
    return { deleted: false, archived: true };
  }
  await db.categories.delete(id);
  return { deleted: true, archived: false };
}

export async function restoreCategory(id: string): Promise<void> {
  await db.categories.update(id, { archived: false, updatedAt: nowISO() });
}

export interface StorageHealth {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  available: boolean;
}

export async function storageHealth(): Promise<StorageHealth> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return { usage: null, quota: null, persisted: null, available: true };
    }
    const estimate = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    return {
      usage: estimate.usage ?? null,
      quota: estimate.quota ?? null,
      persisted,
      available: true,
    };
  } catch {
    return { usage: null, quota: null, persisted: null, available: false };
  }
}
