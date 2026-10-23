"""Direct 24-hour gradient-boosted demand model.

One model per asset. Synthetic facility profiles must never be treated as
independent measured buildings or evidence of cross-building generalisation.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from .data import aware_time, calendar, interval_series, past_features


class DemandForecaster:
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.models = {}
        self.training_end = None
        self.feature_names = None

    def fit(self, assets: dict[str, pd.Series], *, train_end_exclusive):
        """Explicit training call only. targets are hourly interval energy, kWh.

        Train labels must finish by the cutoff. Each direct horizon uses only
        pre-origin history and known calendar features, not future observations.
        Internal random early-stopping validation is disabled for time series.
        """
        cutoff = aware_time(train_end_exclusive)
        models = {}
        for asset_id, observations in assets.items():
            series = interval_series(observations, 60)
            features, labels = [], []
            for origin in series.index:
                if origin + pd.Timedelta(hours=24) > cutoff:
                    continue
                past = past_features(series, origin, 60)
                if past is None:
                    continue
                targets = series.reindex(pd.date_range(origin, periods=24, freq='h'))
                if targets.isna().any():
                    continue
                for horizon, (timestamp, energy) in enumerate(targets.items()):
                    features.append({**past, **calendar(timestamp), 'horizon': horizon})
                    labels.append(float(energy))
            if len(labels) < 96:
                raise ValueError(f'{asset_id}: insufficient complete training windows.')
            x = pd.DataFrame(features)
            model = HistGradientBoostingRegressor(
                max_iter=150, max_leaf_nodes=15, min_samples_leaf=20,
                learning_rate=0.05, l2_regularization=1.0,
                early_stopping=False, random_state=self.seed)
            model.fit(x, labels)
            models[asset_id] = model
            self.feature_names = list(x.columns)
        if not models:
            raise ValueError('Supply at least one measured asset.')
        self.models, self.training_end = models, cutoff
        return self

    def predict(self, asset_id: str, observations: pd.Series, *, origin) -> pd.DataFrame:
        if asset_id not in self.models:
            raise ValueError('This asset has not been fitted.')
        start = aware_time(origin).tz_convert(observations.index.tz)
        if start < self.training_end:
            raise ValueError('Prediction origin must not precede the training cutoff.')
        series = interval_series(observations, 60)
        past = past_features(series, start, 60)
        if past is None:
            raise ValueError('A complete preceding day is required.')
        times = pd.date_range(start, periods=24, freq='h')
        x = pd.DataFrame([{**past, **calendar(t), 'horizon': h} for h, t in enumerate(times)])
        values = np.maximum(0.0, self.models[asset_id].predict(x[self.feature_names]))
        return pd.DataFrame({'forecast_kwh': values}, index=times)


def aggregate_township(forecasts: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Aligned forecast sum only, not proof of common metering or shared supply."""
    if not forecasts:
        raise ValueError('No asset forecasts supplied.')
    frames = list(forecasts.values())
    if any(not frame.index.equals(frames[0].index) for frame in frames[1:]):
        raise ValueError('All asset horizons must align exactly.')
    return pd.DataFrame({'forecast_kwh': sum(f['forecast_kwh'] for f in frames)})
