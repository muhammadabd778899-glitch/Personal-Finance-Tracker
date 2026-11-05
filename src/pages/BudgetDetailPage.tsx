import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildBudgetView } from '../domain/budgets';
import { formatMonth } from '../domain/dates';
import { parseAmountToMinor } from '../domain/money';
import {
  deleteBudget,
  duplicateBudgetToNextPeriod,
  removeAllocation,
  setAllocation,
} from '../db/budgets';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  ProgressBar,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { BudgetForm } from '../components/DataForms';

export function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading } = useData();
  const { money, date, digits } = useFormatters();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const budget = data.budgets.find((entry) => entry.id === id);
  const view = useMemo(
    () =>
      budget
        ? buildBudgetView({
            budget,
            allocations: data.allocations,
            transactions: data.transactions,
            categories: data.categories,
          })
        : null,
    [budget, data.allocations, data.transactions, data.categories],
  );

  if (loading) return <div className="skeleton" style={{ height: 280 }} />;

  if (!budget || !view) {
    return (
      <Card>
        <EmptyState
          icon="budget"
          title="Budget not found"
          action={
            <Link to="/budgets" className="btn btn-primary">
              Back to budgets
            </Link>
          }
        >
          This budget may have been deleted, or the link may be out of date.
        </EmptyState>
      </Card>
    );
  }

  const allocatedIds = new Set(
    data.allocations
      .filter((allocation) => allocation.budgetId === budget.id)
      .map((allocation) => allocation.categoryId),
  );
  const availableCategories = data.categories.filter(
    (category) => !category.archived && category.kind === 'expense' && !category.parentId,
  );
  const periodLabel =
    budget.period === 'monthly'
      ? formatMonth(view.bounds.start)
      : `${view.bounds.start} → ${view.bounds.end}`;

  function openAllocate(presetCategory?: string, presetAmount?: string) {
    setCategoryId(presetCategory ?? '');
    setAmount(presetAmount ?? '');
    setFormError(null);
    setAllocateOpen(true);
  }

  async function saveAllocation(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!categoryId) return setFormError('Choose an expense category.');
    const parsed = parseAmountToMinor(amount || '0', digits);
    if (parsed == null || parsed < 0) return setFormError('Enter a valid planned amount.');
    setBusy(true);
    try {
      await setAllocation(budget!.id, categoryId, parsed);
      toast('Allocation saved.', 'success');
      setAllocateOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the allocation.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAllocation(allocationId: string) {
    try {
      await removeAllocation(allocationId);
      toast('Allocation removed.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not remove the allocation.', 'danger');
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteBudget(budget!.id);
      toast('Budget deleted. Transactions were not changed.', 'success');
      navigate('/budgets', { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the budget.', 'danger');
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const created = await duplicateBudgetToNextPeriod(budget!.id);
      if (created) {
        toast('Budget copied to the next period.', 'success');
        navigate(`/budgets/${created.id}`);
      } else {
        toast('A budget already exists for the next period.');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not copy the budget.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <Link to="/budgets" className="btn btn-ghost btn-sm">
          <Icon name="chevron-left" size={15} /> Back to budgets
        </Link>
        <span className="tiny muted">
          {view.bounds.start} → {view.bounds.end}
        </span>
      </div>

      <div className="detail-hero">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Badge tone="accent">
              {budget.period === 'monthly' ? 'Monthly budget' : 'Custom period'}
            </Badge>
            <Badge>{view.allocations.length} categories</Badge>
          </div>
          <h2>{budget.name}</h2>
          <p className="sub">{periodLabel}</p>
          <div className="row" style={{ gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="tiny muted">Planned</div>
              <strong className="tabular">{money(view.totalBudgeted)}</strong>
            </div>
            <div>
              <div className="tiny muted">Spent</div>
              <strong className="tabular">{money(view.totalSpent)}</strong>
            </div>
            <div>
              <div className="tiny muted">Remaining</div>
              <strong className={`tabular ${view.remaining < 0 ? 'negative' : 'positive'}`}>
                {money(view.remaining)}
              </strong>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <Button
            variant="primary"
            onClick={() => openAllocate()}
            icon={<Icon name="plus" size={16} />}
          >
            Add allocation
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            icon={<Icon name="edit" size={16} />}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={duplicate}
            disabled={busy}
            icon={<Icon name="repeat" size={15} />}
          >
            Copy
          </Button>
          <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="flush">
        <div className="card-header" style={{ paddingBottom: 12 }}>
          <div>
            <div className="card-title">Category allocations</div>
            <div className="card-subtitle">
              Spent is net of refunds and includes subcategory activity. Totals reconcile with the
              transaction list.
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link
              to={`/transactions?from=${view.bounds.start}&to=${view.bounds.end}`}
              className="btn btn-ghost btn-sm"
            >
              All period activity
            </Link>
          </div>
        </div>

        {view.allocations.length === 0 ? (
          <EmptyState
            icon="budget"
            title="No allocations yet"
            action={
              <Button variant="primary" size="sm" onClick={() => openAllocate()}>
                Add your first allocation
              </Button>
            }
          >
            Allocate amounts to expense categories to compare your plan with actual spending.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="num">
                    Planned
                  </th>
                  <th scope="col" className="num">
                    Spent
                  </th>
                  <th scope="col" className="num">
                    Remaining
                  </th>
                  <th scope="col" style={{ width: '22%' }}>
                    Progress
                  </th>
                  <th scope="col" className="actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.allocations.map((row) => (
                  <tr key={row.allocation.id}>
                    <td>
                      <Link
                        to={`/transactions?category=${row.allocation.categoryId}&from=${view.bounds.start}&to=${view.bounds.end}`}
                        className="table-link"
                      >
                        {row.category?.name ?? 'Missing category'}
                      </Link>
                      {row.category?.parentId ? (
                        <span className="tiny muted" style={{ display: 'block' }}>
                          Subcategory
                        </span>
                      ) : null}
                    </td>
                    <td className="num">{money(row.budgeted)}</td>
                    <td className="num">{money(row.spent)}</td>
                    <td className={`num ${row.remaining < 0 ? 'negative' : ''}`}>
                      {money(row.remaining)}
                    </td>
                    <td>
                      <ProgressBar
                        value={row.progress}
                        tone={
                          row.progress > 100 ? 'danger' : row.progress > 85 ? 'warning' : 'positive'
                        }
                        label={`${row.category?.name ?? 'Category'} used`}
                      />
                      <span className="tiny muted">{Math.round(row.progress)}% used</span>
                    </td>
                    <td className="actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          openAllocate(
                            row.allocation.categoryId,
                            (row.budgeted / 10 ** digits).toFixed(digits),
                          )
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-ghost"
                        onClick={() => handleDeleteAllocation(row.allocation.id)}
                        aria-label={`Remove allocation for ${row.category?.name ?? 'category'}`}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="num">
                    <strong>{money(view.totalBudgeted)}</strong>
                  </td>
                  <td className="num">
                    <strong>{money(view.totalSpent)}</strong>
                  </td>
                  <td className={`num ${view.remaining < 0 ? 'negative' : ''}`}>
                    <strong>{money(view.remaining)}</strong>
                  </td>
                  <td colSpan={2}>
                    <ProgressBar
                      value={view.progress}
                      tone={
                        view.progress > 100 ? 'danger' : view.progress > 85 ? 'warning' : 'positive'
                      }
                      label="Total budget used"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {view.unallocatedSpent !== 0 ? (
        <div className="notice notice-warning">
          <Icon name="alert" size={17} />
          <span>
            {money(view.unallocatedSpent)} of activity in this period is in categories with no
            allocation, so it is not included in the totals above.{' '}
            <Link to={`/transactions?from=${view.bounds.start}&to=${view.bounds.end}&type=expense`}>
              Review those transactions
            </Link>
            .
          </span>
        </div>
      ) : null}

      <div className="grid grid-2">
        <Card className="card-pad">
          <h3 className="card-title">How this budget is calculated</h3>
          <ul className="small muted" style={{ margin: '10px 0 0', paddingLeft: 18 }}>
            <li>Planned amounts come only from allocations you set.</li>
            <li>Spent = expenses − refunds in allocated categories, including subcategories.</li>
            <li>Transfers are excluded. Uncategorized spending is listed separately.</li>
            <li>Editing a historical transaction immediately changes this view.</li>
            <li>Rollover from previous periods is not applied.</li>
          </ul>
        </Card>
        <Card className="card-pad">
          <h3 className="card-title">Period details</h3>
          <dl className="detail-list" style={{ marginTop: 12 }}>
            <div>
              <dt>Start</dt>
              <dd>{date(view.bounds.start)}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{date(view.bounds.end)}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{budget.currency}</dd>
            </div>
            <div>
              <dt>Recorded activity</dt>
              <dd>{view.transactionCount} transactions</dd>
            </div>
          </dl>
          {budget.notes ? (
            <p className="small muted" style={{ marginTop: 12 }}>
              {budget.notes}
            </p>
          ) : null}
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit budget">
        <BudgetForm
          initial={budget}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>

      <Dialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        title={categoryId && allocatedIds.has(categoryId) ? 'Update allocation' : 'Add allocation'}
        description="Allocations are planned amounts. They never post transactions."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAllocateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                (
                  document.getElementById('allocation-form') as HTMLFormElement | null
                )?.requestSubmit()
              }
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save allocation'}
            </Button>
          </>
        }
      >
        <form id="allocation-form" className="stack" onSubmit={saveAllocation} noValidate>
          <Field label="Expense category" htmlFor="allocation-category">
            <select
              id="allocation-category"
              className="select"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">Choose a category</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {allocatedIds.has(category.id) ? ' (allocated)' : ''}
                </option>
              ))}
              {data.categories
                .filter((category) => category.parentId && !category.archived)
                .map((child) => {
                  const parent = data.categories.find((c) => c.id === child.parentId);
                  return (
                    <option key={child.id} value={child.id}>
                      {parent?.name} › {child.name}
                      {allocatedIds.has(child.id) ? ' (allocated)' : ''}
                    </option>
                  );
                })}
            </select>
          </Field>
          <Field
            label="Planned amount"
            htmlFor="allocation-amount"
            hint="Zero is allowed and keeps the category visible."
          >
            <input
              id="allocation-amount"
              className="input tabular"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          {formError ? (
            <div className="form-alert" role="alert">
              {formError}
            </div>
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this budget?"
        description="Only the plan is removed. Transactions and account balances stay unchanged."
        confirmLabel="Delete budget"
        danger
        busy={busy}
      />
    </div>
  );
}
