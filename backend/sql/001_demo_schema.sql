-- EnergiOS Day 1, Task 2. Schema only: no seed data or API implementation.
-- Run once as the Supabase database owner using SQL Editor.
-- Deliberately no IF NOT EXISTS: existing tables cause an error and rollback.
BEGIN;

CREATE TABLE public.assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (btrim(name) <> ''),
    asset_type text NOT NULL CHECK (btrim(asset_type) <> ''),
    schematic_x numeric,
    schematic_y numeric,
    floor_area_m2 numeric(14, 4) NOT NULL
        CHECK (floor_area_m2 > 0 AND floor_area_m2 <> 'NaN'::numeric),
    timezone text NOT NULL DEFAULT 'Asia/Kuala_Lumpur'
        CHECK (btrim(timezone) <> ''),
    data_status text NOT NULL DEFAULT 'synthetic_demo'
        CHECK (data_status = 'synthetic_demo'),
    CONSTRAINT assets_schematic_pair CHECK (
        (schematic_x IS NULL AND schematic_y IS NULL) OR
        (schematic_x IS NOT NULL AND schematic_y IS NOT NULL
            AND schematic_x NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
            AND schematic_y NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric))
    )
);

CREATE TABLE public.meters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
    floor_label text,
    meter_role text NOT NULL CHECK (meter_role IN ('building_total', 'floor')),
    source_kind text NOT NULL DEFAULT 'synthetic_demo'
        CHECK (source_kind = 'synthetic_demo'),
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT meters_floor_label CHECK (
        (meter_role = 'building_total' AND floor_label IS NULL) OR
        (meter_role = 'floor' AND floor_label IS NOT NULL AND btrim(floor_label) <> '')
    )
);

-- One active authoritative total per asset; floor totals remain diagnostic.
CREATE UNIQUE INDEX meters_one_active_building_total
    ON public.meters (asset_id)
    WHERE meter_role = 'building_total' AND is_active;
CREATE INDEX meters_asset_id_idx ON public.meters (asset_id);

CREATE TABLE public.energy_readings (
    meter_id uuid NOT NULL REFERENCES public.meters(id) ON DELETE RESTRICT,
    recorded_at timestamptz NOT NULL CHECK (isfinite(recorded_at)),
    interval_minutes integer NOT NULL DEFAULT 60 CHECK (interval_minutes = 60),
    consumption_kwh numeric(14, 4) NOT NULL
        CHECK (consumption_kwh >= 0 AND consumption_kwh <> 'NaN'::numeric),
    provenance text NOT NULL DEFAULT 'synthetic_demo'
        CHECK (provenance = 'synthetic_demo'),
    PRIMARY KEY (meter_id, recorded_at)
);

CREATE TABLE public.alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meter_id uuid NOT NULL REFERENCES public.meters(id) ON DELETE RESTRICT,
    window_start timestamptz NOT NULL CHECK (isfinite(window_start)),
    window_end timestamptz NOT NULL CHECK (isfinite(window_end)),
    observed_kwh numeric(14, 4) NOT NULL
        CHECK (observed_kwh >= 0 AND observed_kwh <> 'NaN'::numeric),
    baseline_kwh numeric(14, 4) NOT NULL
        CHECK (baseline_kwh >= 0 AND baseline_kwh <> 'NaN'::numeric),
    rule_code text NOT NULL CHECK (btrim(rule_code) <> ''),
    severity text NOT NULL CHECK (btrim(severity) <> ''),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged')),
    evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb
        CHECK (jsonb_typeof(evidence_json) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT alerts_ordered_window CHECK (window_end > window_start),
    CONSTRAINT alerts_meter_window_rule_unique
        UNIQUE (meter_id, window_start, window_end, rule_code)
);

CREATE TABLE public.scenarios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
    alert_id uuid REFERENCES public.alerts(id) ON DELETE RESTRICT,
    action_code text NOT NULL CHECK (btrim(action_code) <> ''),
    assumptions_json jsonb NOT NULL CHECK (jsonb_typeof(assumptions_json) = 'object'),
    results_json jsonb NOT NULL CHECK (jsonb_typeof(results_json) = 'object'),
    result_status text NOT NULL DEFAULT 'estimated' CHECK (result_status = 'estimated'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX scenarios_asset_id_idx ON public.scenarios (asset_id);
CREATE INDEX scenarios_alert_id_idx ON public.scenarios (alert_id) WHERE alert_id IS NOT NULL;

COMMENT ON TABLE public.assets IS 'Synthetic demonstration data only; schematic positions are fictional, not geographic coordinates.';
COMMENT ON TABLE public.energy_readings IS 'Synthetic demonstration data; consumption is interval kWh, not kW. Missing rows stay missing.';
COMMENT ON COLUMN public.energy_readings.recorded_at IS 'UTC instant stored as timestamptz; display timezone belongs to the asset.';
COMMENT ON COLUMN public.alerts.severity IS 'Nonempty rule output; the PRD does not yet define a severity enum.';
COMMENT ON TABLE public.scenarios IS 'Planned P1 storage only. Assumption-based estimates, never verified savings. No scenario endpoint is implemented by this migration.';

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- Normalize both older Supabase default grants and newer opt-in projects.
-- No anon/authenticated policies: RLS defaults to deny. Public demo API reads
-- will later go through the backend, not directly through the Supabase client.
REVOKE ALL PRIVILEGES ON TABLE
    public.assets, public.meters, public.energy_readings, public.alerts, public.scenarios
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.assets, public.meters, public.energy_readings, public.alerts, public.scenarios
    TO service_role;
-- Supabase service_role has BYPASSRLS. Its credential is backend-only and must
-- never be supplied to the frontend. No credentials are needed to store this SQL.

COMMIT;
