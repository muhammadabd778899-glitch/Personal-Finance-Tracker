import { db } from './db';
import { contributionSchema, debtDetailSchema, goalSchema } from './schemas';
import { validate, ValidationError } from './repositories';
import type { DebtDetail, Goal, GoalContribution } from '../domain/types';
import { newId, nowISO } from '../domain/ids';

export interface GoalInput {
  name: string;
  type: Goal['type'];
  targetAmount: number;
  targetDate?: string;
  accountId?: string;
  color?: string;
  notes?: string;
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const now = nowISO();
  const goal = validate<Goal>(
    goalSchema,
    {
      id: newId(),
      name: input.name.trim(),
      type: input.type,
      targetAmount: Math.abs(input.targetAmount),
      targetDate: input.targetDate || undefined,
      accountId: input.accountId || undefined,
      color: input.color || undefined,
      notes: input.notes?.trim() || undefined,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    'goal',
  );
  await db.goals.add(goal);
  return goal;
}

export async function updateGoal(id: string, input: GoalInput): Promise<Goal> {
  const existing = await db.goals.get(id);
  if (!existing) throw new ValidationError('Goal not found.');
  const goal = validate<Goal>(
    goalSchema,
    {
      ...existing,
      name: input.name.trim(),
      type: input.type,
      targetAmount: Math.abs(input.targetAmount),
      targetDate: input.targetDate || undefined,
      accountId: input.accountId || undefined,
      color: input.color || undefined,
      notes: input.notes?.trim() || undefined,
      updatedAt: nowISO(),
    },
    'goal',
  );
  await db.goals.put(goal);
  return goal;
}

export async function archiveGoal(id: string, archived = true): Promise<void> {
  await db.goals.update(id, { archived, updatedAt: nowISO() });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', db.goals, db.contributions, async () => {
    await db.contributions.where('goalId').equals(id).delete();
    await db.goals.delete(id);
  });
}

export async function addContribution(input: {
  goalId: string;
  date: string;
  amount: number;
  accountId?: string;
  note?: string;
}): Promise<GoalContribution> {
  if (!(await db.goals.get(input.goalId))) throw new ValidationError('Goal not found.');
  const contribution = validate<GoalContribution>(
    contributionSchema,
    {
      id: newId(),
      goalId: input.goalId,
      date: input.date,
      amount: Math.round(input.amount),
      accountId: input.accountId || undefined,
      note: input.note?.trim() || undefined,
      createdAt: nowISO(),
    },
    'contribution',
  );
  await db.contributions.add(contribution);
  return contribution;
}

export async function deleteContribution(id: string): Promise<void> {
  await db.contributions.delete(id);
}

export interface DebtInput {
  accountId: string;
  apr: number;
  minimumPayment: number;
  dueDay?: number;
  originalBalance?: number;
}

export async function saveDebtDetail(input: DebtInput): Promise<DebtDetail> {
  const account = await db.accounts.get(input.accountId);
  if (!account) throw new ValidationError('Account not found.');
  if (account.type !== 'credit' && account.type !== 'loan') {
    throw new ValidationError('Debt details apply to credit card and loan accounts.');
  }
  const detail = validate<DebtDetail>(
    debtDetailSchema,
    {
      accountId: input.accountId,
      apr: Math.max(0, input.apr),
      minimumPayment: Math.max(0, Math.round(input.minimumPayment)),
      dueDay: input.dueDay,
      originalBalance: input.originalBalance,
      updatedAt: nowISO(),
    },
    'debt detail',
  );
  await db.debts.put(detail);
  return detail;
}

export async function deleteDebtDetail(accountId: string): Promise<void> {
  await db.debts.delete(accountId);
}
