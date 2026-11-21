import { test, expect } from '@playwright/test';

test('the theme toggle switches to dark mode and survives a reload', async ({ page }) => {
  await page.goto('/giris');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Koyu temaya geç' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Açık temaya geç' })).toBeVisible();
});
