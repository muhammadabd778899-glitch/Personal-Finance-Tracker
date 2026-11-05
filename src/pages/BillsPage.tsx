import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  calendarGrid,
  endOfMonth,
  formatMonth,
  monthShortName,
  startOfMonth,
} from '../domain/dates';
import { parseAmountToMinor } from '../domain/money';
import {
  addException,
  archiveRecurringRule,
  deleteRecurringRule,
  markOccurrencePaid,
  skipOccurrence,
  unmarkOccurrence,
} from '../db/recurring';
import {
  frequencyLabel,
  occurrencesInMonth,
  upcomingOccurrences,
  type ResolvedOccurrence,
} from '../domain/recurrence';
import { useData, useFormatters } from '../state/DataContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  LoadingPage,
  PageIntro,
  useToast,
} from '../components/ui';
import { Icon } from '../components/icons';
import { RecurringForm } from '../components/DataForms';
import { accountName } from './helpers';

export function BillsPage() {
  const { data, loading, today } = useData();
  const { money, date, digits } = useFormatters();
  const { toast } = useToast();
  const [month, setMonth] = useState(startOfMonth(today));
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<ResolvedOccurrence | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [skipTarget, setSkipTarget] = useState<ResolvedOccurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<ResolvedOccurrence | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [undoTarget, setUndoTarget] = useState<ResolvedOccurrence | null>(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const grid = useMemo(
    () => calendarGrid(month, data.settings.firstDayOfWeek),
    [month, data.settings.firstDayOfWeek],
  );
  const monthOccurrences = useMemo(
    () =>
      occurrencesInMonth(
        data.recurring,
        data.exceptions,
        data.payments,
        monthStart,
        monthEnd,
        today,
      ),
    [data.recurring, data.exceptions, data.payments, monthStart, monthEnd, today],
  );
  const upcoming = useMemo(
    () => upcomingOccurrences(data.recurring, data.exceptions, data.payments, today, 45),
    [data.recurring, data.exceptions, data.payments, today],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, ResolvedOccurrence[]>();
    for (const occurrence of monthOccurrences) {
      const list = map.get(occurrence.date) ?? [];
      list.push(occurrence);
      map.set(occurrence.date, list);
    }
    return map;
  }, [monthOccurrences]);

  const activeRules = data.recurring.filter((rule) => !rule.archived);
  const archivedRules = data.recurring.filter((rule) => rule.archived);
  const overdue = upcoming.filter((occurrence) => occurrence.status === 'overdue');
  const upcomingBills = upcoming.filter((occurrence) => occurrence.kind === 'expense');
  const upcomingTotal = upcomingBills.reduce((sum, occurrence) => sum + occurrence.amount, 0);
  const monthExpense = monthOccurrences
    .filter((occurrence) => occurrence.kind === 'expense')
    .reduce((sum, occurrence) => sum + occurrence.amount, 0);

  function nextForRule(ruleId: string): ResolvedOccurrence | undefined {
    return upcoming.find((occurrence) => occurrence.recurringId === ruleId);
  }

  function openPayment(occurrence: ResolvedOccurrence) {
    setPaymentTarget(occurrence);
    setPaymentAmount((occurrence.amount / 10 ** digits).toFixed(digits));
    setPaymentDate(today);
    setPaymentError(null);
  }

  async function confirmPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentTarget) return;
    const parsed = parseAmountToMinor(paymentAmount, digits);
    if (parsed == null || parsed <= 0) {
      setPaymentError('Enter an amount greater than zero.');
      return;
    }
    setBusy(true);
    try {
      await markOccurrencePaid({
        recurringId: paymentTarget.recurringId,
        occurrenceDate: paymentTarget.originalDate,
        amount: parsed,
        paidDate: paymentDate,
      });
      toast('Payment recorded as a transaction.', 'success');
      setPaymentTarget(null);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Could not record the payment.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSkip() {
    if (!skipTarget) return;
    setBusy(true);
    try {
      await skipOccurrence({
        recurringId: skipTarget.recurringId,
        occurrenceDate: skipTarget.originalDate,
      });
      toast('Occurrence skipped. History was not deleted.', 'success');
      setSkipTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not skip the occurrence.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function confirmUndo() {
    if (!undoTarget) return;
    setBusy(true);
    try {
      await unmarkOccurrence(undoTarget.recurringId, undoTarget.originalDate);
      toast('Settlement undone. The occurrence is open again.', 'success');
      setUndoTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not undo the settlement.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function confirmMove(event: React.FormEvent) {
    event.preventDefault();
    if (!moveTarget) return;
    if (!moveDate) return;
    setBusy(true);
    try {
      await addException({
        recurringId: moveTarget.recurringId,
        originalDate: moveTarget.originalDate,
        kind: 'reschedule',
        newDate: moveDate,
      });
      toast('Occurrence moved. The previous occurrence is preserved as an exception.', 'success');
      setMoveTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not move the occurrence.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteRule() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteRecurringRule(deleteTarget);
      toast('Scheduled item deleted.', 'success');
      setDeleteTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the schedule.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive(id: string, archived: boolean) {
    try {
      await archiveRecurringRule(id, archived);
      toast(archived ? 'Schedule paused.' : 'Schedule resumed.', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update the schedule.', 'danger');
    }
  }

  if (loading) return <LoadingPage />;

  const weekdays =
    data.settings.firstDayOfWeek === 1
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="stack">
      <PageIntro
        title="Bills, subscriptions and paydays"
        description="Scheduled items are plans, not transactions. Marking one paid creates a real transaction, and skipping one never erases history."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditingRuleId(null);
              setRuleFormOpen(true);
            }}
            icon={<Icon name="plus" size={17} />}
          >
            New scheduled item
          </Button>
        }
      />

      {overdue.length > 0 ? (
        <div className="notice notice-warning">
          <Icon name="alert" size={17} />
          <span>
            {overdue.length} occurrence{overdue.length === 1 ? ' is' : 's are'} past due and still
            open. Review them below or mark them paid.
          </span>
        </div>
      ) : null}

      <div className="grid grid-4">
        <div className="stat-card">
          <div className="stat-label">Next 45 days</div>
          <div className="stat-value">{money(upcomingTotal, { compact: true })}</div>
          <div className="stat-meta">{upcomingBills.length} scheduled bill payments</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{formatMonth(month)}</div>
          <div className="stat-value">{money(monthExpense, { compact: true })}</div>
          <div className="stat-meta">Scheduled expenses this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active schedules</div>
          <div className="stat-value">{activeRules.length}</div>
          <div className="stat-meta">{archivedRules.length} paused</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Overdue</div>
          <div className={`stat-value ${overdue.length > 0 ? 'negative' : ''}`}>
            {overdue.length}
          </div>
          <div className="stat-meta">Open occurrences before today</div>
        </div>
      </div>

      <Card className="flush">
        <div className="card-header" style={{ paddingBottom: 12 }}>
          <div>
            <div className="card-title">{formatMonth(month)}</div>
            <div className="card-subtitle">
              Paid, skipped and open occurrences. Moved occurrences show on their new date.
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMonth(addMonths(month, -1))}
              aria-label="Previous month"
            >
              <Icon name="chevron-left" size={15} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(today))}>
              Today
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMonth(addMonths(month, 1))}
              aria-label="Next month"
            >
              <Icon name="chevron-right" size={15} />
            </Button>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 4 }}>
          <div className="calendar-wrap">
            <table className="calendar" aria-label={`Calendar for ${formatMonth(month)}`}>
              <thead>
                <tr>
                  {weekdays.map((day) => (
                    <th key={day} scope="col">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, week) => (
                  <tr key={week}>
                    {grid.slice(week * 7, week * 7 + 7).map((day) => {
                      const items = byDate.get(day) ?? [];
                      const outside = day.slice(0, 7) !== month.slice(0, 7);
                      return (
                        <td
                          key={day}
                          className={`${outside ? 'outside' : ''} ${day === today ? 'today' : ''}`.trim()}
                        >
                          <div className="day-number">{Number(day.slice(8, 10))}</div>
                          {items.slice(0, 2).map((occurrence) => (
                            <button
                              key={occurrence.id}
                              type="button"
                              className={`cal-item ${occurrence.kind === 'expense' ? 'expense' : ''} ${
                                occurrence.status === 'paid' || occurrence.status === 'skipped'
                                  ? 'paid'
                                  : ''
                              }`}
                              title={`${occurrence.name} · ${money(occurrence.amount)} · ${occurrence.status}`}
                              onClick={() => {
                                if (
                                  occurrence.status === 'unpaid' ||
                                  occurrence.status === 'overdue'
                                )
                                  openPayment(occurrence);
                              }}
                              style={{
                                border: 0,
                                width: '100%',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              {occurrence.name}
                            </button>
                          ))}
                          {items.length > 2 ? (
                            <div className="more">+{items.length - 2} more</div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 10 }}>
            Tip: select an open calendar item to record its payment. Use the list below for skip,
            move and undo actions.
          </p>
        </div>
      </Card>

      <div className="grid grid-main">
        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <div>
              <div className="card-title">Occurrences in {formatMonth(month)}</div>
              <div className="card-subtitle">All scheduled items for the selected month</div>
            </div>
            <Badge>{monthOccurrences.length} total</Badge>
          </div>
          {monthOccurrences.length === 0 ? (
            <EmptyState icon="calendar" title="Nothing scheduled this month">
              Create a recurring bill, subscription or income schedule to fill the calendar.
            </EmptyState>
          ) : (
            <div>
              {monthOccurrences.map((occurrence) => (
                <div key={occurrence.id} className="bill-list-item">
                  <div className="bill-date">
                    <strong>{Number(occurrence.date.slice(8, 10))}</strong>
                    <span>{monthShortName(Number(occurrence.date.slice(5, 7)) - 1)}</span>
                  </div>
                  <div className="bill-copy">
                    <strong>
                      {occurrence.name}
                      {occurrence.kind === 'income' ? <Badge tone="positive"> Income</Badge> : null}
                    </strong>
                    <span>
                      {money(occurrence.amount)} ·{' '}
                      {accountName(data.accounts, occurrence.accountId)}
                      {occurrence.status === 'paid' && occurrence.payment?.paidDate
                        ? ` · paid ${date(occurrence.payment.paidDate)}`
                        : ''}
                      {occurrence.exception ? ' · moved' : ''}
                    </span>
                  </div>
                  {occurrence.status === 'overdue' ? <Badge tone="danger">Overdue</Badge> : null}
                  {occurrence.status === 'unpaid' ? <Badge>Open</Badge> : null}
                  {occurrence.status === 'paid' ? <Badge tone="positive">Paid</Badge> : null}
                  {occurrence.status === 'skipped' ? <Badge> Skipped</Badge> : null}
                  <div className="row" style={{ gap: 4 }}>
                    {occurrence.status === 'unpaid' || occurrence.status === 'overdue' ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => openPayment(occurrence)}>
                          Mark paid
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSkipTarget(occurrence)}>
                          Skip
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMoveTarget(occurrence);
                            setMoveDate(addDays(occurrence.date, 1));
                          }}
                        >
                          Move
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setUndoTarget(occurrence)}>
                        Undo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="flush">
          <div className="card-header" style={{ paddingBottom: 12 }}>
            <div>
              <div className="card-title">Schedules</div>
              <div className="card-subtitle">Recurring rules and their next open date</div>
            </div>
            <Badge tone="accent">{activeRules.length} active</Badge>
          </div>
          {activeRules.length === 0 ? (
            <EmptyState
              icon="repeat"
              title="No schedules yet"
              action={
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setEditingRuleId(null);
                    setRuleFormOpen(true);
                  }}
                >
                  Add a schedule
                </Button>
              }
            >
              Add rent, salary, subscriptions or any repeating commitment.
            </EmptyState>
          ) : (
            <div>
              {activeRules.map((rule) => {
                const next = nextForRule(rule.id);
                return (
                  <div
                    key={rule.id}
                    className="bill-list-item"
                    style={{ alignItems: 'flex-start' }}
                  >
                    <span className={`pulse-marker ${rule.kind === 'income' ? 'positive' : ''}`}>
                      <Icon name={rule.kind === 'income' ? 'arrow-down' : 'repeat'} size={16} />
                    </span>
                    <div className="bill-copy">
                      <strong>{rule.name}</strong>
                      <span>
                        {money(rule.amount)}
                        {rule.variableAmount ? ' (varies)' : ''} · {frequencyLabel(rule)}
                      </span>
                      <span style={{ display: 'block' }}>
                        {next
                          ? `Next: ${date(next.date)}`
                          : `Started ${date(rule.startDate)} · no upcoming occurrence`}
                      </span>
                    </div>
                    <div className="row" style={{ gap: 2 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${rule.name}`}
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setRuleFormOpen(true);
                        }}
                      >
                        <Icon name="edit" size={15} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleArchive(rule.id, true)}
                        title="Pause this schedule"
                      >
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-ghost"
                        aria-label={`Delete ${rule.name}`}
                        onClick={() => setDeleteTarget(rule.id)}
                      >
                        <Icon name="trash" size={15} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {archivedRules.length > 0 ? (
            <div style={{ borderTop: '1px solid var(--line)', padding: '12px 20px' }}>
              <div className="field-label" style={{ marginBottom: 8 }}>
                Paused
              </div>
              {archivedRules.map((rule) => (
                <div key={rule.id} className="row-between" style={{ padding: '6px 0' }}>
                  <span className="small">
                    {rule.name} · {frequencyLabel(rule)}
                  </span>
                  <span className="row" style={{ gap: 4 }}>
                    <Button size="sm" variant="ghost" onClick={() => toggleArchive(rule.id, false)}>
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-ghost"
                      onClick={() => setDeleteTarget(rule.id)}
                    >
                      Delete
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <p className="tiny muted">
        Recurring rules are date-only and timezone-safe. Monthly rules keep their anchor day (for
        example the 31st) and clamp to the last day of shorter months. Editing a schedule does not
        rewrite past payments.
      </p>

      <Dialog
        open={ruleFormOpen}
        onClose={() => setRuleFormOpen(false)}
        title={editingRuleId ? 'Edit schedule' : 'New scheduled item'}
        description="Recurring income, bills and subscriptions live here — not as transactions until you mark them paid."
        wide
      >
        <RecurringForm
          key={editingRuleId ?? 'new'}
          initial={
            editingRuleId ? data.recurring.find((rule) => rule.id === editingRuleId) : undefined
          }
          onCancel={() => setRuleFormOpen(false)}
          onSaved={() => setRuleFormOpen(false)}
        />
      </Dialog>

      <Dialog
        open={paymentTarget !== null}
        onClose={() => setPaymentTarget(null)}
        title="Record payment"
        description={
          paymentTarget
            ? `${paymentTarget.name} · due ${date(paymentTarget.originalDate)}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaymentTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                (document.getElementById('payment-form') as HTMLFormElement | null)?.requestSubmit()
              }
              disabled={busy}
            >
              {busy ? 'Recording…' : 'Record payment'}
            </Button>
          </>
        }
      >
        <form id="payment-form" className="stack" onSubmit={confirmPayment} noValidate>
          <div className="notice notice-accent">
            <Icon name="info" size={17} />
            <span>
              This creates a real {paymentTarget?.kind === 'income' ? 'income' : 'expense'}{' '}
              transaction in {accountName(data.accounts, paymentTarget?.accountId)} and marks the
              occurrence paid.
            </span>
          </div>
          <div className="form-grid">
            <Field label="Amount paid" htmlFor="payment-amount">
              <input
                id="payment-amount"
                className="input tabular"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Payment date" htmlFor="payment-date">
              <input
                id="payment-date"
                type="date"
                className="input"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </Field>
          </div>
          {paymentError ? (
            <div className="form-alert" role="alert">
              {paymentError}
            </div>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        title="Move this occurrence"
        description="Creates an exception for this occurrence only. Other dates are unchanged."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                (document.getElementById('move-form') as HTMLFormElement | null)?.requestSubmit()
              }
              disabled={busy}
            >
              {busy ? 'Moving…' : 'Move occurrence'}
            </Button>
          </>
        }
      >
        <form id="move-form" className="stack" onSubmit={confirmMove}>
          <Field label="New date" htmlFor="move-date">
            <input
              id="move-date"
              type="date"
              className="input"
              value={moveDate}
              onChange={(event) => setMoveDate(event.target.value)}
            />
          </Field>
          <p className="tiny muted">
            Original date: {moveTarget ? date(moveTarget.originalDate) : '—'}
          </p>
        </form>
      </Dialog>

      <ConfirmDialog
        open={skipTarget !== null}
        onCancel={() => setSkipTarget(null)}
        onConfirm={confirmSkip}
        title="Skip this occurrence?"
        description="The occurrence will be marked skipped. Past records stay intact."
        confirmLabel="Skip occurrence"
        busy={busy}
      />

      <ConfirmDialog
        open={undoTarget !== null}
        onCancel={() => setUndoTarget(null)}
        onConfirm={confirmUndo}
        title="Undo this settlement?"
        description="If a transaction was created automatically, it will be removed and balances will change."
        confirmLabel="Undo settlement"
        danger
        busy={busy}
      >
        <p className="small muted">
          Undoing a payment removes the linked transaction so the occurrence becomes open again. If
          you edited that transaction later, export a backup before continuing.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteRule}
        title="Delete this schedule?"
        description="This removes its exceptions and payment links. Transactions already created are kept."
        confirmLabel="Delete schedule"
        danger
        busy={busy}
      >
        <p className="small muted">
          Deleting a schedule does not delete transactions it created. Their history remains in your
          accounts and reports.
        </p>
      </ConfirmDialog>
    </div>
  );
}
