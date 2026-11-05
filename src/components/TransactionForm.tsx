import { useEffect, useMemo, useRef, useState } from 'react';
import { createTransaction, updateTransaction } from '../db/transactions';
import { parseAmountToMinor, formatMinorInput } from '../domain/money';
import { isDateISO, todayISO } from '../domain/dates';
import type { Transaction } from '../domain/types';
import { useData, useFormatters } from '../state/DataContext';
import { Button, Field, useToast } from './ui';

export interface TransactionFormProps {
  initial?: Transaction;
  presetType?: Transaction['type'];
  presetAccountId?: string;
  onSaved?: (transaction: Transaction) => void;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
  autoFocus?: boolean;
}

interface FormState {
  type: Transaction['type'];
  amount: string;
  date: string;
  accountId: string;
  transferAccountId: string;
  categoryId: string;
  description: string;
  payee: string;
  notes: string;
  tags: string;
}

export function TransactionForm({
  initial,
  presetType,
  presetAccountId,
  onSaved,
  onCancel,
  submitLabel,
  compact,
  autoFocus = true,
}: TransactionFormProps) {
  const { data } = useData();
  const { digits } = useFormatters();
  const { toast } = useToast();
  const amountRef = useRef<HTMLInputElement>(null);

  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => !account.archived || account.id === initial?.accountId),
    [data.accounts, initial?.accountId],
  );

  const initialType = initial?.type ?? presetType ?? 'expense';
  const lastCategory = data.categories.find((c) => c.id === data.settings.lastCategoryId);
  const defaultAccount =
    activeAccounts.find(
      (account) => account.id === (presetAccountId ?? data.settings.lastAccountId),
    )?.id ??
    activeAccounts[0]?.id ??
    '';

  const [form, setForm] = useState<FormState>(() => ({
    type: initialType,
    amount: initial ? formatMinorInput(initial.amount, digits) : '',
    date: initial?.date ?? todayISO(),
    accountId: initial?.accountId ?? defaultAccount,
    transferAccountId: initial?.transferAccountId ?? '',
    categoryId:
      initial?.categoryId ??
      (lastCategory && lastCategory.kind === (initialType === 'income' ? 'income' : 'expense')
        ? lastCategory.id
        : ''),
    description: initial?.description ?? '',
    payee: initial?.payee ?? '',
    notes: initial?.notes ?? '',
    tags: (initial?.tags ?? []).join(', '),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus]);

  const categoryOptions = useMemo(() => {
    if (form.type === 'transfer') return [];
    const kind = form.type === 'income' ? 'income' : 'expense';
    const relevant = data.categories.filter((c) => !c.archived && c.kind === kind);
    const parents = relevant.filter((c) => !c.parentId);
    return parents.map((parent) => ({
      parent,
      children: relevant.filter((c) => c.parentId === parent.id),
    }));
  }, [data.categories, form.type]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function changeType(type: Transaction['type']) {
    const last = data.categories.find((c) => c.id === data.settings.lastCategoryId);
    const kind = type === 'income' ? 'income' : 'expense';
    setForm((current) => ({
      ...current,
      type,
      categoryId:
        type === 'transfer'
          ? ''
          : last?.kind === kind
            ? last.id
            : current.categoryId &&
                data.categories.find((c) => c.id === current.categoryId)?.kind === kind
              ? current.categoryId
              : '',
      transferAccountId: type === 'transfer' ? current.transferAccountId : '',
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const amount = parseAmountToMinor(form.amount, digits);
    if (amount == null || amount <= 0) nextErrors.amount = 'Enter an amount greater than zero.';
    if (!form.date || !isDateISO(form.date)) nextErrors.date = 'Choose a valid date.';
    if (!form.accountId) nextErrors.accountId = 'Choose an account.';
    if (form.type === 'transfer') {
      if (!form.transferAccountId) nextErrors.transferAccountId = 'Choose a destination account.';
      else if (form.transferAccountId === form.accountId) {
        nextErrors.transferAccountId = 'Choose a different destination account.';
      }
    }
    if (!form.description.trim()) nextErrors.description = 'Add a short description.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitError('Check the highlighted fields and try again.');
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      const payload = {
        type: form.type,
        amount: amount as number,
        date: form.date,
        accountId: form.accountId,
        categoryId: form.type === 'transfer' ? undefined : form.categoryId || undefined,
        transferAccountId: form.type === 'transfer' ? form.transferAccountId : undefined,
        description: form.description,
        payee: form.payee,
        notes: form.notes,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
      const saved = initial
        ? await updateTransaction(initial.id, payload)
        : await createTransaction(payload);
      toast(initial ? 'Transaction updated.' : 'Transaction saved.', 'success');
      onSaved?.(saved);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save the transaction.');
    } finally {
      setBusy(false);
    }
  }

  const isEditing = Boolean(initial);

  return (
    <form
      className="stack"
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
      noValidate
    >
      {presetType && (
        <div className="segmented" role="group" aria-label="Transaction type">
          {(['expense', 'income', 'transfer'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={form.type === type}
              onClick={() => changeType(type)}
            >
              {type === 'expense' ? 'Expense' : type === 'income' ? 'Income' : 'Transfer'}
            </button>
          ))}
        </div>
      )}

      <div className="form-grid">
        <Field
          label="Amount"
          htmlFor="tx-amount"
          error={errors.amount}
          hint={`In ${data.settings.currency}. Use a minus sign only for refunds in CSV imports.`}
        >
          <div className="input-prefix">
            <span className="prefix" aria-hidden="true">
              {data.settings.currency}
            </span>
            <input
              id="tx-amount"
              ref={amountRef}
              className="input tabular"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              aria-invalid={Boolean(errors.amount)}
              onChange={(event) => set('amount', event.target.value)}
            />
          </div>
        </Field>
        <Field label="Date" htmlFor="tx-date" error={errors.date}>
          <input
            id="tx-date"
            type="date"
            className="input"
            value={form.date}
            max="9999-12-31"
            aria-invalid={Boolean(errors.date)}
            onChange={(event) => set('date', event.target.value)}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="tx-description"
          error={errors.description}
          className="span-2"
        >
          <input
            id="tx-description"
            className="input"
            placeholder="e.g. Weekly groceries"
            value={form.description}
            aria-invalid={Boolean(errors.description)}
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>

        <Field
          label={form.type === 'transfer' ? 'From account' : 'Account'}
          htmlFor="tx-account"
          error={errors.accountId}
        >
          <select
            id="tx-account"
            className="select"
            value={form.accountId}
            aria-invalid={Boolean(errors.accountId)}
            onChange={(event) => set('accountId', event.target.value)}
          >
            {activeAccounts.length === 0 ? <option value="">No accounts yet</option> : null}
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>

        {form.type === 'transfer' ? (
          <Field
            label="To account"
            htmlFor="tx-transfer-account"
            error={errors.transferAccountId}
            hint="A transfer moves money without counting as income or spending."
          >
            <select
              id="tx-transfer-account"
              className="select"
              value={form.transferAccountId}
              aria-invalid={Boolean(errors.transferAccountId)}
              onChange={(event) => set('transferAccountId', event.target.value)}
            >
              <option value="">Choose an account</option>
              {activeAccounts
                .filter((account) => account.id !== form.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </Field>
        ) : (
          <Field
            label="Category"
            htmlFor="tx-category"
            hint="Optional. Uncategorized spending still appears in reports."
          >
            <select
              id="tx-category"
              className="select"
              value={form.categoryId}
              onChange={(event) => set('categoryId', event.target.value)}
            >
              <option value="">Uncategorized</option>
              {categoryOptions.map(({ parent, children }) => (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>{parent.name}</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {parent.name} › {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        )}

        <Field label="Payee" htmlFor="tx-payee">
          <input
            id="tx-payee"
            className="input"
            placeholder="Optional"
            value={form.payee}
            onChange={(event) => set('payee', event.target.value)}
          />
        </Field>

        {!compact ? (
          <Field label="Tags" htmlFor="tx-tags" hint="Comma separated, optional">
            <input
              id="tx-tags"
              className="input"
              placeholder="e.g. work, reimbursable"
              value={form.tags}
              onChange={(event) => set('tags', event.target.value)}
            />
          </Field>
        ) : null}

        <Field label="Notes" htmlFor="tx-notes" className="span-2">
          <textarea
            id="tx-notes"
            className="textarea"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </Field>
      </div>

      {submitError ? (
        <div className="form-alert" role="alert">
          {submitError}
        </div>
      ) : null}

      <div className="form-actions">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : (submitLabel ?? (isEditing ? 'Save changes' : 'Save transaction'))}
        </Button>
      </div>
      <p className="tiny muted" style={{ textAlign: 'right', marginTop: -6 }}>
        Tip: press <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to save.
      </p>
    </form>
  );
}
