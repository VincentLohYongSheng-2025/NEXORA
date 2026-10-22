"""Source, coverage, unit and cross-tab reconciliation checks for Malaysia v2."""
from copy import deepcopy
from datetime import datetime
import pytest
from src import workbench as w
from src import malaysia_benchmark as my


def test_source_is_one_malaysian_measured_building_and_missing_hours_stay_missing():
    assert w.assets()['data_model_version']=='malaysia-v2'
    assert len(w.ASSETS) == 1
    asset = next(iter(w.ASSETS.values()))
    assert asset['timezone'] == 'Asia/Kuala_Lumpur'
    assert asset['provenance']['source_code'] == 'clemd_v1'
    week = w._state(asset['id'], 'week')
    assert week['coverage'] == dict(available_hours=144, expected_hours=168, missing_hours=24,
        note='Missing source hours are excluded; totals cover available hours only.')
    assert week['observed_window']['from'].startswith('2023-10-18')
    assert week['observed'][0]['source_local_timestamp'].startswith('2023-10-19')
    assert week['forecast'][0]['timestamp'].startswith('2023-10-24T16:00')
    assert len({round(r['forecast_kwh'],4) for r in week['forecast']})>1
    assert sum(r['consumption_kwh'] for r in week['observed']) == pytest.approx(week['metrics']['observed_energy_kwh'])


def test_all_demo_profiles_have_explicit_sizes_reconciled_allocations_and_local_currency():
    data = w.township('day')
    for item in data['items']:
        a,c,m = item['asset'],item['config'],item['metrics']
        assert a['source_asset_id'] == 'CLEMD_UPNM'
        assert a['provenance']['kind'] == 'simulated_demonstration_assumption'
        assert sum(a['demo_basis']['load_allocations_percent'].values()) == 100
        if a['facility_id'] != 'solar':
            assert a['floor_area_m2'] > 0
            assert sum(a['demo_basis']['floor_hvac_weights'].values()) == pytest.approx(1)
        assert m['observed_cost_estimate_myr'] == pytest.approx(m['observed_energy_kwh']*c['tariff_myr_per_kwh'])
        assert m['observed_carbon_estimate_kg'] == pytest.approx(m['observed_energy_kwh']*c['carbon_kg_per_kwh'])
    assert data['metrics']['observed_energy_kwh'] == pytest.approx(sum(i['metrics']['observed_energy_kwh'] for i in data['items']))


def test_solar_yield_is_normalized_and_no_generation_occurs_before_local_sunrise():
    asset=next(a for a in w.FACILITY_ASSETS.values() if a['facility_id']=='solar')
    data=w._state(asset['id'],'day')
    rows=data['dispatch']['items']
    assert sum(r['solar_kwh'] for r in rows) == pytest.approx(data['config']['pv_kw']*4.5)
    stored=data['config']['battery_kwh']*data['config']['starting_soc_percent']/100
    for row in rows:
        stored+=row['charge_kwh']*.95-row['discharge_kwh']/.95
        assert row['stored_kwh']==pytest.approx(stored)
        assert 0 <= stored <= data['config']['battery_kwh']+1e-8
        assert row['baseline_kwh']==pytest.approx(row['direct_solar_kwh']+row['discharge_kwh']+row['grid_kwh'])
        hour=datetime.fromisoformat(row['timestamp'].replace('Z','+00:00')).astimezone(w.ZoneInfo(asset['timezone'])).hour
        if hour < 7 or hour >= 19: assert row['solar_kwh'] == pytest.approx(0,abs=1e-9)


def test_approved_sharing_reconciles_building_dashboard_and_township_totals():
    saved=deepcopy(w.SESSION)
    try:
        w.SESSION.clear()
        solar=next(a for a in w.FACILITY_ASSETS.values() if a['facility_id']=='solar')
        w._session(solar['id'])['sharing_approved']=['share-commercial']
        township=w.township('day')
        item=next(i for i in township['items'] if i['asset']['facility_id']=='commercial')
        state=w._state(item['asset']['id'],'day')
        assert state['metrics']==item['metrics']
        assert state['metrics']['projected_shared_solar_kwh']>0
        assert state['metrics']['projected_cost_difference_myr']==pytest.approx(state['metrics']['projected_grid_avoided_kwh']*.45)
        assert township['metrics']['projected_grid_avoided_kwh']==pytest.approx(sum(i['metrics']['projected_grid_avoided_kwh'] for i in township['items']))
    finally:
        w.SESSION.clear();w.SESSION.update(saved)
