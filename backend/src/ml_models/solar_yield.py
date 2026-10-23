"""Weather-to-PV output model. Requires measured PV and weather history."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from .data import aware_time, numeric_frame


class SolarYieldModel:
    features = ('irradiance_w_m2', 'air_temp_c', 'panel_temp_c', 'solar_elevation_deg')

    def __init__(self, interval_minutes: int = 60):
        if interval_minutes <= 0:
            raise ValueError('Supply a positive observation interval.')
        self.step = pd.Timedelta(minutes=interval_minutes)
        self.model = None

    def fit(self, measured: pd.DataFrame, *, train_end_exclusive):
        values = numeric_frame(measured, self.features + ('pv_kw', 'installed_kwp'))
        if (values[['pv_kw', 'irradiance_w_m2']] < 0).any().any() or (values['installed_kwp'] <= 0).any():
            raise ValueError('PV/irradiance must be nonnegative; nameplate capacity must be positive.')
        cutoff = aware_time(train_end_exclusive)
        values = values.loc[values.index + self.step <= cutoff]
        if len(values) < 96:
            raise ValueError('Require at least 96 aligned PV/weather intervals.')
        model = HistGradientBoostingRegressor(max_iter=150, max_leaf_nodes=15,
                    early_stopping=False, random_state=42)
        model.fit(values[list(self.features)], values['pv_kw'] / values['installed_kwp'])
        self.model, self.training_end = model, cutoff
        return self

    def forecast(self, weather_forecast: pd.DataFrame, *, origin, installed_kwp: float) -> pd.DataFrame:
        """Use issued forecasts, never realised future weather in a backtest.

        The caller must supply forecast panel temperature as well; no weather
        providers or current prototype settings are read by this module.
        """
        if self.model is None or installed_kwp <= 0:
            raise ValueError('Fit the model and supply positive capacity.')
        start = aware_time(origin)
        if start < self.training_end:
            raise ValueError('Origin precedes training cutoff.')
        x = numeric_frame(weather_forecast, self.features)
        if x.index.min() < start or 'issued_at' not in weather_forecast:
            raise ValueError('Future weather rows must include issued_at.')
        issued = weather_forecast['issued_at'].map(aware_time)
        if issued.isna().any() or (issued > start).any():
            raise ValueError('Weather forecast was not available at the prediction origin.')
        if (x['irradiance_w_m2'] < 0).any():
            raise ValueError('Negative irradiance is invalid.')
        kw = np.clip(self.model.predict(x), 0, 1) * installed_kwp
        kw[(x['irradiance_w_m2'] <= 0) | (x['solar_elevation_deg'] <= 0)] = 0
        return pd.DataFrame({'predicted_pv_kw': kw}, index=x.index)
