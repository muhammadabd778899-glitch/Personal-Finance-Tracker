import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { defaultSettings } from '../db/repositories';
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
import { formatMoney, minorDigits } from '../domain/money';
import { formatDate, todayISO, type DateFormat } from '../domain/dates';
import { useToast } from '../components/ui';

export interface DataSnapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  allocations: BudgetAllocation[];
  recurring: RecurringRule[];
  exceptions: RecurrenceException[];
  payments: BillPayment[];
  goals: Goal[];
  contributions: GoalContribution[];
  debts: DebtDetail[];
  settings: AppSettings;
}

interface DataContextValue {
  data: DataSnapshot;
  loading: boolean;
  error: string | null;
  today: string;
}

const DataContext = createContext<DataContextValue | null>(null);

const emptySnapshot: DataSnapshot = {
  accounts: [],
  categories: [],
  transactions: [],
  budgets: [],
  allocations: [],
  recurring: [],
  exceptions: [],
  payments: [],
  goals: [],
  contributions: [],
  debts: [],
  settings: defaultSettings(),
};

export async function bootstrapDatabase(): Promise<void> {
  await db.open();
  const settings = await db.settings.get('app');
  if (!settings) await db.settings.put(defaultSettings());
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [queryError, setQueryError] = useState<string | null>(null);
  const snapshot = useLiveQuery(async () => {
    try {
      const [
        accounts,
        categories,
        transactions,
        budgets,
        allocations,
        recurring,
        exceptions,
        payments,
        goals,
        contributions,
        debts,
        settings,
      ] = await Promise.all([
        db.accounts.toArray(),
        db.categories.toArray(),
        db.transactions.toArray(),
        db.budgets.toArray(),
        db.allocations.toArray(),
        db.recurring.toArray(),
        db.exceptions.toArray(),
        db.payments.toArray(),
        db.goals.toArray(),
        db.contributions.toArray(),
        db.debts.toArray(),
        db.settings.get('app'),
      ]);
      setQueryError(null);
      return {
        accounts,
        categories,
        transactions,
        budgets,
        allocations,
        recurring,
        exceptions,
        payments,
        goals,
        contributions,
        debts,
        settings: settings ?? defaultSettings(),
      } satisfies DataSnapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read the local database.';
      setQueryError(message);
      return emptySnapshot;
    }
  }, []);

  const loading = snapshot === undefined;

  useEffect(() => {
    if (loading || !snapshot) return;
    const theme = snapshot.settings.theme;
    const root = document.documentElement;
    const media =
      typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const apply = () => {
      const resolved = theme === 'system' ? (media?.matches ? 'dark' : 'light') : theme;
      root.dataset.theme = resolved;
    };
    apply();
    if (theme === 'system' && media) {
      media.addEventListener?.('change', apply);
      return () => media.removeEventListener?.('change', apply);
    }
    return undefined;
  }, [loading, snapshot?.settings.theme, snapshot]);

  useEffect(() => {
    if (queryError) toast(`Storage problem: ${queryError}`, 'danger');
  }, [queryError, toast]);

  const value = useMemo<DataContextValue>(
    () => ({
      data: snapshot ?? emptySnapshot,
      loading,
      error: queryError,
      today: todayISO(),
    }),
    [snapshot, loading, queryError],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside DataProvider');
  return context;
}

export function useSettings(): AppSettings {
  return useData().data.settings;
}

export interface Formatters {
  money: (minor: number, options?: { showSign?: boolean; compact?: boolean }) => string;
  date: (date: string, format?: DateFormat) => string;
  digits: number;
  currency: string;
  locale: string;
}

export function useFormatters(): Formatters {
  const { data } = useData();
  const { currency, locale, dateFormat } = data.settings;
  return useMemo(() => {
    const digits = minorDigits(currency, locale);
    return {
      money: (minor: number, options?: { showSign?: boolean; compact?: boolean }) =>
        formatMoney(minor, currency, locale, options),
      date: (date: string, format?: DateFormat) => formatDate(date, format ?? dateFormat, locale),
      digits,
      currency,
      locale,
    };
  }, [currency, locale, dateFormat]);
}

export function useFormatMoney(): Formatters['money'] {
  const { money } = useFormatters();
  return useCallback(
    (minor: number, options?: { showSign?: boolean; compact?: boolean }) => money(minor, options),
    [money],
  );
}
