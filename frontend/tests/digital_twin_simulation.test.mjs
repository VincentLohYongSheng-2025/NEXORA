import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFloorPreview,
  calculateHvacPreview,
  createDrawerSimulation,
} from '../src/js/digital_twin_simulation.js';

test('HVAC preview is deterministic, balanced and uses only declared assumptions', () => {
  const assumptions = createDrawerSimulation().hvac;
  const first = calculateHvacPreview(200, assumptions);
  const second = calculateHvacPreview(200, assumptions);
  assert.deepEqual(first, second);
  assert.equal(first.label, 'simulated');
  assert.equal(first.simulatedHvacKwh, 70);
  assert.equal(first.simulatedOtherKwh, 130);
  assert.equal(first.energyBalanceKwh, 0);
  assert.equal(first.setpointC, 23);
  assert.equal(first.fanCommandPercent, 60);
});

test('changing local HVAC assumptions updates the preview without claiming savings', () => {
  const inputs = {...createDrawerSimulation().hvac, allocationPercent: 50, setpointC: 24.5, enabled: false};
  const result = calculateHvacPreview(180, inputs);
  assert.equal(result.simulatedHvacKwh, 0);
  assert.equal(result.simulatedOtherKwh, 180);
  assert.equal(result.setpointC, 24.5);
  assert.equal(result.enabled, false);
  assert.equal('savings' in result, false);
});

test('floor simulation reconciles valid allocations to observed whole-building energy', () => {
  const floors = createDrawerSimulation().floors;
  const result = calculateFloorPreview(150, floors);
  assert.equal(result.valid, true);
  assert.equal(result.totalPercent, 100);
  assert.equal(result.allocatedTotalKwh, 150);
  assert.deepEqual(result.rows.map(row => row.simulatedKwh), [51, 49.5, 49.5]);
  assert.ok(result.rows.every(row => row.simulatedKwh !== null));
});

test('invalid floor percentages stay not calculated instead of fabricating a total', () => {
  const floors = createDrawerSimulation().floors.map((floor, index) => ({
    ...floor,
    allocationPercent: index === 0 ? 50 : floor.allocationPercent,
  }));
  const result = calculateFloorPreview(150, floors);
  assert.equal(result.valid, false);
  assert.equal(result.totalPercent, 116);
  assert.equal(result.allocatedTotalKwh, null);
  assert.ok(result.rows.every(row => row.simulatedKwh === null));
});

test('simulation bounds reject invalid equipment and floor assumptions', () => {
  assert.throws(() => calculateHvacPreview(100, {...createDrawerSimulation().hvac, fanCommandPercent: 101}), /between 0 and 100/);
  assert.throws(() => calculateFloorPreview(100, [{id: 'g', label: 'Ground', allocationPercent: -1}]), /between 0 and 100/);
});
