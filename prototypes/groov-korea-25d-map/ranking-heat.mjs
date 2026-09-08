// Use the same competition heat as the ranking data, not score or rank position.
const heat = ['max', 0, ['min', 100, ['to-number', ['get', 'heat'], 0]]];
export const RANKING_HEAT_COLOR = ['interpolate', ['linear'], heat,
  0, '#ffc6a5', 62, '#ff9368', 82, '#ff6b40', 100, '#ff5733'];
export const RANKING_HEAT_OPACITY = ['interpolate', ['linear'], heat,
  0, .12, 40, .2, 62, .34, 82, .5, 100, .62];

// Change only polygon paint. Roads, boundaries, geometry, camera and hit areas stay intact.
export function mountRankingHeat(map, layerIds) {
  const originals = new Map();
  let enabled = false;
  return {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = Boolean(value);
      for (const id of layerIds) {
        if (!map.getLayer(id)) continue;
        if (enabled) {
          if (!originals.has(id)) originals.set(id, {
            'fill-color': structuredClone(map.getPaintProperty(id, 'fill-color')),
            'fill-opacity': structuredClone(map.getPaintProperty(id, 'fill-opacity')),
          });
          map.setPaintProperty(id, 'fill-color', structuredClone(RANKING_HEAT_COLOR));
          map.setPaintProperty(id, 'fill-opacity', structuredClone(RANKING_HEAT_OPACITY));
        } else if (originals.has(id)) {
          for (const [key, paint] of Object.entries(originals.get(id))) map.setPaintProperty(id, key, paint);
          originals.delete(id);
        }
      }
    },
  };
}
