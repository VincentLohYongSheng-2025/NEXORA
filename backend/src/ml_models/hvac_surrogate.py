"""One-step temperature and power surrogate for evaluating HVAC settings.

This learns associations from BMS telemetry, not causal retrofit effects. It
cannot certify comfort or replace equipment constraints and operator review.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from .data import aware_time, numeric_frame


class HVACSurrogate:
    features = ('zone_temp_c', 'outdoor_temp_c', 'occupancy', 'setpoint_c', 'hvac_enabled')

    def __init__(self, interval_minutes: int = 30):
        if interval_minutes <= 0:
            raise ValueError('A positive telemetry interval is required.')
        self.step = pd.Timedelta(minutes=interval_minutes)
        self.model = None

    def fit(self, telemetry: pd.DataFrame, *, train_end_exclusive):
        values = numeric_frame(telemetry, self.features + ('hvac_kw',))
        if (values[['occupancy', 'hvac_kw']] < 0).any().any():
            raise ValueError('Occupancy and HVAC power must be nonnegative.')
        if not values['hvac_enabled'].isin([0, 1]).all():
            raise ValueError('hvac_enabled must be 0 or 1.')
        cutoff = aware_time(train_end_exclusive)
        # A row's action is the recorded control held during its next interval.
        next_temp = values['zone_temp_c'].reindex(values.index + self.step).to_numpy()
        pairs = values.loc[:, list(self.features)].copy()
        pairs['next_temp'] = next_temp
        pairs['power_kw'] = values['hvac_kw'].to_numpy()
        pairs = pairs.loc[pairs.index + self.step < cutoff].dropna()
        if len(pairs) < 96:
            raise ValueError('Require 96 complete pre-cutoff BMS transition pairs.')
        model = MultiOutputRegressor(HistGradientBoostingRegressor(
                    max_iter=120, max_leaf_nodes=15, early_stopping=False, random_state=42), n_jobs=1)
        model.fit(pairs[list(self.features)], pairs[['next_temp', 'power_kw']])
        self.model, self.training_end = model, cutoff
        self.minimum, self.maximum = pairs[list(self.features)].min(), pairs[list(self.features)].max()
        return self

    def predict_candidates(self, candidates: pd.DataFrame, *, comfort_min_c: float,
                           comfort_max_c: float) -> pd.DataFrame:
        """Evaluate user-supplied actions; return estimates, never commands.

        Reject inputs outside the observed training ranges. Even in-range values
        do not establish joint-distribution support or an intervention's safety.
        """
        if self.model is None or comfort_min_c >= comfort_max_c:
            raise ValueError('Fit the model and supply valid comfort bounds.')
        x = numeric_frame(candidates, self.features)
        if x.index.min() < self.training_end:
            raise ValueError('Candidate time must follow training.')
        if ((x < self.minimum) | (x > self.maximum)).any().any():
            raise ValueError('Candidate extrapolates beyond observed operating ranges.')
        predicted = self.model.predict(x)
        return pd.DataFrame({'predicted_next_temp_c': predicted[:, 0],
                             'predicted_hvac_kw': np.maximum(0, predicted[:, 1]),
                             'estimated_comfort_ok': (predicted[:, 0] >= comfort_min_c) &
                                                     (predicted[:, 0] <= comfort_max_c),
                             'requires_human_review': True}, index=x.index)
