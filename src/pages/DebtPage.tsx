import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { balancesForAccounts, isLiability } from '../domain/accounts';
import { buildPayoffPlan, type PayoffStrategy } from '../domain/debt';
import { formatMonth } from '../domain/dates';
import { parseAmountToMinor } from '../domain/money';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  LoadingPage,
  PageIntro,
} from '../components/ui';
import { Icon } from '../components/icons';
import { DebtDetailForm } from '../components/DataForms';
import { accountTypeLabel } from './helpers';

export function DebtPage() {
  const { data, loading } = useData();
  const { money, digits } = useFormatters();
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche');
  const [extra, setExtra] = useState('');
  const [editAccountId, setEditAccountId] = useState<string | null>(null);

  const liabilityBalances = useMemo(
    () =>
      balancesForAccounts(
        data.accounts.filter((account) => !account.archived && isLiability(account.type)),
        data.transactions,
      ),
    [data.accounts, data.transactions],
  );

  const extraMinor = parseAmountToMinor(extra || '0', digits) ?? 0;
  const plan = useMemo(() => {
    const debts = liabilityBalances
      .filter((entry) => entry.owed > 0)
      .map((entry) => {
        const detail = data.debts.find((debt) => debt.accountId === entry.account.id);
        return {
          accountId: entry.account.id,
          name: entry.account.name,
          balance: entry.owed,
          apr: detail?.apr ?? 0,
          minimumPayment: detail?.minimumPayment ?? 0,
        };
      });
    if (debts.length === 0) return null;
    return buildPayoffPlan(debts, strategy, Math.max(0, extraMinor));
  }, [liabilityBalances, data.debts, strategy, extraMinor]);

  const totalOwed = liabilityBalances.reduce((sum, entry) => sum + entry.owed, 0);
  const missingDetails = liabilityBalances.filter(
    (entry) => entry.owed > 0 && !data.debts.some((debt) => debt.accountId === entry.account.id),
  );

  if (loading) return <LoadingPage />;

  return (
    <div className="stack">
      <PageIntro
        title="Debt, with a clear plan"
        description="Balances come from recorded transactions. Payoff dates and interest are clearly labelled estimates based on the details you provide."
        actions={
          <Link to="/accounts" className="btn btn-primary">
            <Icon name="plus" size={16} /> Add a credit card or loan
          </Link>
        }
      />

      {liabilityBalances.length === 0 ? (
        <Card>
          <EmptyState
            icon="debt"
            title="No debt accounts yet"
            action={
              <Link to="/accounts" className="btn btn-primary">
                Add a credit card or loan
              </Link>
            }
          >
            Add a credit card or loan account with its opening amount owed, then record payments as
            transfers from an asset account.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-3">
            <div className="stat-card">
              <div className="stat-label">Total owed</div>
              <div className="stat-value">{money(totalOwed)}</div>
              <div className="stat-meta">{liabilityBalances.length} liability accounts</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Monthly minimums</div>
              <div className="stat-value">
                {money(
                  data.debts.reduce((sum, debt) => sum + debt.minimumPayment, 0),
                  { compact: true },
                )}
              </div>
              <div className="stat-meta">From the debt details you entered</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Highest APR</div>
              <div className="stat-value">
                {data.debts.length > 0
                  ? `${Math.max(...data.debts.map((debt) => debt.apr)).toFixed(2)}%`
                  : '—'}
              </div>
              <div className="stat-meta">Avalanche targets the highest rate first</div>
            </div>
          </div>

          {missingDetails.length > 0 ? (
            <div className="notice notice-warning">
              <Icon name="alert" size={17} />
              <span>
                Add APR and minimum payment details for{' '}
                {missingDetails.map((entry) => entry.account.name).join(', ')} to make the payoff
                estimate meaningful.
              </span>
            </div>
          ) : null}

          <div className="grid grid-2">
            {liabilityBalances.map((entry) => {
              const detail = data.debts.find((debt) => debt.accountId === entry.account.id);
              const projection = plan?.projections.find(
                (row) => row.accountId === entry.account.id,
              );
              return (
                <div key={entry.account.id} className="debt-card">
                  <div className="debt-card-head">
                    <div>
                      <h3>{entry.account.name}</h3>
                      <div className="tiny muted">
                        {accountTypeLabel(entry.account.type)}
                        {detail?.dueDay ? ` · due day ${detail.dueDay}` : ''}
                      </div>
                    </div>
                    <Badge tone={entry.owed > 0 ? 'warning' : 'positive'}>
                      {entry.owed > 0 ? 'Balance owing' : 'Paid off'}
                    </Badge>
                  </div>
                  <div className="owed">{money(entry.owed)}</div>
                  <div className="debt-meta">
                    <span>APR {detail ? `${detail.apr}%` : 'not set'}</span>
                    <span>Minimum {detail ? money(detail.minimumPayment) : '—'}</span>
                    {projection?.payoffDate ? (
                      <span>Est. payoff {projection.payoffDate}</span>
                    ) : null}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditAccountId(entry.account.id)}
                    >
                      {detail ? 'Edit details' : 'Set up details'}
                    </Button>
                    <Link to={`/accounts/${entry.account.id}`} className="btn btn-ghost btn-sm">
                      Account activity
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="card-pad stack">
            <div className="row-between">
              <div>
                <h3 className="card-title">Payoff planner</h3>
                <p className="card-subtitle">
                  Estimate only. No new charges, fees or missed payments are modelled.
                </p>
              </div>
              <div className="segmented" role="group" aria-label="Payoff strategy">
                {(['avalanche', 'snowball'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={strategy === option}
                    onClick={() => setStrategy(option)}
                  >
                    {option === 'avalanche' ? 'Avalanche' : 'Snowball'}
                  </button>
                ))}
              </div>
            </div>

            <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
              <Field
                label="Extra monthly payment"
                htmlFor="debt-extra"
                hint="Applied after minimums, to the focus debt."
              >
                <input
                  id="debt-extra"
                  className="input tabular"
                  inputMode="decimal"
                  value={extra}
                  onChange={(event) => setExtra(event.target.value)}
                  placeholder="0.00"
                  style={{ width: 200 }}
                />
              </Field>
              <Badge tone="accent">
                {strategy === 'avalanche' ? 'Highest APR first' : 'Smallest balance first'}
              </Badge>
            </div>

            {plan ? (
              <>
                <div className="grid grid-3">
                  <div className="report-metric">
                    <span className="label">Estimated debt-free</span>
                    <span className="value">{plan.debtFreeDate ?? 'Not within 100 years'}</span>
                  </div>
                  <div className="report-metric">
                    <span className="label">Months remaining</span>
                    <span className="value">{plan.debtFreeDate ? plan.months : '—'}</span>
                  </div>
                  <div className="report-metric">
                    <span className="label">Estimated interest</span>
                    <span className="value">{money(plan.totalInterest)}</span>
                  </div>
                </div>

                <div className="grid grid-2">
                  <div>
                    <div className="field-label" style={{ marginBottom: 8 }}>
                      Focus order
                    </div>
                    <ol className="payoff-order list-reset">
                      {plan.order.map((debt, index) => {
                        const projection = plan.projections.find(
                          (row) => row.accountId === debt.accountId,
                        );
                        return (
                          <li key={debt.accountId}>
                            <span className="grow">
                              {debt.name}
                              <span className="tiny muted" style={{ display: 'block' }}>
                                {money(debt.balance)} owed · {debt.apr}% APR
                              </span>
                            </span>
                            <span className="tiny muted">
                              {projection?.payoffDate ? `Est. ${projection.payoffDate}` : '—'}
                            </span>
                            <span className="sr-only">Priority {index + 1}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <div>
                    <div className="field-label" style={{ marginBottom: 8 }}>
                      Projected balances
                    </div>
                    <div className="table-wrap">
                      <table className="table table-compact">
                        <thead>
                          <tr>
                            <th scope="col">Month</th>
                            <th scope="col" className="num">
                              Total owed
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.schedule
                            .filter(
                              (_, index) =>
                                index % Math.max(1, Math.ceil(plan.schedule.length / 6)) === 0,
                            )
                            .slice(0, 7)
                            .map((point) => (
                              <tr key={point.date}>
                                <td>{formatMonth(point.date, false)}</td>
                                <td className="num">{money(point.totalBalance)}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="notice">
                  <Icon name="info" size={17} />
                  <span>
                    Assumptions: interest accrues monthly at APR ÷ 12; every debt receives its
                    minimum; the extra amount and any freed minimums go to the focus debt; no new
                    borrowing or fees. Actual results will differ.
                  </span>
                </div>
              </>
            ) : (
              <p className="small muted">Add debt details to generate a payoff estimate.</p>
            )}
          </Card>
        </>
      )}

      <Dialog
        open={editAccountId !== null}
        onClose={() => setEditAccountId(null)}
        title="Debt details"
        description="APR and minimum payments are used only for estimates."
      >
        {editAccountId ? (
          <DebtDetailForm
            account={data.accounts.find((account) => account.id === editAccountId)!}
            initial={data.debts.find((debt) => debt.accountId === editAccountId)}
            onCancel={() => setEditAccountId(null)}
            onSaved={() => setEditAccountId(null)}
          />
        ) : null}
      </Dialog>

      <p className="tiny muted">
        This planner is an educational estimate, not financial advice. It does not recommend
        borrowing or repayment decisions.
      </p>
    </div>
  );
}
