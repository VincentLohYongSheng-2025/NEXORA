import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/js/api.js', import.meta.url), 'utf8');

function loadClient(fetchImpl) {
  const window = {};
  const context = {
    window,
    fetch: fetchImpl,
    AbortController,
    performance,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    Date,
    Error,
  };
  vm.runInNewContext(source, context, { filename: 'api.js' });
  return new window.EnergiOSApiClient();
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('uses the same-origin proxy and resolves asset IDs before dependent calls', async () => {
  const calls = [];
  const assetId = 'fa2b11d5-f608-515e-97ab-6445ef048bff';
  const client = loadClient(async (url) => {
    calls.push(url);
    if (url.endsWith('/assets?limit=100')) return jsonResponse({ items: [{ id: assetId }] });
    if (url.includes('/readings')) return jsonResponse({ items: [] });
    if (url.includes('/forecast')) return jsonResponse({ items: [] });
    if (url.includes('/anomalies')) return jsonResponse({ items: [] });
    throw new Error(`Unexpected URL ${url}`);
  });

  const assets = await client.getAssets();
  const returnedId = assets.items[0].id;
  await client.getReadings(returnedId, { limit: 24 });
  await client.getForecast(returnedId);
  await client.getAnomalies(returnedId, { limit: 6 });

  assert.deepEqual(calls, [
    '/api/assets?limit=100',
    `/api/assets/${assetId}/readings?limit=24`,
    `/api/assets/${assetId}/forecast`,
    `/api/assets/${assetId}/anomalies?limit=6`,
  ]);
});

test('fails explicitly when the API is unavailable and does not return fallback data', async () => {
  const client = loadClient(async () => jsonResponse({ detail: 'Database-backed BDG2 data is unavailable' }, 503));
  await assert.rejects(
    client.getAssets(),
    (error) => error.name === 'EnergiOSApiError' && error.status === 503
      && error.message === 'Database-backed BDG2 data is unavailable',
  );
});

test('encodes asset IDs and timezone-aware date filters', async () => {
  let requestedUrl;
  const client = loadClient(async (url) => {
    requestedUrl = url;
    return jsonResponse({ items: [] });
  });
  await client.getReadings('asset/id', {
    limit: 10,
    from: '2017-01-01T00:00:00+08:00',
    to: '2017-01-02T00:00:00+08:00',
  });
  assert.match(requestedUrl, /asset%2Fid\/readings\?limit=10/);
  assert.match(requestedUrl, /from=2017-01-01T00%3A00%3A00%2B08%3A00/);
  assert.match(requestedUrl, /to=2017-01-02T00%3A00%3A00%2B08%3A00/);
});

test('requests bounded observed calendar aggregates through the local demo API', async () => {
  const calls=[];
  const client=loadClient(async url=>{calls.push(url);return jsonResponse({result_type:'observed_aggregate',label:'observed',items:[]});});
  await client.getObservedHistory('asset/id',{granularity:'daily',periods:31});
  await client.getObservedHistory('asset/id',{granularity:'monthly',periods:12});
  assert.deepEqual(calls,[
    '/api/demo/assets/asset%2Fid/history?granularity=daily&periods=31',
    '/api/demo/assets/asset%2Fid/history?granularity=monthly&periods=12',
  ]);
  await assert.rejects(client.getObservedHistory('asset',{granularity:'monthly',periods:13}),/between 1 and 12/);
  await assert.rejects(client.getObservedHistory('asset',{granularity:'weekly',periods:1}),/daily or monthly/);
});


test('sends scenario assumptions only to the same-origin calculation endpoint', async () => {
  let captured;
  const client=loadClient(async (url,options)=>{captured={url,...options};return jsonResponse({label:'simulated',items:[]});});
  const assumptions={asset_id:'00000000-0000-4000-8000-000000000001',solar_capacity_kw:0};
  const result=await client.post('/demo/energy-scenario',assumptions);
  assert.equal(captured.url,'/api/demo/energy-scenario');
  assert.equal(captured.method,'POST');
  assert.deepEqual(JSON.parse(captured.body),assumptions);
  assert.equal(captured.headers['Content-Type'],'application/json');
  assert.equal(result.label,'simulated');
});

test('sends Green CFO candidates to the bounded same-origin comparison endpoint', async () => {
  let captured;
  const client=loadClient(async (url,options)=>{captured={url,...options};return jsonResponse({label:'illustrative_scenario_ranking',items:[]});});
  const body={asset_id:'00000000-0000-4000-8000-000000000001',candidates:[
    {name:'A',capex_myr:1000,expected_annual_energy_change_kwh:500,tariff_myr_per_kwh:.5,carbon_kg_per_kwh:.4,annual_operating_cost_change_myr:20,assumption_reference:'User input'},
    {name:'B',capex_myr:null,expected_annual_energy_change_kwh:null,tariff_myr_per_kwh:null,carbon_kg_per_kwh:null,annual_operating_cost_change_myr:null,assumption_reference:''},
  ]};
  const result=await client.post('/demo/investment-comparison',body);
  assert.equal(captured.url,'/api/demo/investment-comparison');
  assert.deepEqual(JSON.parse(captured.body),body);
  assert.equal(result.label,'illustrative_scenario_ranking');
});

test('displays validation errors without substituting calculated results', async () => {
  const client=loadClient(async()=>jsonResponse({detail:[{msg:'Value error, disclose the price assumption'}]},422));
  await assert.rejects(client.post('/demo/impact',{}),e=>e.status===422&&/disclose the price/.test(e.message));
});

test('timeout terminates a stuck request with an explicit error', async () => {
  const client=loadClient((url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{const error=new Error();error.name='AbortError';reject(error);})));
  await assert.rejects(client.request('/assets',{timeoutMs:5}),/timed out/);
});

test('malformed and empty responses do not become fabricated assets', async () => {
  const invalid=loadClient(async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('Bad JSON');}}));
  await assert.rejects(invalid.getAssets(),/unavailable/);
  const empty=loadClient(async()=>jsonResponse({items:[],count:0}));
  assert.equal((await empty.getAssets()).items.length,0);
});


test('screen data loader gives an explicit empty-catalogue state',async()=>{
 const common=await readFile(new URL('../src/js/screen_common.js',import.meta.url),'utf8');
 const isolated=common.replace(/^import .*;\s*$/mg,'').replace(/export (const|function|async function)/g,'$1');
 const window={apiClient:{getAssets:async()=>({items:[]})}};
 vm.runInNewContext(isolated+'\nwindow.loadAssetsForTest=assets;', {window});
 await assert.rejects(window.loadAssetsForTest(),/No BDG2 assets were returned/);
});
