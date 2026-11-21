import { test, expect } from '@playwright/test';
import { loginAs, seedDoctorWithAvailability, seedPatient } from './helpers';

test('cancelling an appointment goes through a confirmation dialog', async ({ page }) => {
  const doctor = await seedDoctorWithAvailability();
  const patient = await seedPatient();

  await loginAs(page, patient.email, patient.password);
  await page.locator('.doctor-card', { hasText: doctor.specialty }).click();
  await page.waitForURL('**/doktorlar/*');

  const firstSlot = page.locator('.slot-item', { hasNotText: 'Dolu' }).first();
  await firstSlot.getByRole('button', { name: 'Randevu Al' }).click();
  await expect(page.getByText('Randevu talebiniz alındı')).toBeVisible();

  await page.getByRole('link', { name: 'Randevularım' }).click();
  await page.waitForURL('**/randevularim');
  await page.getByRole('button', { name: 'İptal Et' }).click();

  // The dialog is shown and the appointment is not cancelled until confirmed.
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Randevuyu iptal et' })).toBeVisible();
  await expect(page.getByText('Onay bekliyor')).toBeVisible();

  await dialog.getByRole('button', { name: 'Vazgeç' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Onay bekliyor')).toBeVisible();

  await page.getByRole('button', { name: 'İptal Et' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Evet, iptal et' }).click();

  await expect(page.getByText('İptal edildi')).toBeVisible();
});
