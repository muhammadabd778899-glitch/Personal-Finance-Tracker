import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  balancesForAccounts,
  isLiability,
  netWorth,
  totalAssets,
  totalLiabilities,
} from '../domain/accounts';
import { formatMonth } from '../domain/dates';
import { buildNetWorth } from '../domain/networth';
import { useData, useFormatters } from '../state/DataContext';
import { LineChart } from '../components/charts';
import { Badge, Card, LoadingPage, PageIntro, ProgressBar } from '../components/ui';
import { Icon } from '../components/icons';
import { accountTypeLabel } from './helpers';

export function NetWorthPage() {
  const { data, loading, today } = useData();
  const { money } = useFormatters();

  const accounts = useMemo(
    () => data.accounts.filter((account) => !account.archived),
    [data.accounts],
  );
  const balances = useMemo(
    () => balancesForAccounts(accounts, data.transactions),
    [accounts, data.transactions],
  );
  const summary = useMemo(
    () => buildNetWorth(accounts, data.transactions, 12, today),
    [accounts, data.transactions, today],
  );
  const assets = totalAssets(balances);
  const liabilities = totalLiabilities(balances);
  const net = netWorth(balances);
  const assetEntries = balances
    .filter((entry) => !isLiability(entry.account.type))
    .sort((a, b) => b.balance - a.balance);
  const liabilityEntries = balances
    .filter((entry) => isLiability(entry.account.type))
    .sort((a, b) => b.owed - a.owed);

  if (loading) return <LoadingPage />;

  return (
    <div className="stack">
      <PageIntro
        title="Net worth over time"
        description="Net worth = assets − liabilities. Every point is derived from account balances on that date, using recorded transactions up to that day."
      />

      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-label">Net worth</div>
          <div className={`stat-value ${net < 0 ? 'negative' : ''}`}>{money(net)}</div>
          <div className="stat-meta">
            <span className={summary.change30Days >= 0 ? 'positive' : 'negative'}>
              {summary.change30Days >= 0 ? '+' : '−'}
              {money(Math.abs(summary.change30Days))}
            </span>{' '}
            in 30 days
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assets</div>
          <div className="stat-value positive">{money(assets)}</div>
          <div className="stat-meta">{assetEntries.length} accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Liabilities</div>
          <div className="stat-value">{money(liabilities)}</div>
          <div className="stat-meta">{liabilityEntries.length} accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Liability ratio</div>
          <div className="stat-value">
            {assets + liabilities > 0
              ? `${Math.round((liabilities / Math.max(1, assets + liabilities)) * 100)}%`
              : '—'}
          </div>
          <div className="stat-meta">Liabilities ÷ total gross balance</div>
        </div>
      </div>

      <Card>
        <div className="card-header">
          <div>
            <div className="card-title">Twelve-month trend</div>
            <div className="card-subtitle">Month-end net worth, ending today</div>
          </div>
          <Badge tone="accent">Derived from records</Badge>
        </div>
        <div className="card-body">
          <LineChart
            data={summary.series.map((point) => ({
              date: point.date,
              value: point.net,
              label: formatMonth(point.date, false),
            }))}
            format={(value) => money(value, { compact: true })}
            ariaLabel="Net worth by month for the last twelve months"
          />
        </div>
      </Card>

      <div className="grid grid-2">
        <Card className="card-pad">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h3 className="card-title">Assets</h3>
            <span className="small muted">{money(assets)}</span>
          </div>
          {assetEntries.length === 0 ? (
            <p className="small muted">No asset accounts.</p>
          ) : (
            <div className="nw-breakdown">
              {assetEntries.map((entry) => (
                <div key={entry.account.id}>
                  <div className="row-between">
                    <Link to={`/accounts/${entry.account.id}`} className="small">
                      {entry.account.name}
                    </Link>
                    <span className="small tabular">{money(entry.balance)}</span>
                  </div>
                  <div className="nw-row" style={{ marginTop: 6 }}>
                    <div className="bar">
                      <span
                        style={{
                          width: `${assets > 0 ? Math.max(2, (Math.max(0, entry.balance) / assets) * 100) : 0}%`,
                          background: 'var(--positive)',
                        }}
                      />
                    </div>
                    <span className="tiny muted">{accountTypeLabel(entry.account.type)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <div className="row-between" style={{ marginBottom: 14 }}>
            <h3 className="card-title">Liabilities</h3>
            <span className="small muted">{money(liabilities)}</span>
          </div>
          {liabilityEntries.length === 0 ? (
            <p className="small muted">No liabilities recorded.</p>
          ) : (
            <div className="nw-breakdown">
              {liabilityEntries.map((entry) => (
                <div key={entry.account.id}>
                  <div className="row-between">
                    <Link to={`/accounts/${entry.account.id}`} className="small">
                      {entry.account.name}
                    </Link>
                    <span className="small tabular">{money(entry.owed)}</span>
                  </div>
                  <div className="nw-row" style={{ marginTop: 6 }}>
                    <div className="bar">
                      <span
                        style={{
                          width: `${liabilities > 0 ? Math.max(2, (entry.owed / liabilities) * 100) : 0}%`,
                          background: 'var(--warning)',
                        }}
                      />
                    </div>
                    <span className="tiny muted">{accountTypeLabel(entry.account.type)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="flush">
        <div className="card-header" style={{ paddingBottom: 12 }}>
          <div>
            <div className="card-title">Monthly history</div>
            <div className="card-subtitle">Net worth at each month end</div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="num">
                  Assets
                </th>
                <th scope="col" className="num">
                  Liabilities
                </th>
                <th scope="col" className="num">
                  Net worth
                </th>
                <th scope="col" style={{ width: '26%' }}>
                  Composition
                </th>
              </tr>
            </thead>
            <tbody>
              {[...summary.series].reverse().map((point) => (
                <tr key={point.date}>
                  <td>{formatMonth(point.date)}</td>
                  <td className="num positive">{money(point.assets)}</td>
                  <td className="num">{money(point.liabilities)}</td>
                  <td className={`num ${point.net < 0 ? 'negative' : ''}`}>{money(point.net)}</td>
                  <td>
                    <ProgressBar
                      value={
                        point.assets + point.liabilities > 0
                          ? (point.assets / (point.assets + point.liabilities)) * 100
                          : 0
                      }
                      tone="positive"
                      label="Share of gross balance held in assets"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="notice">
        <Icon name="info" size={17} />
        <span>
          Investment and property values are only as current as your recorded balances. This app
          does not fetch market prices, and it does not predict returns.
        </span>
      </div>
    </div>
  );
}
