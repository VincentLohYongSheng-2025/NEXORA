"""Licensed CLEMD hourly reference and explicitly synthetic township derivatives.

Only complete 3,600-second hours are packaged. Calendar gaps stay absent.
The numerical seasonal forecaster is reused without changing BDG2 import gates.
"""
from collections import defaultdict
from copy import deepcopy
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
from statistics import fmean
from uuid import NAMESPACE_URL, uuid5

from .bdg2_analytics import Point, SeasonalProfile, forecast_24

ROOT = Path(__file__).resolve().parents[1] / 'data'
AUDIT = json.loads((ROOT / 'clemd-provenance.json').read_text())
content = (ROOT / 'clemd-hourly.csv').read_bytes()
if hashlib.sha256(content).hexdigest() != AUDIT['hourly_csv_sha256']:
    raise ValueError('CLEMD normalized input hash differs from the audited export')
POINTS = [Point(datetime.fromisoformat(r['timestamp_local']), float(r['energy_kwh']))
          for r in csv.DictReader(content.decode().splitlines())]
if len(POINTS) != 696 or len({p.timestamp for p in POINTS}) != len(POINTS):
    raise ValueError('CLEMD export must contain 696 distinct audited complete hours')
PROVENANCE = dict(kind='public_benchmark', source_code='clemd_v1', source_title='CLEMD — Malaysia',
                  source_version='2023 audited hourly subset', doi=AUDIT['collection_doi'],
                  licence='CC BY 4.0', label='CLEMD Malaysian institutional-building benchmark')
SOURCE = dict(id=str(uuid5(NAMESPACE_URL, 'nexora:clemd:upnm')), name='UPNM institutional reference',
              source_asset_id='CLEMD_UPNM', timezone='Asia/Kuala_Lumpur', floor_area_m2=None,
              asset_type='Education', primary_space_usage='Education', scope='whole_building',
              provenance=PROVENANCE)
# Areas and annual intensity targets are design assumptions, not source metadata.
# Six different schedules retain source variability while representing distinct uses.
SPECS = {
 'mall': dict(area=6600, bei=220, hvac=52, pv=180, battery=250, power=100, opened=10, closed=22, base=.35, weekend=1.1),
 'hospital': dict(area=7000, bei=260, hvac=55, pv=160, battery=250, power=100, opened=7, closed=22, base=.8, weekend=.95),
 'restaurant': dict(area=450, bei=320, hvac=32, pv=24, battery=30, power=15, opened=10, closed=23, base=.3, weekend=1.1),
 'commercial': dict(area=8580, bei=180, hvac=50, pv=108, battery=250, power=100, opened=8, closed=18, base=.35, weekend=.55),
 'residential': dict(area=6720, bei=100, hvac=38, pv=132.6, battery=200, power=80, opened=17, closed=24, base=.65, weekend=1.05),
 'solar': dict(area=None, bei=None, hvac=0, pv=1000, battery=500, power=250, opened=7, closed=19, base=.7, weekend=1),
}

def stamp(t): return t.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
def local(t): return t.replace(tzinfo=None).isoformat()

def fit_profile(points, end):
    """Unsupported weekdays fall back to the same local hour on prior days.

    CLEMD's aggregate gaps recur on Wednesdays. An overall scalar fallback
    would otherwise produce a flat next-Wednesday forecast. No missing
    readings are created; this fallback is used for predictions only.
    """
    week=defaultdict(list); hours=defaultdict(list); values=[]
    for p in points:
        if p.timestamp < end:
            week[p.timestamp.weekday()*24+p.timestamp.hour].append(p.value)
            hours[p.timestamp.hour].append(p.value);values.append(p.value)
    mean=fmean(values)
    return SeasonalProfile(tuple(fmean(week[i]) if week[i] else fmean(hours[i%24]) if hours[i%24] else mean for i in range(168)), mean)

TRAIN_END = datetime.fromisoformat(AUDIT['evaluation']['train_end_exclusive'])
TEST_START = datetime.fromisoformat(AUDIT['evaluation']['validation_end_exclusive'])
END = POINTS[-1].timestamp + timedelta(hours=1)
history = {p.timestamp:p.value for p in POINTS}
fixed = fit_profile(POINTS, TEST_START)
rolling = []
for offset in range(7):
    origin = END - timedelta(days=7-offset)
    values = forecast_24(fixed, {t:v for t,v in history.items() if t < origin}, origin)
    rolling.extend(dict(timestamp=stamp(origin+timedelta(hours=i)), source_local_timestamp=local(origin+timedelta(hours=i)),
                        forecast_origin=stamp(origin), forecast_kwh=v) for i,v in enumerate(values))
next_values = forecast_24(fit_profile(POINTS, END), history, END)
FORECAST = dict(unit='kWh', provenance=PROVENANCE, method='CLEMD seasonal hour-of-week; prior-hour-of-day fallback for unsupported weekdays; residual correction',
                items=[dict(timestamp=stamp(END+timedelta(hours=i)), forecast_kwh=v) for i,v in enumerate(next_values)],
                test_metrics=dict(model=AUDIT['evaluation']['model'], baseline=AUDIT['evaluation']['previous_day_baseline']),
                limitations=[AUDIT['evaluation']['note'], 'One institutional source; synthetic facility accuracy has not been validated.'])
READINGS = [dict(timestamp=stamp(p.timestamp), source_local_timestamp=local(p.timestamp), consumption_kwh=p.value,
                 label='observed', quality_status='complete_hour') for p in POINTS]
SNAPSHOT = dict(fetched_at='2026-10-22T00:00:00Z', assets=dict(items=[SOURCE]),
                buildings={'CLEMD_UPNM':dict(readings=dict(items=READINGS), forecast=FORECAST,
                                           anomalies=dict(items=[],count=0))})
HISTORY_FORECASTS = dict(model_version='clemd_seasonal_v1', description='Frozen pre-test seasonal profile with only prior residuals at each daily origin.',
    buildings={'CLEMD_UPNM':dict(items=rolling, training_end_exclusive=stamp(TEST_START),seasonal_weight=1.0)})

def schedule(facility,t):
    s=SPECS[facility]
    active=s['opened'] <= t.hour < s['closed']
    return (1 if active else s['base']) * (s['weekend'] if t.weekday() >= 5 else 1)

def multiplier(facility):
    s=SPECS[facility]
    days=defaultdict(list)
    for p in POINTS:
        if p.timestamp < TRAIN_END: days[p.timestamp.date()].append(p)
    mean=fmean(sum(p.value*schedule(facility,p.timestamp) for p in rows) for rows in days.values() if len(rows)==24)
    target=40 if facility=='solar' else s['area']*s['bei']/365
    return target/mean

def derivative(asset,bundle):
    result=deepcopy(bundle)
    for series,key in [(result['readings']['items'],'consumption_kwh'),(result['forecast']['items'],'forecast_kwh')]:
        for row in series:
            t=datetime.fromisoformat(row['timestamp'].replace('Z','+00:00')).astimezone(POINTS[0].timestamp.tzinfo)
            row[key]*=asset['demo_basis']['load_multiplier']*schedule(asset['facility_id'],t)
            row['label']='simulated_facility_profile'
    return result
