import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '../../.tools/schema-check/node_modules/@electric-sql/pglite/dist/index.js';

const baseline = await readFile(new URL('../sql/001_demo_schema.sql', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../supabase/migrations/20261013101159_add_bdg2_provenance_schema.sql', import.meta.url),
  'utf8',
);
const originalTables = ['alerts', 'assets', 'energy_readings', 'meters', 'scenarios'];
const replacedChecks = new Set([
  'assets_data_status_check',
  'meters_source_kind_check',
  'energy_readings_provenance_check',
]);

async function createDatabase() {
  const database = new PGlite();
  await database.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `);
  await database.exec(baseline);
  return database;
}

async function rows(database, sql, params = []) {
  return (await database.query(sql, params)).rows;
}

async function snapshot(database) {
  return {
    constraints: await rows(database, `
      SELECT c.relname AS table_name, p.conname, pg_get_constraintdef(p.oid) AS definition
        FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=ANY($1)
       ORDER BY c.relname,p.conname`, [originalTables]),
    indexes: await rows(database, `SELECT tablename,indexname,indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename=ANY($1) ORDER BY tablename,indexname`, [originalTables]),
    grants: await rows(database, `SELECT grantee,table_name,privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name=ANY($1)
      ORDER BY grantee,table_name,privilege_type`, [originalTables]),
    policies: await rows(database, `SELECT tablename,policyname,cmd,roles,qual,with_check
      FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`),
    rls: await rows(database, `SELECT c.relname,c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($1)
      ORDER BY c.relname`, [originalTables]),
  };
}

let db;
let beforeState;

before(async () => {
  db = await createDatabase();
  await db.exec(`INSERT INTO public.assets(id,name,asset_type,floor_area_m2)
    VALUES ('00000000-0000-4000-8000-000000000001','Preservation fixture','schema_test',100)`);
  beforeState = await snapshot(db);
  await db.exec(migration);
});

after(async () => { await db.close(); });

test('minimal migration preserves existing data and original catalogue objects', async () => {
  assert.deepEqual(await rows(db, `SELECT name,data_status,data_source_id FROM public.assets`),
    [{ name: 'Preservation fixture', data_status: 'synthetic_demo', data_source_id: null }]);
  const afterState = await snapshot(db);
  const originalConstraintNames = new Set(beforeState.constraints
    .filter(row => !replacedChecks.has(row.conname)).map(row => row.conname));
  assert.deepEqual(afterState.constraints.filter(row => originalConstraintNames.has(row.conname)),
    beforeState.constraints.filter(row => originalConstraintNames.has(row.conname)));
  const originalIndexNames = new Set(beforeState.indexes.map(row => row.indexname));
  assert.deepEqual(afterState.indexes.filter(row => originalIndexNames.has(row.indexname)), beforeState.indexes);
  assert.deepEqual(afterState.grants, beforeState.grants);
  assert.deepEqual(afterState.policies, beforeState.policies);
  assert.deepEqual(afterState.rls, beforeState.rls);
});

test('all seven tables have RLS and public clients have no privileges or policies', async () => {
  const catalogue = await rows(db, `SELECT c.relname,c.relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`);
  assert.deepEqual(catalogue.map(row => row.relname),
    ['alerts','assets','data_import_runs','data_sources','energy_readings','meters','scenarios']);
  assert.ok(catalogue.every(row => row.relrowsecurity));
  assert.equal((await rows(db, `SELECT count(*)::int AS n FROM pg_policies
    WHERE schemaname='public'`))[0].n, 0);
  assert.equal((await rows(db, `SELECT count(*)::int AS n FROM information_schema.table_privileges
    WHERE table_schema='public' AND grantee IN ('PUBLIC','anon','authenticated')`))[0].n, 0);
});

test('source identifiers are unique and public benchmark rows require essential metadata', async () => {
  await db.exec(`
    INSERT INTO public.data_sources
      (id,source_code,title,version,doi,licence_spdx,attribution_label,repository_url,
       pinned_commit,metadata_sha256,electricity_sha256,limitations_json)
    VALUES
      ('00000000-0000-4000-8000-000000000010','bdg2_v1','BDG2','v1.0','10.5281/zenodo.3887306',
       'CC-BY-4.0','Public benchmark data — Building Data Genome Project 2 v1.0',
       'https://github.com/buds-lab/building-data-genome-project-2',
       '3d0cbaf7ba281029ce04887503ab56f3c8344575',
       '992d0b29f24f96ad4332bc4dbb534b7bdd7dd2689aad093f94e93068ecddca02',
       'b01056f4ceec1992ce019297e674d6d6ecd0240e50a2aaeb6f958c65efdc282d','{}');
    INSERT INTO public.data_import_runs
      (id,data_source_id,cohort_code,status,manifest_json,completed_at)
    VALUES
      ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000010',
       'hog_four_buildings_v1','completed','{}',now());
  `);
  await assert.rejects(db.exec(`INSERT INTO public.assets
    (name,asset_type,floor_area_m2,data_status) VALUES ('Invalid','Office',100,'public_benchmark')`),
    error => error.code === '23514');
  await assert.rejects(db.exec(`INSERT INTO public.data_sources
    (source_code,title,version,doi,licence_spdx,attribution_label,repository_url,pinned_commit,
     metadata_sha256,electricity_sha256,limitations_json)
    SELECT source_code,title,version,doi,licence_spdx,attribution_label,repository_url,pinned_commit,
     metadata_sha256,electricity_sha256,limitations_json FROM public.data_sources LIMIT 1`),
    error => error.code === '23505');
});

test('migration contains no triggers, views, cascades, or composite foreign keys', async () => {
  assert.doesNotMatch(migration, /create\s+(trigger|view)|cascade/i);
  assert.equal((await rows(db, `SELECT count(*)::int AS n FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal`))[0].n, 0);
  assert.equal((await rows(db, `SELECT count(*)::int AS n FROM pg_constraint p
    JOIN pg_namespace n ON n.oid=p.connamespace
    WHERE n.nspname='public' AND p.contype='f' AND cardinality(p.conkey)>1`))[0].n, 0);
});
