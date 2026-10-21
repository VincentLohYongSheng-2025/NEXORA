import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createIsolatedDatabase, importBundle } from '../scripts/import_bdg2_pglite.mjs';

let db;
let first;
let replay;

before(async () => {
  db = await createIsolatedDatabase();
  first = await importBundle(db);
  replay = await importBundle(db);
});

after(async () => { await db.close(); });

test('bounded verified cohort imports with the expected reconciliation', () => {
  assert.deepEqual(first, {
    sources: 1,
    runs: 1,
    assets: 4,
    meters: 4,
    readings: 70152,
    missing: 8,
    dst_quarantined: 16,
    zero: 0,
    first_utc: '2016-01-01T06:00:00Z',
    last_utc: '2018-01-01T05:00:00Z',
    unit: 'kWh',
    provenance: 'public_benchmark',
  });
});

test('replaying the same bundle is idempotent', () => {
  assert.deepEqual(replay, first);
});

test('imported source metadata remains protected from public clients', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal((await db.query(`SELECT has_table_privilege($1,'public.data_sources','SELECT') AS allowed`,
      [role])).rows[0].allowed, false);
    assert.equal((await db.query(`SELECT has_table_privilege($1,'public.energy_readings','INSERT') AS allowed`,
      [role])).rows[0].allowed, false);
  }
});
