// Illustrative floor conditions; no connected sensor readings.
let facilityContexts = new Map();
export const FLOOR_COUNTS = {mall:3,hospital:5,restaurant:1,commercial:11,residential:7,solar:0};
export function floorOptions(facility){
  const count=FLOOR_COUNTS[facility]??2;
  return [{id:'whole',label:'Whole building'},...Array.from({length:count},(_,i)=>({id:i?`level_${i}`:'ground',label:i?`Level ${i}`:'Ground'})),...(count?[{id:'roof',label:'Roof'}]:[])];
}
function rawFloorZones(facility,floor){
  if(floor==='whole'||!floor)return [];
  if(floor==='roof')return [
    {id:'plant',name:'Central chiller plant',status:'Attention',temperature:29.2,occupancy:0,share:.8,issue:'Afternoon cooling demand may increase grid import.',action:'Review chiller staging and reduce avoidable cooling demand.'},
    {id:'pv',name:'Solar array',status:'Normal',temperature:null,occupancy:0,share:0,issue:'Generation is calculated in the renewable planning model.',action:'Review generation in the Solar layer.'},
    {id:'service',name:'Service area',status:'Normal',temperature:24.1,occupancy:0,share:.2,issue:'Operating within target energy envelope.',action:'Continue routine checks.'}
  ];
  const index=floor==='ground'?0:Number(floor.split('_')[1]);
  const names=facility==='hospital'?['Care zone','Consultation rooms','Support room']:facility==='restaurant'?['Dining room','Kitchen','Cold storage']:facility==='residential'?['Apartment zone A','Apartment zone B','Common area']:facility==='mall'?['Retail zone A','Retail zone B','Service corridor']:['Office zone A','Meeting rooms','Service room'];
  const problem=index%3;
  const area=facilityContexts.get(facility)?.asset.floor_area_m2;
  const areaPerPerson=({mall:25,hospital:30,restaurant:9,commercial:20,residential:45})[facility]||25;
  const people=area?area/FLOOR_COUNTS[facility]/areaPerPerson:null;
  const normalTemperature=i=>facility==='restaurant'?(i===2?4:i===1?27:24.5):facility==='hospital'?23.5+i*.2:24+i*.3;
  const occupancy=i=>facility==='restaurant'&&i===2?0:people==null?8+i*4:Math.round(people*[.46,.34,.2][i]);
  return names.map((name,i)=>({id:`zone_${i}`,name,status:index%3!==2&&i===problem?(index%2?'Critical':'Attention'):'Normal',temperature:index%3!==2&&i===problem?(index%2?29.4:27.1):normalTemperature(i),occupancy:index%3!==2&&i===problem&&index%2===0?0:occupancy(i),share:[.46,.34,.2][i],issue:index%3!==2&&i===problem?(index%2?'Room temperature exceeds the assumed 28°C comfort alert threshold.':'Active cooling running in unoccupied zone (0 occupancy vs active AC).'):'Operating within target energy envelope.',action:index%3!==2&&i===problem?(index%2?'Inspect airflow and review the cooling schedule.':'Reduce cooling in the unoccupied zone after occupancy review.'):'Continue routine checks.'}));
}
export function floorIssueCount(facility,floor){return floorZones(facility,floor).filter(z=>z.status!=='Normal').length;}

// Shared illustrative alerts: rooftop markers, floor navigation and room details
// must all resolve to these same floor and zone identities.
export function facilityAlerts(facility){
  if(!FLOOR_COUNTS[facility])return [];
  return floorOptions(facility).flatMap(f=>floorZones(facility,f.id).filter(z=>z.status!=='Normal').map(z=>({...z,floor:f.id,floorLabel:f.label}))).sort((a,b)=>(b.status==='Critical')-(a.status==='Critical'));
}

let settledAlerts = new Set();
export function syncAlertState(items){
  facilityContexts = new Map(items.map(item=>[item.asset.facility_id,item]));
  settledAlerts = new Set(items.flatMap(item=>(item.alerts||[]).filter(a=>a.status==='settled').map(a=>`${item.asset.facility_id}:${a.id}`)));
}
export function floorZones(facility,floor){
  return rawFloorZones(facility,floor).map(z=>settledAlerts.has(`${facility}:${floor}:${z.id}`)?{...z,status:'Normal',temperature:z.temperature===null?null:23.5,settled:true,issue:'Alert settled after human approval.',action:'Approved adjustment applied to the planning profile.'}:z);
}
