from copy import deepcopy

import pytest

from src.township_energy import energy_network


def building(facility, demand=100, solar=0, surplus=0):
    rows = [{"timestamp": f"2026-10-22T{h:02d}:00:00Z", "baseline_kwh": demand,
             "direct_solar_kwh": solar, "discharge_kwh": 0, "curtailed_kwh": surplus}
            for h in range(24)]
    return {"asset": {"id": facility, "facility_id": facility, "name": facility, "timezone": "UTC"},
            "dispatch": {"items": rows}, "actions": [{"id": "solar", "status": "approved"}], "metrics": {"projected_energy_kwh": demand * 24, "forecast_energy_kwh": demand * 24},
            "config": {"tariff_myr_per_kwh": .5, "carbon_kg_per_kwh": .55}}


def test_all_plans_share_one_hourly_surplus_ledger_with_losses():
    states = [building('solar', 1, 1, 15), building('commercial'), building('hospital')]
    original = deepcopy(states)
    network = energy_network(states)
    assert len(network['recommendations']) == 2
    for hour in (14, 15, 16):
        rows = [r for p in network['recommendations'] for r in p['allocations'] if f'T{hour}:00' in r['timestamp']]
        assert sum(r['sent_kwh'] for r in rows) <= 15 + 1e-9
        assert sum(r['delivered_kwh'] for r in rows) == pytest.approx(sum(r['sent_kwh'] for r in rows) * .97)
        assert sum(r['loss_kwh'] for r in rows) == pytest.approx(sum(r['sent_kwh'] for r in rows) * .03)
    assert states == original


def test_approval_changes_floor_supply_and_never_total_consumption():
    states = [building('solar', 1, 1, 1000), building('commercial', solar=20), building('hospital', solar=20)]
    before = energy_network(states)
    after = energy_network(states, ['share-commercial', 'share-hospital'])
    assert before['approved_grid_avoided_kwh'] == 0
    assert after['approved_grid_avoided_kwh'] > 0
    for b in after['buildings']:
        for floor in b['floors']:
            assert floor['demand_kwh'] == pytest.approx(floor['onsite_solar_kwh'] + floor['shared_solar_kwh'] + floor['grid_kwh'])
            assert floor['grid_kwh'] >= 0
    commercial = next(b for b in after['buildings'] if b['facility_id'] == 'commercial')
    assert commercial['mode'] == 'hybrid'
    assert next(f for f in commercial['floors'] if f['id'] == 'level_4')['mode'] == 'solar'
    assert energy_network(states, ['share-commercial', 'share-commercial']) == energy_network(states, ['share-commercial'])


def test_no_surplus_or_missing_factors_do_not_produce_fake_savings():
    assert energy_network([building('solar'), building('commercial')])['recommendations'] == []
    states = [building('solar', 1, 1, 100), building('commercial')]
    states[1]['config'].update(tariff_myr_per_kwh=None, carbon_kg_per_kwh=None)
    plan = energy_network(states)['recommendations'][0]
    assert plan['cost_myr'] is None and plan['carbon_kg'] is None
    assert {r['timestamp'][11:13] for r in plan['allocations']} == {'14', '15', '16'}


def test_approved_recipient_keeps_reservation_priority_under_scarcity():
    states = [building('solar', 1, 1, 5), building('commercial'), building('hospital')]
    network = energy_network(states, ['share-hospital'])
    assert network['recommendations'][0]['target'] == 'hospital'
    assert network['recommendations'][0]['status'] == 'approved'
    assert network['recommendations'][0]['delivered_kwh'] == pytest.approx(15*.97)


def test_configured_but_unapproved_building_pv_does_not_change_source_badges():
    states = [building('solar', 1, 1, 1000), building('commercial', solar=70)]
    states[1]['actions'] = [{"id": "solar", "status": "proposed"}]
    assert energy_network(states)['buildings'][1]['mode'] == 'grid'
    assert energy_network(states, ['share-commercial'])['buildings'][1]['mode'] == 'hybrid'


def test_two_rooftops_can_jointly_supply_one_receiving_floor():
    states = [building('solar', 1, 1, 1000), building('mall', 5, 5, 10),
              building('residential', 5, 5, 10), building('commercial')]
    network = energy_network(states, ['share-commercial'])
    plan = network['recommendations'][0]
    assert set(plan['source_ids']) == {'mall', 'residential'}
    assert len(network['links']) == 2
    assert all(link['target'] == 'commercial' for link in network['links'])


def test_sharing_api_approval_is_idempotent_and_resettable(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from src import workbench as w
    saved = deepcopy(w.SESSION)
    monkeypatch.setattr(w, 'SESSION_FILE', tmp_path / 'session.json')
    w.SESSION.clear()
    app = FastAPI()
    app.include_router(w.router, prefix='/api')
    client = TestClient(app)
    try:
        base = '/api/workbench/township/sharing'
        assert client.post(base + '/unknown/approve').status_code == 409
        approved = client.post(base + '/share-commercial/approve')
        assert approved.status_code == 200
        first = approved.json()
        again = client.post(base + '/share-commercial/approve').json()
        assert first == again
        assert first['approved_grid_avoided_kwh'] > 0
        assert (tmp_path / 'session.json').exists()
        assert client.post(base + '/reset').json()['approved_grid_avoided_kwh'] == 0
    finally:
        w.SESSION.clear()
        w.SESSION.update(saved)
