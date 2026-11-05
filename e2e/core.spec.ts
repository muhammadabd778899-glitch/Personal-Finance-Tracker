import { expect, test } from '@playwright/test';

test('first run creates an account, records a transaction and opens its detail view', async ({
  page,
}) => {
  await page.goto('/#/accounts');
  await expect(page.getByRole('heading', { name: 'Accounts and balances' })).toBeVisible();

  await page.getByRole('button', { name: 'Add account' }).first().click();
  const accountDialog = page.getByRole('dialog', { name: 'Add account' });
  await accountDialog.getByLabel('Account name').fill('Playwright Checking');
  await accountDialog.getByLabel('Opening balance').fill('1000');
  await accountDialog.getByRole('button', { name: 'Add account' }).click();
  await expect(accountDialog).toBeHidden();
  await expect(page.getByText('Playwright Checking').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add transaction', exact: true }).first().click();
  const transactionDialog = page.getByRole('dialog', { name: 'Quick add transaction' });
  await transactionDialog.getByLabel('Amount').fill('42.50');
  await transactionDialog.getByLabel('Description').fill('Coffee beans');
  await transactionDialog.getByRole('button', { name: 'Save transaction' }).click();
  await expect(transactionDialog).toBeHidden();

  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
  await page.getByRole('link', { name: 'Coffee beans' }).click();

  await expect(page).toHaveURL(/#\/transactions\/.+/);
  await expect(
    page.getByRole('heading', { name: 'Transaction', exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Coffee beans').first()).toBeVisible();
  await expect(page.locator('.detail-amount')).toContainText('42.50');

  await page.goBack();
  await expect(page).toHaveURL(/#\/transactions$/);
  await expect(page.getByRole('link', { name: 'Coffee beans' })).toBeVisible();
});

test('desktop top bar keeps the primary navigation in the top strip', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reports', exact: true })).toBeVisible();
});

test('sample workspace navigation keeps list context', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText(/Net worth ·/)).toBeVisible();

  await page.getByRole('link', { name: 'Transactions', exact: true }).click();
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const firstDescription = (await rows.first().locator('a.table-link').textContent())?.trim();
  expect(firstDescription).toBeTruthy();

  const search = page.getByLabel('Search transactions');
  await search.fill(firstDescription!);
  await expect(page.getByText(/matching filters/)).toBeVisible();

  await page.getByRole('link', { name: firstDescription!, exact: true }).first().click();
  await expect(page).toHaveURL(/#\/transactions\/.+/);
  await page.goBack();
  await expect(search).toHaveValue(firstDescription!);
});

test('reports render an accessible chart table and CSV download', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

  await page.getByText('View values as a table', { exact: true }).first().click();
  await expect(page.locator('table').first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export transactions' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
});
