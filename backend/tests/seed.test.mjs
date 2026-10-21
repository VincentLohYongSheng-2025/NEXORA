// Generate the ignored offline bundle first; see docs/seed-verification.md.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '../../.tools/schema-check/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL('../sql/001_demo_schema.sql', import.meta.url), 'utf8');
const seed = await readFile(new URL('../../data/generated/seed-v1/seed.sql', import.meta.url), 'utf8');
const dataset = JSON.parse(await readFile(new URL('../../data/generated/seed-v1/dataset.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../../data/generated/seed-v1/manifest.json', import.meta.url), 'utf8'));

async function withDatabase(verify) {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE service_role NOLOGIN BYPASSRLS;`);
    await db.exec(migration);
    await verify(db);
  } finally { await db.close(); }
}

async function snapshot(db) {
  const result = {};
  for (const table of ['assets', 'meters', 'energy_readings', 'alerts', 'scenarios']) {
    const order = table === 'energy_readings' ? 'meter_id,recorded_at' : 'id';
    result[table] = (await db.query(`SELECT * FROM public.${table} ORDER BY ${order}`)).rows;
  }
  return result;
}

test('actual seed SQL applied twice preserves rows, counts, reconciliation and RLS', async () => {
  await withDatabase(async db => {
    await db.exec(seed);
    const first = await snapshot(db);
    await db.exec(seed);
    assert.deepEqual(await snapshot(db), first);
    for (const [table, count] of Object.entries(manifest.counts)) {
      assert.equal(first[table].length, count);
    }
    const focusId = dataset.assets[0].id;
    const mismatches = await db.query(`
      SELECT r.recorded_at FROM public.energy_readings r
      JOIN public.meters m ON m.id=r.meter_id
      WHERE m.asset_id=$1 AND m.meter_role='building_total'
        AND r.consumption_kwh <> (
          SELECT sum(f.consumption_kwh) FROM public.energy_readings f
          JOIN public.meters fm ON fm.id=f.meter_id
          WHERE fm.asset_id=$1 AND fm.meter_role='floor' AND f.recorded_at=r.recorded_at
        )`, [focusId]);
    assert.equal(mismatches.rows.length, 0);
    const observed = await db.query(`SELECT consumption_kwh::text AS kwh
      FROM public.energy_readings WHERE meter_id=$1 AND recorded_at=$2`,
      [manifest.anomaly.meter_id, manifest.anomaly.window_start]);
    assert.equal(Number(observed.rows[0].kwh), manifest.anomaly.observed_kwh);
    const security = await db.query(`SELECT c.relrowsecurity,
      has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS anon_access,
      has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS authenticated_access
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r'`);
    assert.equal(security.rows.length, 5);
    assert.ok(security.rows.every(row => row.relrowsecurity && !row.anon_access && !row.authenticated_access));
  });
});

test('conflicting existing reading aborts the whole seed without overwriting teammate work', async () => {
  await withDatabase(async db => {
    const asset = dataset.assets[0];
    const meter = dataset.meters.find(row => row.id === manifest.anomaly.meter_id);
    for (const [table, row] of [['assets', asset], ['meters', meter]]) {
      const columns = Object.keys(row);
      await db.query(`INSERT INTO public.${table} (${columns.join(',')})
        VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
    }
    await db.query(`INSERT INTO public.energy_readings(meter_id,recorded_at,consumption_kwh)
      VALUES ($1,$2,999)`, [meter.id, manifest.anomaly.window_start]);
    const original = await snapshot(db);
    await assert.rejects(db.exec(seed), error => error.code === 'P0001'
      && error.message.includes('Conflicting EnergiOS fixture rows in energy_readings'));
    await db.exec('ROLLBACK');
    assert.deepEqual(await snapshot(db), original);
  });
});
