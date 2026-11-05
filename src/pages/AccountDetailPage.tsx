import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { accountTransactions } from '../db/transactions';
import { deleteAccount, restoreAccount } from '../db/repositories';
import { accountBalance, isLiability } from '../domain/accounts';
import { useData, useFormatters } from '../state/DataContext';
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, useToast } from '../components/ui';
import { Icon } from '../components/icons';
import { AccountForm } from '../components/DataForms';
import { TransactionForm } from '../components/TransactionForm';
import { accountTypeLabel } from './helpers';
import { useEffect } from 'react';
import { sortTransactions } from '../domain/accounts';
import type { Transaction } from '../domain/types';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useData();
  const { money, date } = useFormatters();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [related, setRelated] = useState<Transaction[]>([]);

  const account = data.accounts.find((entry) => entry.id === id);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    accountTransactions(id)
      .then((rows) => {
        if (!cancelled) setRelated(sortTransactions(rows));
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, data.transactions]);

  const balance = useMemo(
    () => (account ? accountBalance(account, data.transactions) : 0),
    [account, data.transactions],
  );
  const liability = account ? isLiability(account.type) : false;

  const stats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of related) {
      if (tx.type === 'transfer') {
        if (tx.accountId === id) outflow += tx.amount;
        if (tx.transferAccountId === id) inflow += tx.amount;
      } else if (tx.accountId === id) {
        if (tx.type === 'income') inflow += tx.amount;
        else outflow += tx.amount;
      }
    }
    return { inflow, outflow, count: related.length };
  }, [related, id]);

  if (loading) {
    return <div className="skeleton" style={{ height: 280 }} />;
  }

  if (!account) {
    return (
      <Card>
        <EmptyState
          icon="accounts"
          title="Account not found"
          action={
            <Link to="/accounts" className="btn btn-primary">
              Back to accounts
            </Link>
          }
        >
          This account may have been deleted, or the link may be out of date. Nothing was changed.
        </EmptyState>
      </Card>
    );
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const result = await deleteAccount(account!.id);
      if (result.deleted) {
        toast('Account deleted.', 'success');
        navigate('/accounts', { replace: true });
      } else {
        toast(
          'Account archived because it has transaction history. Restore it any time.',
          'success',
        );
        setConfirmDelete(false);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the account.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    try {
      await restoreAccount(account!.id);
      toast('Account restored.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not restore the account.', 'danger');
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <Link to="/accounts" className="btn btn-ghost btn-sm">
          <Icon name="chevron-left" size={15} /> Back to accounts
        </Link>
        <span className="tiny muted">Account ID: {account.id.slice(0, 12)}…</span>
      </div>

      <div className="detail-hero">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge tone={liability ? 'warning' : 'positive'}>
              {liability ? 'Liability' : 'Asset'}
            </Badge>
            <Badge>{accountTypeLabel(account.type)}</Badge>
            {account.archived ? <Badge tone="warning">Archived</Badge> : null}
          </div>
          <h2>{account.name}</h2>
          <p className="sub">
            {account.institution || 'No institution recorded'} · opened {date(account.openingDate)}
          </p>
          <div
            className={`detail-amount ${balance < 0 ? 'negative' : ''}`}
            style={{ marginTop: 14 }}
          >
            {liability ? money(Math.max(0, -balance)) : money(balance)}
          </div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            {liability
              ? 'Amount owed (balance stored as a negative value)'
              : 'Current calculated balance'}
          </p>
        </div>
        <div className="detail-actions">
          <Button
            variant="primary"
            onClick={() => setAdding(true)}
            icon={<Icon name="plus" size={16} />}
          >
            Add transaction
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            icon={<Icon name="edit" size={16} />}
          >
            Edit
          </Button>
          {account.archived ? (
            <Button variant="secondary" onClick={restore}>
              Restore
            </Button>
          ) : (
            <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat-card">
          <div className="stat-label">Money in</div>
          <div className="stat-value positive">{money(stats.inflow, { compact: true })}</div>
          <div className="stat-meta">Income and incoming transfers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Money out</div>
          <div className="stat-value">{money(stats.outflow, { compact: true })}</div>
          <div className="stat-meta">Spending and outgoing transfers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Opening balance</div>
          <div className="stat-value">{money(account.openingBalance, { compact: true })}</div>
          <div className="stat-meta">Set on {date(account.openingDate)}</div>
        </div>
      </div>

      <div className="grid grid-main">
        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 14 }}>
            <div>
              <div className="card-title">Account activity</div>
              <div className="card-subtitle">
                {stats.count} transaction{stats.count === 1 ? '' : 's'} including transfers
              </div>
            </div>
            <Link to={`/transactions?account=${account.id}`} className="small">
              Filter in list
            </Link>
          </div>
          {related.length === 0 ? (
            <EmptyState
              icon="transactions"
              title="No activity yet"
              action={
                <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
                  Add a transaction
                </Button>
              }
            >
              Transactions recorded against this account will appear here.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {related.slice(0, 40).map((tx) => {
                    const incoming =
                      tx.transferAccountId === account.id ||
                      (tx.type === 'income' && tx.accountId === account.id);
                    return (
                      <tr key={tx.id}>
                        <td className="nowrap muted small">{date(tx.date)}</td>
                        <td>
                          <Link
                            className="table-link"
                            to={`/transactions/${tx.id}`}
                            state={{ from: `/accounts/${account.id}` }}
                          >
                            {tx.description}
                          </Link>
                        </td>
                        <td className="small muted">
                          {tx.type === 'transfer'
                            ? 'Transfer'
                            : tx.type === 'income'
                              ? 'Income'
                              : 'Expense'}
                        </td>
                        <td className={`num ${incoming ? 'positive' : ''}`}>
                          {incoming ? '+' : '−'}
                          {money(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h3 className="card-title" style={{ marginBottom: 14 }}>
            Account details
          </h3>
          <dl className="detail-list" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div>
              <dt>Type</dt>
              <dd>{accountTypeLabel(account.type)}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{account.currency}</dd>
            </div>
            <div>
              <dt>Opening date</dt>
              <dd>{date(account.openingDate)}</dd>
            </div>
            <div>
              <dt>Opening balance</dt>
              <dd>{money(account.openingBalance)}</dd>
            </div>
            <div>
              <dt>Institution</dt>
              <dd>{account.institution || '—'}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{account.notes || '—'}</dd>
            </div>
          </dl>
          <div className="notice" style={{ marginTop: 16 }}>
            <Icon name="info" size={17} />
            <span>
              {liability
                ? 'Payments toward this account should be recorded as transfers from an asset account. That reduces the amount owed without counting as spending.'
                : 'To move money without affecting income or spending, record a transfer between accounts.'}
            </span>
          </div>
        </Card>
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit account"
        description="Changing the opening balance shifts every derived balance for this account."
      >
        <AccountForm
          initial={account}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title={`Add transaction to ${account.name}`}
        description="The account is pre-selected. Change it if the money belongs elsewhere."
      >
        <TransactionForm
          presetType={liability ? 'expense' : 'expense'}
          presetAccountId={account.id}
          onCancel={() => setAdding(false)}
          onSaved={() => setAdding(false)}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this account?"
        description="Accounts with history are archived instead of erased."
        confirmLabel="Delete account"
        danger
        busy={busy}
      >
        <p className="small muted">
          {related.length > 0
            ? 'This account has transaction history, so it will be archived and excluded from totals. Nothing is erased, and you can restore it later.'
            : 'This account has no transactions and can be deleted permanently.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}
