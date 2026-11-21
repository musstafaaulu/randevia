import { test, expect } from '@playwright/test';
import { loginAs, seedPatient, submitLoginForm } from './helpers';

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
