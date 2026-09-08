export const modes = [
  ["activity", "액티비티"], ["running", "러닝"], ["strength", "근력"],
  ["cycling", "사이클"], ["diving", "다이빙"], ["swimming", "수영"],
];
const profiles = ["하늘", "준", "지영", "태오", "서아", "민지", "도윤", "유나", "건우", "수아"];
const spec = {
  activity: { rank: 323, total: 354, value: 7839, unit: "pt", label: "시즌 활동점수" },
  running: { rank: 18, total: 126, value: "22′48″", unit: "", label: "5K PB" },
  strength: { rank: 47, total: 98, value: 315, unit: "kg", label: "3대 합계" },
  cycling: { rank: 12, total: 73, value: 31.8, unit: "km/h", label: "40K 평균속도" },
  diving: { rank: 9, total: 41, value: 26, unit: "m", label: "CWT PB" },
  swimming: { rank: 34, total: 89, value: "1′42″", unit: "", label: "100m PB" },
};
export const districts = [
  { name: "도봉구", region: "서울", heat: 96, members: 4290, active: 1840, participants: 1286, score: 88420, leader: "하늘", title: "도봉의 페이스메이커" },
  { name: "노원구", region: "서울", heat: 88, members: 6370, active: 2710, participants: 1814, score: 86130, leader: "준", title: "불암산을 깨운 러너" },
  { name: "강북구", region: "서울", heat: 79, members: 3380, active: 1390, participants: 910, score: 79880, leader: "지영", title: "북서울의 꾸준한 불씨" },
  { name: "성북구", region: "서울", heat: 68, members: 3950, active: 1460, participants: 876, score: 74720, leader: "태오", title: "성북의 기록 수집가" },
  { name: "동대문구", region: "서울", heat: 58, members: 3270, active: 1180, participants: 682, score: 69140, leader: "서아", title: "청계천의 새벽" },
  { name: "마포구", region: "서울", heat: 84, members: 5120, active: 2240, participants: 1512, score: 82310, leader: "민지", title: "한강의 스프린터" },
  { name: "해운대구", region: "부산", heat: 73, members: 4820, active: 1790, participants: 1124, score: 76140, leader: "도윤", title: "해운대의 파도" },
  { name: "수성구", region: "대구", heat: 62, members: 3510, active: 1270, participants: 718, score: 70610, leader: "유나", title: "수성못의 엔진" },
  { name: "연수구", region: "인천", heat: 51, members: 3080, active: 1030, participants: 544, score: 65480, leader: "건우", title: "송도의 롱런" },
  { name: "유성구", region: "대전", heat: 42, members: 2840, active: 910, participants: 421, score: 60820, leader: "수아", title: "유성의 궤도" },
  { name: "제주시", region: "제주", heat: 31, members: 2310, active: 690, participants: 303, score: 55310, leader: "하람", title: "오름을 잇는 사람" },
  { name: "춘천시", region: "강원", heat: 22, members: 1940, active: 520, participants: 201, score: 49830, leader: "시우", title: "호반의 라이더" },
];
export const initial = () => ({ version: 3, mode: "activity", page: "status", selectedDistrict: "도봉구", fullRanking: false, activityBonus: 0, attendanceBonus: 0, pb: false });
export function load(raw) { try { const s = JSON.parse(raw); if (s?.version === 3 && spec[s.mode]) return s; } catch {} return initial(); }
export function summary(state, mode = state.mode) {
  const base = spec[mode];
  if (mode !== "activity") return { ...base };
  return { ...base, value: base.value + state.activityBonus, rank: Math.max(1, base.rank - Math.floor(state.activityBonus / 90)) };
}
export function nearby(state, mode = state.mode) {
  const info = summary(state, mode), numeric = typeof info.value === "number";
  return [-2, -1, 0, 1, 2].map((offset, index) => ({ rank: Math.max(1, info.rank + offset), name: offset === 0 ? "나" : profiles[(info.rank + index) % profiles.length], mine: offset === 0, value: numeric ? +(info.value - offset * (mode === "activity" ? 21 : 2)).toFixed(1) : offset === 0 ? info.value : ["22′31″", "22′39″", "22′56″", "23′02″"][offset < 0 ? offset + 2 : offset + 1], unit: info.unit }));
}
export function topTen(state, mode = state.mode) {
  const info = summary(state, mode), numeric = typeof info.value === "number";
  return Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, name: profiles[i], mine: info.rank === i + 1, value: numeric ? +(info.value + (info.rank - i - 1) * (mode === "activity" ? 21 : 2)).toFixed(1) : ["19′42″", "20′05″", "20′18″", "20′41″", "21′02″", "21′18″", "21′33″", "21′50″", "22′04″", "22′16″"][i], unit: info.unit }));
}
export function selectedDistrict(state) { return districts.find((d) => d.name === state.selectedDistrict) || districts[0]; }
export function participation(d) { return +(d.participants / d.active * 100).toFixed(1); }
export function simulate(state, type) { if (type === "activity") return { ...state, activityBonus: state.activityBonus + 18 }; if (type === "attendance") return { ...state, attendanceBonus: state.attendanceBonus + 1 }; if (type === "pb") return { ...state, pb: true }; return state; }
