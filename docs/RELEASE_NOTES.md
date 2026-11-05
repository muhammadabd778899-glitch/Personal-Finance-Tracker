# Release Notes

## 1.0.0 — 2026-11-05

First public release of **Harbor Finance — Ultimate Personal Finance Tracker**.

### Added

- Local-first workspace with accounts, transactions, budgets, bills, goals, debt, net worth and reports.
- Signed balance model for assets and liabilities, with transfer-aware calculations.
- Monthly and custom budgets with category and subcategory allocations.
- Recurring income and bills with anchored dates, exceptions and paid/skipped tracking.
- Snowball, avalanche and custom debt payoff estimates.
- 45-day cash-flow forecast with conservative low point and visible assumptions.
- CSV export with formula-injection protection and CSV import with preview and duplicate detection.
- Versioned JSON backups with canonical checksum, schema and relationship validation, atomic restore and safe wipe.
- Clearly labelled sample workspace with namespace-safe removal.
- Collapsible desktop sidebar, mobile drawer, keyboard dialogs, accessible charts and reduced-motion support.
- Installable PWA with generated icons and offline precache.
- Vitest domain, repository and component tests, Playwright journeys and GitHub Actions CI.

### Known limitations

- No bank connections, account system or cloud sync.
- One workspace per browser origin.
- Account currencies are informational; totals use the workspace currency.
- No automatic budget rollover.
- Forecasts and payoff plans are estimates, not advice.

### Data format

Backup format version 1. Future versions must remain able to read version 1 files.
