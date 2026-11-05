# Product Specification

**Product:** Obsidian Finance — Ultimate Personal Finance Tracker
**Version:** 1.0.0
**Status:** Release candidate
**Owner:** Muhammad Abdullah
**Last updated:** 2026-11-05

## 1. Product statement

Obsidian Finance is a private, offline-first personal finance workspace. It runs entirely in the browser with no bank connection, no user account, no cloud sync and no subscription. It is a real application — not a spreadsheet — that helps one person understand their accounts, spending, budgets, upcoming bills, savings goals, debt and net worth.

The product is designed to be sold as an Etsy digital download and self-hosted or run locally. Every screen must be immediately useful with sample data and equally useful after the sample data is removed.

## 2. Target customer

- An individual or household that wants a clear picture of their money without handing bank credentials to a third party.
- A privacy-conscious buyer who prefers a one-time purchase and local data ownership.
- Someone comfortable opening a folder or using a hosted static site, but who does not want to configure a server or database.

**Jobs to be done**

1. "Record what I spent and earned without fighting a spreadsheet."
2. "Know whether I am on track this month without doing arithmetic."
3. "See what bills are coming before they arrive."
4. "Understand how debt and savings decisions affect the future."
5. "Keep a portable copy of everything and restore it safely."

## 3. Explicit scope

### In scope for 1.0

- Checking, savings, cash, investment, credit card, loan and other accounts.
- Income, expense and transfer transactions with categories, payees, notes and tags.
- Monthly and custom-period budgets with per-category allocations.
- Recurring income and bills with a calendar, paid/skipped tracking, rescheduling and amount overrides.
- Savings goals and sinking funds with contributions and withdrawals.
- Debt payoff estimates using snowball, avalanche and custom ordering.
- Net worth history and a 45-day cash-flow forecast.
- Reports with income, spending, category breakdowns, budget performance and CSV exports.
- Versioned JSON backup, checksum validation, restore and wipe.
- Sample workspace that is clearly labelled and removable.
- Installable PWA with offline caching.
- Local-only settings for currency, locale, theme, date format and week start.

### Out of scope for 1.0

- Bank connections, account aggregation or automatic imports.
- Multi-user accounts, cloud sync, sharing or collaboration.
- Subscription billing or any server-side component.
- Investment price feeds, tax filing or regulated financial advice.
- Automatic budget rollover between months.
- Cryptocurrency wallets or exchange integrations.

## 4. Product principles

1. **Local by default.** Data lives in IndexedDB on the device. Export is the backup and portability mechanism.
2. **Explain the number.** Every derived figure states its period, formula and contributing records.
3. **Never silently destroy history.** Accounts and categories in use are archived; restores validate before writing.
4. **Estimate, do not promise.** Forecasts and payoff plans are labelled estimates with assumptions.
5. **One primary action per screen.** Secondary actions stay available but visually quieter.
6. **Accessible by construction.** Keyboard paths, visible focus, semantic tables, chart alternatives.
7. **No dark patterns.** No fake urgency, no hidden fees, no data harvesting.

## 5. Success criteria

A first-time buyer can, within ten minutes and without documentation:

1. Load the sample workspace and understand what the app does.
2. Create an account and record a transaction.
3. Open a transaction, use browser back and land on the same filtered list.
4. Toggle the theme, reload, and find the preference still applied.
5. Export a backup and see a versioned JSON file.
6. Read a report and open the data table behind a chart.

The release passes `npm run verify` from a clean clone and all Playwright journeys on Chromium.

## 6. Non-functional requirements

| Area          | Requirement                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| Storage       | IndexedDB only; no cookies or localStorage for financial records            |
| Offline       | App shell precached; core screens work after first load                     |
| Money         | Integer minor units; ISO currency at every boundary                         |
| Dates         | Date-only strings (`YYYY-MM-DD`) never shifted by timezone                  |
| Validation    | Zod at persistence and import boundaries; domain rules in pure TypeScript   |
| Performance   | First meaningful render under 2 s on a mid-range laptop with sample data    |
| Accessibility | WCAG 2.2 AA intent: contrast, focus, labels, keyboard dialogs, chart tables |
| Browser       | Current Chrome, Edge, Firefox and Safari                                    |
| Privacy       | Zero analytics, zero network calls after load                               |
| Recovery      | Corrupt or incompatible backup is rejected before any write                 |
