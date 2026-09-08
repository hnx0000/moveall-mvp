import { createMapClient } from './map-client.mjs';

// Explicit search avoids geocoder requests on every keystroke. Coordinates are
// only accepted after the user picks a full address from the result list.
export function mountPlaceSearch(host,{label='주소·장소 검색',onSelect,client=createMapClient(),center=()=>null,localResults=()=>[]}={}) {
  host.innerHTML='<form class="place-search-form"><label><span></span><input type="search" autocomplete="off" maxlength="160" required minlength="2"></label><button type="submit">검색</button></form><p role="status" hidden></p><ul class="place-results" hidden></ul>';
  const form=host.querySelector('form'),input=host.querySelector('input'),status=host.querySelector('p'),list=host.querySelector('ul');
  host.querySelector('label span').textContent=label;
  input.placeholder='동네 · 도로명 주소 · 지번 · 장소명';
  let revision=0,controller;
  function render(places){
    list.replaceChildren();list.hidden=!places.length;
    let count=0;
    const more=document.createElement('button');more.type='button';more.textContent='검색 결과 더 보기';more.className='search-more';
    const appendPage=()=>{
      more.remove();
      const page=places.slice(count,count+8);count+=page.length;
      page.forEach(place=>{
        const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('b'),address=document.createElement('small');
        button.type='button';name.textContent=place.name;
        address.textContent=(place.match==='nearby'?'주변 후보 · 입력한 주소와 다름 — ':place.match==='exact'?'주소 일치 · ':'')+(place.address||'');
        button.dataset.match=place.match||'place';
        button.append(name,address);button.addEventListener('click',()=>{
          if(onSelect?.(place)===false)return;
          revision++;controller?.abort();list.hidden=true;status.hidden=false;
          input.value=place.address||place.name;
          status.textContent=(place.match==='nearby'?'주변 후보 선택: ':'선택한 위치: ')+(place.address||place.name);
        });li.append(button);list.append(li);
      });
      if(count<places.length)list.append(more);
    };
    more.addEventListener('click',appendPage);appendPage();
  }
  input.addEventListener('input',()=>{revision++;controller?.abort();status.hidden=true;render(input.value.trim().length>=2?localResults(input.value):[]);});
  input.addEventListener('keydown',event=>{if(event.key==='Escape'){list.hidden=true;controller?.abort();revision++;}if(event.key==='ArrowDown')list.querySelector('button')?.focus();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();const rev=++revision;controller?.abort();controller=new AbortController();
    list.hidden=true;list.replaceChildren();status.hidden=false;status.textContent='주소와 장소를 검색하고 있습니다…';
    try {
      const local=localResults(input.value);
      let data;
      try {data=await client.search({text:input.value,near:center()},controller.signal);}
      catch(error){if(!local.length)throw error;data={places:[],message:'주소 서비스 연결이 지연되어 행정구역 결과만 표시합니다.'};}
      if(rev!==revision)return;
      status.textContent=data.message||'주소를 확인하고 결과를 누르면 지도에 위치 핀이 표시됩니다.';
      render([...local,...data.places]);
    } catch(error){if(rev===revision)status.textContent=error.name==='AbortError'?'검색이 취소됐습니다.':error.message;}
  });
  return {setValue(value){input.value=value;},destroy(){revision++;controller?.abort();host.replaceChildren();}};
}
