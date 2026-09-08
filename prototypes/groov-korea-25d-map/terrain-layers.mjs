const empty=()=>({type:'FeatureCollection',features:[]});
export const DEFAULT_TERRAIN_SOURCE={type:'raster-dem',tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],tileSize:512,encoding:'terrarium',maxzoom:12,attribution:'<a href="https://mapterhorn.com/attribution/">© Mapterhorn · terrain</a>'};

// Marching squares over real DEM samples. Missing elevations leave gaps, never
// invented terrain. These are approximate 30m DEM contours, not survey data.
export function contourGrid(grid, interval=20) {
  const features=[];
  for(let y=0;y<grid.length-1;y++)for(let x=0;x<grid[y].length-1;x++){
    const cell=[grid[y][x],grid[y][x+1],grid[y+1][x+1],grid[y+1][x]];
    if(cell.some(p=>!p||!Number.isFinite(p[2])))continue;
    const lo=Math.min(...cell.map(p=>p[2])),hi=Math.max(...cell.map(p=>p[2]));
    for(let level=Math.ceil(lo/interval)*interval;level<hi;level+=interval){
      const crossings=[];
      for(let i=0;i<4;i++){
        const a=cell[i],b=cell[(i+1)%4];
        if((a[2]<=level&&b[2]>level)||(b[2]<=level&&a[2]>level)){
          const t=(level-a[2])/(b[2]-a[2]);crossings.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
        }
      }
      for(let i=0;i+1<crossings.length;i+=2)features.push({type:'Feature',properties:{elevation:level,major:level%(interval*5)===0},geometry:{type:'LineString',coordinates:crossings.slice(i,i+2)}});
    }
  }
  // Join neighboring cell segments so elevation labels can fit a continuous
  // contour. Rounded keys absorb interpolation noise without smoothing geometry.
  const endpoint=p=>p.map(v=>v.toFixed(8)).join(','),groups=new Map(),joined=[];
  for(const feature of features){
    const level=feature.properties.elevation;
    if(!groups.has(level))groups.set(level,[]);
    groups.get(level).push(feature);
  }
  for(const segments of groups.values()){
    const links=new Map(),used=new Set();
    segments.forEach((f,i)=>f.geometry.coordinates.forEach(p=>{
      const k=endpoint(p);if(!links.has(k))links.set(k,[]);links.get(k).push(i);
    }));
    segments.forEach((f,i)=>{
      if(used.has(i))return;
      used.add(i);const coordinates=[...f.geometry.coordinates];
      const extend=front=>{
        while(true){
          const key=endpoint(front?coordinates[0]:coordinates.at(-1));
          const next=links.get(key)?.find(index=>!used.has(index));
          if(next===undefined)break;
          used.add(next);const pair=segments[next].geometry.coordinates;
          const point=endpoint(pair[0])===key?pair[1]:pair[0];
          if(front)coordinates.unshift(point);else coordinates.push(point);
        }
      };
      extend(false);extend(true);
      joined.push({...f,geometry:{type:'LineString',coordinates}});
    });
  }
  return {type:'FeatureCollection',features:joined};
}

export function mountHikingTerrain(map,{source=DEFAULT_TERRAIN_SOURCE,notify=()=>{}}={}) {
  let enabled=false,initialized=false,previousTerrain,previousPitch,timer,missingNotified=false,terrainError=false;
  const status=document.createElement('div');status.className='terrain-status';status.setAttribute('role','status');status.hidden=true;
  map.getContainer().append(status);
  function initialize(){
    if(initialized)return;
    map.addSource('hiking-dem',structuredClone(source));
    map.addSource('hiking-shade-dem',structuredClone(source));
    const before=map.getStyle().layers.find(l=>l.id.startsWith('planned-course'))?.id;
    map.addLayer({id:'hiking-hillshade',type:'hillshade',source:'hiking-shade-dem',layout:{visibility:'none'},paint:{'hillshade-exaggeration':.4,'hillshade-shadow-color':'#101811','hillshade-highlight-color':'#adbaa0'}},before);
    map.addSource('hiking-contours',{type:'geojson',data:empty()});
    map.addLayer({id:'hiking-contours-line',type:'line',source:'hiking-contours',minzoom:11,layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':'#c0a17c','line-opacity':.65,'line-width':['case',['get','major'],1.4,.65]}},before);
    map.addLayer({id:'hiking-contours-label',type:'symbol',source:'hiking-contours',minzoom:12,filter:['==',['get','major'],true],layout:{visibility:'none','symbol-placement':'line','symbol-spacing':250,'text-field':['concat',['to-string',['get','elevation']],'m'],'text-font':['Noto Sans Regular'],'text-size':12},paint:{'text-color':'#e1c8a8','text-halo-color':'#151c18','text-halo-width':1.5}},before);
    if(map.getSource('openmaptiles'))map.addLayer({id:'hiking-trails',type:'line',source:'openmaptiles','source-layer':'transportation',minzoom:12,filter:['all',['==',['geometry-type'],'LineString'],['match',['get','class'],['path','track','pedestrian'],true,false]],layout:{visibility:'none','line-join':'round','line-cap':'round'},paint:{'line-color':'#e5c291','line-width':2,'line-dasharray':[2,1.5]}},before);
    initialized=true;
  }
  function refresh(){
    if(!enabled)return;
    // MapLibre reports 0, not null, when a DEM tile has not arrived. Wait for
    // source completion before interpreting zero as a measured sea-level value.
    if(terrainError||!map.isSourceLoaded('hiking-dem')){
      map.getSource('hiking-contours').setData(empty());status.dataset.contourCount='0';
      status.textContent=terrainError?'고도 지형을 불러오지 못했습니다. 기본 지도는 계속 사용할 수 있습니다.':'고도 데이터를 불러오는 중…';return;
    }
    if(map.getZoom()<11){map.getSource('hiking-contours').setData(empty());status.textContent='등고선을 보려면 지도를 더 확대하세요.';return;}
    const canvas=map.getCanvas(),bounds=map.getBounds(),grid=[];let valid=0;
    const west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
    // Geographic interpolation avoids 961 terrain unproject GPU readbacks.
    // Skip off-screen samples where visible-tile readiness gives no guarantee.
    for(let y=0;y<=30;y++){
      const row=[];
      for(let x=0;x<=30;x++){
        const point=[west+(east-west)*x/30,south+(north-south)*y/30];
        const screen=map.project(point),visible=screen.x>=0&&screen.y>=0&&screen.x<=canvas.clientWidth&&screen.y<=canvas.clientHeight;
        const elevation=visible?map.queryTerrainElevation(point):null;
        if(Number.isFinite(elevation))valid++;
        row.push([...point,elevation]);
      }grid.push(row);
    }
    const interval=map.getZoom()<13?50:20,contours=contourGrid(grid,interval);
    map.getSource('hiking-contours').setData(contours);
    status.dataset.contourCount=String(contours.features.length);
    status.textContent=valid?`고도 지형 · ${interval}m 간격 등고선 · 30m DEM 근사`:'고도 데이터를 불러오는 중…';
    if(!valid&&!missingNotified){missingNotified=true;notify('고도 지형을 불러오는 중입니다. 데이터가 도착하면 등고선이 표시됩니다.');}
  }
  function schedule(){if(!enabled)return;clearTimeout(timer);timer=setTimeout(refresh,350);}
  map.on('moveend',schedule);
  map.on('sourcedata',e=>{if(e.sourceId==='hiking-dem'&&e.isSourceLoaded)schedule();});
  map.on('error',event=>{if(event.sourceId==='hiking-dem'||event.sourceId==='hiking-shade-dem'){terrainError=true;schedule();}});
  return {setEnabled(value){
    if(enabled===value)return;
    if(value){initialize();terrainError=false;previousTerrain=map.getTerrain();previousPitch=map.getPitch();}
    enabled=value;clearTimeout(timer);
    status.hidden=!value;
    if(value)status.textContent='등산 지형을 불러오는 중…';
    if(!initialized)return;
    for(const id of ['hiking-hillshade','hiking-contours-line','hiking-contours-label','hiking-trails'])if(map.getLayer(id))map.setLayoutProperty(id,'visibility',value?'visible':'none');
    map.setTerrain(value?{source:'hiking-dem',exaggeration:1}:previousTerrain||null);
    map.easeTo({pitch:value?Math.max(35,Math.min(50,previousPitch)):previousPitch,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:500});
    schedule();
  },get enabled(){return enabled;}};
}
