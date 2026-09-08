(function (root) {
  "use strict";
  const personas = [
    { id: "record", label: "순수 기록형", value: "SNS 없이도 기록·누적·회고" },
    { id: "social", label: "기록 + SNS형", value: "제작·공유·반응의 즐거움" },
    { id: "competition", label: "경쟁형", value: "공정한 순위와 다음 도전" },
    { id: "achievement", label: "개인 성취형", value: "남과 비교하지 않는 성장" },
  ];
  const candidates = [
    {
      id: "record-flow",
      title: "저장부터 회고까지, 더 짧게",
      audience: ["record"],
      hypothesis: "기록을 저장하고 지난 운동을 찾는 흐름에서 이탈을 줄인다.",
      success: "도움 없이 저장 → 이전 기록 찾기 성공률과 소요시간을 전후 비교",
      guard: "게시나 팔로우를 요구하지 않는다.",
    },
    {
      id: "sharing",
      title: "기록 하나를, 쉽게 공유하기",
      audience: ["social"],
      hypothesis: "기본 편집만으로 원하는 기록을 올리고 실제 상대의 반응을 확인한다.",
      success: "기록 가져오기 → 게시 성공률·시간과 다음 공유 의향을 확인",
      guard: "기록 전용 경로와 비공개 선택을 그대로 유지한다.",
    },
    {
      id: "growth",
      title: "나의 성장을 한눈에",
      audience: ["record", "achievement"],
      hypothesis: "누적 운동과 개인기록 변화를 이해하고 다음 운동의 이유를 찾는다.",
      success: "이전 대비 변화를 자기 말로 설명하는지와 다음 주 재사용을 확인",
      guard: "추정치·미측정치를 실제 측정처럼 표시하지 않는다.",
    },
    {
      id: "fair-play",
      title: "순위의 이유, 다음 목표",
      audience: ["competition"],
      hypothesis: "순위 근거와 격차를 납득하고 자기 수준에서 재도전을 선택한다.",
      success: "규칙 이해도·공정성 체감·입문자의 자발적 재참여를 확인",
      guard: "소수 유형이어도 공정성·안전 문제는 뒤로 미루지 않는다.",
    },
    {
      id: "milestone",
      title: "비교 없이 쌓이는 성취",
      audience: ["achievement"],
      hypothesis: "개인 목표와 작은 성장을 보상으로 연결해 다시 시작할 이유를 만든다.",
      success: "획득 조건 이해·달성 의미·휴식 후 재사용 이유를 확인",
      guard: "공개 게시나 순위 참여를 보상 조건으로 강제하지 않는다.",
    },
  ];
  const integer = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const cleanText = (value, limit = 2000) =>
    typeof value === "string" ? value.slice(0, limit) : "";
  const percent = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : null);

  function normalizeSummary(raw) {
    if (!object(raw) || !["registered_users", "preview"].includes(raw.source))
      throw Error(
        "사용 목적 통계 API의 집계 JSON이 필요합니다. 개인별 응답 파일은 사용하지 않습니다.",
      );
    if (raw.questionVersion !== 1)
      throw Error("이 시안은 질문 v1만 비교합니다. 다른 질문 버전은 별도 분석이 필요합니다.");
    for (const key of ["totalUsers", "respondents", "skipped", "uncollected", "excludedUsers"])
      if (!integer(raw[key])) throw Error("인원 수는 0 이상의 정수여야 합니다.");
    if (!Array.isArray(raw.distribution) || raw.distribution.length !== 4)
      throw Error("네 사용자 유형의 집계가 모두 필요합니다.");
    const seen = new Set();
    for (const row of raw.distribution) {
      if (
        !object(row) ||
        !personas.some((p) => p.id === row.purpose) ||
        seen.has(row.purpose) ||
        !integer(row.count)
      )
        throw Error("사용자 유형이 중복되거나 인원 수가 올바르지 않습니다.");
      seen.add(row.purpose);
    }
    const respondents = raw.distribution.reduce((sum, row) => sum + row.count, 0);
    if (
      respondents !== raw.respondents ||
      respondents + raw.skipped + raw.uncollected !== raw.totalUsers
    )
      throw Error("유형별 합계·응답 수·집계 대상 인원이 일치하지 않습니다.");
    if (typeof raw.generatedAt !== "string" || !Number.isFinite(Date.parse(raw.generatedAt)))
      throw Error("집계 시각이 필요합니다.");
    if (!object(raw.cohort))
      throw Error("가입 기간 정보(cohort)가 필요합니다. 전체 기간은 {}로 표시합니다.");
    const cohort = {};
    for (const key of ["registeredFrom", "registeredBefore"]) {
      if (raw.cohort[key] !== undefined) {
        if (typeof raw.cohort[key] !== "string" || !Number.isFinite(Date.parse(raw.cohort[key])))
          throw Error("가입 기간을 확인해 주세요.");
        cohort[key] = new Date(raw.cohort[key]).toISOString();
      }
    }
    if (
      cohort.registeredFrom &&
      cohort.registeredBefore &&
      Date.parse(cohort.registeredFrom) >= Date.parse(cohort.registeredBefore)
    )
      throw Error("가입 기간의 시작은 종료보다 앞이어야 합니다.");
    return {
      source: raw.source,
      questionVersion: 1,
      cohort,
      generatedAt: new Date(raw.generatedAt).toISOString(),
      totalUsers: raw.totalUsers,
      excludedUsers: raw.excludedUsers,
      respondents,
      skipped: raw.skipped,
      uncollected: raw.uncollected,
      responseRatePercent: percent(respondents, raw.totalUsers),
      distribution: personas.map((p) => {
        const count = raw.distribution.find((row) => row.purpose === p.id).count;
        return { purpose: p.id, label: p.label, count, percent: percent(count, respondents) };
      }),
    };
  }
  function fromCounts(counts, skipped = 0, uncollected = 0, excludedUsers = 0) {
    const distribution = personas.map((p) => ({ purpose: p.id, count: counts[p.id] }));
    const respondents = distribution.reduce((sum, row) => sum + row.count, 0);
    return normalizeSummary({
      source: "preview",
      questionVersion: 1,
      cohort: {},
      generatedAt: new Date().toISOString(),
      totalUsers: respondents + skipped + uncollected,
      respondents,
      skipped,
      uncollected,
      excludedUsers,
      distribution,
    });
  }
  function example() {
    return fromCounts({ record: 42, social: 31, competition: 8, achievement: 19 }, 15, 10, 3);
  }
  function defaultReviews(withExamples = false) {
    const examples = {
      "record-flow": [2, 1, "[예시·가상] 지난 기록을 찾기까지 조작이 많다는 반응을 가정."],
      sharing: [2, 2, "[예시·가상] 기본 편집에서 게시까지 길게 느끼는 반응을 가정."],
      growth: [1, 2, "[예시·가상] 누적량은 보이지만 성장의 의미를 묻는 상황을 가정."],
      "fair-play": [
        3,
        2,
        "[예시·가상] 순위 산정 근거를 이해하지 못해 재도전을 포기하는 상황을 가정.",
      ],
      milestone: [1, 2, "[예시·가상] 개인 목표의 다음 단계를 찾기 어려운 상황을 가정."],
    };
    return Object.fromEntries(
      candidates.map((item) => [
        item.id,
        withExamples
          ? {
              severity: examples[item.id][0],
              effort: examples[item.id][1],
              evidence: examples[item.id][2],
            }
          : { severity: null, effort: 2, evidence: "" },
      ]),
    );
  }
  function rank(summary, reviews) {
    return candidates
      .map((item) => {
        const count = summary.distribution
          .filter((row) => item.audience.includes(row.purpose))
          .reduce((sum, row) => sum + row.count, 0);
        const share = percent(count, summary.respondents);
        const review = reviews[item.id] || {};
        const ready =
          summary.respondents > 0 &&
          [0, 1, 2, 3].includes(review.severity) &&
          [1, 2, 3].includes(review.effort) &&
          cleanText(review.evidence).trim().length > 0;
        const demand = summary.respondents ? (count / summary.respondents) * 40 : 0;
        const need = ready ? review.severity * 20 : null;
        const score = ready ? Math.round(((demand + need) / review.effort) * 10) / 10 : null;
        return {
          ...item,
          count,
          share,
          demand: Math.round(demand * 10) / 10,
          need,
          score,
          ready,
          review: {
            severity: ready ? review.severity : null,
            effort: review.effort,
            evidence: cleanText(review.evidence),
          },
        };
      })
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.share ?? -1) - (a.share ?? -1));
  }
  function warnings(summary, mode) {
    const result = [];
    if (mode === "example")
      result.push("예시 인원·관찰입니다. 실제 GROOV 가입자나 사용자 검증 결과가 아닙니다.");
    else if (mode === "manual")
      result.push("직접 입력한 가정입니다. 실제 가입자 집계로 인증되지 않았습니다.");
    else
      result.push(
        summary.source === "preview"
          ? "가져온 자료는 preview입니다. 실제 가입자 통계로 사용할 수 없습니다."
          : "가져온 집계 파일입니다. 실서버에 연결하거나 출처를 자동 검증한 자료는 아닙니다.",
      );
    if (!summary.respondents)
      result.push("응답이 없습니다. 유형 비율과 후보 점수를 계산하지 않습니다.");
    else if (summary.respondents < 30)
      result.push(
        "응답 30명 미만: 탐색·인터뷰용으로만 보세요. 30명은 시안의 경고선이지 통계적 보장 기준이 아닙니다.",
      );
    if (summary.responseRatePercent !== null && summary.responseRatePercent < 50)
      result.push(
        "응답률 50% 미만: 미응답자의 목적은 알 수 없습니다. 50%는 시안의 검토 경고선입니다.",
      );
    result.push("가입 의도 ≠ 실제 행동·만족도. 유형별 관찰과 재사용 결과를 함께 확인하세요.");
    return result;
  }
  function makeDecision({
    summary,
    mode,
    reviews,
    candidateId,
    reason,
    success,
    nextDate,
    critical,
    criticalEvidence,
  }) {
    if (!["example", "manual", "imported"].includes(mode))
      throw Error("자료 출처를 확인해 주세요.");
    const candidate = rank(summary, reviews).find((row) => row.id === candidateId);
    if (
      !candidate ||
      !cleanText(reason).trim() ||
      !cleanText(success).trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) ||
      !Number.isFinite(Date.parse(nextDate)) ||
      new Date(nextDate).toISOString().slice(0, 10) !== nextDate
    )
      throw Error("후보·판단 이유·성공 기준·재검증 날짜를 모두 입력해 주세요.");
    if (critical && !cleanText(criticalEvidence).trim())
      throw Error("핵심 오류의 근거를 적어 주세요.");
    if (critical)
      throw Error(
        "핵심 오류가 확인된 상태입니다. 안전·기록 신뢰성 복구를 먼저 검토한 뒤 후보 결정을 기록해 주세요.",
      );
    return {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      mode,
      candidateId: candidate.id,
      title: candidate.title,
      reason: cleanText(reason),
      success: cleanText(success),
      nextDate,
      evidence: candidate.review.evidence,
      score: candidate.score,
      severity: candidate.review.severity,
      effort: candidate.review.effort,
      formulaVersion: "exploration-v1",
      summary: normalizeSummary(summary),
    };
  }
  root.GroovDirection = {
    personas,
    candidates,
    normalizeSummary,
    fromCounts,
    example,
    defaultReviews,
    rank,
    warnings,
    makeDecision,
  };
})(globalThis);
