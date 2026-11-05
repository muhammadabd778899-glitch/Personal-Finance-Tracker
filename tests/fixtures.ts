import type {
  Account,
  Budget,
  BudgetAllocation,
  Category,
  RecurringRule,
  Transaction,
} from '../src/domain/types';

export const CREATED = '2026-01-01T00:00:00.000Z';

export function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-checking',
    name: 'Everyday checking',
    type: 'checking',
    currency: 'USD',
    openingBalance: 0,
    openingDate: '2026-01-01',
    archived: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-groceries',
    name: 'Groceries',
    kind: 'expense',
    archived: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 1000,
    date: '2026-11-01',
    accountId: 'acc-checking',
    categoryId: 'cat-groceries',
    description: 'Weekly shop',
    tags: [],
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    name: 'Household',
    period: 'monthly',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    currency: 'USD',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

export function allocation(overrides: Partial<BudgetAllocation> = {}): BudgetAllocation {
  return {
    id: 'alloc-1',
    budgetId: 'budget-1',
    categoryId: 'cat-groceries',
    amount: 50000,
    ...overrides,
  };
}

export function recurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-rent',
    name: 'Rent',
    kind: 'expense',
    accountId: 'acc-checking',
    amount: 150000,
    variableAmount: false,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-15',
    anchorDay: 15,
    archived: false,
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}
