# AI Development Protocol

**Purpose:** Keep AI-assisted changes correct, reviewable and safe for a product that stores financial history. This protocol applies to every contributor, human or AI.

## 1. Non-negotiable invariants

1. Money is integer minor units. Never introduce floats for balances or totals.
2. Date-only values stay `YYYY-MM-DD`. Never round-trip a calendar date through a local timezone.
3. Transfers are not income and not spending.
4. Liabilities are stored negative; owed amounts are displayed positive.
5. Historical records are never silently rewritten or deleted.
6. Multi-record writes use a database transaction.
7. Validation happens at every boundary: form, repository, import, restore.
8. Derived numbers must be explainable from records the user can inspect.
9. No network call may carry financial data.
10. Estimates are labelled as estimates and list their assumptions.

## 2. Before changing code

- Read the relevant spec: `PRODUCT_SPEC.md`, `FINANCIAL_RULES.md`, `DATA_MODEL.md` and `ACCEPTANCE_CRITERIA.md`.
- Identify the layer you are changing. Domain rules belong in `src/domain/`; persistence in `src/db/`; presentation in `src/pages` or `src/components`.
- Check whether an existing helper already implements the rule. Prefer extending the single source of truth.
- If the change alters a documented rule, update the document in the same change.

## 3. Making changes

- Keep diffs focused. Do not mix refactors with behaviour changes.
- Preserve public helper names used across the app unless every caller is updated.
- Add or update tests before declaring the change complete.
- For schema changes, add a new Dexie version with an explicit upgrade. Never mutate version 1 in place.
- For backup changes, increment `BACKUP_VERSION` and support reading older files.
- For UI changes, verify keyboard, focus, labels, empty and loading states.
- Do not add a dependency for something the standard library or an existing helper already does.
- Do not weaken a test to make it pass. Fix the behaviour or change the documented requirement deliberately.

## 4. Review checklist

### Correctness

- [ ] Boundary values tested: zero, negative, maximum, leap day, month end, year end.
- [ ] Transfers excluded from income/spending.
- [ ] Refunds reduce net spending, not income.
- [ ] Archived records excluded from active lists but visible where history matters.
- [ ] Database writes atomic where more than one record changes.

### Data safety

- [ ] No silent data loss.
- [ ] Restore validates before writing.
- [ ] Destructive actions confirm and explain consequences.
- [ ] Backup format remains readable by the current release.

### UX and accessibility

- [ ] Labels and error announcements present.
- [ ] Focus returns after dialogs.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Charts have table alternatives.
- [ ] Empty, loading and error states exist.

### Quality gates

- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run e2e` for user-facing changes

## 5. Prohibited shortcuts

- Faking data to make a screen look complete.
- Skipping validation because "the form already checks it".
- Using `any` to silence a type error.
- Deleting a failing assertion instead of fixing the cause.
- Writing to IndexedDB from a component without a repository.
- Computing balances in a page or component.
- Hiding errors behind a toast with no actionable message.
- Adding telemetry, remote fonts, CDNs or analytics.
- Introducing a subscription, account system or bank connection.

## 6. Definition of done

A change is done when:

1. The behaviour matches the written rule.
2. Tests cover the new path and the boundaries it touches.
3. Documentation is updated if a rule, schema or backup format changed.
4. All quality gates pass locally.
5. The change can be explained in one paragraph without hand-waving.

## 7. Incident response

If a data-loss or corruption issue is found:

1. Stop writing to the affected path.
2. Reproduce with sample data or a backup.
3. Add a failing test.
4. Fix forward without deleting user data.
5. If a migration is required, preserve the old value in `meta` before transforming.
6. Update the release notes and the relevant rule document.
