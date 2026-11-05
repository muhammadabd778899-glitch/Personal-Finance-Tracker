# Competitor Analysis

**Purpose:** Define the gap Obsidian Finance fills and the expectations a buyer brings from existing tools.

## Comparison set

| Product               | Model                  | Strength                                        | Gap Obsidian Finance addresses                          |
| --------------------- | ---------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| YNAB                  | Subscription, cloud    | Strong zero-based budgeting method              | No subscription, no account, no bank link               |
| Monarch Money         | Subscription, cloud    | Polished dashboards and household collaboration | Private local storage; no aggregation                   |
| Copilot Money         | Subscription, mobile   | Automatic categorisation and clean design       | Offline-first, explicit manual control                  |
| Actual Budget         | Open source, self-host | Local-first and envelope budgeting              | A guided, buyer-friendly product with no server setup   |
| Spreadsheet templates | One-time purchase      | Flexible and familiar                           | A real app with validation, navigation and safe history |
| PocketSmith           | Subscription           | Forecasting and multi-currency                  | One-time price, local data, simpler scope               |

## Positioning

> A one-time, private finance workspace for people who want the clarity of a budgeting app without connecting a bank account or paying every month.

### Differentiators

1. **No account, no network.** The buyer owns the file and the data.
2. **Transparent formulas.** Derived metrics expose the records behind them.
3. **Safe history.** Accounts and categories archive rather than disappear.
4. **Backup-first design.** Versioned JSON with checksums, validation and a single-transaction restore.
5. **Complete loop.** Accounts → transactions → budgets → bills → goals → debt → net worth → reports in one workspace.
6. **Honest estimates.** Forecasts and payoff plans show assumptions and never masquerade as advice.

## What buyers expect and how we meet it

| Expectation from paid apps | Obsidian Finance response                                   |
| -------------------------- | ----------------------------------------------------------- |
| Fast transaction entry     | Quick-add dialog, remembered account/category, compact form |
| Clear monthly view         | Dashboard pulse, month totals, budget remaining             |
| Upcoming bills             | Calendar, paid/skip/reschedule, overdue detection           |
| Savings motivation         | Goal progress, monthly required contribution                |
| Debt plan                  | Snowball/avalanche/custom estimates with interest totals    |
| Export and ownership       | CSV exports, versioned JSON backup, restore, wipe           |
| Works offline              | PWA precache and local database                             |
| Looks premium              | Calm design system, consistent spacing, real empty states   |

## Deliberate trade-offs

- **No bank sync.** This is the product promise, not a missing feature. Manual entry is supported by quick-add and CSV import.
- **No multi-user sync.** Households can share one browser profile or exchange backups.
- **No investment advice.** Investment accounts are tracked for balances only.
- **No automatic rollover.** Budget periods are explicit so historical numbers stay stable.
- **No AI advice.** Calculations are deterministic and inspectable.

## Risks and mitigations

| Risk                                     | Mitigation                                                       |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Buyer expects automatic bank import      | State the limitation on the listing and in onboarding            |
| Data loss after clearing browser storage | Prominent backup export, restore validation, storage explanation |
| Large CSV imports feel slow              | Preview, duplicate detection, atomic batch write                 |
| Financial anxiety from projections       | Label everything as an estimate with assumptions                 |
| Accessibility complaints                 | Semantic tables, focus management, keyboard tests                |
