import { test, expect } from '@playwright/test';
import { mailIdsTo, seedPatient, submitLoginForm, waitForNewMailLink } from './helpers';

// Exercises the real pipeline end to end, including the one leg that is
// otherwise untested by anything except Jest mocks: auth-service actually
// sending mail through SMTP, caught for real by the MailHog container (see
// docker-compose.yml), not a stub standing in for it.
test('resetting a forgotten password through the real e-mail MailHog catches', async ({
  page,
}) => {
  const patient = await seedPatient();
  const before = await mailIdsTo(patient.email);

  await page.goto('/giris');
  await page.getByRole('link', { name: 'Şifrenizi mi unuttunuz?' }).click();
  await page.waitForURL('**/sifremi-unuttum');
  await page.getByLabel('E-posta').fill(patient.email);
  await page.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }).click();
  await expect(page.getByText(/şifre sıfırlama bağlantısı gönderildi/i)).toBeVisible();

  const link = await waitForNewMailLink(patient.email, before, { linkContains: '/reset-password' });
  const resetUrl = new URL(link);

  const newPassword = 'yeni-gizli-parola-789';
  await page.goto(`${resetUrl.pathname}${resetUrl.search}`);
  await page.getByLabel('Yeni Şifre').fill(newPassword);
  await page.getByRole('button', { name: 'Şifreyi Güncelle' }).click();
  await expect(page.getByText(/şifreniz sıfırlandı/i)).toBeVisible();

  // The old password no longer works, the new one does.
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(patient.email);
  await page.getByLabel('Şifre').fill(patient.password);
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await expect(page.getByText('E-posta veya şifre hatalı')).toBeVisible();

  await page.getByLabel('Şifre').fill(newPassword);
  await submitLoginForm(page);
  await expect(page).toHaveURL(/\/doktorlar/);
});
