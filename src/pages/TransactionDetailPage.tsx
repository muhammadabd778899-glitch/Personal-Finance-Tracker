import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { deleteTransaction } from '../db/transactions';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { TransactionForm } from '../components/TransactionForm';
import { accountName, categoryName } from './helpers';

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useData();
  const { money, date } = useFormatters();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const isNew = id === undefined;
  const from = (location.state as { from?: string } | null)?.from ?? '/transactions';
  const transaction = useMemo(
    () => data.transactions.find((tx) => tx.id === id),
    [data.transactions, id],
  );

  if (isNew) {
    return (
      <div className="stack">
        <Link to={from} className="btn btn-ghost btn-sm" style={{ width: 'fit-content' }}>
          <Icon name="chevron-left" size={15} /> Back
        </Link>
        <Card className="card-pad">
          <h2 className="font-display" style={{ fontSize: 22, marginBottom: 4 }}>
            New transaction
          </h2>
          <p className="muted small" style={{ marginBottom: 18 }}>
            Record income, an expense or a transfer. Fields marked invalid are caught before
            anything is saved.
          </p>
          <TransactionForm
            presetType="expense"
            onCancel={() => navigate(from)}
            onSaved={(saved) => navigate(`/transactions/${saved.id}`, { state: { from } })}
          />
        </Card>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="card">
        <EmptyState
          icon="transactions"
          title="Transaction not found"
          action={
            <Link to="/transactions" className="btn btn-primary">
              Back to transactions
            </Link>
          }
        >
          This record may have been deleted, or the link may be out of date. Nothing was changed.
        </EmptyState>
      </div>
    );
  }

  const account = data.accounts.find((entry) => entry.id === transaction.accountId);
  const destination = data.accounts.find((entry) => entry.id === transaction.transferAccountId);
  const typeLabel =
    transaction.type === 'income'
      ? 'Income'
      : transaction.type === 'expense'
        ? 'Expense'
        : 'Transfer';
  const signed =
    transaction.type === 'income'
      ? `+${money(transaction.amount)}`
      : transaction.type === 'expense'
        ? `−${money(transaction.amount)}`
        : `⇄ ${money(transaction.amount)}`;

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteTransaction(transaction!.id);
      toast('Transaction deleted.', 'success');
      navigate(from, { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the transaction.', 'danger');
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <Link to={from} className="btn btn-ghost btn-sm">
          <Icon name="chevron-left" size={15} /> Back to list
        </Link>
        <span className="tiny muted">Record ID: {transaction.id.slice(0, 12)}…</span>
      </div>

      <div className="detail-hero">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge
              tone={
                transaction.type === 'income'
                  ? 'positive'
                  : transaction.type === 'transfer'
                    ? 'info'
                    : 'neutral'
              }
            >
              {typeLabel}
            </Badge>
            {transaction.recurringId ? <Badge tone="accent">From schedule</Badge> : null}
            {transaction.occurrenceDate ? (
              <Badge>Occurrence {date(transaction.occurrenceDate)}</Badge>
            ) : null}
          </div>
          <h2>{transaction.description}</h2>
          <p className="sub">
            {date(transaction.date)} · {account?.name ?? 'Missing account'}
            {destination ? ` → ${destination.name}` : ''}
          </p>
          <div
            className={`detail-amount ${transaction.type === 'income' ? 'positive' : ''}`}
            style={{ marginTop: 14 }}
          >
            {signed}
          </div>
        </div>
        <div className="detail-actions">
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            icon={<Icon name="edit" size={16} />}
          >
            Edit
          </Button>
          <Button
            variant="danger-ghost"
            onClick={() => setConfirmDelete(true)}
            icon={<Icon name="trash" size={16} />}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-2">
        <Card className="card-pad">
          <h3 className="card-title" style={{ marginBottom: 14 }}>
            Details
          </h3>
          <dl className="detail-list">
            <div>
              <dt>Date</dt>
              <dd>{date(transaction.date)}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{typeLabel}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>
                {account ? (
                  <Link to={`/accounts/${account.id}`}>{account.name}</Link>
                ) : (
                  'Missing account'
                )}
              </dd>
            </div>
            <div>
              <dt>{transaction.type === 'transfer' ? 'Destination' : 'Category'}</dt>
              <dd>
                {transaction.type === 'transfer'
                  ? (destination?.name ?? 'Missing account')
                  : categoryName(data.categories, transaction.categoryId)}
              </dd>
            </div>
            <div>
              <dt>Payee</dt>
              <dd>{transaction.payee || '—'}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>{transaction.tags.length > 0 ? transaction.tags.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt>Recorded</dt>
              <dd>{date(transaction.createdAt.slice(0, 10))}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{date(transaction.updatedAt.slice(0, 10))}</dd>
            </div>
          </dl>
          {transaction.notes ? (
            <>
              <hr className="divider" style={{ margin: '16px 0' }} />
              <div>
                <div className="field-label">Notes</div>
                <p className="small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {transaction.notes}
                </p>
              </div>
            </>
          ) : null}
        </Card>

        <Card className="card-pad">
          <h3 className="card-title" style={{ marginBottom: 10 }}>
            How this affects balances
          </h3>
          <p className="small muted">
            {transaction.type === 'income'
              ? `This income adds ${money(transaction.amount)} to ${accountName(data.accounts, transaction.accountId)}. It counts toward income but not spending.`
              : transaction.type === 'expense'
                ? `This expense subtracts ${money(transaction.amount)} from ${accountName(data.accounts, transaction.accountId)}. It counts toward spending in its category.`
                : `This transfer moves ${money(transaction.amount)} from ${accountName(data.accounts, transaction.accountId)} to ${accountName(data.accounts, transaction.transferAccountId)}. It never counts as income or spending.`}
          </p>
          <div className="notice" style={{ marginTop: 14 }}>
            <Icon name="info" size={17} />
            <span>
              Balances are derived from transactions, never edited directly. To correct an account,
              edit the opening balance in the account settings.
            </span>
          </div>
        </Card>
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit transaction"
        description="Changes recalculate every affected balance and report immediately."
        wide
      >
        <TransactionForm
          initial={transaction}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this transaction?"
        description="This cannot be undone from here."
        confirmLabel="Delete transaction"
        danger
        busy={busy}
      >
        <p className="small muted">
          Deleting this record will change the affected account balance and any report or budget
          that includes it. If this transaction was created from a scheduled bill, that occurrence
          becomes unpaid again. Export a backup first if you need a copy.
        </p>
        <Field label="Transaction" htmlFor="delete-tx-confirm">
          <input
            id="delete-tx-confirm"
            className="input"
            value={`${transaction.description} · ${money(transaction.amount)}`}
            readOnly
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
