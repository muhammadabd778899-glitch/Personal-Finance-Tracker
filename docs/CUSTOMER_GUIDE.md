# Customer Guide

Welcome to **Harbor Finance — Ultimate Personal Finance Tracker**. This guide takes you from first open to a backed-up workspace.

## 1. Open the app

If you received a built folder, open `index.html` in a modern browser. If you are hosting it, open the URL provided by the seller or host.

The first screen offers two paths:

- **Create your first account** — start with your own records.
- **Explore sample workspace** — load clearly labelled demo data. Remove it later in **Settings → Sample data → Remove sample data**.

Nothing is uploaded. There is no sign-up.

## 2. Set your preferences

Open **Settings** and choose:

- Workspace currency and locale.
- Date format and first day of the week.
- Light, dark or system theme.
- Sidebar collapsed or expanded.

Settings save immediately in this browser.

## 3. Create accounts

Open **Accounts → Add account**. Choose the type and enter the current opening balance as of the opening date.

- Assets (checking, savings, cash, investment) normally hold positive balances.
- Credit cards and loans are liabilities and hold negative balances. Enter the amount currently owed as a negative opening balance, or zero and record purchases as expenses.
- A payment to a credit card is a **transfer** from your checking account to the card account.

## 4. Record transactions

Use **Add transaction** in the top bar or **Transactions → Add transaction**.

- **Expense:** money leaves an account. Choose a category when useful.
- **Income:** money arrives. Use an income category for salary and similar.
- **Transfer:** moves money between two accounts. Transfers never count as income or spending.

Amounts accept `1,234.56` or `1.234,56` style input. Descriptions are required; everything else is optional.

## 5. Plan the month

- **Budgets:** create a monthly or custom budget and allocate amounts to categories. Spending on subcategories rolls up to the parent. Unallocated spending stays visible.
- **Bills & Calendar:** add recurring income and expenses. Mark occurrences paid or skipped, move a date, or override an amount for one occurrence.
- **Goals:** create a goal or sinking fund and record contributions. Withdrawals reduce the balance.

## 6. Understand debt and the future

- **Debt:** add APR and minimum payments to liability accounts, then compare snowball and avalanche estimates. These are estimates, not advice.
- **Net Worth:** see assets, liabilities and monthly history.
- **Dashboard:** see the next 45 days of commitments and a conservative low-balance projection.

## 7. Reports and CSV

**Reports** shows income, net spending, category shares, budget performance and largest expenses. Every chart has a **View values as a table** alternative.

- **Export summary** downloads category and budget totals.
- **Export transactions** downloads the transactions in the selected period.
- **Import CSV** on the Transactions screen previews your file, normalises dates, flags duplicates and validates every row before writing.

CSV exports protect against spreadsheet formula injection.

## 8. Back up and restore

### Export

**Settings → Export backup** downloads a `.json` file. It contains every account, transaction, budget, bill, goal, debt record and your settings, plus a version and checksum.

Keep it somewhere outside the browser. Clearing browser data can remove your workspace.

### Restore

**Settings → Restore backup** validates the file completely before changing anything. If the file is corrupt, edited, from another app or from a newer version, it is rejected and your current data stays as it was.

Restore replaces the current workspace. Export a fresh backup first if you need the current data.

### Wipe

**Settings → Wipe all data** requires downloading a safety backup first. It removes all records in one transaction.

## 9. Install as an app

In Chrome or Edge, use the install icon in the address bar. On iPhone or iPad, use **Share → Add to Home Screen**. The app shell works offline after the first load.

## 10. Move to another computer

1. Export a backup on the old computer.
2. Open the app on the new computer at the same URL/origin.
3. Restore the backup.
4. Keep the old backup until you have confirmed the new workspace.

If you open the app from a different host or folder, it is a different browser origin with an empty database. Restore your backup there.

## FAQ

**Do you connect to my bank?**
No. There are no bank connections, credentials or automatic imports.

**Is my data uploaded?**
No. Records stay in IndexedDB in this browser. The app makes no analytics or data requests.

**Why is my balance different from my bank?**
Balances are derived from the opening balance plus recorded transactions. Check the opening date and any missing or duplicated rows.

**How do I fix a wrong transaction?**
Open it from the Transactions list and choose **Edit**. Deleting a transaction also removes a linked bill payment record.

**How do I remove the sample data?**
**Settings → Sample data → Remove sample data**. Only records whose IDs start with `sample-` are removed.

**Can two people use one workspace?**
Yes, by sharing a browser profile, or by exchanging backup files. There is no live sync.

**What happens if I clear my browser?**
Site data is deleted. Restore your latest JSON backup.

**Is the debt planner financial advice?**
No. It is a deterministic estimate based on the APR and minimum payments you enter.
