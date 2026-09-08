export function mountZoomReadout(map, output) {
  const sync = () => { output.textContent = map.getZoom().toFixed(1); };
  map.on('zoom', sync);
  sync();
  return () => map.off('zoom', sync);
}
