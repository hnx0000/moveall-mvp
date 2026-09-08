export function nationalCameraPadding({width,height,panelHeight=0}){
  const top=Math.min(90,height*.2);
  const bottom=Math.min(Math.max(62,panelHeight+28),Math.max(0,height-top-90));
  return {top,bottom,left:24,right:Math.min(78,width*.24)};
}

// Ranking mode owns the map tint; minimizing or switching popups must not turn it off.
export function mountNationalHud(root,{onRegionSelect=()=>true,onRankingModeChange=()=>{},onChange=()=>{}}={}){
  const rank=root.querySelector('#ranking-panel'),regions=root.querySelector('#region-menu');
  const rankButton=root.querySelector('#ranking-toggle'),regionButton=root.querySelector('#region-toggle');
  const closeButton=root.querySelector('#ranking-close'),minimizeButton=root.querySelector('#ranking-minimize');
  const content=root.querySelector('#ranking-content');
  const buttons=Array.from(regions.querySelectorAll('[data-region]'));
  let current=null,rankingMode=false,collapsed=false,regionsOpen=false;
  let lastMode;
  function render(){
    const previous=current;
    const rankVisible=rankingMode&&!regionsOpen,expanded=rankVisible&&!collapsed;
    current=regionsOpen?'regions':rankingMode?'ranking':null;
    root.dataset.nationalPanel=current||'';
    root.dataset.rankingMode=String(rankingMode);
    root.dataset.rankingExpanded=String(expanded);
    rank.hidden=!rankVisible;rank.inert=!rankVisible;
    rank.classList.toggle('is-open',rankVisible);
    rank.classList.toggle('is-collapsed',collapsed);
    content.hidden=collapsed;content.inert=collapsed;
    rankButton.setAttribute('aria-pressed',String(rankingMode));
    rankButton.setAttribute('aria-expanded',String(expanded));
    minimizeButton.setAttribute('aria-expanded',String(expanded));
    minimizeButton.setAttribute('aria-label',collapsed?'랭킹 박스 펼치기':'랭킹 박스 접기');
    minimizeButton.setAttribute('title',collapsed?'랭킹 박스 펼치기':'랭킹 박스 접기');
    minimizeButton.textContent=collapsed?'+':'−';
    regions.hidden=!regionsOpen;regions.inert=!regionsOpen;
    regions.classList.toggle('is-open',regionsOpen);
    regionButton.setAttribute('aria-expanded',String(regionsOpen));
    if(lastMode!==rankingMode){lastMode=rankingMode;onRankingModeChange(rankingMode);}
    onChange(current,previous);
  }
  function open(key){
    if(key==='ranking'){rankingMode=true;collapsed=false;regionsOpen=false;}
    else if(key==='regions'){regionsOpen=true;}
    else if(key===null){rankingMode=false;collapsed=false;regionsOpen=false;}
    else throw new Error('Unknown national map panel');
    render();
  }
  function closeRegionMenu(){regionsOpen=false;render();}
  rankButton.addEventListener('click',()=>open(rankingMode?null:'ranking'));
  minimizeButton.addEventListener('click',()=>{collapsed=!collapsed;render();});
  regionButton.addEventListener('click',()=>{regionsOpen=!regionsOpen;render();});
  closeButton.addEventListener('click',()=>{open(null);rankButton.focus();});
  root.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!current)return;
    if(regionsOpen){closeRegionMenu();regionButton.focus();}
    else if(!collapsed){collapsed=true;render();minimizeButton.focus();}
    else {open(null);rankButton.focus();}
    event.preventDefault();
  });
  root.addEventListener('pointerdown',event=>{
    if(regionsOpen&&!regions.contains(event.target)&&!regionButton.contains(event.target))closeRegionMenu();
  });
  function setRegion(key){
    const selected=buttons.find(button=>button.dataset.region===key);if(!selected)return;
    for(const button of buttons){const active=button===selected;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));}
    root.querySelector('#region-short-code').textContent=selected.querySelector('span').textContent;
    root.querySelector('#region-current-name').textContent=selected.querySelector('b').textContent;
    regionButton.setAttribute('aria-label',`${selected.querySelector('b').textContent} · 지역 선택`);
  }
  for(const button of buttons)button.addEventListener('click',()=>{
    if(onRegionSelect(button.dataset.region)===false)return;
    setRegion(button.dataset.region);closeRegionMenu();regionButton.focus();
  });
  open(null);setRegion('korea');
  return {get current(){return current;},get rankingMode(){return rankingMode;},open,close:()=>open(null),closeRegionMenu,setRegion,
    padding(){return nationalCameraPadding({width:root.clientWidth,height:root.clientHeight,panelHeight:rank.hidden?0:rank.getBoundingClientRect().height});},
  };
}
