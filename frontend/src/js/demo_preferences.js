export const PREFERENCE_KEY = 'ENERGIOS_DEMO_PREFERENCES';

const optionalNumber = value => value === '' || value == null ? null : Number(value);

export function normalizePreferences(value = {}) {
  return {
    defaultAssetId: value.defaultAssetId || '',
    currency_code: String(value.currency_code || '').trim().toUpperCase(),
    tariff_myr_per_kwh: optionalNumber(value.tariff_myr_per_kwh),
    carbon_kg_per_kwh: optionalNumber(value.carbon_kg_per_kwh),
    tariff_source: String(value.tariff_source || value.assumption_reference || '').trim(),
    carbon_source: String(value.carbon_source || value.assumption_reference || '').trim(),
    assumption_reference: String(value.assumption_reference || '').trim(),
    capex_myr: optionalNumber(value.capex_myr),
    annual_energy_reduction_kwh: optionalNumber(value.annual_energy_reduction_kwh),
    annual_maintenance_myr: optionalNumber(value.annual_maintenance_myr),
    aiPanelVisible: value.aiPanelVisible !== false,
    notificationBadges: value.notificationBadges !== false,
    anomalyDisplay: ['all', 'medium', 'large'].includes(value.anomalyDisplay) ? value.anomalyDisplay : 'all',
    assistantMode: ['advisory_demo', 'on_demand'].includes(value.assistantMode) ? value.assistantMode : 'on_demand',
    refreshPreview: ['10s', '30s', '1m'].includes(value.refreshPreview) ? value.refreshPreview : '30s',
    scenarioSuggestions: value.scenarioSuggestions === true,
    emailDigestPreview: value.emailDigestPreview === true,
    webhookPreview: value.webhookPreview === true,
    benchmarkOverlay: value.benchmarkOverlay === true,
  };
}

export function loadPreferences(storage = localStorage) {
  try { return normalizePreferences(JSON.parse(storage.getItem(PREFERENCE_KEY) || '{}')); }
  catch { return normalizePreferences(); }
}

export function validatePreferences(value) {
  const preferences = normalizePreferences(value);
  const errors = [];
  for (const [name, number] of Object.entries(preferences)) {
    if (typeof number === 'number' && (!Number.isFinite(number) || number < 0)) errors.push(`${name} must be a finite non-negative number`);
  }
  if (preferences.tariff_myr_per_kwh != null) {
    if (preferences.currency_code !== 'MYR') errors.push('The current tariff calculation requires currency MYR');
    if (!preferences.tariff_source) errors.push('Disclose the tariff source or enter User assumption');
  }
  if (preferences.carbon_kg_per_kwh != null && !preferences.carbon_source) errors.push('Disclose the carbon-factor source or enter User assumption');
  return {preferences, errors};
}

export function savePreferences(value, storage = localStorage) {
  const result = validatePreferences(value);
  if (result.errors.length) return result;
  storage.setItem(PREFERENCE_KEY, JSON.stringify(result.preferences));
  return result;
}

export function resetPreferences(storage = localStorage) {
  storage.removeItem(PREFERENCE_KEY);
  return normalizePreferences();
}

export function estimateImpact(energyKwh, value) {
  const {preferences, errors} = validatePreferences(value);
  if (!Number.isFinite(energyKwh) || energyKwh < 0) errors.push('Observed energy must be a finite non-negative number');
  return {
    errors,
    energy_kwh: energyKwh,
    cost: errors.length || preferences.tariff_myr_per_kwh == null ? null : energyKwh * preferences.tariff_myr_per_kwh,
    carbon: errors.length || preferences.carbon_kg_per_kwh == null ? null : energyKwh * preferences.carbon_kg_per_kwh,
    currency: preferences.currency_code,
    preferences,
  };
}

export function filterDetectedPatterns(items = [], mode = 'all') {
  if (mode === 'all') return [...items];
  const threshold = mode === 'large' ? 0.5 : 0.25;
  return items.filter(item => {
    const basis = Math.abs(Number(item.forecast_kwh));
    return basis > 0 && Math.abs(Number(item.residual_kwh)) / basis >= threshold;
  });
}
