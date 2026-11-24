// The centerpiece scene: two half-width recordings (patient left, doctor
// right), started together so their timelines line up, later combined
// side-by-side with ffmpeg's hstack filter (see 07-assemble.mjs). A single
// shared timeline (both contexts are created back to back on the same
// process clock) drives the burned-in captions.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, humanClick, humanType } from './lib/browser.mjs';
import { WORK_DIR } from './lib/ffmpeg.mjs';
import { createTimeline } from './lib/timeline.mjs';

const PATIENT = { email: 'hasta@randevia.local', password: 'Demo12345!' };
const DOCTOR = { email: 'doktor@randevia.local', password: 'Demo12345!' };
const VIEWPORT = { width: 960, height: 1080 };
const RAW_DIR = path.join(WORK_DIR, 'raw');

async function login(page, email, password) {
  await page.goto('http://localhost:8080/giris');
  await page.waitForTimeout(300);
  await humanType(page, page.getByLabel('E-posta'), email);
  await humanType(page, page.getByLabel('Şifre'), password);
  await humanClick(page, page.getByRole('button', { name: 'Giriş Yap' }));
  await page.waitForURL('**/doktorlar');
}

async function main() {
  const browser = await chromium.launch();

  const patientTmp = path.join(RAW_DIR, '_tmp-patient');
  const doctorTmp = path.join(RAW_DIR, '_tmp-doctor');
  fs.mkdirSync(patientTmp, { recursive: true });
  fs.mkdirSync(doctorTmp, { recursive: true });

  const patientCtx = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: patientTmp, size: VIEWPORT },
  });
  const doctorCtx = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: doctorTmp, size: VIEWPORT },
  });
  const timeline = createTimeline();
  const patient = await patientCtx.newPage();
  const doctor = await doctorCtx.newPage();

  // Log both in before the "live" part of the scene starts, so the clip
  // opens on the doctor list / doctor detail, not a login form.
  await Promise.all([login(patient, PATIENT.email, PATIENT.password), login(doctor, DOCTOR.email, DOCTOR.password)]);

  await doctor.waitForTimeout(400);
  await humanClick(patient, patient.locator('.doctor-card', { hasText: 'Kardiyoloji' }).first());
  await patient.waitForURL('**/doktorlar/*');
  await patient.waitForTimeout(600);
  timeline.log("Hasta müsait bir saat arıyor", "Patient's looking for an open slot");
  await patient.waitForTimeout(2600);

  const freeSlotButton = patient.getByRole('button', { name: /için randevu al$/ }).first();
  await freeSlotButton.scrollIntoViewIfNeeded();
  await patient.waitForTimeout(500);
  const slotLabel = (await freeSlotButton.getAttribute('aria-label').catch(() => null)) ?? '';
  const slotTime = slotLabel.replace(/ için randevu al$/, '').trim() || null;
  timeline.log(
    slotTime ? `Hasta ${slotTime}'e randevu alıyor` : 'Hasta randevu alıyor',
    slotTime ? `Patient books ${slotTime}` : 'Patient books an appointment',
  );
  await humanClick(patient, freeSlotButton);

  await Promise.all([
    patient.locator('.form-notice', { hasText: 'Randevu talebiniz alındı' }).waitFor(),
    doctor.locator('.bell-badge').waitFor({ timeout: 10_000 }),
  ]);
  timeline.log(
    'Doktorun ekranına bildirim anında geliyor, sayfa yenilenmedi',
    "Notification hits the doctor's screen instantly, no refresh",
  );
  await patient.waitForTimeout(3200);

  // Patient moves to "my appointments" to watch the pending -> confirmed
  // transition live, without a reload.
  await humanClick(patient, patient.getByRole('link', { name: 'Randevularım' }));
  await patient.waitForURL('**/randevularim');
  await patient.waitForTimeout(600);

  // Doctor notices the live bell update and opens it.
  timeline.log('Doktor bildirimi açıp talebi görüyor', 'Doctor opens the bell, sees the request');
  await humanClick(doctor, doctor.locator('.bell-button'));
  await doctor.waitForTimeout(1200);
  await doctor.locator('.bell-dropdown').getByText('Yeni randevu talebi').first().waitFor();
  await doctor.waitForTimeout(2200);

  await humanClick(doctor, doctor.getByRole('link', { name: 'Randevularım' }));
  await doctor.waitForURL('**/randevularim');
  await doctor.waitForTimeout(800);

  const approveButton = doctor.getByRole('button', { name: 'Onayla' }).first();
  await approveButton.scrollIntoViewIfNeeded();
  timeline.log('Doktor randevuyu onaylıyor', 'Doctor approves it');
  await humanClick(doctor, approveButton);
  await doctor.waitForTimeout(300);
  await humanClick(doctor, doctor.getByRole('alertdialog').getByRole('button', { name: 'Onayla' }));

  // The patient side is the payoff: a live toast + status flip, no reload.
  await patient.locator('.status-badge.status-confirmed').first().waitFor({ timeout: 10_000 });
  timeline.log(
    'Hastaya anında onay geliyor, durum canlı güncelleniyor',
    'Patient gets instant confirmation, status updates live',
  );
  await patient.waitForTimeout(3600);

  await patientCtx.close();
  await doctorCtx.close();
  await browser.close();

  for (const [tmp, name] of [
    [patientTmp, 'patient'],
    [doctorTmp, 'doctor'],
  ]) {
    const files = fs.readdirSync(tmp).filter((f) => f.endsWith('.webm'));
    fs.copyFileSync(path.join(tmp, files[0]), path.join(RAW_DIR, `02-split-${name}.webm`));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  fs.writeFileSync(
    path.join(RAW_DIR, '02-split-screen-rezervasyon-events.json'),
    JSON.stringify(timeline.events, null, 2),
  );
  console.log(`recorded 02-split-patient.webm + 02-split-doctor.webm (${timeline.events.length} caption events)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
