"""Two-hour risk model for observed 30-minute mean demand at one meter."""
from __future__ import annotations

import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier

from .data import aware_time, calendar, interval_series, past_features


class PeakRiskModel:
    def __init__(self, threshold_kw: float, alert_probability: float = 0.7):
        if threshold_kw <= 0 or not 0 < alert_probability < 1:
            raise ValueError('Supply a positive meter threshold and probability in (0,1).')
        self.threshold_kw = threshold_kw
        self.alert_probability = alert_probability
        self.model = None

    def fit(self, measured_halfhour_kw: pd.Series, *, train_end_exclusive):
        """Label: any of the next four 30-minute averages exceeds the threshold.

        Supply actual interval-average kW; never split hourly CLEMD into invented
        half-hour readings. Threshold is a user-supplied operating/billing input.
        """
        series = interval_series(measured_halfhour_kw, 30)
        cutoff = aware_time(train_end_exclusive)
        x, y = [], []
        for origin in series.index:
            if origin + pd.Timedelta(hours=2) > cutoff:
                continue
            past = past_features(series, origin, 30)
            future = series.reindex(pd.date_range(origin, periods=4, freq='30min'))
            if past is None or future.isna().any():
                continue
            x.append({**past, **calendar(origin)})
            y.append(int(future.max() > self.threshold_kw))
        if len(y) < 96 or len(set(y)) < 2:
            raise ValueError('Require sufficient pre-cutoff examples of BOTH peak and non-peak windows.')
        model = HistGradientBoostingClassifier(max_iter=120, max_leaf_nodes=15,
                    min_samples_leaf=20, early_stopping=False, random_state=42)
        model.fit(pd.DataFrame(x), y)
        self.model, self.training_end = model, cutoff
        return self

    def predict(self, measured_halfhour_kw: pd.Series, *, origin) -> dict:
        if self.model is None:
            raise ValueError('Fit the offline model first.')
        start = aware_time(origin).tz_convert(measured_halfhour_kw.index.tz)
        if start < self.training_end:
            raise ValueError('Origin precedes the training cutoff.')
        past = past_features(interval_series(measured_halfhour_kw, 30), start, 30)
        if past is None:
            raise ValueError('Missing preceding-day telemetry.')
        score = float(self.model.predict_proba(pd.DataFrame([{**past, **calendar(start)}]))[0, 1])
        return {'risk_score': score, 'alert': score >= self.alert_probability,
                'threshold_kw': self.threshold_kw, 'horizon_hours': 2,
                'status': 'unvalidated_offline_prediction',
                'note': 'Score is not a calibrated probability or a TNB penalty calculation.'}
