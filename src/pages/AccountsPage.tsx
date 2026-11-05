import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  balancesForAccounts,
  isLiability,
  netWorth,
  totalAssets,
  totalLiabilities,
} from '../domain/accounts';
import { restoreAccount } from '../db/repositories';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  LoadingPage,
  PageIntro,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { AccountForm } from '../components/DataForms';
import { accountTypeLabel } from './helpers';
import { loadSampleData } from '../db/sample';

export function AccountsPage() {
  const { data, loading } = useData();
  const { money } = useFormatters();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  const active = useMemo(
    () => data.accounts.filter((account) => !account.archived),
    [data.accounts],
  );
  const archived = data.accounts.filter((account) => account.archived);
  const balances = useMemo(
    () => balancesForAccounts(active, data.transactions),
    [active, data.transactions],
  );
  const assets = totalAssets(balances);
  const liabilities = totalLiabilities(balances);
  const net = netWorth(balances);

  async function restore(id: string) {
    try {
      await restoreAccount(id);
      toast('Account restored.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not restore the account.', 'danger');
    }
  }

  async function addSample() {
    setSampleBusy(true);
    try {
      const result = await loadSampleData();
      toast(
        result.ok ? 'Sample workspace loaded.' : (result.reason ?? 'Could not load sample data.'),
        result.ok ? 'success' : 'danger',
      );
    } finally {
      setSampleBusy(false);
    }
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="stack">
      <PageIntro
        title="Accounts and balances"
        description="Assets hold positive balances; credit cards and loans hold negative balances. Transfers move money between accounts without changing net worth."
        actions={
          <Button
            variant="primary"
            onClick={() => setAddOpen(true)}
            icon={<Icon name="plus" size={17} />}
          >
            Add account
          </Button>
        }
      />

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon="accounts"
            title="No accounts yet"
            action={
              <div className="row" style={{ justifyContent: 'center' }}>
                <Button variant="primary" onClick={() => setAddOpen(true)}>
                  Create an account
                </Button>
                <Button variant="secondary" onClick={addSample} disabled={sampleBusy}>
                  {sampleBusy ? 'Loading…' : 'Explore sample workspace'}
                </Button>
              </div>
            }
          >
            Start with checking, savings, cash, a credit card or a loan. You decide the opening
            balance; every later balance is calculated from your records.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-3">
            <div className="stat-card">
              <div className="stat-label">Total assets</div>
              <div className="stat-value positive">{money(assets)}</div>
              <div className="stat-meta">
                {balances.filter((entry) => !isLiability(entry.account.type)).length} asset accounts
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total liabilities</div>
              <div className="stat-value">{money(liabilities)}</div>
              <div className="stat-meta">
                {balances.filter((entry) => isLiability(entry.account.type)).length} liability
                accounts
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net worth</div>
              <div className={`stat-value ${net < 0 ? 'negative' : ''}`}>{money(net)}</div>
              <div className="stat-meta">Assets minus liabilities</div>
            </div>
          </div>

          <div className="grid grid-3">
            {balances.map((entry) => (
              <Link
                key={entry.account.id}
                to={`/accounts/${entry.account.id}`}
                className="account-card"
              >
                <div className="account-card-head">
                  <div>
                    <h3>{entry.account.name}</h3>
                    <div className="institution">
                      {accountTypeLabel(entry.account.type)}
                      {entry.account.institution ? ` · ${entry.account.institution}` : ''}
                    </div>
                  </div>
                  {isLiability(entry.account.type) ? (
                    <Badge tone="warning">Owed</Badge>
                  ) : (
                    <Badge tone="positive">Asset</Badge>
                  )}
                </div>
                <div>
                  <div className="balance-label">
                    {isLiability(entry.account.type) ? 'Amount owed' : 'Current balance'}
                  </div>
                  <div className={`balance ${entry.balance < 0 ? 'negative' : ''}`}>
                    {isLiability(entry.account.type) ? money(entry.owed) : money(entry.balance)}
                  </div>
                </div>
                <div className="row-between tiny muted">
                  <span>{entry.transactionCount} related transactions</span>
                  <span>
                    Open <Icon name="arrow-right" size={13} className="inline-icon" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {archived.length > 0 ? (
        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 14 }}>
            <div>
              <div className="card-title">Archived accounts</div>
              <div className="card-subtitle">
                Kept for history. Archived accounts are excluded from totals until restored.
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="actions">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {archived.map((account) => (
                  <tr key={account.id}>
                    <td className="table-link">{account.name}</td>
                    <td className="small muted">{accountTypeLabel(account.type)}</td>
                    <td className="actions">
                      <Button size="sm" variant="secondary" onClick={() => restore(account.id)}>
                        Restore
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add account"
        description="Opening balances are your starting point. Later balances come from transactions."
      >
        <AccountForm onCancel={() => setAddOpen(false)} onSaved={() => setAddOpen(false)} />
      </Dialog>
    </div>
  );
}
