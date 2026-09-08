// Search pins are independent of course pins and never mutate a route.
export function mountSearchSelection(map){
  let marker;
  return {
    show(place){
      marker?.remove();
      const element=document.createElement('div');element.className='search-location-pin';
      const label=document.createElement('span'),dot=document.createElement('i');
      label.textContent=(place.match==='nearby'?'주변 후보 · ':'')+(place.address||place.name);
      element.append(label,dot);element.setAttribute('role','img');element.setAttribute('aria-label','선택한 검색 위치: '+label.textContent);
      marker=new maplibregl.Marker({element,anchor:'bottom'}).setLngLat(place.coordinate).addTo(map);
    },
    clear(){marker?.remove();marker=null;},
  };
}
