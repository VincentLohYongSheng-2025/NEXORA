"""Forecast-scaled, explicitly hypothetical cross-facility flexibility scenario.

CLEMD contains no refrigeration, pump, charger or feeder telemetry. Equipment
budgets below partition existing synthetic end-use demand; only the EV booking
and mall crowd event add new demand. Half-hour rows are scenario disaggregation,
not measured half-hour readings. Deferred work is repaid within this horizon.
"""
from datetime import datetime, timedelta
from hashlib import sha256
import json
from math import ceil
from zoneinfo import ZoneInfo

PLAN_ID = 'township-flex-crisis-v1'
PARTICIPANTS = ('mall', 'restaurant', 'residential', 'commercial')


def build_flex_plan(states, reviews=None):
    buildings = {s['asset']['facility_id']: s for s in states}
    if not set(PARTICIPANTS).issubset(buildings):
        raise ValueError('All four township flexibility partners are required.')
    mall = buildings['mall']
    zone = ZoneInfo(mall['asset']['timezone'])
    stamps = [datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).astimezone(zone)
              for r in mall['forecast']]
    if len(stamps) != 24 or any(b - a != timedelta(hours=1) for a, b in zip(stamps, stamps[1:])):
        raise ValueError('A complete aligned next-day forecast is required.')
    if any([r['timestamp'] for r in s['forecast']] != [r['timestamp'] for r in mall['forecast']] for s in states):
        raise ValueError('Township forecast timestamps must align.')
    event = next(i * 2 for i, t in enumerate(stamps) if t.hour == 14)
    step = .5
    times = [t + timedelta(minutes=m) for t in stamps for m in (0, 30)]
    demand = {f: [r['forecast_kwh'] for r in s['forecast'] for _ in (0, 1)] for f, s in buildings.items()}
    total = [sum(values[i] for values in demand.values()) for i in range(48)]
    # A new hypothetical booking: six 7.4 kW AC bays, 14:00–16:00, 18:00 deadline.
    ev_kw = 6 * 7.4
    ev_booking = [ev_kw if 14 <= t.hour < 16 else 0. for t in times]
    normal = [v + ev for v, ev in zip(total, ev_booking)]
    capacity = ceil(max(normal) / 10) * 10  # disclosed design scenario, not a utility contract
    surge = demand['mall'][event] * mall['asset']['demo_basis']['load_allocations_percent']['hvac'] / 100 * .15
    before = list(normal)
    before[event] += surge
    # Refrigeration and irrigation are subsets of plugs/services, never HVAC
    # or additional background loads. Clinical/essential loads are excluded.
    cold_budget = demand['restaurant'][event] * buildings['restaurant']['asset']['demo_basis']['load_allocations_percent']['plugs'] / 100 * .50
    pump_budget = demand['residential'][event] * buildings['residential']['asset']['demo_basis']['load_allocations_percent']['plugs'] / 100 * .15
    candidates = [
        dict(facility='restaurant', resource='Cold-room refrigeration',
             available_kw=cold_budget * .5, budget_kw=cold_budget,
             formula='Restaurant forecast × 50% plugs/services × 50% refrigeration allocation × 50% compressor reduction',
             constraint='Demo cold-room air starts at 4.0°C; assumed drift 0.6°C/hour while curtailed, review ceiling 5.0°C. No product-safety validation.',
             earliest=event+1, deadline=event+4, recovery_limit_kw=cold_budget*.5),
        dict(facility='residential', resource='Landscape irrigation pump',
             available_kw=pump_budget, budget_kw=pump_budget,
             formula='Residences forecast × 38% plugs/services × 15% landscape pumping allocation',
             constraint='Defer only a scheduled irrigation cycle; repay the same pump runtime by 18:00. Stormwater, potable water and fire pumps excluded.',
             earliest=event+2, deadline=36, recovery_limit_kw=pump_budget),
        dict(facility='commercial', resource='Car-park EV charging',
             available_kw=ev_kw*.5, budget_kw=ev_kw,
             formula='6 assumed AC charging sessions × 7.4 kW × 50% throttling',
             constraint='88.8 kWh booked across six sessions, available until 18:00; aggregate site charging ≤44.4 kW. Driver consent and individual deadlines required.',
             earliest=event+3, deadline=36, recovery_limit_kw=ev_kw*.5),
    ]
    required = max(0., before[event] - capacity)
    available = sum(p['available_kw'] for p in candidates)
    # Select the minimum necessary aggregate reduction, allocated in proportion
    # to each assumed offer; do not claim all capacity was used if not needed.
    relief = min(required, available)
    after = list(before)
    after[event] -= relief
    independent = list(after)
    offers = []
    for offer in candidates:
        offer = dict(offer)
        reduction = relief * offer['available_kw'] / available if available else 0.
        debt = reduction * step
        independent[event+1] += reduction
        remaining = debt
        recovery = []
        for i in range(offer['earliest'], min(48, offer['deadline'])):
            headroom = max(0., capacity - after[i])
            limit = offer['recovery_limit_kw']
            if offer['facility'] == 'commercial':
                limit = min(limit, ev_kw - ev_booking[i])
            repay = min(remaining, limit * step, headroom * step)
            if repay <= 1e-9:
                continue
            after[i] += repay / step
            recovery.append(dict(local_time=times[i].strftime('%H:%M'), index=i, energy_kwh=repay, power_kw=repay/step))
            remaining -= repay
            if remaining < 1e-8:
                break
        offer.update(name=buildings[offer['facility']]['asset']['name'], reduction_kw=reduction,
                     shifted_kwh=debt, recovery=recovery, unrecovered_kwh=max(0., remaining))
        offers.append(offer)
    residual = sum(p['unrecovered_kwh'] for p in offers)
    feasible = required > 0 and relief >= required-1e-8 and residual < 1e-8 and max(after) <= capacity+1e-8
    signature = sha256(json.dumps(dict(demand=demand, capacity=capacity, surge=surge,
                                     offers=offers), sort_keys=True).encode()).hexdigest()[:20]
    reviews = reviews or {}
    checked = reviews.get('participants', []) if reviews.get('signature') == signature else []
    approved = [f for f in PARTICIPANTS if f in checked]
    status = 'approved' if feasible and len(approved) == len(PARTICIPANTS) else 'proposed'
    peak_before, peak_after = max(before), max(after)
    energy_delta = (sum(before)-sum(after))*step
    if abs(energy_delta) < 1e-7:
        energy_delta = 0.
    description = (f"Keep {mall['asset']['name']} cooling unchanged during a modelled 14:00–14:30 crowd surge. "
                   f"Coordinate refrigeration, irrigation and EV charging to release {relief:.1f} kW, "
                   f"then recover {sum(p['shifted_kwh'] for p in offers):.1f} kWh before each service deadline.")
    notes = [
        'CLEMD-derived synthetic facility forecasts supply the hourly baseline. Each hour is split into two constant-power scenario intervals; no measured 30-minute or live feeder data.',
        'Assumed common feeder covers all six facilities. Capacity = next-day maximum normal load including the EV booking, rounded up to 10 kW. This is not an observed or contracted limit.',
        'Crowd surge = Galleria 14:00 forecast × 52% HVAC share × 15% additional cooling for 30 minutes. This is a stress-test input, not a forecast crowd event.',
        'Device allocations, cold-room drift, irrigation schedule, charging bookings and service deadlines are explicit scenario assumptions requiring site telemetry and operator validation.',
        'One common recovery ledger reserves headroom and repays each participant’s deferred work. All energy and emissions calculations cover the complete 24-hour recovery horizon.',
        'This deterministic scenario uses no forecast uncertainty reserve and can sit exactly on the assumed limit. Deployment requires an operating margin and closed-loop monitoring.',
        'Neighbouring demand reductions release capacity only if the assumed feeder connection exists. They do not reduce the mall’s separate billing-meter demand.',
        'TNB maximum demand uses monthly 30-minute demand. No applicable demand-charge tariff, revenue-meter topology or monthly maximum is established here; no demand-charge saving or penalty avoided is calculated.',
        'No solar, battery discharge, energy transfer or essential hospital load curtailment is used. This preview does not change dashboard consumption, reports or physical equipment.',
    ]
    return dict(id=PLAN_ID, kind='flex', action_id=PLAN_ID, title='Galleria crowd surge: coordinate four township services',
                description=description, target='mall', target_name=mall['asset']['name'], asset_id=mall['asset']['id'],
                floor='whole', floor_label='Township shared-capacity scenario', sources=list(PARTICIPANTS[1:]),
                type='Township alert + AI plan', status=status, signature=signature, approved_participants=approved,
                participants=[dict(facility=f, name=buildings[f]['asset']['name'], reviewed=f in approved,
                                   role='Retain mall cooling and comfort schedule' if f=='mall' else next(p['resource'] for p in offers if p['facility']==f)) for f in PARTICIPANTS],
                window='14:00–14:30 MYT', date=times[event].strftime('%d %b %Y'), timezone=mall['asset']['timezone'],
                feasible=feasible, offers=offers, normal_peak_kw=max(normal), capacity_kw=capacity,
                recovery_end_local=(times[max((r['index'] for p in offers for r in p['recovery']), default=event)] + timedelta(minutes=30)).strftime('%H:%M'),
                mall_baseline_kw=demand['mall'][event], mall_surge_kw=surge,
                event_before_kw=before[event], event_after_kw=after[event], relief_kw=relief,
                required_relief_kw=required, available_relief_kw=available,
                shifted_kwh=sum(p['shifted_kwh'] for p in offers), unrecovered_kwh=residual,
                independent_recovery_peak_kw=max(independent), cold_room_start_c=4.,
                cold_room_after_c=4.+.6*step*(offers[0]['reduction_kw']/max(offers[0]['available_kw'],1e-9)),
                metrics=dict(money_saved_myr=0. if feasible else None, energy_label='Net energy saved after recovery', energy_saved_kwh=energy_delta if feasible else None,
                             consumption_saved_kwh=energy_delta if feasible else None, carbon_reduced_kg=0. if feasible else None, peak_before_kw=peak_before,
                             peak_after_kw=peak_after, peak_reduction_kw=peak_before-peak_after),
                series=[dict(timestamp=t.isoformat(), local_timestamp=t.strftime('%Y-%m-%dT%H:%M'), local_hour=t.strftime('%H:%M'),
                             before_kwh=a*step, after_kwh=b*step, before_kw=a, after_kw=b,
                             independent_kw=c, capacity_kw=capacity)
                        for t,a,b,c in zip(times,before,after,independent)],
                interval_hours=step, notes=notes,
                basis='Simulated township service coordination · 30-minute scenario intervals · Standalone forecast stress test with complete recovery.',
                alternative='Independent recovery restarts all three deferred services at 14:30; the coordinated plan reserves shared headroom and staggers recovery.')
