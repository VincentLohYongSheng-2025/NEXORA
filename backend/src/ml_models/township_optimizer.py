"""Township scheduling and battery dispatch: optimisation, not machine learning.

Every task is completed with its original energy, within operator-provided safe
windows. Aggregated billing is allowed only for a confirmed shared billing meter.
Results describe a planning schedule and its energy balance.
"""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import coo_matrix


@dataclass(frozen=True)
class FlexibleTask:
    asset_id: str
    task_id: str
    power_kw: tuple[float, ...]
    baseline_start_slot: int
    safe_start_slots: tuple[int, ...]


@dataclass(frozen=True)
class Battery:
    capacity_kwh: float = 0
    initial_soc_kwh: float = 0
    max_charge_kw: float = 0
    max_discharge_kw: float = 0
    charge_efficiency: float = 0.95
    discharge_efficiency: float = 0.95
    wear_rm_per_kwh: float = 0


def optimise_township(*, baseline_load_kw, tariff_rm_per_kwh, tasks: list[FlexibleTask],
                      shared_billing_meter_confirmed: bool, input_basis: str,
                      solar_kw=None, battery: Battery = Battery(),
                      recorded_month_peak_kw: float = 0, demand_rate_rm_per_kw: float = 0,
                      feeder_limit_kw: float | None = None, reserve_kw: float = 0) -> dict:
    """30-minute scenario, with user-supplied rates and no assumed TNB penalty.

    baseline_load_kw is gross load INCLUDING every task at baseline_start_slot,
    before PV or battery. Task profiles and safe windows must be independently
    approved for comfort, cold-chain, pump and EV deadlines. A constant 30-minute
    profile does not establish the within-interval equipment ramp or safety.

    Battery finishes at its initial SOC and cannot charge and discharge together.
    PV export has zero revenue; surplus can be curtailed. Peak charge is the
    marginal modelled monthly maximum above the already recorded peak, not a
    'single-window fine'. This result cannot be used across separate TNB accounts.
    """
    if not shared_billing_meter_confirmed:
        raise ValueError('Confirm a shared billing meter before calculating pooled demand charges.')
    if input_basis not in ('measured', 'scenario'):
        raise ValueError('Declare input_basis as measured or scenario.')
    load = np.asarray(baseline_load_kw, dtype=float)
    rates = np.asarray(tariff_rm_per_kwh, dtype=float)
    if load.ndim != 1 or len(load) == 0 or load.shape != rates.shape:
        raise ValueError('Supply aligned one-dimensional half-hour load and rate arrays.')
    pv = np.zeros_like(load) if solar_kw is None else np.asarray(solar_kw, dtype=float)
    if pv.shape != load.shape or not np.isfinite([load, rates, pv]).all():
        raise ValueError('Load, PV and tariffs must be aligned and finite.')
    if (load < 0).any() or (rates < 0).any() or (pv < 0).any():
        raise ValueError('Negative loads, tariffs and PV are unsupported.')
    scalars = [recorded_month_peak_kw, demand_rate_rm_per_kw, reserve_kw,
               battery.capacity_kwh, battery.initial_soc_kwh, battery.max_charge_kw,
               battery.max_discharge_kw, battery.wear_rm_per_kwh]
    if not np.isfinite(scalars).all() or min(scalars) < 0:
        raise ValueError('Cost, battery, demand and reserve parameters must be finite and nonnegative.')
    if not 0 < battery.charge_efficiency <= 1 or not 0 < battery.discharge_efficiency <= 1:
        raise ValueError('Battery efficiencies must be in (0,1].')
    if battery.initial_soc_kwh > battery.capacity_kwh:
        raise ValueError('Initial SOC exceeds battery capacity.')
    if feeder_limit_kw is not None and (not np.isfinite(feeder_limit_kw) or feeder_limit_kw <= reserve_kw):
        raise ValueError('Feeder limit must be finite and exceed reserve.')
    n, dt = len(load), 0.5
    fixed = load.copy()
    options, task_option_indices = [], []
    if len({(t.asset_id, t.task_id) for t in tasks}) != len(tasks):
        raise ValueError('Task IDs must be unique within each asset.')
    for task in tasks:
        profile = np.asarray(task.power_kw, dtype=float)
        if profile.ndim != 1 or profile.size == 0 or not np.isfinite(profile).all() or (profile < 0).any():
            raise ValueError('Task profiles must be nonempty, finite and nonnegative.')
        starts = tuple(sorted(set(task.safe_start_slots)))
        if task.baseline_start_slot not in starts or not all(isinstance(s, int) for s in starts):
            raise ValueError('Safe integer start slots must include the baseline schedule.')
        if any(s < 0 or s + len(profile) > n for s in starts):
            raise ValueError('A task must finish inside the planning horizon.')
        fixed[task.baseline_start_slot:task.baseline_start_slot + len(profile)] -= profile
        indices = []
        for start in starts:
            vector = np.zeros(n); vector[start:start + len(profile)] = profile
            indices.append(len(options)); options.append((task, start, vector))
        task_option_indices.append(indices)
    if (fixed < -1e-6).any():
        raise ValueError('Baseline tasks exceed the supplied gross load; check double counting.')
    fixed = np.maximum(fixed, 0)
    # Variable blocks: grid, charge, discharge, SOC(n+1), mode, task options, peak.
    charge, discharge, soc, mode, option = n, 2*n, 3*n, 4*n+1, 5*n+1
    peak = option + len(options)
    size = peak + 1
    lower = np.zeros(size); upper = np.full(size, np.inf)
    upper[charge:charge+n] = battery.max_charge_kw
    upper[discharge:discharge+n] = battery.max_discharge_kw
    upper[soc:soc+n+1] = battery.capacity_kwh
    lower[soc] = upper[soc] = battery.initial_soc_kwh
    lower[soc+n] = upper[soc+n] = battery.initial_soc_kwh
    upper[mode:mode+n] = 1; upper[option:peak] = 1
    lower[peak] = recorded_month_peak_kw
    if feeder_limit_kw is not None:
        upper[:n] = feeder_limit_kw - reserve_kw
    integrality = np.zeros(size, dtype=int)
    integrality[mode:mode+n] = 1; integrality[option:peak] = 1
    objective = np.zeros(size)
    objective[:n] = rates * dt
    objective[charge:charge+n] = objective[discharge:discharge+n] = battery.wear_rm_per_kwh * dt
    objective[peak] = demand_rate_rm_per_kw
    rows, cols, data, lo, hi = [], [], [], [], []

    def constraint(coefficients, minimum=-np.inf, maximum=np.inf):
        index = len(lo)
        for col, value in coefficients.items():
            if value:
                rows.append(index); cols.append(col); data.append(value)
        lo.append(minimum); hi.append(maximum)

    for indices in task_option_indices:
        constraint({option+i: 1 for i in indices}, 1, 1)
    for t in range(n):
        row = {t: 1, charge+t: -1, discharge+t: 1}
        row.update({option+i: -vector[t] for i, (_, _, vector) in enumerate(options) if vector[t]})
        constraint(row, fixed[t] - pv[t])
        constraint({peak: 1, t: -1}, 0)
        constraint({soc+t+1: 1, soc+t: -1,
                    charge+t: -battery.charge_efficiency*dt,
                    discharge+t: dt/battery.discharge_efficiency}, 0, 0)
        constraint({charge+t: 1, mode+t: -battery.max_charge_kw}, maximum=0)
        constraint({discharge+t: 1, mode+t: battery.max_discharge_kw},
                    maximum=battery.max_discharge_kw)
    matrix = coo_matrix((data, (rows, cols)), shape=(len(lo), size)).tocsc()
    result = milp(objective, integrality=integrality, bounds=Bounds(lower, upper),
                  constraints=LinearConstraint(matrix, np.asarray(lo), np.asarray(hi)),
                  options={'time_limit': 20.0, 'mip_rel_gap': 0.0})
    if result.status != 0 or result.x is None:
        raise ValueError(f'No proven optimal feasible plan returned: {result.message}')
    x = result.x
    scheduled = fixed.copy(); selected = []
    for i, (task, start, vector) in enumerate(options):
        if x[option+i] > .5:
            scheduled += vector
            selected.append({'asset_id': task.asset_id, 'task_id': task.task_id,
                             'start_slot': start, 'power_kw': list(task.power_kw)})
    before = np.maximum(load - pv, 0)
    after = np.maximum(scheduled - pv + x[charge:charge+n] - x[discharge:discharge+n], 0)
    before_bill = float(before @ rates * dt + demand_rate_rm_per_kw * max(recorded_month_peak_kw, before.max()))
    after_bill = float(after @ rates * dt + demand_rate_rm_per_kw * max(recorded_month_peak_kw, after.max()))
    wear = float((x[charge:charge+n].sum()+x[discharge:discharge+n].sum()) * dt * battery.wear_rm_per_kwh)
    return {'status': 'offline_planning_candidate', 'input_basis': input_basis,
            'requires_human_review': True, 'selected_tasks': selected,
            'grid_before_kw': before.tolist(), 'grid_after_kw': after.tolist(),
            'battery_charge_kw': x[charge:charge+n].tolist(),
            'battery_discharge_kw': x[discharge:discharge+n].tolist(),
            'battery_soc_kwh': x[soc:soc+n+1].tolist(),
            'estimated_bill_reduction_rm': before_bill - after_bill,
            'estimated_battery_wear_rm': wear,
            'estimated_net_benefit_rm': before_bill - after_bill - wear,
            'grid_energy_before_kwh': float(before.sum()*dt),
            'grid_energy_after_kwh': float(after.sum()*dt),
            'note': 'Load shifting preserves task energy; it is not automatically energy or carbon saved.'}
