"""Isolated checks only: synthetic fixtures, no model training or app imports.

Run explicitly from backend/ in a research environment:
    python -B -m unittest discover -s src/ml_models/tests -v
"""
from __future__ import annotations

import importlib
import unittest
import numpy as np
import pandas as pd

from src.ml_models.data import past_features
from src.ml_models.evaluation import chronological_slices
from src.ml_models.township_optimizer import Battery, FlexibleTask, optimise_township


class OfflineContracts(unittest.TestCase):
    def test_modules_import_without_training(self):
        for name in ('demand_forecast', 'peak_risk', 'anomaly_detection',
                     'hvac_surrogate', 'solar_yield'):
            importlib.import_module('src.ml_models.' + name)

    def test_features_exclude_future_and_missing_history(self):
        times = pd.date_range('2026-01-01', periods=72, freq='h', tz='Asia/Kuala_Lumpur')
        observations = pd.Series(np.arange(72, dtype=float), index=times)
        origin = times[48]
        before = past_features(observations, origin, 60)
        observations.loc[observations.index >= origin] = 99999
        self.assertEqual(before, past_features(observations, origin, 60))
        self.assertEqual(before['last'], 47)
        self.assertEqual(before['mean_day'], 35.5)
        observations = observations.drop(times[47])
        self.assertIsNone(past_features(observations, origin, 60))

    def test_horizons_do_not_cross_split_boundaries(self):
        times = pd.date_range('2026-01-01', periods=96, freq='h', tz='Asia/Kuala_Lumpur')
        parts = chronological_slices(times, train_end=times[24], validation_end=times[72])
        self.assertTrue((parts['train'] + pd.Timedelta(hours=24) <= times[24]).all())
        self.assertTrue((parts['validation'] >= times[24]).all())
        self.assertTrue((parts['validation'] + pd.Timedelta(hours=24) <= times[72]).all())
        self.assertTrue((parts['test'] >= times[72]).all())

    def test_shift_preserves_task_energy(self):
        result = optimise_township(baseline_load_kw=[6, 1], tariff_rm_per_kwh=[1, .1],
            tasks=[FlexibleTask('site', 'pump', (5,), 0, (0, 1))],
            shared_billing_meter_confirmed=True, input_basis='scenario')
        self.assertEqual(result['selected_tasks'][0]['start_slot'], 1)
        self.assertAlmostEqual(result['estimated_bill_reduction_rm'], 2.25)
        self.assertAlmostEqual(result['grid_energy_before_kwh'], result['grid_energy_after_kwh'])

    def test_battery_recovers_and_has_exclusive_modes(self):
        result = optimise_township(baseline_load_kw=[10, 2], tariff_rm_per_kwh=[1, .1],
            tasks=[], battery=Battery(4, 2, 4, 4, 1, 1),
            shared_billing_meter_confirmed=True, input_basis='scenario')
        self.assertAlmostEqual(result['battery_soc_kwh'][0], result['battery_soc_kwh'][-1])
        np.testing.assert_allclose(result['grid_after_kw'], [6, 6], atol=1e-5)
        self.assertFalse(any(c > 1e-6 and d > 1e-6 for c, d in
                         zip(result['battery_charge_kw'], result['battery_discharge_kw'])))

    def test_separate_meters_and_infeasible_capacity_rejected(self):
        with self.assertRaises(ValueError):
            optimise_township(baseline_load_kw=[1], tariff_rm_per_kwh=[1], tasks=[],
                             shared_billing_meter_confirmed=False, input_basis='scenario')
        with self.assertRaises(ValueError):
            optimise_township(baseline_load_kw=[10], tariff_rm_per_kwh=[1], tasks=[],
                             shared_billing_meter_confirmed=True, input_basis='scenario',
                             feeder_limit_kw=5)


if __name__ == '__main__':
    unittest.main()
