import { z } from 'zod';
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
import { isDateISO } from '../domain/dates';

const dateISO = z.string().refine(isDateISO, { message: 'Must be a valid YYYY-MM-DD date' });
const timestamp = z.string().min(1).max(40);
const minor = z.number().int().min(-9_000_000_000_000).max(9_000_000_000_000);
const id = z.string().min(1).max(200);

export const accountSchema: z.ZodType<Account> = z.object({
  id,
  name: z.string().trim().min(1, 'Account name is required').max(80),
  type: z.enum(['checking', 'savings', 'cash', 'credit', 'loan', 'investment', 'other']),
  currency: z.string().length(3),
  openingBalance: minor,
  openingDate: dateISO,
  institution: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const categorySchema: z.ZodType<Category> = z.object({
  id,
  name: z.string().trim().min(1, 'Category name is required').max(60),
  kind: z.enum(['expense', 'income']),
  parentId: id.optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour')
    .optional(),
  icon: z.string().max(20).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const transactionSchema: z.ZodType<Transaction> = z
  .object({
    id,
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.number().int().positive('Amount must be greater than zero').max(9_000_000_000_000),
    date: dateISO,
    accountId: id,
    categoryId: id.optional(),
    transferAccountId: id.optional(),
    description: z.string().trim().min(1, 'Description is required').max(200),
    payee: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
    tags: z.array(z.string().max(40)).max(20),
    recurringId: id.optional(),
    occurrenceDate: dateISO.optional(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((tx) => tx.type !== 'transfer' || tx.transferAccountId !== undefined, {
    message: 'Transfers need a destination account',
    path: ['transferAccountId'],
  })
  .refine((tx) => tx.type !== 'transfer' || tx.transferAccountId !== tx.accountId, {
    message: 'Choose a different destination account',
    path: ['transferAccountId'],
  });

export const budgetSchema: z.ZodType<Budget> = z.object({
  id,
  name: z.string().trim().min(1, 'Budget name is required').max(80),
  period: z.enum(['monthly', 'custom']),
  startDate: dateISO,
  endDate: dateISO,
  currency: z.string().length(3),
  notes: z.string().max(2000).optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const allocationSchema: z.ZodType<BudgetAllocation> = z.object({
  id,
  budgetId: id,
  categoryId: id,
  amount: z.number().int().min(0).max(9_000_000_000_000),
});

export const recurringRuleSchema: z.ZodType<RecurringRule> = z.object({
  id,
  name: z.string().trim().min(1, 'Name is required').max(80),
  kind: z.enum(['income', 'expense']),
  accountId: id,
  categoryId: id.optional(),
  amount: z.number().int().positive('Amount must be greater than zero').max(9_000_000_000_000),
  variableAmount: z.boolean(),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  interval: z.number().int().min(1).max(52),
  startDate: dateISO,
  endDate: dateISO.optional(),
  anchorDay: z.number().int().min(1).max(31).optional(),
  notes: z.string().max(2000).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const exceptionSchema: z.ZodType<RecurrenceException> = z.object({
  id,
  recurringId: id,
  originalDate: dateISO,
  kind: z.enum(['skip', 'reschedule', 'amount']),
  newDate: dateISO.optional(),
  newAmount: z.number().int().positive().max(9_000_000_000_000).optional(),
  reason: z.string().max(500).optional(),
  createdAt: timestamp,
});

export const billPaymentSchema: z.ZodType<BillPayment> = z.object({
  id,
  recurringId: id,
  occurrenceDate: dateISO,
  status: z.enum(['paid', 'skipped']),
  amount: z.number().int().positive().max(9_000_000_000_000).optional(),
  paidDate: dateISO.optional(),
  transactionId: id.optional(),
  createdAt: timestamp,
});

export const goalSchema: z.ZodType<Goal> = z.object({
  id,
  name: z.string().trim().min(1, 'Goal name is required').max(80),
  type: z.enum(['goal', 'sinking']),
  targetAmount: z
    .number()
    .int()
    .positive('Target must be greater than zero')
    .max(9_000_000_000_000),
  targetDate: dateISO.optional(),
  accountId: id.optional(),
  color: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const contributionSchema: z.ZodType<GoalContribution> = z.object({
  id,
  goalId: id,
  date: dateISO,
  amount: z
    .number()
    .int()
    .min(-9_000_000_000_000)
    .max(9_000_000_000_000)
    .refine((v) => v !== 0, {
      message: 'Amount cannot be zero',
    }),
  accountId: id.optional(),
  note: z.string().max(500).optional(),
  createdAt: timestamp,
});

export const debtDetailSchema: z.ZodType<DebtDetail> = z.object({
  accountId: id,
  apr: z.number().min(0).max(100),
  minimumPayment: z.number().int().min(0).max(9_000_000_000_000),
  dueDay: z.number().int().min(1).max(31).optional(),
  originalBalance: z.number().int().min(0).optional(),
  updatedAt: timestamp,
});

export const settingsSchema: z.ZodType<AppSettings> = z.object({
  id: z.literal('app'),
  currency: z.string().length(3),
  locale: z.string().min(2).max(20),
  theme: z.enum(['light', 'dark', 'system']),
  dateFormat: z.enum(['iso', 'us', 'eu', 'long']),
  firstDayOfWeek: z.union([z.literal(0), z.literal(1)]),
  lastAccountId: id.optional(),
  lastCategoryId: id.optional(),
  sampleDataLoaded: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const backupDataSchema = z.object({
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  budgets: z.array(budgetSchema),
  allocations: z.array(allocationSchema),
  recurring: z.array(recurringRuleSchema),
  exceptions: z.array(exceptionSchema),
  payments: z.array(billPaymentSchema),
  goals: z.array(goalSchema),
  contributions: z.array(contributionSchema),
  debts: z.array(debtDetailSchema),
  settings: settingsSchema.optional(),
});

export const backupSchema = z.object({
  meta: z.object({
    app: z.string(),
    version: z.number().int().min(1),
    exportedAt: timestamp,
    checksum: z.string().min(1),
    counts: z.record(z.number()).optional(),
  }),
  data: backupDataSchema,
});

/** Relationship checks that a schema cannot express. Throws with a human-readable message. */
export function validateRelationships(data: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  allocations: BudgetAllocation[];
  budgets: Budget[];
  recurring: RecurringRule[];
  exceptions: RecurrenceException[];
  payments: BillPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  debts: DebtDetail[];
}): string[] {
  const problems: string[] = [];
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));
  const budgetIds = new Set(data.budgets.map((b) => b.id));
  const recurringIds = new Set(data.recurring.map((r) => r.id));
  const goalIds = new Set(data.goals.map((g) => g.id));

  const requireUnique = (label: string, list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) problems.push(`${label}: duplicate id ${item.id}.`);
      seen.add(item.id);
    }
  };
  requireUnique('Accounts', data.accounts);
  requireUnique('Categories', data.categories);
  requireUnique('Transactions', data.transactions);
  requireUnique('Budgets', data.budgets);
  requireUnique('Recurring rules', data.recurring);
  requireUnique('Goals', data.goals);
  requireUnique('Contributions', data.contributions);

  for (const category of data.categories) {
    if (category.parentId && !categoryIds.has(category.parentId)) {
      problems.push(`Category ${category.name} references a missing parent.`);
    }
    if (category.parentId === category.id) {
      problems.push(`Category ${category.name} cannot be its own parent.`);
    }
  }
  for (const tx of data.transactions) {
    if (!accountIds.has(tx.accountId)) {
      problems.push(`Transaction ${tx.id} references a missing account.`);
    }
    if (tx.categoryId && !categoryIds.has(tx.categoryId)) {
      problems.push(`Transaction ${tx.id} references a missing category.`);
    }
    if (tx.type === 'transfer' && !accountIds.has(tx.transferAccountId ?? '')) {
      problems.push(`Transfer ${tx.id} references a missing destination account.`);
    }
    if (tx.recurringId && !recurringIds.has(tx.recurringId)) {
      problems.push(`Transaction ${tx.id} references a missing recurring rule.`);
    }
  }
  for (const allocation of data.allocations) {
    if (!budgetIds.has(allocation.budgetId)) {
      problems.push(`Allocation ${allocation.id} references a missing budget.`);
    }
    if (!categoryIds.has(allocation.categoryId)) {
      problems.push(`Allocation ${allocation.id} references a missing category.`);
    }
  }
  for (const rule of data.recurring) {
    if (!accountIds.has(rule.accountId)) {
      problems.push(`Recurring rule ${rule.name} references a missing account.`);
    }
    if (rule.categoryId && !categoryIds.has(rule.categoryId)) {
      problems.push(`Recurring rule ${rule.name} references a missing category.`);
    }
  }
  for (const exception of data.exceptions) {
    if (!recurringIds.has(exception.recurringId)) {
      problems.push(`Exception ${exception.id} references a missing recurring rule.`);
    }
  }
  for (const payment of data.payments) {
    if (!recurringIds.has(payment.recurringId)) {
      problems.push(`Payment ${payment.id} references a missing recurring rule.`);
    }
    if (payment.transactionId && !data.transactions.some((t) => t.id === payment.transactionId)) {
      problems.push(`Payment ${payment.id} references a missing transaction.`);
    }
  }
  for (const contribution of data.contributions) {
    if (!goalIds.has(contribution.goalId)) {
      problems.push(`Contribution ${contribution.id} references a missing goal.`);
    }
  }
  return problems;
}
