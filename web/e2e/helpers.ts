// Seeds test data straight against the gateway's REST API. The point of this
// suite is to prove the UI works, not to re-test registration or role
// assignment forms (those already have their own coverage), so setup goes
// through the API and only the flow under test goes through the UI.

import type { Page } from '@playwright/test';
import { resetRateLimitedServices } from './resetRateLimits';

const GATEWAY_URL = 'http://localhost:3000';

// Logging in through the real UI also goes through the gateway's credential
// rate limit (see resetRateLimits.ts); if several spec files in one run
// finally tip it over, reset once and retry rather than failing the test.
// Assumes the login form (e-posta/şifre) is already filled in.
export async function submitLoginForm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Giriş Yap' }).click();

  const rateLimited = page.getByText('Çok fazla istek gönderdiniz');
  const result = await Promise.race([
    page.waitForURL('**/doktorlar').then(() => 'ok' as const),
    rateLimited.waitFor({ timeout: 5000 }).then(() => 'rate-limited' as const),
  ]).catch(() => 'timeout' as const);

  if (result === 'ok') return;

  resetRateLimitedServices();
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  await page.waitForURL('**/doktorlar');
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(password);
  await submitLoginForm(page);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function requestJson(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  token?: string,
): Promise<any> {
  const send = () =>
    fetch(`${GATEWAY_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });

  let res = await send();
  if (res.status === 429) {
    resetRateLimitedServices();
    res = await send();
  }
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

const postJson = (path: string, body: unknown, token?: string) =>
  requestJson('POST', path, body, token);
const patchJson = (path: string, body: unknown, token: string) =>
  requestJson('PATCH', path, body, token);

export interface SeededDoctor {
  email: string;
  password: string;
  doctorId: string;
  name: string;
  specialty: string;
  availabilityStart: Date;
}

export interface SeededPatient {
  email: string;
  password: string;
}

const PASSWORD = 'gizli-parola-123';

export async function seedPatient(): Promise<SeededPatient> {
  const email = `e2e-patient-${randomSuffix()}@e2e.test`;
  await postJson('/api/v1/auth/register', { name: 'E2E Hasta', email, password: PASSWORD });
  return { email, password: PASSWORD };
}

// Shared across every seedDoctorWithAvailability call in this worker process
// (playwright.config.ts pins workers to 1, so all spec files share it): the
// gateway's credential endpoints are rate-limited, and logging in as admin
// once per seeded doctor burns through that budget fast across several spec
// files in one run.
let cachedAdminToken: string | undefined;

async function getAdminToken(): Promise<string> {
  if (cachedAdminToken) return cachedAdminToken;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD env var is required to run the e2e suite (see e2e/README.md)');
  }
  const adminLogin = await postJson('/api/v1/auth/login', {
    email: process.env.ADMIN_EMAIL ?? 'admin@randevia.local',
    password: adminPassword,
  });
  cachedAdminToken = adminLogin.data.accessToken as string;
  return cachedAdminToken;
}

export async function seedDoctorWithAvailability(
  overrides: { name?: string; specialty?: string } = {},
): Promise<SeededDoctor> {
  const name = overrides.name ?? 'E2E Doktor';
  const email = `e2e-doctor-${randomSuffix()}@e2e.test`;
  const regRes = await postJson('/api/v1/auth/register', {
    name,
    email,
    password: PASSWORD,
  });
  const userId = regRes.data.user._id as string;

  const adminToken = await getAdminToken();
  await patchJson(`/api/v1/auth/users/${userId}/role`, { role: 'doctor' }, adminToken);

  const doctorLogin = await postJson('/api/v1/auth/login', { email, password: PASSWORD });
  const doctorToken = doctorLogin.data.accessToken as string;

  const specialty = overrides.specialty ?? `E2E Kardiyoloji ${randomSuffix()}`;
  const profileRes = await postJson('/api/v1/doctors/me', { name, specialty }, doctorToken);
  const doctorId = profileRes.data.doctor._id as string;

  const availabilityStart = new Date(Date.now() + 60 * 60 * 1000);
  const availabilityEnd = new Date(availabilityStart.getTime() + 2 * 60 * 60 * 1000);
  await postJson(
    '/api/v1/doctors/me/availability',
    { startTime: availabilityStart.toISOString(), endTime: availabilityEnd.toISOString() },
    doctorToken,
  );

  return { email, password: PASSWORD, doctorId, name, specialty, availabilityStart };
}
