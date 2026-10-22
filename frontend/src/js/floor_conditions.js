// Illustrative floor conditions; no connected sensor readings.
export const FLOOR_COUNTS = {mall:3,hospital:5,restaurant:1,commercial:11,residential:7,solar:0};
export function floorOptions(facility){
  const count=FLOOR_COUNTS[facility]??2;
  return [{id:'whole',label:'Whole building'},...Array.from({length:count},(_,i)=>({id:i?`level_${i}`:'ground',label:i?`Level ${i}`:'Ground'})),...(count?[{id:'roof',label:'Roof'}]:[])];
}
function rawFloorZones(facility,floor){
  if(floor==='whole'||!floor)return [];
  if(floor==='roof')return [
    {id:'plant',name:'Central chiller plant',status:'Attention',temperature:29.2,occupancy:0,share:.8,issue:'Chiller staging threatens TNB Maximum Demand threshold.',action:'Pre-cool thermal mass and activate BESS peak-shaving dispatch.'},
    {id:'pv',name:'Solar array',status:'Normal',temperature:null,occupancy:0,share:0,issue:'Operating normally with zero curtailment.',action:'Review generation in the Solar layer.'},
    {id:'service',name:'Service area',status:'Normal',temperature:24.1,occupancy:0,share:.2,issue:'Operating within target energy envelope.',action:'Continue routine checks.'}
  ];
  const index=floor==='ground'?0:Number(floor.split('_')[1]);
  const names=facility==='hospital'?['Care zone','Consultation rooms','Support room']:facility==='restaurant'?['Dining room','Kitchen','Cold storage']:facility==='residential'?['Apartment zone A','Apartment zone B','Common area']:facility==='mall'?['Retail zone A','Retail zone B','Service corridor']:['Office zone A','Meeting rooms','Service room'];
  const problem=index%3;
  return names.map((name,i)=>({id:`zone_${i}`,name,status:index%3!==2&&i===problem?(index%2?'Critical':'Attention'):'Normal',temperature:index%3!==2&&i===problem?(index%2?29.4:27.1):23.2+i*.3,occupancy:index%3!==2&&i===problem?0:8+i*4,share:[.46,.34,.2][i],issue:index%3!==2&&i===problem?(index%2?'AHU modulating bypass valve stuck 100% open; primary pump over-cycling.':'Active cooling running in unoccupied zone (0 occupancy vs active AC).'):'Operating within target energy envelope.',action:index%3!==2&&i===problem?(index%2?'Re-zero modulating actuator and trim VFD pump speed to 35 Hz.':'Apply dynamic 26°C setback and enable PIR occupancy shutoff.'):'Continue routine checks.'}));
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
  settledAlerts = new Set(items.flatMap(item=>(item.alerts||[]).filter(a=>a.status==='settled').map(a=>`${item.asset.facility_id}:${a.id}`)));
}
export function floorZones(facility,floor){
  return rawFloorZones(facility,floor).map(z=>settledAlerts.has(`${facility}:${floor}:${z.id}`)?{...z,status:'Normal',temperature:z.temperature===null?null:23.5,settled:true,issue:'Alert settled after human approval.',action:'Approved adjustment applied to the planning profile.'}:z);
}
