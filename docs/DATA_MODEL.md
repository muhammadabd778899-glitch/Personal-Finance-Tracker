# Data Model

All records use stable string IDs. Money fields are integers in minor units. Date-only fields are `YYYY-MM-DD`; timestamps are ISO 8601 strings. Tables live in IndexedDB database `ultimate-finance-tracker`, schema version 1.

## Accounts

| Field                     | Type      | Notes                                                    |
| ------------------------- | --------- | -------------------------------------------------------- |
| `id`                      | string    | Stable                                                   |
| `name`                    | string    | 1–80 characters                                          |
| `type`                    | enum      | checking, savings, cash, credit, loan, investment, other |
| `currency`                | string    | ISO 4217, informational for display                      |
| `openingBalance`          | minor     | Signed; liabilities start at 0 or negative               |
| `openingDate`             | date      | Balances include this date                               |
| `institution`             | string?   | Optional                                                 |
| `notes`                   | string?   | Optional                                                 |
| `archived`                | bool      | Archived accounts keep history                           |
| `createdAt` / `updatedAt` | timestamp | Audit trail                                              |

**Indexes:** `id`, `type`, `archived`, `name`.

## Categories

| Field      | Type    | Notes                                     |
| ---------- | ------- | ----------------------------------------- |
| `id`       | string  | Stable                                    |
| `name`     | string  | 1–60 characters                           |
| `kind`     | enum    | `expense` or `income`                     |
| `parentId` | string? | One level of nesting only                 |
| `color`    | string? | Six-digit hex                             |
| `archived` | bool    | Used categories are archived, not deleted |

**Indexes:** `id`, `kind`, `parentId`, `archived`, `name`.

## Transactions

| Field                     | Type      | Notes                                            |
| ------------------------- | --------- | ------------------------------------------------ |
| `id`                      | string    | Stable                                           |
| `type`                    | enum      | income, expense, transfer                        |
| `amount`                  | minor     | Always positive; direction comes from `type`     |
| `date`                    | date      | Date-only                                        |
| `accountId`               | string    | Source account                                   |
| `categoryId`              | string?   | Required for categorization, never for transfers |
| `transferAccountId`       | string?   | Required for transfers, must differ from source  |
| `description`             | string    | 1–200 characters                                 |
| `payee`                   | string?   | Optional                                         |
| `notes`                   | string?   | Optional                                         |
| `tags`                    | string[]  | Lower-noise labels                               |
| `recurringId`             | string?   | Link to the rule that generated the row          |
| `occurrenceDate`          | date?     | Due date this row settles                        |
| `createdAt` / `updatedAt` | timestamp | Audit trail                                      |

**Indexes:** `id`, `date`, `accountId`, `categoryId`, `type`, `recurringId`, `[accountId+date]`.

## Budgets and allocations

| Budget field | Type    | Notes                                 |
| ------------ | ------- | ------------------------------------- |
| `id`         | string  | Stable                                |
| `name`       | string  | 1–80 characters                       |
| `period`     | enum    | `monthly` or `custom`                 |
| `startDate`  | date    | Normalised to month start for monthly |
| `endDate`    | date    | Month end for monthly                 |
| `currency`   | string  | ISO 4217                              |
| `notes`      | string? | Optional                              |

| Allocation field | Type   | Notes                        |
| ---------------- | ------ | ---------------------------- |
| `id`             | string | Stable                       |
| `budgetId`       | string | FK → budgets                 |
| `categoryId`     | string | FK → categories              |
| `amount`         | minor  | Planned amount, non-negative |

**Indexes:** budgets (`id`, `startDate`, `period`); allocations (`id`, `budgetId`, `categoryId`, `[budgetId+categoryId]`).

## Recurring rules, exceptions and payments

### RecurringRule

`id`, `name`, `kind` (income/expense), `accountId`, `categoryId?`, `amount` (expected amount), `variableAmount`, `frequency` (daily/weekly/biweekly/monthly/quarterly/yearly), `interval`, `startDate`, `endDate?`, `anchorDay?`, `notes?`, `archived`, `createdAt`, `updatedAt`.

### RecurrenceException

`id`, `recurringId`, `originalDate`, `kind` (`skip` | `reschedule` | `amount`), `newDate?`, `newAmount?`, `reason?`, `createdAt`.

### BillPayment

`id`, `recurringId`, `occurrenceDate`, `status` (`paid` | `skipped`), `amount?`, `paidDate?`, `transactionId?`, `createdAt`.

**Indexes:** recurring (`id`, `kind`, `accountId`, `archived`, `startDate`); exceptions (`id`, `recurringId`, `[recurringId+originalDate]`); payments (`id`, `recurringId`, `occurrenceDate`, `[recurringId+occurrenceDate]`).

## Goals and contributions

### Goal

`id`, `name`, `type` (`goal` | `sinking`), `targetAmount`, `targetDate?`, `accountId?` (informational), `color?`, `notes?`, `archived`, `createdAt`, `updatedAt`.

### GoalContribution

`id`, `goalId`, `date`, `amount` (positive contribution, negative withdrawal), `accountId?`, `note?`, `createdAt`.

**Indexes:** goals (`id`, `archived`, `type`); contributions (`id`, `goalId`, `date`, `[goalId+date]`).

## Debt details

One row per liability account, keyed by `accountId`.

`accountId`, `apr` (0–100), `minimumPayment`, `dueDay?`, `originalBalance?`, `updatedAt`.

**Indexes:** `accountId`.

## Settings

Single row with `id = 'app'`: `currency`, `locale`, `theme`, `dateFormat`, `firstDayOfWeek`, `lastAccountId?`, `lastCategoryId?`, `sampleDataLoaded`, `createdAt`, `updatedAt`.

## Backup file

```json
{
  "meta": {
    "app": "ultimate-personal-finance-tracker",
    "version": 1,
    "exportedAt": "2026-11-05T12:00:00.000Z",
    "checksum": "1a2b3c4d",
    "counts": { "accounts": 3, "transactions": 128 }
  },
  "data": {
    "accounts": [],
    "categories": [],
    "transactions": [],
    "budgets": [],
    "allocations": [],
    "recurring": [],
    "exceptions": [],
    "payments": [],
    "goals": [],
    "contributions": [],
    "debts": [],
    "settings": {}
  }
}
```

The checksum is computed over a key-sorted serialisation of `data`, so it survives schema key reordering. Restore rejects a mismatched checksum, a newer file version, a different app identity, duplicate IDs and broken foreign keys before writing anything.

## Referential rules

- A transaction's `accountId` must exist. A transfer's `transferAccountId` must exist and differ.
- A transaction's category must exist if present; transfers never carry categories.
- Allocations must reference an existing budget and category.
- Recurring rules must reference an existing account and category.
- Exceptions and payments must reference an existing recurring rule.
- A payment linked to a transaction must reference an existing transaction.
- Contributions must reference an existing goal.

These are enforced on restore and on write; they are not merely UI hints.
