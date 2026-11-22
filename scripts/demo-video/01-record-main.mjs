// Records four independent scenes (each its own browser context/video):
// landing+login+search, appointments+.ics, theme toggle, admin panel.
import { recordScene } from './lib/record.mjs';
import { humanClick, humanType, humanScroll } from './lib/browser.mjs';
import * as api from './lib/api.mjs';

const PATIENT = { email: 'hasta@randevia.local', password: 'Demo12345!' };
const DOCTOR = { email: 'doktor@randevia.local', password: 'Demo12345!' };
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@randevia.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD env var required (see root .env).');
  process.exit(1);
}

async function uiLogin(page, email, password) {
  await page.goto('/giris');
  await page.waitForTimeout(500);
  await humanType(page, page.getByLabel('E-posta'), email);
  await humanType(page, page.getByLabel('Şifre'), password);
  await humanClick(page, page.getByRole('button', { name: 'Giriş Yap' }));
  await page.waitForURL('**/doktorlar');
  await page.waitForTimeout(600);
}

function freeSlotsFromAvailability(availability, bookedSlots) {
  const booked = new Set(bookedSlots);
  const slots = [];
  for (const window of availability) {
    let t = new Date(window.startTime).getTime();
    const end = new Date(window.endTime).getTime();
    while (t < end) {
      const iso = new Date(t).toISOString();
      if (!booked.has(iso) && t > Date.now()) slots.push(iso);
      t += 30 * 60 * 1000;
    }
  }
  return slots;
}

async function ensureConfirmedAppointment() {
  const patientToken = await api.login(PATIENT.email, PATIENT.password);
  const doctorToken = await api.login(DOCTOR.email, DOCTOR.password);

  // Find "Dr. Demo Doktor"'s own doctor profile id via the doctor's own
  // appointments/me would not give it; instead ask the public list.
  const res = await fetch('http://localhost:3000/api/v1/doctors', {
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  const { data } = await res.json();
  const demoDoctor = data.doctors.find((d) => d.specialty === 'Kardiyoloji');
  const doctorId = demoDoctor._id;

  const detail = await api.getDoctor(doctorId, patientToken);
  const free = freeSlotsFromAvailability(detail.availability, detail.bookedSlots);
  if (free.length === 0) throw new Error('No free slot found for demo doctor');
  const slot = free[0];

  const appointment = await api.bookAppointment(patientToken, doctorId, slot);
  await api.confirmAppointment(doctorToken, appointment._id);
  return { doctorId, doctorName: demoDoctor.name };
}

async function main() {
  // Scene 01: landing page scroll, login, search/filter, doctor detail.
  await recordScene('01-tanitim-giris-arama', async (page) => {
    await page.goto('/');
    await page.waitForTimeout(1200);
    await humanScroll(page, 900, 14, 160);
    await page.waitForTimeout(600);
    await humanScroll(page, -900, 10, 120);
    await page.waitForTimeout(500);

    await uiLogin(page, PATIENT.email, PATIENT.password);

    await humanType(page, page.getByPlaceholder('İsim veya uzmanlık alanına göre ara…'), 'Mert');
    await page.waitForTimeout(1200);
    await page.getByPlaceholder('İsim veya uzmanlık alanına göre ara…').fill('');
    await page.waitForTimeout(400);
    await humanClick(page, page.getByLabel('Uzmanlık alanına göre filtrele'));
    await page.getByLabel('Uzmanlık alanına göre filtrele').selectOption({ label: 'Ortopedi ve Travmatoloji' });
    await page.waitForTimeout(1000);

    await humanClick(page, page.locator('.doctor-card', { hasText: 'Ortopedi' }).first());
    await page.waitForURL('**/doktorlar/*');
    await page.waitForTimeout(1500);
    await humanScroll(page, 500, 8, 150);
    await page.waitForTimeout(1500);
  });

  // Scene 03: a confirmed appointment already exists (booked+confirmed via
  // API above), so the recording opens straight on the interesting state.
  const { doctorName } = await ensureConfirmedAppointment();
  await recordScene('03-randevularim-ics', async (page) => {
    await uiLogin(page, PATIENT.email, PATIENT.password);
    await humanClick(page, page.getByRole('link', { name: 'Randevularım' }));
    await page.waitForURL('**/randevularim');
    await page.waitForTimeout(800);
    await page.locator('.status-badge.status-confirmed').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const downloadButton = page.getByRole('button', { name: 'Takvime Ekle' }).first();
    await humanMoveClickDownload(page, downloadButton);
    await page.waitForTimeout(1500);
  });

  // Scene 04a: theme toggle, while looking at the doctors list.
  await recordScene('04a-tema', async (page) => {
    await uiLogin(page, PATIENT.email, PATIENT.password);
    await page.waitForTimeout(800);
    await humanClick(page, page.getByRole('button', { name: 'Koyu temaya geç' }));
    await page.waitForTimeout(1800);
    await humanClick(page, page.getByRole('button', { name: 'Açık temaya geç' }));
    await page.waitForTimeout(1000);
    await humanClick(page, page.getByRole('button', { name: 'Koyu temaya geç' }));
    await page.waitForTimeout(1800);
  });

  // Scene 05: admin panel stats.
  await recordScene('05-admin-panel', async (page) => {
    await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await humanClick(page, page.getByRole('link', { name: 'Admin Paneli' }));
    await page.waitForURL('**/admin');
    await page.waitForTimeout(1500);
    await humanScroll(page, 400, 8, 150);
    await page.waitForTimeout(2000);
  });

  console.log(`Appointment confirmed for ${doctorName}; scenes recorded.`);
}

async function humanMoveClickDownload(page, locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await page.waitForTimeout(300);
  const [download] = await Promise.all([page.waitForEvent('download'), locator.click()]);
  await download.path();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
