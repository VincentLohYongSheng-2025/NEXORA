from copy import deepcopy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src import workbench as w
from src.township_flex import build_flex_plan, PLAN_ID, PARTICIPANTS


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


def test_capacity_and_recovery_share_one_ledger(client):
    p = client.get('/api/workbench/township').json()['flex_plan']
    assert p['feasible']
    assert p['relief_kw'] == pytest.approx(sum(o['reduction_kw'] for o in p['offers']))
    assert p['relief_kw'] == pytest.approx(p['required_relief_kw'])
    assert p['event_after_kw'] <= p['capacity_kw'] + 1e-8
    assert p['metrics']['peak_after_kw'] <= p['capacity_kw'] + 1e-8
    assert p['independent_recovery_peak_kw'] > p['capacity_kw']
    assert p['mall_surge_kw'] == pytest.approx(p['mall_baseline_kw'] * .52 * .15)
    for o in p['offers']:
        assert 0 < o['reduction_kw'] <= o['available_kw'] <= o['budget_kw']
        assert sum(r['energy_kwh'] for r in o['recovery']) == pytest.approx(o['shifted_kwh'])
        assert o['unrecovered_kwh'] == 0
        assert all(r['index'] < o['deadline'] and r['index'] >= o['earliest'] for r in o['recovery'])
        if o['facility'] == 'commercial':
            assert all(r['power_kw'] <= 44.4 for r in o['recovery'])
    assert len(p['series']) == 48
    assert all(r['after_kw'] >= 0 for r in p['series'])
    assert sum(r['before_kwh'] for r in p['series']) == pytest.approx(sum(r['after_kwh'] for r in p['series']))
    assert p['metrics']['energy_saved_kwh'] == 0
    assert p['metrics']['money_saved_myr'] == 0
    assert p['metrics']['carbon_reduced_kg'] == 0
    assert p['cold_room_start_c'] <= p['cold_room_after_c'] < 5


def test_preview_is_read_only_and_target_is_validated(client):
    p = client.get('/api/workbench/township').json()['flex_plan']
    saved = deepcopy(w.SESSION)
    result = client.post('/api/workbench/action-simulator/run', json=dict(
        asset_id=p['asset_id'], kind='flex', action_id=PLAN_ID))
    assert result.status_code == 200
    assert result.json()['after_network'] is None
    assert w.SESSION == saved
    wrong = next(a['id'] for a in w.FACILITY_ASSETS.values() if a['facility_id'] == 'restaurant')
    assert client.post('/api/workbench/action-simulator/run', json=dict(
        asset_id=wrong, kind='flex', action_id=PLAN_ID)).status_code == 422


def test_joint_reviews_are_revocable_and_do_not_credit_savings(client):
    original = client.get('/api/workbench/township').json()
    p = original['flex_plan']
    path = f'/api/workbench/township/flex/{PLAN_ID}/review'
    partial = client.post(path, json=dict(signature=p['signature'], participants=['mall'])).json()
    assert partial['status'] == 'proposed'
    approved = client.post(path, json=dict(signature=p['signature'], participants=list(PARTICIPANTS))).json()
    assert approved['status'] == 'approved'
    assert client.get('/api/workbench/township').json()['metrics'] == original['metrics']
    assert client.post(path, json=dict(signature='0'*20, participants=['mall'])).status_code == 409
    assert client.post(path, json=dict(signature=p['signature'], participants=['hospital'])).status_code == 422
    assert client.post(path, json=dict(signature=p['signature'], participants=[])).json()['status'] == 'proposed'


def test_missing_recovery_capacity_blocks_approval_basis(client):
    states = [w._base_state(key, 'day') for key in w.FACILITY_ASSETS]
    # A deliberately adversarial forecast: every recovery slot has the same
    # full normal feeder load. The solver must report work it cannot repay.
    for s in states:
        for r in s['forecast']:
            r['forecast_kwh'] = 10000.
    p = build_flex_plan(states)
    assert not p['feasible']
    assert p['status'] == 'proposed'
    assert p['unrecovered_kwh'] > 0 or p['relief_kw'] < p['required_relief_kw']
    assert p['metrics']['energy_saved_kwh'] is None
    assert p['metrics']['money_saved_myr'] is None


def test_reviews_expire_when_relevant_forecast_changes(client):
    states = [w._base_state(key, 'day') for key in w.FACILITY_ASSETS]
    p = build_flex_plan(states)
    reviews = dict(signature=p['signature'], participants=list(PARTICIPANTS))
    assert build_flex_plan(states, reviews)['status'] == 'approved'
    states[0]['forecast'][14]['forecast_kwh'] *= 1.1
    changed = build_flex_plan(states, reviews)
    assert changed['signature'] != p['signature']
    assert changed['approved_participants'] == []
