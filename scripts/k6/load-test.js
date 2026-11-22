// Load-tests the read-heavy path a logged-in user actually exercises:
// health check, doctor list, own profile, own notifications. All through
// the gateway, like a real client.
//
// Logs in exactly once, in setup() (a single VU/iteration, run before the
// load starts), and shares that one access token across every VU for the
// whole run - logging in per-iteration would hit the gateway's credential
// rate limit (AUTH_RATE_LIMIT_MAX) almost instantly and the run would
// measure 429s instead of the service's real capacity.
//
// The *other* rate limiter (RATE_LIMIT_MAX, applied to every request) will
// do the same thing at any serious VU count, so this is meant to be run
// with it raised well above its production default - see the README's
// "k6 Yük Testi" section for the exact command.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },
        { duration: '30s', target: 10 },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PATIENT_EMAIL = __ENV.DEMO_PATIENT_EMAIL || 'hasta@randevia.local';
const PATIENT_PASSWORD = __ENV.DEMO_PATIENT_PASSWORD || 'Demo12345!';

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: PATIENT_EMAIL, password: PATIENT_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    throw new Error(`setup login failed: ${res.status} ${res.body}`);
  }
  return { token: res.json('data.accessToken') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  check(http.get(`${BASE_URL}/api/v1/health`), {
    'health is 200': (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}/api/v1/doctors`, { headers }), {
    'doctors is 200': (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}/api/v1/auth/me`, { headers }), {
    'me is 200': (r) => r.status === 200,
  });
  check(http.get(`${BASE_URL}/api/v1/notifications/me`, { headers }), {
    'notifications is 200': (r) => r.status === 200,
  });

  sleep(1);
}
