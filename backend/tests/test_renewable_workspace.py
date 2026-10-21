from uuid import UUID
import pytest
import src.workbench as w


@pytest.fixture(autouse=True)
def isolated_session(tmp_path, monkeypatch):
    monkeypatch.setattr(w, 'SESSION', {})
    monkeypatch.setattr(w, 'SESSION_FILE', tmp_path / 'session.json')


def payload(technology='ev'):
    key = next(iter(w.FACILITY_ASSETS))
    config = w._session(key)['config'].copy()
    return w.ScenarioRequest(asset_id=key, name='EV conservation check', technology=technology,
                             config=config, design={'evCount': 2, 'evPower': 22, 'evHours': 2.5,
                                                    'evStart': 23, 'evDays': 365})


def test_ev_schedule_crosses_midnight_without_creating_savings():
    p = payload()
    result = w.preview_scenario(p)
    assert result['ev_energy_kwh'] == pytest.approx(110)
    assert result['forecast_energy_kwh'] == pytest.approx(result['building_energy_kwh'] + 110)
    assert result['simulated_grid_kwh'] == pytest.approx(result['forecast_energy_kwh'])
    assert result['grid_avoided_kwh'] == pytest.approx(-110)
    assert result['cost_difference_myr'] == pytest.approx(-110 * p.config.tariff_myr_per_kwh)
    for row in result['items']:
        assert row['grid_kwh'] + row['direct_solar_kwh'] + row['discharge_kwh'] == pytest.approx(row['baseline_kwh'])
        assert row['baseline_kwh'] == pytest.approx(row['building_baseline_kwh'] + row['ev_kwh'])


def test_scenario_design_persists_and_ids_remain_unique_after_delete():
    p = payload('none')
    first = w.save_scenario(p)
    second = w.save_scenario(p)
    updated = w.save_scenario(p.model_copy(update={'scenario_id': second['id'], 'name': 'Updated equipment plan'}))
    assert updated['id'] == second['id']
    assert len(w._session(str(p.asset_id))['scenarios']) == 2
    assert updated['name'] == 'Updated equipment plan'
    w.delete_scenario(first['id'], w.ActionRequest(asset_id=p.asset_id))
    third = w.save_scenario(p)
    assert third['id'] > second['id']
    assert third['design']['evStart'] == 23
    assert third['preview']['grid_avoided_kwh'] == pytest.approx(0)
    assert w.SESSION_FILE.exists()
    request = w.request_support(w.SupportRequest(asset_id=p.asset_id, discipline='ev', note='Check parking power capacity', scenario=p))
    assert request['status'] == 'pending_review'
    assert len(w._session(str(p.asset_id))['support_requests']) == 1
    assert request['scenario']['asset_id'] == str(p.asset_id)
