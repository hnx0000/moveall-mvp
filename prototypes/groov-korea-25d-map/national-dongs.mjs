import { DONG_FADE } from "./map-motion.mjs";
import { mountPlaceSearch } from './place-search.mjs';
import { mountSearchSelection } from './search-selection.mjs';
const ROOT = "assets/administrative/";
const EMPTY = () => ({ type: "FeatureCollection", features: [] });
export const intersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export const fadeAtZoom = (z) => Math.max(0, Math.min(1, (z - 14) / 1));

export async function mountNationalDongs(
  map,
  {
    onSelect = () => {},
    onPlaceSelect = () => {},
    beforeSearchSelect = () => true,
    camera = () => ({ pitch: map.getPitch(), bearing: map.getBearing() }),
    searchHost,
    padding=()=>({top:160,bottom:260,left:60,right:70}),
    onError = () => {},
    isInteractive = () => true,
    context = true,
  } = {},
) {
  const getJson = async (path) => {
    const r = await fetch(ROOT + path);
    if (!r.ok) throw new Error("행정구역 자료를 불러오지 못했습니다.");
    return r.json();
  };
  const [manifest, index] = await Promise.all([
    getJson("manifest.json"),
    getJson("search-index.json"),
  ]);
  const searchSelection=mountSearchSelection(map);
  map.addSource('searched-region',{type:'geojson',data:EMPTY()});
  map.addLayer({id:'searched-region-fill',source:'searched-region',type:'fill',paint:{'fill-color':'#ff7959','fill-opacity':.08}});
  map.addLayer({id:'searched-region-line',source:'searched-region',type:'line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffa081','line-width':2.5}});
  const cache = new Map();
  let selectionGeneration = 0;
  let generation = 0,
    timer;
  if (context) {
    const [sido, sgg] = await Promise.all([
      getJson(manifest.context.sidoCoarse.file),
      getJson(manifest.context.sggCoarse.file),
    ]);
    for (const [key, data] of [
      ["sido", sido],
      ["sgg", sgg],
    ]) {
      map.addSource(`context-${key}`, { type: "geojson", data });
      map.addLayer({
        id: `context-${key}-hit`,
        type: "fill",
        source: `context-${key}`,
        minzoom: key === "sido" ? 0 : 7,
        maxzoom: key === "sido" ? 7 : 14,
        paint: { "fill-opacity": 0 },
      });
      map.addLayer({
        id: `context-${key}-line`,
        type: "line",
        layout:{'line-join':'round','line-cap':'round'},
        source: `context-${key}`,
        paint: {
          "line-color": "#ff5733",
          "line-width": key === "sido" ? 1.2 : 0.8,
          "line-opacity":
            key === "sido"
              ? ["interpolate", ["linear"], ["zoom"], 4, 0.65, 9, 0.65, 14, 0]
              : ["interpolate", ["linear"], ["zoom"], 6, 0, 9, 0.5, 13, 0.6, 15, 0],
        },
      });
      map.on("click", `context-${key}-hit`, (event) => {
        if (map.getContainer?.().dataset.savedPlacePicking === 'true') return;
        if (!isInteractive()) return;
        const entry = index[key].find((e) => e.code === event.features?.[0]?.properties?.code);
        if (entry) select(entry);
      });
    }
  }
  map.addSource("national-dongs", { type: "geojson", data: EMPTY(), promoteId: "adm_cd2" });
  map.addLayer({
    id: "national-dong-tint",
    type: "fill",
    source: "national-dongs",
    minzoom: 13.9,
    paint: {
      "fill-color": [
        "case",
        ["==", ["%", ["to-number", ["get", "adm_cd2"]], 3], 0],
        "#ff5733",
        "#8e817b",
      ],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13.9, 0, 15, 0.045, 18, 0.02],
    },
  });
  map.addLayer({
    id: "national-dong-glow",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "national-dongs",
    minzoom: 13.9,
    paint: {
      "line-color": "#ff5733",
      "line-width": 6,
      "line-blur": 5,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 13.9, 0, 15, 0.14, 19, 0.18],
    },
  });
  map.addLayer({
    id: "national-dong-lines",
    type: "line",
    layout:{'line-join':'round','line-cap':'round'},
    source: "national-dongs",
    minzoom: 13.9,
    paint: {
      "line-color": "#ff5733",
      "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.55, 15, 1, 19, 1.5],
      "line-opacity": DONG_FADE,
    },
  });
  map.addLayer({
    id: "national-dong-labels",
    type: "symbol",
    source: "national-dongs",
    minzoom: 14.3,
    maxzoom: 17.7,
    layout: {
      "text-field": ["get", "emd"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 14, 11, 16, 14, 18, 16],
      "text-padding": 25,
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#ded7d0",
      "text-halo-color": "#101113",
      "text-halo-width": 2,
      "text-opacity": ["interpolate", ["linear"], ["zoom"], 14.3, 0, 15, 0.9, 17, 0.7, 17.7, 0],
    },
  });
  const shard = async (code) => {
    if (!cache.has(code)) {
      const entry = manifest.sido.find((p) => p.code === code);
      if (!entry) throw new Error("지역 데이터를 찾지 못했습니다.");
      const promise = getJson(entry.file)
        .then((collection) => {
          collection.features.forEach((f) => {
            f.properties.emd = f.properties.adm_nm.split(" ").at(-1);
          });
          return collection;
        })
        .catch((error) => {
          cache.delete(code);
          throw error;
        });
      cache.set(code, promise);
    }
    return cache.get(code);
  };
  async function update() {
    const revision = ++generation;
    if (map.getZoom() < 13.4) {
      map.getSource("national-dongs").setData(EMPTY());
      document.body.dataset.dongCount = "0";
      return;
    }
    const b = map.getBounds();
    const box = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const entries = manifest.sido.filter((s) => intersects(s.bbox, box));
    try {
      const groups = await Promise.all(entries.map((s) => shard(s.code)));
      if (revision !== generation) return;
      const codes = new Set(index.dong.filter((d) => intersects(d.bbox, box)).map((d) => d.code));
      const features = groups
        .flatMap((g) => g.features)
        .filter((f) => codes.has(f.properties.adm_cd2));
      map.getSource("national-dongs").setData({ type: "FeatureCollection", features });
      document.body.dataset.dongCount = String(features.length);
      for (const key of cache.keys())
        if (cache.size > 5 && !entries.some((e) => e.code === key)) cache.delete(key);
    } catch (error) {
      onError(error.message);
    }
  }
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  };
  map.on("moveend", schedule);
  map.on("click", "national-dong-tint", async (e) => {
    if (map.getContainer?.().dataset.savedPlacePicking === 'true') return;
    if (!isInteractive() || map.getZoom() < 14.1) return;
    const code = e.features?.[0]?.properties?.adm_cd2;
    const entry = index.dong.find((d) => d.code === code);
    if (!entry) return;
    await select(entry, false);
  });
  async function select(entry, move = true) {
    const selectionRevision = ++selectionGeneration;
    try {
      const collection = await shard(entry.sidoCode || entry.code);
      if (selectionRevision !== selectionGeneration) return;
      const feature = collection.features.find((f) => f.properties.adm_cd2 === entry.code);
      const peers = feature
        ? collection.features.filter((f) => f.properties.sgg === feature.properties.sgg)
        : collection.features.filter((f) => !entry.sidoCode || f.properties.sgg === entry.code);
      map.getSource('searched-region').setData({type:'FeatureCollection',features:feature?[feature]:peers});
      const bounds=entry.bbox;
      searchSelection.show({name:entry.fullName||entry.name,coordinate:[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]});
      onSelect({ entry, feature, peers });
      if (move)
        map.fitBounds(
          [
            [entry.bbox[0], entry.bbox[1]],
            [entry.bbox[2], entry.bbox[3]],
          ],
          {
            ...camera(),
            padding:padding(),
            maxZoom: feature ? 15.5 : 12.8,
            duration: 1000,
          },
        );
      schedule();
    } catch (error) {
      onError(error.message);
    }
  }
  if (searchHost) {
    const entries=[...index.sido,...index.sgg,...index.dong];
    mountPlaceSearch(searchHost,{
      label:'지역 · 상세 주소 검색',
      center:()=>{const c=map.getCenter();return[c.lng,c.lat];},
      localResults:text=>{
        const tokens=text.trim().split(/\s+/);
        return entries.filter(entry=>tokens.every(token=>(entry.fullName||entry.name).replace(/\s+/g,'').includes(token)))
          .sort((a,b)=>((a.fullName||a.name).length-(b.fullName||b.name).length))
          .map(entry=>({name:entry.fullName||entry.name,address:entry.fullName||entry.name,entry,match:'region'}));
      },
      onSelect:place=>{
        if(!beforeSearchSelect(place))return false;
        if(place.entry){select(place.entry);return;}
        selectionGeneration++;
        map.getSource('searched-region').setData(EMPTY());
        searchSelection.show(place);
        onPlaceSelect(place);
        map.flyTo({...camera(),center:place.coordinate,zoom:16,padding:padding(),duration:800});
      },
    });
  }
  schedule();
  return { manifest, index, select, refresh: update, shard };
}
