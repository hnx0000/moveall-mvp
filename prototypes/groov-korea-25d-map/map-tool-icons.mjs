const shapes={
  zoomIn:'<path d="M12 5v14M5 12h14"/>',zoomOut:'<path d="M5 12h14"/>',
  locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  tilt:'<rect x="4" y="4" width="16" height="16" rx="1.5"/>',
  north:'<path d="m12 3 7 17-7-4-7 4 7-17Zm0 0v13"/>',
  height:'<path d="M4 20h16M6 16v-5h4v5m4 0V4h4v12"/>',
  course:'<circle cx="5" cy="19" r="2"/><path d="M7 19h4c4 0 7-3 7-7M22 6c0 3-4 6-4 6s-4-3-4-6a4 4 0 0 1 8 0Z"/><circle cx="18" cy="6" r="1.2" fill="currentColor" stroke="none"/>',
  reset:'<path d="M4 9a8 8 0 1 1 0 6M4 3v6h6"/>',
};
export function installMapToolIcons(root=document){
  const ids={'zoom-in':'zoomIn','zoom-out':'zoomOut','gps-locate':'locate','tilt-toggle':'tilt','compass':'north','score-height':'height','open-course':'course','reset-view':'reset','detail-zoom-in':'zoomIn','detail-zoom-out':'zoomOut','detail-locate':'locate','detail-tilt':'tilt','detail-compass':'north','course-pin-toggle':'course'};
  for(const [id,key] of Object.entries(ids)){
    const button=root.querySelector(`#${id}`);if(!button)continue;
    button.innerHTML=`<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[key]}</svg>`;
    button.title=button.getAttribute('aria-label')||'';
  }
}
