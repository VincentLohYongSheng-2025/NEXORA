from pathlib import Path

from src.bdg2_import import BUILDING_IDS, EXPECTED, build_bundle


def test_verified_bdg2_cohort_counts_timestamps_units_and_provenance():
    source_dir = Path(__file__).resolve().parents[2] / "data/source/bdg2-v1"
    data_source, assets, meters, readings, manifest = build_bundle(source_dir)

    assert data_source["source_code"] == "bdg2_v1"
    assert data_source["licence_spdx"] == "CC-BY-4.0"
    assert data_source["limitations_json"]["not_sime_darby_or_elmina"] is True
    assert manifest["counts"] == EXPECTED
    assert manifest["tzdata_version"] == "2026.5"
    assert manifest["unit"] == "kWh"
    assert manifest["reading_semantics"] == "interval_sum"
    assert len(assets) == len(meters) == len(BUILDING_IDS) == 4
    assert len(readings) == 70_152
    assert {asset["source_asset_id"] for asset in assets} == set(BUILDING_IDS)
    assert all(meter["meter_role"] == "building_total" for meter in meters)
    assert all(reading["provenance"] == "public_benchmark" for reading in readings)
    assert all(reading["source_timezone"] == "US/Central" for reading in readings)
    assert all(reading["interval_minutes"] == 60 for reading in readings)
    assert min(reading["recorded_at"] for reading in readings) == "2016-01-01T06:00:00Z"
    assert max(reading["recorded_at"] for reading in readings) == "2018-01-01T05:00:00Z"

    keys = {reading["source_record_key"] for reading in readings}
    assert len(keys) == len(readings)
    quarantined = {
        "2016-03-13T02:00:00",
        "2016-11-06T01:00:00",
        "2017-03-12T02:00:00",
        "2017-11-05T01:00:00",
    }
    assert not quarantined.intersection(reading["source_local_timestamp"] for reading in readings)
