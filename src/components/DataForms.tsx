import { useMemo, useState } from 'react';
import { createAccount, updateAccount } from '../db/repositories';
import { createBudget, updateBudget } from '../db/budgets';
import { createRecurringRule, updateRecurringRule } from '../db/recurring';
import { createGoal, updateGoal, saveDebtDetail } from '../db/planning';
import { endOfMonth } from '../domain/dates';
import { parseAmountToMinor, formatMinorInput } from '../domain/money';
import type { Account, Budget, DebtDetail, Goal, RecurringRule } from '../domain/types';
import { useData, useFormatters } from '../state/DataContext';
import { Button, Field, useToast } from './ui';

interface BaseFormProps {
  onSaved?: () => void;
  onCancel: () => void;
}

/* ---------- Account ---------- */

export function AccountForm({ initial, onSaved, onCancel }: BaseFormProps & { initial?: Account }) {
  const { data } = useData();
  const { digits, currency } = useFormatters();
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Account['type']>(initial?.type ?? 'checking');
  const [accountCurrency, setAccountCurrency] = useState(initial?.currency ?? currency);
  const [opening, setOpening] = useState(
    initial ? formatMinorInput(initial.openingBalance, digits) : '',
  );
  const [openingDate, setOpeningDate] = useState(
    initial?.openingDate ?? new Date().toISOString().slice(0, 10),
  );
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLiability = type === 'credit' || type === 'loan';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the account a name.');
    const parsed = parseAmountToMinor(opening || '0', digits);
    if (parsed == null) return setError('The opening balance is not a valid amount.');
    setBusy(true);
    try {
      const payload = {
        name,
        type,
        currency: accountCurrency.toUpperCase(),
        openingBalance: parsed,
        openingDate,
        institution,
        notes,
      };
      if (initial) await updateAccount(initial.id, payload);
      else await createAccount(payload);
      toast(initial ? 'Account updated.' : 'Account added.', 'success');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Account name" htmlFor="account-name" className="span-2">
          <input
            id="account-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Everyday Checking"
            autoFocus
          />
        </Field>
        <Field label="Type" htmlFor="account-type">
          <select
            id="account-type"
            className="select"
            value={type}
            onChange={(event) => setType(event.target.value as Account['type'])}
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit card</option>
            <option value="loan">Loan</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Currency" htmlFor="account-currency" hint="ISO code, e.g. USD">
          <input
            id="account-currency"
            className="input"
            maxLength={3}
            value={accountCurrency}
            onChange={(event) => setAccountCurrency(event.target.value.toUpperCase())}
          />
        </Field>
        <Field
          label={isLiability ? 'Opening amount owed' : 'Opening balance'}
          htmlFor="account-opening"
          hint={
            isLiability
              ? 'Enter the amount you owed at the opening date. It is stored as a liability.'
              : 'The balance on the opening date, before recorded transactions.'
          }
        >
          <input
            id="account-opening"
            className="input tabular"
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Opening date" htmlFor="account-opening-date">
          <input
            id="account-opening-date"
            type="date"
            className="input"
            value={openingDate}
            onChange={(event) => setOpeningDate(event.target.value)}
          />
        </Field>
        <Field label="Institution" htmlFor="account-institution">
          <input
            id="account-institution"
            className="input"
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Notes" htmlFor="account-notes">
          <input
            id="account-notes"
            className="input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
      {isLiability ? (
        <p className="notice notice-accent small">
          Liability balances are stored as negative values. A payment is recorded as a transfer from
          an asset account into this account, which reduces the amount owed.
        </p>
      ) : null}
      <p className="tiny muted">
        Account currency is informational; totals use your workspace currency (
        {data.settings.currency}).
      </p>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save account' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Budget ---------- */

export function BudgetForm({ initial, onSaved, onCancel }: BaseFormProps & { initial?: Budget }) {
  const { currency } = useFormatters();
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? 'Monthly essentials');
  const [period, setPeriod] = useState<Budget['period']>(initial?.period ?? 'monthly');
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the budget a name.');
    const resolvedEnd = period === 'monthly' ? endOfMonth(startDate) : endDate;
    if (!resolvedEnd) return setError('Choose an end date for the custom period.');
    setBusy(true);
    try {
      const payload = {
        name,
        period,
        startDate,
        endDate: resolvedEnd,
        currency,
        notes,
      };
      if (initial) await updateBudget(initial.id, payload);
      else await createBudget(payload);
      toast(initial ? 'Budget updated.' : 'Budget created.', 'success');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the budget.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field label="Budget name" htmlFor="budget-name">
        <input
          id="budget-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </Field>
      <div className="form-grid">
        <Field label="Period" htmlFor="budget-period">
          <select
            id="budget-period"
            className="select"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Budget['period'])}
          >
            <option value="monthly">Monthly</option>
            <option value="custom">Custom range</option>
          </select>
        </Field>
        <Field label={period === 'monthly' ? 'Month' : 'Start date'} htmlFor="budget-start">
          <input
            id="budget-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        {period === 'custom' ? (
          <Field label="End date" htmlFor="budget-end">
            <input
              id="budget-end"
              type="date"
              className="input"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Ends" htmlFor="budget-end-readonly">
            <input
              id="budget-end-readonly"
              className="input"
              value={startDate ? endOfMonth(startDate) : ''}
              readOnly
              aria-readonly="true"
            />
          </Field>
        )}
        <Field label="Notes" htmlFor="budget-notes">
          <input
            id="budget-notes"
            className="input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save budget' : 'Create budget'}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Recurring rule ---------- */

export function RecurringForm({
  initial,
  onSaved,
  onCancel,
}: BaseFormProps & { initial?: RecurringRule }) {
  const { data } = useData();
  const { digits } = useFormatters();
  const { toast } = useToast();
  const accounts = useMemo(
    () => data.accounts.filter((a) => !a.archived || a.id === initial?.accountId),
    [data.accounts, initial?.accountId],
  );
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<'income' | 'expense'>(initial?.kind ?? 'expense');
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [amount, setAmount] = useState(initial ? formatMinorInput(initial.amount, digits) : '');
  const [variable, setVariable] = useState(initial?.variableAmount ?? false);
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>(
    initial?.frequency ?? 'monthly',
  );
  const [interval, setInterval] = useState(String(initial?.interval ?? 1));
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = data.categories.filter(
    (category) =>
      !category.archived && category.kind === (kind === 'income' ? 'income' : 'expense'),
  );
  const parents = categories.filter((category) => !category.parentId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the scheduled item a name.');
    if (!accountId) return setError('Choose an account.');
    const parsed = parseAmountToMinor(amount, digits);
    if (parsed == null || parsed <= 0)
      return setError('Enter an expected amount greater than zero.');
    setBusy(true);
    try {
      const payload = {
        name,
        kind,
        accountId,
        categoryId: categoryId || undefined,
        amount: parsed,
        variableAmount: variable,
        frequency,
        interval: Math.max(1, Number(interval) || 1),
        startDate,
        endDate: endDate || undefined,
        anchorDay: Number(startDate.slice(8, 10)),
        notes,
      };
      if (initial) await updateRecurringRule(initial.id, payload);
      else await createRecurringRule(payload);
      toast(
        initial ? 'Schedule updated. Past payments were preserved.' : 'Schedule created.',
        'success',
      );
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the schedule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Name" htmlFor="recurring-name" className="span-2">
          <input
            id="recurring-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Rent, Salary, Internet"
            autoFocus
          />
        </Field>
        <Field label="Type" htmlFor="recurring-kind">
          <select
            id="recurring-kind"
            className="select"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as 'income' | 'expense');
              setCategoryId('');
            }}
          >
            <option value="expense">Bill / subscription</option>
            <option value="income">Income</option>
          </select>
        </Field>
        <Field label="Account" htmlFor="recurring-account">
          <select
            id="recurring-account"
            className="select"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" htmlFor="recurring-category">
          <select
            id="recurring-category"
            className="select"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Uncategorized</option>
            {parents.map((parent) => (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>{parent.name}</option>
                {categories
                  .filter((child) => child.parentId === parent.id)
                  .map((child) => (
                    <option key={child.id} value={child.id}>
                      {parent.name} › {child.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field
          label="Expected amount"
          htmlFor="recurring-amount"
          hint={variable ? 'Used for projections until the real amount is entered.' : undefined}
        >
          <input
            id="recurring-amount"
            className="input tabular"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Frequency" htmlFor="recurring-frequency">
          <select
            id="recurring-frequency"
            className="select"
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as RecurringRule['frequency'])}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Every" htmlFor="recurring-interval" hint="1 = every period">
          <input
            id="recurring-interval"
            type="number"
            min={1}
            max={52}
            className="input"
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
          />
        </Field>
        <Field label="Starts" htmlFor="recurring-start">
          <input
            id="recurring-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <Field label="Ends (optional)" htmlFor="recurring-end">
          <input
            id="recurring-end"
            type="date"
            className="input"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </Field>
        <div className="span-2">
          <label className="checkbox-row" htmlFor="recurring-variable">
            <input
              id="recurring-variable"
              type="checkbox"
              checked={variable}
              onChange={(event) => setVariable(event.target.checked)}
            />
            <span>
              Amount varies each time (for example a utility bill). You will confirm the actual
              amount when marking it paid.
            </span>
          </label>
        </div>
        <Field label="Notes" htmlFor="recurring-notes" className="span-2">
          <input
            id="recurring-notes"
            className="input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
      <p className="tiny muted">
        Monthly schedules keep their original day where possible. Editing a schedule never rewrites
        past payments.
      </p>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save schedule' : 'Create schedule'}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Goal ---------- */

export function GoalForm({ initial, onSaved, onCancel }: BaseFormProps & { initial?: Goal }) {
  const { data } = useData();
  const { digits } = useFormatters();
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Goal['type']>(initial?.type ?? 'goal');
  const [target, setTarget] = useState(
    initial ? formatMinorInput(initial.targetAmount, digits) : '',
  );
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? '');
  const [accountId, setAccountId] = useState(initial?.accountId ?? '');
  const [color, setColor] = useState(initial?.color ?? '#1f6f5c');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Give the goal a name.');
    const parsed = parseAmountToMinor(target, digits);
    if (parsed == null || parsed <= 0) return setError('Enter a target amount greater than zero.');
    setBusy(true);
    try {
      const payload = {
        name,
        type,
        targetAmount: parsed,
        targetDate: targetDate || undefined,
        accountId: accountId || undefined,
        color,
        notes,
      };
      if (initial) await updateGoal(initial.id, payload);
      else await createGoal(payload);
      toast(initial ? 'Goal updated.' : 'Goal created.', 'success');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the goal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Goal name" htmlFor="goal-name" className="span-2">
          <input
            id="goal-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Emergency fund"
            autoFocus
          />
        </Field>
        <Field label="Type" htmlFor="goal-type">
          <select
            id="goal-type"
            className="select"
            value={type}
            onChange={(event) => setType(event.target.value as Goal['type'])}
          >
            <option value="goal">Savings goal</option>
            <option value="sinking">Sinking fund</option>
          </select>
        </Field>
        <Field label="Target amount" htmlFor="goal-target">
          <input
            id="goal-target"
            className="input tabular"
            inputMode="decimal"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Target date (optional)" htmlFor="goal-date">
          <input
            id="goal-date"
            type="date"
            className="input"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </Field>
        <Field label="Held in account" htmlFor="goal-account" hint="Informational only">
          <select
            id="goal-account"
            className="select"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">Not linked</option>
            {data.accounts
              .filter((account) => !account.archived)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Colour" htmlFor="goal-color">
          <input
            id="goal-color"
            type="color"
            className="input"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            style={{ padding: 4, minHeight: 42 }}
          />
        </Field>
        <Field label="Notes" htmlFor="goal-notes">
          <input
            id="goal-notes"
            className="input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save goal' : 'Create goal'}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Debt detail ---------- */

export function DebtDetailForm({
  account,
  initial,
  onSaved,
  onCancel,
}: BaseFormProps & { account: Account; initial?: DebtDetail }) {
  const { digits } = useFormatters();
  const { toast } = useToast();
  const [apr, setApr] = useState(initial ? String(initial.apr) : '');
  const [minimum, setMinimum] = useState(
    initial ? formatMinorInput(initial.minimumPayment, digits) : '',
  );
  const [dueDay, setDueDay] = useState(initial?.dueDay ? String(initial.dueDay) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const parsedMinimum = parseAmountToMinor(minimum || '0', digits);
    const parsedApr = Number(apr || '0');
    if (parsedMinimum == null || parsedMinimum < 0)
      return setError('Enter a valid minimum payment.');
    if (!Number.isFinite(parsedApr) || parsedApr < 0 || parsedApr > 100) {
      return setError('APR must be between 0 and 100.');
    }
    setBusy(true);
    try {
      await saveDebtDetail({
        accountId: account.id,
        apr: parsedApr,
        minimumPayment: parsedMinimum,
        dueDay: dueDay ? Number(dueDay) : undefined,
      });
      toast('Debt details saved.', 'success');
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save debt details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <p className="muted small">
        These details power an estimate only. They do not change your account balance.
      </p>
      <div className="form-grid">
        <Field label="Annual interest rate (APR %)" htmlFor="debt-apr">
          <input
            id="debt-apr"
            className="input tabular"
            inputMode="decimal"
            value={apr}
            onChange={(event) => setApr(event.target.value)}
            placeholder="19.99"
            autoFocus
          />
        </Field>
        <Field label="Minimum payment" htmlFor="debt-minimum">
          <input
            id="debt-minimum"
            className="input tabular"
            inputMode="decimal"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label="Due day (optional)" htmlFor="debt-due">
          <input
            id="debt-due"
            type="number"
            min={1}
            max={31}
            className="input"
            value={dueDay}
            onChange={(event) => setDueDay(event.target.value)}
          />
        </Field>
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-actions">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save details'}
        </Button>
      </div>
    </form>
  );
}
