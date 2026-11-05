# Acceptance Criteria

**Release:** 1.0.0
**Rule:** Every criterion must be demonstrated in the built app and covered by a test or a documented manual check.

## A. Foundations

- [x] `npm run verify` passes from a clean install: Prettier check, TypeScript, ESLint, Vitest, production build.
- [x] Money is stored as integer minor units everywhere; no floating-point arithmetic for balances.
- [x] Date-only values are ISO strings and never shift across timezones.
- [x] Zod validates at repository, import and backup boundaries.
- [x] Domain logic is pure TypeScript with no React or Dexie imports.
- [x] Stable IDs survive edits and restores.
- [x] Multi-record operations use a database transaction.

## B. Navigation and shell

- [x] All ten workspace areas are reachable from the sidebar.
- [x] Detail routes use stable IDs and have breadcrumbs to their lists.
- [x] Browser back/forward restores list search, filters and sort from the URL.
- [x] Sidebar collapses to an icon rail and persists across reloads.
- [x] Collapsed items expose labels via tooltips and accessible names.
- [x] Mobile drawer opens, traps attention visually, closes on Escape, backdrop click or navigation.
- [x] No overlap or horizontal overflow between 320 px and 1440 px widths.
- [x] Skip link moves focus to main content.
- [x] Announcement: page titles update on navigation.

## C. Accounts and transactions

- [x] Accounts support all seven types with opening balances and dates.
- [x] Asset and liability balances follow the signed convention; owed amount is never negative.
- [x] Transfers move money between two accounts and never count as income or expense.
- [x] A transaction can be created, edited and deleted.
- [x] Deleting a transaction also removes a bill payment that referenced it.
- [x] Accounts with history are archived, not deleted; archived accounts can be restored.
- [x] Force deletion removes related transfers, recurring rules, goal links and debt details.
- [x] Categories enforce one level of nesting and matching parent kind.

## D. Budgets

- [x] Monthly budgets normalise to the calendar month.
- [x] Custom budgets keep exact inclusive dates.
- [x] Subcategory spending counts toward the parent allocation.
- [x] Refund transactions reduce net spending.
- [x] Unallocated spending is visible, not hidden.
- [x] Allocation progress and overspending are correct at 0 and above 100%.

## E. Bills and recurring items

- [x] All six frequencies generate correct dates with interval > 1.
- [x] Month-end anchoring and leap-day behaviour match the rules.
- [x] Calendar shows occurrences for the selected month.
- [x] Occurrences can be marked paid, skipped, moved or amount-adjusted.
- [x] Unsettled past occurrences show as overdue.
- [x] Archived rules do not appear.

## F. Goals, debt and net worth

- [x] Goal balance nets withdrawals and progress is correct.
- [x] Required monthly contribution handles past and missing target dates.
- [x] Debt plans support snowball, avalanche and custom ordering.
- [x] Debt payoff reports interest, total paid, payoff date and debt-free date.
- [x] Net worth excludes negative asset balances and counts only liability debt.
- [x] Historical net worth includes records on or before each point.
- [x] Forecast applies outflows before inflows on the same day.
- [x] Every estimate is labelled and lists assumptions.

## G. Reports and data portability

- [x] Report ranges are URL-driven and default to the last six months.
- [x] Income, spending, refunds, savings rate and category shares are correct.
- [x] Budget performance filters to overlapping periods.
- [x] Transactions and summaries export as CSV with formula-injection protection.
- [x] CSV import previews rows, flags duplicates and rejects invalid rows.
- [x] Import is atomic: no partial batch is written.
- [x] Backup exports every table, settings, version, counts and checksum.
- [x] Restore rejects wrong app, newer version, bad checksum, schema errors and broken references.
- [x] Restore and wipe are single transactions.
- [x] Wipe requires a fresh backup download in the UI.

## H. Sample data and settings

- [x] Sample data is clearly labelled and every ID is prefixed `sample-`.
- [x] Sample data cannot be loaded over real accounts.
- [x] Removing sample data never touches real records.
- [x] Currency, locale, theme, date format, first day of week and sidebar state persist.
- [x] Theme toggle resolves `system` to the current preference.

## I. Accessibility and quality

- [x] Every input has a programmatic label.
- [x] Errors are announced with `role="alert"`.
- [x] Dialogs use `role="dialog"`, `aria-modal`, labelled titles and focus return.
- [x] Charts include a keyboard-accessible table alternative.
- [x] Progress bars expose `role="progressbar"` and clamped values.
- [x] Focus indicators are visible.
- [x] Motion respects `prefers-reduced-motion`.
- [x] Colour is not the sole indicator of state.

## J. Offline and release

- [x] Production build precaches the app shell and icons.
- [x] Built app works from a static host and from a subfolder (`base: './'`).
- [x] README explains install, build, test, deploy, backup and limitations.
- [x] CI runs format, typecheck, lint, unit tests, build and Playwright.
- [x] No analytics, trackers or network calls carry financial data.

## Manual release checklist

1. `npm ci`
2. `npm run verify`
3. `npx playwright install chromium && npm run e2e`
4. `npm run build`
5. Serve `dist/` with `npx serve dist` and repeat the five-minute first-run journey.
6. Export a backup from the sample workspace and restore it into a fresh browser profile.
7. Check the app at 320 px, 768 px, 1024 px and 1440 px widths.
8. Confirm the manifest icons render on desktop and mobile install.
