import { db } from './db';
import {
  billPaymentSchema,
  exceptionSchema,
  recurringRuleSchema,
  transactionSchema,
} from './schemas';
import { validate, ValidationError } from './repositories';
import type { BillPayment, RecurrenceException, RecurringRule, Transaction } from '../domain/types';
import { newId, nowISO } from '../domain/ids';
import { isDateISO } from '../domain/dates';

export interface RecurringInput {
  name: string;
  kind: 'income' | 'expense';
  accountId: string;
  categoryId?: string;
  amount: number;
  variableAmount: boolean;
  frequency: RecurringRule['frequency'];
  interval: number;
  startDate: string;
  endDate?: string;
  anchorDay?: number;
  notes?: string;
}

function ruleFromInput(input: RecurringInput, existing?: RecurringRule): RecurringRule {
  const now = nowISO();
  return validate<RecurringRule>(
    recurringRuleSchema,
    {
      id: existing?.id ?? newId(),
      name: input.name.trim(),
      kind: input.kind,
      accountId: input.accountId,
      categoryId: input.categoryId || undefined,
      amount: Math.abs(input.amount),
      variableAmount: input.variableAmount,
      frequency: input.frequency,
      interval: Math.max(1, Math.round(input.interval)),
      startDate: input.startDate,
      endDate: input.endDate || undefined,
      anchorDay: input.anchorDay,
      notes: input.notes?.trim() || undefined,
      archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    'recurring rule',
  );
}

export async function createRecurringRule(input: RecurringInput): Promise<RecurringRule> {
  if (!(await db.accounts.get(input.accountId))) {
    throw new ValidationError('Choose an existing account.');
  }
  if (input.categoryId && !(await db.categories.get(input.categoryId))) {
    throw new ValidationError('Choose an existing category.');
  }
  if (input.endDate && input.endDate < input.startDate) {
    throw new ValidationError('The end date must be on or after the start date.');
  }
  const rule = ruleFromInput(input);
  await db.recurring.add(rule);
  return rule;
}

export async function updateRecurringRule(
  id: string,
  input: RecurringInput,
): Promise<RecurringRule> {
  const existing = await db.recurring.get(id);
  if (!existing) throw new ValidationError('Recurring rule not found.');
  if (input.endDate && input.endDate < input.startDate) {
    throw new ValidationError('The end date must be on or after the start date.');
  }
  // Editing a schedule never rewrites past payments: those remain linked to their occurrence.
  const rule = ruleFromInput(input, existing);
  await db.recurring.put(rule);
  return rule;
}

export async function archiveRecurringRule(id: string, archived = true): Promise<void> {
  await db.recurring.update(id, { archived, updatedAt: nowISO() });
}

export async function deleteRecurringRule(id: string): Promise<void> {
  await db.transaction('rw', db.recurring, db.exceptions, db.payments, async () => {
    await db.exceptions.where('recurringId').equals(id).delete();
    await db.payments.where('recurringId').equals(id).delete();
    await db.recurring.delete(id);
  });
}

export async function addException(input: {
  recurringId: string;
  originalDate: string;
  kind: RecurrenceException['kind'];
  newDate?: string;
  newAmount?: number;
  reason?: string;
}): Promise<RecurrenceException> {
  if (!isDateISO(input.originalDate)) throw new ValidationError('Choose a valid occurrence date.');
  if (input.kind === 'reschedule' && !isDateISO(input.newDate ?? '')) {
    throw new ValidationError('Choose a new date for the rescheduled occurrence.');
  }
  if (input.kind === 'amount' && (!input.newAmount || input.newAmount <= 0)) {
    throw new ValidationError('Enter the expected amount for this occurrence.');
  }
  const exception = validate<RecurrenceException>(
    exceptionSchema,
    {
      id: newId(),
      recurringId: input.recurringId,
      originalDate: input.originalDate,
      kind: input.kind,
      newDate: input.kind === 'reschedule' ? input.newDate : undefined,
      newAmount: input.kind === 'amount' ? Math.abs(input.newAmount ?? 0) : undefined,
      reason: input.reason?.trim() || undefined,
      createdAt: nowISO(),
    },
    'occurrence change',
  );
  await db.exceptions.add(exception);
  return exception;
}

export async function removeException(id: string): Promise<void> {
  await db.exceptions.delete(id);
}

/**
 * Marks an occurrence paid by creating a real transaction and linking it atomically.
 * The transaction date is the date the user paid, while the occurrence keeps its due date.
 */
export async function markOccurrencePaid(options: {
  recurringId: string;
  occurrenceDate: string;
  amount: number;
  paidDate: string;
  accountId?: string;
}): Promise<{ payment: BillPayment; transaction: Transaction }> {
  const rule = await db.recurring.get(options.recurringId);
  if (!rule) throw new ValidationError('Recurring rule not found.');
  const existing = await db.payments
    .where('[recurringId+occurrenceDate]')
    .equals([options.recurringId, options.occurrenceDate])
    .first();
  if (existing) throw new ValidationError('This occurrence is already settled.');

  const now = nowISO();
  const transaction = validate<Transaction>(
    transactionSchema,
    {
      id: newId(),
      type: rule.kind,
      amount: Math.abs(options.amount),
      date: options.paidDate,
      accountId: options.accountId ?? rule.accountId,
      categoryId: rule.categoryId,
      description: rule.name,
      notes: `Scheduled ${rule.kind} for ${options.occurrenceDate}`,
      tags: ['scheduled'],
      recurringId: rule.id,
      occurrenceDate: options.occurrenceDate,
      createdAt: now,
      updatedAt: now,
    },
    'transaction',
  );

  const payment = validate<BillPayment>(
    billPaymentSchema,
    {
      id: newId(),
      recurringId: options.recurringId,
      occurrenceDate: options.occurrenceDate,
      status: 'paid',
      amount: Math.abs(options.amount),
      paidDate: options.paidDate,
      transactionId: transaction.id,
      createdAt: now,
    },
    'payment',
  );

  await db.transaction('rw', db.transactions, db.payments, async () => {
    await db.transactions.add(transaction);
    await db.payments.add(payment);
  });
  return { payment, transaction };
}

export async function skipOccurrence(options: {
  recurringId: string;
  occurrenceDate: string;
  reason?: string;
}): Promise<BillPayment> {
  const existing = await db.payments
    .where('[recurringId+occurrenceDate]')
    .equals([options.recurringId, options.occurrenceDate])
    .first();
  if (existing) throw new ValidationError('This occurrence is already settled.');
  const payment = validate<BillPayment>(
    billPaymentSchema,
    {
      id: newId(),
      recurringId: options.recurringId,
      occurrenceDate: options.occurrenceDate,
      status: 'skipped',
      createdAt: nowISO(),
    },
    'payment',
  );
  await db.payments.add(payment);
  return payment;
}

/** Undo a settlement. Auto-created transactions are removed so the occurrence reopens. */
export async function unmarkOccurrence(recurringId: string, occurrenceDate: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.payments, async () => {
    const payment = await db.payments
      .where('[recurringId+occurrenceDate]')
      .equals([recurringId, occurrenceDate])
      .first();
    if (!payment) return;
    if (payment.transactionId) await db.transactions.delete(payment.transactionId);
    await db.payments.delete(payment.id);
  });
}

export async function deleteTransactionOnly(transactionId: string): Promise<void> {
  await db.transactions.delete(transactionId);
}
