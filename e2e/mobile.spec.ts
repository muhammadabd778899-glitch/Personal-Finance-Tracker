import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('mobile primary navigation renders in the top strip and navigates', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();

  await page.getByRole('link', { name: 'Budgets', exact: true }).click();
  await expect(page).toHaveURL(/#\/budgets$/);
  await expect(page.getByRole('heading', { name: 'Budgets' })).toBeVisible();
});
