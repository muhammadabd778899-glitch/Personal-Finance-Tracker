import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addContribution,
  archiveGoal,
  deleteContribution,
  deleteGoal,
  updateGoal,
} from '../db/planning';
import { diffDays, todayISO } from '../domain/dates';
import { goalProgress, requiredMonthlyContribution } from '../domain/goals';
import { parseAmountToMinor } from '../domain/money';
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
import { GoalForm } from '../components/DataForms';
import { accountName, goalTypeLabel } from './helpers';

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, today } = useData();
  const { money, date, digits } = useFormatters();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [direction, setDirection] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [contribDate, setContribDate] = useState(todayISO());
  const [accountId, setAccountId] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmGoalDelete, setConfirmGoalDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const goal = data.goals.find((entry) => entry.id === id);
  const contributions = useMemo(
    () =>
      data.contributions
        .filter((contribution) => contribution.goalId === id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [data.contributions, id],
  );
  const progress = useMemo(
    () => (goal ? goalProgress(goal, data.contributions) : null),
    [goal, data.contributions],
  );

  if (loading) return <div className="skeleton" style={{ height: 280 }} />;

  if (!goal || !progress) {
    return (
      <Card>
        <EmptyState
          icon="goals"
          title="Goal not found"
          action={
            <Link to="/goals" className="btn btn-primary">
              Back to goals
            </Link>
          }
        >
          This goal may have been deleted, or the link may be out of date.
        </EmptyState>
      </Card>
    );
  }

  const needed = requiredMonthlyContribution(goal, data.contributions, today);
  const daysLeft = goal.targetDate ? diffDays(today, goal.targetDate) : null;

  function openContribution(nextDirection: 'add' | 'withdraw') {
    setDirection(nextDirection);
    setAmount('');
    setContribDate(todayISO());
    setAccountId(goal?.accountId ?? '');
    setNote('');
    setFormError(null);
    setContributing(true);
  }

  async function saveContribution(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseAmountToMinor(amount, digits);
    if (parsed == null || parsed <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    setBusy(true);
    try {
      await addContribution({
        goalId: goal!.id,
        date: contribDate,
        amount: direction === 'add' ? parsed : -parsed,
        accountId: accountId || undefined,
        note: note || undefined,
      });
      toast(direction === 'add' ? 'Contribution added.' : 'Withdrawal recorded.', 'success');
      setContributing(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the contribution.');
    } finally {
      setBusy(false);
    }
  }

  async function removeContribution() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteContribution(deleteTarget);
      toast('Contribution removed.', 'success');
      setDeleteTarget(null);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Could not remove the contribution.',
        'danger',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGoal() {
    setBusy(true);
    try {
      await deleteGoal(goal!.id);
      toast('Goal deleted.', 'success');
      navigate('/goals', { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the goal.', 'danger');
      setBusy(false);
      setConfirmGoalDelete(false);
    }
  }

  return (
    <div className="stack">
      <div className="row-between">
        <Link to="/goals" className="btn btn-ghost btn-sm">
          <Icon name="chevron-left" size={15} /> Back to goals
        </Link>
        <span className="tiny muted">Goal ID: {goal.id.slice(0, 12)}…</span>
      </div>

      <div className="detail-hero">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span
              className="goal-dot"
              style={{ background: goal.color ?? 'var(--accent)', width: 10, height: 10 }}
            />
            <Badge tone={goal.type === 'sinking' ? 'info' : 'accent'}>
              {goalTypeLabel(goal.type)}
            </Badge>
            {goal.archived ? <Badge tone="warning">Archived</Badge> : null}
          </div>
          <h2>{goal.name}</h2>
          <p className="sub">
            {goal.targetDate
              ? `Target ${date(goal.targetDate)}${daysLeft != null ? ` · ${daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days past target`}` : ''}`
              : 'No target date'}
            {goal.accountId ? ` · held in ${accountName(data.accounts, goal.accountId)}` : ''}
          </p>
          <div className="detail-amount" style={{ marginTop: 14 }}>
            {money(progress.balance)}
          </div>
          <p className="tiny muted">of {money(goal.targetAmount)} target</p>
          <div style={{ maxWidth: 360, marginTop: 14 }}>
            <ProgressBar
              value={progress.progress}
              tone={
                progress.progress >= 100
                  ? 'positive'
                  : progress.progress >= 60
                    ? undefined
                    : 'warning'
              }
              label={`${goal.name} progress`}
            />
            <div className="row-between tiny muted" style={{ marginTop: 6 }}>
              <span>{Math.round(progress.progress)}% complete</span>
              <span>{money(progress.remaining)} remaining</span>
            </div>
          </div>
        </div>
        <div className="detail-actions">
          <Button
            variant="primary"
            onClick={() => openContribution('add')}
            icon={<Icon name="plus" size={16} />}
          >
            Add contribution
          </Button>
          <Button variant="secondary" onClick={() => openContribution('withdraw')}>
            Withdraw
          </Button>
          <Button
            variant="secondary"
            onClick={() => setEditing(true)}
            icon={<Icon name="edit" size={16} />}
          >
            Edit
          </Button>
          {goal.archived ? (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await updateGoal(goal.id, {
                    name: goal.name,
                    type: goal.type,
                    targetAmount: goal.targetAmount,
                    targetDate: goal.targetDate,
                    accountId: goal.accountId,
                    notes: goal.notes,
                  });
                  await archiveGoal(goal.id, false);
                  toast('Goal restored.', 'success');
                } catch (error) {
                  toast(
                    error instanceof Error ? error.message : 'Could not restore the goal.',
                    'danger',
                  );
                }
              }}
            >
              Restore
            </Button>
          ) : (
            <Button variant="danger-ghost" onClick={() => setConfirmArchive(true)}>
              Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <div className="stat-card">
          <div className="stat-label">Net saved</div>
          <div className="stat-value">{money(progress.balance)}</div>
          <div className="stat-meta">{progress.contributionCount} contribution records</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly amount needed</div>
          <div className="stat-value">{needed == null ? '—' : money(needed)}</div>
          <div className="stat-meta">
            {needed == null
              ? 'Add a target date to estimate'
              : 'Estimate to reach the target on time'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total contributed</div>
          <div className="stat-value positive">{money(progress.contributed)}</div>
          <div className="stat-meta">Withdrawals are excluded from this figure</div>
        </div>
      </div>

      <div className="grid grid-main">
        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 14 }}>
            <div>
              <div className="card-title">Contribution history</div>
              <div className="card-subtitle">Withdrawals appear as negative amounts</div>
            </div>
            <Badge>{contributions.length} records</Badge>
          </div>
          {contributions.length === 0 ? (
            <EmptyState
              icon="goals"
              title="No contributions yet"
              action={
                <Button variant="primary" size="sm" onClick={() => openContribution('add')}>
                  Add a contribution
                </Button>
              }
            >
              Every contribution or withdrawal you record is kept with its date and note.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Note</th>
                    <th scope="col">Account</th>
                    <th scope="col" className="num">
                      Amount
                    </th>
                    <th scope="col" className="actions">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((contribution) => (
                    <tr key={contribution.id}>
                      <td className="nowrap muted small">{date(contribution.date)}</td>
                      <td className="small">{contribution.note || '—'}</td>
                      <td className="small muted">
                        {contribution.accountId
                          ? accountName(data.accounts, contribution.accountId)
                          : '—'}
                      </td>
                      <td className={`num ${contribution.amount < 0 ? 'negative' : 'positive'}`}>
                        {contribution.amount < 0 ? '−' : '+'}
                        {money(Math.abs(contribution.amount))}
                      </td>
                      <td className="actions">
                        <Button
                          size="sm"
                          variant="danger-ghost"
                          onClick={() => setDeleteTarget(contribution.id)}
                          aria-label="Remove contribution"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h3 className="card-title" style={{ marginBottom: 14 }}>
            Goal details
          </h3>
          <dl className="detail-list" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div>
              <dt>Type</dt>
              <dd>{goalTypeLabel(goal.type)}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{money(goal.targetAmount)}</dd>
            </div>
            <div>
              <dt>Target date</dt>
              <dd>{goal.targetDate ? date(goal.targetDate) : '—'}</dd>
            </div>
            <div>
              <dt>Linked account</dt>
              <dd>{goal.accountId ? accountName(data.accounts, goal.accountId) : 'Not linked'}</dd>
            </div>
            <div>
              <dt>Last contribution</dt>
              <dd>{progress.lastContribution ? date(progress.lastContribution) : '—'}</dd>
            </div>
          </dl>
          {goal.notes ? (
            <p className="small muted" style={{ marginTop: 14 }}>
              {goal.notes}
            </p>
          ) : null}
          <div className="notice" style={{ marginTop: 16 }}>
            <Icon name="info" size={17} />
            <span>
              Contributions are records of intent. To move money between real accounts, add a
              transfer transaction as well.
            </span>
          </div>
          <Button
            variant="danger-ghost"
            size="sm"
            style={{ marginTop: 16 }}
            onClick={() => setConfirmGoalDelete(true)}
          >
            Delete this goal permanently
          </Button>
        </Card>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit goal">
        <GoalForm
          initial={goal}
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      </Dialog>

      <Dialog
        open={contributing}
        onClose={() => setContributing(false)}
        title={direction === 'add' ? 'Add contribution' : 'Record withdrawal'}
        description={
          direction === 'add'
            ? 'Set money aside toward this goal.'
            : 'Draw money back out of this goal.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setContributing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                (
                  document.getElementById('contribution-form') as HTMLFormElement | null
                )?.requestSubmit()
              }
              disabled={busy}
            >
              {busy ? 'Saving…' : direction === 'add' ? 'Add contribution' : 'Record withdrawal'}
            </Button>
          </>
        }
      >
        <form id="contribution-form" className="stack" onSubmit={saveContribution} noValidate>
          <div className="form-grid">
            <Field label="Amount" htmlFor="contribution-amount">
              <input
                id="contribution-amount"
                className="input tabular"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoFocus
                placeholder="0.00"
              />
            </Field>
            <Field label="Date" htmlFor="contribution-date">
              <input
                id="contribution-date"
                type="date"
                className="input"
                value={contribDate}
                onChange={(event) => setContribDate(event.target.value)}
              />
            </Field>
            <Field label="From account (optional)" htmlFor="contribution-account">
              <select
                id="contribution-account"
                className="select"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Not linked</option>
                {data.accounts
                  .filter((account) => !account.archived)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Note" htmlFor="contribution-note">
              <input
                id="contribution-note"
                className="input"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>
          {formError ? (
            <div className="form-alert" role="alert">
              {formError}
            </div>
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeContribution}
        title="Remove this contribution?"
        description="The goal balance will be recalculated immediately."
        confirmLabel="Remove contribution"
        danger
        busy={busy}
      />

      <ConfirmDialog
        open={confirmArchive}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveGoal(goal.id, true);
          toast('Goal archived. History is preserved.', 'success');
          setConfirmArchive(false);
        }}
        title="Archive this goal?"
        description="It will be hidden from the active goal list but all contributions remain stored."
        confirmLabel="Archive goal"
        busy={busy}
      />

      <ConfirmDialog
        open={confirmGoalDelete}
        onCancel={() => setConfirmGoalDelete(false)}
        onConfirm={handleDeleteGoal}
        title="Delete this goal and its history?"
        description="This permanently removes the goal and every contribution record attached to it."
        confirmLabel="Delete goal"
        danger
        busy={busy}
      >
        <p className="small muted">
          Account balances are not affected because goal contributions are separate records. Export
          a backup first if you might need this history.
        </p>
      </ConfirmDialog>
    </div>
  );
}
