# Implementation Plan

**Status:** 1.0.0 complete. Milestones are kept as the delivery record and as the template for future releases.

## M0 — Product definition and guardrails

Deliverables: product spec, competitor analysis, UX spec, architecture, data model, financial rules, acceptance criteria, decisions, implementation plan, AI development protocol.

Exit criteria: scope and exclusions are explicit; money, date and history rules are written before code; every later milestone has an acceptance check.

## M1 — Project foundation

- Vite + React + TypeScript strict setup.
- Prettier, ESLint, Vitest, Testing Library, Playwright.
- Design tokens, base styles and folder structure.
- `npm run verify` pipeline.

Exit criteria: empty shell builds; typecheck, lint and tests pass.

## M2 — Domain layer

- Types, IDs, money parsing/formatting, date-only helpers.
- Account balances, period totals, spending by category.
- Budget views, recurrence, forecast, goals, net worth, debt, reports, CSV, pulse.

Exit criteria: unit tests cover happy paths, boundaries and documented edge cases (month-end, leap day, refunds, transfers, over-precision).

## M3 — Persistence

- Dexie schema v1 with indexes for hot queries.
- Zod schemas and relationship validation.
- Repositories for accounts, categories and settings.
- Transaction CRUD, atomic bulk import, duplicate signatures.
- Budget, recurring, goal and debt repositories.
- Backup export, canonical checksum, restore, wipe and storage health.

Exit criteria: fake-indexeddb tests prove archive rules, atomic failure and restore rejection.

## M4 — Design system and shell

- Buttons, fields, cards, badges, dialogs, confirmations, toasts, progress bars, empty states.
- Collapsible sidebar, icon rail, tooltips, mobile drawer, skip link.
- Sticky top bar, theme toggle, page metadata and breadcrumbs.
- Accessible SVG charts with data tables.

Exit criteria: keyboard-only navigation works; sidebar state persists; no overlap at target widths.

## M5 — Core workspace screens

- Dashboard with pulse, net worth, month totals, forecast and goals.
- Transactions list with URL filters, pagination, CSV import/export.
- Transaction detail with edit and delete.
- Accounts list and account detail.
- Quick-add and full transaction forms.

Exit criteria: first-run account and transaction creation; detail back navigation preserves filters.

## M6 — Planning screens

- Budgets list, detail, allocations and progress.
- Bills and calendar with paid/skip/move/amount actions.
- Goals with contributions and withdrawals.
- Debt planner with three strategies and assumptions.
- Net worth and reports.

Exit criteria: every planning screen reads and writes real records; estimates are labelled.

## M7 — Safety and portability

- Settings: currency, locale, theme, date format, week start.
- Export JSON backup, restore with validation, wipe with safety download.
- Storage health panel.
- Sample workspace load and removal.

Exit criteria: corrupt, foreign and future backups are rejected before any write; wipe is single-transaction.

## M8 — PWA and offline

- Manifest, icons, theme colour, standalone display.
- Workbox precache, navigation fallback and automatic updates.
- Static-host-friendly relative base.

Exit criteria: production build installs and opens offline.

## M9 — Testing and quality gates

- Expand domain, persistence and component tests.
- Playwright journeys for first run, detail routes, sidebar persistence, mobile drawer, reports/download.
- CI workflow for format, types, lint, tests, build and E2E.

Exit criteria: `npm run verify` and Playwright pass locally and in CI.

## M10 — Product packaging

- README with setup, deployment, backup and limitations.
- Customer quick-start guide.
- Etsy listing copy and file manifest.
- Release notes.

Exit criteria: a buyer can install, move, back up and restore using only the documentation.

## Post-1.0 candidates

| Candidate                 | Notes                                              |
| ------------------------- | -------------------------------------------------- |
| Budget rollover           | Needs an explicit method and historical locking    |
| OFX/QIF import            | Reuse the CSV preview model                        |
| Multi-currency conversion | Requires dated FX rates and a base-currency policy |
| Receipt attachments       | IndexedDB blobs with export size limits            |
| Household profiles        | Separate databases per profile, not shared tables  |
| Encrypted exports         | WebCrypto with a user passphrase                   |

Anything that adds a server, account system or subscription contradicts the product's core promise and requires an explicit product decision.
