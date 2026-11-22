// The centerpiece scene: two half-width recordings (patient left, doctor
// right), started together so their timelines line up, later combined
// side-by-side with ffmpeg's hstack filter (see 05-assemble.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, humanClick, humanType } from './lib/browser.mjs';
import { WORK_DIR } from './lib/ffmpeg.mjs';

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
  const patient = await patientCtx.newPage();
  const doctor = await doctorCtx.newPage();

  // Log both in before the "live" part of the scene starts, so the clip
  // opens on the doctor list / doctor detail, not a login form.
  await Promise.all([login(patient, PATIENT.email, PATIENT.password), login(doctor, DOCTOR.email, DOCTOR.password)]);

  await doctor.waitForTimeout(400);
  // Doctor just sits on the doctors list - the bell in the top nav is on
  // every authenticated page, which is all a live notification needs.
  await doctor.waitForTimeout(600);

  await humanClick(patient, patient.locator('.doctor-card', { hasText: 'Kardiyoloji' }).first());
  await patient.waitForURL('**/doktorlar/*');
  await patient.waitForTimeout(1200);

  const freeSlot = patient.locator('.slot-item', { hasNotText: 'Dolu' }).first();
  await freeSlot.scrollIntoViewIfNeeded();
  await patient.waitForTimeout(600);
  await humanClick(patient, freeSlot.getByRole('button', { name: 'Randevu Al' }));

  await Promise.all([
    patient.getByText('Randevu talebiniz alındı').waitFor(),
    doctor.locator('.bell-badge').waitFor({ timeout: 10_000 }),
  ]);
  await patient.waitForTimeout(600);

  // Patient moves to "my appointments" to watch the pending -> confirmed
  // transition live, without a reload.
  await humanClick(patient, patient.getByRole('link', { name: 'Randevularım' }));
  await patient.waitForURL('**/randevularim');
  await patient.waitForTimeout(1000);

  // Doctor notices the live bell update and opens it.
  await humanClick(doctor, doctor.locator('.bell-button'));
  await doctor.waitForTimeout(1200);
  await doctor.locator('.bell-dropdown').getByText('Yeni randevu talebi').first().waitFor();
  await doctor.waitForTimeout(1000);

  await humanClick(doctor, doctor.getByRole('link', { name: 'Randevularım' }));
  await doctor.waitForURL('**/randevularim');
  await doctor.waitForTimeout(1000);

  const approveButton = doctor.getByRole('button', { name: 'Onayla' }).first();
  await approveButton.scrollIntoViewIfNeeded();
  await humanClick(doctor, approveButton);
  await doctor.waitForTimeout(400);
  await humanClick(doctor, doctor.getByRole('alertdialog').getByRole('button', { name: 'Onayla' }));

  // The patient side is the payoff: a live toast + status flip, no reload.
  await patient.locator('.status-badge.status-confirmed').first().waitFor({ timeout: 10_000 });
  await patient.waitForTimeout(2200);
  await doctor.waitForTimeout(500);

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
  console.log('recorded 02-split-patient.webm + 02-split-doctor.webm');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
