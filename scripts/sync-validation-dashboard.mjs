import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "docs/PRODUCT_VALIDATION.md"), "utf8");
const target = join(root, "GROOV_dev_dashboard.html");
const html = readFileSync(target, "utf8");
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const plain = (text) => escape(text.replaceAll("**", "").replaceAll("`", ""));
const sections = source.split(/^## /m).slice(1);
const scenarios = sections.find((part) => part.startsWith("2."));
const common = sections.find((part) => part.startsWith("3."));
if (!scenarios || !common) throw new Error("검증 시나리오 원본 구조를 확인해주세요.");
const cards = scenarios.split(/^### /m).slice(1);
if (cards.length !== 4) throw new Error("네 사용자 유형이 필요합니다.");
function checklist(part) {
  const entries = [...part.matchAll(/^- \[([ xX])\] (.+)$/gm)];
  return `<ul class="validation-list">${entries.map(([, checked, text]) => `<li><span aria-label="${checked.trim() ? "검증됨" : "미검증"}" class="validation-mark">${checked.trim() ? "✓" : "□"}</span><span>${plain(text)}</span></li>`).join("")}</ul>`;
}
const body = cards
  .map((part, index) => {
    const [heading] = part.split("\n");
    const [persona, scenario] = heading.split(" — ");
    const observation = part.split("\n").find((line) => line.startsWith("관찰:")) ?? "";
    const total = [...part.matchAll(/^- \[[ xX]\]/gm)].length;
    const done = [...part.matchAll(/^- \[[xX]\]/gm)].length;
    return `<details class="validation-card" ${index === 0 ? "open" : ""}><summary><span class="validation-persona"><span>${plain(persona)}</span><span class="validation-scenario">${plain(scenario)}</span></span><span class="validation-state">${done} / ${total} 확인</span></summary>${checklist(part)}<p class="validation-observation">${plain(observation)}</p></details>`;
  })
  .join("\n");
const allChecks = [...(scenarios + common).matchAll(/^- \[([ xX])\]/gm)];
const done = allChecks.filter((match) => match[1].trim()).length;
const notes = sections
  .filter((part) => /^[4-7]\./.test(part))
  .map((part) => {
    const [heading, ...lines] = part.split("\n");
    return `<details class="validation-card"><summary>${plain(heading)}</summary><div class="validation-reference">${plain(lines.join("\n"))}</div></details>`;
  })
  .join("\n");
const content = `<!-- product-validation:start -->
  <section class="card validation" id="product-validation" aria-labelledby="product-validation-title">
    <div class="validation-heading"><div><p class="validation-kicker">USER VALIDATION</p><h2 id="product-validation-title">네 유형 모두, 쓸 이유가 있는가?</h2></div><div class="validation-links"><a href="dashboard/direction-lab.html">업데이트 방향 도구 · 시안 ↗</a><a href="http://localhost:8081/onboarding-preview">온보딩 미리보기 ↗</a></div></div>
    <p class="sub">사용자 검증 체크리스트 · 실제 사용 결과를 사람이 확인하는 관리표입니다.</p>
    <div class="validation-purpose"><div><strong>지금 하는 일</strong><p>유형별 사용 경험을 체크하고, 관찰 근거와 개선 메모를 이 브라우저에 저장합니다.</p></div><div><strong>자동으로 하지 않는 일</strong><p>설문 분석, 기능 개발, 앱 변경, 출시 판정은 하지 않습니다. 개발 완료율과도 별개입니다.</p></div></div>
    <div class="validation-summary"><div><strong>4</strong><span>검증할 사용자 유형</span></div><div><strong>${done} / ${allChecks.length}</strong><span>원본에 기록된 검증 항목</span></div><div><strong>실사용자 근거 필요</strong><span>자동 테스트 통과 ≠ 만족도 검증</span></div></div>
    <p class="sub">① 유형 선택 → ② 실제 사용 확인 → ③ 근거를 적고 판정</p>
    <div class="validation-grid">${body}</div>
    <details class="validation-card" open><summary>모든 유형의 공통 통과 조건 <span class="validation-state">5개 필수 조건</span></summary>${checklist(common)}<p class="validation-observation">심각한 실패는 평균 만족도로 상쇄하지 않습니다. 소수 유형의 기본 사용 가치도 지킵니다.</p></details>
    <h3 class="validation-reference-heading">운영 기준 · 필요할 때 펼치기</h3><div class="validation-reference-list">${notes}</div>
    <p class="sub">원본: <a href="docs/PRODUCT_VALIDATION.md">핵심 사용자 검증 기준·기록 양식</a> · 원본을 수정한 뒤 대시보드 동기화 시 반영됩니다. 다음 라운드에서는 이전 체크를 자동 승계하지 않습니다.</p>
  </section>
<!-- product-validation:end -->`;
const marked = /<!-- product-validation:start -->[\s\S]*?<!-- product-validation:end -->/;
const legacy =
  /<section class="card" aria-labelledby="product-validation-title"[\s\S]*?<\/section>/;
if (!marked.test(html) && !legacy.test(html))
  throw new Error("대시보드 검증 영역을 찾지 못했습니다.");
const updated = html.replace(marked.test(html) ? marked : legacy, () => content);
const withStyles = updated.replace(
  /<style id="validation-ui-styles">[\s\S]*?<\/style>/,
  () =>
    `<style id="validation-ui-styles">\n${readFileSync(join(root, "dashboard/validation-ui.css"), "utf8")}\n</style>`,
);
const withScript = withStyles.replace(
  /<script id="validation-ui-script">[\s\S]*?<\/script>/,
  () =>
    `<script id="validation-ui-script">\n${readFileSync(join(root, "dashboard/validation-ui.js"), "utf8")}\n</script>`,
);
writeFileSync(target, withScript);
console.log(`사용자 검증 대시보드 동기화: ${cards.length}개 유형, ${allChecks.length}개 항목`);
