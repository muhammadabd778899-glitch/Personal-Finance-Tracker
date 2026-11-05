import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile navigation opens as a drawer and closes after choosing a page', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const shell = page.locator('.app-shell');
  await expect(shell).toHaveAttribute('data-drawer', 'closed');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(shell).toHaveAttribute('data-drawer', 'open');
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeHidden();

  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await expect(shell).toHaveAttribute('data-drawer', 'closed');
  await expect(page).toHaveURL(/#\/budgets$/);
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();

  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  await expect(shell).toHaveAttribute('data-drawer', 'closed');
});
