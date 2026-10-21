const numberInRange = (value, minimum, maximum, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

export function createDrawerSimulation() {
  return {
    hvac: {
      enabled: true,
      allocationPercent: 35,
      setpointC: 23,
      fanCommandPercent: 60,
      mode: 'comfort',
    },
    floors: [
      { id: 'ground', label: 'Ground', allocationPercent: 34 },
      { id: 'level-1', label: 'Level 1', allocationPercent: 33 },
      { id: 'roof', label: 'Roof', allocationPercent: 33 },
    ],
  };
}

export function calculateHvacPreview(observedKwh, inputs) {
  const observed = numberInRange(observedKwh, 0, Number.MAX_SAFE_INTEGER, 'Observed interval energy');
  const allocation = numberInRange(inputs.allocationPercent, 0, 100, 'HVAC allocation');
  const setpoint = numberInRange(inputs.setpointC, 16, 30, 'Cooling setpoint');
  const fan = numberInRange(inputs.fanCommandPercent, 0, 100, 'Fan command');
  if (!['comfort', 'eco', 'test'].includes(inputs.mode)) throw new RangeError('Mode is not supported.');
  const enabled = Boolean(inputs.enabled);
  const simulatedHvacKwh = enabled ? observed * allocation / 100 : 0;
  return {
    enabled,
    mode: inputs.mode,
    setpointC: setpoint,
    fanCommandPercent: fan,
    allocationPercent: allocation,
    simulatedHvacKwh,
    simulatedOtherKwh: observed - simulatedHvacKwh,
    energyBalanceKwh: simulatedHvacKwh + (observed - simulatedHvacKwh) - observed,
    label: 'simulated',
  };
}

export function calculateFloorPreview(observedKwh, floors) {
  const observed = numberInRange(observedKwh, 0, Number.MAX_SAFE_INTEGER, 'Observed interval energy');
  if (!Array.isArray(floors) || floors.length < 1 || floors.length > 8) throw new RangeError('One to eight illustrative floors are required.');
  const rows = floors.map((floor) => ({
    ...floor,
    allocationPercent: numberInRange(floor.allocationPercent, 0, 100, `${floor.label} allocation`),
  }));
  const totalPercent = rows.reduce((sum, floor) => sum + floor.allocationPercent, 0);
  const valid = Math.abs(totalPercent - 100) < 0.001;
  return {
    valid,
    totalPercent,
    label: 'simulated',
    rows: rows.map((floor) => ({
      ...floor,
      simulatedKwh: valid ? observed * floor.allocationPercent / 100 : null,
    })),
    allocatedTotalKwh: valid ? observed : null,
  };
}
