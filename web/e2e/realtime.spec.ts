import { test, expect, type Browser } from '@playwright/test';
import { loginAs, seedDoctorWithAvailability, seedPatient } from './helpers';

async function newLoggedInSession(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, email, password);
  return { context, page };
}

test('patient booking an appointment notifies the doctor live, without a reload', async ({
  browser,
}) => {
  const doctor = await seedDoctorWithAvailability();
  const patient = await seedPatient();

  const doctorSession = await newLoggedInSession(browser, doctor.email, doctor.password);
  const patientSession = await newLoggedInSession(browser, patient.email, patient.password);

  try {
    // The doctor just sits on the doctors list; the bell in the top nav is
    // present on every authenticated page, which is all a live notification
    // needs to reach them.
    await expect(doctorSession.page.locator('.bell-badge')).toHaveCount(0);

    await patientSession.page.locator('.doctor-card', { hasText: doctor.specialty }).click();
    await patientSession.page.waitForURL('**/doktorlar/*');

    const firstSlot = patientSession.page.locator('.slot-item', { hasNotText: 'Dolu' }).first();
    await firstSlot.getByRole('button', { name: 'Randevu Al' }).click();

    await expect(patientSession.page.getByText('Randevu talebiniz alındı')).toBeVisible();

    // No reload on the doctor's page: the badge and toast must arrive purely
    // over the websocket connection that was opened at login.
    await expect(doctorSession.page.locator('.bell-badge')).toHaveText('1', { timeout: 10_000 });
    await expect(doctorSession.page.getByText('Yeni randevu talebi')).toBeVisible();

    await doctorSession.page.locator('.bell-button').click();
    await expect(
      doctorSession.page.locator('.bell-dropdown').getByText('Yeni randevu talebi'),
    ).toBeVisible();
  } finally {
    await doctorSession.context.close();
    await patientSession.context.close();
  }
});
