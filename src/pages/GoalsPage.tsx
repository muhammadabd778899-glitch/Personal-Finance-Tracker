import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { goalProgress, requiredMonthlyContribution, totalGoalSavings } from '../domain/goals';
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
} from '../components/ui';
import { Icon } from '../components/icons';
import { GoalForm } from '../components/DataForms';
import { goalTypeLabel } from './helpers';

export function GoalsPage() {
  const { data, loading, today } = useData();
  const { money } = useFormatters();
  const [createOpen, setCreateOpen] = useState(false);

  const goals = useMemo(
    () =>
      data.goals
        .filter((goal) => !goal.archived)
        .map((goal) => goalProgress(goal, data.contributions))
        .sort((a, b) => b.progress - a.progress),
    [data.goals, data.contributions],
  );
  const saved = totalGoalSavings(data.goals, data.contributions);
  const target = goals.reduce((sum, row) => sum + row.goal.targetAmount, 0);

  if (loading) return <LoadingPage />;

  return (
    <div className="stack">
      <PageIntro
        title="Save with a purpose"
        description="Track savings goals and sinking funds with contributions and withdrawals. These records do not move money between accounts automatically."
        actions={
          <Button
            variant="primary"
            onClick={() => setCreateOpen(true)}
            icon={<Icon name="plus" size={17} />}
          >
            New goal
          </Button>
        }
      />

      <div className="grid grid-3">
        <div className="stat-card">
          <div className="stat-label">Saved across goals</div>
          <div className="stat-value">{money(saved)}</div>
          <div className="stat-meta">{goals.length} active goals and funds</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined target</div>
          <div className="stat-value">{money(target)}</div>
          <div className="stat-meta">Net contributions are compared with each target</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className="stat-value">{money(Math.max(0, target - saved))}</div>
          <div className="stat-meta">Across all active goals</div>
        </div>
      </div>

      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon="goals"
            title="No savings goals yet"
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                Create a goal
              </Button>
            }
          >
            Set a target for an emergency fund, a trip, a purchase or a yearly expense. Add
            contributions whenever you set money aside.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-2">
          {goals.map((row) => {
            const needed = requiredMonthlyContribution(row.goal, data.contributions, today);
            return (
              <Link key={row.goal.id} to={`/goals/${row.goal.id}`} className="goal-card">
                <div className="goal-head">
                  <span
                    className="goal-dot"
                    style={{ background: row.goal.color ?? 'var(--accent)' }}
                  />
                  <h3>{row.goal.name}</h3>
                  <Badge tone={row.goal.type === 'sinking' ? 'info' : 'accent'}>
                    {goalTypeLabel(row.goal.type)}
                  </Badge>
                </div>
                <div className="row-between">
                  <span className="goal-progress-value">{money(row.balance)}</span>
                  <span className="small muted">of {money(row.goal.targetAmount)}</span>
                </div>
                <ProgressBar
                  value={row.progress}
                  tone={
                    row.progress >= 100 ? 'positive' : row.progress >= 60 ? undefined : 'warning'
                  }
                  label={`${row.goal.name} progress`}
                />
                <div className="goal-amounts">
                  <span>{Math.round(row.progress)}% complete</span>
                  <span>
                    {row.goal.targetDate
                      ? needed != null
                        ? `${money(needed)}/month to target`
                        : ''
                      : `${money(row.remaining)} remaining`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="notice">
        <Icon name="info" size={17} />
        <span>
          Goal balances are the sum of recorded contributions minus withdrawals. They are separate
          from account balances, so you can describe intent without creating extra transactions.
        </span>
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New savings goal">
        <GoalForm onCancel={() => setCreateOpen(false)} onSaved={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
