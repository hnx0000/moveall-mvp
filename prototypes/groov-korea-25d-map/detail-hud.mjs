import {MOBILE_MAP_QUERY} from './mobile-map-ui.mjs';

export function detailHudPadding({width,height,top=190,cardHeight=180,sheetHeight=0}){
  const safeTop=Math.min(Math.max(0,top+12),height*.46);
  const bottom=Math.min(Math.max(cardHeight,sheetHeight)+32,Math.max(0,height-safeTop-84));
  return {top:safeTop,bottom,left:16,right:Math.min(68,width*.21)};
}

export function mountExploreDisclosure(root,{isExplore=()=>true}={}){
  const toggle=root.querySelector('#explore-search-toggle');
  const popover=root.querySelector('#explore-popover');
  let expanded=toggle.getAttribute('aria-expanded')==='true';
  const render=()=>{
    const open=isExplore()&&expanded;
    popover.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'전국 탐색 닫기':'전국 탐색 열기');
    return open;
  };
  render();
  return {
    isOpen:()=>isExplore()&&expanded,
    setOpen(open){expanded=Boolean(open);return render();},
    toggle(){expanded=!expanded;return render();},
    sync:render,
  };
}

export function mountDetailHud(root){
  const top=root.querySelector('.detail-top-controls'),tabs=root.querySelector('.view-tabs');
  const card=root.querySelector('.map-bottom');
  const mq=matchMedia(MOBILE_MAP_QUERY);
  let frame;
  const measure=()=>{
    const origin=root.getBoundingClientRect().top;
    root.style.setProperty('--detail-tabs-bottom',Math.ceil(tabs.getBoundingClientRect().bottom-origin)+'px');
    root.style.setProperty('--detail-hud-bottom',Math.ceil(top.getBoundingClientRect().bottom-origin)+'px');
  };
  const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure);};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(update):null;
  for(const element of [root,top,tabs,card])observer?.observe(element);
  globalThis.visualViewport?.addEventListener('resize',update);
  mq.addEventListener('change',update);
  measure();
  return {
    padding(){
      if(!mq.matches)return null;
      const sheet=root.querySelector('[data-mobile-open="true"]:not([hidden])');
      return detailHudPadding({width:root.clientWidth,height:root.clientHeight,
        top:top.getBoundingClientRect().bottom-root.getBoundingClientRect().top,
        cardHeight:card.getBoundingClientRect().height,sheetHeight:sheet?.getBoundingClientRect().height||0});
    },
    destroy(){observer?.disconnect();cancelAnimationFrame(frame);globalThis.visualViewport?.removeEventListener('resize',update);mq.removeEventListener('change',update);},
  };
}
