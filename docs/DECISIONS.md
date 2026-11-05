# Architecture Decisions

Short records of decisions that would be expensive to reverse. Format: context → decision → consequences.

## ADR-001 — Hash routing for portable builds

**Context:** The app is sold as a static download and may be opened from a folder, a subfolder or a simple static host. Server rewrite rules are not guaranteed.

**Decision:** Use `HashRouter` (`#/transactions`).

**Consequences:** Every deployment target works without configuration. URLs are slightly less pretty. Deep links remain stable because IDs are in the hash.

## ADR-002 — IndexedDB via Dexie, no server

**Context:** Privacy and offline-first are product promises. Buyers should not run a database.

**Decision:** Store all records in IndexedDB through Dexie. Use `useLiveQuery` for a single reactive snapshot.

**Consequences:** Data is origin-scoped and must be exported for portability. Queries are simple and fast at personal-finance scale. No sync or multi-user support.

## ADR-003 — Integer minor units

**Context:** Floating-point money errors are unacceptable in a finance product.

**Decision:** Store every amount as an integer number of minor units. Parse and format only at boundaries.

**Consequences:** All arithmetic is exact within `Number.MAX_SAFE_INTEGER`. Currency-specific digit counts must be respected in parsing and display.

## ADR-004 — Signed liability balances

**Context:** Two common models exist: store debt as positive with a type flag, or store signed balances.

**Decision:** Store liabilities as negative balances. `owed = max(0, −balance)`.

**Consequences:** One balance formula covers every account type and transfers work symmetrically. The UI must consistently present owed values as positive. Net worth is a simple sum capped at zero per asset.

## ADR-005 — Archive instead of delete when history exists

**Context:** Users expect delete buttons, but silent cascade deletion destroys financial history.

**Decision:** Accounts and categories with references are archived. Empty records can be deleted. A separate, explicit force path removes linked history after confirmation.

**Consequences:** Historical reports remain accurate. The UI must make archived records findable and restorable.

## ADR-006 — Pure domain layer

**Context:** Financial rules need to be trusted, tested and reusable.

**Decision:** Put every rule in `src/domain/` with no React, browser or Dexie imports.

**Consequences:** Fast deterministic tests. Pages become composition and presentation. Some mapping between form state and domain input is required.

## ADR-007 — URL as list state

**Context:** Detail pages must preserve context when the user goes back.

**Decision:** Store search, filters, sort and pagination in the query string; pass a compact list context in router state.

**Consequences:** Back/forward and shared links work. The URL can become long but remains human-readable.

## ADR-008 — CSS variables and component classes, not a UI kit

**Context:** The product must look distinctive and ship without a large dependency or runtime CSS-in-JS.

**Decision:** Design tokens in `tokens.css`, semantic layout in `layout.css`, reusable primitives in `components.css` and page-specific rules in `pages.css`.

**Consequences:** Small bundle and full control. Class naming discipline is required. No third-party accessibility bugs to inherit.

## ADR-009 — Hand-built SVG charts

**Context:** Chart libraries add weight and often ship inaccessible canvases.

**Decision:** Build bar and line charts with SVG and pair every chart with a `<details>` data table.

**Consequences:** Full control of reduced motion, focus and tables. Fewer chart types than a library; the product only needs two.

## ADR-010 — Checksum over canonical JSON

**Context:** A backup checksum must not change simply because Zod reorders keys during validation.

**Decision:** Compute the checksum over a recursively key-sorted serialisation that omits `undefined`.

**Consequences:** Stable across parse/stringify round trips. Detect edits and corruption. Not a cryptographic signature; it is an integrity check, documented as such.

## ADR-011 — Atomic backup restore

**Context:** Partial restores would mix two datasets and corrupt balances.

**Decision:** Validate completely, then replace every table inside one Dexie read-write transaction.

**Consequences:** A failed restore leaves the existing database untouched. The UI must download a safety backup before starting.

## ADR-012 — No budget rollover in 1.0

**Context:** Rollover rules vary by method and can rewrite history unexpectedly.

**Decision:** Budgets are explicit periods. Unused amounts do not move automatically.

**Consequences:** Historical reports are stable and easy to explain. Buyers who want envelope rollover must create a new allocation; documented as a limitation.

## ADR-013 — Sample data is namespaced and removable

**Context:** Buyers need to see a populated app immediately, but must never confuse demo records with their own.

**Decision:** Prefix every sample ID with `sample-`, label the workspace, refuse to load over real accounts, and remove only sample IDs.

**Consequences:** Safe onboarding. Slightly more complex seed and removal code.

## ADR-014 — Vitest + fake-indexeddb for persistence tests

**Context:** Repository behaviour (archive rules, atomic batches, restore) is where data-loss bugs live.

**Decision:** Run repository tests in Vitest with `fake-indexeddb`; use Playwright for real-browser journeys.

**Consequences:** Fast, deterministic database tests in CI. A few browser-specific behaviours still require E2E coverage.

## ADR-015 — No telemetry

**Context:** The product promise is privacy.

**Decision:** Ship no analytics, error reporting or remote logging.

**Consequences:** Bugs must be reported by users with exported diagnostics. The app makes zero network requests after assets load.
