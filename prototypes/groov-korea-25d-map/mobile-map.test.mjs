import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPanelState,mobileCameraPadding,mountMobileMapUI,MOBILE_MAP_QUERY,isMapKeyboardOpen} from './mobile-map-ui.mjs';

test('first entry is map-only; opening a second sheet closes the previous one',()=>{
  const changes=[],state=createPanelState(['ranking','course','search'],(...args)=>changes.push(args));
  assert.equal(state.current,null);state.open('ranking');state.open('course');state.toggle('search');state.toggle('search');
  assert.equal(state.current,null);
  assert.deepEqual(changes,[['ranking',null],['course','ranking'],['search','course'],[null,'search']]);
  assert.throws(()=>state.open('invalid'));assert.equal(state.current,null);
});
test('padding preserves a usable target at phone, landscape and keyboard heights',()=>{
  for(const [width,height] of [[320,568],[390,844],[390,500],[844,390],[390,300]]){
    for(const panelHeight of [0,120,300,600]){
      const p=mobileCameraPadding({width,height,panelHeight});
      assert.ok(p.top>=0&&p.bottom>=0);assert.ok(height-p.top-p.bottom>=89.99);
      assert.ok(width-p.left-p.right>220);
    }
  }
  assert.match(MOBILE_MAP_QUERY,/max-height: 540px/);
});

class Element extends EventTarget{
  dataset={};children=[];attributes={};id='';inert=false;focused=false;
  append(...children){this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  setAttribute(k,v){this.attributes[k]=v;}
  querySelectorAll(selector){return this.children.flatMap(c=>[...(selector==='button'&&c.tag==='button'?[c]:[]),...c.querySelectorAll(selector)]);}
  click(){this.dispatchEvent(new Event('click'));}
  focus(){this.focused=true;}
  getBoundingClientRect(){return{height:200};}
}
test('keyboard input can use remaining visual viewport without mistaking rotation or browser chrome for a keyboard',()=>{
  assert.equal(isMapKeyboardOpen({height:844,visualHeight:430,editable:true}),true);
  assert.equal(isMapKeyboardOpen({height:390,visualHeight:390,editable:true}),false);
  assert.equal(isMapKeyboardOpen({height:844,visualHeight:790,editable:true}),false);
  assert.equal(isMapKeyboardOpen({height:844,visualHeight:430,editable:false}),false);
  assert.equal(isMapKeyboardOpen({height:844,editable:true}),false);
});
function domTest(run){
  const previous={document:globalThis.document,matchMedia:globalThis.matchMedia};
  const mq=new EventTarget();mq.matches=true;
  globalThis.document={createElement(tag){const e=new Element();e.tag=tag;return e;}};
  globalThis.matchMedia=()=>mq;
  try{run(mq);}finally{Object.assign(globalThis,previous);}
}
test('mobile sheets sync inert/expanded, close button and core actions; rotation does not reopen overlays',()=>domTest(mq=>{
  const root=new Element(),ranking=new Element(),course=new Element(),target=new Element();let clicks=0;
  target.addEventListener('click',()=>clicks++);
  const ui=mountMobileMapUI({root,panels:{ranking:{element:ranking,title:'랭킹'},course:{element:course,title:'코스'}},actions:[{key:'ranking',label:'랭킹'},{key:'course',label:'코스'}],core:[{label:'확대',text:'+',target}]});
  const [rankButton,courseButton]=root.children[0].children;
  assert.equal(ui.current,null);assert.ok(ranking.inert&&course.inert);
  assert.ok(rankButton.attributes['aria-controls']);
  rankButton.click();assert.equal(ui.current,'ranking');assert.equal(ranking.inert,false);
  courseButton.click();assert.equal(ui.current,'course');assert.equal(ranking.inert,true);
  assert.equal(rankButton.attributes['aria-expanded'],'false');assert.equal(courseButton.attributes['aria-expanded'],'true');
  course.children[0].children[1].click();assert.equal(ui.current,null);assert.ok(courseButton.focused);
  root.children[1].children[0].click();assert.equal(clicks,1);
  rankButton.click();mq.matches=false;mq.dispatchEvent(new Event('change'));
  assert.equal(ui.current,null);assert.equal(ranking.inert,false);
  mq.matches=true;mq.dispatchEvent(new Event('change'));assert.equal(ui.current,null);assert.equal(ranking.inert,true);
}));
test('active GPS can refuse course opening; Escape closes a sheet without losing data',()=>domTest(()=>{
  const root=new Element(),draft={pins:[[127,37]]},ui=mountMobileMapUI({root,panels:{course:{element:new Element(),title:'코스'},search:{element:new Element(),title:'검색'}},actions:[{key:'course',label:'코스'},{key:'search',label:'검색'}],beforeOpen:key=>key!=='course'});
  ui.open('course');assert.equal(ui.current,null);ui.open('search');
  const escape=new Event('keydown');Object.defineProperty(escape,'key',{value:'Escape'});root.dispatchEvent(escape);
  assert.equal(ui.current,null);assert.deepEqual(draft.pins,[[127,37]]);
}));
test('both pages load map-first phone styles and national ranking is not open in initial HTML',async()=>{
  const [index,detail,css]=await Promise.all(['index.html','detail.html','mobile-map.css'].map(f=>readFile(new URL(f,import.meta.url),'utf8')));
  for(const page of [index,detail])assert.match(page,/href="mobile-map.css"/);
  assert.doesNotMatch(index,/class="ranking-panel is-open"/);
  assert.match(css,/\.region-rail,\.ranking-panel[^}]+display:none!important/);
  assert.match(css,/data-mobile-open=true/);assert.match(css,/safe-area-inset-bottom/);
});
