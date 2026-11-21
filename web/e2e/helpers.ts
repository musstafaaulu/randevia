// Seeds test data straight against the gateway's REST API. The point of this
// suite is to prove the real-time UI works, not to re-test registration or
// role assignment forms (those already have their own coverage), so setup
// goes through the API and only the booking flow itself goes through the UI.

const GATEWAY_URL = 'http://localhost:3000';

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function postJson(path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchJson(path: string, body: unknown, token: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface SeededDoctor {
  email: string;
  password: string;
  doctorId: string;
  specialty: string;
  availabilityStart: Date;
}

export interface SeededPatient {
  email: string;
  password: string;
}

const PASSWORD = 'gizli-parola-123';

export async function seedPatient(): Promise<SeededPatient> {
  const email = `e2e-patient-${randomSuffix()}@test.local`;
  await postJson('/api/v1/auth/register', { name: 'E2E Hasta', email, password: PASSWORD });
  return { email, password: PASSWORD };
}

export async function seedDoctorWithAvailability(): Promise<SeededDoctor> {
  const email = `e2e-doctor-${randomSuffix()}@test.local`;
  const regRes = await postJson('/api/v1/auth/register', {
    name: 'E2E Doktor',
    email,
    password: PASSWORD,
  });
  const userId = regRes.data.user._id as string;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD env var is required to run the e2e suite (see e2e/README.md)');
  }
  const adminLogin = await postJson('/api/v1/auth/login', {
    email: process.env.ADMIN_EMAIL ?? 'admin@randevia.local',
    password: adminPassword,
  });
  const adminToken = adminLogin.data.accessToken as string;

  await patchJson(`/api/v1/auth/users/${userId}/role`, { role: 'doctor' }, adminToken);

  const doctorLogin = await postJson('/api/v1/auth/login', { email, password: PASSWORD });
  const doctorToken = doctorLogin.data.accessToken as string;

  const specialty = `E2E Kardiyoloji ${randomSuffix()}`;
  const profileRes = await postJson(
    '/api/v1/doctors/me',
    { name: 'E2E Doktor', specialty },
    doctorToken,
  );
  const doctorId = profileRes.data.doctor._id as string;

  const availabilityStart = new Date(Date.now() + 60 * 60 * 1000);
  const availabilityEnd = new Date(availabilityStart.getTime() + 2 * 60 * 60 * 1000);
  await postJson(
    '/api/v1/doctors/me/availability',
    { startTime: availabilityStart.toISOString(), endTime: availabilityEnd.toISOString() },
    doctorToken,
  );

  return { email, password: PASSWORD, doctorId, specialty, availabilityStart };
}
