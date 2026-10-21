export const SIMULATED_SOLAR_PROFILE = Object.freeze([
  0, 0, 0, 0, 0, 0.02, 0.12, 0.30, 0.52, 0.72, 0.88, 0.98,
  1.00, 0.94, 0.80, 0.60, 0.36, 0.14, 0.03, 0, 0, 0, 0, 0,
]);

function finiteNonNegative(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new TypeError(`${name} must be a non-negative number.`);
  }
  return number;
}

function hourlyForecast(values) {
  if (!Array.isArray(values) || values.length !== 24) {
    throw new TypeError('A 24-value hourly forecast is required.');
  }
  return values.map((value, index) => finiteNonNegative(value, `forecast[${index}]`));
}

export function runMicrogridScenario(forecastValues, assumptions) {
  const baseline = hourlyForecast(forecastValues);
  const solarCapacityKw = finiteNonNegative(assumptions.solarCapacityKw, 'solarCapacityKw');
  const batteryCapacityKwh = finiteNonNegative(assumptions.batteryCapacityKwh, 'batteryCapacityKwh');
  const batteryPowerKw = finiteNonNegative(assumptions.batteryPowerKw, 'batteryPowerKw');
  const startingSocPercent = Math.min(100, finiteNonNegative(assumptions.startingSocPercent, 'startingSocPercent'));
  const gridPrice = assumptions.gridPriceMyrPerKwh === '' || assumptions.gridPriceMyrPerKwh == null
    ? null
    : finiteNonNegative(assumptions.gridPriceMyrPerKwh, 'gridPriceMyrPerKwh');

  const solar = SIMULATED_SOLAR_PROFILE.map((factor) => solarCapacityKw * factor);
  const baselinePeakKw = Math.max(...baseline);
  const shaveTargetKw = baselinePeakKw * 0.85;
  let storedKwh = batteryCapacityKwh * (startingSocPercent / 100);
  let solarUsedKwh = 0;
  let solarSurplusKwh = 0;
  let batteryDischargedKwh = 0;
  let batteryChargedKwh = 0;

  const simulated = baseline.map((demandKwh, hour) => {
    const availableSolarKwh = solar[hour];
    const directSolarKwh = Math.min(demandKwh, availableSolarKwh);
    const surplusKwh = Math.max(0, availableSolarKwh - directSolarKwh);
    const chargeKwh = Math.min(surplusKwh, batteryPowerKw, Math.max(0, batteryCapacityKwh - storedKwh));
    storedKwh += chargeKwh;

    const demandAfterSolarKwh = Math.max(0, demandKwh - directSolarKwh);
    const dischargeKwh = Math.min(
      Math.max(0, demandAfterSolarKwh - shaveTargetKw),
      batteryPowerKw,
      storedKwh,
    );
    storedKwh -= dischargeKwh;
    solarUsedKwh += directSolarKwh + chargeKwh;
    solarSurplusKwh += surplusKwh - chargeKwh;
    batteryChargedKwh += chargeKwh;
    batteryDischargedKwh += dischargeKwh;

    return Math.max(0, demandAfterSolarKwh - dischargeKwh);
  });

  const simulatedPeakKw = Math.max(...simulated);
  const baselineEnergyKwh = baseline.reduce((sum, value) => sum + value, 0);
  const simulatedGridEnergyKwh = simulated.reduce((sum, value) => sum + value, 0);
  const priceEstimate = gridPrice == null ? null : {
    baselineCostMyr: baselineEnergyKwh * gridPrice,
    simulatedCostMyr: simulatedGridEnergyKwh * gridPrice,
    illustrativeDifferenceMyr: (baselineEnergyKwh - simulatedGridEnergyKwh) * gridPrice,
  };

  return {
    baseline,
    solar,
    simulated,
    baselinePeakKw,
    simulatedPeakKw,
    estimatedPeakReductionKw: Math.max(0, baselinePeakKw - simulatedPeakKw),
    baselineEnergyKwh,
    simulatedGridEnergyKwh,
    solarUsedKwh,
    solarSurplusKwh,
    batteryChargedKwh,
    batteryDischargedKwh,
    endingSocPercent: batteryCapacityKwh === 0 ? 0 : (storedKwh / batteryCapacityKwh) * 100,
    priceEstimate,
  };
}

export function runPeakShiftScenario(forecastValues, assumptions) {
  const baseline = hourlyForecast(forecastValues);
  const requestedLoadKwh = finiteNonNegative(assumptions.flexibleLoadKwh, 'flexibleLoadKwh');
  const fromHour = Number.parseInt(assumptions.fromHour, 10);
  const toHour = Number.parseInt(assumptions.toHour, 10);
  if (!Number.isInteger(fromHour) || fromHour < 0 || fromHour > 23) {
    throw new RangeError('fromHour must be between 0 and 23.');
  }
  if (!Number.isInteger(toHour) || toHour < 0 || toHour > 23 || toHour === fromHour) {
    throw new RangeError('toHour must be a different hour between 0 and 23.');
  }

  const shiftedKwh = Math.min(requestedLoadKwh, baseline[fromHour]);
  const simulated = [...baseline];
  simulated[fromHour] -= shiftedKwh;
  simulated[toHour] += shiftedKwh;
  const baselinePeakKw = Math.max(...baseline);
  const simulatedPeakKw = Math.max(...simulated);

  return {
    baseline,
    simulated,
    requestedLoadKwh,
    shiftedKwh,
    fromHour,
    toHour,
    baselinePeakKw,
    simulatedPeakKw,
    estimatedPeakReductionKw: baselinePeakKw - simulatedPeakKw,
    energyBalanceKwh: simulated.reduce((sum, value) => sum + value, 0)
      - baseline.reduce((sum, value) => sum + value, 0),
  };
}

export function suggestedShiftHours(forecastValues) {
  const values = hourlyForecast(forecastValues);
  const fromHour = values.indexOf(Math.max(...values));
  const candidates = values.map((value, hour) => ({ value, hour })).filter(({ hour }) => hour !== fromHour);
  const toHour = candidates.reduce((lowest, item) => item.value < lowest.value ? item : lowest).hour;
  return { fromHour, toHour };
}
