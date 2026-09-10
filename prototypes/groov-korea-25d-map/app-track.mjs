import { trackGeoJSON } from './app-data.mjs';
export function mountAppTrack(map) {
  const empty = {type:'FeatureCollection',features:[]};
  map.addSource('app-recorded-track',{type:'geojson',data:empty});
  map.addSource('app-planned-track',{type:'geojson',data:empty});
  map.addSource('app-current-position',{type:'geojson',data:empty});
  map.addLayer({id:'app-planned-track',type:'line',source:'app-planned-track',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ffb394','line-width':4,'line-opacity':.75,'line-dasharray':[2,2]}});
  map.addLayer({id:'app-recorded-track',type:'line',source:'app-recorded-track',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':'#ff5733','line-width':5}});
  map.addLayer({id:'app-current-position',type:'circle',source:'app-current-position',paint:{'circle-radius':7,'circle-color':'#ff5733','circle-stroke-color':'#fff','circle-stroke-width':2}});
  let centered = null, lastCenter = '', following = true, lastState;
  const stopFollowing = event => { if (!event || event.originalEvent) following = false; };
  map.on?.('dragstart', stopFollowing);
  const moveToPoint = p => map.jumpTo({center:[p.longitude,p.latitude], ...(!centered ? {zoom:15} : {})});
  const update = state => {
    if (!!state.recording !== !!lastState?.recording) map.fire?.('groov-recording-change', {recording:!!state.recording});
    if (state.recording && !lastState?.recording) following = true;
    lastState = state;
    map.getSource('app-recorded-track').setData(trackGeoJSON(state.points));
    const coordinates = state.course?.coordinates || [];
    map.getSource('app-planned-track').setData(coordinates.length > 1 ? {type:'Feature',properties:{},geometry:{type:'LineString',coordinates}} : empty);
    const p = state.currentPoint;
    const valid = p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
    map.getSource('app-current-position').setData(valid ? {type:'Feature',properties:{},geometry:{type:'Point',coordinates:[p.longitude,p.latitude]}} : empty);
    // Only a real GPS fix (or verified neighborhood) establishes the initial location.
    const center = valid ? [p.longitude,p.latitude] : state.neighborhood ? [state.neighborhood.longitude,state.neighborhood.latitude] : null;
    const source = valid ? 'gps' : 'neighborhood';
    const key = center?.join(',');
    if (center && (!centered || (valid && centered !== 'gps') || ((state.recording || state.compact) && following && valid && key !== lastCenter))) {
      map.jumpTo({center, ...(!centered ? {zoom:15} : {})});
      centered=source;lastCenter=key;
    }
  };
  // Recording uses the exact same accepted GPS source, never a competing iframe watch/marker.
  update.locate = () => {
    if (!lastState?.recording) return false;
    following = true;
    const p = lastState.currentPoint;
    if (p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) moveToPoint(p);
    return true;
  };
  map.on?.('remove', () => map.off?.('dragstart', stopFollowing));
  return update;
}
