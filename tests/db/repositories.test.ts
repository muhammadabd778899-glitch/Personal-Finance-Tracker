import 'fake-indexeddb/auto';
import { db } from '../../src/db/db';
import {
  createAccount,
  createCategory,
  defaultSettings,
  deleteAccount,
  deleteCategory,
  getSettings,
  restoreAccount,
  restoreCategory,
  saveSettings,
  updateAccount,
  updateCategory,
  validate,
  ValidationError,
} from '../../src/db/repositories';
import {
  bulkCreateTransactions,
  createTransaction,
  deleteTransaction,
  duplicateSignatures,
} from '../../src/db/transactions';
import { accountSchema } from '../../src/db/schemas';

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

beforeEach(async () => {
  await Promise.all(TABLES.map((table) => table.clear()));
});

afterAll(async () => {
  await db.close();
  await db.delete();
});

describe('settings', () => {
  it('creates defaults once and merges saved patches', async () => {
    const initial = await getSettings();
    expect(initial).toMatchObject({ id: 'app', currency: 'USD', theme: 'dark' });
    const updated = await saveSettings({ theme: 'light' });
    expect(updated.theme).toBe('light');
    expect(await db.settings.count()).toBe(1);
    expect(defaultSettings().id).toBe('app');
  });

  it('rejects invalid settings patches', async () => {
    await expect(saveSettings({ currency: 'US' })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('accounts', () => {
  it('creates, updates and archives accounts with history', async () => {
    const created = await createAccount({
      name: '  Everyday checking  ',
      type: 'checking',
      currency: 'USD',
      openingBalance: 100000,
      openingDate: '2026-01-01',
    });
    expect(created.name).toBe('Everyday checking');

    const updated = await updateAccount(created.id, {
      name: 'Main checking',
      type: 'checking',
      currency: 'USD',
      openingBalance: 120000,
      openingDate: '2026-01-01',
    });
    expect(updated.openingBalance).toBe(120000);

    await createTransaction({
      type: 'expense',
      amount: 1500,
      date: '2026-11-01',
      accountId: created.id,
      description: 'Coffee',
    });
    const result = await deleteAccount(created.id);
    expect(result).toEqual({ deleted: false, archived: true });
    expect((await db.accounts.get(created.id))?.archived).toBe(true);

    await restoreAccount(created.id);
    expect((await db.accounts.get(created.id))?.archived).toBe(false);
  });

  it('deletes empty accounts and force-deletes transfer-linked history', async () => {
    const checking = await createAccount({
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    const savings = await createAccount({
      name: 'Savings',
      type: 'savings',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    expect(await deleteAccount(savings.id)).toEqual({ deleted: true, archived: false });

    const second = await createAccount({
      name: 'Savings again',
      type: 'savings',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    await createTransaction({
      type: 'transfer',
      amount: 5000,
      date: '2026-11-02',
      accountId: checking.id,
      transferAccountId: second.id,
      description: 'Move to savings',
    });
    expect(await deleteAccount(second.id)).toEqual({ deleted: false, archived: true });

    await restoreAccount(second.id);
    expect(await deleteAccount(second.id, { force: true })).toEqual({
      deleted: true,
      archived: false,
    });
    expect(await db.transactions.count()).toBe(0);
    expect(await db.accounts.get(second.id)).toBeUndefined();
  });

  it('validates account fields at the boundary', () => {
    expect(() => validate(accountSchema, { id: 'x' }, 'account')).toThrow(ValidationError);
  });
});

describe('categories', () => {
  it('enforces one level of parent categories with matching kinds', async () => {
    const food = await createCategory({ name: 'Food', kind: 'expense' });
    const groceries = await createCategory({
      name: 'Groceries',
      kind: 'expense',
      parentId: food.id,
    });
    expect(groceries.parentId).toBe(food.id);

    await expect(
      createCategory({ name: 'Dining', kind: 'income', parentId: food.id }),
    ).rejects.toThrow(/match its parent/);
    await expect(
      createCategory({ name: 'Nested', kind: 'expense', parentId: groceries.id }),
    ).rejects.toThrow(/one level/);
    await expect(updateCategory(food.id, { name: 'Food', kind: 'income' })).rejects.toThrow(
      /child categories/,
    );
  });

  it('archives categories that are in use instead of deleting them', async () => {
    const category = await createCategory({ name: 'Transport', kind: 'expense' });
    const account = await createAccount({
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    await createTransaction({
      type: 'expense',
      amount: 200,
      date: '2026-11-01',
      accountId: account.id,
      categoryId: category.id,
      description: 'Bus',
    });
    expect(await deleteCategory(category.id)).toEqual({ deleted: false, archived: true });
    await restoreCategory(category.id);
    expect((await db.categories.get(category.id))?.archived).toBe(false);

    const unused = await createCategory({ name: 'Unused', kind: 'expense' });
    expect(await deleteCategory(unused.id)).toEqual({ deleted: true, archived: false });
  });
});

describe('transactions', () => {
  async function setup() {
    const checking = await createAccount({
      name: 'Checking',
      type: 'checking',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    const savings = await createAccount({
      name: 'Savings',
      type: 'savings',
      currency: 'USD',
      openingBalance: 0,
      openingDate: '2026-01-01',
    });
    const groceries = await createCategory({ name: 'Groceries', kind: 'expense' });
    const salary = await createCategory({ name: 'Salary', kind: 'income' });
    return { checking, savings, groceries, salary };
  }

  it('requires existing accounts and forbids categories on transfers', async () => {
    const { checking, savings, groceries } = await setup();
    await expect(
      createTransaction({
        type: 'expense',
        amount: 100,
        date: '2026-11-01',
        accountId: 'missing',
        description: 'Nope',
      }),
    ).rejects.toThrow(/existing account/);
    await expect(
      createTransaction({
        type: 'transfer',
        amount: 100,
        date: '2026-11-01',
        accountId: checking.id,
        transferAccountId: checking.id,
        description: 'Self',
      }),
    ).rejects.toThrow(/different destination/);
    await expect(
      createTransaction({
        type: 'transfer',
        amount: 100,
        date: '2026-11-01',
        accountId: checking.id,
        transferAccountId: savings.id,
        categoryId: groceries.id,
        description: 'With category',
      }),
    ).rejects.toThrow(/do not use categories/);
    await expect(
      createTransaction({
        type: 'expense',
        amount: 0,
        date: '2026-11-01',
        accountId: checking.id,
        description: 'Zero',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('stores signed-agnostic amounts and updates last-used settings', async () => {
    const { checking, groceries } = await setup();
    const tx = await createTransaction({
      type: 'expense',
      amount: -2500,
      date: '2026-11-01',
      accountId: checking.id,
      categoryId: groceries.id,
      description: '  Market  ',
      tags: [' food ', ''],
    });
    expect(tx.amount).toBe(2500);
    expect(tx.description).toBe('Market');
    expect(tx.tags).toEqual(['food']);
    const settings = await getSettings();
    expect(settings.lastAccountId).toBe(checking.id);
    expect(settings.lastCategoryId).toBe(groceries.id);
  });

  it('validates a whole import batch before writing', async () => {
    const { checking, groceries } = await setup();
    await expect(
      bulkCreateTransactions([
        {
          type: 'expense',
          amount: 100,
          date: '2026-11-01',
          accountId: checking.id,
          categoryId: groceries.id,
          description: 'Valid',
        },
        {
          type: 'expense',
          amount: 100,
          date: '2026-11-01',
          accountId: 'missing',
          description: 'Invalid',
        },
      ]),
    ).rejects.toThrow(/missing account/);
    expect(await db.transactions.count()).toBe(0);
  });

  it('removes linked payment records when a transaction is deleted', async () => {
    const { checking } = await setup();
    const tx = await createTransaction({
      type: 'expense',
      amount: 100,
      date: '2026-11-01',
      accountId: checking.id,
      description: 'Bill',
    });
    await db.payments.add({
      id: 'pay-1',
      recurringId: 'rule-1',
      occurrenceDate: '2026-11-01',
      status: 'paid',
      transactionId: tx.id,
      createdAt: '2026-11-01T00:00:00.000Z',
    });
    await deleteTransaction(tx.id);
    expect(await db.payments.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it('builds duplicate signatures from stored transactions', async () => {
    const { checking } = await setup();
    await createTransaction({
      type: 'expense',
      amount: 1234,
      date: '2026-11-01',
      accountId: checking.id,
      description: 'Coffee   Shop',
    });
    const signatures = await duplicateSignatures();
    expect([...signatures]).toEqual(['2026-11-01|1234|coffee shop|checking']);
  });
});
