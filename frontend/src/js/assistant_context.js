/** Pure request shaping: evidence and results always come from the backend. */
export function pageAssetId(win, doc) {
  return win.veloraApp?.state?.activeBuildingId || win.diagApp?.state?.activeBuildingId ||
    win.energyScenarioApp?.asset?.id || win.twinApp?.state?.selected ||
    doc.getElementById('select-default-building')?.value || null;
}
export function chatBody(message, assetId, assets, scenario) {
  const text = String(message || '').trim();
  if (!text || text.length > 1500) throw new Error('Enter a question of 1–1500 characters.');
  if (!assets.some(asset => asset.id === assetId)) throw new Error('Select a verified BDG2 building first.');
  const body = {message: text, asset_id: assetId};
  if (scenario && scenario.inputs?.asset_id === assetId && ['energy','peak_shift','impact'].includes(scenario.kind)) {
    body.scenario = {kind: scenario.kind, inputs: {...scenario.inputs}};
  }
  return body;
}
