begin;

-- Minimal additive provenance support for the verified BDG2 cohort.
-- This migration contains no data and does not alter existing keys, indexes,
-- grants, RLS settings, or policies on the five existing tables.

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique check (btrim(source_code) <> ''),
  title text not null check (btrim(title) <> ''),
  version text not null check (btrim(version) <> ''),
  doi text not null check (btrim(doi) <> ''),
  licence_spdx text not null check (btrim(licence_spdx) <> ''),
  attribution_label text not null check (btrim(attribution_label) <> ''),
  repository_url text not null check (repository_url ~ '^https://'),
  pinned_commit text not null check (pinned_commit ~ '^[0-9a-f]{40}$'),
  metadata_sha256 text not null check (metadata_sha256 ~ '^[0-9a-f]{64}$'),
  electricity_sha256 text not null check (electricity_sha256 ~ '^[0-9a-f]{64}$'),
  limitations_json jsonb not null check (jsonb_typeof(limitations_json) = 'object'),
  created_at timestamptz not null default now()
);

create table public.data_import_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete restrict,
  cohort_code text not null check (btrim(cohort_code) <> ''),
  status text not null check (status in ('loading', 'completed', 'failed')),
  manifest_json jsonb not null check (jsonb_typeof(manifest_json) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint data_import_runs_source_cohort_unique unique (data_source_id, cohort_code),
  constraint data_import_runs_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

alter table public.assets
  add column data_source_id uuid references public.data_sources(id) on delete restrict,
  add column import_run_id uuid references public.data_import_runs(id) on delete restrict,
  add column source_asset_id text,
  add column source_site_id text,
  add column primary_space_usage text,
  drop constraint assets_data_status_check,
  add constraint assets_data_status_check
    check (data_status in ('synthetic_demo', 'public_benchmark')),
  add constraint assets_public_benchmark_source_check check (
    data_status <> 'public_benchmark'
    or (
      data_source_id is not null and import_run_id is not null
      and btrim(source_asset_id) <> '' and btrim(source_site_id) <> ''
      and btrim(primary_space_usage) <> ''
      and schematic_x is null and schematic_y is null
    )
  );

create unique index assets_source_asset_unique
  on public.assets (data_source_id, source_asset_id)
  where data_source_id is not null and source_asset_id is not null;

alter table public.meters
  add column data_source_id uuid references public.data_sources(id) on delete restrict,
  add column import_run_id uuid references public.data_import_runs(id) on delete restrict,
  add column source_meter_id text,
  add column unit text,
  add column reading_semantics text,
  drop constraint meters_source_kind_check,
  add constraint meters_source_kind_check
    check (source_kind in ('synthetic_demo', 'public_benchmark')),
  add constraint meters_public_benchmark_source_check check (
    source_kind <> 'public_benchmark'
    or (
      data_source_id is not null and import_run_id is not null
      and btrim(source_meter_id) <> ''
      and unit = 'kWh' and reading_semantics = 'interval_sum'
      and meter_role = 'building_total' and floor_label is null
    )
  );

create unique index meters_source_meter_unique
  on public.meters (data_source_id, source_meter_id)
  where data_source_id is not null and source_meter_id is not null;

alter table public.energy_readings
  add column data_source_id uuid references public.data_sources(id) on delete restrict,
  add column import_run_id uuid references public.data_import_runs(id) on delete restrict,
  add column source_local_timestamp timestamp without time zone,
  add column source_timezone text,
  add column source_record_key text,
  add column quality_status text,
  drop constraint energy_readings_provenance_check,
  add constraint energy_readings_provenance_check
    check (provenance in ('synthetic_demo', 'public_benchmark')),
  add constraint energy_readings_public_benchmark_source_check check (
    provenance <> 'public_benchmark'
    or (
      data_source_id is not null and import_run_id is not null
      and source_local_timestamp is not null and btrim(source_timezone) <> ''
      and btrim(source_record_key) <> ''
      and quality_status in ('observed', 'observed_zero')
      and interval_minutes = 60
    )
  );

create unique index energy_readings_source_record_unique
  on public.energy_readings (data_source_id, source_record_key)
  where data_source_id is not null and source_record_key is not null;

comment on table public.data_sources is
  'Source-level provenance for approved measured benchmark data.';
comment on table public.data_import_runs is
  'One bounded, validated import run per source cohort.';
comment on table public.assets is
  'Energy assets. public_benchmark rows are source-labelled measured benchmark buildings; schematic coordinates remain optional and non-geographic.';
comment on table public.energy_readings is
  'Hourly interval kWh. public_benchmark rows are measured source observations; missing source intervals remain absent.';

alter table public.data_sources enable row level security;
alter table public.data_import_runs enable row level security;

revoke all on table public.data_sources, public.data_import_runs
  from public, anon, authenticated, service_role;
grant select, insert on table public.data_sources to service_role;
grant select, insert, update on table public.data_import_runs to service_role;

commit;
