import { validCoordinate, validatePins, COURSE_PROFILES, routingUrl, parseRoutingResult, outboundPins, withReturnRoute, distanceToRoute } from './course-model.mjs';
import { distanceMeters, sampleRoute } from './route-model.mjs';
import { parseAddress, rankAddressResults, buildingSearchQuery } from './address-match.mjs';

// Provider contracts: routing.route({pins,sport,preferences},signal),
// geocoding.search(query,signal), corridors.find({start,preference,sport,radius},signal).
// Environment/weather and exploration never influence routing without an explicit consumer.
export function createMapServices({ routing, geocoding, corridors, environment = null, exploration = null }) {
  return {
    async route(input, signal) {
      const pins = outboundPins(input.pins, input.turnaroundIndex ?? null);
      const outward = await routing.route({ ...input, pins }, signal);
      if (input.turnaroundIndex != null && input.sport === 'cycling') {
        const back = await routing.route({ ...input, pins: [...pins].reverse() }, signal);
        // Only graph-equivalent retracing qualifies. Nearby parallel lanes are
        // different roads and must never authorize reversing a one-way edge.
        if (Math.abs(back.distanceMeters - outward.distanceMeters) > Math.max(3, outward.distanceMeters * .002) ||
          back.coordinates.length !== outward.coordinates.length ||
          back.coordinates.some((p,i) => distanceMeters(p, outward.coordinates[outward.coordinates.length-1-i]) > 1.5))
          throw new Error('자전거 일방통행 등으로 같은 길의 역방향 귀환을 확인하지 못했습니다. 편도 코스로 만들거나 반환점을 바꿔주세요.');
      }
      return { ...withReturnRoute(outward, input.turnaroundIndex ?? null), pins: input.pins };
    },
    search: (query, signal) => geocoding.search(query, signal),
    async suggest(input, signal) {
      const { start, sport = 'running', preference = 'river', quiet = true } = input;
      const target = Number(input.distanceKm) * 1000;
      if (!validCoordinate(start)) throw new Error('출발지를 검색하거나 지도에서 출발 핀을 선택해주세요.');
      if(!COURSE_PROFILES[sport])throw new Error('지원하지 않는 운동 종목입니다.');
      if (!Number.isFinite(target) || target < 1000 || target > 30000) throw new Error('자동 코스 거리는 1~30km로 선택해주세요.');
      if (input.shape && input.shape !== 'out-and-back') throw new Error('현재 자동 생성은 같은 길로 돌아오는 왕복 코스를 지원합니다.');
      if (!['river', 'park', 'any'].includes(preference)) throw new Error('지원하지 않는 코스 조건입니다.');
      let candidates, discoveryFallback=false;
      try { candidates = await corridors.find({ start, preference, sport, radius: Math.min(10000, Math.max(2000, target * .7)) }, signal); }
      catch(error){
        signal?.throwIfAborted();
        if(preference==='park')throw new Error('주변 공원 자료를 조회하지 못했습니다. 하천 위주 또는 주변 운동길로 다시 시도해주세요.');
        // These are search targets only, never rendered route geometry. Each
        // result must come from the routing graph and prove its river preference.
        discoveryFallback=true;
        candidates=Array.from({length:8},(_,i)=>{
          const angle=i*Math.PI/4,meters=target*.62;
          return [start[0]+Math.cos(angle)*meters/(111320*Math.cos(start[1]*Math.PI/180)),start[1]+Math.sin(angle)*meters/111320];
        }).filter(validCoordinate);
      }
      if (!candidates.length) throw new Error('주변 지도 데이터에서 조건에 맞는 운동길을 찾지 못했습니다. 출발지나 길 조건을 변경해주세요.');
      const near = [...candidates].sort((a,b) => distanceMeters(start,a) - distanceMeters(start,b))[0];
      const destinations = [...candidates].sort((a,b) => Math.abs(distanceMeters(start,a) - target * .6) - Math.abs(distanceMeters(start,b) - target * .6));
      let lastError;
      const tried = [];
      for (const end of destinations) {
        signal?.throwIfAborted();
        if (tried.length >= 5) break;
        if (distanceMeters(start,end) < 300 || tried.some(p => distanceMeters(p,end) < 400)) continue;
        tried.push(end);
        try {
          const pins = !discoveryFallback && distanceMeters(start,near) > 200 && distanceMeters(near,end) > 200 ? [start, near, end] : [start,end];
          const routed = await routing.route({pins,sport,preferences:{river:preference==='river',park:preference==='park',quiet}}, signal);
          if (routed.distanceMeters < target / 2) continue;
          if(preference==='river' && (!routed.pathEvidence || routed.pathEvidence.riverShare<.4))continue;
          const sampled = sampleRoute(routed.coordinates, target / 2);
          const coords = sampled.completedCoordinates;
          const via = pins.slice(1,-1).filter(p => distanceToRoute(p,coords) < 60);
          const finalPins = [start,...via,coords.at(-1).slice(0,2)];
          validatePins(finalPins);
          // Candidate discovery is geographic evidence, not a guarantee of quietness or access today.
          if (!discoveryFallback && preference !== 'any' && coords.filter((_,i)=>i%15===0).every(p=>candidates.every(c=>distanceMeters(p,c)>250))) continue;
          const result = await this.route({pins: finalPins,sport,turnaroundIndex: finalPins.length-1,preferences:{river:preference==='river',park:preference==='park',quiet}},signal);
          if(preference==='river' && (!result.pathEvidence || result.pathEvidence.riverShare<.4))continue;
          if (Math.abs(result.distanceMeters-target)/target > .2) continue;
          return {...result, requestedDistanceMeters:target, generated:true, preference, discoveryFallback,
            note: '실제 경로 거리 기준 왕복 코스입니다. 조용한 길은 통행량이 적은 도로를 우선하는 조건이며, 현장 소음·통제 여부는 확인이 필요합니다.'};
        } catch (error) { signal?.throwIfAborted(); lastError = error; }
      }
      throw new Error(lastError?.message || '목표 거리 ±20% 안에서 연결된 왕복 코스를 찾지 못했습니다. 거리나 출발지를 바꿔주세요.');
    },
    capabilities: () => ({ sports: ['running','cycling','hiking'], maxPins:30,
      automaticShapes:['out-and-back'], automaticPreferences:['river','park','any'],
      addressProvider: geocoding.id, environment: typeof environment?.capabilities==='function'?environment.capabilities():environment?.capabilities||[], exploration:!!exploration }),
    environment, exploration,
  };
}

async function jsonRequest(url, {signal, ...options} = {}) {
  let response;
  try{response = await fetch(url,{...options,signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(30000)])});}
  catch(error){if(error.name==='AbortError'||error.name==='TimeoutError')throw error;throw new Error('지도 데이터 서비스에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.');}
  if (!response.ok) throw new Error(`지도 데이터 서비스 응답 오류 (${response.status}). 잠시 뒤 다시 시도해주세요.`);
  return response.json();
}

export function createBRouterProvider({endpoint='https://brouter.de/brouter'}={}) {
  const cache = new Map();
  return { id:'brouter', async route({pins,sport,preferences={}}, signal) {
    const url = routingUrl(pins,sport,preferences,endpoint).toString();
    signal?.throwIfAborted();
    if (cache.has(url)) return structuredClone(cache.get(url));
    const result = parseRoutingResult(await jsonRequest(url,{signal}),pins,sport);
    cache.set(url,result);
    if(cache.size>80) cache.delete(cache.keys().next().value);
    return structuredClone(result);
  }};
}

export function createGeocodingProvider({kakaoKey, endpoint='https://photon.komoot.io/api/'}={}) {
  const cache = new Map();
  let queue = Promise.resolve(), lastRequest = 0;
  return { id:kakaoKey?'kakao':'photon', async search(rawQuery,signal) {
    const query = String(typeof rawQuery==='object'?rawQuery?.text:rawQuery||'').normalize('NFKC').replace(/\s+/g,' ').trim();
    const near=validCoordinate(rawQuery?.near)?rawQuery.near:null;
    const cacheKey=JSON.stringify([query,near?.map(v=>v.toFixed(2))]);
    if (query.length < 2 || query.length > 160) throw new Error('주소 또는 장소명을 2~160자로 입력해주세요.');
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const lookup=buildingSearchQuery(query);
    let places;
    if(kakaoKey) {
      const request = async type => jsonRequest(`https://dapi.kakao.com/v2/local/search/${type}.json?query=${encodeURIComponent(lookup)}&size=15`,{signal,headers:{Authorization:`KakaoAK ${kakaoKey}`}});
      const addresses = await request('address');
      const data = addresses.documents?.length ? addresses : await request('keyword');
      places = (data.documents||[]).map(p=>({name:p.place_name||p.road_address?.address_name||p.address_name,address:p.road_address?.address_name||p.road_address_name||p.address_name,roadAddress:p.road_address?.address_name||p.road_address_name,lotAddress:p.address?.address_name||p.address_name,coordinate:[Number(p.x),Number(p.y)],provider:'kakao'}));
    } else {
      // Explicit submit, provider-independent throttling, cancellation and bounded cache.
      const operation = queue.then(async()=>{
        signal?.throwIfAborted();
        const delay=Math.max(0,1100-(Date.now()-lastRequest));
        if(delay) await new Promise(r=>setTimeout(r,delay));
        signal?.throwIfAborted(); lastRequest=Date.now();
        const url=new URL(endpoint);
        Object.entries({q:lookup,limit:'20',bbox:'124,32.8,132.5,39',...(near?{lon:String(near[0]),lat:String(near[1])}:{})}).forEach(([k,v])=>url.searchParams.set(k,v));
        return jsonRequest(url,{signal,headers:{'User-Agent':'GROOV-Local-Map-Lab/1.0 (local course planning)'}});
      });
      queue=operation.catch(()=>{});
      const data=await operation;
      places=(data.features||[]).filter(f=>!f.properties?.countrycode||f.properties.countrycode.toUpperCase()==='KR').map(f=>{
        const p=f.properties||{};
        const address=[p.state,p.city,p.district,p.street,p.housenumber].filter(Boolean).join(' ');
        return {name:p.name||address,address,coordinate:f.geometry.coordinates,provider:'photon'};
      });
    }
    places=rankAddressResults(query,places.filter(p=>validCoordinate(p.coordinate)));
    const missingExact=!!parseAddress(query)&&!places.some(p=>p.match==='exact');
    const result={ places, provider: kakaoKey?'kakao':'photon', missingExact,
      message:missingExact?'입력한 번지와 정확히 일치하는 주소가 없습니다. 아래는 주변 후보이며 검색한 주소와 다릅니다. 건물명으로 다시 검색하거나 지도에서 직접 선택해주세요.':places.length?'': '해당 상세 주소가 검색 데이터에 없습니다. 도로명·건물명으로 다시 검색하거나 지도에서 위치를 선택해주세요.' };
    cache.set(cacheKey,result); if(cache.size>100)cache.delete(cache.keys().next().value);
    return result;
  }};
}

export function createCorridorProvider({endpoint='https://overpass-api.de/api/interpreter'}={}) {
  return { id:'osm-overpass', async find({start,preference,sport,radius}, signal) {
    const around=`around:${Math.round(radius)},${start[1]},${start[0]}`;
    const paths=sport==='cycling'?'cycleway|path|residential|service':'footway|path|pedestrian|cycleway|track';
    const anchor=preference==='river'?`way(${around})[waterway~"^(river|stream)$"]->.area;way(around.area:180)[highway~"^(${paths})$"];`:
      preference==='park'?`way(${around})[leisure=park]->.area;way(around.area:250)[highway~"^(${paths})$"];`:
      `way(${around})[highway~"^(${paths})$"];`;
    const query=`[out:json][timeout:22];${anchor}out tags geom 180;`;
    const data=await jsonRequest(endpoint,{signal,method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query})});
    if(data.remark && !data.elements?.length) throw new Error('주변 운동길 조회가 지연되었습니다. 다시 시도해주세요.');
    return (data.elements||[]).filter(w=>!['no','private'].includes(w.tags?.access)&&!['no','private'].includes(w.tags?.[sport==='cycling'?'bicycle':'foot']))
      .flatMap(w=>(w.geometry||[]).filter((_,i,all)=>i%4===0||i===all.length-1).map(p=>[p.lon,p.lat])).filter(validCoordinate);
  }};
}

export function defaultMapServices(env=process.env) {
  return createMapServices({routing:createBRouterProvider({endpoint:env.GROOV_ROUTING_URL}),
    geocoding:createGeocodingProvider({kakaoKey:env.KAKAO_REST_API_KEY,endpoint:env.GROOV_GEOCODING_URL}),
    corridors:createCorridorProvider({endpoint:env.GROOV_CORRIDOR_URL})});
}
