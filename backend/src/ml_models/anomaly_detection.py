"""Contextual energy anomaly model. Unusual consumption is not a fault diagnosis."""
from __future__ import annotations

import pandas as pd
from sklearn.ensemble import IsolationForest
from .data import aware_time, calendar, numeric_frame


class EnergyAnomalyDetector:
    def __init__(self, expected_outlier_fraction: float = 0.02):
        if not 0 < expected_outlier_fraction <= 0.5:
            raise ValueError('Expected outlier fraction must be in (0,0.5].')
        self.fraction = expected_outlier_fraction
        self.model = None

    def _features(self, frame):
        values = numeric_frame(frame, self.columns)
        if (values['energy_kwh'] < 0).any():
            raise ValueError('Energy must be nonnegative.')
        cal = pd.DataFrame([calendar(t) for t in values.index], index=values.index)
        return pd.concat([values, cal], axis=1)

    def fit(self, telemetry: pd.DataFrame, *, train_end_exclusive,
            context_columns: tuple[str, ...] = ()):
        """Context (e.g. occupancy, outdoor_temp_c) must be observed at scoring time.

        Training should use a reviewed, representative operating period. The
        expected outlier fraction is an assumption, not measured alert accuracy.
        """
        self.columns = ('energy_kwh',) + context_columns
        cutoff = aware_time(train_end_exclusive)
        x = self._features(telemetry)
        x = x.loc[x.index < cutoff]
        if len(x) < 48:
            raise ValueError('At least 48 reviewed historical observations are required.')
        model = IsolationForest(n_estimators=200, contamination=self.fraction,
                                random_state=42, n_jobs=1)
        model.fit(x)
        self.model, self.training_end = model, cutoff
        return self

    def score(self, telemetry: pd.DataFrame) -> pd.DataFrame:
        if self.model is None:
            raise ValueError('Fit the offline model first.')
        if telemetry.index.min() < self.training_end:
            raise ValueError('Score a period after training for an honest evaluation.')
        x = self._features(telemetry)
        decision = self.model.decision_function(x)
        return pd.DataFrame({'unusual_energy': decision < 0,
                             'anomaly_score': -decision}, index=x.index)
