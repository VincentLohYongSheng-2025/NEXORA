// Real PostgreSQL checks in an isolated, disposable PGlite database.
// Setup and run commands are documented in docs/schema-verification.md.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { PGlite } from '../../.tools/schema-check/node_modules/@electric-sql/pglite/dist/index.js';

const migration = await readFile(new URL('../sql/001_demo_schema.sql', import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  -- Model legacy Supabase grants to ensure the migration removes them.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
`);
await db.exec(migration);
after(async () => { await db.close(); });

const tables = ['assets', 'meters', 'energy_readings', 'alerts', 'scenarios'];
const assetId = '00000000-0000-4000-8000-000000000001';
const meterId = '00000000-0000-4000-8000-000000000002';
const alertId = '00000000-0000-4000-8000-000000000003';
const absentId = '00000000-0000-4000-8000-000000000099';
const assetInsert = `INSERT INTO public.assets(id,name,asset_type,floor_area_m2)
  VALUES ('${assetId}', 'Synthetic test fixture', 'test_fixture', 100)`;
const readingInsert = `INSERT INTO public.energy_readings(meter_id,recorded_at,consumption_kwh)
  VALUES ('${meterId}', '2026-01-01T00:00:00Z', 0)`;
const alertInsert = `INSERT INTO public.alerts
  (id,meter_id,window_start,window_end,observed_kwh,baseline_kwh,rule_code,severity)
  VALUES ('${alertId}','${meterId}','2026-01-01T00:00:00Z','2026-01-01T01:00:00Z',2,1,'test_rule','test_severity')`;
const scenarioInsert = `INSERT INTO public.scenarios(asset_id,alert_id,action_code,assumptions_json,results_json)
  VALUES ('${assetId}','${alertId}','test_action','{}','{}')`;

async function rejectsSql(sql, code) {
  const codes = Array.isArray(code) ? code : [code];
  await assert.rejects(db.exec(sql), error => codes.includes(error.code));
}

test('all five tables have primary keys and RLS with no public policies', async () => {
  const { rows } = await db.query(`SELECT c.relname, c.relrowsecurity,
    EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conrelid=c.oid AND p.contype='p') AS has_pk
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`);
  assert.deepEqual(rows.map(row => row.relname), [...tables].sort());
  assert.ok(rows.every(row => row.relrowsecurity && row.has_pk));
  assert.equal((await db.query(`SELECT * FROM pg_policies WHERE schemaname='public'`)).rows.length, 0);
});

test('anon and authenticated have no table privileges, including destructive operations', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const table of tables) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
        const { rows } = await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',
          [role, `public.${table}`, privilege]);
        assert.equal(rows[0].allowed, false, `${role} ${table} ${privilege}`);
      }
    }
    await db.exec(`SET ROLE ${role}`);
    try {
      for (const table of tables) {
        await rejectsSql(`SELECT * FROM public.${table}`, '42501');
        await rejectsSql(`INSERT INTO public.${table} DEFAULT VALUES`, '42501');
        await rejectsSql(`UPDATE public.${table} SET ${table === 'energy_readings' ? 'consumption_kwh=0' : 'id=id'}`, '42501');
        await rejectsSql(`DELETE FROM public.${table}`, '42501');
        await rejectsSql(`TRUNCATE public.${table}`, '42501');
      }
    } finally { await db.exec('RESET ROLE'); }
  }
});

test('backend service role can write and read synthetic fixtures through RLS', async () => {
  await db.exec('SET ROLE service_role');
  try {
    await db.exec(assetInsert);
    await db.exec(`INSERT INTO public.meters(id,asset_id,meter_role)
      VALUES ('${meterId}','${assetId}','building_total')`);
    await db.exec(readingInsert);
    await db.exec(alertInsert);
    await db.exec(scenarioInsert);
    for (const table of tables) {
      assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n, 1);
    }
    await rejectsSql('TRUNCATE public.assets', '42501');
  } finally { await db.exec('RESET ROLE'); }
});

test('RLS itself denies reads and writes if table grants are accidentally restored', async () => {
  // Transaction-local grants only in the disposable test database; always roll back.
  for (const role of ['anon', 'authenticated']) {
    await db.exec('BEGIN');
    try {
      await db.exec(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}; SET LOCAL ROLE ${role}`);
      for (const table of tables) {
        assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0);
      }
      assert.equal((await db.query(`UPDATE public.assets SET name='Blocked' RETURNING id`)).rows.length, 0);
      assert.equal((await db.query(`DELETE FROM public.assets RETURNING id`)).rows.length, 0);
      await rejectsSql(assetInsert.replace(assetId, absentId), '42501');
    } finally { await db.exec('ROLLBACK'); }
  }
});

test('foreign keys preserve parent records and reject missing relationships', async () => {
  await rejectsSql(`INSERT INTO public.meters(asset_id,meter_role) VALUES ('${absentId}','building_total')`, '23503');
  await rejectsSql(readingInsert.replace(meterId, absentId), '23503');
  await rejectsSql(alertInsert.replaceAll(alertId, absentId).replaceAll(meterId, absentId), '23503');
  await rejectsSql(scenarioInsert.replace(assetId, absentId), '23503');
  await rejectsSql(scenarioInsert.replace(alertId, absentId), '23503');
  // PostgreSQL versions distinguish restrict_violation from foreign_key_violation.
  await rejectsSql(`DELETE FROM public.assets WHERE id='${assetId}'`, ['23001', '23503']);
  await rejectsSql(`DELETE FROM public.meters WHERE id='${meterId}'`, ['23001', '23503']);
  await rejectsSql(`DELETE FROM public.alerts WHERE id='${alertId}'`, ['23001', '23503']);
});

test('reading uniqueness covers equivalent UTC instants; alerts deduplicate by meter/window/rule', async () => {
  await rejectsSql(readingInsert, '23505');
  await rejectsSql(readingInsert.replace('2026-01-01T00:00:00Z', '2026-01-01T08:00:00+08:00'), '23505');
  await rejectsSql(alertInsert.replace(alertId, absentId), '23505');
  await rejectsSql(`INSERT INTO public.meters(asset_id,meter_role) VALUES ('${assetId}','building_total')`, '23505');
});

test('energy, interval, window, provenance and estimate constraints reject invalid values', async () => {
  for (const value of ['-1', "'NaN'"]) {
    await rejectsSql(`UPDATE public.energy_readings SET consumption_kwh=${value}`, '23514');
    await rejectsSql(`UPDATE public.alerts SET observed_kwh=${value}`, '23514');
    await rejectsSql(`UPDATE public.alerts SET baseline_kwh=${value}`, '23514');
  }
  await rejectsSql(`UPDATE public.energy_readings SET interval_minutes=15`, '23514');
  await rejectsSql(`UPDATE public.energy_readings SET recorded_at='infinity'`, '23514');
  await rejectsSql(`UPDATE public.energy_readings SET provenance='real'`, '23514');
  await rejectsSql(`UPDATE public.assets SET data_status='real'`, '23514');
  await rejectsSql(`UPDATE public.assets SET schematic_x=1`, '23514');
  await rejectsSql(`UPDATE public.meters SET meter_role='floor'`, '23514');
  await rejectsSql(`UPDATE public.alerts SET window_end=window_start`, '23514');
  await rejectsSql(`UPDATE public.alerts SET evidence_json='[]'`, '23514');
  await rejectsSql(`UPDATE public.scenarios SET result_status='verified'`, '23514');
  assert.equal((await db.query(`SELECT result_status FROM public.scenarios`)).rows[0].result_status, 'estimated');
});

test('reapplying migration fails without changing existing records or privileges', async () => {
  await rejectsSql(migration, '42P07');
  await db.exec('ROLLBACK');
  assert.equal((await db.query(`SELECT name FROM public.assets`)).rows[0].name, 'Synthetic test fixture');
  assert.equal((await db.query(`SELECT has_table_privilege('anon','public.assets','INSERT') AS allowed`)).rows[0].allowed, false);
});
