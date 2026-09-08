import { embedded, requestApp } from './app-host.mjs';
import { validCoordinate, MAX_COURSE_PINS } from "./course-model.mjs";
import { createMapClient } from './map-client.mjs';
import { mountPlaceSearch } from './place-search.mjs';
import { mountHikingTerrain } from './terrain-layers.mjs';
import { mountCoursePanel } from './course-panel.mjs';
const empty = () => ({ type: "FeatureCollection", features: [] });

export function mountCoursePlanner(
  map,
  {
    button,
    host,
    camera,
    padding=()=>null,
    onToggle = () => {},
    onUse = () => {},
    canOpen = () => true,
    notify = () => {},
  },
) {
  let active = false,
    pins = [],
    sport = "running",
    result = null,
    revision = 0,
    controller,
    timer,
    saving = false;
  let turnaroundIndex=null, selectedPin=null;
  const client=createMapClient();
  const terrain=mountHikingTerrain(map,{notify});
  const markers = [];
  host.innerHTML = `<header><div><small>COURSE BUILDER</small><h2>나만의 코스 <span id="course-sport-label">러닝</span></h2></div><button id="course-close" aria-label="코스 설계 닫기">×</button></header>
    <div class="course-summary"><div><strong id="course-distance">—</strong><span>km</span></div><small id="course-pins">핀 0개</small></div>
    <div class="course-panel-body">
    <section id="course-pin-editor" class="course-pin-editor" hidden><strong id="course-pin-title"></strong><div><button id="pin-turn">반환점 설정</button><button id="pin-remove">핀 제거</button><button id="pin-close" aria-label="핀 편집 닫기">닫기</button></div></section>
    <div id="course-status" role="status">지도에 출발점을 찍어주세요.</div>
    <div class="course-small-actions"><button id="course-no-return" title="반환점 해제 · 편도로 변경" hidden>편도로 전환</button><button id="course-retry" hidden>다시 계산</button></div>
    <div id="course-options">
    <div class="course-sports"><button data-sport="running" aria-pressed="true">러닝</button><button data-sport="cycling" aria-pressed="false">사이클</button><button data-sport="hiking" aria-pressed="false">등산</button></div>
    <details class="course-address"><summary>주소로 출발지 → 도착지 선택</summary><div id="course-start-search"></div><div id="course-finish-search"></div></details>
    <details class="course-auto"><summary>거리·길 조건으로 자동 생성</summary><label>목표 거리 (km)<input id="course-target" type="number" min="1" max="30" step="0.5" value="7"></label><label>길 조건<select id="course-preference"><option value="river">하천 위주</option><option value="park">공원 위주</option><option value="any">주변 운동길</option></select></label><label class="course-check"><input id="course-quiet" type="checkbox" checked>차량 통행이 적은 길 우선</label><p>출발 핀을 기준으로 같은 길을 돌아오는 왕복 코스를 만듭니다.</p><button id="course-generate" class="primary-button">왕복 코스 자동 생성</button></details>
    <button id="course-terrain" aria-pressed="false" hidden>등산 지형·등고선 켜기</button><p id="course-elevation" hidden></p>
    <p id="course-instruction">지도에 출발점을 찍어주세요.</p>
    <label class="course-name">코스 이름<input id="course-name" placeholder="예: 한강 저녁 5km" maxlength="60"></label>
    <div class="course-save-actions"><button id="course-save" class="primary-button" disabled>코스 저장</button><button id="course-use" class="secondary-button" disabled>이 코스 사용</button></div>
    <details id="saved-courses"><summary>저장한 코스 <span id="course-count">0</span></summary><ul id="course-list"></ul></details>
    <button id="course-clear" class="secondary-button">새 코스</button>
    <p class="course-attribution">이 PC의 MVP 서버에 저장됩니다.<br>도로 안내: <a href="https://brouter.de/brouter/" target="_blank" rel="noopener">BRouter</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a><br>도로 통제·공사·안전 여부는 출발 전 확인하세요.</p>
    </div></div>
    <footer class="course-quick-actions"><button id="course-undo" aria-label="마지막 핀 취소">핀 취소</button><button id="course-fit">전체 보기</button><button id="course-options-toggle" aria-controls="course-options" aria-expanded="false"><span>설정·저장</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button></footer>`;
  const $ = (id) => host.querySelector(`#${id}`);
  const panel = mountCoursePanel(host);
  const searchCenter=()=>{const c=map.getCenter();return [c.lng,c.lat];};
  mountPlaceSearch($('course-start-search'),{label:'출발지 주소',client,center:searchCenter,onSelect:place=>{
    if(pins.length)pins[0]=place.coordinate;else pins.push(place.coordinate);
    changed(); map.easeTo({...camera(),center:place.coordinate,zoom:16,duration:600});
  }});
  mountPlaceSearch($('course-finish-search'),{label:'도착지 주소',client,center:searchCenter,onSelect:place=>{
    if(!pins.length){notify('출발지를 먼저 선택해주세요.');return;}
    if(pins.length===1)pins.push(place.coordinate);else pins[pins.length-1]=place.coordinate;
    turnaroundIndex=null;changed();fit();
  }});
  const dialog = document.createElement("dialog");
  dialog.innerHTML =
    '<form method="dialog"><h2>저장한 코스를 삭제할까요?</h2><p>이 PC에서 삭제되며 되돌릴 수 없습니다.</p><div><button value="cancel" class="secondary-button">취소</button><button value="delete" class="primary-button">삭제</button></div></form>';
  document.body.append(dialog);
  map.addSource("planned-course", { type: "geojson", data: empty() });
  map.addLayer({
    id: "planned-course-glow",
    type: "line",
    source: "planned-course",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ff5733", "line-width": 11, "line-blur": 7, "line-opacity": 0.3 },
  });
  map.addLayer({
    id: "planned-course-line",
    type: "line",
    source: "planned-course",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ff5733", "line-width": 4, "line-opacity": 1 },
  });
  const geometry = () =>
    result
      ? {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: result.coordinates },
        }
      : empty();
  const invalidate = () => {
    revision++;
    clearTimeout(timer);
    controller?.abort();
    result = null;
    $("course-save").disabled = true;
    $("course-use").disabled = true;
    $("course-distance").textContent = "—";
    map.getSource("planned-course").setData(empty());
    $('course-elevation').hidden=true;
    $('course-generate').disabled=false;
  };
  const renderPins = () => {
    markers.forEach((m) => m.remove());
    markers.length = 0;
    pins.forEach((coordinate, i) => {
      const element = document.createElement("button");
      element.type='button';
      element.className = "course-pin";
      element.textContent = i === 0 ? "출발" : i === turnaroundIndex ? `${i} 반환` : `${i}`;
      element.setAttribute("aria-label", `${i===0?'출발':i+'번'} 핀 편집`);
      let dragged=false;
      element.addEventListener('click',event=>{event.stopPropagation();if(dragged){dragged=false;return;}selectedPin=i;renderPinEditor();panel.showPin();});
      const marker = new maplibregl.Marker({ element, draggable: true, anchor: "bottom" })
        .setLngLat(coordinate)
        .addTo(map);
      marker.on("dragstart", ()=>{dragged=true;panel.collapse();invalidate();});
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        pins[i] = [p.lng, p.lat];
        changed();
      });
      markers.push(marker);
    });
    $("course-pins").textContent = `핀 ${pins.length}/${MAX_COURSE_PINS}${turnaroundIndex!==null?' · 왕복':''}`;
    $('course-sport-label').textContent=sport==='cycling'?'사이클':sport==='hiking'?'등산':'러닝';
    $("course-instruction").textContent =
      pins.length === 0
        ? "지도에 출발점을 찍어주세요."
        : pins.length === 1
          ? "두 번째 지점을 찍으면 도착점이 됩니다."
          : "핀을 더 찍으면 이전 도착점이 경유지가 됩니다.";
    $("course-undo").disabled = !pins.length;
    $('course-no-return').hidden=turnaroundIndex===null;
    renderPinEditor();
  };
  function renderPinEditor(){
    $('course-pin-editor').hidden=selectedPin===null||!pins[selectedPin];
    host.dataset.courseEditing=String(!$('course-pin-editor').hidden);
    if(selectedPin!==null){$('course-pin-title').textContent=selectedPin===0?'출발 핀':`${selectedPin}번 핀`;$('pin-turn').disabled=selectedPin===0;}
  }
  function showResult(data){
    result=data;map.getSource('planned-course').setData(geometry());
    $('course-distance').textContent=(data.distanceMeters/1000).toFixed(2);
    $('course-status').textContent=data.note || `${sport==='hiking'?'등산로':sport==='cycling'?'자전거 통행 가능한 길':'보행 가능한 길'} 기준${turnaroundIndex!==null?' · 동일 경로 왕복':''}`;
    $('course-save').disabled=false;$('course-use').disabled=false;
    $('course-elevation').hidden=sport!=='hiking';
    $('course-elevation').textContent=data.elevation?`고도 ${data.elevation.minElevationMeters}~${data.elevation.maxElevationMeters}m · 상승 ${data.elevation.ascentMeters}m · 하강 ${data.elevation.descentMeters}m · 최대 경사 약 ${data.elevation.maxGradePercent}% (고도 데이터 추정)`:'이 경로는 고도 데이터를 제공하지 않습니다.';
  }
  async function calculate() {
    if (pins.length < 2) return;
    const rev = revision;
    const requestPins = pins.map((p) => [...p]);
    controller = new AbortController();
    const currentController = controller;
    const requestSport = sport;
    const timeout = setTimeout(() => currentController.abort(), 85000);
    $("course-status").textContent = "실제 도로를 따라 경로를 계산하고 있습니다…";
    $("course-retry").hidden = true;
    try {
      const data=await client.route({pins:requestPins,sport:requestSport,turnaroundIndex,
        preferences:{river:$('course-preference').value==='river',park:$('course-preference').value==='park',quiet:$('course-quiet').checked}},currentController.signal);
      if (rev !== revision || !active) return;
      showResult(data);
    } catch (error) {
      if (rev !== revision) return;
      $("course-status").textContent =
        error.name === "AbortError"
          ? "경로 계산이 지연되었습니다. 다시 시도해주세요."
          : error.message;
      $("course-retry").hidden = false;
    } finally {
      clearTimeout(timeout);
    }
  }
  function changed() {
    if(turnaroundIndex!==null && (turnaroundIndex>=pins.length||pins.length<2))turnaroundIndex=null;
    invalidate();
    renderPins();
    $("course-status").textContent =
      pins.length < 2 ? "출발점과 도착점을 모두 선택해주세요." : "경로 계산 준비 중…";
    if (pins.length >= 2) timer = setTimeout(calculate, 750);
  }
  function fit() {
    const points = result?.coordinates || pins;
    if (!points.length) return;
    const bounds = points.reduce(
      (b, p) => [
        [Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])],
        [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])],
      ],
      [
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ],
    );
    map.fitBounds(bounds, {
      ...camera(),
      padding: padding() || { top: 150, bottom: 120, left: 60, right: innerWidth > 800 ? 410 : 65 },
      maxZoom: 17,
      duration: 700,
    });
  }
  function toggle(value = !active) {
    if (value && !canOpen()) return;
    active = value;
    host.hidden = !active;
    button.setAttribute("aria-pressed", String(active));
    document.body.classList.toggle("planning-course", active);
    onToggle(active);
    for (const id of ["planned-course-glow", "planned-course-line"])
      map.setLayoutProperty(id, "visibility", active ? "visible" : "none");
    if (active) {
      panel.collapse();
      renderPins();
      loadCourses();
      if (pins.length >= 2 && !result) changed();
    } else {
      revision++;
      clearTimeout(timer);
      controller?.abort();
      markers.forEach((m) => m.remove());
      markers.length = 0;
      selectedPin=null;terrain.setEnabled(false);
      $('course-terrain').setAttribute('aria-pressed','false');
      $('course-terrain').textContent='등산 지형·등고선 켜기';
    }
  }
  button.addEventListener("click", () => toggle());
  $("course-close").addEventListener("click", () => toggle(false));
  map.on("click", (event) => {
    if (!active || event.originalEvent?.target?.closest?.(".maplibregl-marker")) return;
    const p = [event.lngLat.lng, event.lngLat.lat];
    if (!validCoordinate(p)) {
      notify("대한민국 지도에서 코스를 만들어주세요.");
      return;
    }
    if (pins.length >= MAX_COURSE_PINS) {notify('최대 30개 핀까지 사용할 수 있습니다.');return;}
    if(turnaroundIndex!==null){notify('새 핀을 추가하려면 먼저 반환점을 해제해주세요.');return;}
    pins.push(p);
    panel.collapse();
    changed();
  });
  host.querySelectorAll("[data-sport]").forEach((b) =>
    b.addEventListener("click", () => {
      if (sport === b.dataset.sport) return;
      sport = b.dataset.sport;
      if(sport==='hiking')$('course-preference').value='any';
      $('course-terrain').hidden=sport!=='hiking';
      if(sport!=='hiking'){terrain.setEnabled(false);$('course-terrain').setAttribute('aria-pressed','false');$('course-terrain').textContent='등산 지형·등고선 켜기';}
      host
        .querySelectorAll("[data-sport]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.sport === sport)));
      changed();
    }),
  );
  $("course-undo").addEventListener("click", () => {
    selectedPin=null;
    pins.pop();
    changed();
  });
  $("course-clear").addEventListener("click", () => {
    pins = [];
    turnaroundIndex=null;selectedPin=null;
    $("course-name").value = "";
    changed();
  });
  $("course-retry").addEventListener("click", () => changed());
  $('pin-close').addEventListener('click',()=>{selectedPin=null;renderPinEditor();});
  $('pin-remove').addEventListener('click',()=>{
    if(selectedPin===null)return;
    if(turnaroundIndex===selectedPin||selectedPin===0)turnaroundIndex=null;
    else if(turnaroundIndex!==null&&selectedPin<turnaroundIndex)turnaroundIndex--;
    pins.splice(selectedPin,1);selectedPin=null;changed();
  });
  $('pin-turn').addEventListener('click',()=>{
    if(selectedPin===null||selectedPin===0)return;
    turnaroundIndex=selectedPin;pins=pins.slice(0,turnaroundIndex+1);selectedPin=null;changed();
  });
  $('course-no-return').addEventListener('click',()=>{turnaroundIndex=null;changed();});
  $('course-terrain').addEventListener('click',()=>{
    const enabled=$('course-terrain').getAttribute('aria-pressed')!=='true';
    terrain.setEnabled(enabled);$('course-terrain').setAttribute('aria-pressed',String(enabled));
    $('course-terrain').textContent=enabled?'등산 지형·등고선 끄기':'등산 지형·등고선 켜기';
  });
  $('course-preference').addEventListener('change',()=>{if(pins.length>=2)changed();});
  $('course-quiet').addEventListener('change',()=>{if(pins.length>=2)changed();});
  $('course-generate').addEventListener('click',async()=>{
    if(!pins.length){notify('주소 검색 또는 지도에서 출발 핀을 선택해주세요.');return;}
    invalidate();const rev=revision;controller=new AbortController();const signal=controller.signal;
    $('course-generate').disabled=true;$('course-status').textContent='주변 운동길을 찾고 목표 거리에 맞는 왕복 경로를 계산합니다…';
    try {
      const data=await client.suggest({start:pins[0],sport,distanceKm:Number($('course-target').value),preference:$('course-preference').value,quiet:$('course-quiet').checked,shape:'out-and-back'},signal);
      if(rev!==revision||!active)return;
      pins=data.pins;turnaroundIndex=data.turnaroundIndex;selectedPin=null;renderPins();showResult(data);panel.collapse();fit();
    }catch(error){if(rev===revision)$('course-status').textContent=error.name==='AbortError'?'자동 생성을 취소했습니다.':error.message;}
    finally{if(rev===revision)$('course-generate').disabled=false;}
  });
  $("course-fit").addEventListener("click", fit);
  $("course-use").addEventListener("click", () => {
    if (!result) return;
    const course = { ...result, name: $("course-name").value.trim() || "가상 코스" };
    toggle(false);
    onUse(course);
  });
  $("course-save").addEventListener("click", async () => {
    if (!result || saving) return;
    const name = $("course-name").value.trim();
    if (!name) {
      $("course-name").focus();
      notify("코스 이름을 입력해주세요.");
      return;
    }
    const submitted = { ...result, name };
    saving = true;
    $("course-save").disabled = true;
    try {
      const response = embedded ? await localCourseResponse('course-save', {course:submitted}) : await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitted),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      notify(embedded ? "이 계정의 기기에 코스를 저장했습니다." : "코스를 저장했습니다.");
      await loadCourses();
      $("saved-courses").open = true;
    } catch (error) {
      notify(error.message || "저장하지 못했습니다.");
    } finally {
      saving = false;
      $("course-save").disabled = !result;
    }
  });
  async function localCourseResponse(type,payload) {
    const data = await requestApp(type,payload); return {ok:true,json:async()=>data};
  }
  async function loadCourses() {
    try {
      const response = embedded ? await localCourseResponse('course-list') : await fetch("/api/courses");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      $("course-count").textContent = String(data.courses.length);
      $("course-list").replaceChildren();
      if (!data.courses.length) {
        const li = document.createElement("li");
        li.textContent = "저장한 코스가 없습니다.";
        $("course-list").append(li);
      }
      data.courses.forEach((course) => {
        const li = document.createElement("li"),
          open = document.createElement("button"),
          remove = document.createElement("button");
        open.className = "saved-course-open";
        const title = document.createElement("b"),
          meta = document.createElement("span");
        title.textContent = course.name;
        meta.textContent = `${course.sport === "cycling" ? "사이클" : course.sport==='hiking'?'등산':"러닝"} · ${(course.distanceMeters / 1000).toFixed(2)} km`;
        open.append(title, meta);
        open.addEventListener("click", () => {
          invalidate();
          pins = course.pins.map((p) => [...p]);
          sport = course.sport;
          turnaroundIndex=course.turnaroundIndex??null;selectedPin=null;
          $('course-terrain').hidden=sport!=='hiking';
          if(sport!=='hiking'){
            terrain.setEnabled(false);
            $('course-terrain').setAttribute('aria-pressed','false');
            $('course-terrain').textContent='등산 지형·등고선 켜기';
          }
          result = course;
          renderPins();
          host
            .querySelectorAll("[data-sport]")
            .forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.sport === sport)));
          $("course-name").value = course.name;
          showResult(course);
          map.getSource("planned-course").setData(geometry());
          $("course-distance").textContent = (course.distanceMeters / 1000).toFixed(2);
          $("course-status").textContent = "저장한 코스 · 경로 불러오기 완료";
          $("course-use").disabled = false;
          $("course-save").disabled = true;
          $("saved-courses").open = false;
          panel.collapse();
          fit();
        });
        remove.textContent = "삭제";
        remove.setAttribute("aria-label", `${course.name} 코스 삭제`);
        remove.addEventListener("click", () => {
          dialog.returnValue = "";
          dialog.showModal();
          dialog.onclose = async () => {
            if (dialog.returnValue !== "delete") return;
            try {
              const r = embedded ? await localCourseResponse('course-remove', {courseId:course.id}) : await fetch(`/api/courses/${course.id}`, { method: "DELETE" });
              if (!r.ok) throw new Error("삭제하지 못했습니다.");
              await loadCourses();
              notify("코스를 삭제했습니다.");
            } catch (error) {
              notify(error.message);
            }
          };
        });
        li.append(open, remove);
        $("course-list").append(li);
      });
    } catch (error) {
      $("course-status").textContent = error.message || "저장한 코스를 불러오지 못했습니다.";
    }
  }
  return {
    get active() {
      return active;
    },
    toggle,
  };
}
