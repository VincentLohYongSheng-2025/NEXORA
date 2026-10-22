"""Read-only comparisons for one selected recommendation."""
from datetime import datetime
from zoneinfo import ZoneInfo


def simulate_action(data, network, after_network, kind, action_id):
    forecast = data['forecast']
    before = [r['forecast_kwh'] for r in forecast]
    after = list(before)
    config = data['config']
    rate, carbon = config['tariff_myr_per_kwh'], config['carbon_kg_per_kwh']
    prices = [rate] * len(before)
    energy_label, consumption_saved = 'Energy saved', 0.
    target, floor, floor_label, sources = data['asset'].get('facility_id'), 'whole', 'Whole building', []
    notes = []
    if kind == 'alert':
        action = next((a for a in data['alerts'] if a['id'] == action_id), None)
        if action is None:
            raise ValueError('This alert does not belong to the selected building.')
        title, description = action['title'], action['solution']
        floor, floor_label = action['floor'], action['floor_label']
        after = [v * (1 - action['fraction']) for v in before]
        consumption_saved = sum(before) - sum(after)
        notes.append('Alert impact uses its existing illustrative reduction fraction. Room conditions are not sensor readings.')
    elif kind == 'sharing':
        action = next((a for a in after_network['recommendations'] if a['id'] == action_id and a['target'] == target), None)
        if action is None:
            raise ValueError('This sharing recommendation is unavailable for the selected building. Refresh recommendations.')
        title = action['title']
        description = f"Route surplus from {', '.join(action['sources'])} to {action['target_name']} · {action['floor_label']} during {network['window']}."
        floor, floor_label, sources = action['floor'], action['floor_label'], action['source_ids']
        factor = data['metrics']['projected_energy_kwh'] / max(data['metrics']['forecast_energy_kwh'], 1e-9)
        local_solar = any(a['id'] == 'solar' and a['status'] == 'approved' for a in data['actions'])
        before = [max(0., v * factor - (r['direct_solar_kwh'] + r['discharge_kwh'] if local_solar else 0.))
                  for v, r in zip(before, data['dispatch']['items'])]
        delivered = {}
        for r in action['allocations']:
            delivered[r['timestamp']] = delivered.get(r['timestamp'], 0.) + r['delivered_kwh']
        after = [max(0., v - delivered.get(r['timestamp'], 0.)) for v, r in zip(before, forecast)]
        prices = [None if rate is None else rate for r in forecast]
        energy_label = 'Grid energy saved'
        notes.extend([network['assumptions'], 'Sharing changes the electricity source, not total building consumption. Previewing does not approve the action.'])
    elif kind == 'action':
        action = next((a for a in data['actions'] if a['id'] == action_id), None)
        if action is None:
            raise ValueError('This AI suggestion is unavailable for the selected building.')
        title, description = action['title'], action['reason']
        if action_id == 'solar':
            after = [r['grid_kwh'] for r in data['dispatch']['items']]
            energy_label = 'Grid energy saved'
            notes.extend(data['dispatch']['limitations'])
        elif action_id == 'shift':
            after = [r['after_kwh'] for r in data['shift']['items']]
            notes.append('Load shifting preserves total energy. The configured flat rate does not produce bill savings; peak demand may reduce.')
        elif action_id == 'efficiency':
            after = [v * (1 - config['efficiency_reduction_percent'] / 100) for v in before]
            consumption_saved = sum(before) - sum(after)
            notes.append('The configured efficiency target is a planning assumption, not a measured equipment improvement.')
    else:
        raise ValueError('Unknown action type.')
    difference = sum(before) - sum(after)
    if abs(difference) < 1e-8:
        difference = 0.
    money = None if rate is None else sum((a - b) * p for a, b, p in zip(before, after, prices))
    if money is not None and abs(money) < 1e-8:
        money = 0.
    return {'kind': kind, 'action_id': action_id, 'title': title, 'description': description,
            'target': target, 'target_name': data['asset']['name'], 'floor': floor, 'floor_label': floor_label,
            'sources': sources, 'timezone': data['asset']['timezone'],
            'series': [{'timestamp': r['timestamp'], 'local_timestamp': datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).astimezone(ZoneInfo(data['asset']['timezone'])).strftime('%Y-%m-%dT%H:%M'),
                        'local_hour': datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).astimezone(ZoneInfo(data['asset']['timezone'])).strftime('%H:%M'),
                        'before_kwh': a, 'after_kwh': b} for r, a, b in zip(forecast, before, after)],
            'metrics': {'money_saved_myr': money, 'energy_label': energy_label, 'energy_saved_kwh': difference,
                        'consumption_saved_kwh': consumption_saved, 'carbon_reduced_kg': None if carbon is None else difference * carbon,
                        'peak_before_kw': max(before), 'peak_after_kw': max(after)},
            'before_network': network, 'after_network': after_network,
            'notes': notes, 'basis': 'Standalone next-24-hour comparison for the selected action. Not an additional cumulative saving. No approval or physical control is performed.'}
