const normalize=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim();
// Floors/units describe a building interior, not another geographic point.
export function parseAddress(value){
  const text=normalize(value);
  const road=text.match(/([가-힣A-Za-z0-9·.]+(?:대로|로|길))\s*(\d+)(?:\s*-\s*(\d+))?(?=$|[\s,(])/);
  if(road)return {kind:'road',street:road[1],number:String(Number(road[2]))+(road[3]?'-'+Number(road[3]):'')};
  const lot=text.match(/([가-힣0-9·.]+(?:동|읍|면|리))\s*(산\s*)?(\d+)(?:\s*-\s*(\d+))?(?=$|[\s,(])/);
  if(lot)return {kind:'lot',street:lot[1],number:(lot[2]?'산':'')+Number(lot[3])+(lot[4]?'-'+Number(lot[4]):'')};
  return null;
}
export function classifyAddress(query,place){
  const wanted=parseAddress(query);
  if(!wanted)return 'place';
  const candidates=[place.address,place.roadAddress,place.lotAddress].map(parseAddress).filter(Boolean);
  const districts=normalize(query).match(/[가-힣]+(?:구|군)(?=\s)/g)||[];
  const resultAddress=[place.address,place.roadAddress,place.lotAddress].filter(Boolean).join(' ');
  if(districts.some(d=>!resultAddress.includes(d)))return 'nearby';
  // A nearby road/building with a different number is never an exact match.
  return candidates.some(p=>p.kind===wanted.kind&&p.street===wanted.street&&p.number===wanted.number)?'exact':'nearby';
}
export function buildingSearchQuery(value){
  const text=normalize(value),parsed=parseAddress(text);
  if(!parsed)return text;
  const start=text.indexOf(parsed.street);
  // Interior floors/units should not turn a building lookup into a place-name search.
  return text.slice(0,start)+parsed.street+' '+parsed.number;
}
export function rankAddressResults(query,places){
  const seen=new Set();
  return places.filter(place=>{
    const key=JSON.stringify([place.name,place.address,place.coordinate]);
    if(seen.has(key))return false;seen.add(key);return true;
  }).map(place=>({...place,match:classifyAddress(query,place)}))
    .sort((a,b)=>(a.match==='nearby')-(b.match==='nearby'));
}
