export const MOBILE_MAP_QUERY='(max-width: 760px), (max-width: 1000px) and (max-height: 540px)';
export const isMapKeyboardOpen=({height,visualHeight,editable})=>Boolean(editable&&Number.isFinite(height)&&Number.isFinite(visualHeight)&&height-visualHeight>120);

export function addMobileShortcuts(container,shortcuts){
  const group=document.createElement('div');group.className='mobile-only mobile-shortcuts';
  for(const {label,run} of shortcuts){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',run);group.append(b);}
  container.append(group);
}

// One owner for small-screen sheets. Resizing never resets a course draft.
export function createPanelState(keys,onChange=()=>{}) {
  const allowed=new Set(keys);let current=null;
  return {get current(){return current;},open(key){
    if(key!==null&&!allowed.has(key))throw new Error('Unknown map panel');
    if(key===current)return;
    const previous=current;current=key;onChange(key,previous);
  },toggle(key){this.open(current===key?null:key);}};
}

export function mobileCameraPadding({width,height,panelHeight=0}={}){
  // Keep a real map target even with a short landscape viewport or keyboard.
  const top=Math.min(78,height*.18),bottom=Math.min(height*.55,Math.max(90,panelHeight+88));
  return {top,bottom:Math.min(bottom,height-top-90),left:16,right:Math.min(66,width*.18)};
}

export function mountMobileMapUI({root,panels,actions,core=[],beforeOpen=()=>true,onChange=()=>{}}){
  const mq=matchMedia(MOBILE_MAP_QUERY),dock=document.createElement('nav'),controls=document.createElement('div');
  dock.className='mobile-map-dock';dock.setAttribute('aria-label','지도 메뉴');
  controls.className='mobile-map-core';controls.setAttribute('aria-label','빠른 지도 조작');
  let returnFocus=null;
  const entries=Object.entries(panels);
  for(const [key,{element}] of entries)element.id ||= `mobile-${key}`;
  const state=createPanelState(entries.map(([key])=>key),(key,previous)=>{
    sync();onChange(key,previous);
  });
  const api={
    get mobile(){return mq.matches;},get current(){return state.current;},
    open(key){if(mq.matches&&beforeOpen(key))state.open(key);},
    close(){state.open(null);},
    toggle(key){if(mq.matches&&beforeOpen(key))state.toggle(key);},
    padding(){
      const panel=panels[state.current]?.element;
      return mobileCameraPadding({width:innerWidth,height:globalThis.visualViewport?.height||innerHeight,panelHeight:panel?.getBoundingClientRect().height||0});
    },
  };
  function sync(){
    root.dataset.mobilePanel=state.current||'';
    for(const [key,{element}] of entries){
      element.dataset.mobileOpen=String(state.current===key);
      // display:none in CSS also keeps closed panels out of accessibility trees.
      element.inert=mq.matches&&state.current!==key;
    }
    dock.querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.panel===state.current)));
  }
  for(const [key,{element,title,ownHeader=false}] of entries){
    element.dataset.mobileSheet=key;
    if(ownHeader)continue;
    const head=document.createElement('div'),label=document.createElement('strong'),close=document.createElement('button');
    head.className='mobile-sheet-head';label.textContent=title;
    close.type='button';close.textContent='×';close.setAttribute('aria-label',`${title} 닫기`);
    close.addEventListener('click',()=>{api.close();returnFocus?.focus();});
    head.append(label,close);element.prepend(head);
  }
  for(const {key,label} of actions){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.panel=key;
    button.setAttribute('aria-controls',panels[key].element.id);button.setAttribute('aria-expanded','false');
    button.addEventListener('click',()=>{returnFocus=button;api.toggle(key);});dock.append(button);
  }
  for(const {label,text,target} of core){
    const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',label);
    button.addEventListener('click',()=>target.click());controls.append(button);
  }
  root.append(dock,controls);
  const syncKeyboard=()=>{
    const focused=document.activeElement;
    root.dataset.mobileKeyboard=String(mq.matches&&isMapKeyboardOpen({height:globalThis.innerHeight,visualHeight:globalThis.visualViewport?.height,editable:root.contains?.(focused)&&focused?.matches?.('input:not([type=checkbox]):not([type=radio]),textarea')}));
  };
  globalThis.visualViewport?.addEventListener('resize',syncKeyboard);
  root.addEventListener('focusin',syncKeyboard);
  root.addEventListener('focusout',()=>queueMicrotask(syncKeyboard));
  root.addEventListener('keydown',e=>{if(mq.matches&&e.key==='Escape'&&state.current){e.preventDefault();api.close();returnFocus?.focus();}});
  const resizeMode=()=>{api.close();sync();syncKeyboard();};
  mq.addEventListener('change',resizeMode);sync();
  return api;
}
