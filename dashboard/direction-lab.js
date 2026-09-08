/* global document, localStorage, Blob, URL, setTimeout */
(function () {
  "use strict";
  const M = globalThis.GroovDirection;
  const $ = (id) => document.getElementById(id);
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const STORAGE = "groov-direction-lab-decisions-v1";
  const modes = {
    example: "예시 · 가상",
    manual: "직접 입력 가정",
    imported: "가져온 집계 · 출처 미검증",
  };
  let mode = "example";
  let summary = M.example();
  let reviews = M.defaultReviews(true);
  let history = [];
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || "[]");
    if (!Array.isArray(saved)) throw Error("invalid history");
    history = saved.slice(0, 50).map((entry) => {
      if (
        !entry ||
        entry.schemaVersion !== 1 ||
        !Object.hasOwn(modes, entry.mode) ||
        !M.candidates.some((c) => c.id === entry.candidateId)
      )
        throw Error("invalid history");
      for (const key of ["title", "reason", "success", "nextDate", "createdAt", "evidence"])
        if (typeof entry[key] !== "string") throw Error("invalid history");
      return { ...entry, summary: M.normalizeSummary(entry.summary) };
    });
  } catch {
    storageAvailable = false;
    history = [];
    $("save-feedback").textContent =
      "저장 기록을 읽지 못했습니다. 기존 저장 내용은 덮어쓰지 않으며 새 메모는 내보내기로 보관할 수 있어요.";
  }
  const displayPercent = (value) => (value === null ? "—" : `${value}%`);
  const dateLabel = (value) => new Date(value).toLocaleString("ko-KR");
  function showFeedback(id, text) {
    $(id).textContent = text;
    $(id).hidden = !text;
  }
  function renderData() {
    $("source-label").textContent = mode === "example" ? "예시로 체험 중" : modes[mode];
    $("source-note").textContent =
      mode === "example"
        ? "아래 인원·불편·작업 규모·관찰은 모두 가상입니다. 실제 가입자 분석 결과가 아닙니다."
        : mode === "manual"
          ? "숫자를 직접 바꾼 시뮬레이션입니다. 실제 통계나 검증 결과로 확정하지 않습니다."
          : summary.source === "preview"
            ? "가져온 자료는 미리보기 통계입니다. 실서버에 연결하지 않았습니다."
            : "파일의 집계만 읽었습니다. 실서버 연결·출처 검증·앱 변경은 하지 않습니다.";
    $("respondents").textContent = summary.respondents.toLocaleString("ko-KR");
    $("coverage").textContent =
      `대상 ${summary.totalUsers.toLocaleString("ko-KR")}명 · 응답률 ${displayPercent(summary.responseRatePercent)}`;
    $("distribution").replaceChildren(
      ...summary.distribution.map((row) => {
        const item = create("div", "distribution-row");
        const head = create("div", "row-head");
        head.append(
          create("span", "", row.label),
          create("strong", "", displayPercent(row.percent)),
        );
        const track = create("div", "track");
        track.setAttribute("aria-hidden", "true");
        const fill = create("span");
        fill.style.width = `${row.percent ?? 0}%`;
        track.append(fill);
        item.append(
          head,
          track,
          create(
            "small",
            "",
            `${row.count}명 · ${M.personas.find((p) => p.id === row.purpose).value}`,
          ),
        );
        return item;
      }),
    );
    $("missing-data").replaceChildren(
      ...[
        `건너뜀 ${summary.skipped}명`,
        `미수집 ${summary.uncollected}명`,
        `제외 계정 ${summary.excludedUsers}명`,
      ].map((text) => create("span", "", text)),
    );
    const { registeredFrom, registeredBefore } = summary.cohort;
    $("data-meta").textContent =
      `질문 v${summary.questionVersion} · 가입 기간: ${registeredFrom ? dateLabel(registeredFrom) + "부터" : "시작 제한 없음"} / ${registeredBefore ? dateLabel(registeredBefore) + "미만" : "종료 제한 없음"} · ${mode === "example" || mode === "manual" ? "가정 작성" : "집계"} ${dateLabel(summary.generatedAt)}. 유형 비율의 분모는 실제 선택 응답 수이며, 건너뜀·미수집은 포함하지 않습니다.`;
    const counts = Object.fromEntries(summary.distribution.map((row) => [row.purpose, row.count]));
    const definitions = [
      ...M.personas.map((p) => [p.id, p.label, counts[p.id]]),
      ["skipped", "건너뜀", summary.skipped],
      ["uncollected", "미수집", summary.uncollected],
      ["excludedUsers", "제외 계정", summary.excludedUsers],
    ];
    $("count-fields").replaceChildren(
      ...definitions.map(([id, label, value]) => {
        const field = create("label", "", label);
        const input = create("input");
        input.id = `count-${id}`;
        input.type = "number";
        input.min = "0";
        input.max = "10000000";
        input.step = "1";
        input.value = value;
        field.append(input);
        return field;
      }),
    );
    $("warnings").replaceChildren(
      ...M.warnings(summary, mode).map((text) => create("li", "", text)),
    );
  }
  function selectField(labelText, options, value, onChange) {
    const label = create("label", "", labelText);
    const select = create("select");
    for (const [key, title] of options) {
      const option = create("option", "", title);
      option.value = key;
      select.append(option);
    }
    select.value = value;
    select.addEventListener("change", () => onChange(select.value));
    label.append(select);
    return label;
  }
  function renderCandidates(openIds = new Set()) {
    const rows = M.rank(summary, reviews);
    const critical = $("critical").checked;
    const top = rows[0];
    $("recommendation-title").textContent = critical
      ? "신뢰성 복구를 먼저"
      : !summary.respondents
        ? "설문·관찰부터 모으기"
        : top.ready
          ? top.title
          : "순위보다 관찰이 먼저";
    $("recommendation-reason").textContent = critical
      ? "기록 유실·개인정보 노출·핵심 기능 막힘은 점수나 유형 비중으로 상쇄할 수 없습니다. 후보 결정은 보류합니다."
      : top.ready
        ? `${modes[mode]} 기준 탐색 점수 ${top.score}점. 대상 ${displayPercent(top.share)}·불편 ${top.review.severity}단계·규모 ${top.review.effort}을 함께 본 검증 후보이며, 개발 확정이 아닙니다.`
        : "설문만으로 불만이나 개선 효과를 알 수 없습니다. 실제 관찰 근거와 작업 규모를 적은 후보부터 비교합니다.";
    $("candidate-list").replaceChildren(
      ...rows.map((item, index) => {
        const card = create("details", "candidate");
        card.dataset.id = item.id;
        card.open = openIds.has(item.id);
        const heading = create("summary");
        const title = create("span", "candidate-title", item.title);
        title.append(
          create(
            "span",
            "candidate-sub",
            `${item.audience.map((id) => M.personas.find((p) => p.id === id).label).join(" · ")} / ${displayPercent(item.share)}`,
          ),
        );
        const score = create(
          "span",
          "candidate-score",
          critical ? "—" : item.score === null ? "—" : item.score,
        );
        score.append(
          create(
            "small",
            "",
            critical ? "복구 우선" : item.score === null ? "관찰 필요" : "탐색 점수",
          ),
        );
        heading.append(
          create("span", "rank-number", String(index + 1).padStart(2, "0")),
          title,
          score,
        );
        const content = create("div", "candidate-content");
        content.append(create("p", "", item.hypothesis));
        const controls = create("div", "candidate-controls");
        const review = reviews[item.id];
        controls.append(
          selectField(
            "관찰된 불편",
            [
              ["", "미확인"],
              ["0", "0 · 문제 관찰 없음"],
              ["1", "1 · 가벼운 불편"],
              ["2", "2 · 반복되는 불편"],
              ["3", "3 · 목적 달성에 큰 지장"],
            ],
            review.severity === null ? "" : String(review.severity),
            (value) => {
              review.severity = value === "" ? null : Number(value);
            },
          ),
          selectField(
            "예상 작업 규모",
            [
              ["1", "1 · 작음"],
              ["2", "2 · 보통"],
              ["3", "3 · 큼"],
            ],
            String(review.effort),
            (value) => {
              review.effort = Number(value);
            },
          ),
        );
        const evidenceLabel = create("label", "", "관찰 근거 · 입력 후 비교에 반영");
        const evidence = create("textarea");
        evidence.rows = 2;
        evidence.maxLength = 2000;
        evidence.value = review.evidence;
        evidence.placeholder =
          "참여자 수·막힌 지점·익명 관찰 근거. 아직 확인하지 않았다면 비워두세요.";
        evidence.addEventListener("input", () => {
          review.evidence = evidence.value;
        });
        evidenceLabel.append(evidence);
        const recalculate = create("button", "", "비교에 반영");
        recalculate.type = "button";
        recalculate.addEventListener("click", () =>
          renderCandidates(
            new Set(
              [...document.querySelectorAll(".candidate[open]")].map((node) => node.dataset.id),
            ),
          ),
        );
        content.append(
          controls,
          evidenceLabel,
          create(
            "p",
            "score-explain",
            item.ready
              ? `비중 점수 ${item.demand} + 불편 점수 ${item.need}, 작업 규모 ${item.review.effort}로 나눔 = ${item.score}점`
              : "응답·관찰 근거·불편 단계를 확인해야 점수를 계산합니다. 규모 기본값 2는 견적이 아닌 가정입니다.",
          ),
          recalculate,
          create("p", "", `다음 검증: ${item.success}`),
          create("p", "muted", `유지할 원칙: ${item.guard}`),
        );
        card.append(heading, content);
        return card;
      }),
    );
    const selected = $("decision-candidate").value;
    $("decision-candidate").replaceChildren(
      ...rows.map((row) => {
        const option = create("option", "", row.title);
        option.value = row.id;
        return option;
      }),
    );
    if (rows.some((row) => row.id === selected)) $("decision-candidate").value = selected;
    $("decision-form").querySelector("button[type=submit]").disabled = critical;
  }
  function renderHistory() {
    $("decision-history").replaceChildren(
      ...(history.length
        ? history.map((entry) => {
            const card = create("article", "history-card");
            card.append(
              create(
                "small",
                "",
                `${modes[entry.mode]} · ${dateLabel(entry.createdAt)} · 재검증 ${entry.nextDate}`,
              ),
              create("h3", "", entry.title),
            );
            for (const [label, value] of [
              ["판단 이유", entry.reason],
              ["성공 기준", entry.success],
              ["당시 관찰", entry.evidence || "미확인"],
              [
                "당시 구성",
                `${entry.summary.respondents}명 응답 · 응답률 ${displayPercent(entry.summary.responseRatePercent)} · ${entry.summary.distribution.map((row) => `${row.label} ${displayPercent(row.percent)}`).join(" / ")}`,
              ],
            ]) {
              const line = create("p");
              line.append(create("b", "", `${label} · `), document.createTextNode(value));
              card.append(line);
            }
            return card;
          })
        : [
            create(
              "p",
              "muted",
              "아직 저장한 판단이 없습니다. 예시를 저장하면 예시 표기도 함께 남습니다.",
            ),
          ]),
    );
  }
  function replaceData(nextSummary, nextMode) {
    summary = nextSummary;
    mode = nextMode;
    reviews = M.defaultReviews(nextMode === "example");
    $("critical").checked = false;
    $("critical-detail").hidden = true;
    $("critical-evidence").value = "";
    $("decision-reason").value = "";
    $("decision-success").value = "";
    $("decision-candidate").value = "";
    renderData();
    renderCandidates();
  }
  $("example-button").addEventListener("click", () => {
    replaceData(M.example(), "example");
    showFeedback(
      "import-feedback",
      "예시를 불러왔습니다. 편집 중이던 관찰은 초기화되며 저장한 판단 기록은 유지됩니다.",
    );
  });
  $("summary-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 100_000) throw Error("100KB 이하의 집계 JSON만 가져올 수 있습니다.");
      const data = M.normalizeSummary(JSON.parse(await file.text()));
      replaceData(data, "imported");
      showFeedback(
        "import-feedback",
        "집계를 읽었습니다. 예시 관찰은 지웠습니다. 실제 관찰 근거를 적어 주세요. 서버 연결이나 데이터 전송은 없습니다.",
      );
    } catch (error) {
      showFeedback(
        "import-feedback",
        error instanceof SyntaxError
          ? "JSON 형식이 아닙니다. 기존 자료를 유지했습니다."
          : error.message,
      );
    }
    event.target.value = "";
  });
  $("apply-counts").addEventListener("click", () => {
    try {
      const value = (id) => {
        const input = $(`count-${id}`);
        if (input.value.trim() === "" || !input.checkValidity())
          throw Error("인원 수를 빠짐없이 0 이상의 정수로 입력해 주세요.");
        return Number(input.value);
      };
      const counts = Object.fromEntries(M.personas.map((p) => [p.id, value(p.id)]));
      replaceData(
        M.fromCounts(counts, value("skipped"), value("uncollected"), value("excludedUsers")),
        "manual",
      );
      showFeedback(
        "import-feedback",
        "직접 입력한 가정으로 바꿨습니다. 다른 자료의 관찰은 자동 승계하지 않습니다.",
      );
    } catch (error) {
      showFeedback("import-feedback", error.message);
    }
  });
  $("critical").addEventListener("change", () => {
    $("critical-detail").hidden = !$("critical").checked;
    renderCandidates();
  });
  $("decision-candidate").addEventListener("change", () => {
    if (!$("decision-success").value.trim())
      $("decision-success").value = M.candidates.find(
        (c) => c.id === $("decision-candidate").value,
      ).success;
  });
  $("decision-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const entry = M.makeDecision({
        summary,
        mode,
        reviews,
        candidateId: $("decision-candidate").value,
        reason: $("decision-reason").value,
        success: $("decision-success").value,
        nextDate: $("decision-date").value,
        critical: $("critical").checked,
        criticalEvidence: $("critical-evidence").value,
      });
      if (history.length >= 50)
        throw Error(
          "판단 기록은 50개까지 보관합니다. 먼저 JSON으로 내보내 보관해 주세요. 기존 기록을 자동 삭제하지 않습니다.",
        );
      history.unshift(entry);
      try {
        if (!storageAvailable) throw Error("blocked");
        localStorage.setItem(STORAGE, JSON.stringify(history));
        $("save-feedback").textContent =
          "이 브라우저에 저장했습니다. 실제 앱과 개발 상태는 바뀌지 않습니다.";
      } catch {
        $("save-feedback").textContent =
          "브라우저에 저장하지 못했습니다. 페이지를 닫기 전에 JSON으로 내보내 주세요.";
      }
      renderHistory();
    } catch (error) {
      $("save-feedback").textContent = error.message;
    }
  });
  $("export-notes").addEventListener("click", () => {
    if (!history.length) {
      $("save-feedback").textContent = "먼저 검토 메모를 저장해 주세요.";
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          {
            kind: "groov-direction-review-only",
            exportedAt: new Date().toISOString(),
            decisions: history,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = create("a");
    link.href = url;
    link.download = `groov-direction-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("save-feedback").textContent =
      "내보내기를 요청했습니다. 브라우저 다운로드 목록을 확인해 주세요.";
  });
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  $("decision-date").value =
    `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;
  renderData();
  renderCandidates();
  renderHistory();
})();
