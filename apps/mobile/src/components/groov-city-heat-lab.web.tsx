import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { koreaMunicipalities } from "../assets/korea-municipal-paths";
import {
  HEAT_COUNTRY_VIEW,
  HEAT_MY_DISTRICT,
  HEAT_MY_PROVINCE,
  assertHeatGeometry,
  compactProvince,
  createDistrictFronts,
  createProvinceFronts,
  focusView,
  formatHeat,
  heatColor,
  panHeatView,
  provinceView,
  zoomHeatView,
  type DistrictFront,
  type HeatFront,
  type HeatLevel,
  type HeatView,
  type LandmarkKind,
} from "./groov-city-heat-engine";

const ORANGE = "#ff4d24";
const geometryAudit = assertHeatGeometry(koreaMunicipalities);

type ScoreOverrides = Record<string, number>;
type Point = { x: number; y: number };
type BoardEntry = Pick<HeatFront, "key" | "name" | "rank" | "score" | "participationRate" | "todayDelta" | "landmark">;

export default function GroovCityHeatWebLab() {
  const router = useRouter();
  const [level, setLevel] = useState<HeatLevel>("country");
  const [province, setProvince] = useState(HEAT_MY_PROVINCE);
  const [districtCode, setDistrictCode] = useState(HEAT_MY_DISTRICT);
  const [viewport, setViewport] = useState<HeatView>(HEAT_COUNTRY_VIEW);
  const [scoreOverrides, setScoreOverrides] = useState<ScoreOverrides>({});
  const [showRanking, setShowRanking] = useState(false);
  const [showMission, setShowMission] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done">("idle");
  const [clock, setClock] = useState("06:02:14");
  const [toast, setToast] = useState("");
  const stageRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ view: HEAT_COUNTRY_VIEW, origin: { x: 0, y: 0 }, distance: 0 });
  const moved = useRef(false);
  const suppressClickUntil = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const provinceFronts = useMemo(() => createProvinceFronts(koreaMunicipalities), []);
  const rankedProvinces = useMemo(() => [...provinceFronts].sort((a, b) => a.rank - b.rank), [provinceFronts]);
  const provinceAreas = useMemo(() => koreaMunicipalities.filter((area) => area.province === province), [province]);
  const districtFronts = useMemo(
    () => createDistrictFronts(provinceAreas, scoreOverrides),
    [provinceAreas, scoreOverrides],
  );
  const rankedDistricts = useMemo(() => [...districtFronts].sort((a, b) => a.rank - b.rank), [districtFronts]);
  const selectedProvince = provinceFronts.find((item) => item.key === province) ?? rankedProvinces[0];
  const selectedDistrict = districtFronts.find((item) => item.code === districtCode) ?? rankedDistricts[0];
  const selected = level === "country" ? selectedProvince : selectedDistrict;
  const ranking: BoardEntry[] = level === "country" ? rankedProvinces : rankedDistricts;
  const rival = ranking.find((item) => item.rank === Math.max(1, (selected?.rank ?? 1) - 1));
  const gap = Math.max(0, (rival?.score ?? selected?.score ?? 0) - (selected?.score ?? 0));
  const heatProgress = gap === 0 ? 100 : Math.max(12, Math.min(92, 100 - gap / 95));

  useEffect(() => {
    const interval = setInterval(() => {
      setClock((value) => {
        const [hours = 0, minutes = 0, seconds = 0] = value.split(":").map(Number);
        const total = Math.max(0, hours * 3600 + minutes * 60 + seconds - 1);
        return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
          .map((part) => String(part).padStart(2, "0"))
          .join(":");
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function showToast(message: string) {
    setToast(message);
    const timer = setTimeout(() => setToast(""), 1800);
    timers.current.push(timer);
  }

  function selectProvince(name: string) {
    if (Date.now() < suppressClickUntil.current) return;
    setProvince(name);
  }

  function enterProvince(name: string) {
    if (Date.now() < suppressClickUntil.current) return;
    const areas = koreaMunicipalities.filter((area) => area.province === name);
    const local = createDistrictFronts(areas);
    const next = name === HEAT_MY_PROVINCE
      ? local.find((item) => item.code === HEAT_MY_DISTRICT) ?? local[0]
      : [...local].sort((a, b) => a.rank - b.rank)[0];
    setProvince(name);
    if (next) setDistrictCode(next.code);
    setLevel("province");
    setViewport(provinceView(areas));
    showToast(`${compactProvince(name)} 전장 진입`);
  }

  function selectDistrict(area: DistrictFront) {
    if (Date.now() < suppressClickUntil.current) return;
    setDistrictCode(area.code);
  }

  function focusDistrict(area: DistrictFront) {
    if (Date.now() < suppressClickUntil.current) return;
    setDistrictCode(area.code);
    setLevel("district");
    setViewport(focusView(area.center, Math.max(5.2, viewport.width * 0.42)));
    showToast(`${area.name} 거점 확대`);
  }

  function goBack() {
    if (showRanking) return setShowRanking(false);
    if (showMission) return setShowMission(false);
    if (level === "district") {
      setLevel("province");
      setViewport(provinceView(provinceAreas));
      return;
    }
    if (level === "province") {
      setLevel("country");
      setViewport(HEAT_COUNTRY_VIEW);
      return;
    }
    router.back();
  }

  function resetMap() {
    setLevel("country");
    setProvince(HEAT_MY_PROVINCE);
    setDistrictCode(HEAT_MY_DISTRICT);
    setViewport(HEAT_COUNTRY_VIEW);
    showToast("전국 전장으로 복귀");
  }

  function zoom(factor: number) {
    setViewport((current) => zoomHeatView(current, factor));
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved.current = false;
    if (pointers.current.size === 1) {
      gesture.current = {
        view: viewport,
        origin: { x: event.clientX, y: event.clientY },
        distance: 0,
      };
    } else if (pointers.current.size === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        view: viewport,
        origin: { x: event.clientX, y: event.clientY },
        distance: pointerDistance([...pointers.current.values()]),
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (points.length >= 2) {
      const distance = pointerDistance(points);
      if (gesture.current.distance > 0 && Math.abs(distance - gesture.current.distance) > 2) {
        if (!moved.current) event.currentTarget.setPointerCapture(event.pointerId);
        moved.current = true;
        setViewport(zoomHeatView(gesture.current.view, gesture.current.distance / distance));
      }
      return;
    }
    const dx = event.clientX - gesture.current.origin.x;
    const dy = event.clientY - gesture.current.origin.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      if (!moved.current) event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = true;
      setViewport(panHeatView(gesture.current.view, dx, dy, rect.width, rect.height));
    }
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    if (moved.current) suppressClickUntil.current = Date.now() + 180;
    if (pointers.current.size === 1) {
      const remaining = [...pointers.current.values()][0];
      if (remaining) gesture.current = { view: viewport, origin: remaining, distance: 0 };
    }
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.14 : 0.86);
  }

  function activatePrimaryAction() {
    if (level === "country") {
      enterProvince(province);
      return;
    }
    if (!selectedDistrict || syncState !== "idle") return;
    setSyncState("syncing");
    const scoreAtStart = selectedDistrict.score;
    const finish = setTimeout(() => {
      setScoreOverrides((current) => ({ ...current, [selectedDistrict.code]: scoreAtStart + 128 }));
      setSyncState("done");
      showToast("기록 검증 완료 · 지역 HEAT +128");
    }, 720);
    const reset = setTimeout(() => setSyncState("idle"), 2600);
    timers.current.push(finish, reset);
  }

  async function shareBattle() {
    const text = `${selected?.name ?? "우리 지역"} #${selected?.rank ?? 1} · ${formatHeat(selected?.score ?? 0)} HEAT. 기록 하나로 지역 순위를 바꾸는 GROOV CITY HEAT`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("현재 전황을 복사했습니다");
    } catch {
      showToast("공유 문구를 준비했습니다");
    }
  }

  if (!geometryAudit.valid || !selected) {
    return <div className="heat-fallback">행정구역 데이터를 안전하게 복구 중입니다.</div>;
  }

  return (
    <main className="heat-root">
      <div className="game-shell">
        <header className="game-header">
          <button aria-label="이전 화면" className="plain-icon" onClick={goBack} type="button">
            <ArrowIcon />
          </button>
          <div className="brand"><i>GROOV</i><span>CITY HEAT</span></div>
          <button aria-label="현재 전황 공유" className="plain-icon" onClick={shareBattle} type="button">
            <ShareIcon />
          </button>
        </header>

        <section className="battle-stage">
          <div className="stage-vignette" />
          <div className="season-hud">
            <div>
              <span className="micro orange">SEASON 01</span>
              <strong>{clock}</strong>
            </div>
            <button className="mission-chip" onClick={() => setShowMission(true)} type="button">
              <span className="live-pip" />
              <span>LIVE MISSION</span>
              <b>{gap === 0 ? "DEFEND #1" : `-${formatHeat(gap)} PT`}</b>
            </button>
          </div>

          <div className="world-perspective">
            <svg
              aria-label="대한민국 실제 행정구역 기반 GROOV CITY HEAT 게임 지도"
              className={`world-map ${level}`}
              onPointerCancel={onPointerUp}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
              ref={stageRef}
              role="application"
              viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            >
              <defs>
                <linearGradient id="heat-selected" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#ff8b3d" />
                  <stop offset=".46" stopColor="#ff4d24" />
                  <stop offset="1" stopColor="#bd2510" />
                </linearGradient>
                <linearGradient id="spire-glass" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#ffd0bf" stopOpacity=".92" />
                  <stop offset=".38" stopColor="#ff5a2d" stopOpacity=".98" />
                  <stop offset="1" stopColor="#43150d" stopOpacity="1" />
                </linearGradient>
                <radialGradient id="core-glow">
                  <stop offset="0" stopColor="#fff3eb" stopOpacity="1" />
                  <stop offset=".26" stopColor="#ff6a36" stopOpacity=".9" />
                  <stop offset="1" stopColor="#ff4d24" stopOpacity="0" />
                </radialGradient>
                <pattern id="grid" height="16" patternUnits="userSpaceOnUse" width="16">
                  <path d="M16 0H0V16" fill="none" stroke="#6f2a1a" strokeOpacity=".24" strokeWidth=".28" />
                </pattern>
              </defs>
              <rect fill="url(#grid)" height={viewport.height} width={viewport.width} x={viewport.x} y={viewport.y} />
              {level === "country" ? (
                <NationalBattleMap fronts={provinceFronts} onDouble={enterProvince} onSelect={selectProvince} selected={province} viewport={viewport} />
              ) : (
                <DistrictBattleMap fronts={districtFronts} onDouble={focusDistrict} onSelect={selectDistrict} selected={districtCode} viewport={viewport} />
              )}
            </svg>
          </div>

          <div className="breadcrumb-hud">
            <span>KOREA</span><b>/</b><em>{compactProvince(province)}</em>
            {level === "district" ? <><b>/</b><em>{selectedDistrict?.name}</em></> : null}
          </div>

          <div className="control-rail" aria-label="지도 조작">
            <button aria-label="지도 확대" onClick={() => zoom(0.78)} type="button">+</button>
            <button aria-label="지도 축소" onClick={() => zoom(1.28)} type="button">−</button>
            <button aria-label="내 지역으로 이동" onClick={() => enterProvince(HEAT_MY_PROVINCE)} type="button"><TargetIcon /></button>
            <button aria-label="전국 지도 초기화" onClick={resetMap} type="button"><ResetIcon /></button>
          </div>

          <div className="interaction-legend"><GestureIcon /> 탭 선택 · 더블탭 확대 · 드래그 이동 · 핀치 줌</div>

          <section className={`command-center ${syncState === "done" ? "score-hit" : ""}`}>
            <div className="command-accent" />
            <div className="region-line">
              <div className="region-copy">
                <span className="micro orange">{level === "country" ? "SELECTED FRONT" : "SELECTED DISTRICT"}</span>
                <h1>{selected.name}</h1>
              </div>
              <div className="rank-lockup"><span>RANK</span><strong>#{selected.rank}</strong></div>
            </div>
            <div className="score-row">
              <strong>{formatHeat(selected.score)}</strong><span>HEAT</span>
              {syncState === "done" ? <b className="gain">+128</b> : null}
            </div>
            <div className="chase-row">
              <div className="chase-track"><i style={{ width: `${heatProgress}%` }} /></div>
              <span>{gap === 0 ? "1위 방어 중" : `${rival?.name ?? "윗 순위"}까지 ${formatHeat(gap)}pt`}</span>
            </div>
            <div className="command-actions">
              <button className="primary-action" disabled={syncState === "syncing"} onClick={activatePrimaryAction} type="button">
                <FlameIcon />
                {level === "country" ? "이 지역 전장 입장" : syncState === "syncing" ? "기록 검증 중…" : "내 기록으로 +128"}
              </button>
              <button className="ranking-action" onClick={() => setShowRanking(true)} type="button"><RankingIcon /><span>랭킹</span></button>
            </div>
          </section>

          {syncState !== "idle" ? <div className={`energy-burst ${syncState}`} aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((index) => <i key={index} style={{ "--spark": index } as CSSProperties} />)}</div> : null}
          {toast ? <div className="toast">{toast}</div> : null}
        </section>

        {showRanking ? (
          <div className="overlay" role="dialog" aria-modal="true" aria-label="지역 전체 랭킹">
            <button aria-label="랭킹 닫기" className="overlay-dismiss" onClick={() => setShowRanking(false)} type="button" />
            <section className="ranking-sheet">
              <div className="sheet-grip" />
              <header>
                <div><span className="micro orange">{level === "country" ? "NATIONAL FRONT" : `${compactProvince(province)} FRONT`}</span><h2>{level === "country" ? "전국 지역 랭킹" : `${province} 지역 랭킹`}</h2></div>
                <button aria-label="랭킹 닫기" onClick={() => setShowRanking(false)} type="button">×</button>
              </header>
              <div className="ranking-list">
                {ranking.map((item) => (
                  <button
                    className={item.key === selected.key ? "ranking-row selected" : "ranking-row"}
                    key={item.key}
                    onClick={() => {
                      if (level === "country") setProvince(item.key);
                      else setDistrictCode(item.key);
                      setShowRanking(false);
                    }}
                    type="button"
                  >
                    <span className="row-rank">{String(item.rank).padStart(2, "0")}</span>
                    <LandmarkBadge kind={item.landmark} />
                    <span className="row-main"><b>{item.name}</b><small>참여 {item.participationRate.toFixed(1)}% · 오늘 +{formatHeat(item.todayDelta)}</small></span>
                    <strong>{formatHeat(item.score)}<small>pt</small></strong>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {showMission ? (
          <div className="overlay" role="dialog" aria-modal="true" aria-label="현재 미션">
            <button aria-label="미션 닫기" className="overlay-dismiss" onClick={() => setShowMission(false)} type="button" />
            <section className="mission-sheet">
              <span className="micro orange">LIVE MISSION</span>
              <h2>{gap === 0 ? "1위를 6시간 지켜내세요" : `${rival?.name ?? "윗 지역"}을 추월하세요`}</h2>
              <p>인증된 운동 기록만 HEAT로 반영됩니다. 기록의 강도보다 꾸준한 참여가 더 큰 흐름을 만듭니다.</p>
              <div className="reward"><LandmarkBadge kind="gate" /><span><small>NEXT REWARD</small><b>ORANGE RELAY 거점</b></span><strong>{gap === 0 ? "방어" : `${formatHeat(gap)}pt`}</strong></div>
              <button className="primary-action full" onClick={() => { setShowMission(false); activatePrimaryAction(); }} type="button">미션에 기록 반영</button>
            </section>
          </div>
        ) : null}
      </div>
      <style>{styles}</style>
      <style>{`.world-map.country{transform:rotateX(37deg) rotateZ(-2.2deg) translateY(3%) scale(1.52)}.world-map.province,.world-map.district{transform:none;width:100%;height:100%}.landmark{animation:none}.map-tag{filter:none}.battle-route{fill:none;stroke:#ff5a30;stroke-linecap:round;stroke-dasharray:2.4 2;opacity:.62;animation:routeFlow 1.8s linear infinite}.battle-route-shadow{fill:none;stroke:#050403;stroke-width:2.1;opacity:.72}.ranking-list{scrollbar-color:#6a3022 #120e0c;scrollbar-width:thin}.ranking-list::-webkit-scrollbar{width:4px}.ranking-list::-webkit-scrollbar-track{background:#120e0c}.ranking-list::-webkit-scrollbar-thumb{background:#6a3022;border-radius:4px}.reward>.landmark-badge{display:block;flex:0 0 36px;width:36px;height:36px;gap:0}@keyframes routeFlow{to{stroke-dashoffset:-8}}`}</style>
    </main>
  );
}

function NationalBattleMap({ fronts, selected, viewport, onSelect, onDouble }: { fronts: HeatFront[]; selected: string; viewport: HeatView; onSelect: (name: string) => void; onDouble: (name: string) => void }) {
  const byName = new Map(fronts.map((item) => [item.key, item]));
  const top = [...fronts].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const depth = Math.max(2, viewport.width / 68);
  return <g className="terrain">
    <g opacity=".72" pointerEvents="none" transform={`translate(0 ${depth * 2.2})`}>{koreaMunicipalities.map((area) => <path d={area.path} fill="#050403" key={`deep-${area.code}`} />)}</g>
    <g pointerEvents="none" transform={`translate(0 ${depth})`}>{koreaMunicipalities.map((area) => <path d={area.path} fill="#3b160e" key={`edge-${area.code}`} stroke="#120806" strokeWidth=".5" />)}</g>
    {koreaMunicipalities.map((area) => {
      const front = byName.get(area.province);
      const active = area.province === selected;
      return <path
        aria-label={`${compactProvince(area.province)} 지역`}
        className={active ? "territory active" : "territory"}
        d={area.path}
        fill={heatColor(front?.heat ?? area.heat, active)}
        key={area.code}
        onClick={(event) => { event.stopPropagation(); onSelect(area.province); }}
        onDoubleClick={(event) => { event.stopPropagation(); onDouble(area.province); }}
        role="button"
        stroke={active ? "#ffd6c7" : "#17100d"}
        strokeWidth={active ? 1.05 : .42}
        tabIndex={0}
      />;
    })}
    <BattleRoutes fronts={top} scale={1} />
    {top.map((front) => <BattleLandmark center={front.center} key={front.key} kind={front.landmark} rank={front.rank} scale={4.1} />)}
    {fronts.filter((item) => item.key === selected).map((front) => <MapTag center={front.center} key={front.key} name={front.name} rank={front.rank} score={front.score} scale={5.2} />)}
  </g>;
}

function DistrictBattleMap({ fronts, selected, viewport, onSelect, onDouble }: { fronts: DistrictFront[]; selected: string; viewport: HeatView; onSelect: (area: DistrictFront) => void; onDouble: (area: DistrictFront) => void }) {
  const top = [...fronts].sort((a, b) => a.rank - b.rank).slice(0, 3);
  const depth = Math.max(.26, viewport.width / 34);
  const labelScale = Math.max(.28, viewport.width / 43);
  return <g className="terrain">
    <g opacity=".8" pointerEvents="none" transform={`translate(0 ${depth * 2.5})`}>{fronts.map((area) => <path d={area.path} fill="#040302" key={`deep-${area.code}`} />)}</g>
    <g pointerEvents="none" transform={`translate(0 ${depth})`}>{fronts.map((area) => <path d={area.path} fill="#4c190f" key={`edge-${area.code}`} stroke="#0e0705" strokeWidth={depth * .24} />)}</g>
    {fronts.map((area) => {
      const active = area.code === selected;
      return <path
        aria-label={`${area.name}, ${area.rank}위, ${formatHeat(area.score)}포인트`}
        className={active ? "territory active" : "territory"}
        d={area.path}
        fill={heatColor(area.heat, active)}
        key={area.code}
        onClick={(event) => { event.stopPropagation(); onSelect(area); }}
        onDoubleClick={(event) => { event.stopPropagation(); onDouble(area); }}
        role="button"
        stroke={active ? "#ffe5dc" : "rgba(255,217,202,.36)"}
        strokeWidth={active ? Math.max(.1, viewport.width / 150) : Math.max(.04, viewport.width / 440)}
        tabIndex={0}
        transform={active ? `translate(0 ${-depth * .7})` : undefined}
      />;
    })}
    <BattleRoutes fronts={top} scale={Math.max(.15, viewport.width / 160)} />
    {top.map((front) => <BattleLandmark center={front.center} key={front.key} kind={front.landmark} rank={front.rank} scale={Math.max(.23, viewport.width / 56)} />)}
    {fronts.filter((item) => item.code === selected).map((front) => <MapTag center={front.center} key={front.code} name={front.name} rank={front.rank} score={front.score} scale={labelScale} />)}
  </g>;
}

function MapTag({ center: [x, y], name, rank, score, scale }: { center: [number, number]; name: string; rank: number; score: number; scale: number }) {
  const width = 10.5 * scale;
  const height = 4.25 * scale;
  return <g className="map-tag" pointerEvents="none">
    <line stroke={ORANGE} strokeDasharray={`${.6 * scale} ${.38 * scale}`} strokeWidth={.18 * scale} x1={x} x2={x} y1={y + 2.5 * scale} y2={y + 5.5 * scale} />
    <rect fill="rgba(7,6,5,.94)" height={height} rx={1.15 * scale} stroke={ORANGE} strokeWidth={.16 * scale} width={width} x={x - width / 2} y={y + 5.1 * scale} />
    <text fill="#fff8f4" fontSize={1.2 * scale} fontWeight="900" textAnchor="middle" x={x} y={y + 7 * scale}>{name}</text>
    <text fill="#ff7045" fontSize={.82 * scale} fontWeight="800" textAnchor="middle" x={x} y={y + 8.45 * scale}>#{rank} · {formatHeat(score, true)}</text>
  </g>;
}

function BattleRoutes({ fronts, scale }: { fronts: readonly HeatFront[]; scale: number }) {
  const leader = fronts[0];
  if (!leader) return null;
  return <g pointerEvents="none">
    {fronts.slice(1).map((front) => {
      const middleX = (leader.center[0] + front.center[0]) / 2;
      const middleY = Math.min(leader.center[1], front.center[1]) - 8 * scale;
      const path = `M${leader.center[0]} ${leader.center[1]} Q${middleX} ${middleY} ${front.center[0]} ${front.center[1]}`;
      return <g key={`route-${front.key}`}>
        <path className="battle-route-shadow" d={path} />
        <path className="battle-route" d={path} strokeWidth={Math.max(.34, 1.1 * scale)} />
      </g>;
    })}
  </g>;
}

function BattleLandmark({ center: [x, y], kind, rank, scale }: { center: [number, number]; kind: LandmarkKind; rank: number; scale: number }) {
  if (kind === "spire") return <g className="landmark" pointerEvents="none">
    <ellipse cx={x} cy={y + 2.8 * scale} fill="#000" opacity=".52" rx={5.8 * scale} ry={2.1 * scale} />
    <polygon fill="#1b0c08" points={`${x - 5 * scale},${y + 1.7 * scale} ${x},${y - .9 * scale} ${x + 5 * scale},${y + 1.7 * scale} ${x},${y + 4.4 * scale}`} stroke="#ff5b2e" strokeWidth={.2 * scale} />
    <polygon fill="url(#spire-glass)" points={`${x},${y - 8.8 * scale} ${x + 1.55 * scale},${y + 1.2 * scale} ${x},${y + 2.1 * scale} ${x - 1.55 * scale},${y + 1.2 * scale}`} stroke="#ffd2c2" strokeWidth={.2 * scale} />
    <polygon fill="#6f2114" points={`${x - 3.7 * scale},${y + 1.5 * scale} ${x - 2.5 * scale},${y - 3.2 * scale} ${x - 1.5 * scale},${y + 1.7 * scale}`} stroke="#ff6b3c" strokeWidth={.15 * scale} />
    <polygon fill="#42150e" points={`${x + 1.6 * scale},${y + 1.7 * scale} ${x + 2.8 * scale},${y - 4.1 * scale} ${x + 3.8 * scale},${y + 1.45 * scale}`} stroke="#ff6b3c" strokeWidth={.15 * scale} />
    <circle cx={x} cy={y - 9.1 * scale} fill="url(#core-glow)" r={1.45 * scale} />
    <RankNode rank={rank} scale={scale} x={x} y={y + 4.2 * scale} />
  </g>;
  if (kind === "arena") return <g className="landmark" pointerEvents="none">
    <ellipse cx={x} cy={y + 2.1 * scale} fill="#000" opacity=".5" rx={5.3 * scale} ry={1.7 * scale} />
    <polygon fill="#2b110b" points={`${x - 4.8 * scale},${y + .5 * scale} ${x},${y - 2.15 * scale} ${x + 4.8 * scale},${y + .5 * scale} ${x},${y + 3.15 * scale}`} stroke="#ff6237" strokeWidth={.22 * scale} />
    <ellipse cx={x} cy={y + .2 * scale} fill="#080605" rx={3.15 * scale} ry={1.75 * scale} stroke="#ffb59f" strokeWidth={.28 * scale} />
    <ellipse cx={x} cy={y + .2 * scale} fill="#4f1b11" rx={2.1 * scale} ry={1.08 * scale} stroke="#ff5429" strokeWidth={.2 * scale} />
    {[-3.7, -2.4, 2.4, 3.7].map((offset) => <line key={offset} stroke="#ff6a3a" strokeWidth={.28 * scale} x1={x + offset * scale} x2={x + offset * .82 * scale} y1={y - .7 * scale} y2={y - 2.2 * scale} />)}
    <RankNode rank={rank} scale={scale} x={x} y={y + 3.4 * scale} />
  </g>;
  return <g className="landmark" pointerEvents="none">
    <ellipse cx={x} cy={y + 2.4 * scale} fill="#000" opacity=".5" rx={4.8 * scale} ry={1.65 * scale} />
    <polygon fill="#25100a" points={`${x - 4.1 * scale},${y + 1.1 * scale} ${x},${y - 1.1 * scale} ${x + 4.1 * scale},${y + 1.1 * scale} ${x},${y + 3.2 * scale}`} stroke="#ff5d31" strokeWidth={.21 * scale} />
    <polygon fill="url(#spire-glass)" points={`${x - 2.75 * scale},${y + .7 * scale} ${x - 1.7 * scale},${y - 5.1 * scale} ${x - .65 * scale},${y + .75 * scale}`} stroke="#ffb59f" strokeWidth={.18 * scale} />
    <polygon fill="url(#spire-glass)" points={`${x + .65 * scale},${y + .75 * scale} ${x + 1.7 * scale},${y - 5.1 * scale} ${x + 2.75 * scale},${y + .7 * scale}`} stroke="#ffb59f" strokeWidth={.18 * scale} />
    <line stroke="#ff6b3b" strokeWidth={.45 * scale} x1={x - 1.55 * scale} x2={x + 1.55 * scale} y1={y - 2.45 * scale} y2={y - 2.45 * scale} />
    <circle cx={x} cy={y - 2.45 * scale} fill="url(#core-glow)" r={1.05 * scale} />
    <RankNode rank={rank} scale={scale} x={x} y={y + 3.45 * scale} />
  </g>;
}

function RankNode({ x, y, rank, scale }: { x: number; y: number; rank: number; scale: number }) {
  return <g><circle cx={x} cy={y} fill="#080605" r={1.12 * scale} stroke={ORANGE} strokeWidth={.24 * scale} /><text fill="#fff8f3" fontSize={1.02 * scale} fontWeight="900" textAnchor="middle" x={x} y={y + .36 * scale}>{rank}</text></g>;
}

function LandmarkBadge({ kind }: { kind: LandmarkKind }) {
  return <span className={`landmark-badge ${kind}`} aria-hidden="true"><i /><b /></span>;
}

function pointerDistance(points: Point[]) {
  const a = points[0];
  const b = points[1];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

const ArrowIcon = () => <svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7" /></svg>;
const ShareIcon = () => <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="18" cy="19" r="2" /><path d="m8 11 8-5M8 13l8 5" /></svg>;
const TargetIcon = () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>;
const ResetIcon = () => <svg viewBox="0 0 24 24"><path d="M4 8V3m0 0h5M4 3l4 4a8 8 0 1 1-2 8" /></svg>;
const GestureIcon = () => <svg viewBox="0 0 24 24"><path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v7c0 4-3 7-7 7h-1c-3 0-5-1-7-4l-2-3a2 2 0 0 1 3-2l2 2" /></svg>;
const FlameIcon = () => <svg viewBox="0 0 24 24"><path d="M13 2s1 5-3 8c-2 2-3 4-2 7 1 3 3 5 5 5 4 0 7-3 7-7 0-5-4-8-7-13Zm-1 17c-2-1-2-3-1-5 1 1 2 1 3 0 1 2 1 4-2 5Z" /></svg>;
const RankingIcon = () => <svg viewBox="0 0 24 24"><path d="M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7M3 20h18" /></svg>;

const styles = String.raw`
*{box-sizing:border-box}html,body,#root{height:100%;margin:0;background:#050403}button{font:inherit}.heat-root{--orange:#ff4d24;--hot:#ff7940;--ink:#080706;--panel:#120e0c;--line:#34221b;min-height:100%;background:#050403;color:#fff;font-family:"Noto Sans KR",system-ui,sans-serif}.game-shell{height:100dvh;max-width:560px;margin:0 auto;background:#080706;overflow:hidden;position:relative;box-shadow:0 0 90px #000}.game-header{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 10px;border-bottom:1px solid #2b1811;background:#090706;position:relative;z-index:30}.plain-icon{width:44px;height:44px;border:0;background:transparent;color:#f8f2ee;display:grid;place-items:center;cursor:pointer}.plain-icon svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}.brand{display:flex;align-items:baseline;gap:9px}.brand i{font:italic 900 20px/1 Archivo,system-ui;color:var(--orange);letter-spacing:-.8px}.brand span{font:800 10px/1 Archivo,system-ui;letter-spacing:1.8px;color:#eee4de}.battle-stage{height:calc(100dvh - 58px);position:relative;overflow:hidden;background:radial-gradient(circle at 50% 28%,#32140d 0,#130c09 34%,#080706 72%)}.stage-vignette{position:absolute;inset:0;pointer-events:none;z-index:5;background:linear-gradient(#080706 0,transparent 14%,transparent 57%,#080706 82%),linear-gradient(90deg,rgba(0,0,0,.7),transparent 19%,transparent 81%,rgba(0,0,0,.6))}.season-hud{position:absolute;top:14px;left:18px;right:18px;z-index:20;display:flex;align-items:flex-start;justify-content:space-between}.season-hud>div{display:flex;flex-direction:column;gap:3px}.season-hud strong{font:900 19px/1 Archivo,system-ui;letter-spacing:.5px;font-variant-numeric:tabular-nums}.micro{font:900 9px/1.2 Archivo,system-ui;letter-spacing:1.45px}.orange{color:var(--orange)}.mission-chip{border:1px solid #603023;background:rgba(9,7,6,.85);border-radius:12px;color:#e9dfda;display:grid;grid-template-columns:auto auto;gap:1px 6px;align-items:center;padding:7px 9px;cursor:pointer}.mission-chip span:not(.live-pip){font:800 8px/1 Archivo;letter-spacing:.9px}.mission-chip b{grid-column:2;color:var(--hot);font:900 10px/1.3 Archivo}.live-pip{width:7px;height:7px;border-radius:2px;background:var(--orange);box-shadow:0 0 12px var(--orange);grid-row:1/3}.world-perspective{position:absolute;inset:55px -5% 150px;display:grid;place-items:center;perspective:900px;z-index:4}.world-map{width:108%;height:108%;overflow:visible;touch-action:none;user-select:none;transform:rotateX(37deg) rotateZ(-2.2deg) translateY(-3%);transform-origin:50% 52%;filter:drop-shadow(0 22px 18px rgba(0,0,0,.72));cursor:grab}.world-map:active{cursor:grabbing}.territory{cursor:pointer;transition:filter .16s ease,opacity .16s ease;outline:none}.territory:hover,.territory:focus-visible{filter:brightness(1.22)}.territory.active{filter:drop-shadow(0 0 2px #ffab8c) drop-shadow(0 0 7px rgba(255,77,36,.62));animation:territoryPulse 1.8s ease-in-out infinite}.landmark{filter:drop-shadow(0 5px 4px rgba(0,0,0,.62));animation:landmarkFloat 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.map-tag{filter:drop-shadow(0 3px 3px rgba(0,0,0,.6))}.breadcrumb-hud{position:absolute;top:67px;left:17px;z-index:16;display:flex;align-items:center;gap:6px;max-width:73%;padding:7px 10px;border:1px solid rgba(255,255,255,.11);background:rgba(8,6,5,.78);backdrop-filter:blur(12px);border-radius:10px;font-size:10px}.breadcrumb-hud span{font:900 9px Archivo;color:#756861;letter-spacing:1px}.breadcrumb-hud b{color:#673224}.breadcrumb-hud em{font-style:normal;font-weight:800;color:#f5ece7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.control-rail{position:absolute;right:13px;top:100px;z-index:18;display:grid;border:1px solid rgba(255,255,255,.13);border-radius:12px;overflow:hidden;background:rgba(9,7,6,.85);backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,0,0,.3)}.control-rail button{width:40px;height:40px;border:0;border-bottom:1px solid rgba(255,255,255,.1);background:transparent;color:#f8f1ed;font:500 22px/1 Archivo;cursor:pointer}.control-rail button:last-child{border:0}.control-rail button:hover{background:#28150f;color:var(--hot)}.control-rail svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.interaction-legend{position:absolute;left:17px;bottom:199px;z-index:17;color:#aa9b93;border-left:2px solid var(--orange);padding:4px 8px;background:linear-gradient(90deg,rgba(8,6,5,.82),transparent);font-size:9px;font-weight:700;letter-spacing:.1px;display:flex;align-items:center;gap:6px}.interaction-legend svg{width:14px;height:14px;fill:none;stroke:var(--orange);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.command-center{position:absolute;z-index:20;left:0;right:0;bottom:0;min-height:184px;padding:13px 18px 14px;background:linear-gradient(180deg,rgba(20,15,12,.96),#0e0b09 74%);border-top:1px solid #4b281d;box-shadow:0 -18px 50px rgba(0,0,0,.54);backdrop-filter:blur(18px)}.command-accent{position:absolute;left:0;top:-1px;height:2px;width:34%;background:linear-gradient(90deg,var(--orange),transparent)}.region-line{display:flex;justify-content:space-between;align-items:center;gap:14px}.region-copy{min-width:0}.region-copy h1{margin:3px 0 0;font-size:25px;line-height:1.12;letter-spacing:-1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rank-lockup{height:45px;min-width:64px;padding:6px 10px;border:1px solid #653022;background:#25130e;display:flex;flex-direction:column;align-items:center;justify-content:center;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}.rank-lockup span{font:800 7px Archivo;color:#9a7164;letter-spacing:1px}.rank-lockup strong{font:900 18px Archivo;color:var(--hot)}.score-row{height:44px;display:flex;align-items:baseline;min-width:0}.score-row>strong{font:900 clamp(31px,9.5vw,43px)/1 Archivo;letter-spacing:-2px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:clip}.score-row>span{margin-left:7px;color:var(--orange);font:900 9px Archivo;letter-spacing:1.1px}.score-row .gain{margin-left:auto;color:#ff8b55;font:900 13px Archivo;animation:gainPop .45s ease-out}.chase-row{display:flex;align-items:center;gap:9px;margin-top:2px}.chase-track{height:5px;border-radius:4px;background:#2c211d;flex:1;overflow:hidden}.chase-track i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#ae2e17,var(--orange),#ff9769);box-shadow:0 0 10px rgba(255,77,36,.55);transition:width .5s ease}.chase-row>span{font:800 8px Archivo;color:#a89a92;letter-spacing:.2px;white-space:nowrap}.command-actions{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}.primary-action,.ranking-action{height:47px;border:0;cursor:pointer;font-weight:900}.primary-action{background:var(--orange);color:#090706;display:flex;align-items:center;justify-content:center;gap:7px;clip-path:polygon(11px 0,100% 0,100% calc(100% - 11px),calc(100% - 11px) 100%,0 100%,0 11px)}.primary-action:hover{background:#ff6b3e}.primary-action:disabled{opacity:.62}.primary-action svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ranking-action{min-width:82px;padding:0 13px;border:1px solid #49342c;background:#241c18;color:#f7efeb;display:flex;gap:6px;align-items:center;justify-content:center;border-radius:10px}.ranking-action svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ranking-action span{font-size:12px}.score-hit{animation:deckHit .48s ease-out}.energy-burst{position:absolute;left:50%;bottom:178px;width:4px;height:4px;z-index:19}.energy-burst i{--angle:calc(var(--spark)*60deg);position:absolute;width:3px;height:28px;background:linear-gradient(var(--orange),transparent);transform-origin:50% 36px;transform:rotate(var(--angle)) translateY(-20px);animation:sparkFly .75s ease-out forwards}.toast{position:absolute;z-index:60;left:50%;bottom:210px;transform:translateX(-50%);white-space:nowrap;padding:9px 13px;border:1px solid #6a3324;background:rgba(17,12,10,.94);box-shadow:0 10px 32px rgba(0,0,0,.45);font-size:11px;font-weight:800;color:#f4ebe6;animation:toastIn .25s ease-out}.overlay{position:absolute;inset:58px 0 0;z-index:80;display:flex;align-items:flex-end}.overlay-dismiss{position:absolute;inset:0;border:0;background:rgba(0,0,0,.68);backdrop-filter:blur(3px)}.ranking-sheet,.mission-sheet{position:relative;z-index:1;width:100%;background:#110d0b;border:1px solid #4b281d;border-bottom:0;border-radius:26px 26px 0 0;box-shadow:0 -20px 60px rgba(0,0,0,.65);animation:sheetUp .32s cubic-bezier(.2,.8,.2,1)}.ranking-sheet{height:min(76dvh,680px);overflow:hidden}.sheet-grip{width:38px;height:4px;margin:10px auto 0;border-radius:3px;background:#5b4339}.ranking-sheet>header{display:flex;align-items:center;justify-content:space-between;padding:15px 18px 14px;border-bottom:1px solid #2e211c}.ranking-sheet h2,.mission-sheet h2{margin:4px 0 0;font-size:21px;letter-spacing:-.6px}.ranking-sheet>header button{width:38px;height:38px;border:1px solid #3d2f29;border-radius:11px;background:#211a17;color:#f5ede8;font-size:24px;line-height:1;cursor:pointer}.ranking-list{height:calc(100% - 79px);overflow:auto;padding:0 12px 24px}.ranking-row{width:100%;min-height:66px;padding:0 7px;border:0;border-bottom:1px solid #2a211d;background:transparent;color:#fff;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer}.ranking-row.selected{background:linear-gradient(90deg,rgba(255,77,36,.14),transparent);border-left:2px solid var(--orange)}.row-rank{width:26px;color:#7f7068;font:900 14px Archivo;text-align:center}.ranking-row:nth-child(-n+3) .row-rank{color:var(--orange)}.landmark-badge{width:36px;height:36px;border:1px solid #46342d;background:#211814;display:block;position:relative;transform:rotate(45deg);border-radius:8px;flex:0 0 auto}.landmark-badge i,.landmark-badge b{position:absolute;display:block;background:var(--orange);transform:rotate(-45deg)}.landmark-badge i{width:4px;height:17px;left:15px;top:8px;box-shadow:0 0 8px rgba(255,77,36,.5)}.landmark-badge b{width:12px;height:3px;left:11px;top:20px}.landmark-badge.arena i{width:16px;height:9px;border:2px solid var(--orange);border-radius:50%;background:transparent;left:9px;top:12px}.landmark-badge.arena b{display:none}.landmark-badge.gate i{width:4px;height:15px;left:9px;top:9px;box-shadow:12px 0 var(--orange)}.landmark-badge.gate b{width:14px;left:10px;top:14px}.landmark-badge.outpost{opacity:.58}.row-main{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.row-main b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.row-main small{font-size:10px;color:#8f8179}.ranking-row>strong{max-width:112px;font:900 14px Archivo;color:#f9f1ed;white-space:nowrap}.ranking-row>strong small{font-size:8px;color:var(--orange);margin-left:2px}.mission-sheet{padding:24px 20px 28px}.mission-sheet h2{font-size:25px}.mission-sheet p{margin:10px 0 18px;color:#a99b93;font-size:13px;line-height:1.7}.reward{display:flex;align-items:center;gap:12px;border:1px solid #49281f;background:#21130f;padding:13px;margin-bottom:16px}.reward>span{display:flex;flex:1;flex-direction:column;gap:3px}.reward small{color:#98746a;font:800 8px Archivo;letter-spacing:1px}.reward b{font-size:13px}.reward>strong{color:var(--hot);font:900 13px Archivo}.primary-action.full{width:100%}.heat-fallback{min-height:100dvh;display:grid;place-items:center;background:#080706;color:#fff;font:700 15px system-ui}@keyframes territoryPulse{50%{filter:drop-shadow(0 0 3px #ffab8c) drop-shadow(0 0 12px rgba(255,77,36,.8)) brightness(1.08)}}@keyframes landmarkFloat{50%{transform:translateY(-2px)}}@keyframes deckHit{35%{transform:translateY(-5px)}70%{transform:translateY(2px)}}@keyframes gainPop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}@keyframes sparkFly{to{opacity:0;transform:rotate(var(--angle)) translateY(-72px) scale(.3)}}@keyframes toastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}@keyframes sheetUp{from{transform:translateY(100%)}to{transform:none}}@media(max-height:720px){.command-center{min-height:170px;padding-top:10px}.interaction-legend{bottom:183px}.region-copy h1{font-size:22px}.score-row{height:38px}.score-row>strong{font-size:32px}.command-actions{margin-top:7px}.primary-action,.ranking-action{height:42px}.world-perspective{bottom:137px}.toast{bottom:190px}}@media(min-width:700px){.game-shell{border-left:1px solid #201713;border-right:1px solid #201713}.control-rail{right:18px}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}.territory,.chase-track i{transition:none}}
`;
