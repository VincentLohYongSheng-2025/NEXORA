// Apply the minimal schema and import the verified BDG2 cohort into disposable PGlite.
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PGlite } from '../../.tools/schema-check/node_modules/@electric-sql/pglite/dist/index.js';

const baselineUrl = new URL('../sql/001_demo_schema.sql', import.meta.url);
const migrationUrl = new URL('../supabase/migrations/20261013101159_add_bdg2_provenance_schema.sql', import.meta.url);
const defaultBundleUrl = new URL('../../data/local/bdg2-cohort-v1/', import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function createIsolatedDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT ALL ON TABLES TO anon, authenticated, service_role;
  `);
  await db.exec(await readFile(baselineUrl, 'utf8'));
  await db.exec(await readFile(migrationUrl, 'utf8'));
  return db;
}

async function insertJson(db, sql, records) {
  await db.query(sql, [JSON.stringify(records)]);
}

export async function importBundle(db, bundleUrl = defaultBundleUrl) {
  const source = await json(new URL('data_source.json', bundleUrl));
  const assets = await json(new URL('assets.json', bundleUrl));
  const meters = await json(new URL('meters.json', bundleUrl));
  const manifest = await json(new URL('manifest.json', bundleUrl));
  await db.exec('BEGIN');
  try {
    await insertJson(db, `INSERT INTO public.data_sources
      (id,source_code,title,version,doi,licence_spdx,attribution_label,repository_url,
       pinned_commit,metadata_sha256,electricity_sha256,limitations_json)
      SELECT id,source_code,title,version,doi,licence_spdx,attribution_label,repository_url,
       pinned_commit,metadata_sha256,electricity_sha256,limitations_json
      FROM jsonb_to_recordset($1::jsonb) AS x(
       id uuid,source_code text,title text,version text,doi text,licence_spdx text,
       attribution_label text,repository_url text,pinned_commit text,metadata_sha256 text,
       electricity_sha256 text,limitations_json jsonb)
      ON CONFLICT DO NOTHING`, [source]);
    await db.query(`INSERT INTO public.data_import_runs
      (id,data_source_id,cohort_code,status,manifest_json)
      VALUES ($1,$2,$3,'loading',$4::jsonb)
      ON CONFLICT (data_source_id,cohort_code) DO NOTHING`,
    [manifest.import_run_id, manifest.data_source_id, manifest.cohort_code, JSON.stringify(manifest)]);
    await insertJson(db, `INSERT INTO public.assets
      (id,name,asset_type,floor_area_m2,timezone,data_status,data_source_id,import_run_id,
       source_asset_id,source_site_id,primary_space_usage)
      SELECT id,name,asset_type,floor_area_m2,timezone,data_status,data_source_id,import_run_id,
       source_asset_id,source_site_id,primary_space_usage
      FROM jsonb_to_recordset($1::jsonb) AS x(
       id uuid,name text,asset_type text,floor_area_m2 numeric,timezone text,data_status text,
       data_source_id uuid,import_run_id uuid,source_asset_id text,source_site_id text,
       primary_space_usage text) ON CONFLICT DO NOTHING`, assets);
    await insertJson(db, `INSERT INTO public.meters
      (id,asset_id,floor_label,meter_role,source_kind,is_active,data_source_id,import_run_id,
       source_meter_id,unit,reading_semantics)
      SELECT id,asset_id,floor_label,meter_role,source_kind,is_active,data_source_id,import_run_id,
       source_meter_id,unit,reading_semantics
      FROM jsonb_to_recordset($1::jsonb) AS x(
       id uuid,asset_id uuid,floor_label text,meter_role text,source_kind text,is_active boolean,
       data_source_id uuid,import_run_id uuid,source_meter_id text,unit text,reading_semantics text)
      ON CONFLICT DO NOTHING`, meters);

    const input = createInterface({
      input: createReadStream(fileURLToPath(new URL('readings.ndjson', bundleUrl)), { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    let batch = [];
    for await (const line of input) {
      if (!line) continue;
      batch.push(JSON.parse(line));
      if (batch.length === 1000) {
        await insertReadings(db, batch);
        batch = [];
      }
    }
    if (batch.length) await insertReadings(db, batch);
    const report = await validateImport(db, manifest);
    await db.query(`UPDATE public.data_import_runs SET status='completed',
      completed_at=coalesce(completed_at,now()),manifest_json=$2::jsonb
      WHERE id=$1`, [manifest.import_run_id, JSON.stringify(manifest)]);
    await db.exec('COMMIT');
    return report;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

async function insertReadings(db, readings) {
  await insertJson(db, `INSERT INTO public.energy_readings
    (meter_id,recorded_at,interval_minutes,consumption_kwh,provenance,data_source_id,import_run_id,
     source_local_timestamp,source_timezone,source_record_key,quality_status)
    SELECT meter_id,recorded_at,interval_minutes,consumption_kwh,provenance,data_source_id,import_run_id,
     source_local_timestamp,source_timezone,source_record_key,quality_status
    FROM jsonb_to_recordset($1::jsonb) AS x(
     meter_id uuid,recorded_at timestamptz,interval_minutes integer,consumption_kwh numeric,
     provenance text,data_source_id uuid,import_run_id uuid,source_local_timestamp timestamp,
     source_timezone text,source_record_key text,quality_status text)
    ON CONFLICT DO NOTHING`, readings);
}

export async function validateImport(db, manifest) {
  const sourceId = manifest.data_source_id;
  const counts = (await db.query(`SELECT
    (SELECT count(*)::int FROM public.data_sources WHERE id=$1) AS sources,
    (SELECT count(*)::int FROM public.data_import_runs WHERE id=$2) AS runs,
    (SELECT count(*)::int FROM public.assets WHERE data_source_id=$1) AS assets,
    (SELECT count(*)::int FROM public.meters WHERE data_source_id=$1) AS meters,
    (SELECT count(*)::int FROM public.energy_readings WHERE data_source_id=$1) AS readings`,
  [sourceId, manifest.import_run_id])).rows[0];
  const expectedCounts = { sources: 1, runs: 1, assets: 4, meters: 4,
    readings: manifest.counts.accepted };
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
    throw new Error(`Imported counts mismatch: ${JSON.stringify(counts)}`);
  }
  const invalid = (await db.query(`SELECT count(*)::int AS n FROM public.energy_readings
    WHERE data_source_id=$1 AND (provenance<>'public_benchmark' OR interval_minutes<>60
      OR consumption_kwh<0 OR source_timezone<>'US/Central' OR quality_status<>'observed'
      OR source_record_key IS NULL OR source_local_timestamp IS NULL)`, [sourceId])).rows[0].n;
  if (invalid !== 0) throw new Error(`Invalid imported readings: ${invalid}`);
  const source = (await db.query(`SELECT source_code,metadata_sha256,electricity_sha256
    FROM public.data_sources WHERE id=$1`, [sourceId])).rows[0];
  if (!source || source.source_code !== manifest.source_code
      || source.metadata_sha256 !== manifest.metadata_sha256
      || source.electricity_sha256 !== manifest.electricity_sha256) {
    throw new Error(`Source provenance mismatch: ${JSON.stringify(source)}`);
  }
  const storedManifest = (await db.query(`SELECT manifest_json FROM public.data_import_runs
    WHERE id=$1`, [manifest.import_run_id])).rows[0]?.manifest_json;
  if (canonicalJson(storedManifest) !== canonicalJson(manifest)) {
    throw new Error('Stored import manifest differs from the verified bundle');
  }
  const duplicateKeys = (await db.query(`SELECT count(*)::int AS n FROM (
    SELECT source_record_key FROM public.energy_readings WHERE data_source_id=$1
    GROUP BY source_record_key HAVING count(*)>1) duplicate`, [sourceId])).rows[0].n;
  if (duplicateKeys !== 0) throw new Error(`Duplicate source keys: ${duplicateKeys}`);
  const dstRows = (await db.query(`SELECT count(*)::int AS n FROM public.energy_readings
    WHERE data_source_id=$1 AND to_char(source_local_timestamp,'YYYY-MM-DD HH24:MI:SS') IN
      ('2016-03-13 02:00:00','2016-11-06 01:00:00','2017-03-12 02:00:00','2017-11-05 01:00:00')`,
  [sourceId])).rows[0].n;
  if (dstRows !== 0) throw new Error(`DST quarantine rows were imported: ${dstRows}`);
  const perMeter = (await db.query(`SELECT m.source_meter_id,
    count(*)::int AS accepted, sum(r.consumption_kwh)::text AS sum_kwh,
    to_char(min(r.recorded_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS first_utc,
    to_char(max(r.recorded_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_utc,
    min(m.unit) AS unit, min(m.reading_semantics) AS reading_semantics
    FROM public.energy_readings r JOIN public.meters m ON m.id=r.meter_id
    WHERE r.data_source_id=$1 GROUP BY m.source_meter_id ORDER BY m.source_meter_id`, [sourceId])).rows;
  for (const row of perMeter) {
    const buildingId = row.source_meter_id.replace(/:electricity$/, '');
    const expected = manifest.per_meter[buildingId];
    const sumDifference = Math.abs(Number(row.sum_kwh) - Number(expected?.sum_kwh));
    if (!expected || row.accepted !== expected.accepted || sumDifference > 0.000001
        || row.first_utc !== expected.first_utc || row.last_utc !== expected.last_utc
        || row.unit !== 'kWh' || row.reading_semantics !== 'interval_sum') {
      throw new Error(`Per-meter validation failed: ${JSON.stringify(row)}`);
    }
  }
  return { ...counts, missing: manifest.counts.missing,
    dst_quarantined: manifest.counts.dst_quarantined, zero: manifest.counts.zero,
    first_utc: perMeter[0].first_utc, last_utc: perMeter[0].last_utc,
    unit: 'kWh', provenance: 'public_benchmark' };
}

async function main() {
  const argument = process.argv[2];
  const bundleUrl = argument ? pathToFileURL(resolve(argument) + '/') : defaultBundleUrl;
  const db = await createIsolatedDatabase();
  try {
    const first = await importBundle(db, bundleUrl);
    const replay = await importBundle(db, bundleUrl);
    console.log(JSON.stringify({ first, replay, idempotent: JSON.stringify(first) === JSON.stringify(replay) }));
  } finally {
    await db.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
