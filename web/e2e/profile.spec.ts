import { test, expect } from '@playwright/test';
import { loginAs, seedPatient, submitLoginForm } from './helpers';
import { resetRateLimitedServices } from './resetRateLimits';

// By the time this file runs, the four spec files before it (plus this
// suite's own page loads, each bootstrapping auth via GET /auth/me + POST
// /auth/refresh) have already spent a good chunk of the gateway's
// credential-endpoint budget (AUTH_RATE_LIMIT_MAX, 20/15min - see
// resetRateLimits.ts). globalSetup only resets this once, at the very start
// of the whole run, so the two password-change requests below can land
// after the budget is gone and get a 429 ("Çok fazla istek gönderdiniz")
// instead of the validation response the assertions expect. A fresh reset
// right before this file's own test removes that ordering dependency.
test.beforeAll(() => {
  resetRateLimitedServices();
});

test('updating the profile name and changing the password both take effect', async ({ page }) => {
  const patient = await seedPatient();
  await loginAs(page, patient.email, patient.password);

  await page.getByRole('link', { name: 'E2E Hasta' }).click();
  await page.waitForURL('**/profilim');
  const newName = `E2E Güncellenmiş Ad ${Date.now()}`;
  const nameInput = page.getByLabel('Ad Soyad');
  await nameInput.fill('');
  await nameInput.fill(newName);
  await page.getByRole('button', { name: 'Profili Kaydet' }).click();

  await expect(page.getByText('Profiliniz güncellendi.')).toBeVisible();
  // The nav's user chip reflects the new name without a page reload.
  await expect(page.getByRole('link', { name: newName })).toBeVisible();

  const newPassword = 'yeni-gizli-parola-456';

  // Wrong current password is rejected, with the old password still valid.
  await page.getByLabel('Mevcut Şifre').fill('kesinlikle-yanlis-sifre');
  await page.getByLabel('Yeni Şifre', { exact: true }).fill(newPassword);
  await page.getByLabel('Yeni Şifre (Tekrar)').fill(newPassword);
  await page.getByRole('button', { name: 'Şifreyi Güncelle' }).click();
  await expect(page.getByText('Mevcut şifre hatalı')).toBeVisible();

  // The correct current password changes it.
  await page.getByLabel('Mevcut Şifre').fill(patient.password);
  await page.getByRole('button', { name: 'Şifreyi Güncelle' }).click();
  await expect(page.getByText('Şifreniz güncellendi.')).toBeVisible();

  // Logging back in only works with the new password now.
  await page.getByRole('button', { name: 'Çıkış' }).click();
  await page.waitForURL('**/giris');
  await page.getByLabel('E-posta').fill(patient.email);
  await page.getByLabel('Şifre').fill(newPassword);
  await submitLoginForm(page);
  await expect(page.getByRole('link', { name: newName })).toBeVisible();
});
