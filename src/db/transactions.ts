import { db } from './db';
import { transactionSchema } from './schemas';
import { getSettings, validate, ValidationError } from './repositories';
import type { Transaction } from '../domain/types';
import { newId, nowISO } from '../domain/ids';
import { accountBalance } from '../domain/accounts';

export interface TransactionInput {
  type: Transaction['type'];
  amount: number;
  date: string;
  accountId: string;
  categoryId?: string;
  transferAccountId?: string;
  description: string;
  payee?: string;
  notes?: string;
  tags?: string[];
}

async function assertReferences(input: TransactionInput): Promise<void> {
  const account = await db.accounts.get(input.accountId);
  if (!account) throw new ValidationError('Choose an existing account.');
  if (input.type === 'transfer') {
    const destination = await db.accounts.get(input.transferAccountId ?? '');
    if (!destination) throw new ValidationError('Choose an existing destination account.');
    if (destination.id === input.accountId) {
      throw new ValidationError('Choose a different destination account.');
    }
  }
  if (input.categoryId) {
    const category = await db.categories.get(input.categoryId);
    if (!category) throw new ValidationError('Choose an existing category.');
    if (input.type === 'transfer') {
      throw new ValidationError('Transfers do not use categories.');
    }
  }
}

function buildTransaction(input: TransactionInput, id: string, createdAt: string): Transaction {
  return validate<Transaction>(
    transactionSchema,
    {
      id,
      type: input.type,
      amount: Math.abs(input.amount),
      date: input.date,
      accountId: input.accountId,
      categoryId: input.type === 'transfer' ? undefined : input.categoryId || undefined,
      transferAccountId: input.type === 'transfer' ? input.transferAccountId : undefined,
      description: input.description.trim(),
      payee: input.payee?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      tags: (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
      createdAt,
      updatedAt: nowISO(),
    },
    'transaction',
  );
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  await assertReferences(input);
  const now = nowISO();
  const tx = buildTransaction(input, newId(), now);
  await db.transactions.add(tx);
  const settings = await getSettings();
  await db.settings.put({
    ...settings,
    lastAccountId: input.accountId,
    lastCategoryId: input.categoryId,
    updatedAt: nowISO(),
  });
  return tx;
}

export async function updateTransaction(id: string, input: TransactionInput): Promise<Transaction> {
  const existing = await db.transactions.get(id);
  if (!existing) throw new ValidationError('Transaction not found.');
  await assertReferences(input);
  const tx = validate<Transaction>(
    transactionSchema,
    {
      ...buildTransaction(input, id, existing.createdAt),
      recurringId: existing.recurringId,
      occurrenceDate: existing.occurrenceDate,
    },
    'transaction',
  );
  await db.transactions.put(tx);
  return tx;
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.payments, async () => {
    const linked = await db.payments.filter((payment) => payment.transactionId === id).toArray();
    if (linked.length > 0) {
      await db.payments.bulkDelete(linked.map((payment) => payment.id));
    }
    await db.transactions.delete(id);
  });
}

/** Validates and writes a batch of imports atomically. All rows or none are committed. */
export async function bulkCreateTransactions(inputs: TransactionInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const accounts = await db.accounts.toArray();
  const accountIds = new Set(accounts.map((account) => account.id));
  const categories = await db.categories.toArray();
  const categoryIds = new Set(categories.map((category) => category.id));
  for (const input of inputs) {
    if (!accountIds.has(input.accountId))
      throw new ValidationError('An import row references a missing account.');
    if (input.categoryId && !categoryIds.has(input.categoryId)) {
      throw new ValidationError('An import row references a missing category.');
    }
  }
  const now = nowISO();
  const rows = inputs.map((input) => buildTransaction(input, newId(), now));
  await db.transaction('rw', db.transactions, async () => {
    await db.transactions.bulkAdd(rows);
  });
  return rows.length;
}

/** Signatures of existing transactions, used to flag CSV duplicates before import. */
export async function duplicateSignatures(): Promise<Set<string>> {
  const [transactions, accounts] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
  ]);
  const accountNames = new Map(accounts.map((account) => [account.id, account.name.toLowerCase()]));
  return new Set(
    transactions.map((tx) =>
      [
        tx.date,
        tx.amount.toString(),
        tx.description.toLowerCase().replace(/\s+/g, ' '),
        (accountNames.get(tx.accountId) ?? '').toLowerCase(),
      ].join('|'),
    ),
  );
}

/** Current balance for an account, used for detail views and inline validation. */
export async function balanceOf(accountId: string): Promise<number> {
  const account = await db.accounts.get(accountId);
  if (!account) return 0;
  const transactions = await db.transactions.toArray();
  return accountBalance(account, transactions);
}

export async function accountTransactions(accountId: string): Promise<Transaction[]> {
  const all = await db.transactions.toArray();
  return all.filter((tx) => tx.accountId === accountId || tx.transferAccountId === accountId);
}

export async function transactionById(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}

export async function clearAllTransactions(): Promise<void> {
  await db.transaction('rw', db.transactions, db.payments, async () => {
    await db.transactions.clear();
    await db.payments.clear();
  });
}
