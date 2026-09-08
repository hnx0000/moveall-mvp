/* global document */
(function (root) {
  "use strict";
  const STORAGE_KEY = "groov-dashboard-user-validation-v1";
  const STATUS = { unverified: "미검증", verified: "검증됨", improve: "개선 필요", hold: "보류" };
  const REVIEW_FIELDS = ["round", "date", "owner", "appVersion", "evidence", "next"];
  const FEATURE_FIELDS = ["name", "audience", "value", "evidence", "success", "risk", "decision"];
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value) => (typeof value === "string" ? value.slice(0, 6000) : "");
  function itemKey(group, content) {
    let hash = 2166136261;
    for (const character of content) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    return `${group}-${(hash >>> 0).toString(36)}`;
  }
  function checkedCount(state, group) {
    return group.items.filter((item) => state.checks[item.id]).length;
  }
  function canVerify(state, group) {
    return (
      group.items.length > 0 &&
      checkedCount(state, group) === group.items.length &&
      Boolean(state.reviews[group.id].evidence.trim())
    );
  }
  function normalize(value, groups) {
    const saved = object(value) && value.schemaVersion === 1 ? value : {};
    const state = {
      schemaVersion: 1,
      checks: {},
      reviews: {},
      feature: {},
      updatedAt: text(saved.updatedAt),
    };
    for (const group of groups) {
      for (const item of group.items)
        state.checks[item.id] =
          object(saved.checks) && Object.hasOwn(saved.checks, item.id)
            ? saved.checks[item.id] === true
            : item.baseline === true;
      if (group.id === "common") continue;
      const review =
        object(saved.reviews) && object(saved.reviews[group.id]) ? saved.reviews[group.id] : {};
      state.reviews[group.id] = Object.fromEntries(
        REVIEW_FIELDS.map((field) => [field, text(review[field])]),
      );
      state.reviews[group.id].status = Object.hasOwn(STATUS, review.status)
        ? review.status
        : "unverified";
      if (state.reviews[group.id].status === "verified" && !canVerify(state, group))
        state.reviews[group.id].status = "unverified";
      if (state.reviews[group.id].status === "hold" && !state.reviews[group.id].evidence.trim())
        state.reviews[group.id].status = "unverified";
    }
    for (const field of FEATURE_FIELDS)
      state.feature[field] = object(saved.feature) ? text(saved.feature[field]) : "";
    return state;
  }
  function setCheck(state, group, id, checked) {
    if (!group.items.some((item) => item.id === id)) return "";
    state.checks[id] = checked === true;
    if (
      group.id !== "common" &&
      state.reviews[group.id].status === "verified" &&
      !canVerify(state, group)
    ) {
      state.reviews[group.id].status = "unverified";
      return "확인 항목이 변경되어 미검증으로 되돌렸습니다. 다시 확인한 뒤 판정해 주세요.";
    }
    return "";
  }
  function setReview(state, group, field, value) {
    if (!Object.hasOwn(state.reviews, group.id)) return "";
    const review = state.reviews[group.id];
    if (field === "status") {
      if (!Object.hasOwn(STATUS, value)) return "";
      if (value === "verified" && !canVerify(state, group))
        return "모든 항목을 확인하고 관찰 근거를 작성한 뒤 검증됨으로 변경해 주세요.";
      if (value === "hold" && !review.evidence.trim())
        return "관찰 근거 · 보류 사유에 이유를 먼저 적어 주세요.";
      review.status = value;
    } else if (REVIEW_FIELDS.includes(field)) {
      const previous = review[field];
      review[field] = text(value);
      if (review.status === "verified" && previous !== review[field]) {
        review.status = "unverified";
        return "검증 기록이 바뀌었습니다. 새 내용을 확인한 뒤 검증 상태를 다시 선택해 주세요.";
      }
      if (review.status === "hold" && !review.evidence.trim()) review.status = "unverified";
    }
    return "";
  }
  function totals(state, groups) {
    const personas = groups.filter((group) => group.id !== "common");
    const common = groups.find((group) => group.id === "common");
    return {
      verified: personas.filter(
        (group) => state.reviews[group.id].status === "verified" && canVerify(state, group),
      ).length,
      checked: groups.reduce((sum, group) => sum + checkedCount(state, group), 0),
      total: groups.reduce((sum, group) => sum + group.items.length, 0),
      common: common ? checkedCount(state, common) : 0,
    };
  }
  function load(storage, groups) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      return { state: normalize(raw ? JSON.parse(raw) : null, groups), error: "" };
    } catch {
      return {
        state: normalize(null, groups),
        error: "저장 내역을 읽지 못했습니다. 브라우저 저장 설정을 확인해 주세요.",
      };
    }
  }
  function save(storage, state) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
  root.GroovValidation = {
    STORAGE_KEY,
    itemKey,
    normalize,
    checkedCount,
    canVerify,
    setCheck,
    setReview,
    totals,
    load,
    save,
  };
  const section =
    typeof document !== "undefined" ? document.getElementById("product-validation") : null;
  if (!section) return;

  const create = (tag, className, content) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  };
  const personaIds = ["record", "social", "competition", "achievement"];
  const cards = [...section.querySelectorAll(".validation-grid > .validation-card")];
  const commonCard = [...section.children].find((element) =>
    element.matches("details.validation-card"),
  );
  if (cards.length !== 4 || !commonCard) return;
  const groups = [...cards, commonCard].map((card, index) => {
    const id = personaIds[index] || "common";
    const items = [...card.querySelectorAll(".validation-list > li")].map((row) => {
      const mark = row.querySelector(".validation-mark");
      const content = row.lastElementChild.textContent.trim();
      return { id: itemKey(id, content), content, baseline: mark?.textContent === "✓", row };
    });
    return { id, card, items, badge: card.querySelector(".validation-state") };
  });
  // Keep every persona visible on arrival; the selected card can be expanded in place.
  groups.forEach((group) => {
    group.card.open = false;
  });
  let storage;
  try {
    storage = root.localStorage;
  } catch {
    /* Browser/file storage may be disabled. */
  }
  const loaded = load(storage, groups);
  const state = loaded.state;
  const saveNote = create(
    "p",
    "validation-help",
    loaded.error ||
      "체크·메모는 이 브라우저에 자동 저장됩니다. 브라우저 데이터 삭제 시 지워지며, 원본 문서와 개발 체크 상태는 변경하지 않습니다.",
  );
  saveNote.setAttribute("role", "status");
  section.append(saveNote);
  const toolbar = create("div", "validation-toolbar");
  for (const [label, open] of [
    ["모두 펼치기", true],
    ["모두 접기", false],
  ]) {
    const button = create("button", "validation-button", label);
    button.type = "button";
    button.addEventListener("click", () =>
      groups.forEach((group) => {
        group.card.open = open;
      }),
    );
    toolbar.append(button);
  }
  toolbar.append(
    create("span", "validation-help", "개발 완료가 아닌 실제 사용 결과로 판정합니다."),
  );
  const grid = section.querySelector(".validation-grid");
  section.insertBefore(toolbar, grid);
  const helper = [...section.children].filter((element) => element.matches("p.sub"))[1];
  if (helper) helper.textContent = "① 유형 선택 → ② 실제 사용 확인 → ③ 근거를 적고 판정";
  function persist() {
    state.updatedAt = new Date().toISOString();
    saveNote.textContent = save(storage, state)
      ? `이 브라우저에 저장됨 · ${new Date(state.updatedAt).toLocaleTimeString("ko-KR")} · 원본 문서·개발 체크와 별도 저장`
      : "자동 저장 불가 · 브라우저가 저장을 막고 있습니다. 페이지를 닫으면 이번 입력이 사라질 수 있습니다.";
  }
  function feedback(group, message) {
    if (!group.feedback) return;
    group.feedback.textContent = message;
    group.feedback.hidden = !message;
  }
  function refresh() {
    for (const group of groups) {
      const count = checkedCount(state, group);
      const prefix = group.id === "common" ? "공통" : STATUS[state.reviews[group.id].status];
      group.badge.textContent = `${prefix} · ${count} / ${group.items.length} 확인`;
      group.fill.style.width = `${group.items.length ? (count / group.items.length) * 100 : 0}%`;
      if (group.statusInput) group.statusInput.value = state.reviews[group.id].status;
    }
    const total = totals(state, groups);
    const tiles = section.querySelectorAll(".validation-summary > div");
    const values = [
      [`${total.verified} / 4`, "사용자 유형 검증됨"],
      [`${total.checked} / ${total.total}`, "직접 확인한 항목"],
      [`${total.common} / 5`, "모든 유형의 필수 조건"],
    ];
    tiles.forEach((tile, index) => {
      tile.querySelector("strong").textContent = values[index][0];
      tile.querySelector("span").textContent = values[index][1];
    });
  }
  function field(parent, label, tag, value, placeholder = "", type = "text") {
    const wrapper = create("label", "validation-field", label);
    const input = create(tag);
    input.value = value;
    if (tag !== "select") {
      input.placeholder = placeholder;
      input.maxLength = 6000;
    }
    if (tag === "textarea") input.rows = 3;
    if (tag === "input") input.type = type;
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }
  for (const group of groups) {
    const progress = create("div", "validation-progress");
    progress.setAttribute("aria-hidden", "true");
    group.fill = create("span");
    progress.append(group.fill);
    group.card.querySelector("summary").after(progress);
    for (const item of group.items) {
      const label = create("label", "validation-check");
      const checkbox = create("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.checks[item.id];
      label.append(checkbox, create("span", "", item.content));
      item.row.replaceChildren(label);
      checkbox.addEventListener("change", () => {
        feedback(group, setCheck(state, group, item.id, checkbox.checked));
        refresh();
        persist();
      });
    }
    if (group.id === "common") continue;
    const form = create("div", "validation-review");
    group.card.append(form);
    const status = field(form, "검증 상태", "select", "");
    for (const [value, label] of Object.entries(STATUS)) {
      const option = create("option", "", label);
      option.value = value;
      status.append(option);
    }
    group.statusInput = status;
    status.addEventListener("change", () => {
      feedback(group, setReview(state, group, "status", status.value));
      refresh();
      persist();
    });
    const fields = create("div", "validation-fields");
    const context = create("details", "validation-context");
    context.append(create("summary", "", "검증일 · 담당자 · 앱 버전"), fields);
    form.append(context);
    for (const [key, label, type] of [
      ["round", "검증 라운드", "text"],
      ["date", "검증일", "date"],
      ["owner", "담당자", "text"],
      ["appVersion", "앱 버전", "text"],
    ]) {
      const input = field(fields, label, "input", state.reviews[group.id][key], "", type);
      input.addEventListener("input", () => {
        const message = setReview(state, group, key, input.value);
        if (message) feedback(group, message);
        refresh();
        persist();
      });
    }
    for (const [key, label, hint] of [
      [
        "evidence",
        "관찰 근거 · 보류 사유",
        "참여자 수·모집 방법 / 기기·권한 / 사전 성공 기준 / 성공 수·시간 / 만족도와 이유 / 재사용 여부 / 익명 근거 링크",
      ],
      [
        "next",
        "개선할 점 · 재검증 계획",
        "막힌 지점, 다음 작업, 담당자·재검증 시점, 다른 유형에 미치는 영향",
      ],
    ]) {
      const input = field(form, label, "textarea", state.reviews[group.id][key], hint);
      input.addEventListener("input", () => {
        const message = setReview(state, group, key, input.value);
        if (message) feedback(group, message);
        refresh();
        persist();
      });
    }
    form.append(
      create(
        "p",
        "validation-help",
        "검증됨은 모든 항목 확인과 관찰 근거가 필요합니다. 새 라운드에서는 이전 결과를 다시 확인하세요. 개인정보 대신 익명 참여자 코드를 사용합니다.",
      ),
    );
    group.feedback = create("p", "validation-feedback");
    group.feedback.hidden = true;
    group.feedback.setAttribute("role", "status");
    form.append(group.feedback);
  }

  // Render the synced plain-text references as readable paragraphs/tables, never as HTML input.
  section.querySelectorAll(".validation-reference").forEach((reference) => {
    const blocks = reference.textContent.trim().split(/\n\s*\n/);
    reference.replaceChildren();
    for (const block of blocks) {
      const lines = block.trim().split("\n");
      if (lines[0].startsWith("|") && lines.some((line) => /^\|[\s:|-]+\|$/.test(line))) {
        const wrap = create("div", "validation-table-wrap");
        const table = create("table");
        lines
          .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
          .forEach((line, index) => {
            const row = create("tr");
            line
              .split("|")
              .slice(1, -1)
              .forEach((cell) => row.append(create(index === 0 ? "th" : "td", "", cell.trim())));
            table.append(row);
          });
        wrap.append(table);
        reference.append(wrap);
      } else if (lines[0].startsWith("### "))
        reference.append(create("h4", "", block.replace(/^### /, "")));
      else reference.append(create("p", "", block.replace(/^text\n/, "")));
    }
  });
  const featureCard = [...section.querySelectorAll(".validation-reference-list > details")].find(
    (card) => card.querySelector("summary")?.textContent.startsWith("5."),
  );
  if (featureCard) {
    const form = create("div", "validation-review");
    featureCard.append(form);
    const labels = [
      "검토할 기능",
      "주 수혜 · 부수 수혜 유형",
      "생기는 가치",
      "실제 필요의 근거",
      "검증 전 성공 기준",
      "다른 유형의 회귀 위험",
      "판정 · 담당자 · 재검증 시점",
    ];
    FEATURE_FIELDS.forEach((key, index) => {
      const input = field(
        form,
        labels[index],
        index === 0 ? "input" : "textarea",
        state.feature[key],
      );
      input.addEventListener("input", () => {
        state.feature[key] = text(input.value);
        persist();
      });
    });
  }
  refresh();
})(globalThis);
