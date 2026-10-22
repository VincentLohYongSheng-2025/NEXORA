# Seven-day benchmark / forecast comparison

The orange series sums the selected building's hourly benchmark readings by source-local date. The green dotted series sums historical 24-hour forecasts for exactly those same dates. It is a historical backtest comparison, distinct from the future next-day forecast KPI.

The existing `bdg2_seasonal_baseline_blend_v1` method is reused: an hour-of-week seasonal profile with trailing-24-hour residual correction, blended with the previous day's same-hour reading. The blend is chosen on validation data. The historical comparison fits its profile before the test period; each rolling forecast origin uses only prior observations. Daily totals are aggregated after hourly prediction. The generator verifies that reproduced held-out MAE and RMSE match the frozen application's saved model metrics and that displayed benchmark readings match the verified source cohort.

`backend/bdg2_history_forecasts.json` contains 168 hourly predictions for each of the four benchmark sources, with model version, source hash, training cutoff and forecast origins. Regenerate from the verified local cohort using:

```powershell
cd backend
python scripts/build_history_forecasts.py
```

Township facilities apply the same existing illustrative load multiplier to benchmark and forecast series. Estimated costs and emissions multiply both series by the same configured tariff or emission factor. These remain benchmark-derived facility estimates; the comparison does not establish current facility forecast accuracy.

Source: Building Data Genome Project 2 v1.0, CC BY 4.0. The 24-hour chart continues to compare the latest reference day's hourly profile with the following day's saved forecast.
