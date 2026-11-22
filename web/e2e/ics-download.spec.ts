import { test, expect } from '@playwright/test';
import { loginAs, seedDoctorWithAvailability, seedPatient } from './helpers';

test('downloading a confirmed appointment as a calendar file', async ({ page, browser }) => {
  const doctor = await seedDoctorWithAvailability();
  const patient = await seedPatient();

  await loginAs(page, patient.email, patient.password);
  await page.locator('.doctor-card', { hasText: doctor.specialty }).click();
  await page.waitForURL('**/doktorlar/*');
  const firstSlot = page.locator('.slot-item', { hasNotText: 'Dolu' }).first();
  await firstSlot.getByRole('button', { name: 'Randevu Al' }).click();
  await expect(page.getByText('Randevu talebiniz alındı')).toBeVisible();

  // A pending appointment has no "Takvime Ekle" button yet - only a
  // confirmed one does, so it is confirmed from a second, doctor session.
  await page.getByRole('link', { name: 'Randevularım' }).click();
  await page.waitForURL('**/randevularim');
  await expect(page.getByRole('button', { name: 'Takvime Ekle' })).toHaveCount(0);

  const doctorContext = await browser.newContext();
  const doctorPage = await doctorContext.newPage();
  try {
    await loginAs(doctorPage, doctor.email, doctor.password);
    await doctorPage.getByRole('link', { name: 'Randevularım' }).click();
    await doctorPage.waitForURL('**/randevularim');
    await doctorPage.getByRole('button', { name: 'Onayla' }).click();
    await doctorPage.getByRole('alertdialog').getByRole('button', { name: 'Onayla' }).click();
    await expect(doctorPage.getByText('Onaylandı')).toBeVisible();
  } finally {
    await doctorContext.close();
  }

  // No reload needed: MyAppointmentsPage refetches on the live "notification"
  // socket event the confirmation above triggers (see realtime.spec.ts).
  // Scoped to the status badge: a toast with overlapping text ("...randevunuz
  // onaylandı") is also on screen right after the confirmation.
  await expect(page.locator('.status-badge.status-confirmed')).toBeVisible({ timeout: 10_000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Takvime Ekle' }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^randevu-.*\.ics$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const content = Buffer.concat(chunks).toString('utf8');
  expect(content).toContain('BEGIN:VCALENDAR');
  expect(content).toContain(doctor.name);
});
