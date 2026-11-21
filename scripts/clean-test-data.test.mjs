// Guards the safety boundary in clean-test-data.mjs: it must delete only
// @e2e.test accounts and must never touch a normal-looking email (a real
// person registering with, say, a gmail.com address). Run with the stack up:
//
//   docker compose up -d
//   node --test scripts/clean-test-data.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { cleanTestData } from './clean-test-data.mjs';

function mongosh(container, database, script) {
  const result = spawnSync('docker', ['exec', container, 'mongosh', database, '--quiet', '--eval', script], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

test('only removes @e2e.test accounts, never a real-looking email', async () => {
  const suffix = Date.now().toString(36);
  const realEmail = `clean-test-fixture-${suffix}@gmail.com`;
  const testEmail = `clean-test-fixture-${suffix}@e2e.test`;

  mongosh(
    'randevia-mongo-auth',
    'randevia_auth',
    `db.users.insertMany([
      { name: 'Real Person', email: '${realEmail}', password: 'x', role: 'patient', createdAt: new Date(), updatedAt: new Date() },
      { name: 'E2E Ghost', email: '${testEmail}', password: 'x', role: 'patient', createdAt: new Date(), updatedAt: new Date() },
    ]);`,
  );

  try {
    await cleanTestData();

    const remaining = JSON.parse(
      mongosh(
        'randevia-mongo-auth',
        'randevia_auth',
        `print(JSON.stringify(db.users.find({ email: { $in: ['${realEmail}', '${testEmail}'] } }, { email: 1 }).toArray().map((u) => u.email)))`,
      ),
    );

    assert.ok(remaining.includes(realEmail), 'a real-looking email must survive cleanup');
    assert.ok(!remaining.includes(testEmail), 'an @e2e.test email must be removed');
  } finally {
    mongosh('randevia-mongo-auth', 'randevia_auth', `db.users.deleteOne({ email: '${realEmail}' });`);
  }
});
