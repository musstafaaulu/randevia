import { test, expect } from '@playwright/test';
import { loginAs, seedDoctorWithAvailability, seedPatient } from './helpers';

test('searching and filtering the doctor list narrows it to the matching doctor', async ({
  page,
}) => {
  const patient = await seedPatient();
  const cardiologist = await seedDoctorWithAvailability({
    name: `Dr. Arama Testi ${Date.now()}`,
    specialty: `E2E Arama Kardiyoloji ${Date.now()}`,
  });
  const dermatologist = await seedDoctorWithAvailability({
    name: `Dr. Diğer Doktor ${Date.now()}`,
    specialty: `E2E Arama Dermatoloji ${Date.now()}`,
  });

  await loginAs(page, patient.email, patient.password);

  // Both doctors are present before any filtering.
  await expect(page.getByText(cardiologist.name)).toBeVisible();
  await expect(page.getByText(dermatologist.name)).toBeVisible();

  // Searching by (part of) the doctor's own name narrows the list to them.
  await page
    .getByPlaceholder('İsim veya uzmanlık alanına göre ara…')
    .fill(cardiologist.name.split(' ')[2]);
  await expect(page.getByText(cardiologist.name)).toBeVisible();
  await expect(page.getByText(dermatologist.name)).not.toBeVisible();

  // Clearing the search and filtering by specialty instead does the same.
  await page.getByPlaceholder('İsim veya uzmanlık alanına göre ara…').fill('');
  await page
    .getByLabel('Uzmanlık alanına göre filtrele')
    .selectOption(dermatologist.specialty);
  await expect(page.getByText(dermatologist.name)).toBeVisible();
  await expect(page.getByText(cardiologist.name)).not.toBeVisible();

  // A search with no match shows the dedicated empty state, not an empty page.
  await page.getByLabel('Uzmanlık alanına göre filtrele').selectOption('');
  await page
    .getByPlaceholder('İsim veya uzmanlık alanına göre ara…')
    .fill('bu-isimde-kimse-yok-xyz');
  await expect(page.getByText('Aramanızla eşleşen doktor bulunamadı.')).toBeVisible();
});
