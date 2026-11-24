// Records four independent scenes (each its own browser context/video):
// landing+login+search, appointments+.ics, theme toggle, admin panel. Each
// scene also gets a `timeline` (see lib/timeline.mjs) that narration beats
// are logged to with their real timestamp, so 07-assemble.mjs can burn in
// captions synced to what's actually happening on screen.
import { recordScene } from './lib/record.mjs';
import { humanClick, humanType } from './lib/browser.mjs';
import { scrollPan } from './lib/scrollPan.mjs';
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
  await recordScene('01-tanitim-giris-arama', async (page, _context, timeline) => {
    await page.goto('/');
    await page.waitForTimeout(600);
    timeline.log('Ana sayfada aşağı kaydırıyoruz', 'Scrolling down the landing page');
    await scrollPan(page, timeline, '01-tanitim-giris-arama', 900, 2200);
    await page.waitForTimeout(800);
    await scrollPan(page, timeline, '01-tanitim-giris-arama', -900, 1600);
    await page.waitForTimeout(500);

    timeline.log('Hasta giriş yapıyor', 'Patient logs in');
    await uiLogin(page, PATIENT.email, PATIENT.password);
    await page.waitForTimeout(1200);

    timeline.log('12 doktor var, farklı branşlarda', '12 doctors here, different specialties');
    await page.waitForTimeout(2000);

    timeline.log('İsme göre arıyoruz', 'Searching by name');
    await humanType(page, page.getByPlaceholder('İsim veya uzmanlık alanına göre ara…'), 'Mert');
    await page.waitForTimeout(2200);
    await page.getByPlaceholder('İsim veya uzmanlık alanına göre ara…').fill('');
    await page.waitForTimeout(400);

    timeline.log('Branşa göre de filtrelenebiliyor', 'Can filter by specialty too');
    await humanClick(page, page.getByLabel('Uzmanlık alanına göre filtrele'));
    await page.getByLabel('Uzmanlık alanına göre filtrele').selectOption({ label: 'Ortopedi ve Travmatoloji' });
    await page.waitForTimeout(2200);

    await humanClick(page, page.locator('.doctor-card', { hasText: 'Ortopedi' }).first());
    await page.waitForURL('**/doktorlar/*');
    await page.waitForTimeout(1000);
    timeline.log("Doktorun haftalık takvimi burada", "Here's the doctor's weekly calendar");
    await scrollPan(page, timeline, '01-tanitim-giris-arama', 500, 1600);
    await page.waitForTimeout(600);
    timeline.log(
      'Hafta sonu, öğle arası ve mesai dışı kapalı',
      'Weekends, lunch break, off-hours are closed',
    );
    await page.waitForTimeout(2200);
  });

  // Scene 03: a confirmed appointment already exists (booked+confirmed via
  // API above), so the recording opens straight on the interesting state.
  const { doctorName } = await ensureConfirmedAppointment();
  await recordScene('03-randevularim-ics', async (page, _context, timeline) => {
    await uiLogin(page, PATIENT.email, PATIENT.password);
    await humanClick(page, page.getByRole('link', { name: 'Randevularım' }));
    await page.waitForURL('**/randevularim');
    await page.waitForTimeout(500);
    await page.locator('.status-badge.status-confirmed').first().scrollIntoViewIfNeeded();
    timeline.log("Bu randevu zaten onaylanmış", "This appointment's already confirmed");
    await page.waitForTimeout(2800);
    timeline.log(
      "'Takvime Ekle' gerçek bir .ics dosyası indiriyor",
      "'Add to Calendar' downloads a real .ics file",
    );
    const downloadButton = page.getByRole('button', { name: 'Takvime Ekle' }).first();
    await humanMoveClickDownload(page, downloadButton);
    await page.waitForTimeout(2800);
  });

  // Scene 04a: theme toggle, while looking at the doctors list.
  await recordScene('04a-tema', async (page, _context, timeline) => {
    await uiLogin(page, PATIENT.email, PATIENT.password);
    await page.waitForTimeout(500);
    timeline.log('Koyu temaya geçiyoruz, tercih kalıcı', "Switching to dark mode, it's remembered");
    await humanClick(page, page.getByRole('button', { name: 'Koyu temaya geç' }));
    await page.waitForTimeout(3600);
  });

  // Scene 05: admin panel stats.
  await recordScene('05-admin-panel', async (page, _context, timeline) => {
    await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await humanClick(page, page.getByRole('link', { name: 'Admin Paneli' }));
    await page.waitForURL('**/admin');
    await page.waitForTimeout(800);
    timeline.log(
      'Admin panelinde kullanıcı ve randevu sayıları var',
      'Admin panel shows user and appointment counts',
    );
    await page.waitForTimeout(3000);
    timeline.log('Kullanıcı rolleri buradan değiştiriliyor', 'User roles get changed here');
    await scrollPan(page, timeline, '05-admin-panel', 400, 1300);
    await page.waitForTimeout(3200);
  });

  console.log(`Appointment confirmed for ${doctorName}; scenes recorded.`);
}

async function humanMoveClickDownload(page, locator) {
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
  await page.waitForTimeout(300);
  const [download] = await Promise.all([page.waitForEvent('download'), locator.click()]);
  await download.path();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
