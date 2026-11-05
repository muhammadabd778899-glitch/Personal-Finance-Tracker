/**
 * Core domain types for Ultimate Personal Finance Tracker.
 *
 * Money rules:
 * - All monetary values are integers in minor units (cents for USD/EUR, yen for JPY, etc).
 * - Signed balance convention: asset accounts hold positive balances, liability accounts hold
 *   negative balances (an owed amount of 500.00 is stored as -50000).
 * - Amounts on income/expense/transfer transactions are always positive. The transaction type
 *   determines the direction; see domain/accounts.ts.
 *
 * Dates:
 * - Date-only values are ISO strings (YYYY-MM-DD) and are never converted through `Date` in a
 *   way that could shift the calendar day across time zones.
 */

export type Minor = number;
export type DateISO = string;
export type CurrencyCode = string;

export type AccountType =
  'checking' | 'savings' | 'cash' | 'credit' | 'loan' | 'investment' | 'other';

export const ASSET_ACCOUNT_TYPES: AccountType[] = [
  'checking',
  'savings',
  'cash',
  'investment',
  'other',
];
export const LIABILITY_ACCOUNT_TYPES: AccountType[] = ['credit', 'loan'];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  openingBalance: Minor;
  openingDate: DateISO;
  institution?: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CategoryKind = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId?: string;
  color?: string;
  icon?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** Positive minor units. Direction is determined by `type`. */
  amount: Minor;
  date: DateISO;
  accountId: string;
  /** Expense category for expenses; income category for income; absent for transfers. */
  categoryId?: string;
  /** Destination account for transfers. */
  transferAccountId?: string;
  description: string;
  payee?: string;
  notes?: string;
  tags: string[];
  /** Links a transaction to the recurring rule occurrence that created it. */
  recurringId?: string;
  /** The occurrence due date this transaction settles, when created from a bill. */
  occurrenceDate?: DateISO;
  createdAt: string;
  updatedAt: string;
}

export type BudgetPeriod = 'monthly' | 'custom';

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  /** Inclusive first day of the budget period. */
  startDate: DateISO;
  /** Inclusive last day. Monthly budgets derive the end from startDate. */
  endDate: DateISO;
  currency: CurrencyCode;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  categoryId: string;
  amount: Minor;
}

export type RecurrenceFrequency =
  'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringRule {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  accountId: string;
  categoryId?: string;
  /** Fixed minor amount. For variable rules this is the expected amount used in forecasts. */
  amount: Minor;
  variableAmount: boolean;
  frequency: RecurrenceFrequency;
  /** Every N units of the frequency. `monthly` + 2 = every second month. */
  interval: number;
  startDate: DateISO;
  /** Optional inclusive last date the rule can produce occurrences. */
  endDate?: DateISO;
  /** Anchor day for monthly/quarterly/yearly rules (1-31). Defaults to startDate day. */
  anchorDay?: number;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecurrenceExceptionKind = 'skip' | 'reschedule' | 'amount';

export interface RecurrenceException {
  id: string;
  recurringId: string;
  /** The original occurrence date this exception applies to. */
  originalDate: DateISO;
  kind: RecurrenceExceptionKind;
  newDate?: DateISO;
  newAmount?: Minor;
  reason?: string;
  createdAt: string;
}

export type BillStatus = 'paid' | 'skipped';

export interface BillPayment {
  id: string;
  recurringId: string;
  occurrenceDate: DateISO;
  status: BillStatus;
  amount?: Minor;
  paidDate?: DateISO;
  transactionId?: string;
  createdAt: string;
}

export type GoalType = 'goal' | 'sinking';

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: Minor;
  targetDate?: DateISO;
  /** Optional account the money is held in (informational, does not move funds automatically). */
  accountId?: string;
  color?: string;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  date: DateISO;
  /** Positive = contribution, negative = withdrawal. */
  amount: Minor;
  accountId?: string;
  note?: string;
  createdAt: string;
}

export interface DebtDetail {
  /** One row per liability account. `accountId` is the primary key. */
  accountId: string;
  /** Annual interest rate in percent, e.g. 19.99. */
  apr: number;
  minimumPayment: Minor;
  dueDay?: number;
  /** Optional original amount borrowed, used only for display. */
  originalBalance?: Minor;
  updatedAt: string;
}

export interface AppSettings {
  id: 'app';
  currency: CurrencyCode;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  dateFormat: 'iso' | 'us' | 'eu' | 'long';
  firstDayOfWeek: 0 | 1;
  lastAccountId?: string;
  lastCategoryId?: string;
  sampleDataLoaded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupMeta {
  version: number;
  app: string;
  exportedAt: string;
  checksum: string;
}
