#!/usr/bin/env node
// Removes leftover test data from the running docker-compose stack.
//
// scripts/e2e.mjs and the Playwright suite both exercise the real gateway
// (there is no delete endpoint and no separate test stack for them to run
// against), so every run leaves behind a throwaway user/doctor/appointment.
// Every test script only ever registers @e2e.test addresses - never a real
// domain, never @randevia.local - so that one address is the entire cleanup
// boundary: an auth user on @e2e.test gets deleted, and everything in the
// other two databases that references such a user cascades with it. Every
// other account - admin, the demo accounts, the seed doctors, and any real
// person who registers with their own email - is left untouched.
//
//   docker compose up -d
//   node scripts/clean-test-data.mjs
//
// Requires the mongo-auth/mongo-appointment/mongo-notification containers
// to be running (they are not published on the host, so this shells out to
// `docker exec ... mongosh` instead of connecting directly).

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DELETE_EMAIL_SUFFIX = '@e2e.test';
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

function runMongosh(container, database, script) {
  const result = spawnSync('docker', ['exec', container, 'mongosh', database, '--quiet', '--eval', script], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`mongosh in ${container} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function queryJson(container, database, script) {
  const output = runMongosh(container, database, script);
  const lastLine = output.split('\n').filter(Boolean).pop() ?? '[]';
  return JSON.parse(lastLine);
}

function assertObjectIds(ids) {
  for (const id of ids) {
    if (!OBJECT_ID_RE.test(id)) throw new Error(`Refusing to use non-ObjectId value: ${id}`);
  }
  return ids;
}

function idList(ids) {
  return `[${assertObjectIds(ids)
    .map((id) => `ObjectId("${id}")`)
    .join(',')}]`;
}

export async function cleanTestData() {
  // --- auth: find every user, split into keep vs. delete by email suffix --
  const users = queryJson(
    'randevia-mongo-auth',
    'randevia_auth',
    'print(JSON.stringify(db.users.find({}, { email: 1 }).toArray().map((u) => ({ id: u._id.toString(), email: u.email }))))',
  );
  const deleteIds = users.filter((u) => u.email.toLowerCase().endsWith(DELETE_EMAIL_SUFFIX)).map((u) => u.id);
  const keepIds = users.filter((u) => !u.email.toLowerCase().endsWith(DELETE_EMAIL_SUFFIX)).map((u) => u.id);

  console.log(`auth: ${users.length} user(s) total, keeping ${keepIds.length}, deleting ${deleteIds.length}`);
  if (deleteIds.length > 0) {
    const res = runMongosh(
      'randevia-mongo-auth',
      'randevia_auth',
      `const r = db.users.deleteMany({ _id: { $in: ${idList(deleteIds)} } }); print(r.deletedCount);`,
    );
    console.log(`  deleted ${res} test user(s)`);
  }

  // --- appointment: doctors not owned by a kept user, plus anything that
  //     references a deleted patient/doctor --------------------------------
  const keep = idList(keepIds.length > 0 ? keepIds : ['000000000000000000000000']);
  const staleDoctorIds = queryJson(
    'randevia-mongo-appointment',
    'randevia_appointment',
    `print(JSON.stringify(db.doctors.find({ userId: { $nin: ${keep} } }, {}).toArray().map((d) => d._id.toString())))`,
  );
  console.log(`appointment: ${staleDoctorIds.length} stale doctor profile(s)`);

  if (staleDoctorIds.length > 0) {
    const staleDoctors = idList(staleDoctorIds);
    runMongosh(
      'randevia-mongo-appointment',
      'randevia_appointment',
      `print(db.availability.deleteMany({ doctorId: { $in: ${staleDoctors} } }).deletedCount);`,
    );
    runMongosh(
      'randevia-mongo-appointment',
      'randevia_appointment',
      `print(db.appointments.deleteMany({ doctorId: { $in: ${staleDoctors} } }).deletedCount);`,
    );
    runMongosh(
      'randevia-mongo-appointment',
      'randevia_appointment',
      `print(db.doctors.deleteMany({ _id: { $in: ${staleDoctors} } }).deletedCount);`,
    );
  }
  // Appointments booked by a deleted test patient against a *kept* doctor.
  const strayAppointments = runMongosh(
    'randevia-mongo-appointment',
    'randevia_appointment',
    `print(db.appointments.deleteMany({ patientId: { $nin: ${keep} } }).deletedCount);`,
  );
  console.log(`  deleted ${strayAppointments} stray appointment(s) from deleted patients`);

  // --- notification: anything addressed to a deleted user -----------------
  const deletedNotifications = runMongosh(
    'randevia-mongo-notification',
    'randevia_notification',
    `print(db.notifications.deleteMany({ recipientId: { $nin: ${keep} } }).deletedCount);`,
  );
  console.log(`notification: deleted ${deletedNotifications} stray notification(s)`);

  console.log('\nDone. Only @e2e.test accounts were removed; every other account is untouched.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  cleanTestData().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
