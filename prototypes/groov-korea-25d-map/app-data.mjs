// Only the app supplies live rankings. Unreported areas are not assigned fake ranks.
export function administrativeName(value) {
  const aliases = { '강원특별자치도':'강원', '전북특별자치도':'전북', '충청북도':'충북', '충청남도':'충남', '전라북도':'전북', '전라남도':'전남', '경상북도':'경북', '경상남도':'경남' };
  const name = String(value || '').normalize('NFKC').replace(/\s/g, '');
  return aliases[name] || name.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/u, '');
}
const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
export function liveDistricts(models, snapshot) {
  const regions = Array.isArray(snapshot?.regions) ? snapshot.regions : [];
  const max = Math.max(0, ...regions.map(r => nonnegative(r.points)));
  return models.map(model => {
    const candidates = regions.filter(r => administrativeName(r.regionName) === administrativeName(model.name) &&
      (r.province ? administrativeName(r.province) === administrativeName(model.province) :
        models.filter(other => administrativeName(other.name) === administrativeName(model.name)).length === 1));
    const region = candidates.length === 1 ? candidates[0] : null;
    const score = nonnegative(region?.points);
    return { ...model, live: true, regionKey: region?.regionKey ?? null,
      score, heat: max ? Math.round(score / max * 100) : 0,
      members: nonnegative(region?.memberCount), participants: nonnegative(region?.participantCount),
      participationRate: Math.min(100, nonnegative(region?.participationRate)), todayDelta: 0,
      serverRank: Number.isInteger(region?.rank) && region.rank > 0 ? region.rank : null };
  });
}
export function trackGeoJSON(points = []) {
  const segments = []; let segment = [];
  for (const point of points) {
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
      if (segment.length > 1) segments.push(segment); segment = []; continue;
    }
    if (point.breakBefore) { if (segment.length > 1) segments.push(segment); segment = []; }
    segment.push([point.longitude, point.latitude]);
  }
  if (segment.length > 1) segments.push(segment);
  return { type: 'FeatureCollection', features: segments.map(coordinates => ({ type:'Feature', properties:{}, geometry:{type:'LineString',coordinates} })) };
}
