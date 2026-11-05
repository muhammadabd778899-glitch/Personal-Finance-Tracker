import Dexie, { type Table } from 'dexie';
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

export interface MetaRow {
  key: string;
  value: string;
}

/**
 * IndexedDB schema. Version 1 is the current release schema.
 * Migrations must be additive and must never silently discard data. If a future version
 * changes a field, add a `.upgrade()` that preserves the old value in `meta` before
 * transforming it.
 */
export class FinanceDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  allocations!: Table<BudgetAllocation, string>;
  recurring!: Table<RecurringRule, string>;
  exceptions!: Table<RecurrenceException, string>;
  payments!: Table<BillPayment, string>;
  goals!: Table<Goal, string>;
  contributions!: Table<GoalContribution, string>;
  debts!: Table<DebtDetail, string>;
  settings!: Table<AppSettings, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'ultimate-finance-tracker') {
    super(name);
    this.version(1).stores({
      accounts: 'id, type, archived, name',
      categories: 'id, kind, parentId, archived, name',
      transactions: 'id, date, accountId, categoryId, type, recurringId, [accountId+date]',
      budgets: 'id, startDate, period',
      allocations: 'id, budgetId, categoryId, [budgetId+categoryId]',
      recurring: 'id, kind, accountId, archived, startDate',
      exceptions: 'id, recurringId, [recurringId+originalDate]',
      payments: 'id, recurringId, occurrenceDate, [recurringId+occurrenceDate]',
      goals: 'id, archived, type',
      contributions: 'id, goalId, date, [goalId+date]',
      debts: 'accountId',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new FinanceDB();
