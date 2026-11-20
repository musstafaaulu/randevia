#!/usr/bin/env node
// End-to-end smoke test of the running system, through the api-gateway only.
//
//   docker compose up -d --build
//   node scripts/e2e.mjs
//
// Env: GATEWAY_URL (default http://localhost:3000), ADMIN_EMAIL, ADMIN_PASSWORD
// (defaults match docker-compose.yml), RABBITMQ_API (management API, optional).
// Each run uses fresh e-mail addresses, so it can be repeated; note that the
// gateway allows AUTH_RATE_LIMIT_MAX credential calls per 15 minutes and IP,
// and one run makes 6 of them.

const GATEWAY = process.env.GATEWAY_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@randevia.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin-password-123';
const RABBITMQ_API = process.env.RABBITMQ_API ?? 'http://localhost:15672/api';

const runId = Date.now().toString(36);
let passed = 0;

function check(condition, description, details) {
  if (!condition) {
    console.error(`  FAIL  ${description}`);
    if (details !== undefined) console.error(JSON.stringify(details, null, 2));
    process.exit(1);
  }
  passed += 1;
  console.log(`  ok    ${description}`);
}

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, headers: res.headers, body: json };
}

async function waitFor(fn, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result) return result;
    if (Date.now() > deadline) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ------------------------------------------------------------------------
section('Gateway');
{
  const res = await call('GET', '/api/v1/health/services');
  check(res.status === 200 && res.body.status === 'ok', 'all services are up', res.body);

  const traced = await call('GET', '/api/v1/health', { headers: { 'X-Request-Id': `e2e-${runId}` } });
  check(traced.headers.get('x-request-id') === `e2e-${runId}`, 'echoes the caller X-Request-Id');
  check(traced.headers.get('x-content-type-options') === 'nosniff', 'sets helmet headers');
  check(traced.headers.get('ratelimit-policy') === null, 'health checks are not rate-limited');

  const generated = await call('GET', '/api/v1/doctors');
  check(/^[0-9a-f-]{36}$/.test(generated.headers.get('x-request-id') ?? ''), 'generates a request id');
  check(generated.status === 401, 'protected routes require a token', generated.body);
  check(generated.headers.get('ratelimit-policy') !== null, 'API routes are rate-limited');

  const missing = await call('GET', '/api/v1/unknown');
  check(missing.status === 404 && missing.body.success === false, 'unknown routes answer 404 JSON');
}

// ------------------------------------------------------------------------
section('auth-service: registration and roles');
const patientEmail = `patient-${runId}@e2e.test`;
const doctorEmail = `doctor-${runId}@e2e.test`;
const password = 'e2e-password-123';

const patient = await call('POST', '/api/v1/auth/register', {
  body: { name: 'E2E Patient', email: patientEmail, password },
});
check(patient.status === 201 && patient.body.data.user.role === 'patient', 'registers a patient', patient.body);
check((patient.headers.get('set-cookie') ?? '').includes('refreshToken='), 'sets the refresh cookie');
const patientToken = patient.body.data.accessToken;
const patientId = patient.body.data.user._id;

const selfDoctor = await call('POST', '/api/v1/auth/register', {
  body: { name: 'E2E Doctor', email: doctorEmail, password, role: 'doctor' },
});
check(selfDoctor.status === 400, 'rejects self-registration as a doctor', selfDoctor.body);

const doctorAsPatient = await call('POST', '/api/v1/auth/register', {
  body: { name: 'E2E Doctor', email: doctorEmail, password },
});
check(doctorAsPatient.status === 201, 'the future doctor registers as a patient first');
const doctorUserId = doctorAsPatient.body.data.user._id;

const admin = await call('POST', '/api/v1/auth/login', {
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
check(admin.status === 200 && admin.body.data.user.role === 'admin', 'bootstrap admin logs in', admin.body);
const adminToken = admin.body.data.accessToken;

const forbidden = await call('PATCH', `/api/v1/auth/users/${doctorUserId}/role`, {
  token: patientToken,
  body: { role: 'doctor' },
});
check(forbidden.status === 403, 'a patient cannot assign roles');

const promoted = await call('PATCH', `/api/v1/auth/users/${doctorUserId}/role`, {
  token: adminToken,
  body: { role: 'doctor' },
});
check(promoted.status === 200 && promoted.body.data.user.role === 'doctor', 'admin assigns the doctor role', promoted.body);

const doctorList = await call('GET', '/api/v1/auth/users?role=doctor&limit=100', { token: adminToken });
check(
  doctorList.status === 200 && doctorList.body.data.users.some((u) => u._id === doctorUserId),
  'admin lists doctors (query validation through Express 5)',
  doctorList.body,
);

const doctorLogin = await call('POST', '/api/v1/auth/login', { body: { email: doctorEmail, password } });
check(doctorLogin.body.data?.user.role === 'doctor', 'the doctor logs in with the new role', doctorLogin.body);
const doctorToken = doctorLogin.body.data.accessToken;

// ------------------------------------------------------------------------
section('appointment-service: doctors and appointments');
const profile = await call('POST', '/api/v1/doctors/me', {
  token: doctorToken,
  body: { specialty: 'Cardiology', bio: 'E2E test doctor' },
});
check(profile.status === 200, 'doctor creates a profile', profile.body);
const doctorId = profile.body.data.doctor._id;

const day = 24 * 60 * 60 * 1000;
const start = new Date(Date.now() + 7 * day);
start.setUTCMinutes(0, 0, 0);
const availability = await call('POST', '/api/v1/doctors/me/availability', {
  token: doctorToken,
  body: { startTime: start.toISOString(), endTime: new Date(start.getTime() + 4 * 3600_000).toISOString() },
});
check(availability.status === 201, 'doctor adds availability', availability.body);

const patientProfile = await call('POST', '/api/v1/doctors/me', {
  token: patientToken,
  body: { specialty: 'Fake' },
});
check(patientProfile.status === 403, 'a patient cannot create a doctor profile');

const doctors = await call('GET', '/api/v1/doctors', { token: patientToken });
check(doctors.status === 200 && doctors.body.data.doctors.some((d) => d._id === doctorId), 'patient lists doctors');

const booked = await call('POST', '/api/v1/appointments', {
  token: patientToken,
  body: { doctorId, date: start.toISOString() },
});
check(booked.status === 201 && booked.body.data.appointment.status === 'pending', 'patient books an appointment', booked.body);
const appointmentId = booked.body.data.appointment._id;

const doubleBooked = await call('POST', '/api/v1/appointments', {
  token: patientToken,
  body: { doctorId, date: start.toISOString() },
});
check(doubleBooked.status === 409, 'the same slot cannot be booked twice');

const confirmed = await call('PATCH', `/api/v1/appointments/${appointmentId}/confirm`, { token: doctorToken });
check(confirmed.status === 200 && confirmed.body.data.appointment.status === 'confirmed', 'doctor confirms it', confirmed.body);

const second = await call('POST', '/api/v1/appointments', {
  token: patientToken,
  body: { doctorId, date: new Date(start.getTime() + 3600_000).toISOString() },
});
const cancelled = await call('PATCH', `/api/v1/appointments/${second.body.data.appointment._id}/cancel`, {
  token: patientToken,
});
check(cancelled.status === 200 && cancelled.body.data.appointment.status === 'cancelled', 'patient cancels a second one', cancelled.body);

const mine = await call('GET', '/api/v1/appointments/me', { token: doctorToken });
check(mine.status === 200 && mine.body.data.appointments.length === 2, "doctor sees both appointments", mine.body);

// ------------------------------------------------------------------------
section('notification-service: events over RabbitMQ');
async function notificationsOf(token, expected) {
  return waitFor(async () => {
    const res = await call('GET', '/api/v1/notifications/me?limit=50', { token });
    const items = res.body.data?.notifications ?? [];
    return items.length >= expected && items;
  });
}

// created x2, confirmed x1, cancelled x1 -> one notification each for both sides.
const patientNotes = await notificationsOf(patientToken, 4);
check(patientNotes?.length === 4, 'patient received 4 notifications', patientNotes);
check(
  patientNotes.every((n) => n.recipientId === patientId && n.status === 'sent'),
  'they belong to the patient and were sent',
);
check(
  ['appointment.cancelled', 'appointment.confirmed', 'appointment.created', 'appointment.created'].join() ===
    patientNotes.map((n) => n.type).sort().join(),
  'one per event: created, created, confirmed, cancelled',
  patientNotes.map((n) => n.type),
);

const doctorNotes = await notificationsOf(doctorToken, 4);
check(doctorNotes?.length === 4 && doctorNotes.every((n) => n.recipientId === doctorUserId), 'doctor received 4 notifications', doctorNotes);

const paged = await call('GET', '/api/v1/notifications/me?page=2&limit=3', { token: patientToken });
check(
  paged.status === 200 && paged.body.data.notifications.length === 1 && paged.body.data.pagination.total === 4,
  'notifications are paginated',
  paged.body,
);

// ------------------------------------------------------------------------
section('RabbitMQ topology');
try {
  const res = await fetch(`${RABBITMQ_API}/queues/%2F`, {
    headers: { Authorization: `Basic ${Buffer.from('guest:guest').toString('base64')}` },
  });
  const queues = (await res.json()).map((q) => q.name);
  for (const name of [
    'notification-service.appointment-events',
    'notification-service.appointment-events.retry',
    'notification-service.appointment-events.dlq',
  ]) {
    check(queues.includes(name), `queue ${name} exists`);
  }
} catch (err) {
  console.log(`  skip  management API not reachable (${err.message})`);
}

console.log(`\nAll ${passed} checks passed.`);
