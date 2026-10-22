from copy import deepcopy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src import workbench as w


@pytest.fixture
def client(tmp_path, monkeypatch):
    saved = deepcopy(w.SESSION)
    w.SESSION.clear()
    monkeypatch.setattr(w, 'SESSION_FILE', tmp_path / 'session.json')
    app = FastAPI()
    app.include_router(w.router, prefix='/api')
    with TestClient(app) as client:
        yield client
    w.SESSION.clear()
    w.SESSION.update(saved)


def asset(facility):
    return next(a['id'] for a in w.FACILITY_ASSETS.values() if a['facility_id'] == facility)


def run(client, kind, ident, facility='commercial'):
    return client.post('/api/workbench/action-simulator/run', json={'kind': kind, 'action_id': ident, 'asset_id': asset(facility)})


def test_sharing_preview_changes_only_preview_and_preserves_energy(client):
    w.township('day')
    saved = deepcopy(w.SESSION)
    response = run(client, 'sharing', 'share-commercial')
    assert response.status_code == 200
    result = response.json()
    assert len(result['series']) == 24
    delta = sum(r['before_kwh'] - r['after_kwh'] for r in result['series'])
    assert result['metrics']['energy_saved_kwh'] == pytest.approx(delta)
    assert result['metrics']['consumption_saved_kwh'] == 0
    assert result['metrics']['money_saved_myr'] == pytest.approx(delta * w._session(asset('commercial'))['config']['tariff_myr_per_kwh'])
    assert result['metrics']['carbon_reduced_kg'] == pytest.approx(delta * w._session(asset('commercial'))['config']['carbon_kg_per_kwh'])
    before = next(b for b in result['before_network']['buildings'] if b['facility_id'] == 'commercial')
    after = next(b for b in result['after_network']['buildings'] if b['facility_id'] == 'commercial')
    assert before['mode'] == 'grid' and after['mode'] == 'hybrid'
    assert all(row['after_kwh'] >= 0 for row in result['series'])
    assert w.SESSION == saved


def test_alert_simulation_matches_existing_alert_impact(client):
    data = w._state(asset('commercial'), 'day')
    alert = next(a for a in data['alerts'] if a['floor'] == 'level_4')
    result = run(client, 'alert', alert['id']).json()
    assert result['floor'] == 'level_4'
    assert result['metrics']['energy_saved_kwh'] == pytest.approx(alert['energy_kwh'])
    assert result['metrics']['money_saved_myr'] == pytest.approx(alert['cost_myr'])
    assert result['metrics']['carbon_reduced_kg'] == pytest.approx(alert['carbon_kg'])
    assert alert['id'] not in w._session(asset('commercial')).get('settled_alerts', [])


@pytest.mark.parametrize('ident', ['solar', 'shift', 'efficiency'])
def test_ai_suggestions_have_calculated_series_and_honest_metrics(client, ident):
    response = run(client, 'action', ident)
    assert response.status_code == 200
    result = response.json()
    assert len(result['series']) == 24
    if ident == 'shift':
        assert result['metrics']['energy_saved_kwh'] == 0
        assert result['metrics']['money_saved_myr'] == 0
        assert result['metrics']['peak_after_kw'] <= result['metrics']['peak_before_kw']
    else:
        assert result['metrics']['energy_saved_kwh'] > 0


def test_invalid_or_mismatched_actions_are_rejected(client):
    assert run(client, 'alert', 'missing').status_code == 422
    assert run(client, 'sharing', 'share-commercial', 'hospital').status_code == 422
    assert run(client, 'unknown', 'solar').status_code == 422


def test_missing_tariff_and_carbon_stay_unavailable(client):
    w._session(asset('commercial'))['config'].update(tariff_myr_per_kwh=None, carbon_kg_per_kwh=None)
    result = run(client, 'action', 'efficiency').json()
    assert result['metrics']['money_saved_myr'] is None
    assert result['metrics']['carbon_reduced_kg'] is None
