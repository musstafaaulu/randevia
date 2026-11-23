// Seeds test data straight against the gateway's REST API. The point of this
// suite is to prove the UI works, not to re-test registration or role
// assignment forms (those already have their own coverage), so setup goes
// through the API and only the flow under test goes through the UI.

import type { Page } from '@playwright/test';
import { resetRateLimitedServices } from './resetRateLimits';

const GATEWAY_URL = 'http://localhost:3000';
const MAILHOG_URL = 'http://localhost:8025';

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

// Proof that the real send-through-MailHog pipeline (auth-service -> SMTP ->
// MailHog) delivered a mail, not a mock: pollMailIdsTo snapshots which mails
// already exist for an address before triggering some action, then
// waitForNewMailLink polls MailHog's own JSON API (http://localhost:8025)
// until a mail not in that snapshot shows up, and pulls the link out of its
// HTML body. Comparing ids (not just "the newest one") sidesteps ever having
// to assume what order MailHog's search returns results in.
export async function mailIdsTo(to: string): Promise<Set<string>> {
  const res = await fetch(`${MAILHOG_URL}/api/v2/search?kind=to&query=${encodeURIComponent(to)}`);
  const data = (await res.json()) as { items: { ID: string }[] };
  return new Set(data.items.map((item) => item.ID));
}

// nodemailer sends these HTML bodies as quoted-printable: every literal "="
// becomes "=3D" (and non-ASCII characters become their own "=XX" escapes),
// so a plain substring match for `href="` never finds anything - it has to
// be decoded first.
function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    const hex = withoutSoftBreaks.slice(i + 1, i + 3);
    if (withoutSoftBreaks[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(withoutSoftBreaks.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

// `linkContains` matters because a freshly registered patient also gets a
// verification e-mail (see auth.service.ts): without it, a slow reset mail
// could lose the race and this would return the wrong link.
export async function waitForNewMailLink(
  to: string,
  before: Set<string>,
  { linkContains, timeoutMs = 10_000 }: { linkContains?: string; timeoutMs?: number } = {},
): Promise<string> {
  const seen = new Set(before);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await fetch(`${MAILHOG_URL}/api/v2/search?kind=to&query=${encodeURIComponent(to)}`);
    const data = (await res.json()) as { items: { ID: string; Content: { Body: string } }[] };
    for (const item of data.items) {
      if (seen.has(item.ID)) continue;
      seen.add(item.ID);
      const link = /href="([^"]+)"/.exec(decodeQuotedPrintable(item.Content.Body))?.[1];
      if (link && (!linkContains || link.includes(linkContains))) return link;
    }
    if (Date.now() > deadline) throw new Error(`No matching new mail arrived for ${to}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
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

  // appointment-service only accepts availability windows on a weekday,
  // inside 09:00-17:00, outside the 12:00-13:00 lunch break (see
  // appointment-service/src/utils/businessHours.ts) - "now + 1h" could land
  // anywhere, so pick the next weekday morning instead.
  const { startTime: availabilityStartIso, endTime: availabilityEndIso } = nextWeekdayMorning();
  const availabilityStart = new Date(availabilityStartIso);
  await postJson(
    '/api/v1/doctors/me/availability',
    { startTime: availabilityStartIso, endTime: availabilityEndIso },
    doctorToken,
  );

  return { email, password: PASSWORD, doctorId, name, specialty, availabilityStart };
}

// Tomorrow if it's a weekday, otherwise the next Monday; 09:00-11:00 local
// time, well inside business hours and on the calendar's first page (the
// grid pages by 7-day blocks from today).
function nextWeekdayMorning(): { startTime: string; endTime: string } {
  let day = new Date();
  day.setHours(0, 0, 0, 0);
  do {
    day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  } while (day.getDay() === 0 || day.getDay() === 6);

  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  const end = new Date(day);
  end.setHours(11, 0, 0, 0);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}
