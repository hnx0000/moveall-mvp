// Keep overlays inside the visual viewport (browser chrome, keyboard, rotation).
export function mountMapViewport(map){
  const viewport=window.visualViewport;
  const sync=()=>{
    document.documentElement.style.setProperty('--map-viewport-height',`${viewport?.height||innerHeight}px`);
    document.documentElement.style.setProperty('--map-viewport-top',`${viewport?.offsetTop||0}px`);
    map?.resize();
  };
  window.addEventListener('resize',sync);viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);sync();
  return ()=>{window.removeEventListener('resize',sync);viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);};
}
