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
const EXTRA_DOCTORS = [
  { name: 'Dr. Elif Arslan', specialty: 'Dahiliye', bio: 'İç hastalıkları uzmanı.' },
  { name: 'Dr. Mert Kaya', specialty: 'Ortopedi ve Travmatoloji', bio: 'Ortopedi uzmanı.' },
  { name: 'Dr. Zeynep Çelik', specialty: 'Göz Hastalıkları', bio: 'Göz hastalıkları uzmanı.' },
  { name: 'Dr. Can Yıldız', specialty: 'Çocuk Sağlığı ve Hastalıkları', bio: 'Pediatri uzmanı.' },
  { name: 'Dr. Ayşe Demir', specialty: 'Nöroloji', bio: 'Nöroloji uzmanı.' },
].map((doctor, index) => ({
  ...doctor,
  email: `demo-doktor-${index + 1}@randevia.local`,
  password: DEMO_PASSWORD,
}));

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

async function setupDoctor(doctorInput, adminToken) {
  const auth = await registerOrLogin(doctorInput);

  if (auth.user.role !== 'doctor') {
    const promote = await call('PATCH', `/api/v1/auth/users/${auth.user._id}/role`, {
      token: adminToken,
      body: { role: 'doctor' },
    });
    if (promote.status !== 200) {
      throw new Error(`Could not promote ${doctorInput.email}: ${JSON.stringify(promote.json)}`);
    }
    // The role takes effect on the next token, so log in again.
  }
  const login = await call('POST', '/api/v1/auth/login', {
    body: { email: doctorInput.email, password: doctorInput.password },
  });
  const token = login.json.data.accessToken;

  const profile = await call('POST', '/api/v1/doctors/me', {
    token,
    body: { name: doctorInput.name, specialty: doctorInput.specialty, bio: doctorInput.bio },
  });
  const doctorId = profile.json.data.doctor._id;

  const detail = await call('GET', `/api/v1/doctors/${doctorId}`, { token });
  if (detail.json.data.availability.length === 0) {
    for (let day = 1; day <= 3; day += 1) {
      const start = new Date();
      start.setDate(start.getDate() + day);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(17, 0, 0, 0);
      await call('POST', '/api/v1/doctors/me/availability', {
        token,
        body: { startTime: start.toISOString(), endTime: end.toISOString() },
      });
    }
  }

  return doctorId;
}

async function main() {
  console.log(`Gateway: ${GATEWAY}`);

  await registerOrLogin(PATIENT);
  console.log(`Demo hasta hazır: ${PATIENT.email} / ${PATIENT.password}`);

  const adminLogin = await call('POST', '/api/v1/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.json)}`);
  }
  const adminToken = adminLogin.json.data.accessToken;

  const doctorId = await setupDoctor(DOCTOR, adminToken);
  console.log(`Demo doktor hazır: ${DOCTOR.email} / ${DOCTOR.password} (doktor profili: ${doctorId})`);

  for (const extra of EXTRA_DOCTORS) {
    await setupDoctor(extra, adminToken);
  }
  console.log(`${EXTRA_DOCTORS.length} ek doktor profili (farklı uzmanlıklarla) hazırlandı.`);

  console.log('\nHazır. Web arayüzünden bu hesaplarla giriş yapabilirsiniz.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
