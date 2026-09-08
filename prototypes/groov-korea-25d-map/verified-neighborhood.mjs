export const APP_ORIGIN='http://localhost:8081';
export const MAX_VERIFICATION_AGE=30*24*60*60*1000;
export const verificationCheckDelay=remaining=>Math.max(1,Math.min(3600000,remaining));
export function neighborhoodLabel(area){
  const name=String(area?.neighborhood||'').trim().split(/\s+/).at(-1)?.replace(/제?\d+(?:[·.,]\d+)*동$/,'동')||'';
  return [area?.district,name].filter(Boolean).join(' ');
}
export function readVerifiedArea(value,now=Date.now()){
  if(!value||typeof value.neighborhood!=='string'||!value.neighborhood.trim()||value.neighborhood.length>100)return null;
  if(typeof value.district!=='string'||!value.district.trim()||value.district.length>80)return null;
  if(!Number.isFinite(value.latitude)||!Number.isFinite(value.longitude)||value.latitude<32.8||value.latitude>39||value.longitude<124||value.longitude>132.5)return null;
  const age=now-Date.parse(value.verifiedAt);
  if(!Number.isFinite(age)||age<0||age>MAX_VERIFICATION_AGE)return null;
  return {neighborhood:value.neighborhood,district:value.district,province:typeof value.province==='string'?value.province:'',
    regionCode:typeof value.regionCode==='string'?value.regionCode:'',latitude:value.latitude,longitude:value.longitude,verifiedAt:value.verifiedAt};
}
export function acceptsNeighborhoodMessage(event,{source,nonce,origin=APP_ORIGIN}){
  return Boolean(source&&event.source===source&&event.origin===origin&&event.data?.type==='groov:verified-neighborhood'&&event.data?.nonce===nonce);
}
export function findVerifiedEntry(entries,area){
  const code=entries.find(entry=>entry.code===area.regionCode);
  if(code)return code;
  const last=area.neighborhood.trim().split(/\s+/).at(-1);
  const province=value=>String(value||'').replace(/특별자치도$|특별자치시$|특별시$|광역시$|도$/,'');
  const candidates=entries.filter(entry=>{
    const parts=entry.name.split(/\s+/);
    return parts.at(-1)===last&&parts.includes(area.district)&&(!area.province||province(parts[0])===province(area.province));
  });
  if(candidates.length===1)return candidates[0];
  const located=candidates.filter(({bbox:b})=>b&&area.longitude>=b[0]&&area.longitude<=b[2]&&area.latitude>=b[1]&&area.latitude<=b[3]);
  return located.length===1?located[0]:null;
}
// No token, account details, cross-user localStorage or guessed hometown.
// The isolated lab receives only a user-approved, authenticated neighborhood.
export function mountVerifiedNeighborhood(button,{onSelect=()=>{},notify=()=>{}}={}){
  let area=null,source=null,nonce=null,timeout,expiry;
  const render=()=>{
    const label=area?neighborhoodLabel(area):'인증 동네 연결';
    const text=button.querySelector('[data-neighborhood-label]')||button;
    text.textContent=label;button.title=area?label+'로 이동':'앱의 인증 동네 연결';
    button.setAttribute('aria-label',button.title);
  };
  const checkExpiry=()=>{
    area=readVerifiedArea(area);render();
    if(area)expiry=setTimeout(checkExpiry,verificationCheckDelay(MAX_VERIFICATION_AGE-(Date.now()-Date.parse(area.verifiedAt))));
  };
  const receive=event=>{
    if(!acceptsNeighborhoodMessage(event,{source,nonce}))return;
    const next=readVerifiedArea(event.data.area);
    if(!next){notify('유효한 인증 동네가 없습니다. 앱에서 동네 인증을 확인해주세요.');return;}
    clearTimeout(timeout);area=next;nonce=null;source=null;render();
    clearTimeout(expiry);checkExpiry();
    onSelect(area);notify(neighborhoodLabel(area)+' 인증 동네를 연결했습니다.');
  };
  window.addEventListener('message',receive);
  button.addEventListener('click',()=>{
    area=readVerifiedArea(area);
    if(area){onSelect(area);return;}
    nonce=crypto.randomUUID();
    const url=new URL('/map-connect',APP_ORIGIN);url.searchParams.set('targetOrigin',location.origin);url.searchParams.set('nonce',nonce);
    source=window.open(url.href,'groov-neighborhood-connect');
    if(!source){notify('팝업을 허용한 뒤 인증 동네 연결을 다시 눌러주세요.');return;}
    clearTimeout(timeout);timeout=setTimeout(()=>{nonce=null;source=null;notify('동네 연결 시간이 지났습니다. 연결 버튼을 다시 눌러주세요.');},180000);
  });
  render();
  return {get area(){return readVerifiedArea(area);},destroy(){window.removeEventListener('message',receive);clearTimeout(timeout);clearTimeout(expiry);}};
}
