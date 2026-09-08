import { NAV_ICONS } from './nav-icons.mjs';
import {
  sports,
  concepts,
  personas,
  initialState,
  loadState,
  progress,
  completeSession,
  toggle,
} from "./model.mjs";
const $ = (s) => document.querySelector(s),
  key = "groov-tab-lab-v1";
let state;
try {
  state = loadState(localStorage.getItem(key));
} catch {
  state = initialState();
}
let concept = "today",
  sport = "running",
  tab = "second",
  hub = "overview",
  session = null,
  timer = null,
  photoURL = null,
  editorColor = "#202720";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  plus: "M12 4v16M4 12h16",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  user: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-3a8 6 0 0 1 16 0v3",
  run: "M14 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2M9 8l4-1 3 5h4M12 8l-2 6 5 3-1 5M10 14l-4 5H2M9 8l-3 4H3",
  bike: "M5 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8M19 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8M5 17l5-9 5 9H5M15 17l3-12h3M8 5h5",
  mountain: "m2 21 8-17 5 10 2-4 5 11ZM7 11l3 3 3-3",
  waves: "M2 6q3-4 6 0t6 0 6 0M2 12q3-4 6 0t6 0 6 0M2 18q3-4 6 0t6 0 6 0",
  dumbbell: "m6 6 12 12M2 8l6-6 3 3-6 6ZM13 19l6-6 3 3-6 6Z",
  medal: "m8 2 4 6 4-6M12 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14m0 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  close: "m6 6 12 12M6 18 18 6",
  bell: "M5 17h14l-2-4V9a5 5 0 0 0-10 0v4ZM10 21h4",
  heart: "M12 21 3 12C-2 5 7 0 12 7 17 0 26 5 21 12Z",
  check: "m4 12 5 5L20 6",
  ...NAV_ICONS,
};
function icon(name) {
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name] || paths.grid}"/></svg>`;
}
const fmt = (n) => Number(n).toLocaleString("ko-KR");
function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    toast("저장 공간을 사용할 수 없어 이번 화면에서만 유지됩니다.");
  }
}
let toastTimeout;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $("#toast").classList.remove("show"), 2500);
}
function action(label, code, cls = "primary") {
  return `<button class="${cls}" data-action="${code}"><span>${label}</span><span>↗</span></button>`;
}
function section(title, code = "", label = "모두 보기") {
  return `<div class="section-head"><h3>${title}</h3>${code ? `<button data-action="${code}">${label} ↗</button>` : ""}</div>`;
}
function photo(s) {
  return s === "cycling"
    ? ""
    : `<img src="/media/${sports[s].hero}" alt="${sports[s].name} 분위기 이미지">`;
}
function routeGraphic() {
  return `<div class="route-graphic"><svg viewBox="0 0 320 130" role="img" aria-label="실제 지도가 아닌 코스 형태 예시"><path d="M-20 80C70 115 125-10 180 30S260 80 340 25" fill="none" stroke="#70968b" stroke-width="22" opacity=".35"/><path d="M75 87 100 54 144 64 177 26 240 42 248 82 202 110 160 90 118 108Z" fill="none" stroke="#ff724d" stroke-width="3" stroke-linejoin="round"/><circle cx="75" cy="87" r="5" fill="#ecf3df"/></svg><span>코스 형태 예시 · 실제 지도 아님</span></div>`;
}
function picker() {
  return `<div class="sport-picker" aria-label="종목 선택">${Object.entries(sports)
    .map(
      ([id, s]) =>
        `<button data-sport="${id}" class="${sport === id ? "active" : ""}" aria-pressed="${sport === id}">${icon(s.icon)}${s.name}</button>`,
    )
    .join("")}</div>`;
}
function goalCard() {
  const s = sports[sport],
    p = progress(state, sport);
  return `<button class="small-card" data-action="goal"><div class="goal-row"><span>${s.label}</span><span><strong>${fmt(p.total)}</strong> / ${fmt(p.target)}${s.unit}</span></div><div class="progress" role="progressbar" aria-label="목표 진행률" aria-valuenow="${Math.min(100, Math.round((p.total / p.target) * 100))}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, (p.total / p.target) * 100)}%"></i></div><p>${p.total >= p.target ? "목표 달성! 다음 목표를 골라보세요." : `${fmt(Math.max(0, p.target - p.total))}${s.unit} 더 쌓으면, 나의 다음 성취.`} ↗</p></button>`;
}
function weekly() {
  return `${section("이번 주, 잘하고 있어요", "history", "기록 보기")}<div class="week">${["월", "화", "수", "목", "금", "토", "일"].map((d, i) => `<div class="day ${i === 0 || i === 2 || (i === 3 && state.sessions.length) ? "done" : i === 3 ? "current" : ""}"><span>${d}</span><b>${i === 0 || i === 2 || (i === 3 && state.sessions.length) ? "✓" : i + 1}</b></div>`).join("")}</div><p class="muted">${2 + state.sessions.length}번의 움직임 · 이번 주 목표 4회</p>`;
}
function recommendation(hybrid = false) {
  const s = sports[sport];
  return `<article class="hero ${hybrid ? "hybrid-hero" : ""}">${photo(sport)}<span class="tag">${hybrid ? "FOR YOUR " + s.en : "TODAY’S PICK · " + s.time + " MIN"}</span><h2>${hybrid ? s.action : "오늘은 가볍게,<br>다시 움직여볼까요?"}</h2><p>${hybrid ? `${s.label} 목표에 한 걸음 더 · ${s.time}분` : `${s.action} · 짧고 분명한 오늘의 한 가지`}</p>${action("이 운동 시작하기", "start")}</article>`;
}
function mission() {
  const s = sports[sport],
    joined = state.joined.includes(sport);
  return `<button class="small-card" data-action="mission"><div class="wide-row"><div class="medal">${sport === "running" ? "20" : sport === "swimming" ? "10K" : "03"}</div><div><span class="eyebrow">WEEKLY QUEST</span><h4>${s.challenge}</h4><p>${joined ? "참여 중 · 나의 기록으로 함께 채우는 목표" : "혼자보다 함께, 조금 더 멀리."} ↗</p></div></div></button>`;
}
function people() {
  const s = sports[sport];
  return `<button class="small-card" data-action="people"><div class="people-line">${s.people.map((n) => `<span class="avatar">${n[0]}</span>`).join("")}<span>같은 ${s.name}, 다른 움직임</span></div><h4>${s.crew}</h4><p>운동으로 이어진 사람들을 만나보세요 ↗</p></button>`;
}
function today() {
  sport = "running";
  return `<div class="app-content"><div class="greeting"><span class="overline">MAKE TODAY YOURS</span><span class="date">THU, SEP 03</span></div><h2>좋은 하루는<br>작은 움직임에서.</h2>${recommendation()}${weekly()}${goalCard()}${section("작은 도전, 새로운 나", "mission", "미션 보기")}${mission()}${section("친구들도 움직이는 중", "people", "만나기")}${people()}</div>`;
}
function records() {
  const s = sports[sport];
  return `${section("나의 최근 기록", "history", "전체 기록")}${[
    ...state.sessions
      .filter((x) => x.sport === sport)
      .slice(-2)
      .reverse()
      .map((x) => ({
        v: `${fmt(x.amount)} ${s.unit}`,
        d: "방금 · MVP 체험 기록",
        m: "이 브라우저에 저장됨",
      })),
    { v: s.record, d: "8월 28일 · 샘플 기록", m: s.metric },
    {
      v: sport === "strength" ? "16 sets" : s.record,
      d: "8월 25일 · 샘플 기록",
      m: "나의 지난 움직임",
    },
  ]
    .map(
      (x) =>
        `<button class="record-row" data-action="record"><div><small>${x.d}</small><b>${x.v}</b><small>${x.m}</small></div>${icon("arrow")}</button>`,
    )
    .join("")}`;
}
function routeCard() {
  const s = sports[sport],
    indoor = ["swimming", "strength", "diving"].includes(sport);
  return `${section(indoor ? "나에게 맞는 세션" : "다음에 가볼 코스", "route", "자세히")}<button class="small-card" data-action="route">${indoor ? `<div class="wide-row">${icon(s.icon)}<span class="eyebrow">${s.en} SESSION</span></div>` : routeGraphic()}<h4>${s.route}</h4><p>${s.routeInfo} ↗</p></button>`;
}
function medalCard() {
  const s = sports[sport],
    p = progress(state, sport);
  return `${section("나의 다음 메달", "medals", "컬렉션")}<button class="small-card" data-action="medals"><div class="wide-row"><div class="medal">${p.total >= p.target ? "✓" : "G"}</div><div><h4>${s.medal}</h4><p>${p.total >= p.target ? "달성 완료 · 체험 기록 반영됨" : `${fmt(p.total)} / ${fmt(p.target)}${s.unit} · 목표를 채워 획득`}</p></div></div></button>`;
}
function feed() {
  const s = sports[sport];
  return `${section(`${s.name} 하는 사람들`, "people", "러너·크루")}<article class="small-card"><div class="people-line"><span class="avatar">${s.people[0][0]}</span><div><b>${s.people[0]}</b><p>샘플 활동 · ${s.name}</p></div></div>${sport === "cycling" ? routeGraphic() : `<img class="feed-photo" src="/media/${s.hero}" alt="${s.name} 피드 예시">`}<p style="color:#e6eddf">${s.feed}</p><button class="small-link" data-action="like">${state.joined.includes("like-" + sport) ? "♥ 좋아요 취소" : "♡ 응원하기"}</button></article>${section("같은 종목의 크루", "people", "모두 보기")}${people()}`;
}
function sportHub() {
  const s = sports[sport],
    p = progress(state, sport);
  return `${picker()}<div class="app-content"><div class="hero sport-hero">${photo(sport)}<span class="tag">YOUR SPORT, YOUR WORLD</span><h2>${s.en}</h2><p>${s.title}</p></div><div class="hub-stats"><div><strong>${fmt(p.total)}<small>${s.label} · ${s.unit}</small></strong></div><div><strong>${3 + state.sessions.filter((x) => x.sport === sport).length}<small>나의 기록</small></strong></div><div><strong>${p.total >= p.target ? "03" : "02"}<small>획득 메달 · 샘플</small></strong></div></div><div class="hub-tabs" aria-label="종목 허브 메뉴">${[
    ["overview", "전체"],
    ["records", "기록"],
    ["achieve", "성취"],
    ["routes", ["swimming", "strength", "diving"].includes(sport) ? "세션" : "루트"],
    ["people", "피드·크루"],
  ]
    .map(
      ([id, label]) =>
        `<button class="${hub === id ? "active" : ""}" data-hub="${id}" aria-pressed="${hub === id}">${label}</button>`,
    )
    .join(
      "",
    )}</div>${hub === "overview" ? `${records()}${medalCard()}${routeCard()}${section("함께 움직이는 사람들")}${people()}` : hub === "records" ? records() : hub === "achieve" ? `${section("나의 목표")}${goalCard()}${medalCard()}${section("함께 도전")}${mission()}` : hub === "routes" ? routeCard() : feed()}<div class="top-spaced">${action(`${s.name} 기록 시작`, "start")}</div></div>`;
}
function hybrid() {
  const s = sports[sport];
  return `${picker()}<div class="app-content"><div class="hybrid-head"><strong>YOUR ${s.en} TODAY</strong><span class="overline">SEP 03</span></div><p class="muted" style="margin:0">${s.name}로 채우는 오늘, 나답게.</p>${recommendation(true)}${section("오늘의 움직임이, 목표가 되도록", "goal", "목표 변경")}${goalCard()}${section(`${s.name}의 세계로 더 깊이`)}<div class="split"><button class="small-card" data-action="history"><span class="eyebrow">MY RECORDS</span><h4>내 기록 ↗</h4><p>${s.record} · 최근 기록</p></button><button class="small-card" data-action="medals"><span class="eyebrow">NEXT ACHIEVEMENT</span><h4>다음 메달 ↗</h4><p>${s.medal}</p></button></div>${routeCard()}${section("혼자가 아닌 움직임", "people", "크루 보기")}${mission()}<div class="top-spaced">${people()}</div></div>`;
}
function shellPage() {
  if (tab === "home")
    return `<div class="app-content"><span class="overline">HOME · 기존 역할 유지</span><h2>우리의 움직임이<br>모이는 곳.</h2><p class="muted">홈은 관계와 활동을 보는 피드로 유지합니다.<br>이 시안에서는 2번 탭의 방향을 비교합니다.</p>${feed()}</div>`;
  if (tab === "nearby")
    return `<div class="app-content"><span class="overline">NEIGHBORHOOD · 기존 역할 유지</span><h2>가까워서,<br>함께할 수 있는.</h2>${routeGraphic()}${section("우리 동네의 움직임")}${people()}<p class="fineprint">지역 역할을 유지하는 자리 표시용 샘플입니다. 실제 위치를 사용하지 않습니다.</p></div>`;
  return `<div class="app-content"><div class="avatar">나</div><h2>나의 GROOV</h2><p class="muted">MY · 내 기록과 성취를 모으는 역할 유지</p>${section("이 MVP에서 만든 기록", "history", "보기")}<div class="hub-stats"><div><strong>${state.sessions.length}<small>완료한 체험</small></strong></div><div><strong>${state.joined.filter((x) => !x.startsWith("like-")).length}<small>참여 미션</small></strong></div><div><strong>${state.following.length}<small>팔로우</small></strong></div></div>${records()}<div class="top-spaced">${action("콘텐츠 편집 체험", "editor")}</div></div>`;
}
function render() {
  document.querySelectorAll("[data-concept]").forEach((b) => {
    b.classList.toggle("active", b.dataset.concept === concept);
    b.setAttribute("aria-pressed", String(b.dataset.concept === concept));
  });
  $("#app").innerHTML =
    `<header class="app-header"><span class="app-logo">GROOV</span><div class="people-line"><button class="icon-button" aria-label="알림" data-action="notifications">${icon("bell")}</button><button class="icon-button" aria-label="내 프로필" data-tab="my"><span class="avatar">나</span></button></div></header>${tab === "second" ? (concept === "today" ? today() : concept === "sport" ? sportHub() : hybrid()) : shellPage()}`;
  $("#bottom-nav").innerHTML = [
    ["home", "홈", "home"],
    [
      "second",
      concept === "today" ? "TODAY" : concept === "sport" ? "SPORT" : "TODAY",
      concept === "sport" ? "grid" : "sun",
    ],
    ["plus", "새 기록", "plus"],
    ["nearby", "리그", "trophy"],
    ["my", "MY", "user"],
  ]
    .map(
      ([id, label, i]) =>
        `<button data-tab="${id}" aria-label="${label}" class="${tab === id ? "active" : ""}" aria-current="${tab === id ? "page" : "false"}">${id === "plus" ? `<span class="plus">${icon(i)}</span>` : icon(i)}${id === "plus" ? "" : `<span>${label}</span>`}</button>`,
    )
    .join("");
  renderReview();
}
function renderReview() {
  const c = concepts[concept],
    r = state.reviews[concept] || {};
  $("#variant-number").textContent = c.number + " / 03";
  $("#direction-title").textContent = c.title;
  $("#direction-desc").textContent = c.desc;
  $("#try-list").innerHTML = c.steps.map((s) => `<li>${s}</li>`).join("");
  $("#ratings").innerHTML =
    personas
      .map(
        ([id, name, question]) =>
          `<div class="rating"><div><b>${name}</b><p>${question}</p></div><div><div class="rating-buttons" aria-label="${name} 평가">${[1, 2, 3, 4, 5].map((n) => `<button data-rating="${id}" data-score="${n}" class="${r[id] === n ? "active" : ""}" aria-label="${name} ${n}점" aria-pressed="${r[id] === n}">${n}</button>`).join("")}</div></div></div>`,
      )
      .join("") + '<span class="score-label">1 부족함 — 5 충분함</span>';
  $("#note").value = r.note || "";
  $("#choice-status").textContent = state.chosen
    ? `${concepts[state.chosen].name}을 현재 후보로 선택했습니다.`
    : "평가와 메모는 이 브라우저에만 저장됩니다.";
}
let lastFocus;
function sheet(title, body) {
  if (!$("#overlay").innerHTML) lastFocus = document.activeElement;
  $("#overlay").innerHTML =
    `<div class="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-button" data-action="close" aria-label="닫기">${icon("close")}</button></div>${body}</section></div>`;
  $("#overlay button")?.focus();
}
function close() {
  if (session) return toast("진행 중인 체험을 완료하거나 취소해 주세요.");
  $("#overlay").innerHTML = "";
  if (photoURL) {
    URL.revokeObjectURL(photoURL);
    photoURL = null;
  }
  lastFocus?.isConnected && lastFocus.focus();
}
function sessionView() {
  const s = sports[session.sport];
  sheet(
    "운동 기록 체험",
    `<div class="session-sport">${s.en}</div><div class="timer" id="timer">00:00</div><div class="timer-label">실시간 타이머 · GPS 및 운동량 측정 없음</div><p>${s.action}</p><p class="fineprint">완료 시 입력한 운동량을 샘플 목표에 반영합니다. 실제 운동 수행을 인증하지 않습니다.${session.sport === "diving" ? " 실제 프리다이빙은 자격 있는 지도자와 버디의 감독 하에 진행해야 합니다." : ""}</p><label>체험할 완료량 (${s.unit})<input id="session-amount" type="number" min="0.1" max="100000" step="0.1" value="${s.amount}"></label><div class="stack"><button class="secondary" data-action="pause" id="pause">일시 정지</button>${action("이 운동량 완료로 체험", "finish")}<button class="small-link" data-action="cancel-session">체험 취소</button></div>`,
  );
  updateTimer();
  clearInterval(timer);
  timer = setInterval(updateTimer, 500);
}
function elapsed() {
  return session ? session.elapsed + (session.paused ? 0 : Date.now() - session.started) : 0;
}
function updateTimer() {
  if ($("#timer")) {
    const n = Math.floor(elapsed() / 1000);
    $("#timer").textContent =
      String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  }
}
function openEditor() {
  sheet(
    "통합 콘텐츠 편집 · 체험",
    `<span class="status-pill">+ 공통 진입 · 독립 MVP</span><div class="mini-editor" id="mini-editor"><span class="drag-text" id="drag-text">오늘도 한 걸음.</span></div><div class="editor-colors">${["#f1eee4", "#202720", "#ff613b"].map((c) => `<button aria-label="${c} 배경" data-color="${c}" style="background:${c}"></button>`).join("")}</div><label>사진 추가<input type="file" id="editor-photo" accept="image/*"></label><label>사진 위 코멘트<input id="editor-text" maxlength="100" value="오늘도 한 걸음."></label><p class="fineprint">캔버스의 글씨를 직접 드래그할 수 있습니다. 전체 편집툴을 복제하지 않은 진입 흐름 확인용입니다.</p>${action("체험 콘텐츠 저장", "save-editor")}`,
  );
  wireDrag();
}
function wireDrag() {
  const el = $("#drag-text");
  let start;
  el.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY, left: el.offsetLeft, top: el.offsetTop };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (start) {
      el.style.left = start.left + e.clientX - start.x + "px";
      el.style.top = start.top + e.clientY - start.y + "px";
    }
  });
  el.addEventListener("pointerup", () => (start = null));
  el.addEventListener("pointercancel", () => (start = null));
}
function detail(code) {
  const s = sports[sport],
    p = progress(state, sport);
  switch (code) {
    case "start":
      sheet(
        "오늘의 운동",
        `<span class="status-pill">${s.en} · ${s.time}분</span><h2>${s.action}</h2><p>${s.title}</p>${routeGraphic()}<p class="fineprint">미리 정한 샘플 세션입니다. 실시간 코스 안내나 맞춤 훈련 처방은 제공하지 않습니다.</p>${action("세션 시작", "begin")}`,
      );
      break;
    case "goal":
      sheet(
        "나의 다음 목표",
        `<p>${s.name} · 현재 ${fmt(p.total)}${s.unit}. 어느 지점까지 가볼까요?</p><div class="stack">${[s.target, Math.round(s.target * 1.5), s.target * 2].map((n) => `<button class="secondary" data-goal="${n}">${fmt(n)}${s.unit} 목표 ${p.target === n ? "✓" : ""}</button>`).join("")}</div><p class="fineprint">목표 선택은 세 안에 공통 반영됩니다.</p>`,
      );
      break;
    case "mission":
      sheet(
        s.challenge,
        `<div class="wide-row"><div class="medal">G</div><div><span class="status-pill">주간 크루 미션 · 샘플</span><p>${s.crew}</p></div></div><p>이번 주에는 같은 운동을 하는 사람들과 꾸준함을 쌓아보세요. 참여 상태와 체험 완료 기록이 이 MVP에 저장됩니다.</p><div class="goal-row"><span>나의 체험 완료</span><strong>${state.sessions.filter((x) => x.sport === sport).length}회</strong></div>${action(state.joined.includes(sport) ? "미션 참여 취소" : "이 미션에 참여", "join")}`,
      );
      break;
    case "people":
      sheet(
        `${s.name}의 사람들`,
        `<div class="stack">${s.people.map((n, i) => `<div class="people-line"><span class="avatar">${n[0]}</span><div style="flex:1"><b>${n}</b><p style="margin:0;font-size:10px">${i === 0 ? "꾸준한 기록" : i === 1 ? "새로운 도전" : "함께하는 운동"} · 샘플 사용자</p></div><button class="small-link" data-follow="${sport}-${n}">${state.following.includes(sport + "-" + n) ? "팔로잉 ✓" : "팔로우 +"}</button></div>`).join("")}</div><h3>${s.crew}</h3><p>같은 종목으로 만나는 크루. 실제 모집이나 메시지 전송은 하지 않습니다.</p>${action("크루 미션 살펴보기", "mission")}`,
      );
      break;
    case "route": {
      const indoor = ["strength", "swimming", "diving"].includes(sport);
      sheet(
        s.route,
        `${indoor ? `<div class="session-sport">${s.en}</div>` : routeGraphic()}<p>${s.routeInfo}</p><ul>${(sport === "strength" ? ["워밍업으로 시작", "전신 움직임 4종목", "운동량을 기록하고 회복 체크"] : sport === "swimming" ? ["오늘의 거리 목표 확인", "수영장 환경과 컨디션 확인", "세션 종료 후 거리 기록"] : sport === "diving" ? ["버디 및 지도자 확인", "시설의 안전 수칙 확인", "버디 동행 세션으로 기록"] : ["코스 형태와 예상 거리 확인", "오늘의 목표에 맞게 선택", "시작 버튼으로 기록 흐름 연결"]).map((x) => `<li>${x}</li>`).join("")}</ul><p class="fineprint">실제 장소·길 안내·훈련 처방이 아닌 인터랙션 예시입니다.</p>${action("이 세션으로 시작", "start")}`,
      );
      break;
    }
    case "medals":
      sheet(
        "나의 성취 컬렉션",
        `<div class="wide-row"><div class="medal">G</div><div><h3>${s.medal}</h3><p>${p.total >= p.target ? "목표 달성" : "도전 중"} · ${fmt(p.total)} / ${fmt(p.target)}${s.unit}</p></div></div><div class="stack"><div class="small-card"><h4>첫 기록</h4><p>한 번의 시작 · 획득한 샘플 메달</p></div><div class="small-card"><h4>다시 돌아온 나</h4><p>꾸준한 운동 · 획득한 샘플 메달</p></div></div>${action("다음 목표 선택", "goal")}`,
      );
      break;
    case "record":
      sheet(
        "기록 상세",
        `<span class="status-pill">${s.name} · 샘플 기록</span><div class="timer" style="font-size:48px">${s.record}</div><p style="text-align:center">${s.metric}</p><p>기록은 종목에 맞는 지표로 봅니다. 러닝은 페이스, 사이클은 속도, 헬스는 세트와 볼륨처럼 달라집니다.</p>${action("이 기록으로 콘텐츠 만들기", "editor")}`,
      );
      break;
    case "history":
      sheet(
        "나의 기록",
        `${
          state.sessions.length
            ? state.sessions
                .slice()
                .reverse()
                .map(
                  (x) =>
                    `<div class="record-row"><div><small>${sports[x.sport].name} · MVP 체험</small><b>${fmt(x.amount)} ${sports[x.sport].unit}</b><small>${new Date(x.at).toLocaleString("ko-KR")}</small></div>${icon("check")}</div>`,
                )
                .join("")
            : "<p>아직 완료한 체험이 없습니다. 세션을 시작하고 완료해 보세요.</p>"
        }<div class="top-spaced">${action("새 운동 시작", "start")}</div>`,
      );
      break;
    case "notifications":
      sheet(
        "체험 알림",
        `<p>실제 알림 대신, 이 MVP에서 일어난 일을 보여줍니다.</p>${state.sessions.length ? `<div class="small-card"><h4>새 움직임이 저장됐어요</h4><p>${state.sessions.length}번의 체험 기록이 목표에 반영됐습니다.</p></div>` : '<div class="empty-state">아직 새 활동이 없습니다.</div>'}${state.joined.includes(sport) ? `<p>${s.challenge}에 참여 중입니다.</p>` : ""}`,
      );
      break;
    case "editor":
      openEditor();
      break;
    case "compare":
      sheet(
        "세 방향, 나의 평가",
        `${Object.entries(concepts)
          .map(([id, c]) => {
            const r = state.reviews[id] || {};
            return `<section class="comparison-row"><h3>${c.name} ${state.chosen === id ? "✓" : ""}</h3><div class="scores">${personas.map(([k, n]) => `<span>${n} ${r[k] || "—"}/5</span>`).join("")}</div><p>${esc(r.note || "아직 메모가 없습니다.")}</p></section>`;
          })
          .join(
            "",
          )}<p class="fineprint">위 점수는 사용자가 직접 입력한 평가입니다. 자동 추천 순위가 아닙니다.</p>${action("평가 파일 다운로드", "export")}`,
      );
      break;
    case "plus":
      sheet(
        "무엇을 남길까요?",
        `<span class="status-pill">통합 기록 · 콘텐츠 편집툴</span><h2>움직임도, 그 순간도.</h2><p>어느 페이지에서든 +는 같은 곳으로 연결됩니다.</p><div class="stack">${action("운동 시작해서 기록하기", "start")}${action("사진 · 기록으로 콘텐츠 만들기", "editor", "primary light")}</div>`,
      );
      break;
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.concept) {
    if (session) return toast("진행 중인 체험을 먼저 완료해 주세요.");
    close();
    concept = b.dataset.concept;
    tab = "second";
    hub = "overview";
    render();
    $("#app").scrollTop = 0;
    return;
  }
  if (b.dataset.sport) {
    sport = b.dataset.sport;
    hub = "overview";
    render();
    return;
  }
  if (b.dataset.hub) {
    hub = b.dataset.hub;
    render();
    return;
  }
  if (b.dataset.tab) {
    if (b.dataset.tab === "plus") detail("plus");
    else {
      tab = b.dataset.tab;
      render();
      $("#app").scrollTop = 0;
    }
    return;
  }
  if (b.dataset.rating) {
    state.reviews[concept] = {
      ...state.reviews[concept],
      [b.dataset.rating]: Number(b.dataset.score),
    };
    persist();
    renderReview();
    return;
  }
  if (b.dataset.goal) {
    state.goals[sport] = Number(b.dataset.goal);
    persist();
    close();
    render();
    toast("새 목표가 세 안에 공통 반영됐습니다.");
    return;
  }
  if (b.dataset.follow) {
    state.following = toggle(state.following, b.dataset.follow);
    persist();
    detail("people");
    return;
  }
  if (b.dataset.color) {
    editorColor = b.dataset.color;
    $("#mini-editor").style.background = editorColor;
    $("#drag-text").style.color = editorColor === "#f1eee4" ? "#202720" : "#fff";
    return;
  }
  const a = b.dataset.action;
  if (!a) return;
  if (a === "close") return close();
  if (a === "begin") {
    session = { id: crypto.randomUUID(), sport, started: Date.now(), elapsed: 0, paused: false };
    sessionView();
    return;
  }
  if (a === "pause") {
    if (session.paused) {
      session.started = Date.now();
      session.paused = false;
    } else {
      session.elapsed = elapsed();
      session.paused = true;
    }
    $("#pause").textContent = session.paused ? "다시 시작" : "일시 정지";
    updateTimer();
    return;
  }
  if (a === "cancel-session") {
    session = null;
    clearInterval(timer);
    close();
    return;
  }
  if (a === "finish") {
    const amount = Number($("#session-amount").value);
    if (!(amount > 0 && amount <= 100000))
      return toast("0보다 크고 100,000 이하인 값을 입력해 주세요.");
    const s = sports[session.sport];
    state = completeSession(state, {
      id: session.id,
      sport: session.sport,
      amount,
      seconds: Math.floor(elapsed() / 1000),
      at: new Date().toISOString(),
    });
    session = null;
    clearInterval(timer);
    persist();
    render();
    sheet(
      "오늘의 움직임, 저장 완료",
      `<div class="empty-state">${icon("check")}<h2>${fmt(amount)} ${s.unit}<br>한 걸음 더 쌓였어요.</h2><p>체험 기록과 목표 진행도가 업데이트됐습니다.</p></div><div class="stack">${action("업데이트된 화면 보기", "close")}${action("이 순간으로 콘텐츠 만들기", "editor", "primary light")}</div>`,
    );
    return;
  }
  if (a === "join") {
    state.joined = toggle(state.joined, sport);
    persist();
    close();
    render();
    toast(state.joined.includes(sport) ? "미션에 참여했습니다." : "미션 참여를 취소했습니다.");
    return;
  }
  if (a === "like") {
    state.joined = toggle(state.joined, "like-" + sport);
    persist();
    render();
    return;
  }
  if (a === "choose") {
    state.chosen = concept;
    persist();
    renderReview();
    toast("현재 비교 후보로 선택했습니다.");
    return;
  }
  if (a === "reset") {
    sheet(
      "체험을 초기화할까요?",
      `<p>이 MVP의 체험 기록·미션·평가·메모만 지웁니다. 기존 GROOV 앱에는 영향을 주지 않습니다.</p><div class="stack">${action("MVP 데이터 초기화", "confirm-reset")}${action("유지하기", "close", "primary light")}</div>`,
    );
    return;
  }
  if (a === "confirm-reset") {
    state = initialState();
    session = null;
    clearInterval(timer);
    persist();
    close();
    render();
    toast("이 MVP의 체험 데이터만 초기화했습니다.");
    return;
  }
  if (a === "save-editor") {
    state.reviews[concept] = { ...state.reviews[concept], lastContent: $("#editor-text").value };
    persist();
    close();
    toast("체험 코멘트를 저장했습니다. 실제 피드에는 게시하지 않습니다.");
    return;
  }
  if (a === "export") {
    const blob = new Blob(
      [
        JSON.stringify(
          { exportedAt: new Date().toISOString(), chosen: state.chosen, reviews: state.reviews },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "groov-tab-comparison.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  detail(a);
});
$("#note").addEventListener("input", (e) => {
  state.reviews[concept] = { ...state.reviews[concept], note: e.target.value };
  persist();
});
document.addEventListener("input", (e) => {
  if (e.target.id === "editor-text") $("#drag-text").textContent = e.target.value;
});
document.addEventListener("change", (e) => {
  if (e.target.id === "editor-photo") {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 15000000)
      return toast("15MB 이하의 이미지 파일을 선택해 주세요.");
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = URL.createObjectURL(file);
    let image = $("#mini-editor img");
    if (!image) {
      image = document.createElement("img");
      image.alt = "선택한 사진";
      $("#mini-editor").prepend(image);
    }
    image.src = photoURL;
  }
});
document.addEventListener("keydown", (e) => {
  const modal = $(".sheet");
  if (!modal) return;
  if (e.key === "Escape") close();
  if (e.key === "Tab") {
    const els = [...modal.querySelectorAll("button:not(:disabled),input,textarea,select,a[href]")];
    if (e.shiftKey && document.activeElement === els[0]) {
      e.preventDefault();
      els.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
      e.preventDefault();
      els[0]?.focus();
    }
  }
});
render();
