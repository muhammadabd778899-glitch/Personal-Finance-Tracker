import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  balancesForAccounts,
  netWorth,
  periodTotals,
  spendingByCategory,
} from '../domain/accounts';
import { addDays, addMonths, endOfMonth, formatMonth, startOfMonth } from '../domain/dates';
import { buildForecast } from '../domain/forecast';
import { goalProgress, totalGoalSavings } from '../domain/goals';
import { buildNetWorth } from '../domain/networth';
import { buildPulse } from '../domain/pulse';
import { upcomingOccurrences } from '../domain/recurrence';
import { loadSampleData } from '../db/sample';
import { useData, useFormatters } from '../state/DataContext';
import { BarChart, LineChart } from '../components/charts';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  LoadingPage,
  ProgressBar,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { TransactionForm } from '../components/TransactionForm';
import { useState } from 'react';
import { accountTypeLabel } from './helpers';
import { isLiability } from '../domain/accounts';
import type { Transaction } from '../domain/types';

export function DashboardPage() {
  const { data, loading, today } = useData();
  const { money, date } = useFormatters();
  const { toast } = useToast();
  const [quickAdd, setQuickAdd] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => !account.archived),
    [data.accounts],
  );
  const balances = useMemo(
    () => balancesForAccounts(activeAccounts, data.transactions),
    [activeAccounts, data.transactions],
  );
  const totalNet = netWorth(balances);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const monthTotals = useMemo(
    () => periodTotals(data.transactions, data.categories, monthStart, monthEnd),
    [data.transactions, data.categories, monthStart, monthEnd],
  );
  const monthSpend = monthTotals.expenses - monthTotals.refunds;

  const monthlySeries = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const start = addMonths(monthStart, index - 5);
      const totals = periodTotals(data.transactions, data.categories, start, endOfMonth(start));
      return {
        label: formatMonth(start, false).replace(' ', ' ’').slice(0, 9),
        value: totals.income,
        secondary: totals.expenses - totals.refunds,
      };
    });
  }, [data.transactions, data.categories, monthStart]);

  const categoryRows = useMemo(
    () => spendingByCategory(data.transactions, data.categories, monthStart, monthEnd).slice(0, 6),
    [data.transactions, data.categories, monthStart, monthEnd],
  );

  const goals = useMemo(
    () =>
      data.goals
        .filter((goal) => !goal.archived)
        .map((goal) => goalProgress(goal, data.contributions))
        .sort((a, b) => b.progress - a.progress),
    [data.goals, data.contributions],
  );
  const goalSavings = useMemo(
    () => totalGoalSavings(data.goals, data.contributions),
    [data.goals, data.contributions],
  );

  const upcoming = useMemo(
    () =>
      upcomingOccurrences(data.recurring, data.exceptions, data.payments, today, 45).filter(
        (occurrence) => occurrence.kind === 'expense',
      ),
    [data.recurring, data.exceptions, data.payments, today],
  );
  const upcomingTotal = upcoming.reduce((sum, occurrence) => sum + occurrence.amount, 0);

  const forecast = useMemo(() => {
    const startingBalances: Record<string, number> = {};
    for (const entry of balances) startingBalances[entry.account.id] = entry.balance;
    return buildForecast({
      from: today,
      to: addDays(today, 45),
      startingBalances,
      transactions: data.transactions.filter((tx) => tx.date > today),
      occurrences: upcoming.map((occurrence) => ({
        id: occurrence.id,
        date: occurrence.date,
        name: occurrence.name,
        amount: occurrence.amount,
        kind: occurrence.kind,
        accountId: occurrence.accountId,
        recurringId: occurrence.recurringId,
        originalDate: occurrence.originalDate,
      })),
      accountIds: activeAccounts.map((account) => account.id),
    });
  }, [balances, data.transactions, upcoming, activeAccounts, today]);

  const netWorthHistory = useMemo(
    () => buildNetWorth(activeAccounts, data.transactions, 12, today),
    [activeAccounts, data.transactions, today],
  );

  const debtChange = useMemo(() => {
    const liabilitiesNow = balances
      .filter((entry) => isLiability(entry.account.type))
      .reduce((sum, entry) => sum + Math.max(0, -entry.balance), 0);
    const past = netWorthHistory.series.find((point) => point.date >= addDays(today, -31));
    return liabilitiesNow - (past?.liabilities ?? liabilitiesNow);
  }, [balances, netWorthHistory.series, today]);

  const pulse = useMemo(
    () =>
      buildPulse({
        today,
        transactions: data.transactions,
        categories: data.categories,
        recurring: data.recurring,
        exceptions: data.exceptions,
        payments: data.payments,
        goals: data.goals,
        contributions: data.contributions,
        debtChange,
        projectedLow: forecast.lowPoint,
        currencyFormat: money,
      }),
    [data, debtChange, forecast.lowPoint, money, today],
  );

  const recent = useMemo(
    () =>
      [...data.transactions]
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6),
    [data.transactions],
  );

  const currentBudgets = data.budgets.filter(
    (budget) =>
      (budget.period === 'monthly' ? budget.startDate : budget.startDate) <= monthEnd &&
      budget.endDate >= monthStart,
  );
  const budgeted = data.allocations
    .filter((allocation) => currentBudgets.some((budget) => budget.id === allocation.budgetId))
    .reduce((sum, allocation) => sum + allocation.amount, 0);

  async function addSampleData() {
    setSampleBusy(true);
    try {
      const result = await loadSampleData();
      if (result.ok) toast('Sample workspace loaded. Remove it any time in Settings.', 'success');
      else toast(result.reason ?? 'Sample data could not be loaded.', 'danger');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load sample data.', 'danger');
    } finally {
      setSampleBusy(false);
    }
  }

  if (loading) return <LoadingPage />;

  if (activeAccounts.length === 0) {
    return (
      <div className="stack">
        <div className="dashboard-hero">
          <div>
            <div className="hero-label">Your private finance workspace</div>
            <h2>Know what you have, what is coming, and what you can plan next.</h2>
            <p className="hero-sub">
              All records stay in this browser. No bank connection, no account, no subscription.
              Start with your own accounts or explore a clearly labelled sample workspace.
            </p>
            <div className="hero-actions" style={{ marginTop: 18 }}>
              <Link to="/accounts" className="btn btn-primary">
                <Icon name="plus" size={17} /> Create your first account
              </Link>
              <Button
                variant="secondary"
                onClick={addSampleData}
                disabled={sampleBusy}
                icon={<Icon name="sparkle" size={17} />}
              >
                {sampleBusy ? 'Loading sample…' : 'Explore sample workspace'}
              </Button>
            </div>
          </div>
          <div className="card card-pad" style={{ minWidth: 230, maxWidth: 300 }}>
            <div className="row" style={{ gap: 8 }}>
              <Icon name="lock" size={18} />
              <strong className="small">Local by design</strong>
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              Your data never leaves this device. Export a versioned JSON backup whenever you want a
              portable copy.
            </p>
          </div>
        </div>

        <div className="grid grid-3">
          {[
            {
              icon: 'transactions' as const,
              title: 'Capture activity quickly',
              copy: 'One compact form with smart defaults, keyboard-friendly entry and clear review.',
            },
            {
              icon: 'bills' as const,
              title: 'See what is coming',
              copy: 'Recurring bills, paydays and a future balance timeline built from your records.',
            },
            {
              icon: 'reports' as const,
              title: 'Understand the numbers',
              copy: 'Every metric explains its period, formula and the records behind it.',
            },
          ].map((item) => (
            <Card key={item.title} className="card-pad">
              <span className="pulse-marker" aria-hidden="true">
                <Icon name={item.icon} size={18} />
              </span>
              <h3 style={{ marginTop: 12, fontSize: 15 }}>{item.title}</h3>
              <p className="small muted" style={{ marginTop: 4 }}>
                {item.copy}
              </p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="dashboard-hero">
        <div>
          <div className="hero-label">Net worth · {date(today)}</div>
          <h2>{money(totalNet)}</h2>
          <p className="hero-sub">
            {netWorthHistory.change30Days >= 0 ? 'Up ' : 'Down '}
            <strong className={netWorthHistory.change30Days >= 0 ? 'positive' : 'negative'}>
              {money(Math.abs(netWorthHistory.change30Days))}
            </strong>{' '}
            over the last 30 days · assets {money(netWorthHistory.assets)} · liabilities{' '}
            {money(netWorthHistory.liabilities)}
          </p>
          <div className="hero-actions" style={{ marginTop: 16 }}>
            <Button
              variant="primary"
              onClick={() => setQuickAdd(true)}
              icon={<Icon name="plus" size={17} />}
            >
              Add transaction
            </Button>
            <Link to="/reports" className="btn btn-secondary">
              View reports
            </Link>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 210 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted">This month</span>
            <Badge tone="accent">{formatMonth(today)}</Badge>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">Income</span>
            <strong className="tabular positive">{money(monthTotals.income)}</strong>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">Spending</span>
            <strong className="tabular">{money(monthSpend)}</strong>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small">Planned budgets</span>
            <strong className="tabular">{money(budgeted)}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-label">
            <Icon name="arrow-down" size={14} /> Income this month
          </div>
          <div className="stat-value positive">{money(monthTotals.income, { compact: true })}</div>
          <div className="stat-meta">{monthTotals.transactionCount} recorded transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Icon name="arrow-up" size={14} /> Spending this month
          </div>
          <div className="stat-value">{money(monthSpend, { compact: true })}</div>
          <div className="stat-meta">
            {monthTotals.refunds > 0 ? `${money(monthTotals.refunds)} refunded · ` : ''}
            Budget remaining {money(Math.max(0, budgeted - monthSpend))}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Icon name="calendar" size={14} /> Next 45 days
          </div>
          <div className="stat-value">{money(upcomingTotal, { compact: true })}</div>
          <div className="stat-meta">
            {upcoming.length} scheduled commitments · low balance{' '}
            <strong className={forecast.lowPoint.balance < 0 ? 'negative' : ''}>
              {money(forecast.lowPoint.balance, { compact: true })}
            </strong>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">
            <Icon name="piggy" size={14} /> Savings goals
          </div>
          <div className="stat-value">{money(goalSavings, { compact: true })}</div>
          <div className="stat-meta">
            {goals.length} active goals ·{' '}
            {goals.length > 0 ? `${Math.round(goals[0].progress)}% closest goal` : 'none yet'}
          </div>
        </div>
      </div>

      <div className="grid grid-main">
        <div className="stack">
          <Card>
            <div className="card-header">
              <div>
                <div className="card-title">Net worth trend</div>
                <div className="card-subtitle">Assets minus liabilities · last 12 months</div>
              </div>
            </div>
            <div className="card-body">
              <LineChart
                data={netWorthHistory.series.map((point) => ({
                  date: point.date,
                  value: point.net,
                  label: formatMonth(point.date, false).replace(' ', ' ’').slice(0, 9),
                }))}
                format={(value) => money(value, { compact: true })}
                ariaLabel="Net worth trend over the last twelve months"
              />
            </div>
          </Card>

          <Card>
            <div className="card-header">
              <div>
                <div className="card-title">Income and spending</div>
                <div className="card-subtitle">Last six months · spending is net of refunds</div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <span className="tiny muted">
                  <span style={{ color: 'var(--accent)' }}>■</span> Income
                </span>
                <span className="tiny muted">
                  <span style={{ color: 'var(--line-strong)' }}>■</span> Spending
                </span>
              </div>
            </div>
            <div className="card-body">
              <BarChart
                data={monthlySeries}
                format={(value) => money(value, { compact: true })}
                ariaLabel="Income and spending by month for the last six months"
                secondaryLabel="Spending"
              />
            </div>
          </Card>

          <Card className="flush">
            <div className="card-header" style={{ paddingBottom: 14 }}>
              <div>
                <div className="card-title">Recent activity</div>
                <div className="card-subtitle">Latest recorded transactions</div>
              </div>
              <Link to="/transactions" className="small">
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                icon="transactions"
                title="No transactions yet"
                action={
                  <Button variant="primary" size="sm" onClick={() => setQuickAdd(true)}>
                    Add your first transaction
                  </Button>
                }
              >
                Record income, spending and transfers to bring your dashboard to life.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Account</th>
                      <th scope="col" className="num">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((tx: Transaction) => (
                      <tr key={tx.id}>
                        <td className="nowrap muted small">{date(tx.date)}</td>
                        <td>
                          <Link
                            className="table-link"
                            to={`/transactions/${tx.id}`}
                            state={{ from: '/transactions' }}
                          >
                            {tx.description}
                          </Link>
                        </td>
                        <td className="small muted">
                          {activeAccounts.find((account) => account.id === tx.accountId)?.name ??
                            '—'}
                        </td>
                        <td
                          className={`num ${tx.type === 'income' ? 'positive' : tx.type === 'expense' ? '' : 'muted'}`}
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : ''}
                          {money(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card className="flush">
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div>
                <div className="card-title">Financial Pulse</div>
                <div className="card-subtitle">What changed, and why</div>
              </div>
              <Badge tone="accent" dot>
                Local
              </Badge>
            </div>
            <div className="pulse-list">
              {pulse.length === 0 ? (
                <p className="small muted" style={{ padding: '16px 20px' }}>
                  Add some activity to see changes compared with the previous 30 days.
                </p>
              ) : (
                pulse.slice(0, 5).map((insight) => (
                  <Link key={insight.id} to={insight.link ?? '/'} className="pulse-item">
                    <span className={`pulse-marker ${insight.tone}`}>
                      <Icon
                        name={
                          insight.tone === 'positive'
                            ? 'trending-up'
                            : insight.category === 'bills'
                              ? 'calendar'
                              : insight.category === 'goals'
                                ? 'goals'
                                : insight.category === 'debt'
                                  ? 'debt'
                                  : 'alert'
                        }
                        size={16}
                      />
                    </span>
                    <span className="pulse-copy">
                      <strong>{insight.title}</strong>
                      <p>{insight.detail}</p>
                    </span>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card className="flush">
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div>
                <div className="card-title">Upcoming commitments</div>
                <div className="card-subtitle">Next 45 days · unpaid and scheduled</div>
              </div>
              <Link to="/bills" className="small">
                Calendar
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="small muted" style={{ padding: '16px 20px' }}>
                No scheduled bills in this window. Add a recurring bill to see it here.
              </p>
            ) : (
              <div>
                {upcoming.slice(0, 5).map((occurrence) => (
                  <div key={occurrence.id} className="account-mini">
                    <div className="bill-date">
                      <strong>{occurrence.date.slice(8, 10)}</strong>
                      <span>{formatMonth(occurrence.date, false).slice(0, 3)}</span>
                    </div>
                    <span className="name">{occurrence.name}</span>
                    {occurrence.status === 'overdue' ? <Badge tone="danger">Overdue</Badge> : null}
                    <span className="value">{money(occurrence.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="flush">
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div className="card-title">Accounts</div>
              <Link to="/accounts" className="small">
                Manage
              </Link>
            </div>
            <div className="accounts-mini">
              {balances.map((entry) => (
                <Link
                  key={entry.account.id}
                  to={`/accounts/${entry.account.id}`}
                  className="account-mini"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <span
                    className="account-dot"
                    style={{
                      background: isLiability(entry.account.type)
                        ? 'var(--warning)'
                        : 'var(--accent)',
                    }}
                  />
                  <span className="name">
                    {entry.account.name}
                    <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>
                      {accountTypeLabel(entry.account.type)}
                    </span>
                  </span>
                  <span className={`value ${entry.balance < 0 ? 'negative' : ''}`}>
                    {money(entry.balance)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-2">
        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Spending by category</div>
              <div className="card-subtitle">{formatMonth(today)} · net of refunds</div>
            </div>
            <Link to="/reports" className="small">
              Details
            </Link>
          </div>
          <div className="card-body">
            {categoryRows.length === 0 ? (
              <p className="small muted">No spending recorded this month.</p>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                {categoryRows.map((row) => (
                  <div key={row.categoryId ?? 'uncategorized'} className="progress-row">
                    <div className="progress-meta">
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                        {row.categoryName}
                      </span>
                      <span>
                        {money(row.amount)} · {Math.round(row.share)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={row.share}
                      label={`${row.categoryName} share of spending`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Goal progress</div>
              <div className="card-subtitle">Saved across active goals</div>
            </div>
            <Link to="/goals" className="small">
              All goals
            </Link>
          </div>
          <div className="card-body">
            {goals.length === 0 ? (
              <p className="small muted">No savings goals yet. Create one to track progress.</p>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                {goals.slice(0, 4).map((row) => (
                  <Link
                    key={row.goal.id}
                    to={`/goals/${row.goal.id}`}
                    className="progress-row"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <div className="progress-meta">
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{row.goal.name}</span>
                      <span>
                        {money(row.balance)} / {money(row.goal.targetAmount)}
                      </span>
                    </div>
                    <ProgressBar
                      value={row.progress}
                      tone={row.progress >= 100 ? 'positive' : undefined}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        Projections are estimates built from recorded plans. They are not financial advice.
      </p>

      <Dialog
        open={quickAdd}
        onClose={() => setQuickAdd(false)}
        title="Quick add transaction"
        description="Amount, account and description are all you need."
      >
        <TransactionForm
          presetType="expense"
          compact
          onCancel={() => setQuickAdd(false)}
          onSaved={() => setQuickAdd(false)}
        />
      </Dialog>
    </div>
  );
}
