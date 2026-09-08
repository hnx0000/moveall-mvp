import { modes, districts, initial, load, summary, nearby, topTen, selectedDistrict, participation, simulate } from "./model.mjs";
const $ = (s) => document.querySelector(s), key = "groov-league-lab-v3";
let state = load(localStorage.getItem(key));
const fmt = (n) => typeof n === "number" ? n.toLocaleString("ko-KR") : n;
function save() { localStorage.setItem(key, JSON.stringify(state)); }
let toastTimer;
function toast(message) { $("#toast").textContent = message; $("#toast").classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => $("#toast").classList.remove("on"), 2200); }
function verified() { return `<div class="verified"><span>✓</span><div><b>서울 도봉구 쌍문동</b><small>인증된 동네 · 샘플</small></div><button data-action="rules">쟁탈 규칙</button></div>`; }
function modeTabs() { return `<div class="modes" aria-label="랭킹 종목">${modes.map(([id, name]) => `<button data-mode="${id}" class="${state.mode === id ? "active" : ""}" aria-pressed="${state.mode === id}">${name}</button>`).join("")}</div>`; }
function rankRows(rows) { return rows.map((row) => `<div class="rank-row ${row.mine ? "mine" : ""}"><strong>${row.rank}</strong><span class="face">${row.mine ? "나" : row.name[0]}</span><div><b>${row.name}${row.mine ? " · 내 기록" : ""}</b><small>${row.mine ? "쌍문동 인증 사용자" : "이번 주 활동 중"}</small></div><em>${fmt(row.value)}<i>${row.unit}</i></em></div>`).join(""); }
function compactRanking() { return `<section class="ranking-card"><header><div><small>NEAR MY RANK</small><h2>내 주변 개인 랭킹</h2></div><button data-action="full-ranking">전체 보기 ↗</button></header>${modeTabs()}${rankRows(nearby(state))}</section>`; }
function statusPage() {
  const info = summary(state), percentile = Math.max(1, Math.round((1 - info.rank / info.total) * 100));
  return `${verified()}<section class="hero"><div class="flare"></div><small>SSANGMUN PERSONAL LEAGUE · S01</small><h1>쌍문동의 순위가<br><b>오늘도 움직인다.</b></h1><div class="hero-grid"><div class="place"><span>MY RANK</span><strong>${info.rank}</strong><i>/ ${info.total}</i></div><div class="score"><span>${info.label}</span><b>${fmt(info.value)}<i>${info.unit}</i></b><small>상위 ${percentile}% · 자동 반영</small></div></div><footer><span>시즌 호칭</span><b>쌍문동 움직임의 씨앗</b><i>↗</i></footer></section><div class="ticker"><span>쌍문동 현황</span><b>354명</b><i></i><span>이번 주 활동</span><b>186명</b><i></i><span>내 점수</span><b>${fmt(info.value)}pt</b></div>${compactRanking()}<button class="region-entry" data-page="regional"><span><small>NEXT / DISTRICT LEAGUE</small><b>지역의 열기와 랭커를 한눈에</b></span><i>→</i></button>`;
}
function rankingPage() {
  const info = summary(state), top = topTen(state), mineOutside = info.rank > 10;
  return `${verified()}<div class="page-head"><small>PERSONAL RANKING</small><h1>쌍문동 개인 랭킹</h1><p>종목별 기록은 섞지 않고 같은 기준 안에서 비교합니다.</p></div>${modeTabs()}<section class="full-list">${rankRows(top)}${mineOutside ? `<div class="ellipsis">•••</div>${rankRows([nearby(state)[2]])}` : ""}</section><p class="footnote">액티비티는 운동량·강도·꾸준함을 반영하며, PB는 종목과 세부 기록별로 별도 산정됩니다.</p>`;
}
function heatMap() { return `<div class="heat-map" aria-label="지역 경쟁 열기 지도">${districts.map((d, i) => `<button data-district="${d.name}" style="--heat:${d.heat / 100}" class="heat h${i} ${state.selectedDistrict === d.name ? "active" : ""}" aria-pressed="${state.selectedDistrict === d.name}"><b>${d.name}</b><small>${d.heat}°</small></button>`).join("")}</div>`; }
function regionalPage() {
  const d = selectedDistrict(state), rivals = districts.filter((x) => x.name !== d.name).sort((a,b) => Math.abs(a.score-d.score)-Math.abs(b.score-d.score)).slice(0,2);
  return `<div class="regional-head"><button data-action="back">‹</button><span><small>DISTRICT LEAGUE / PREVIEW</small><h1>지역 리그</h1></span><button data-action="rules">쟁탈 규칙</button></div><p class="regional-copy">진할수록 경쟁이 뜨겁습니다.<br>지역을 눌러 랭커와 현황을 확인하세요.</p>${heatMap()}<div class="legend"><span>낮은 열기</span><i></i><span>과열 지역</span></div><section class="district-panel"><header><div><small>${d.region} · 경쟁 열기 ${d.heat}°</small><h2>${d.name}</h2></div><b>#${districts.indexOf(d)+1}</b></header><div class="district-stats"><div><b>${fmt(d.members)}</b><small>지역 인원</small></div><div><b>${fmt(d.participants)}</b><small>리그 참여</small></div><div><b>${participation(d)}%</b><small>활성 대비 참여율</small></div><div><b>${fmt(d.score)}</b><small>지역 점수</small></div></div><div class="leader"><span>${d.leader[0]}</span><div><small>THIS REGION RANKER</small><b>${d.leader}</b><p>${d.title}</p></div><em>1</em></div></section><section class="rivals"><small>가장 치열한 경쟁 지역</small>${rivals.map((r) => `<button data-district="${r.name}"><span>${r.name}<small>${r.title} · ${r.leader}</small></span><b>${fmt(r.score)}pt</b></button>`).join("")}</section><div class="future-note"><b>향후 지역 리그 전환 영역</b><p>현재는 지역 현황과 대표 랭커를 보여주고, 서비스 데이터가 충분해지면 동네 대표 크루 간 액티비티·퍼포먼스 경쟁으로 확장합니다.</p></div>`;
}
function render() {
  state.page = ["status", "ranking", "regional"].includes(state.page) ? state.page : "status";
  $("#screen-title").textContent = state.page === "regional" ? "DISTRICT" : "LEAGUE";
  $("#screen").innerHTML = `<div class="content">${state.page === "status" ? statusPage() : state.page === "ranking" ? rankingPage() : regionalPage()}</div>`;
  document.querySelectorAll("[data-page]").forEach((b) => b.classList.toggle("active", b.dataset.page === state.page));
  $(".back").style.visibility = state.page === "status" ? "hidden" : "visible";
  $("#sim-status").textContent = `활동 +${state.activityBonus}pt · 활동일 +${state.attendanceBonus} · PB ${state.pb ? "갱신됨" : "변화 없음"}`;
}
function modal() { $("#modal").innerHTML = `<div class="scrim"><section class="sheet" role="dialog" aria-modal="true" aria-label="동네 쟁탈 규칙"><header><h2>동네 쟁탈 규칙</h2><button data-action="close" aria-label="닫기">×</button></header><ol><li>초기에는 인증된 같은 동네 주민끼리 개인 순위를 겨룹니다.</li><li>액티비티와 러닝·근력·사이클·다이빙·수영 PB는 분리합니다.</li><li>향후 지역 리그는 GROOV 회원·활성 사용자·실제 참여자 데이터를 기반으로 보정합니다.</li><li>지역 과열도는 순위 변동, 점수 격차, 참여율을 조합해 표시합니다.</li></ol></section></div>`; }
document.addEventListener("click", (event) => {
  const b = event.target.closest("button"); if (!b) return;
  if (b.dataset.page) { state.page = b.dataset.page; save(); render(); return; }
  if (b.dataset.mode) { state.mode = b.dataset.mode; save(); render(); return; }
  if (b.dataset.district) { state.selectedDistrict = b.dataset.district; save(); render(); return; }
  if (b.dataset.sim) { state = simulate(state, b.dataset.sim); save(); render(); toast("연동된 운동 기록이 자동 반영됐습니다."); return; }
  if (b.dataset.action === "full-ranking") { state.page = "ranking"; save(); render(); return; }
  if (b.dataset.action === "back") { state.page = "status"; save(); render(); return; }
  if (b.dataset.action === "rules") { modal(); return; }
  if (b.dataset.action === "close") { $("#modal").innerHTML = ""; return; }
  if (b.dataset.action === "reset") { state = initial(); save(); render(); toast("MVP 상태를 초기화했습니다."); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#modal").innerHTML = ""; });
render();
