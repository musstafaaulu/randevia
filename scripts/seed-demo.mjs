#!/usr/bin/env node
// Creates (or reuses) a demo patient and a demo doctor with a specialty and a
// few upcoming availability windows, so the web UI has real content to show
// right after `docker compose up` instead of an empty system.
//
//   docker compose up -d --build
//   node scripts/seed-demo.mjs
//
// Env: GATEWAY_URL (default http://localhost:3000), ADMIN_EMAIL and
// ADMIN_PASSWORD (default: the values in the root .env that docker compose
// uses). Safe to run again: existing demo accounts are logged into instead
// of re-registered, and availability windows are only added if none exist
// in the future yet.
//
// 12 doctors x ~10 upcoming weekdays x 2 windows (morning/afternoon, split
// around the lunch break) adds up to several hundred requests - on a fresh
// system that's still under the gateway's default RATE_LIMIT_MAX (300 per
// 15 min), but if you've already made other requests in this window (or are
// re-seeding right after another script ran), raise it first:
//
//   RATE_LIMIT_MAX=5000 docker compose up -d --no-deps api-gateway

import { readFileSync } from 'node:fs';

function readComposeEnv() {
  let file;
  try {
    file = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  } catch {
    return {};
  }
  const entries = [];
  for (const line of file.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) entries.push([match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]);
  }
  return Object.fromEntries(entries);
}

const composeEnv = readComposeEnv();
const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || composeEnv.ADMIN_EMAIL || 'admin@randevia.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || composeEnv.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is not set, neither in the environment nor in .env.');
  process.exit(1);
}

const DEMO_PASSWORD = 'Demo12345!';
const PATIENT = { name: 'Demo Hasta', email: 'hasta@randevia.local', password: DEMO_PASSWORD };
const DOCTOR = {
  name: 'Dr. Demo Doktor',
  email: 'doktor@randevia.local',
  password: DEMO_PASSWORD,
  specialty: 'Kardiyoloji',
  bio: 'Tanıtım amaçlı örnek doktor profili.',
};

// Not documented as a login account anywhere - these only exist to make the
// doctors list look like a real, populated system instead of a single entry.
// 11 more alongside DOCTOR above: 12 doctors total across 12 specialties.
const EXTRA_DOCTORS = [
  { name: 'Dr. Elif Arslan', specialty: 'Dahiliye', bio: 'İç hastalıkları uzmanı.' },
  { name: 'Dr. Mert Kaya', specialty: 'Ortopedi ve Travmatoloji', bio: 'Ortopedi uzmanı.' },
  { name: 'Dr. Zeynep Çelik', specialty: 'Göz Hastalıkları', bio: 'Göz hastalıkları uzmanı.' },
  { name: 'Dr. Can Yıldız', specialty: 'Çocuk Sağlığı ve Hastalıkları', bio: 'Pediatri uzmanı.' },
  { name: 'Dr. Ayşe Demir', specialty: 'Nöroloji', bio: 'Nöroloji uzmanı.' },
  { name: 'Dr. Burak Şahin', specialty: 'Kulak Burun Boğaz', bio: 'KBB uzmanı.' },
  { name: 'Dr. Selin Aydın', specialty: 'Dermatoloji', bio: 'Cildiye uzmanı.' },
  { name: 'Dr. Emre Koç', specialty: 'Psikiyatri', bio: 'Psikiyatri uzmanı.' },
  { name: 'Dr. Deniz Yılmaz', specialty: 'Kadın Hastalıkları ve Doğum', bio: 'Kadın doğum uzmanı.' },
  { name: 'Dr. Onur Aksoy', specialty: 'Üroloji', bio: 'Üroloji uzmanı.' },
  { name: 'Dr. Gamze Öztürk', specialty: 'Genel Cerrahi', bio: 'Genel cerrahi uzmanı.' },
].map((doctor, index) => ({
  ...doctor,
  email: `demo-doktor-${index + 1}@randevia.local`,
  password: DEMO_PASSWORD,
}));

// Turkey has used a fixed UTC+03:00 offset (no DST) since 2016, so Istanbul
// wall-clock time is always UTC time plus 3 hours - matches the business
// hours rule enforced server-side (appointment-service/src/utils/businessHours.ts).
const TZ_OFFSET_HOURS = 3;
const BUSINESS_DAYS = 14;

function istanbulWeekdayOf(date) {
  return new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000).getUTCDay();
}

function atIstanbulTime(date, hour, minute) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const utcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    hour - TZ_OFFSET_HOURS,
    minute,
  );
  return new Date(utcMs);
}

// Every weekday in the next BUSINESS_DAYS days (today excluded), as plain
// Date objects (midnight UTC, only used to carry the calendar day forward).
function upcomingWeekdays() {
  const days = [];
  for (let i = 1; i <= BUSINESS_DAYS; i += 1) {
    const day = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    if (istanbulWeekdayOf(day) !== 0 && istanbulWeekdayOf(day) !== 6) days.push(day);
  }
  return days;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function registerOrLogin({ name, email, password }) {
  const reg = await call('POST', '/api/v1/auth/register', { body: { name, email, password } });
  if (reg.status === 201) return reg.json.data;

  const login = await call('POST', '/api/v1/auth/login', { body: { email, password } });
  if (login.status !== 200) {
    throw new Error(`Could not register or log in ${email}: ${JSON.stringify(login.json)}`);
  }
  return login.json.data;
}

// Adds a full working day's worth of availability (09:00-12:00 and
// 13:00-17:00 Istanbul, split around the lunch break - a single 09:00-17:00
// window would be rejected, see businessHours.ts) for every upcoming
// weekday, and books a couple of slots so the calendar shows a realistic
// mix of free/booked instead of being wide open.
async function addWeekdayAvailability(token, doctorId, patientToken) {
  const weekdays = upcomingWeekdays();
  for (const day of weekdays) {
    const morningStart = atIstanbulTime(day, 9, 0);
    const morningEnd = atIstanbulTime(day, 12, 0);
    const afternoonStart = atIstanbulTime(day, 13, 0);
    const afternoonEnd = atIstanbulTime(day, 17, 0);
    const morning = await call('POST', '/api/v1/doctors/me/availability', {
      token,
      body: { startTime: morningStart.toISOString(), endTime: morningEnd.toISOString() },
    });
    const afternoon = await call('POST', '/api/v1/doctors/me/availability', {
      token,
      body: { startTime: afternoonStart.toISOString(), endTime: afternoonEnd.toISOString() },
    });
    if (morning.status !== 201 || afternoon.status !== 201) {
      console.warn(
        `  uyarı: ${day.toISOString().slice(0, 10)} için müsaitlik eklenemedi (muhtemelen rate limit) - bkz. script başındaki not`,
      );
    }
  }

  // A handful of realistic pre-existing bookings: the 2nd upcoming weekday
  // at 10:00 (left pending) and the 4th at 14:30 (confirmed by the doctor),
  // so a patient browsing the calendar sees some slots already taken.
  const toBook = [
    { day: weekdays[1], hour: 10, minute: 0, confirm: false },
    { day: weekdays[3], hour: 14, minute: 30, confirm: true },
  ].filter((entry) => entry.day);

  for (const entry of toBook) {
    const date = atIstanbulTime(entry.day, entry.hour, entry.minute).toISOString();
    const booked = await call('POST', '/api/v1/appointments', {
      token: patientToken,
      body: { doctorId, date },
    });
    if (booked.status === 201 && entry.confirm) {
      await call('PATCH', `/api/v1/appointments/${booked.json.data.appointment._id}/confirm`, { token });
    }
  }
}

async function setupDoctor(doctorInput, adminToken, patientToken) {
  const auth = await registerOrLogin(doctorInput);
  let token = auth.accessToken;

  if (auth.user.role !== 'doctor') {
    const promote = await call('PATCH', `/api/v1/auth/users/${auth.user._id}/role`, {
      token: adminToken,
      body: { role: 'doctor' },
    });
    if (promote.status !== 200) {
      throw new Error(`Could not promote ${doctorInput.email}: ${JSON.stringify(promote.json)}`);
    }
    // The role takes effect on the next token, so log in again. Each auth
    // call also counts against the gateway's credential rate limit, so this
    // only happens the first time a doctor is promoted, not on every run.
    const login = await call('POST', '/api/v1/auth/login', {
      body: { email: doctorInput.email, password: doctorInput.password },
    });
    token = login.json.data.accessToken;
  }

  const profile = await call('POST', '/api/v1/doctors/me', {
    token,
    body: { name: doctorInput.name, specialty: doctorInput.specialty, bio: doctorInput.bio },
  });
  const doctorId = profile.json.data.doctor._id;

  const detail = await call('GET', `/api/v1/doctors/${doctorId}`, { token });
  if (detail.json.data.availability.length === 0) {
    await addWeekdayAvailability(token, doctorId, patientToken);
  }

  return doctorId;
}

async function main() {
  console.log(`Gateway: ${GATEWAY}`);

  await registerOrLogin(PATIENT);
  console.log(`Demo hasta hazır: ${PATIENT.email} / ${PATIENT.password}`);
  const patientLogin = await call('POST', '/api/v1/auth/login', {
    body: { email: PATIENT.email, password: PATIENT.password },
  });
  const patientToken = patientLogin.json.data.accessToken;

  const adminLogin = await call('POST', '/api/v1/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.json)}`);
  }
  const adminToken = adminLogin.json.data.accessToken;

  const doctorId = await setupDoctor(DOCTOR, adminToken, patientToken);
  console.log(`Demo doktor hazır: ${DOCTOR.email} / ${DOCTOR.password} (doktor profili: ${doctorId})`);

  for (const extra of EXTRA_DOCTORS) {
    await setupDoctor(extra, adminToken, patientToken);
  }
  console.log(`${EXTRA_DOCTORS.length} ek doktor profili (farklı uzmanlıklarla) hazırlandı.`);

  console.log('\nHazır. Web arayüzünden bu hesaplarla giriş yapabilirsiniz.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
