// Captures listing screenshots from the running dev server.
// Usage: npm run dev -- --port 4173 & node scripts/capture-screenshots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.APP_URL ?? 'http://localhost:4173';
const outDir = join(process.cwd(), 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function seed(page) {
  await page.goto(`${base}/#/`);
  await page.getByRole('button', { name: 'Explore sample workspace' }).click();
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.waitForTimeout(500);
}

async function dismissToast(page) {
  const toast = page.locator('.toast-region .toast').first();
  const visible = await toast.isVisible().catch(() => false);
  if (visible) {
    await toast.getByRole('button', { name: 'Dismiss message' }).click();
    await page.waitForTimeout(300);
  }
}

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
});
const page = await desktop.newPage();
await seed(page);

const shots = [
  ['dashboard', '/'],
  ['transactions', '/transactions'],
  ['budgets', '/budgets'],
  ['bills', '/bills'],
  ['goals', '/goals'],
  ['debt', '/debt'],
  ['net-worth', '/net-worth'],
  ['reports', '/reports'],
  ['settings', '/settings'],
];

for (const [name, route] of shots) {
  if (route !== '/') await page.goto(`${base}/#${route}`);
  await dismissToast(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
  console.log(`captured ${name}.png`);
}

// Dark theme variant of the dashboard.
await page.goto(`${base}/#/`);
await dismissToast(page);
await page.getByRole('button', { name: /Switch to dark theme/ }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, 'dashboard-dark.png'), fullPage: false });
console.log('captured dashboard-dark.png');

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  isMobile: true,
  hasTouch: true,
});
const mobilePage = await mobile.newPage();
await seed(mobilePage);
await dismissToast(mobilePage);
await mobilePage.screenshot({ path: join(outDir, 'mobile.png'), fullPage: false });
console.log('captured mobile.png');

// Mobile drawer.
await mobilePage.getByRole('button', { name: 'Open navigation' }).click();
await mobilePage.waitForTimeout(350);
await mobilePage.screenshot({ path: join(outDir, 'mobile-drawer.png'), fullPage: false });
console.log('captured mobile-drawer.png');
await dismissToast(mobilePage);

await browser.close();
