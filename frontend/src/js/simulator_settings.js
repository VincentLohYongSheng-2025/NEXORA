import {carbonSolarRecommendation} from './carbon_recommendation.js?v=carbon-solar-27';
import {pvDesign} from './simulator_planning.js?v=renewable-workspace-26';

export const defaultDesign = c => ({solar:true,battery:false,ev:false,
  area:Math.max(50,Math.round(c.pv_kw/(.72/2.6*.6*.84*.95))),utilisation:72,panel:'bifacial600',orientation:'South',tilt:10,shade:5,ratio:84,degradation:.5,selfUse:100,
  batteryModel:'custom',evCount:8,evPower:22,evHours:3,evStart:9,evDays:300,evPrice:1.2,
  pvCost:3700,batteryCost:1200,evUnitCost:8500,installPercent:14,gridUpgrade:0,opex:1.5,discount:6});

// The dashboard and simulator use the same sizing calculation and assumptions.
export function recommendedSettings(data) {
  const recommendation=carbonSolarRecommendation(data);
  const design={...defaultDesign(data.config),...recommendation.design};
  return {design,config:{...data.config,pv_kw:Number(pvDesign(design).effective.toFixed(3))},
    name:recommendation.name,technology:'pv',preview:null,saved:null,editing:null};
}

function capture(state,ui,entry) {
  entry[entry.mode]={design:{...ui.designs[state.assetId]},config:{...state.scenarioDraft},
    name:state.scenarioName,technology:state.scenarioTech,preview:state.preview,
    saved:ui.saved,editing:ui.editing};
}

function activate(state,ui,entry) {
  const draft=entry[entry.mode];
  ui.designs[state.assetId]={...draft.design};
  state.scenarioDraft={...draft.config};
  entry[entry.mode]={...draft,design:ui.designs[state.assetId],config:state.scenarioDraft};
  state.scenarioName=draft.name;state.scenarioTech=draft.technology;
  state.preview=draft.preview;state.previewError=null;
  ui.saved=draft.saved;ui.editing=draft.editing;
  state.simulatorRevision=(state.simulatorRevision||0)+1;
}

export function ensureSimulatorSettings(state,ui) {
  ui.settings ||= {};
  let entry=ui.settings[state.assetId];
  if(!entry)entry=ui.settings[state.assetId]={mode:'ai',ai:recommendedSettings(state.data),manual:null};
  if(state.simulatorSettingsContext?.data!==state.data||state.simulatorSettingsContext?.assetId!==state.assetId){
    entry.ai=recommendedSettings(state.data);
    if(entry.manual)entry.manual.preview=null;
    activate(state,ui,entry);
    state.simulatorSettingsContext={assetId:state.assetId,data:state.data};
  }
  return entry;
}

export function setSimulatorSettingsMode(state,ui,mode,{reset=false}={}) {
  if(!['ai','manual'].includes(mode))return;
  const entry=ensureSimulatorSettings(state,ui);
  capture(state,ui,entry);
  if(mode==='ai'&&reset)entry.ai=recommendedSettings(state.data);
  if(mode==='manual'&&!entry.manual)entry.manual={...entry.ai,design:{...entry.ai.design},config:{...entry.ai.config}};
  entry.mode=mode;
  activate(state,ui,entry);
}
