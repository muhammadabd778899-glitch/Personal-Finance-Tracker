import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { Transaction } from '../domain/types';
import { toCSV, CSV_HEADERS } from '../domain/csv';
import { addDays, compareDates, monthKey, startOfMonth, endOfMonth } from '../domain/dates';
import { useData, useFormatters } from '../state/DataContext';
import { Badge, Button, EmptyState, PageIntro } from '../components/ui';
import { Icon } from '../components/icons';
import { downloadText, todayStamp } from '../lib/files';
import { accountName, categoryName } from './helpers';

const PAGE_SIZE = 50;

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export function TransactionsPage() {
  const { data, loading, today } = useData();
  const { money, date } = useFormatters();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const type = searchParams.get('type') ?? '';
  const accountId = searchParams.get('account') ?? '';
  const categoryId = searchParams.get('category') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const sort = (searchParams.get('sort') as SortKey) ?? 'date-desc';
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const categoryMap = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );

  const categoryFamily = useMemo(() => {
    if (!categoryId) return null;
    const category = categoryMap.get(categoryId);
    if (!category) return new Set([categoryId]);
    const ids = new Set([categoryId]);
    if (!category.parentId) {
      for (const candidate of data.categories) {
        if (candidate.parentId === categoryId) ids.add(candidate.id);
      }
    }
    return ids;
  }, [categoryId, categoryMap, data.categories]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const list = data.transactions.filter((tx) => {
      if (type && tx.type !== type) return false;
      if (accountId && tx.accountId !== accountId && tx.transferAccountId !== accountId)
        return false;
      if (categoryFamily && (!tx.categoryId || !categoryFamily.has(tx.categoryId))) return false;
      if (from && tx.date < from) return false;
      if (to && tx.date > to) return false;
      if (search) {
        const haystack = [
          tx.description,
          tx.payee ?? '',
          tx.notes ?? '',
          tx.tags.join(' '),
          accountName(data.accounts, tx.accountId),
          categoryName(data.categories, tx.categoryId),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return compareDates(a.date, b.date) || a.createdAt.localeCompare(b.createdAt);
        case 'amount-desc':
          return b.amount - a.amount || compareDates(b.date, a.date);
        case 'amount-asc':
          return a.amount - b.amount || compareDates(b.date, a.date);
        case 'date-desc':
        default:
          return compareDates(b.date, a.date) || b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [
    data.transactions,
    data.accounts,
    data.categories,
    type,
    accountId,
    categoryFamily,
    from,
    to,
    query,
    sort,
  ]);

  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let transfers = 0;
    for (const tx of filtered) {
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expenses += tx.amount;
      if (tx.type === 'transfer') transfers += tx.amount;
    }
    return { income, expenses, transfers };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = Boolean(query || type || accountId || categoryId || from || to);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next, { replace: true });
  }

  function setDatePreset(preset: 'month' | '30' | 'year' | 'clear') {
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    if (preset === 'clear') {
      next.delete('from');
      next.delete('to');
    } else if (preset === 'month') {
      next.set('from', startOfMonth(today));
      next.set('to', endOfMonth(today));
    } else if (preset === '30') {
      next.set('from', addDays(today, -29));
      next.set('to', today);
    } else {
      next.set('from', `${today.slice(0, 4)}-01-01`);
      next.set('to', `${today.slice(0, 4)}-12-31`);
    }
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true });
  }

  function exportCsv() {
    const rows = filtered.map((tx) => [
      tx.date,
      tx.type,
      tx.description,
      tx.payee ?? '',
      tx.type === 'transfer' ? 'Transfer' : categoryName(data.categories, tx.categoryId),
      accountName(data.accounts, tx.accountId),
      tx.type === 'income' ? (tx.amount / 10 ** 2).toFixed(2) : (-tx.amount / 10 ** 2).toFixed(2),
      tx.notes ?? '',
    ]);
    downloadText(
      `transactions-${todayStamp()}.csv`,
      toCSV([...CSV_HEADERS], rows),
      'text/csv;charset=utf-8',
    );
  }

  const listContext = `${location.pathname}${location.search}`;

  return (
    <div className="stack">
      <PageIntro
        title="Every transaction, in one place"
        description="Search, filter and review income, spending and transfers. Transfers never inflate income or spending totals."
        actions={
          <>
            <Button
              onClick={exportCsv}
              icon={<Icon name="download" size={16} />}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
            <Link to="/transactions/new" className="btn btn-primary">
              <Icon name="plus" size={17} /> Add transaction
            </Link>
          </>
        }
      />

      <div className="stack" style={{ gap: 10 }}>
        <div className="toolbar">
          <div className="search">
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              placeholder="Search description, payee, notes or tag"
              aria-label="Search transactions"
              value={query}
              onChange={(event) => updateParam('q', event.target.value)}
            />
          </div>
          <select
            className="select"
            aria-label="Filter by type"
            value={type}
            onChange={(event) => updateParam('type', event.target.value)}
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="transfer">Transfer</option>
          </select>
          <select
            className="select"
            aria-label="Filter by account"
            value={accountId}
            onChange={(event) => updateParam('account', event.target.value)}
          >
            <option value="">All accounts</option>
            {data.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Filter by category"
            value={categoryId}
            onChange={(event) => updateParam('category', event.target.value)}
          >
            <option value="">All categories</option>
            {data.categories
              .filter((category) => !category.parentId)
              .map((category) => (
                <optgroup key={category.id} label={category.name}>
                  <option value={category.id}>{category.name} (all)</option>
                  {data.categories
                    .filter((child) => child.parentId === category.id)
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        {category.name} › {child.name}
                      </option>
                    ))}
                </optgroup>
              ))}
          </select>
          <input
            type="date"
            className="input"
            aria-label="From date"
            value={from}
            onChange={(event) => updateParam('from', event.target.value)}
          />
          <input
            type="date"
            className="input"
            aria-label="To date"
            value={to}
            onChange={(event) => updateParam('to', event.target.value)}
          />
          <select
            className="select"
            aria-label="Sort transactions"
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Largest amount</option>
            <option value="amount-asc">Smallest amount</option>
          </select>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          ) : null}
        </div>
        <div className="filter-summary">
          <span>
            {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
            {hasFilters ? ' matching filters' : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span className="positive">Income {money(totals.income)}</span>
          <span aria-hidden="true">·</span>
          <span>Spending {money(totals.expenses)}</span>
          <span aria-hidden="true">·</span>
          <span className="muted">Transfers {money(totals.transfers)}</span>
          <span className="grow" />
          <span className="row" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setDatePreset('month')}>
              This month
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDatePreset('30')}>
              Last 30 days
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDatePreset('year')}>
              This year
            </button>
            {from || to ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setDatePreset('clear')}>
                Any date
              </button>
            ) : null}
          </span>
        </div>
      </div>

      <div className="card flush">
        {loading ? (
          <div className="empty-state">Loading transactions…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon="transactions"
            title={hasFilters ? 'No transactions match these filters' : 'No transactions yet'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Link to="/transactions/new" className="btn btn-primary">
                  Add your first transaction
                </Link>
              )
            }
          >
            {hasFilters
              ? 'Try widening the date range or clearing one of the filters.'
              : 'Record income, spending or a transfer to start building your history.'}
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Category</th>
                    <th scope="col">Account</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((tx: Transaction) => (
                    <tr key={tx.id}>
                      <td className="nowrap muted small">{date(tx.date)}</td>
                      <td>
                        <Link
                          className="table-link"
                          to={`/transactions/${tx.id}`}
                          state={{ from: listContext }}
                        >
                          {tx.description}
                        </Link>
                        {tx.payee ? (
                          <span className="tiny muted" style={{ display: 'block' }}>
                            {tx.payee}
                          </span>
                        ) : null}
                      </td>
                      <td className="small">
                        {tx.type === 'transfer' ? (
                          <span className="muted">
                            → {accountName(data.accounts, tx.transferAccountId)}
                          </span>
                        ) : (
                          categoryName(data.categories, tx.categoryId)
                        )}
                      </td>
                      <td className="small muted">{accountName(data.accounts, tx.accountId)}</td>
                      <td>
                        <Badge
                          tone={
                            tx.type === 'income'
                              ? 'positive'
                              : tx.type === 'transfer'
                                ? 'info'
                                : 'neutral'
                          }
                        >
                          {tx.type === 'income'
                            ? 'Income'
                            : tx.type === 'transfer'
                              ? 'Transfer'
                              : 'Expense'}
                        </Badge>
                      </td>
                      <td
                        className={`num ${tx.type === 'income' ? 'positive' : tx.type === 'transfer' ? 'muted' : ''}`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '⇄ '}
                        {money(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pageCount > 1 ? (
              <div className="row" style={{ padding: 14, justifyContent: 'space-between' }}>
                <span className="small muted">
                  Page {safePage} of {pageCount} · showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)}
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={safePage <= 1}
                    onClick={() => updateParam('page', String(safePage - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={safePage >= pageCount}
                    onClick={() => updateParam('page', String(safePage + 1))}
                  >
                    Next
                  </Button>
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <p className="tiny muted">
        Filters live in the URL, so browser back/forward and direct links keep your list context.
        Month reference: {monthKey(today)}.
      </p>
    </div>
  );
}
