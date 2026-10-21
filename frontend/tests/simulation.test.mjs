import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runMicrogridScenario,
  runPeakShiftScenario,
  suggestedShiftHours,
} from '../src/js/simulation_engine.js';

test('microgrid simulation is deterministic and keeps measured claims out of its outputs', () => {
  const forecast = Array.from({ length: 24 }, (_, hour) => 130 + Math.max(0, 80 - Math.abs(12 - hour) * 10));
  const assumptions = {
    solarCapacityKw: 90,
    batteryCapacityKwh: 180,
    batteryPowerKw: 50,
    startingSocPercent: 50,
    gridPriceMyrPerKwh: '',
  };
  const first = runMicrogridScenario(forecast, assumptions);
  const second = runMicrogridScenario(forecast, assumptions);

  assert.deepEqual(first, second);
  assert.equal(first.baseline.length, 24);
  assert.equal(first.simulated.length, 24);
  assert.ok(first.simulated.every((value) => value >= 0));
  assert.ok(first.estimatedPeakReductionKw >= 0);
  assert.ok(first.solarUsedKwh > 0);
  assert.equal(first.priceEstimate, null);
});

test('financial output appears only for an explicit user-entered price', () => {
  const result = runMicrogridScenario(Array(24).fill(100), {
    solarCapacityKw: 40,
    batteryCapacityKwh: 0,
    batteryPowerKw: 0,
    startingSocPercent: 0,
    gridPriceMyrPerKwh: 0.5,
  });
  assert.ok(result.priceEstimate);
  assert.equal(result.priceEstimate.baselineCostMyr, 1200);
  assert.ok(result.priceEstimate.illustrativeDifferenceMyr > 0);
});

test('peak shifting conserves energy and reports the deterministic peak change', () => {
  const forecast = Array(24).fill(100);
  forecast[10] = 200;
  forecast[2] = 50;
  const result = runPeakShiftScenario(forecast, {
    flexibleLoadKwh: 40,
    fromHour: 10,
    toHour: 2,
  });
  assert.equal(result.shiftedKwh, 40);
  assert.equal(result.simulated[10], 160);
  assert.equal(result.simulated[2], 90);
  assert.equal(result.estimatedPeakReductionKw, 40);
  assert.equal(result.energyBalanceKwh, 0);
  assert.deepEqual(suggestedShiftHours(forecast), { fromHour: 10, toHour: 2 });
});

test('simulation rejects incomplete forecasts and invalid shift intervals', () => {
  assert.throws(() => runMicrogridScenario([1, 2], {}), /24-value hourly forecast/);
  assert.throws(() => runPeakShiftScenario(Array(24).fill(10), {
    flexibleLoadKwh: 2,
    fromHour: 3,
    toHour: 3,
  }), /different hour/);
});
