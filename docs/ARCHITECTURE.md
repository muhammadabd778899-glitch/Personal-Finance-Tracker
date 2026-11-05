# Architecture

## 1. Stack

| Layer       | Choice                                              |
| ----------- | --------------------------------------------------- |
| UI          | React 19 + TypeScript 5.9                           |
| Build       | Vite 7                                              |
| Routing     | React Router 7 (`HashRouter`)                       |
| Styling     | Global CSS layers + design tokens + component CSS   |
| Forms       | Controlled React forms with Zod validation          |
| Persistence | Dexie 4 over IndexedDB                              |
| Charts      | Hand-built SVG components with table alternatives   |
| Tests       | Vitest, Testing Library, fake-indexeddb, Playwright |
| PWA         | vite-plugin-pwa / Workbox                           |
| CI          | GitHub Actions                                      |

No runtime server, remote API, analytics or third-party UI kit is used.

## 2. Folder map

```
src/
├── components/       shared UI, forms, charts, layout, error boundary
├── db/               Dexie schema, repositories, transactions, backups, sample data
├── domain/           pure TypeScript rules (money, dates, accounts, budgets, …)
├── lib/              browser file download helpers
├── pages/            route-level screens
├── state/            live data provider and formatters
├── styles/           tokens, base, layout, components, pages
├── App.tsx           route table
├── main.tsx          bootstrap and error fallback
└── navigation.ts     sidebar and breadcrumb metadata
tests/                Vitest unit, repository and component tests
e2e/                  Playwright journeys
docs/                 product, UX, data, rules and release documentation
```

## 3. Dependency direction

```
pages ──▶ components ──▶ domain
  │           │
  ├──────────▶ state ──▶ db ──▶ domain
  └──────────▶ domain
```

Rules:

- `domain/` imports nothing outside `domain/`. It is pure and testable without a browser.
- `db/` may import `domain/`, never `pages/` or `components/`.
- `components/` may import `domain/` and `state/`, never `db/` directly except through explicit action imports in pages.
- `pages/` compose everything.
- No circular imports between layers.

## 4. Data flow

1. `main.tsx` calls `bootstrapDatabase()` before rendering.
2. `DataProvider` opens the Dexie database and uses `useLiveQuery` to build a single snapshot of all tables plus settings.
3. Pages read the snapshot from context; they never query IndexedDB directly.
4. Writes go through repository modules. Dexie's live query invalidates the snapshot and React re-renders affected screens.
5. Multi-record writes use `db.transaction('rw', …)` so a failure cannot leave half a change.

The snapshot is intentionally small (personal finance volumes), which keeps derived selectors simple and deterministic.

## 5. State management

- **Server state:** none.
- **Persistent app state:** Dexie tables.
- **Derived state:** pure functions in `domain/`, memoised in pages with `useMemo`.
- **Ephemeral UI state:** local `useState` in components.
- **Cross-cutting UI:** toast provider and dialogs.
- **URL state:** list filters, search, sort, pagination and report ranges live in the query string so links and back/forward work.

## 6. Errors and recovery

- `ErrorBoundary` catches render errors and offers reload + export instructions.
- Validation errors are typed (`ValidationError`) and shown next to the field that failed.
- Backup problems throw `BackupValidationError` with a human-readable reason before any write.
- IndexedDB unavailable shows a dedicated storage message with remediation steps.
- Failed writes do not update UI state optimistically; the UI reports the error and keeps the form open.

## 7. PWA and offline

- Workbox precaches JS, CSS, HTML, icons and fonts.
- `registerType: 'autoUpdate'` updates the app shell on the next load.
- Core data already lives locally; offline use needs no special cache for records.
- Navigation fallback points at `index.html`, compatible with hash routing.
- `base: './'` allows static hosting from a subfolder.

## 8. Performance

- Route-level code splitting is not required at this size; the production bundle is a single minified chunk.
- Derived metrics are memoised per relevant data slice.
- Charts use lightweight SVG rather than a charting dependency.
- IndexedDB indexes cover the hot queries: date, account, category, budget, recurring.
- Large CSV imports validate first and write once in a transaction.

## 9. Testing strategy

| Layer       | Tool                    | What is proven                                             |
| ----------- | ----------------------- | ---------------------------------------------------------- |
| Domain      | Vitest                  | Money parsing, dates, recurrence, budgets, forecast, debt  |
| Persistence | Vitest + fake-indexeddb | CRUD, archive rules, atomic imports, backup validation     |
| Components  | Testing Library         | Labels, errors, dialog keyboard behaviour, progress bars   |
| Journeys    | Playwright              | First-run CRUD, detail routes, sidebar persistence, drawer |
| Build       | `npm run verify`        | Format, types, lint, tests, production build               |

## 10. Constraints

- One browser profile holds one workspace. Sharing requires a backup or a shared OS profile.
- IndexedDB is origin-scoped; moving hosts changes the storage origin.
- The app never sends data over the network by design.
