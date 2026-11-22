// Thin REST helpers against the real gateway, used to pre-arrange state
// (book + confirm an appointment) before a recording starts, so the
// recorded scene itself only shows the part that matters.
const GATEWAY = 'http://localhost:3000';

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

export async function login(email, password) {
  const res = await call('POST', '/api/v1/auth/login', { body: { email, password } });
  return res.data.accessToken;
}

export async function getDoctor(doctorId, token) {
  return (await call('GET', `/api/v1/doctors/${doctorId}`, { token })).data;
}

export async function bookAppointment(token, doctorId, date) {
  return (await call('POST', '/api/v1/appointments', { token, body: { doctorId, date } })).data
    .appointment;
}

export async function confirmAppointment(token, appointmentId) {
  return (await call('PATCH', `/api/v1/appointments/${appointmentId}/confirm`, { token })).data;
}

export async function cancelAppointment(token, appointmentId) {
  return call('PATCH', `/api/v1/appointments/${appointmentId}/cancel`, { token });
}

export async function listMyAppointments(token) {
  return (await call('GET', '/api/v1/appointments/me', { token })).data;
}
