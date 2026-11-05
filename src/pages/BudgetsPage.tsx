import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildBudgetView } from '../domain/budgets';
import { formatMonth } from '../domain/dates';
import { duplicateBudgetToNextPeriod } from '../db/budgets';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  LoadingPage,
  PageIntro,
  ProgressBar,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { BudgetForm } from '../components/DataForms';

export function BudgetsPage() {
  const { data, loading } = useData();
  const { money } = useFormatters();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const views = useMemo(() => {
    return [...data.budgets]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((budget) =>
        buildBudgetView({
          budget,
          allocations: data.allocations,
          transactions: data.transactions,
          categories: data.categories,
        }),
      );
  }, [data.budgets, data.allocations, data.transactions, data.categories]);

  async function duplicate(id: string) {
    setBusyId(id);
    try {
      const created = await duplicateBudgetToNextPeriod(id);
      toast(
        created
          ? 'Budget copied to the next period with the same allocations.'
          : 'A budget already exists for the next period.',
        created ? 'success' : 'default',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not copy the budget.', 'danger');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="stack">
      <PageIntro
        title="Plan spending before it happens"
        description="Allocate amounts to expense categories, then compare the plan with recorded activity. Allocations never affect account balances."
        actions={
          <Button
            variant="primary"
            onClick={() => setCreateOpen(true)}
            icon={<Icon name="plus" size={17} />}
          >
            New budget
          </Button>
        }
      />

      {views.length === 0 ? (
        <Card>
          <EmptyState
            icon="budget"
            title="No budgets yet"
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create your first budget
              </Button>
            }
          >
            A budget is a plan for expense categories over a month or a custom range. Nothing is
            deducted automatically; you decide the allocations.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-2">
          {views.map((view) => {
            const percentUsed = view.progress;
            return (
              <div key={view.budget.id} className="card card-pad stack" style={{ gap: 14 }}>
                <div className="row-between">
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <h3 style={{ fontSize: 16 }}>{view.budget.name}</h3>
                      <Badge tone="accent">
                        {view.budget.period === 'monthly' ? 'Monthly' : 'Custom'}
                      </Badge>
                    </div>
                    <p className="small muted" style={{ marginTop: 3 }}>
                      {view.budget.period === 'monthly'
                        ? formatMonth(view.bounds.start)
                        : `${view.bounds.start} → ${view.bounds.end}`}
                    </p>
                  </div>
                  <Link to={`/budgets/${view.budget.id}`} className="btn btn-secondary btn-sm">
                    Open
                  </Link>
                </div>

                <div className="progress-row">
                  <div className="progress-meta">
                    <span>
                      {money(view.totalSpent)} spent of {money(view.totalBudgeted)}
                    </span>
                    <span className={view.remaining < 0 ? 'negative' : ''}>
                      {view.remaining >= 0
                        ? `${money(view.remaining)} left`
                        : `${money(-view.remaining)} over`}
                    </span>
                  </div>
                  <ProgressBar
                    value={percentUsed}
                    tone={percentUsed > 100 ? 'danger' : percentUsed > 85 ? 'warning' : 'positive'}
                    label={`${view.budget.name} budget used`}
                  />
                </div>

                <div className="row-between tiny muted">
                  <span>{view.allocations.length} allocated categories</span>
                  <span>
                    Overspent in {view.allocations.filter((row) => row.overspent).length} categories
                  </span>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => duplicate(view.budget.id)}
                    disabled={busyId === view.budget.id}
                    icon={<Icon name="repeat" size={14} />}
                  >
                    {busyId === view.budget.id ? 'Copying…' : 'Copy to next month'}
                  </Button>
                  <Link
                    to={`/transactions?from=${view.bounds.start}&to=${view.bounds.end}`}
                    className="btn btn-ghost btn-sm"
                  >
                    View activity
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="notice">
        <Icon name="info" size={17} />
        <span>
          Spending includes expense transactions minus refunds assigned to expense categories.
          Transfers and income categories are excluded. Subcategory spending counts toward its
          parent allocation.
        </span>
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New budget"
        description="Choose a month or a custom range, then add category allocations."
      >
        <BudgetForm onCancel={() => setCreateOpen(false)} onSaved={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
