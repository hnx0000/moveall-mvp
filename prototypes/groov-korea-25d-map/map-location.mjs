// A locate action is not an exercise recorder. Each click recentres once;
// permission, stale fixes and repeated taps never start an invisible GPS watch.
export function createLocateAction({geolocation, onPosition, notify=()=>{}, onBusy=()=>{}}) {
  let pending=false, generation=0, timer;
  return {
    locate() {
      if(pending)return;
      if(!geolocation){notify('이 기기에서 위치를 사용할 수 없습니다.');return;}
      pending=true;onBusy(true);notify('현재 위치를 확인하고 있습니다…');
      const revision=++generation;
      const finish=()=>{if(revision!==generation||!pending)return false;pending=false;clearTimeout(timer);onBusy(false);return true;};
      const fail=error=>{if(!finish())return;notify(error?.code===1?'위치 권한이 꺼져 있습니다. 브라우저 설정에서 허용해주세요.':error?.code===3?'위치 확인이 지연됩니다. 잠시 뒤 다시 눌러주세요.':'현재 위치를 받지 못했습니다. GPS와 연결 상태를 확인해주세요.');};
      timer=setTimeout(()=>fail({code:3}),16000);
      try {geolocation.getCurrentPosition(position=>{
        if(!finish())return;
        const {longitude,latitude,accuracy}=position.coords||{};
        if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90){notify('유효한 위치를 받지 못했습니다.');return;}
        onPosition([longitude,latitude],accuracy);
        notify(Number.isFinite(accuracy)&&accuracy>100?`내 위치로 이동했습니다. 현재 오차 약 ${Math.round(accuracy)}m`:'내 위치로 이동했습니다.');
      },fail,{enableHighAccuracy:true,timeout:14000,maximumAge:0});}catch(error){fail(error);}
    },
    destroy(){generation++;pending=false;clearTimeout(timer);onBusy(false);},
  };
}

export function mountLocateButton(map,button,{notify,padding=()=>0,camera=()=>({}),beforeMove=()=>{}}={}) {
  let marker;
  button.setAttribute('aria-label','내 위치로 이동');button.title='내 위치로 이동';
  const action=createLocateAction({geolocation:navigator.geolocation,notify,
    onBusy:busy=>{button.setAttribute('aria-busy',String(busy));},
    onPosition:(coordinate,accuracy)=>{
      if(!marker){const dot=document.createElement('div');dot.className='my-location-dot';dot.setAttribute('role','img');dot.setAttribute('aria-label','현재 GPS 위치');marker=new maplibregl.Marker({element:dot}).setLngLat(coordinate).addTo(map);}
      marker.setLngLat(coordinate);beforeMove();
      map.easeTo({...camera(),center:coordinate,zoom:Number.isFinite(accuracy)&&accuracy>1000?13:16,padding:padding(),duration:700});
    }});
  button.addEventListener('click',action.locate);
  map.on('remove',()=>{action.destroy();button.removeEventListener('click',action.locate);marker?.remove();});
  return action;
}
