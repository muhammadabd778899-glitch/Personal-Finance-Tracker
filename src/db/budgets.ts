import { db } from './db';
import { allocationSchema, budgetSchema } from './schemas';
import { validate, ValidationError } from './repositories';
import { normaliseBudget } from '../domain/budgets';
import type { Budget, BudgetAllocation } from '../domain/types';
import { newId, nowISO } from '../domain/ids';

export interface BudgetInput {
  name: string;
  period: Budget['period'];
  startDate: string;
  endDate: string;
  currency: string;
  notes?: string;
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  const now = nowISO();
  const budget = normaliseBudget(
    validate<Budget>(
      budgetSchema,
      {
        id: newId(),
        name: input.name.trim(),
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        notes: input.notes?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      },
      'budget',
    ),
  );
  assertBounds(budget);
  await db.budgets.add(budget);
  return budget;
}

export async function updateBudget(id: string, input: BudgetInput): Promise<Budget> {
  const existing = await db.budgets.get(id);
  if (!existing) throw new ValidationError('Budget not found.');
  const budget = normaliseBudget(
    validate<Budget>(
      budgetSchema,
      {
        ...existing,
        name: input.name.trim(),
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate,
        currency: input.currency,
        notes: input.notes?.trim() || undefined,
        updatedAt: nowISO(),
      },
      'budget',
    ),
  );
  assertBounds(budget);
  await db.budgets.put(budget);
  return budget;
}

function assertBounds(budget: Budget): void {
  if (budget.endDate < budget.startDate) {
    throw new ValidationError('The budget end date must be on or after the start date.');
  }
}

export async function deleteBudget(id: string): Promise<void> {
  await db.transaction('rw', db.budgets, db.allocations, async () => {
    await db.allocations.where('budgetId').equals(id).delete();
    await db.budgets.delete(id);
  });
}

export async function setAllocation(
  budgetId: string,
  categoryId: string,
  amount: number,
): Promise<BudgetAllocation> {
  const budget = await db.budgets.get(budgetId);
  if (!budget) throw new ValidationError('Budget not found.');
  const category = await db.categories.get(categoryId);
  if (!category) throw new ValidationError('Category not found.');
  if (category.kind !== 'expense') {
    throw new ValidationError('Budgets can only allocate expense categories.');
  }
  const existing = await db.allocations
    .where('[budgetId+categoryId]')
    .equals([budgetId, categoryId])
    .first();
  const next: BudgetAllocation = validate<BudgetAllocation>(
    allocationSchema,
    {
      id: existing?.id ?? newId(),
      budgetId,
      categoryId,
      amount: Math.max(0, Math.round(amount)),
    },
    'allocation',
  );
  await db.allocations.put(next);
  return next;
}

export async function removeAllocation(id: string): Promise<void> {
  await db.allocations.delete(id);
}

/** Creates the next monthly budget by copying category allocations. Never modifies history. */
export async function duplicateBudgetToNextPeriod(id: string): Promise<Budget | null> {
  const source = await db.budgets.get(id);
  if (!source) throw new ValidationError('Budget not found.');
  const allocations = await db.allocations.where('budgetId').equals(id).toArray();
  const nextStart =
    source.period === 'monthly' ? nextMonth(source.startDate) : nextMonth(source.endDate);
  const exists = await db.budgets
    .filter((budget) => budget.period === 'monthly' && budget.startDate === nextStart)
    .first();
  if (exists) return null;

  const now = nowISO();
  const budget = normaliseBudget(
    validate<Budget>(
      budgetSchema,
      {
        ...source,
        id: newId(),
        name: source.name,
        startDate: nextStart,
        endDate: nextStart,
        createdAt: now,
        updatedAt: now,
      },
      'budget',
    ),
  );
  await db.transaction('rw', db.budgets, db.allocations, async () => {
    await db.budgets.add(budget);
    if (allocations.length > 0) {
      await db.allocations.bulkAdd(
        allocations.map((allocation) => ({
          ...allocation,
          id: newId(),
          budgetId: budget.id,
        })),
      );
    }
  });
  return budget;
}

function nextMonth(date: string): string {
  const [year, month] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
