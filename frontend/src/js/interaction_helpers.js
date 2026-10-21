const normalize = (value) => String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export function filterAssetsForSearch(assets, query) {
  const needle = normalize(query);
  if (!needle) return [...assets];
  return assets.filter((asset) => normalize([asset.source_asset_id, asset.name, asset.primary_space_usage].join(' ')).includes(needle));
}

export function buildEnergyScenarioExport(asset, forecast, anomalies, microgrid, peakShift) {
  if (!asset || !forecast?.items?.length || !microgrid?.items?.length || !peakShift?.items?.length) throw new Error('Complete selected-building scenario evidence is required before export.');
  return {
    export_label: 'EnergiOS labelled scenario export', exported_at_utc: new Date().toISOString(),
    asset: {id: asset.id, source_asset_id: asset.source_asset_id, timezone: asset.timezone, provenance: asset.provenance},
    classifications: {source_history:'observed_public_benchmark_bdg2_v1',forecast:'calculated_output',anomalies:'detected_unusual_consumption_pattern',microgrid:'simulated_user_assumptions',peak_shift:'simulated_user_assumptions'},
    calculated_forecast: forecast, detected_unusual_patterns: anomalies, simulated_microgrid: microgrid, simulated_peak_shift: peakShift,
    citation: {dataset:'Building Data Genome Project 2 v1.0',doi:'https://doi.org/10.5281/zenodo.3887306',licence:'CC BY 4.0'},
    limitations: ['BDG2 is public benchmark data and is not Sime Darby Property or Elmina telemetry.','Solar, battery, price and load-shift values are simulated assumptions, not measurements or control actions.','Unusual-consumption-pattern detections do not establish a cause.','No verified savings, applicable tariff or official carbon factor is asserted.'],
  };
}
