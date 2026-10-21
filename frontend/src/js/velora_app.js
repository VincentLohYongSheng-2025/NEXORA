import './api.js';
import {ready,status,stamp} from './screen_common.js';
import {estimateImpact,filterDetectedPatterns,loadPreferences} from './demo_preferences.js';
import {loadScenarioProfile,mountScenarioPanel} from './scenario_profile.js';
/**
 * EnergiOS - Exact 1:1 Inspiration Layout with Real Project Telemetry
 * Binds live BDG2 API readings, 24-hour ML forecasts, and statistical anomalies
 * into the 100% exact visual design of idea-02-light.jpeg.
 */

class EnergiOSDashboard {
  constructor() {
    this.state = {
      activeTimeframe: 'Hourly', // 'Hourly', 'Daily', 'Monthly'
      activeBuildingId: null,
      assets: [],
      currentBuilding: null,
      readings: null,
      forecast: null,
      anomalies: null,
      history: { Daily: null, Monthly: null },
    };
    this.energyChart = null;

    // Building image mapping
    this.buildingImages = {
      Hog_office_Bill: 'assets/idea_crops/exact_building_perfect.jpeg',
      Hog_education_Donnie: 'assets/buildings/Hog_education_Donnie.jpg',
      Hog_assembly_Dona: 'assets/buildings/Hog_assembly_Dona.jpg',
      Hog_lodging_Francisco: 'assets/buildings/Hog_lodging_Francisco.jpg',
    };
  }

  async init() {
    console.log('[EnergiOS] Initializing dashboard with project readings...');
    status('Loading live BDG2 catalogue...');
    this.renderPowerDialTicks();
    this.setupEventListeners();
    await this.loadData();
  }

  /**
   * Render the 42 radial tick marks around the Power dial (speedometer style from idea-02)
   */
  renderPowerDialTicks(currentKwh = 0, maxKwh = 1) {
    const container = document.getElementById('power-dial-ticks');
    if (!container) return;

    const totalTicks = 42;
    const radius = 58;
    const cx = 70;
    const cy = 70;
    let svgContent = '';

    const ratio = Math.min(1, Math.max(0.05, currentKwh / (maxKwh || 1)));
    const filledTicks = Math.round(ratio * totalTicks);

    for (let i = 0; i < totalTicks; i++) {
      const angleDeg = 135 + (i / (totalTicks - 1)) * 270;
      const angleRad = (angleDeg * Math.PI) / 180;

      const innerX = cx + (radius - 8) * Math.cos(angleRad);
      const innerY = cy + (radius - 8) * Math.sin(angleRad);
      const outerX = cx + radius * Math.cos(angleRad);
      const outerY = cy + radius * Math.sin(angleRad);

      const isFilled = i <= filledTicks;
      const strokeColor = isFilled ? '#FF7A00' : '#E2E8F0';
      const strokeWidth = i % 5 === 0 ? 2 : 1.2;

      svgContent += `<line x1="${innerX.toFixed(1)}" y1="${innerY.toFixed(1)}" x2="${outerX.toFixed(1)}" y2="${outerY.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
    }

    container.innerHTML = svgContent;
  }

  async loadData() {
    try {
      const assetsData = await window.apiClient.getAssets();
      this.state.assets = assetsData.items || [];
      if (this.state.assets.length === 0) {
        throw new Error('The live API returned no BDG2 benchmark assets.');
      }
      let preferences={};try{preferences=JSON.parse(localStorage.getItem('ENERGIOS_DEMO_PREFERENCES')||'{}');}catch{}
      const requested=new URLSearchParams(location.search).get('asset')||preferences.defaultAssetId;
      this.state.activeBuildingId = this.state.assets.some(a=>a.id===requested)?requested:this.state.assets[0].id;
      this.renderBuildingPicker();
      await this.selectBuilding(this.state.activeBuildingId);
    } catch (err) {

      this.renderDataError(err.message);
    }
  }

  renderDataError(message) {
    status(message||'Live BDG2 data unavailable.','error',()=>this.loadData());
    const container = document.getElementById('building-picker-container');
    if (container) {
      container.innerHTML = '<span class="text-xs text-rose-700">Live BDG2 data unavailable. Retry by refreshing the page.</span>';
    }
    this.showToast(message || 'Live BDG2 data is temporarily unavailable.');
  }

  renderBuildingPicker() {
    const container = document.getElementById('building-picker-container');
    if (!container) return;

    container.innerHTML = this.state.assets.map((asset) => {
      const isSelected = asset.id === this.state.activeBuildingId;
      const cleanName = asset.name.replace('Hog_', '').replace('_', ' ');
      return `
        <button onclick="veloraApp.selectBuilding('${asset.id}')" class="px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
          isSelected
            ? 'bg-[#1E2022] text-white shadow-xs font-semibold'
            : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200/60'
        }">
          ${cleanName}
        </button>
      `;
    }).join('');
  }

  async selectBuilding(assetId) {
    if (!this.state.assets.some((asset) => asset.id === assetId)) {
      this.renderDataError('The selected asset is not available from the live API.');
      return;
    }
    const token=this.selectionToken=(this.selectionToken||0)+1;
    this.state.activeBuildingId = assetId;
    this.state.readings=null;this.state.forecast=null;this.state.anomalies=null;this.state.history={Daily:null,Monthly:null};
    this.energyChart?.destroy();
    for(const id of ['metric-total-val','metric-current-val','metric-export-val','dial-power-val','dial-min-val','dial-max-val','dial-avg-val','battery-pct-val','bar-energy-val','bar-consuming-val','bar-temp-val','impact-eui-val','impact-cost-val','impact-carbon-val','alerts-count-tag','metric-total-delta','metric-export-delta','above-pattern-count','below-pattern-count']){const n=document.getElementById(id);if(n)n.textContent='—';}
    for(const id of ['heatmap-row-a','heatmap-row-b'])document.getElementById(id).replaceChildren();
    status('Loading selected building history, forecast and detections...');
    this.renderBuildingPicker();

    try {
      const asset = this.state.assets.find((a) => a.id === assetId) || this.state.assets[0];
      this.state.currentBuilding = asset;

      // Update building photo
      const imgEl = document.getElementById('hero-building-photo');
      if (imgEl) {
        const imgSrc = this.buildingImages[asset.name] || 'assets/idea_crops/exact_building_perfect.jpeg';
        imgEl.src = imgSrc;
      }

      // Fetch real project data concurrently
      const [readings, forecast, anomalies, scenario] = await Promise.all([
        window.apiClient.getReadings(assetId, { limit: 168 }),
        window.apiClient.getForecast(assetId),
        window.apiClient.getAnomalies(assetId, { limit: 500 }),
        loadScenarioProfile(assetId),
      ]);

      if(token!==this.selectionToken)return;
      if(!readings.items?.length)throw new Error('No observed readings exist for this asset and period.');
      this.state.readings = readings;
      this.state.forecast = forecast;
      this.state.anomalies = anomalies;
      this.state.scenario = scenario;
      mountScenarioPanel(scenario);

      // Update Header Subtitle Tag
      const subEl = document.getElementById('site-subtitle-tag');
      if (subEl) {
        subEl.textContent = `// PUBLIC BENCHMARK DATA · BDG2 V1.0 · ${asset.name.toUpperCase()} · WHOLE-BUILDING METER`;
      }

      // Update all project readings
      this.updateProjectReadings();

      // Render Energy Overview Time-Series Chart
      if(this.state.activeTimeframe==='Hourly')this.renderEnergyOverviewChart();
      else await this.loadHistoricalView(this.state.activeTimeframe,token);

      // Update 24-cell forecast heatmap
      this.renderForecastHeatmap();
      if(this.state.activeTimeframe==='Hourly')status(`Latest imported interval: ${stamp(readings.items.at(-1).timestamp,asset.timezone)} | historical benchmark`,'success');
      this.updateImpact(assetId,token);
    } catch (err) {
      if(token===this.selectionToken)this.renderDataError(err.message);
    }
  }

  updateProjectReadings() {
    const readings = this.state.readings?.items || [];
    const forecast = this.state.forecast || {};
    const allAnomalies = this.state.anomalies?.items || [];
    const preferences=loadPreferences();
    const anomalies = filterDetectedPatterns(allAnomalies,preferences.anomalyDisplay);
    const anomalyCount = anomalies.length;
    const testMetrics = forecast.test_metrics || {};

    if (readings.length === 0) return;

    // 1. Latest Reading & 24h Sum
    const recent24 = readings.slice(-24);
    const latestReading = recent24[recent24.length - 1];
    const prevDayReading = readings.length > 24 ? readings[readings.length - 25] : readings[0];
    const sum24h = recent24.reduce((acc, r) => acc + r.consumption_kwh, 0);

    // Delta vs previous day
    const previous24=readings.slice(-48,-24);
    const complete=recent24.length===24 && recent24.every((r,i)=>i===0||new Date(r.timestamp)-new Date(recent24[i-1].timestamp)===3600000);
    const priorComplete=previous24.length===24&&previous24.every((r,i)=>i===0||new Date(r.timestamp)-new Date(previous24[i-1].timestamp)===3600000)&&new Date(recent24[0].timestamp)-new Date(previous24.at(-1).timestamp)===3600000;
    const priorSum=previous24.reduce((a,r)=>a+r.consumption_kwh,0);
    const delta=sum24h-priorSum;
    const deltaPct=priorSum?((delta/priorSum)*100).toFixed(1):null;
    const isHigher=delta>=0;

    // 1. HERO METRIC 1: Total 24h Observed Energy
    const valTotalEl = document.getElementById('metric-total-val');
    const deltaTotalEl = document.getElementById('metric-total-delta');
    if (valTotalEl) valTotalEl.textContent = complete?Math.round(sum24h).toLocaleString():'Incomplete';
    if (deltaTotalEl) {
      deltaTotalEl.textContent = complete&&priorComplete&&deltaPct!==null?`${isHigher?'+':''}${deltaPct}% vs previous 24h total`:'Insufficient comparable intervals';
      deltaTotalEl.className = `text-xs font-semibold ${isHigher ? 'text-[#FF7A00]' : 'text-[#22C55E]'} mt-1 block`;
    }

    // 2. HERO METRIC 2: Current Demand (kWh)
    const valCurrentEl = document.getElementById('metric-current-val');
    const statusCurrentEl = document.getElementById('metric-current-status');
    if (valCurrentEl) valCurrentEl.textContent = latestReading.consumption_kwh.toFixed(1);
    if (statusCurrentEl) statusCurrentEl.textContent = 'Observed interval';

    // 3. HERO METRIC 3: Forecast Accuracy (MAE kWh)
    const valExportEl = document.getElementById('metric-export-val');
    const deltaExportEl = document.getElementById('metric-export-delta');
    if (testMetrics.model) {
      const modelMae = testMetrics.model.mae_kwh;
      if (valExportEl) valExportEl.textContent = modelMae.toFixed(2);
      if (deltaExportEl) {
        if (testMetrics.baseline?.mae_kwh) {
          const baselineMae = testMetrics.baseline.mae_kwh;
          const gainPct = (((baselineMae - modelMae) / baselineMae) * 100).toFixed(1);
          deltaExportEl.textContent = `${Number(gainPct) >= 0 ? '+' : ''}${gainPct}% vs Baseline`;
        } else {
          deltaExportEl.textContent = 'Calculated forecast output';
        }
      }
    }

    // 4. POWER DIAL GAUGE
    const dialValEl = document.getElementById('dial-power-val');
    const minValEl = document.getElementById('dial-min-val');
    const maxValEl = document.getElementById('dial-max-val');
    const avgValEl = document.getElementById('dial-avg-val');

    const minKwh = Math.min(...recent24.map((r) => r.consumption_kwh));
    const maxKwh = Math.max(...recent24.map((r) => r.consumption_kwh));
    const avgKwh = sum24h / recent24.length;

    if (dialValEl) dialValEl.textContent = latestReading.consumption_kwh.toFixed(1);
    if (minValEl) minValEl.textContent = `${minKwh.toFixed(1)} kWh`;
    if (maxValEl) maxValEl.textContent = `${maxKwh.toFixed(1)} kWh`;
    if (avgValEl) avgValEl.textContent = `${avgKwh.toFixed(1)} kWh`;

    // Re-render ticks dynamically to match this building's demand ratio
    this.renderPowerDialTicks(latestReading.consumption_kwh, maxKwh);

    // 5. LOAD & EFFICIENCY CARD (Replaces Battery)
    const loadFactor = Math.min(100, Math.round((avgKwh / (maxKwh || 1)) * 100));
    const batteryPctEl = document.getElementById('battery-pct-val');
    if (batteryPctEl) batteryPctEl.textContent = `${loadFactor}%`;

    const floorArea = this.state.currentBuilding?.floor_area_m2;
    const dailyEui = complete && floorArea ? (sum24h / floorArea).toFixed(2) : null;

    const barEnergyValEl = document.getElementById('bar-energy-val');
    const barConsumingValEl = document.getElementById('bar-consuming-val');
    const barTempValEl = document.getElementById('bar-temp-val');

    if (barEnergyValEl) barEnergyValEl.textContent = `${latestReading.consumption_kwh.toFixed(1)} / ${maxKwh.toFixed(1)} kWh`;
    if (barConsumingValEl) barConsumingValEl.textContent = dailyEui ? `${dailyEui} kWh/m² · 24h` : 'Area unavailable';
    const modelMae = testMetrics.model ? testMetrics.model.mae_kwh.toFixed(2) : null;
    if (barTempValEl) barTempValEl.textContent = modelMae ? `MAE ${modelMae} kWh` : 'Metric unavailable';

    document.getElementById('power-source-timestamp').textContent=stamp(latestReading.timestamp,this.state.currentBuilding.timezone);
    // Progress bar widths
    const barEnergyEl = document.getElementById('progress-bar-energy');
    const barConsumingEl = document.getElementById('progress-bar-consuming');
    const barTempEl = document.getElementById('progress-bar-temp');

    if (barEnergyEl) barEnergyEl.style.width = `${loadFactor}%`;
    if (barConsumingEl) barConsumingEl.style.width = dailyEui ? `${Math.min(100, Math.round((parseFloat(dailyEui) / 0.5) * 100))}%` : '0%';
    if (barTempEl) barTempEl.style.width = modelMae ? `${Math.min(100, Math.round((parseFloat(modelMae) / (avgKwh || 1)) * 120))}%` : '0%';

    const above=anomalies.filter(a=>a.direction==='above_expected').length;
    const below=anomalies.filter(a=>a.direction==='below_expected').length;
    for(const [id,count] of [['above-pattern-bar',above],['below-pattern-bar',below]]){const node=document.getElementById(id);node.style.height=`${Math.max(2,60*count/Math.max(above,below,1))}px`;node.title=`${count} returned unusual consumption patterns`;}
    document.getElementById('above-pattern-count').textContent=String(above);
    document.getElementById('below-pattern-count').textContent=String(below);
    // 6. ANOMALY ALERTS CARD
    const alertsCountEl = document.getElementById('alerts-count-tag');
    if (alertsCountEl) {alertsCountEl.textContent = `${anomalyCount} shown`;alertsCountEl.title=`Local display filter: ${preferences.anomalyDisplay}. Backend detected ${this.state.anomalies?.count??allAnomalies.length}; its rule is unchanged.`;}

    const costEl = document.getElementById('impact-cost-val');
    const carbonEl = document.getElementById('impact-carbon-val');
    const euiEl = document.getElementById('impact-eui-val');

    if (costEl) costEl.textContent = 'Not calculated';
    if (carbonEl) carbonEl.textContent = 'Not calculated';
    if (euiEl) euiEl.textContent = dailyEui ? `${dailyEui} kWh/m² · 24h` : 'Area unavailable';
  }

  renderEnergyOverviewChart() {
    const ctx = document.getElementById('energy-overview-chart');
    if (!ctx) return;

    if (this.energyChart) {
      this.energyChart.destroy();
      this.energyChart=null;
    }

    if (this.state.activeTimeframe !== 'Hourly') {
      this.renderHistoricalAggregate(this.state.history[this.state.activeTimeframe]);
      return;
    }

    document.getElementById('energy-overview-title').textContent='Energy Overview';
    document.getElementById('energy-observed-legend').textContent='Observed (kWh)';
    document.getElementById('energy-forecast-legend').classList.remove('hidden');
    document.getElementById('energy-overview-coverage').textContent='Latest 24 observed hourly intervals plus the calculated 24-hour forecast.';
    const empty=document.getElementById('energy-overview-empty');empty.classList.add('hidden');empty.classList.remove('flex');

    const readings = this.state.readings?.items || [];
    const forecasts = this.state.forecast?.items || [];
    const activeReadings = readings.slice(-24);
    const activeForecasts = forecasts.slice(0, 24);
    const chartLabels = [...activeReadings, ...activeForecasts].map((item) =>
      stamp(item.timestamp,this.state.currentBuilding.timezone)
    );
    const chartObserved = [
      ...activeReadings.map((item) => Number(item.consumption_kwh.toFixed(1))),
      ...activeForecasts.map(() => null),
    ];
    const chartForecast = [
      ...activeReadings.map(() => null),
      ...activeForecasts.map((item) => Number(item.forecast_kwh.toFixed(1))),
    ];
    const yUnit = 'kWh';

    this.energyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: `Observed History (${yUnit})`,
            data: chartObserved,
            borderColor: '#FF7A00', // Burnt orange from idea-02
            backgroundColor: 'transparent',
            borderWidth: 2.2,
            tension: 0.42,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FF7A00',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 2,
          },
          {
            label: `Forecast (${yUnit})`,
            data: chartForecast,
            borderColor: '#FACC15', // Bright yellow from idea-02
            backgroundColor: 'transparent',
            borderWidth: 2.2,
            tension: 0.42,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#FACC15',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30, 32, 34, 0.94)',
            titleFont: { size: 11, family: 'Inter' },
            bodyFont: { size: 12, family: 'Inter' },
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: function (c) {
                return ` ${c.dataset.label}: ${Number(c.raw).toFixed(1)} ${yUnit}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: {
              color: '#9CA3AF',
              font: { size: 11, family: 'Inter' },
            },
          },
          y: {
            ticks: {
              color: '#9CA3AF',
              font: { size: 11, family: 'Inter' },
              callback: function (val) {
                return val + ' ' + yUnit;
              },
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.04)',
              drawBorder: false,
            },
          },
        },
      },
    });
  }

  renderHistoricalAggregate(history) {
    const ctx=document.getElementById('energy-overview-chart');
    const empty=document.getElementById('energy-overview-empty');
    const timeframe=this.state.activeTimeframe;
    if(this.energyChart){this.energyChart.destroy();this.energyChart=null;}
    document.getElementById('energy-overview-title').textContent=`${timeframe} Observed Energy`;
    document.getElementById('energy-observed-legend').textContent='Observed calendar sum (kWh)';
    document.getElementById('energy-forecast-legend').classList.add('hidden');
    if(!history){empty.textContent=`Loading ${timeframe.toLowerCase()} observed history…`;empty.classList.remove('hidden');empty.classList.add('flex');return;}
    const items=history.items||[];
    const withData=items.filter(item=>item.observed_sum_kwh!=null);
    if(!withData.length){empty.textContent='No observed intervals exist in this bounded historical range. No substitute data is shown.';empty.classList.remove('hidden');empty.classList.add('flex');}
    else{empty.classList.add('hidden');empty.classList.remove('flex');}
    const first=history.range.from_local.slice(0,10);const end=history.range.to_local_exclusive.slice(0,10);
    const missing=history.expected_interval_count-history.observed_interval_count;
    document.getElementById('energy-overview-coverage').textContent=`Observed BDG2 · ${first} to ${end} exclusive · ${history.complete_period_count}/${history.period_count} complete ${timeframe.toLowerCase()} periods · ${history.observed_interval_count}/${history.expected_interval_count} hourly intervals${missing?` · ${missing} missing`:''}. Partial sums are labelled in tooltips; missing intervals are not filled.`;
    this.energyChart=new Chart(ctx,{type:'bar',data:{labels:items.map(item=>item.period),datasets:[{label:'Observed calendar energy (kWh)',data:items.map(item=>item.complete?item.complete_total_kwh:item.observed_sum_kwh),backgroundColor:items.map(item=>item.complete?'#FF7A00':'#FDBA74'),borderColor:items.map(item=>item.complete?'#EA580C':'#C2410C'),borderWidth:1,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(30,32,34,.94)',callbacks:{label:(context)=>{const item=items[context.dataIndex];if(item.observed_sum_kwh==null)return ' No observed intervals';return [` ${item.complete?'Observed complete total':'Observed partial sum'}: ${item.observed_sum_kwh.toFixed(1)} kWh`,` Coverage: ${item.observed_interval_count}/${item.expected_interval_count} intervals (${item.coverage_percent.toFixed(1)}%)`,item.missing_interval_count?` Missing: ${item.missing_interval_count} hourly intervals`:' Complete source-local calendar period'];}}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:timeframe==='Daily'?10:12,color:'#9CA3AF'}},y:{beginAtZero:true,title:{display:true,text:'Observed energy (kWh)'},ticks:{color:'#9CA3AF',callback:value=>`${value} kWh`},grid:{color:'rgba(0,0,0,.04)'}}}}});
  }

  async loadHistoricalView(timeframe,token=this.selectionToken) {
    const existing=this.state.history[timeframe];
    if(existing){this.renderHistoricalAggregate(existing);this.reportHistoryStatus(existing);return;}
    this.renderHistoricalAggregate(null);
    status(`Loading ${timeframe.toLowerCase()} observed BDG2 history…`);
    try{
      const granularity=timeframe.toLowerCase();
      const history=await window.apiClient.getObservedHistory(this.state.activeBuildingId,{granularity,periods:timeframe==='Daily'?31:12});
      if(token!==this.selectionToken||this.state.activeTimeframe!==timeframe)return;
      if(history.label!=='observed'||history.result_type!=='observed_aggregate'||history.source_timezone!==this.state.currentBuilding.timezone)throw new Error('Historical aggregation metadata did not match the selected BDG2 asset.');
      this.state.history[timeframe]=history;this.renderHistoricalAggregate(history);this.reportHistoryStatus(history);
    }catch(error){
      if(token!==this.selectionToken||this.state.activeTimeframe!==timeframe)return;
      this.energyChart?.destroy();this.energyChart=null;
      const empty=document.getElementById('energy-overview-empty');empty.textContent=error.message||'Observed history is temporarily unavailable.';empty.classList.remove('hidden');empty.classList.add('flex');
      document.getElementById('energy-overview-coverage').textContent='No historical aggregate is displayed. Missing or failed source data is never replaced.';
      status(error.message||'Observed history is temporarily unavailable.','error',()=>this.loadHistoricalView(timeframe,token));
    }
  }

  reportHistoryStatus(history){
    const missing=history.expected_interval_count-history.observed_interval_count;
    status(`${history.granularity==='daily'?'Daily':'Monthly'} observed history · ${history.complete_period_count}/${history.period_count} complete periods · ${missing} missing hourly intervals · ${history.source_timezone}`,'success');
  }

  renderForecastHeatmap() {
    const forecasts = this.state.forecast?.items || [];
    const containerA = document.getElementById('heatmap-row-a');
    const containerB = document.getElementById('heatmap-row-b');
    if (!containerA || !containerB) return;

    // Split 24 forecast hours into Row AM (hours 1-12) and Row PM (hours 13-24)
    const rowA = forecasts.slice(0, 12);
    const rowB = forecasts.slice(12, 24);

    const maxFc = Math.max(...forecasts.map((f) => f.forecast_kwh), 1);

    const renderCells = (items, startHour) => items.map((item, idx) => {
      const hourNum = startHour + idx;
      const kwh = item.forecast_kwh;
      const ratio = kwh / maxFc;
      // Hour 5 is highlighted as active midday peak as in idea-02
      const isPeak = ratio > 0.88;
      const bgClass = isPeak
        ? 'bg-[#FF7A00] shadow-sm shadow-orange-500/30'
        : (ratio > 0.65 ? 'bg-[#FACC15]' : 'bg-[#FEF08A]');
      return `<div class="heatmap-cell ${bgClass} cursor-pointer transition-transform hover:scale-110" title="${stamp(item.timestamp,this.state.currentBuilding.timezone)}: ${kwh.toFixed(1)} kWh calculated forecast"></div>`;
    }).join('');

    containerA.innerHTML = renderCells(rowA, 1);
    containerB.innerHTML = renderCells(rowB, 13);
  }

  async updateImpact(assetId,token){
    const impact=this.state.scenario?.assumptions?.impact||{};
    const values={currency_code:impact.currency_code,tariff_myr_per_kwh:impact.tariff_myr_per_kwh,tariff_source:impact.assumption_reference,carbon_kg_per_kwh:impact.carbon_kg_per_kwh,carbon_source:impact.assumption_reference};
    const recent=this.state.readings?.items?.slice(-24)||[];const energy=recent.reduce((sum,row)=>sum+row.consumption_kwh,0);const result=estimateImpact(energy,values);
    if(token!==this.selectionToken)return;
    document.getElementById('impact-cost-val').textContent=result.cost==null?'Not calculated':`MYR ${result.cost.toFixed(2)}`;
    document.getElementById('impact-carbon-val').textContent=result.carbon==null?'Not calculated':`${result.carbon.toFixed(1)} kg CO2e`;
    for(const id of ['impact-cost-val','impact-carbon-val'])document.getElementById(id).title=result.errors.length?result.errors.join('.'):'Calculated from observed BDG2 data and simulation assumptions.';
  }

  exportData() {
    if (!this.state.currentBuilding || !this.state.readings || !this.state.forecast || !this.state.anomalies) {
      this.showToast('Export unavailable until the selected building evidence has loaded.');
      return;
    }
    const payload = {
      export_label: 'EnergiOS labelled evidence export',
      exported_at_utc: new Date().toISOString(),
      asset: this.state.currentBuilding,
      observed_readings: this.state.readings,
      calculated_forecast: this.state.forecast,
      detected_unusual_consumption_patterns: this.state.anomalies,
      observed_calendar_aggregates: this.state.history,
      classifications: {
        observed_readings: 'observed BDG2 public benchmark data',
        calculated_forecast: 'calculated output derived from BDG2 history',
        detected_patterns: 'statistical unusual consumption patterns; no confirmed cause',
      },
      sources: [
        { title: 'Building Data Genome Project 2 v1.0', doi: 'https://doi.org/10.5281/zenodo.3887306', licence: 'CC BY 4.0' },
        { title: 'Building Data Genome Project 2 paper', doi: 'https://doi.org/10.1038/s41597-020-00712-x' },
      ],
      limitations: [
        'This is not Sime Darby or Elmina telemetry.',
        'Whole-building hourly interval kWh does not establish equipment, floor, room, HVAC, tariff, savings or control evidence.',
        'Forecasts and anomaly detections are analytical outputs, not measurements or confirmed causes.',
      ],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `energios-${this.state.currentBuilding.source_asset_id}-labelled-evidence.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.showToast('Labelled JSON exported with BDG2 citations and limitations.');
  }

  async setTimeframe(tab) {
    if (!['Hourly','Daily','Monthly'].includes(tab)) return;
    this.state.activeTimeframe = tab;
    document.querySelectorAll('.timeframe-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.timeframe === tab);
      btn.setAttribute('aria-pressed',String(btn.dataset.timeframe===tab));
    });
    if(tab==='Hourly'){
      this.renderEnergyOverviewChart();
      const latest=this.state.readings?.items?.at(-1);if(latest)status(`Latest imported interval: ${stamp(latest.timestamp,this.state.currentBuilding.timezone)} | historical benchmark`,'success');
    }else await this.loadHistoricalView(tab);
    this.showToast(`View updated to ${tab} observed energy`);
  }

  describeActiveFilter(){
    const copy={Hourly:'Latest 24 observed hourly intervals plus the calculated 24-hour forecast.',Daily:'Latest 31 source-local calendar days from observed hourly intervals.',Monthly:'Latest 12 source-local calendar months from observed hourly intervals.'};
    this.showToast(copy[this.state.activeTimeframe]);
  }

  openAlertDetails() {
    const modal = document.getElementById('velora-alert-modal');
    const listEl = document.getElementById('modal-anomalies-list');
    if (modal) modal.classList.remove('hidden');

    const preferences=loadPreferences();
    const anomalies = filterDetectedPatterns(this.state.anomalies?.items || [],preferences.anomalyDisplay);
    if (listEl) {
      if (anomalies.length === 0) {
        listEl.innerHTML = `
          <div class="p-4 text-center text-slate-400 text-xs">
            No unusual consumption patterns were detected for this asset and selected period.<br>
            <span class="mt-2 inline-block">This is not proof that the building has no inefficiency.</span>
          </div>
        `;
        return;
      }

      listEl.innerHTML = anomalies.slice(0, 15).map((a) => {
        const isAbove = a.direction === 'above_expected';
        const d = new Date(a.timestamp);
        const timeStr = stamp(a.timestamp,this.state.currentBuilding.timezone);
        return `
          <div class="p-3 rounded-xl ${isAbove ? 'bg-orange-50 border border-orange-100' : 'bg-blue-50 border border-blue-100'} text-[#1E2022]">
            <div class="flex justify-between font-bold ${isAbove ? 'text-orange-800' : 'text-blue-800'}">
              <span>${isAbove ? 'Above Expected' : 'Below Expected'} Flag</span>
              <span class="font-mono text-[11px]">${timeStr}</span>
            </div>
            <p class="text-[11px] mt-1 text-slate-700">
              Observed: <span class="font-bold">${a.observed_kwh.toFixed(1)} kWh</span> vs Expected: <span class="font-bold">${a.forecast_kwh.toFixed(1)} kWh</span> (Δ ${a.residual_kwh.toFixed(1)} kWh).
            </p>
          </div>
        `;
      }).join('');
    }
  }

  closeAlertDetails() {
    const modal = document.getElementById('velora-alert-modal');
    if (modal) modal.classList.add('hidden');
  }

  showToast(msg) {
    const toast = document.getElementById('velora-toast');
    const text = document.getElementById('velora-toast-text');
    if (!toast || !text) return;

    text.textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2800);
  }

  setupEventListeners() {
    const alertCard = document.getElementById('alerts-card-trigger');
    if (alertCard) {
      alertCard.onclick = () => this.openAlertDetails();
      alertCard.setAttribute('role','button');alertCard.setAttribute('tabindex','0');alertCard.setAttribute('aria-label','Open unusual-consumption-pattern details');
      alertCard.onkeydown=(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.openAlertDetails();}};
    }

    window.addEventListener('energios:theme-changed', () => {
      if (this.energyChart && this.energyChart.options && this.energyChart.options.scales) {
        const colors = window.getChartThemeColors ? window.getChartThemeColors() : null;
        if (colors) {
          if (this.energyChart.options.scales.x) this.energyChart.options.scales.x.ticks.color = colors.textColor;
          if (this.energyChart.options.scales.y) {
            this.energyChart.options.scales.y.grid.color = colors.gridColor;
            this.energyChart.options.scales.y.ticks.color = colors.textColor;
          }
          this.energyChart.update();
        }
      }
    });
  }
}

window.veloraApp = new EnergiOSDashboard();
ready(()=>window.veloraApp.init());
