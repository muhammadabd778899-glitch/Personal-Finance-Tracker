# UX Specification

## 1. Information architecture

```
Dashboard (/)
├── Transactions (/transactions)
│   └── Transaction detail (/transactions/:id)
├── Accounts (/accounts)
│   └── Account detail (/accounts/:id)
├── Budgets (/budgets)
│   └── Budget detail (/budgets/:id)
├── Bills & Calendar (/bills)
├── Savings Goals (/goals)
│   └── Goal detail (/goals/:id)
├── Debt (/debt)
├── Net Worth (/net-worth)
├── Reports (/reports)
└── Settings (/settings)
```

Routing uses hashes (`#/transactions`) so the built app works from a folder, a static host or `file://` without rewrite rules. Every detail route uses a stable record ID. Browser back/forward always return to the previous list, including its search and filter state.

## 2. App shell

### Desktop (≥ 901 px)

- Sticky top bar contains page title, breadcrumb, theme toggle and **Add transaction**.
- Primary navigation renders as a horizontal top strip below the top bar with brand, active pill state and overflow scrolling.
- Main content scrolls independently; no overlap or overflow at target widths.

### Tablet / mobile (≤ 900 px)

- Top navigation strip keeps all primary links reachable via horizontal scroll.
- The menu button opens the drawer; Escape, backdrop click or choosing a page closes it.
- Drawer always shows labels, even if the desktop sidebar was collapsed.
- Collapse control is hidden on mobile.
- Content uses a single column; tables become horizontally scrollable regions.

### Keyboard model

| Key                         | Behaviour                                                      |
| --------------------------- | -------------------------------------------------------------- |
| Tab                         | Moves through skip link, top bar, top navigation, page content |
| Enter                       | Activates links and buttons; submits forms                     |
| Escape                      | Closes dialogs                                                 |
| Tab / Shift+Tab in a dialog | Traps focus inside the dialog                                  |
| Browser back                | Returns to the previous list with its filters preserved        |

## 3. Screen contracts

### Dashboard

- Hero: net worth, 30-day change, assets and liabilities.
- Month strip: income, spending, planned budgets.
- Four stat cards: income, spending, next 45 days, savings goals.
- Six-month income/spending chart with a data table alternative.
- Upcoming commitments and goal progress.
- Empty state offers **Create your first account** and **Explore sample workspace**.

### Transactions

- Search, type, account, category, date range and sort controls in the URL.
- Summary strip shows count, income, spending and transfers.
- Table columns: date, description, category/transfer target, account, type, amount.
- Row description links to the detail page and passes list context in router state.
- Import CSV and export CSV are available from the toolbar.

### Detail pages

- Breadcrumb back to the parent list.
- Stable record ID shown for support.
- Primary facts in a definition list, not a dense table.
- Edit and delete actions in the header.
- Related records are linked, never duplicated.
- Deleting history offers archive where possible and explains the effect.

### Forms

- Labels above inputs, hints below, errors adjacent and announced with `role="alert"`.
- Amounts accept grouped and decimal input, are stored as integer minor units and display the workspace currency.
- Submit buttons disable while saving and never double-submit.
- Destructive confirmations name the record and explain what happens to linked history.

## 4. Visual system

- **Palette:** deep green accent, warm paper background, ink text, muted secondary text.
- **Type:** display serif for headings, humanist sans for UI, tabular numerals for money.
- **Spacing:** 4 px base scale; cards on an 8 px rhythm.
- **Radii:** 10–16 px, consistent between cards, dialogs and inputs.
- **Elevation:** two shadow levels only (card, dialog).
- **Charts:** accent for income, neutral line for spending; every chart has a `<details>` table.
- **Motion:** 120–240 ms ease; all motion disabled under `prefers-reduced-motion`.

## 5. Content rules

1. Use plain language: "money owed", "spending", "planned", not accounting jargon.
2. State the period for every total ("this month", "last 30 days").
3. Never imply bank connectivity or advice.
4. Empty states say what to do next, not just that something is missing.
5. Error messages say what happened and how to fix it.
6. Estimates carry the word "estimate" and list assumptions.

## 6. Quality bar

- No layout shift when the sidebar collapses.
- No horizontal page scroll at 320 px width.
- Focus is always visible on keyboard navigation.
- Colour is never the only carrier of meaning.
- Dialogs restore focus to the trigger on close.
- Toasts are dismissible and never cover primary actions.
