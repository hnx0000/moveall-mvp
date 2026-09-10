import { embedded, requestApp } from './app-host.mjs';
import { pinIcon } from './pin-icons.mjs';
export function mountSavedPlaces(map, rail) {
  if (!rail || rail.querySelector('[data-saved-places]')) return;
  const toggle = document.createElement('button'); toggle.dataset.savedPlaces='true'; toggle.innerHTML=pinIcon('saved'); toggle.setAttribute('aria-label','저장한 위치'); rail.append(toggle);
  const dialog=document.createElement('dialog'); dialog.className='saved-places-dialog'; dialog.setAttribute('aria-label','저장한 위치');
  const icon=paths=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const coordinates=point=>`${Math.abs(point[1]).toFixed(4)}° ${point[1]<0?'S':'N'} · ${Math.abs(point[0]).toFixed(4)}° ${point[0]<0?'W':'E'}`;
  dialog.innerHTML=`<header class="saved-places-header"><div><span class="saved-places-eyebrow">MY PLACES</span><h2>저장한 위치 <span data-count>0</span></h2></div><button type="button" class="saved-places-icon-button" data-close aria-label="저장한 위치 닫기" autofocus>${icon('<path d="m6 6 12 12M18 6 6 18"/>')}</button></header>
    <div class="saved-places-body"><form class="saved-place-composer"><div class="saved-place-target"><span class="saved-place-pin">${pinIcon('saved')}</span><div><strong>이 위치 저장하기</strong><small data-coordinate></small></div></div><label for="saved-place-name">위치 이름</label><input id="saved-place-name" placeholder="예: 한강 수영 포인트, 운동 후 맛집" maxlength="60" autocomplete="off" required><div class="saved-place-composer-actions"><button type="button" data-adjust>지도에서 위치 조정</button><button type="submit" data-save>위치 저장 <span aria-hidden="true">＋</span></button></div></form>
    <p class="saved-places-status" role="status" aria-live="polite" hidden></p><section class="saved-place-library" aria-label="저장한 위치 목록"><div class="saved-place-library-heading"><h3>나의 장소</h3><span>누르면 지도로 이동</span></div><ul class="saved-place-list"></ul></section></div>`;
  document.body.append(dialog);
  const container=map.getContainer();
  const hint=document.createElement('div');hint.className='saved-place-pick-hint';hint.hidden=true;
  hint.innerHTML='<span role="status">저장할 곳을 지도에서 터치하세요</span><button type="button" data-library>목록</button><button type="button" data-cancel>취소</button>';
  container.append(hint);
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-pressed','false');
  const openDialog=()=>{if(!dialog.open)dialog.showModal();toggle.setAttribute('aria-expanded','true');};
  let places=[], markers=[], busy=false, revision=0, selecting=false, dropping=false, selectedCoordinate=null, draftMarker=null, dropTimer=null, rearm=false, destroyed=false;
  const clearDraft=()=>{clearTimeout(dropTimer);dropTimer=null;draftMarker?.remove();draftMarker=null;selectedCoordinate=null;dropping=false;};
  const setSelecting=value=>{
    selecting=value;container.dataset.savedPlacePicking=String(value);hint.hidden=!value;
    toggle.setAttribute('aria-pressed',String(value));toggle.setAttribute('aria-label',value?'위치 저장 모드 끄기':'저장한 위치');
  };
  const cancelPicking=()=>{clearDraft();setSelecting(false);};
  const arm=()=>{
    clearDraft();setSelecting(true);dialog.querySelector('form').hidden=false;
    if(document.querySelector('#course-pin-toggle')?.getAttribute('aria-pressed')==='true')document.querySelector('#course-close')?.click();
  };
  dialog.addEventListener('close',()=>{toggle.setAttribute('aria-expanded','false');if(rearm){rearm=false;arm();}else cancelPicking();});
  const status=dialog.querySelector('[role=status]');
  const notice=(message='',error=false)=>{status.textContent=message;status.hidden=!message;status.dataset.error=String(error);};
  const updateCoordinate=()=>{dialog.querySelector('[data-coordinate]').textContent=selectedCoordinate?coordinates(selectedCoordinate):'';};
  const action=async(type,payload={})=>{
    if(embedded) return requestApp(type,payload);
    const key='groov-map-saved-places-v1'; let list=JSON.parse(localStorage.getItem(key)||'[]');
    if(type==='place-save') list=[...list,{...payload,id:crypto.randomUUID()}];
    if(type==='place-remove') list=list.filter(p=>p.id!==payload.placeId);
    if(type!=='place-list') localStorage.setItem(key,JSON.stringify(list));
    return list;
  };
  const render=()=>{
    markers.forEach(marker=>marker.remove()); markers=[];
    const list=dialog.querySelector('ul'); list.replaceChildren();
    dialog.querySelector('[data-count]').textContent=String(places.length);
    for(const place of places){
      const node=document.createElement('button');node.innerHTML=pinIcon('saved');node.className='saved-place-map-pin';node.setAttribute('aria-label',place.name);
      node.onclick=event=>{event.stopPropagation();if(selecting)return;notice(place.name);dialog.querySelector('form').hidden=true;openDialog();};
      markers.push(new maplibregl.Marker({element:node,anchor:'bottom'}).setLngLat(place.coordinate).addTo(map));
      const item=document.createElement('li'),jump=document.createElement('button'),remove=document.createElement('button');
      item.className='saved-place-item';jump.className='saved-place-jump';jump.type=remove.type='button';
      const mark=document.createElement('span'),copy=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small'),arrow=document.createElement('span');
      mark.className='saved-place-pin';mark.innerHTML=pinIcon('saved');copy.className='saved-place-copy';name.textContent=place.name;meta.textContent=coordinates(place.coordinate);arrow.className='saved-place-chevron';arrow.innerHTML=icon('<path d="m9 5 7 7-7 7"/>');copy.append(name,meta);jump.append(mark,copy,arrow);
      jump.onclick=()=>{map.easeTo({center:place.coordinate,zoom:16});dialog.close();};
      remove.className='saved-places-icon-button saved-place-remove';remove.innerHTML=icon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/>');remove.setAttribute('aria-label',`${place.name} 삭제`);
      remove.onclick=()=>{
        if(busy||item.querySelector('.saved-place-confirm'))return;
        const confirmation=document.createElement('div');confirmation.className='saved-place-confirm';
        const message=document.createElement('span'),cancel=document.createElement('button'),confirm=document.createElement('button');message.textContent='이 위치를 삭제할까요?';cancel.textContent='취소';confirm.textContent='삭제';cancel.type=confirm.type='button';confirm.className='saved-place-confirm-delete';
        cancel.onclick=()=>confirmation.remove();confirm.onclick=async()=>{if(busy)return;busy=true;revision++;save.disabled=true;cancel.disabled=confirm.disabled=true;try{places=await action('place-remove',{placeId:place.id});render();notice('저장한 위치를 삭제했습니다.');}catch(error){notice(error.message,true);cancel.disabled=confirm.disabled=false;}finally{busy=false;save.disabled=false;}};
        confirmation.append(message,cancel,confirm);item.append(confirmation);
      };
      item.append(jump,remove);list.append(item);
    }
    if(!places.length){const empty=document.createElement('li');empty.className='saved-places-empty';empty.innerHTML=`<span class="saved-place-pin">${pinIcon('saved')}</span><strong>다시 찾고 싶은 곳을 모아보세요</strong><p>수영 포인트부터 운동 후 맛집까지.<br>지도에서 위치를 정하고 이름을 붙여 저장하세요.</p>`;list.append(empty);}
  };
  const loadPlaces=async()=>{if(busy)return;const current=++revision;busy=true;save.disabled=true;notice('저장한 위치를 불러오는 중…');try{const loaded=await action('place-list');if(!destroyed&&current===revision){places=loaded;render();notice();}}catch(error){if(!destroyed&&current===revision)notice(error.message,true);}finally{if(!destroyed&&current===revision){busy=false;save.disabled=false;}}};
  toggle.onclick=()=>{if(selecting){cancelPicking();return;}arm();void loadPlaces();};
  hint.querySelector('[data-cancel]').onclick=cancelPicking;
  hint.querySelector('[data-library]').onclick=()=>{cancelPicking();dialog.querySelector('form').hidden=true;openDialog();void loadPlaces();};
  const placePin=event=>{
    if(!selecting||dropping||dialog.open||event.originalEvent?.target?.closest?.('.maplibregl-marker'))return;
    const point=[event.lngLat?.lng,event.lngLat?.lat];
    if(!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)return;
    clearDraft();selectedCoordinate=point;dropping=true;hint.hidden=true;
    const node=document.createElement('div');node.className='saved-place-map-pin saved-place-draft-pin';node.innerHTML=pinIcon('saved');node.setAttribute('aria-label','저장할 위치');
    draftMarker=new maplibregl.Marker({element:node,anchor:'bottom'}).setLngLat(point).addTo(map);
    updateCoordinate();notice();dialog.querySelector('form').hidden=false;
    const delay=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:520;
    dropTimer=setTimeout(()=>{dropTimer=null;if(!destroyed&&selecting&&selectedCoordinate){dropping=false;openDialog();}},delay);
  };
  map.on('click',placePin);
  const onKey=event=>{if(event.key==='Escape'&&!dialog.open)cancelPicking();};
  document.addEventListener('keydown',onKey);
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-adjust]').onclick=()=>{rearm=true;dialog.close();};
  const save=dialog.querySelector('[data-save]');dialog.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(busy)return;
    if(!selectedCoordinate){notice('지도에서 저장할 위치를 먼저 선택해 주세요.',true);return;}
    const input=dialog.querySelector('input'),name=input.value.trim();if(!name){notice('위치 이름을 입력해 주세요.',true);input.focus();return;}
    const coordinate=[...selectedCoordinate];
    busy=true;revision++;save.disabled=true;input.disabled=true;save.textContent='저장 중…';notice();try{places=await action('place-save',{name,coordinate});if(destroyed)return;render();cancelPicking();dialog.querySelector('form').hidden=true;notice('위치를 저장했습니다.');input.value='';}catch(error){if(!destroyed)notice(error.message,true);}finally{busy=false;save.disabled=false;input.disabled=false;save.innerHTML='위치 저장 <span aria-hidden="true">＋</span>';}
  };
  const destroy=()=>{destroyed=true;revision++;cancelPicking();markers.forEach(marker=>marker.remove());map.off('click',placePin);document.removeEventListener('keydown',onKey);dialog.remove();hint.remove();toggle.remove();};
  map.on('remove',destroy);
  if(!embedded) void loadPlaces();
  return {destroy};
}
