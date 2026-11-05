# Financial Rules

This document is the single source of truth for calculations. The implementation lives in `src/domain/` and is covered by unit tests.

## 1. Money

- All amounts are **integer minor units**. `123456` is 1,234.56 for a two-decimal currency.
- The workspace has one display currency from settings. Account currencies are informational.
- Input parsing accepts `1,234.56`, `1.234,56`, `$ 99`, `(12.50)` and `-12.5`.
- Over-precise or ambiguous input is rejected, not rounded. Letters and scientific notation are rejected.
- Formatting uses `Intl.NumberFormat` and a true minus sign for negative display values.
- Zero-decimal currencies (e.g. JPY) are respected when formatting and parsing.

## 2. Signed balances

```
asset balance     = opening + income − expense − transfer out + transfer in
liability balance = same arithmetic, stored negative
money owed        = max(0, −liability balance)
```

- A credit-card purchase is an expense; the balance becomes more negative.
- A card payment is a transfer into the liability account; the balance moves toward zero.
- Asset balances below zero are not counted as assets for net worth; they remain visible per account.
- Transfers never affect income or expense totals.

`accountBalance(account, transactions, asOf?)` is the only balance implementation used by the UI.

## 3. Period totals

For an inclusive date range:

```
income    = income transactions + income assigned to income categories
refunds   = income transactions assigned to expense categories
expenses  = sum of expense transactions
net       = income − expenses
netSpending = expenses − refunds
transferVolume = sum of transfers (excluded from income/spending)
```

## 4. Spending by category

- Expense transactions add their amount.
- Income transactions with an expense category subtract (a refund).
- Transfers are excluded.
- Spending on a subcategory rolls up into its parent category for reporting.
- Uncategorized spending appears as `Uncategorized`.
- Shares use total spending as the denominator.

## 5. Budgets

- Monthly budgets cover the whole calendar month of `startDate`.
- Custom budgets cover the inclusive `startDate`–`endDate` range.
- Allocation spending includes the category and its direct children.
- Allocation progress = `spent / budgeted × 100`; zero-budget rows show 100% when spent.
- Net spending in expense categories without an allocation is surfaced as unallocated, never hidden.
- Allocations are plans; they do not change account balances.
- Budget periods do not roll over automatically in 1.0; this keeps historical periods stable.

## 6. Recurrence

- Monthly, quarterly and yearly rules use `anchorDay` (default: start date's day). A bill on the 31st falls on the last day of shorter months and returns to the 31st later.
- Leap-day yearly rules fall on 28 February in non-leap years.
- Exceptions:
  - `skip` removes the occurrence.
  - `reschedule` moves it to `newDate`; it is included only if the new date is inside the requested window.
  - `amount` overrides the expected amount without changing the rule.
- Status: `paid` or `skipped` when a payment record exists; `overdue` when the effective date is before today and unsettled; otherwise `unpaid`.
- Archived rules produce no occurrences.

## 7. Forecast (estimate)

`buildForecast` starts from actual balances at the start date and applies:

1. Future-dated transactions within the window.
2. Unpaid recurring occurrences within the window.
3. Transfers to both tracked accounts when both are in scope.

Same-day outflows are applied before inflows so the low point is conservative. No interest, fees, price changes or unrecorded spending are predicted. Every event is exposed with its source ID. The result is labelled `estimated: true`.

## 8. Debt payoff (estimate)

- Interest accrues monthly: `round(balance × APR / 100 / 12)`.
- Every active debt receives its minimum payment first.
- The extra amount goes to the first debt in strategy order.
- When a debt is paid, its minimum joins the extra pool in later months.
- Payments never exceed balance plus interest.
- Snowball orders by smallest balance; avalanche by highest APR; custom by explicit order.
- No fees, promotional rates or new borrowing are modelled.
- The simulation stops after 1,200 months and reports that debt is not paid off.

## 9. Goals

```
balance   = sum(contributions)          // withdrawals are negative
remaining = max(0, target − balance)
progress  = balance / target × 100
```

Monthly required contribution spreads the remaining amount over the months until the target date and rounds up. Past target dates require the full remaining amount immediately.

## 10. Net worth

```
assets      = sum(max(0, asset balances)) at the date
liabilities = sum(max(0, −liability balances)) at the date
net         = assets − liabilities
```

Historical points include transactions on or before each month end, and accounts only from their opening date. The 30-day change compares today with 30 days ago.

## 11. CSV

- Export protects against formula injection by prefixing dangerous text cells with an apostrophe while leaving genuine numbers intact.
- Import supports UTF-8 BOM, quoted fields, escaped quotes and CRLF.
- Dates are normalised to ISO date-only values; ambiguous day/month input assumes month-first and is shown in the preview for review.
- Duplicate detection uses date + absolute amount + normalised description + account name. Duplicates are excluded by default but visible.
- Import is all-or-nothing: every row is validated before a single batch write.

## 12. Backups

- Export includes every table plus settings, a version, an export timestamp, counts and a checksum.
- Restore validates size, JSON, app identity, version, checksum, schema, duplicate IDs and relationships.
- A valid restore replaces all tables inside one IndexedDB transaction.
- The UI requires a fresh backup download before restoring and before wiping all data.
- Nothing is ever partially restored.
