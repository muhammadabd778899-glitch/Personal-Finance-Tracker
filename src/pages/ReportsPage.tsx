import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { addMonths, endOfMonth, formatMonth, startOfMonth } from '../domain/dates';
import { buildReport, budgetPerformance, defaultReportRange } from '../domain/reports';
import { toCSV } from '../domain/csv';
import { useData, useFormatters } from '../state/DataContext';
import { BarChart, DonutChart } from '../components/charts';
import { DONUT_COLORS } from '../components/chartPalette';
import { Badge, Button, Card, EmptyState, PageIntro, ProgressBar } from '../components/ui';
import { Icon } from '../components/icons';
import { downloadText, todayStamp } from '../lib/files';
import { accountName } from './helpers';

export function ReportsPage() {
  const { data, today } = useData();
  const { money, date, currency, digits } = useFormatters();
  const [searchParams, setSearchParams] = useSearchParams();
  const fallback = defaultReportRange(today);
  const from = searchParams.get('from') ?? fallback.from;
  const to = searchParams.get('to') ?? fallback.to;

  const report = useMemo(
    () => buildReport(data.transactions, data.categories, from, to),
    [data.transactions, data.categories, from, to],
  );
  const budgets = useMemo(
    () =>
      budgetPerformance(
        data.budgets,
        data.allocations,
        data.transactions,
        data.categories,
        from,
        to,
      ),
    [data.budgets, data.allocations, data.transactions, data.categories, from, to],
  );

  function setRange(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(searchParams);
    next.set('from', nextFrom);
    next.set('to', nextTo);
    setSearchParams(next, { replace: true });
  }

  function preset(kind: 'month' | 'quarter' | 'year') {
    if (kind === 'month') setRange(startOfMonth(today), endOfMonth(today));
    else if (kind === 'quarter') setRange(startOfMonth(addMonths(today, -2)), endOfMonth(today));
    else setRange(`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`);
  }

  function exportSummary() {
    const rows: (string | number)[][] = [
      ['Report', 'Value'],
      ['From', from],
      ['To', to],
      ['Income', (report.income / 10 ** digits).toFixed(digits)],
      ['Expenses', (report.expenses / 10 ** digits).toFixed(digits)],
      ['Refunds (expense categories)', (report.refunds / 10 ** digits).toFixed(digits)],
      ['Net spending', (report.netSpending / 10 ** digits).toFixed(digits)],
      ['Net cash flow', (report.net / 10 ** digits).toFixed(digits)],
      ['Savings rate %', report.savingsRate.toFixed(1)],
      [],
      ['Category', `Amount (${currency})`, 'Share %'],
      ...report.categories.map((row) => [
        row.categoryName,
        (row.amount / 10 ** digits).toFixed(digits),
        row.share.toFixed(1),
      ]),
    ];
    downloadText(
      `finance-report-${todayStamp()}.csv`,
      toCSV(rows[0].map(String), rows.slice(1)),
      'text/csv;charset=utf-8',
    );
  }

  function exportTransactions() {
    const rows = report.transactions.map((tx) => [
      tx.date,
      tx.type,
      tx.description,
      tx.payee ?? '',
      data.categories.find((category) => category.id === tx.categoryId)?.name ?? '',
      accountName(data.accounts, tx.accountId),
      (tx.amount / 10 ** digits).toFixed(digits),
      tx.notes ?? '',
    ]);
    downloadText(
      `transactions-${from}-to-${to}.csv`,
      toCSV(
        ['Date', 'Type', 'Description', 'Payee', 'Category', 'Account', 'Amount', 'Notes'],
        rows,
      ),
      'text/csv;charset=utf-8',
    );
  }

  return (
    <div className="stack">
      <PageIntro
        title="Understand where the money went"
        description="Every report states its period and links to the transactions behind each figure. Transfers are excluded from income and spending."
        actions={
          <>
            <Button
              onClick={exportSummary}
              icon={<Icon name="download" size={16} />}
              disabled={report.transactions.length === 0}
            >
              Export summary
            </Button>
            <Button
              onClick={exportTransactions}
              variant="secondary"
              disabled={report.transactions.length === 0}
            >
              Export transactions
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <span className="small muted">Period</span>
        <input
          type="date"
          className="input"
          aria-label="Report start date"
          value={from}
          onChange={(event) => setRange(event.target.value, to)}
        />
        <span className="muted">→</span>
        <input
          type="date"
          className="input"
          aria-label="Report end date"
          value={to}
          onChange={(event) => setRange(from, event.target.value)}
        />
        <span className="grow" />
        <Button size="sm" variant="ghost" onClick={() => preset('month')}>
          This month
        </Button>
        <Button size="sm" variant="ghost" onClick={() => preset('quarter')}>
          Last 3 months
        </Button>
        <Button size="sm" variant="ghost" onClick={() => preset('year')}>
          This year
        </Button>
      </div>

      <div className="grid grid-4">
        <div className="report-metric">
          <span className="label">Income</span>
          <span className="value positive">{money(report.income)}</span>
          <span className="tiny muted">Excludes refunds credited to expense categories</span>
        </div>
        <div className="report-metric">
          <span className="label">Net spending</span>
          <span className="value">{money(report.netSpending)}</span>
          <span className="tiny muted">
            {money(report.expenses)} expenses − {money(report.refunds)} refunds
          </span>
        </div>
        <div className="report-metric">
          <span className="label">Net cash flow</span>
          <span className={`value ${report.net < 0 ? 'negative' : ''}`}>{money(report.net)}</span>
          <span className="tiny muted">Income − net spending</span>
        </div>
        <div className="report-metric">
          <span className="label">Savings rate</span>
          <span className="value">
            {report.income > 0 ? `${report.savingsRate.toFixed(0)}%` : '—'}
          </span>
          <span className="tiny muted">(Income − net spending) ÷ income</span>
        </div>
      </div>

      <div className="grid grid-main">
        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Income and spending by month</div>
              <div className="card-subtitle">
                {formatMonth(from, false)} – {formatMonth(to, false)} · {report.transactionCount}{' '}
                transactions
              </div>
            </div>
            <Badge tone="accent">Actual records</Badge>
          </div>
          <div className="card-body">
            <BarChart
              data={report.monthly.map((point) => ({
                label: formatMonth(point.month, false).slice(0, 3),
                value: point.income,
                secondary: point.expenses,
              }))}
              format={(value) => money(value, { compact: true })}
              ariaLabel="Monthly income and spending"
              secondaryLabel="Spending"
            />
          </div>
        </Card>

        <Card className="card-pad">
          <h3 className="card-title">Report details</h3>
          <dl
            className="detail-list"
            style={{ marginTop: 14, gridTemplateColumns: 'minmax(0, 1fr)' }}
          >
            <div>
              <dt>Period</dt>
              <dd>
                {date(from)} → {date(to)}
              </dd>
            </div>
            <div>
              <dt>Transactions included</dt>
              <dd>{report.transactionCount}</dd>
            </div>
            <div>
              <dt>Average monthly spending</dt>
              <dd>{money(report.averageMonthlySpending)}</dd>
            </div>
            <div>
              <dt>Average expense</dt>
              <dd>{money(report.averageExpense)}</dd>
            </div>
            <div>
              <dt>Refunds credited</dt>
              <dd>{money(report.refunds)}</dd>
            </div>
          </dl>
          <details className="chart-toggle" style={{ marginTop: 14 }}>
            <summary>How these numbers are calculated</summary>
            <p className="small muted" style={{ marginTop: 8 }}>
              Income sums income transactions in income categories. Expenses sum expense
              transactions. Refunds are income transactions assigned to an expense category and are
              subtracted from spending. Transfers are ignored. The savings rate is shown only when
              income exists.
            </p>
          </details>
        </Card>
      </div>

      <Card className="flush">
        <div className="card-header" style={{ paddingBottom: 14 }}>
          <div>
            <div className="card-title">Spending by category</div>
            <div className="card-subtitle">Subcategory spending is grouped under its parent</div>
          </div>
          <Link to={`/transactions?from=${from}&to=${to}&type=expense`} className="small">
            View all expenses
          </Link>
        </div>
        {report.categories.length === 0 ? (
          <EmptyState icon="reports" title="No spending in this period">
            Choose a wider date range, or record some transactions.
          </EmptyState>
        ) : (
          <>
            <div className="reports-donut">
              <div className="donut-layout">
                <DonutChart
                  data={report.categories.map((row) => ({
                    label: row.categoryName,
                    value: row.amount,
                  }))}
                  format={(value) => money(value)}
                  centerValue={money(report.netSpending, { compact: true })}
                  centerLabel="Net spending"
                  ariaLabel="Spending distribution by category for the selected period"
                />
                <ul className="donut-legend">
                  {report.categories.map((row, index) => (
                    <li key={row.categoryId ?? 'uncategorized'}>
                      <span
                        className="dot"
                        style={{
                          background: DONUT_COLORS[index % DONUT_COLORS.length],
                          color: DONUT_COLORS[index % DONUT_COLORS.length],
                        }}
                      />
                      <span className="name">{row.categoryName}</span>
                      <span className="share">
                        {money(row.amount)} · {row.share.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col" className="num">
                      Share
                    </th>
                    <th scope="col" style={{ width: '30%' }}>
                      Distribution
                    </th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((row) => (
                    <tr key={row.categoryId ?? 'uncategorized'}>
                      <td className="table-link">{row.categoryName}</td>
                      <td className="num">{money(row.amount)}</td>
                      <td className="num">{row.share.toFixed(1)}%</td>
                      <td>
                        <ProgressBar value={row.share} label={`${row.categoryName} share`} />
                      </td>
                      <td className="actions">
                        <Link
                          to={`/transactions?from=${from}&to=${to}&type=expense${row.categoryId ? `&category=${row.categoryId}` : ''}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Drill down
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-2">
        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <div className="card-title">Largest expenses</div>
          </div>
          {report.largestExpenses.length === 0 ? (
            <p className="small muted" style={{ padding: '0 20px 20px' }}>
              None in this period.
            </p>
          ) : (
            <div style={{ padding: '0 20px 16px' }}>
              {report.largestExpenses.map((tx, index) => (
                <div key={tx.id} className="rank-row">
                  <span className="rank">{index + 1}</span>
                  <Link
                    className="label"
                    to={`/transactions/${tx.id}`}
                    state={{ from: '/reports' }}
                  >
                    {tx.description}
                  </Link>
                  <span className="value">{money(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <div>
              <div className="card-title">Budget performance</div>
              <div className="card-subtitle">Budgets overlapping this period</div>
            </div>
            <Link to="/budgets" className="small">
              Budgets
            </Link>
          </div>
          {budgets.length === 0 ? (
            <p className="small muted" style={{ padding: '0 20px 20px' }}>
              No budgets overlap this period.
            </p>
          ) : (
            <div style={{ padding: '0 20px 16px' }}>
              {budgets.map((budget) => (
                <div key={budget.name} className="budget-row">
                  <div className="budget-row-head">
                    <strong>{budget.name}</strong>
                    <span className="numbers">
                      {money(budget.spent)} of {money(budget.budgeted)}
                    </span>
                  </div>
                  <ProgressBar
                    value={budget.budgeted > 0 ? (budget.spent / budget.budgeted) * 100 : 0}
                    tone={budget.remaining < 0 ? 'danger' : 'positive'}
                    label={`${budget.name} used`}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="tiny muted">
        Report generated from local records on {date(today)}. Amounts shown in {currency}. No data
        was sent anywhere to produce this report.
      </p>
    </div>
  );
}
