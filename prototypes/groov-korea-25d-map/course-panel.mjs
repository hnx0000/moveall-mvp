import { MOBILE_MAP_QUERY } from './mobile-map-ui.mjs';

// Presentation only: folding the panel never toggles planning or changes a draft.
export function mountCoursePanel(host) {
  const mq = matchMedia(MOBILE_MAP_QUERY);
  const options = host.querySelector('#course-options');
  const toggle = host.querySelector('#course-options-toggle');
  const label = toggle.querySelector('span');
  const body = host.querySelector('.course-panel-body');
  let expanded = false;
  function sync() {
    const visible = !mq.matches || expanded;
    host.dataset.courseExpanded = String(expanded);
    options.hidden = !visible;
    options.inert = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
    toggle.setAttribute('aria-label', visible ? '코스 설정 접기' : '코스 설정과 저장 펼치기');
    label.textContent = visible ? '접기' : '설정·저장';
  }
  function setExpanded(value) {
    if (!value && options.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    expanded = value;
    sync();
    body.scrollTop = 0;
  }
  const click = () => setExpanded(!expanded);
  toggle.addEventListener('click', click);
  mq.addEventListener('change', sync);
  sync();
  return {
    collapse() { if (mq.matches) setExpanded(false); },
    showPin() { if (mq.matches) setExpanded(false); },
    destroy() { toggle.removeEventListener('click', click); mq.removeEventListener('change', sync); },
  };
}
