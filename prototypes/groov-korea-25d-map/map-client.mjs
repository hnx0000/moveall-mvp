import { embedded } from './app-host.mjs';
import { defaultMapServices } from './map-services.mjs';
export function createMapClient(base='/api/maps') {
  if (embedded) return defaultMapServices({});
  async function request(path,body,signal) {
    const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'지도 요청을 완료하지 못했습니다.');
    return data;
  }
  return { route:(input,signal)=>request('/route',input,signal), suggest:(input,signal)=>request('/suggest',input,signal), search:(query,signal)=>request('/search',{query},signal) };
}
