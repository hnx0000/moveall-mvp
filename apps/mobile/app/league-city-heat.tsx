import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import {
  ArrowDown,
  ArrowLeft,
  ChevronRight,
  Flame,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { koreaMunicipalities } from "../src/assets/korea-municipal-paths";
import {
  CITY_HEAT_MY_REGION,
  assertCityHeatMapData,
  createCityHeatStandings,
  findNearestRivals,
  formatCityHeatRank,
  formatCityHeatScore,
  heatFill,
  scoreAfterContribution,
  type CityHeatMapLevel,
  type CityHeatStanding,
  type LandmarkTier,
} from "../src/components/league-city-heat-model";
import {
  NATIONAL_VIEW,
  SEOUL_VIEW,
  focusViewport,
  panViewport,
  zoomViewport,
  type LeagueViewport,
} from "../src/components/league-map-model";
import { fonts } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const ORANGE = "#FF5832";
const MAP_INK = "#090807";
const SEOUL_AREAS = koreaMunicipalities.filter((area) => area.province === "서울");
const mapAudit = assertCityHeatMapData(koreaMunicipalities);

type InteractionMode = "idle" | "panning" | "pinching" | "animating";
type ContributionStage = "idle" | "verifying" | "flying" | "accepted";

const provinceOrder = [
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

function distanceBetweenTouches(touches: readonly { pageX: number; pageY: number }[]) {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export default function LeagueCityHeatLab() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(), []);
  const [level, setLevel] = useState<CityHeatMapLevel>("country");
  const [selectedCode, setSelectedCode] = useState(CITY_HEAT_MY_REGION);
  const [viewport, setViewport] = useState<LeagueViewport>(NATIONAL_VIEW);
  const [surface, setSurface] = useState({ width: 1, height: 1 });
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [interaction, setInteraction] = useState<InteractionMode>("idle");
  const [contribution, setContribution] = useState<ContributionStage>("idle");
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState("서울");
  const lastContribution = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapCandidate = useRef({ code: "", at: 0 });
  const gesture = useRef({ viewport: NATIONAL_VIEW, distance: 0 });
  const contributionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lift = useSharedValue(0);
  const pulse = useSharedValue(0);

  const standings = useMemo(
    () => createCityHeatStandings(SEOUL_AREAS, scoreOverrides),
    [scoreOverrides],
  );
  const ranked = useMemo(() => [...standings].sort((a, b) => a.rank - b.rank), [standings]);
  const selected = standings.find((area) => area.code === selectedCode) ?? standings[0];
  const rivals = useMemo(
    () => findNearestRivals(standings, selected?.code ?? CITY_HEAT_MY_REGION, 2),
    [selected?.code, standings],
  );
  const mainRival = rivals[0];

  const provinceSummary = useMemo(() => {
    return provinceOrder.map((province, index) => {
      const areas = koreaMunicipalities.filter((area) => area.province === province);
      const heat = areas.length
        ? areas.reduce((sum, area) => sum + area.heat, 0) / areas.length
        : 0;
      const score = areas.reduce(
        (sum, area) => sum + 9_000 + area.heat * 112 + Number(area.code.slice(-2)),
        0,
      );
      const center: [number, number] = areas.length
        ? [
            areas.reduce((sum, area) => sum + area.center[0], 0) / areas.length,
            areas.reduce((sum, area) => sum + area.center[1], 0) / areas.length,
          ]
        : [0, 0];
      return { province, areas, center, heat, score, seedRank: index + 1 };
    });
  }, []);
  const rankedProvinces = useMemo(
    () => [...provinceSummary].sort((a, b) => b.score - a.score),
    [provinceSummary],
  );

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      contributionTimers.current.forEach(clearTimeout);
    };
  }, []);

  const selectionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: 1 + pulse.value * 0.018 }],
  }));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event, state) =>
          event.nativeEvent.touches.length >= 2 || Math.abs(state.dx) + Math.abs(state.dy) > 8,
        onPanResponderGrant: (event) => {
          gesture.current = {
            viewport,
            distance: distanceBetweenTouches(event.nativeEvent.touches),
          };
          setInteraction(event.nativeEvent.touches.length >= 2 ? "pinching" : "panning");
        },
        onPanResponderMove: (event, state) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            const nextDistance = distanceBetweenTouches(touches);
            if (gesture.current.distance > 0 && nextDistance > 0) {
              setViewport(zoomViewport(gesture.current.viewport, gesture.current.distance / nextDistance));
            }
            return;
          }
          setViewport(
            panViewport(
              gesture.current.viewport,
              state.dx,
              state.dy,
              surface.width,
              surface.height,
            ),
          );
        },
        onPanResponderRelease: () => setInteraction("idle"),
        onPanResponderTerminate: () => setInteraction("idle"),
      }),
    [surface.height, surface.width, viewport],
  );

  function bounceSelection() {
    lift.value = withSequence(
      withTiming(-8, { duration: 140 }),
      withSpring(-4, { damping: 12, stiffness: 190 }),
    );
    pulse.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 360 }));
  }

  function enterSeoul() {
    setLevel("seoul");
    setSelectedProvince("서울");
    setViewport(SEOUL_VIEW);
    setInteraction("animating");
    const timer = setTimeout(() => setInteraction("idle"), 420);
    contributionTimers.current.push(timer);
  }

  function focusDistrict(area: CityHeatStanding) {
    setLevel("district");
    setViewport(focusViewport(area.center, 7.2));
    setInteraction("animating");
    bounceSelection();
    const timer = setTimeout(() => setInteraction("idle"), 420);
    contributionTimers.current.push(timer);
  }

  function handleAreaPress(area: CityHeatStanding) {
    if (interaction === "pinching" || interaction === "panning") return;
    const now = Date.now();
    const isDoubleTap = tapCandidate.current.code === area.code && now - tapCandidate.current.at < 320;

    if (isDoubleTap) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = null;
      tapCandidate.current = { code: "", at: 0 };
      setSelectedCode(area.code);
      focusDistrict(area);
      return;
    }

    tapCandidate.current = { code: area.code, at: now };
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      setSelectedCode(area.code);
      bounceSelection();
      tapTimer.current = null;
    }, 210);
  }

  function handleCountryPress(province: string) {
    setSelectedProvince(province);
    if (province === "서울") enterSeoul();
  }

  function goBackLevel() {
    if (level === "district") {
      setLevel("seoul");
      setViewport(SEOUL_VIEW);
      return;
    }
    if (level === "seoul") {
      setLevel("country");
      setViewport(NATIONAL_VIEW);
      return;
    }
    router.back();
  }

  function resetMap() {
    setLevel("country");
    setViewport(NATIONAL_VIEW);
    setSelectedProvince("서울");
    setSelectedCode(CITY_HEAT_MY_REGION);
    setShowDetails(false);
  }

  function simulateContribution() {
    if (!selected || contribution !== "idle") return;
    contributionTimers.current.forEach(clearTimeout);
    contributionTimers.current = [];
    lastContribution.current = 128;
    setContribution("verifying");
    pulse.value = withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 520 }));

    const flying = setTimeout(() => setContribution("flying"), 520);
    const accepted = setTimeout(() => {
      setScoreOverrides((current) => ({
        ...current,
        [selected.code]: scoreAfterContribution(selected.score, 128),
      }));
      setContribution("accepted");
      bounceSelection();
    }, 1180);
    const reset = setTimeout(() => setContribution("idle"), 3100);
    contributionTimers.current = [flying, accepted, reset];
  }

  async function shareBattle() {
    if (!selected) return;
    const copy = mainRival
      ? `${selected.name} ${formatCityHeatRank(selected.rank)} · ${mainRival.name}까지 ${formatCityHeatScore(Math.abs(mainRival.score - selected.score))} HEAT. 우리 동네 기록으로 따라잡기: https://groov.app/league/region/${selected.code}`
      : `${selected.name}의 GROOV CITY HEAT에 참여하세요.`;
    await Clipboard.setStringAsync(copy);
    Alert.alert("응원 링크 복사 완료", "우리 지역 경쟁 화면으로 바로 연결되는 문구를 복사했습니다.");
  }

  if (!mapAudit.valid || !selected) {
    return (
      <View style={styles.fallbackPage}>
        <Text style={styles.fallbackEyebrow}>CITY HEAT SAFE MODE</Text>
        <Text style={styles.fallbackTitle}>지도를 안전하게 불러오지 못했습니다.</Text>
        <Text style={styles.fallbackCopy}>
          서울 행정구역 {mapAudit.seoulCount}/25 · 중복 코드 {mapAudit.duplicateCodeCount}개
        </Text>
        <Pressable onPress={() => router.back()} style={styles.fallbackButton}>
          <Text style={styles.fallbackButtonText}>이전 화면</Text>
        </Pressable>
      </View>
    );
  }

  const mapHeight = screenWidth <= 360 ? 430 : 488;
  const topThree = ranked.slice(0, 3);
  const selectedProvinceData = rankedProvinces.find((item) => item.province === selectedProvince);
  const provinceRank = rankedProvinces.findIndex((item) => item.province === selectedProvince) + 1;

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}> 
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="이전 단계" onPress={goBackLevel} style={styles.headerButton}>
            <ArrowLeft color="#F7F3F0" size={22} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.wordmark}>GROOV</Text>
            <Text style={styles.headerTitle}>CITY HEAT</Text>
          </View>
          <View style={styles.labBadge}>
            <Text style={styles.labBadgeText}>LAB</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.eyebrow}>SEASON 01 · 6D 02:14:32</Text>
              <Text style={styles.statusTitle}>
                {level === "country"
                  ? "대한민국의 열기를 확인하세요"
                  : level === "seoul"
                    ? "서울, 지금 가장 뜨거운 구역"
                    : `${selected.name}, 경쟁의 중심`}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View
            onLayout={(event) => setSurface(event.nativeEvent.layout)}
            style={[styles.mapFrame, { height: mapHeight }]}
            {...panResponder.panHandlers}
          >
            <View pointerEvents="none" style={styles.mapAtmosphere} />
            <View style={styles.mapTopbar}>
              <View>
                <Text style={styles.mapMode}>{level === "country" ? "KOREA" : "SEOUL 25"}</Text>
                <Text style={styles.mapHint}>
                  {level === "country" ? "서울을 눌러 구 단위 진입" : "한 번 선택 · 두 번 확대"}
                </Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck color={ORANGE} size={13} />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            </View>

            <Svg
              accessibilityLabel="대한민국과 서울 25개 구를 탐색하는 GROOV CITY HEAT 지도"
              height="100%"
              viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
              width="100%"
            >
              {level === "country" ? (
                <G>
                  {provinceSummary.flatMap((province) =>
                    province.areas.map((area) => (
                      <Path
                        d={area.path}
                        fill={heatFill(province.heat, province.province === selectedProvince)}
                        key={area.code}
                        onPress={() => handleCountryPress(province.province)}
                        stroke={province.province === selectedProvince ? "#FFB6A4" : "#15110F"}
                        strokeLinejoin="round"
                        strokeWidth={province.province === selectedProvince ? 0.85 : 0.36}
                      />
                    )),
                  )}
                  {rankedProvinces.slice(0, 3).map((province, index) => (
                    <G key={`province-landmark-${province.province}`} pointerEvents="none">
                      <Landmark
                        center={province.center}
                        rank={index + 1}
                        scale={4.7}
                        tier={index === 0 ? "tower" : index === 1 ? "arena" : "beacon"}
                      />
                      <SvgText
                        fill="#FFFFFF"
                        fontSize="7"
                        fontWeight="800"
                        textAnchor="middle"
                        x={province.center[0]}
                        y={province.center[1] + 12}
                      >
                        {province.province}
                      </SvgText>
                    </G>
                  ))}
                  {provinceSummary
                    .filter((province) => province.province === "서울")
                    .map((province) => (
                      <G key="my-province" pointerEvents="none">
                        <Circle
                          cx={province.center[0]}
                          cy={province.center[1]}
                          fill="none"
                          r="9"
                          stroke="#FFFFFF"
                          strokeDasharray="2 2"
                          strokeWidth="1.1"
                        />
                        <SvgText
                          fill="#FFFFFF"
                          fontSize="5.2"
                          fontWeight="800"
                          textAnchor="middle"
                          x={province.center[0]}
                          y={province.center[1] - 11}
                        >
                          MY REGION
                        </SvgText>
                      </G>
                    ))}
                </G>
              ) : (
                <G>
                  {standings.map((area) => {
                    const isSelected = selected.code === area.code;
                    return (
                      <Path
                        accessibilityLabel={`${area.name}, ${formatCityHeatRank(area.rank)}, ${formatCityHeatScore(area.score)}포인트`}
                        d={area.path}
                        fill={heatFill(area.heat, false, Boolean(selected) && !isSelected)}
                        key={area.code}
                        onPress={() => handleAreaPress(area)}
                        stroke={isSelected ? "#FFB29E" : "rgba(255,220,208,.36)"}
                        strokeLinejoin="round"
                        strokeWidth={isSelected ? Math.max(0.1, viewport.width / 130) : Math.max(0.04, viewport.width / 420)}
                      />
                    );
                  })}
                  {topThree.map((area) => (
                    <G key={`landmark-${area.code}`} pointerEvents="none">
                      <Landmark
                        center={area.center}
                        rank={area.rank}
                        scale={Math.max(0.22, viewport.width / 44)}
                        tier={area.landmark}
                      />
                    </G>
                  ))}
                  {level === "seoul"
                    ? standings.map((area) => {
                        const highlighted = area.code === selected.code || area.rank <= 3 || area.code === CITY_HEAT_MY_REGION;
                        if (!highlighted) return null;
                        return (
                          <G key={`label-${area.code}`} pointerEvents="none">
                            <SvgText
                              fill="#FFFFFF"
                              fontSize={Math.max(0.28, viewport.width / 30)}
                              fontWeight="800"
                              textAnchor="middle"
                              x={area.center[0]}
                              y={area.center[1] + Math.max(0.55, viewport.width / 27)}
                            >
                              {area.name.replace("구", "")}
                            </SvgText>
                            <SvgText
                              fill={area.code === selected.code ? "#FFFFFF" : "rgba(255,255,255,.72)"}
                              fontSize={Math.max(0.19, viewport.width / 47)}
                              fontWeight="700"
                              textAnchor="middle"
                              x={area.center[0]}
                              y={area.center[1] + Math.max(0.9, viewport.width / 17.5)}
                            >
                              {formatCityHeatRank(area.rank)}
                            </SvgText>
                          </G>
                        );
                      })
                    : null}
                </G>
              )}
            </Svg>

            {level !== "country" ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, selectionStyle]}>
                <Svg
                  height="100%"
                  viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
                  width="100%"
                >
                  <Path
                    d={selected.path}
                    fill="rgba(0,0,0,.55)"
                    stroke="rgba(0,0,0,.3)"
                    strokeWidth={Math.max(0.12, viewport.width / 105)}
                    transform={`translate(0 ${Math.max(0.15, viewport.width / 72)})`}
                  />
                  <Path
                    d={selected.path}
                    fill={heatFill(selected.heat, true)}
                    stroke="#FFF2ED"
                    strokeLinejoin="round"
                    strokeWidth={Math.max(0.08, viewport.width / 155)}
                  />
                  <Circle
                    cx={selected.center[0]}
                    cy={selected.center[1]}
                    fill="none"
                    opacity=".82"
                    r={Math.max(0.45, viewport.width / 22)}
                    stroke={ORANGE}
                    strokeDasharray={`${Math.max(0.1, viewport.width / 80)} ${Math.max(0.08, viewport.width / 110)}`}
                    strokeWidth={Math.max(0.06, viewport.width / 240)}
                  />
                  <Landmark
                    center={selected.center}
                    rank={selected.rank}
                    scale={Math.max(0.24, viewport.width / 40)}
                    tier={selected.landmark}
                  />
                </Svg>
              </Animated.View>
            ) : null}

            <View style={styles.controls}>
              <MapControl
                icon={<Plus color="#FFFFFF" size={18} />}
                label="확대"
                onPress={() => setViewport((current) => zoomViewport(current, 0.76))}
              />
              <MapControl
                icon={<Minus color="#FFFFFF" size={18} />}
                label="축소"
                onPress={() => setViewport((current) => zoomViewport(current, 1.32))}
              />
              <MapControl
                icon={<LocateFixed color="#FFFFFF" size={17} />}
                label="내 지역"
                onPress={() => {
                  setSelectedCode(CITY_HEAT_MY_REGION);
                  enterSeoul();
                }}
              />
              <MapControl
                icon={<RotateCcw color="#FFFFFF" size={16} />}
                label="초기화"
                onPress={resetMap}
              />
            </View>

            {contribution !== "idle" ? (
              <View pointerEvents="none" style={styles.contributionToast}>
                <Sparkles color="#FFFFFF" size={17} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contributionTitle}>
                    {contribution === "verifying"
                      ? "기록 검증 중"
                      : contribution === "flying"
                        ? "도봉으로 에너지 전송"
                        : `+${lastContribution.current} HEAT 반영 완료`}
                  </Text>
                  <Text style={styles.contributionCopy}>
                    {contribution === "accepted" ? "서버 확정 점수로 교체되었습니다." : "검증된 운동 기록만 반영됩니다."}
                  </Text>
                </View>
              </View>
            ) : null}

            <View pointerEvents="none" style={styles.depthLegend}>
              <Flame color={ORANGE} fill={ORANGE} size={13} />
              <Text style={styles.depthLegendText}>
                {interaction === "idle" ? "QUIET → HEATED → CRITICAL" : interaction.toUpperCase()}
              </Text>
            </View>
          </View>

          {level === "country" ? (
            <View style={styles.countryCard}>
              <View style={styles.countryCardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.eyebrow}>NATIONAL HEAT</Text>
                  <Text numberOfLines={1} style={styles.regionTitle}>{selectedProvince}</Text>
                </View>
                <View style={styles.rankPill}>
                  <Text style={styles.rankPillText}>{formatCityHeatRank(provinceRank)}</Text>
                </View>
              </View>
              <View style={styles.bigScoreRow}>
                <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.bigScore}>
                  {formatCityHeatScore(selectedProvinceData?.score ?? 0)}
                </Text>
                <Text style={styles.scoreUnit}>HEAT</Text>
              </View>
              <Text style={styles.cardCopy}>
                {selectedProvince === "서울"
                  ? "서울을 누르면 실제 25개 구 경쟁 지도로 진입합니다."
                  : `${selectedProvince} 상세 구역은 전국 확장 단계에서 연결됩니다.`}
              </Text>
              {selectedProvince === "서울" ? (
                <Pressable onPress={enterSeoul} style={styles.primaryAction}>
                  <Text style={styles.primaryActionText}>서울 25개 구 보기</Text>
                  <ChevronRight color="#0A0908" size={18} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <RegionSheet
              contribution={contribution}
              mainRival={mainRival}
              onContribute={simulateContribution}
              onDetails={() => setShowDetails((current) => !current)}
              onShare={shareBattle}
              selected={selected}
              showDetails={showDetails}
            />
          )}

          {level !== "country" ? (
            <View style={styles.leaderboard}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.eyebrow}>TOP DISTRICTS</Text>
                  <Text style={styles.sectionTitle}>현재 서울 랭킹</Text>
                </View>
                <Trophy color={ORANGE} size={22} />
              </View>
              {ranked.slice(0, 5).map((area) => (
                <Pressable
                  key={area.code}
                  onPress={() => {
                    setSelectedCode(area.code);
                    bounceSelection();
                  }}
                  style={[styles.rankRow, area.code === selected.code && styles.rankRowActive]}
                >
                  <Text style={styles.rankNumber}>{area.rank}</Text>
                  <View style={styles.rankIcon}>
                    <MiniLandmark tier={area.landmark} />
                  </View>
                  <View style={styles.rankCopy}>
                    <Text numberOfLines={1} style={styles.rankName}>{area.name}</Text>
                    <Text numberOfLines={1} style={styles.rankMeta}>
                      {area.dominantSport} · 참여율 {area.participationRate.toFixed(1)}%
                    </Text>
                  </View>
                  <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.rankScore}>
                    {formatCityHeatScore(area.score)}pt
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.prototypeNote}>
            <View style={styles.noteIcon}>
              <ShieldCheck color={ORANGE} size={17} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.noteTitle}>독립 실험 화면</Text>
              <Text style={styles.noteCopy}>
                현재 리그에는 적용되지 않습니다. 실제 행정 경계 데이터와 샘플 점수를 분리해 검증 중입니다.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function RegionSheet({
  selected,
  mainRival,
  showDetails,
  contribution,
  onDetails,
  onContribute,
  onShare,
}: {
  selected: CityHeatStanding;
  mainRival: CityHeatStanding | undefined;
  showDetails: boolean;
  contribution: ContributionStage;
  onDetails: () => void;
  onContribute: () => void;
  onShare: () => void;
}) {
  const gap = mainRival ? Math.abs(mainRival.score - selected.score) : 0;
  return (
    <View style={stylesStatic.regionSheet}>
      <Pressable accessibilityLabel="지역 상세 펼치기" onPress={onDetails} style={stylesStatic.sheetHandleArea}>
        <View style={stylesStatic.sheetHandle} />
      </Pressable>
      <View style={stylesStatic.regionHeading}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={stylesStatic.eyebrow}>MY VERIFIED REGION</Text>
          <Text numberOfLines={1} style={stylesStatic.regionTitle}>{selected.name}</Text>
        </View>
        <View style={stylesStatic.rankPill}>
          <Text style={stylesStatic.rankPillText}>{formatCityHeatRank(selected.rank)}</Text>
        </View>
      </View>
      <View style={stylesStatic.bigScoreRow}>
        <ScoreTicker value={selected.score} />
        <Text style={stylesStatic.scoreUnit}>HEAT</Text>
      </View>
      <Text style={stylesStatic.battleCopy}>
        {mainRival
          ? `${mainRival.name}과 ${formatCityHeatScore(gap)}pt 차이 · 기록 ${Math.max(1, Math.ceil(gap / 128))}개면 흐름이 바뀝니다.`
          : "현재 가장 가까운 경쟁 지역을 계산하고 있습니다."}
      </Text>
      <View style={stylesStatic.progressTrack}>
        <View style={[stylesStatic.progressFill, { width: `${Math.max(16, Math.min(94, 100 - gap / 50))}%` }]} />
      </View>
      <View style={stylesStatic.actionRow}>
        <Pressable
          disabled={contribution !== "idle"}
          onPress={onContribute}
          style={[stylesStatic.primaryAction, contribution !== "idle" && stylesStatic.actionDisabled]}
        >
          <Flame color="#0A0908" fill="#0A0908" size={17} />
          <Text style={stylesStatic.primaryActionText}>
            {contribution === "idle" ? "내 기록 반영 체험" : "기록 반영 중"}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel="지역 경쟁 공유" onPress={onShare} style={stylesStatic.secondaryAction}>
          <Share2 color="#FFFFFF" size={18} />
        </Pressable>
      </View>
      {showDetails ? (
        <View style={stylesStatic.detailGrid}>
          <DetailStat icon={<Users color={ORANGE} size={15} />} label="리그 참여" value={`${formatCityHeatScore(selected.participantCount)}명`} />
          <DetailStat icon={<Flame color={ORANGE} size={15} />} label="참여율" value={`${selected.participationRate.toFixed(1)}%`} />
          <DetailStat icon={<ShieldCheck color={ORANGE} size={15} />} label="인증 기록" value={`${selected.verifiedActivityCount}개`} />
          <DetailStat icon={<Trophy color={ORANGE} size={15} />} label="강세 종목" value={selected.dominantSport} />
        </View>
      ) : null}
      <Pressable onPress={onDetails} style={stylesStatic.detailToggle}>
        <Text style={stylesStatic.detailToggleText}>{showDetails ? "현황 접기" : "지역 현황 자세히"}</Text>
        <ArrowDown color="#9C918A" size={16} style={showDetails ? { transform: [{ rotate: "180deg" }] } : undefined} />
      </Pressable>
    </View>
  );
}

function ScoreTicker({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) {
      setDisplay(value);
      return;
    }
    let step = 0;
    const steps = 14;
    const timer = setInterval(() => {
      step += 1;
      const progress = step / steps;
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3))));
      if (step >= steps) clearInterval(timer);
    }, 38);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={stylesStatic.bigScore}>
      {formatCityHeatScore(display)}
    </Text>
  );
}

function DetailStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={stylesStatic.detailStat}>
      <View style={stylesStatic.detailIcon}>{icon}</View>
      <Text style={stylesStatic.detailLabel}>{label}</Text>
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={stylesStatic.detailValue}>{value}</Text>
    </View>
  );
}

function MapControl({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={`지도 ${label}`} onPress={onPress} style={({ pressed }) => [stylesStatic.mapButton, pressed && stylesStatic.pressed]}>
      {icon}
    </Pressable>
  );
}

function MiniLandmark({ tier }: { tier: LandmarkTier }) {
  const icon = tier === "tower" ? "Ⅰ" : tier === "arena" ? "Ⅱ" : tier === "beacon" ? "Ⅲ" : "V";
  return <Text style={stylesStatic.miniLandmarkText}>{icon}</Text>;
}

function Landmark({
  center,
  tier,
  rank,
  scale,
}: {
  center: [number, number];
  tier: LandmarkTier;
  rank: number;
  scale: number;
}) {
  const [x, y] = center;
  const s = scale;
  if (tier === "tower") {
    return (
      <G>
        <Ellipse cx={x} cy={y + 1.2 * s} fill="rgba(0,0,0,.48)" rx={3 * s} ry={1.05 * s} />
        <Polygon fill="#171310" points={`${x - 2.2 * s},${y + 0.8 * s} ${x + 2.2 * s},${y + 0.8 * s} ${x + 1.45 * s},${y - 4.2 * s} ${x - 1.45 * s},${y - 4.2 * s}`} stroke="#FF8A6D" strokeWidth={0.24 * s} />
        <Polygon fill={ORANGE} points={`${x},${y - 6.2 * s} ${x + 1.4 * s},${y - 3.7 * s} ${x},${y - 2.8 * s} ${x - 1.4 * s},${y - 3.7 * s}`} />
        <Line stroke="#FFB09A" strokeWidth={0.3 * s} x1={x} x2={x} y1={y - 3.4 * s} y2={y + 0.4 * s} />
        <RankBadge rank={rank} x={x} y={y - 7.6 * s} scale={s} />
      </G>
    );
  }
  if (tier === "arena") {
    return (
      <G>
        <Circle cx={x} cy={y + 0.85 * s} fill="rgba(0,0,0,.45)" r={3.1 * s} />
        <Circle cx={x} cy={y - 1.2 * s} fill="#171310" r={2.9 * s} stroke="#FF896C" strokeWidth={0.34 * s} />
        <Circle cx={x} cy={y - 1.2 * s} fill="none" r={1.7 * s} stroke={ORANGE} strokeWidth={0.55 * s} />
        <Rect fill="#29211E" height={1.8 * s} rx={0.35 * s} width={1.1 * s} x={x - 0.55 * s} y={y - 2.1 * s} />
        <RankBadge rank={rank} x={x} y={y - 5.4 * s} scale={s} />
      </G>
    );
  }
  if (tier === "beacon") {
    return (
      <G>
        <Circle cx={x} cy={y + 0.8 * s} fill="rgba(0,0,0,.45)" r={2.5 * s} />
        <Polygon fill="#211A17" points={`${x - 1.4 * s},${y + 0.5 * s} ${x + 1.4 * s},${y + 0.5 * s} ${x + 0.55 * s},${y - 3.5 * s} ${x - 0.55 * s},${y - 3.5 * s}`} stroke="#FF8C70" strokeWidth={0.28 * s} />
        <Circle cx={x} cy={y - 4.1 * s} fill={ORANGE} r={0.9 * s} stroke="#FFD1C5" strokeWidth={0.22 * s} />
        <Circle cx={x} cy={y - 4.1 * s} fill="none" opacity=".38" r={2.2 * s} stroke={ORANGE} strokeWidth={0.2 * s} />
        <RankBadge rank={rank} x={x} y={y - 7.2 * s} scale={s} />
      </G>
    );
  }
  return (
    <G>
      <Circle cx={x} cy={y} fill="#171310" r={1.9 * s} stroke={ORANGE} strokeWidth={0.28 * s} />
      <SvgText fill={ORANGE} fontSize={2 * s} fontWeight="900" textAnchor="middle" x={x} y={y + 0.7 * s}>V</SvgText>
    </G>
  );
}

function RankBadge({ rank, x, y, scale }: { rank: number; x: number; y: number; scale: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} fill="#080706" r={1.35 * scale} stroke={ORANGE} strokeWidth={0.25 * scale} />
      <SvgText fill="#FFFFFF" fontSize={1.15 * scale} fontWeight="900" textAnchor="middle" x={x} y={y + 0.4 * scale}>
        {rank}
      </SvgText>
    </G>
  );
}

const stylesStatic = StyleSheet.create({
  eyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 10, letterSpacing: 1.25 },
  regionSheet: { backgroundColor: "#171311", borderColor: "#3A2B26", borderRadius: 24, borderWidth: 1, padding: 18, gap: 11 },
  sheetHandleArea: { alignItems: "center", marginBottom: -3, paddingBottom: 5 },
  sheetHandle: { backgroundColor: "#5A4D47", borderRadius: 3, height: 4, width: 42 },
  regionHeading: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  regionTitle: { color: "#FFF9F6", fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1, lineHeight: 36, marginTop: 3 },
  rankPill: { alignItems: "center", backgroundColor: "#251B18", borderColor: "#6F392B", borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 42, minWidth: 58, paddingHorizontal: 10 },
  rankPillText: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 18 },
  bigScoreRow: { alignItems: "baseline", flexDirection: "row", gap: 7, minWidth: 0 },
  bigScore: { color: "#FFF8F5", flexShrink: 1, fontFamily: fonts.displayExtra, fontSize: 48, letterSpacing: -2.4, lineHeight: 55, minWidth: 0 },
  scoreUnit: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 11, letterSpacing: 1 },
  battleCopy: { color: "#C6BAB4", fontFamily: fonts.medium, fontSize: 13, lineHeight: 21 },
  progressTrack: { backgroundColor: "#2A211E", borderRadius: 6, height: 7, overflow: "hidden" },
  progressFill: { backgroundColor: ORANGE, borderRadius: 6, height: "100%" },
  actionRow: { flexDirection: "row", gap: 9 },
  primaryAction: { alignItems: "center", backgroundColor: ORANGE, borderRadius: 15, flex: 1, flexDirection: "row", gap: 7, justifyContent: "center", minHeight: 52, paddingHorizontal: 14 },
  primaryActionText: { color: "#0A0908", fontFamily: fonts.bold, fontSize: 14 },
  secondaryAction: { alignItems: "center", backgroundColor: "#26201D", borderColor: "#443630", borderRadius: 15, borderWidth: 1, justifyContent: "center", minHeight: 52, width: 54 },
  actionDisabled: { opacity: 0.55 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 3 },
  detailStat: { backgroundColor: "#201A17", borderRadius: 14, flexBasis: "47%", flexGrow: 1, minWidth: 0, padding: 12 },
  detailIcon: { marginBottom: 8 },
  detailLabel: { color: "#91847D", fontFamily: fonts.medium, fontSize: 11 },
  detailValue: { color: "#FFF8F5", fontFamily: fonts.bold, fontSize: 17, marginTop: 2, minWidth: 0 },
  detailToggle: { alignItems: "center", flexDirection: "row", justifyContent: "center", minHeight: 40 },
  detailToggleText: { color: "#9C918A", fontFamily: fonts.semibold, fontSize: 12, marginRight: 5 },
  mapButton: { alignItems: "center", backgroundColor: "rgba(14,12,11,.84)", borderColor: "rgba(255,255,255,.15)", borderRadius: 21, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  miniLandmarkText: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 13 },
});

function createStyles() {
  return StyleSheet.create({
    page: { flex: 1 },
    shell: { alignSelf: "center", backgroundColor: "#0D0B0A", flex: 1, maxWidth: 520, width: "100%" },
    header: { alignItems: "center", borderBottomColor: "#27211E", borderBottomWidth: 1, flexDirection: "row", minHeight: 66, paddingHorizontal: 14 },
    headerButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
    headerCopy: { alignItems: "baseline", flex: 1, flexDirection: "row", gap: 7, justifyContent: "center" },
    wordmark: { color: ORANGE, fontFamily: fonts.displayItalic, fontSize: 21, fontStyle: "italic", letterSpacing: -0.8 },
    headerTitle: { color: "#E8DFDB", fontFamily: fonts.displayExtra, fontSize: 12, letterSpacing: 1.8 },
    labBadge: { alignItems: "center", backgroundColor: "#2D1A15", borderColor: "#663020", borderRadius: 10, borderWidth: 1, height: 30, justifyContent: "center", width: 44 },
    labBadgeText: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 10, letterSpacing: 1 },
    content: { gap: 14, paddingBottom: 44, paddingHorizontal: 14, paddingTop: 16 },
    statusRow: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
    eyebrow: stylesStatic.eyebrow,
    statusTitle: { color: "#FFF8F5", fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.7, lineHeight: 29, marginTop: 4 },
    liveBadge: { alignItems: "center", backgroundColor: "#1F1714", borderRadius: 10, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
    liveDot: { backgroundColor: ORANGE, borderRadius: 4, height: 7, width: 7 },
    liveText: { color: "#F5EDEA", fontFamily: fonts.displayExtra, fontSize: 9, letterSpacing: 1 },
    mapFrame: { backgroundColor: MAP_INK, borderColor: "#372721", borderRadius: 26, borderWidth: 1, overflow: "hidden", position: "relative" },
    mapAtmosphere: { backgroundColor: "rgba(255,88,50,.035)", borderColor: "rgba(255,88,50,.12)", borderRadius: 260, borderWidth: 48, height: 520, left: -190, position: "absolute", top: -250, width: 520 },
    mapTopbar: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", left: 15, position: "absolute", right: 15, top: 14, zIndex: 8 },
    mapMode: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 13, letterSpacing: 1.4 },
    mapHint: { color: "#9E918A", fontFamily: fonts.medium, fontSize: 10, marginTop: 2 },
    verifiedBadge: { alignItems: "center", backgroundColor: "rgba(13,11,10,.82)", borderColor: "rgba(255,88,50,.25)", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingVertical: 6 },
    verifiedText: { color: "#D3C8C3", fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 0.7 },
    controls: { gap: 7, position: "absolute", right: 12, top: 58, zIndex: 9 },
    contributionToast: { alignItems: "center", backgroundColor: "rgba(255,88,50,.94)", borderRadius: 16, flexDirection: "row", gap: 10, left: 15, paddingHorizontal: 13, paddingVertical: 11, position: "absolute", right: 64, top: 66, zIndex: 12 },
    contributionTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
    contributionCopy: { color: "rgba(255,255,255,.78)", fontFamily: fonts.medium, fontSize: 9, marginTop: 1 },
    depthLegend: { alignItems: "center", backgroundColor: "rgba(13,11,10,.82)", borderColor: "rgba(255,255,255,.11)", borderRadius: 13, borderWidth: 1, bottom: 13, flexDirection: "row", gap: 6, left: 13, paddingHorizontal: 9, paddingVertical: 7, position: "absolute" },
    depthLegendText: { color: "#B9ADA7", fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 0.7 },
    countryCard: { backgroundColor: "#171311", borderColor: "#3A2B26", borderRadius: 24, borderWidth: 1, gap: 10, padding: 18 },
    countryCardTop: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
    regionTitle: stylesStatic.regionTitle,
    rankPill: stylesStatic.rankPill,
    rankPillText: stylesStatic.rankPillText,
    bigScoreRow: stylesStatic.bigScoreRow,
    bigScore: stylesStatic.bigScore,
    scoreUnit: stylesStatic.scoreUnit,
    cardCopy: { color: "#A99D97", fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
    primaryAction: stylesStatic.primaryAction,
    primaryActionText: stylesStatic.primaryActionText,
    leaderboard: { backgroundColor: "#13100E", borderColor: "#30241F", borderRadius: 22, borderWidth: 1, overflow: "hidden", padding: 16 },
    sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
    sectionTitle: { color: "#FFF8F5", fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
    rankRow: { alignItems: "center", borderTopColor: "#29211E", borderTopWidth: 1, flexDirection: "row", gap: 10, minHeight: 66, paddingHorizontal: 7 },
    rankRowActive: { backgroundColor: "rgba(255,88,50,.09)", borderRadius: 12 },
    rankNumber: { color: "#887A74", fontFamily: fonts.displayExtra, fontSize: 17, textAlign: "center", width: 24 },
    rankIcon: { alignItems: "center", backgroundColor: "#251B18", borderColor: "#5B3025", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
    rankCopy: { flex: 1, minWidth: 0 },
    rankName: { color: "#FFF8F5", fontFamily: fonts.bold, fontSize: 14 },
    rankMeta: { color: "#8F837D", fontFamily: fonts.regular, fontSize: 10, marginTop: 3 },
    rankScore: { color: ORANGE, flexShrink: 1, fontFamily: fonts.displayExtra, fontSize: 15, maxWidth: 105, minWidth: 64, textAlign: "right" },
    prototypeNote: { alignItems: "flex-start", backgroundColor: "#171311", borderColor: "#30251F", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 11, padding: 14 },
    noteIcon: { alignItems: "center", backgroundColor: "#291914", borderRadius: 16, height: 32, justifyContent: "center", width: 32 },
    noteTitle: { color: "#EDE5E1", fontFamily: fonts.bold, fontSize: 13 },
    noteCopy: { color: "#8F837D", fontFamily: fonts.regular, fontSize: 11, lineHeight: 18, marginTop: 2 },
    fallbackPage: { alignItems: "center", backgroundColor: "#0D0B0A", flex: 1, justifyContent: "center", padding: 28 },
    fallbackEyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 10, letterSpacing: 1.2 },
    fallbackTitle: { color: "#FFF8F5", fontFamily: fonts.bold, fontSize: 22, marginTop: 10, textAlign: "center" },
    fallbackCopy: { color: "#A99D97", fontFamily: fonts.regular, fontSize: 13, marginTop: 8, textAlign: "center" },
    fallbackButton: { backgroundColor: ORANGE, borderRadius: 14, marginTop: 20, minWidth: 140, paddingHorizontal: 18, paddingVertical: 14 },
    fallbackButtonText: { color: "#0A0908", fontFamily: fonts.bold, fontSize: 14, textAlign: "center" },
  });
}
