import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Flame,
  LocateFixed,
  Minus,
  Plus,
  ShieldCheck,
  Trophy,
} from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { Screen } from "../src/components/ui";
import { koreaMunicipalities, type KoreaMunicipality } from "../src/assets/korea-municipal-paths";
import {
  NATIONAL_VIEW,
  SEOUL_VIEW,
  focusViewport,
  panViewport,
  zoomLevel,
  zoomViewport,
  type LeagueViewport,
} from "../src/components/league-map-model";
import { fonts, radius, type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const sports = ["전체", "러닝", "근력", "사이클", "등산", "수영"] as const;
const periods = ["이번 주", "이번 달", "시즌"] as const;
const rankerNames = ["하늘", "준", "지영", "태오", "서아", "민지", "도윤", "유나"];
const seoulAreas = koreaMunicipalities.filter((area) => area.province === "서울");
const neighborhoodNames: Record<string, string[]> = {
  "11100": ["창동", "방학동", "쌍문동", "도봉동"],
  "11230": ["역삼동", "대치동", "압구정동", "세곡동"],
  "11140": ["합정동", "연남동", "망원동", "상암동"],
};

function detail(area: KoreaMunicipality, sport = "전체", period = "이번 주") {
  const seed =
    Number(area.code) +
    sports.indexOf(sport as (typeof sports)[number]) * 17 +
    periods.indexOf(period as (typeof periods)[number]) * 31;
  const members = 850 + ((seed * 7) % 6200);
  const active = Math.round(members * (0.28 + (area.heat % 20) / 100));
  const participants = Math.round(active * (0.42 + (area.heat % 27) / 100));
  const score = 42000 + area.heat * 470 + (seed % 1700);
  const heatLevel =
    area.heat >= 76 ? "과열" : area.heat >= 60 ? "버닝" : area.heat >= 42 ? "활성" : "기본";
  return { ...area, members, active, participants, score, heatLevel, change: (seed % 9) - 3 };
}

export default function LeagueRegionScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedCode, setSelectedCode] = useState("11100");
  const [viewport, setViewport] = useState<LeagueViewport>(SEOUL_VIEW);
  const [surface, setSurface] = useState({ width: 1, height: 1 });
  const [sport, setSport] = useState<(typeof sports)[number]>("전체");
  const [period, setPeriod] = useState<(typeof periods)[number]>("이번 주");
  const dragOrigin = useRef(viewport);
  const selectedArea =
    koreaMunicipalities.find((item) => item.code === selectedCode) ?? seoulAreas[0]!;
  const ranked = useMemo(
    () => seoulAreas.map((item) => detail(item, sport, period)).sort((a, b) => b.score - a.score),
    [sport, period],
  );
  const area = detail(selectedArea, sport, period);
  const rank = ranked.findIndex((item) => item.code === area.code) + 1;
  const rivals = ranked
    .filter((item) => item.code !== area.code)
    .sort((a, b) => Math.abs(a.score - area.score) - Math.abs(b.score - area.score))
    .slice(0, 2);
  const neighborhoods = neighborhoodNames[area.code] ?? [
    `${area.name.replace("구", "")}1동`,
    `${area.name.replace("구", "")}2동`,
    `${area.name.replace("구", "")}3동`,
  ];
  const level = zoomLevel(viewport);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
        onPanResponderGrant: () => {
          dragOrigin.current = viewport;
        },
        onPanResponderMove: (_event, gesture) =>
          setViewport(
            panViewport(dragOrigin.current, gesture.dx, gesture.dy, surface.width, surface.height),
          ),
      }),
    [surface.height, surface.width, viewport],
  );

  function selectArea(item: KoreaMunicipality) {
    setSelectedCode(item.code);
    if (item.province === "서울") setViewport(focusViewport(item.center));
  }

  return (
    <Screen title="">
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="리그로 돌아가기"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <ChevronLeft color={colors.ink} size={25} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MUNICIPAL LEAGUE / SAMPLE</Text>
          <Text style={styles.title}>지역 리그</Text>
        </View>
        <Pressable onPress={() => selectArea(seoulAreas.find((item) => item.code === "11100")!)}>
          <Text style={styles.myRegion}>내 지역</Text>
        </Pressable>
      </View>
      <View style={styles.intro}>
        <View>
          <Text style={styles.introTitle}>움직임이 도시를 달군다</Text>
          <Text style={styles.introCopy}>실제 인접 관계를 유지한 단순화 경계 · 점수는 샘플</Text>
        </View>
        <Flame color={colors.primary} fill={colors.primary} size={25} />
      </View>

      <View
        onLayout={(event) => setSurface(event.nativeEvent.layout)}
        style={styles.map}
        {...panResponder.panHandlers}
      >
        <Svg
          accessibilityLabel="서울 25개 구와 전국 시군구를 탐색하는 지역 리그 지도"
          height="100%"
          viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
          width="100%"
        >
          <G>
            {koreaMunicipalities.map((item) => {
              const selected = selectedCode === item.code;
              const region = detail(item, sport, period);
              return (
                <Path
                  accessibilityLabel={`${item.province} ${item.name}, ${region.heatLevel}, ${region.score.toLocaleString("ko-KR")}점`}
                  d={item.path}
                  fill={heatColor(item.heat, selected)}
                  key={item.code}
                  onPress={() => selectArea(item)}
                  stroke={selected ? "#FFFFFF" : "rgba(255,224,210,.72)"}
                  strokeLinejoin="round"
                  strokeWidth={
                    selected
                      ? Math.max(0.12, viewport.width / 170)
                      : Math.max(0.035, viewport.width / 650)
                  }
                />
              );
            })}
          </G>
          {viewport.width <= SEOUL_VIEW.width * 1.15
            ? seoulAreas.map((item) => {
                const selected = selectedCode === item.code;
                const region = detail(item, sport, period);
                const regionRank = ranked.findIndex((candidate) => candidate.code === item.code) + 1;
                const nameSize = Math.max(0.5, viewport.width / 29) * (selected ? 1.12 : 1);
                const metaSize = Math.max(0.28, viewport.width / 52);
                return (
                  <G key={`label-${item.code}`} onPress={() => selectArea(item)}>
                    <SvgText
                      fill={selected ? "#FFFFFF" : "rgba(255,255,255,.88)"}
                      fontSize={nameSize}
                      fontWeight="800"
                      textAnchor="middle"
                      x={item.center[0]}
                      y={item.center[1] - 0.34}
                    >
                      {item.name.replace("구", "")}
                    </SvgText>
                    <SvgText
                      fill={selected ? "#FFFFFF" : "rgba(255,255,255,.72)"}
                      fontSize={metaSize}
                      fontWeight="700"
                      textAnchor="middle"
                      x={item.center[0]}
                      y={item.center[1] + 0.16}
                    >
                      #{regionRank}
                    </SvgText>
                    <SvgText
                      fill={selected ? "#FFFFFF" : "rgba(255,255,255,.64)"}
                      fontSize={metaSize}
                      fontWeight="600"
                      textAnchor="middle"
                      x={item.center[0]}
                      y={item.center[1] + 0.6}
                    >
                      {region.score.toLocaleString("ko-KR")}pt
                    </SvgText>
                  </G>
                );
              })
            : null}
          {level > 2
            ? neighborhoods.map((name, index) => {
                const angle = (Math.PI * 2 * index) / neighborhoods.length;
                const x = area.center[0] + Math.cos(angle) * 1.35;
                const y = area.center[1] + Math.sin(angle) * 0.85;
                return (
                  <G key={name}>
                    <Circle
                      cx={x}
                      cy={y}
                      fill={index === 0 ? colors.primary : "rgba(255,255,255,.16)"}
                      r={0.2 + index * 0.025}
                      stroke="#FFFFFF"
                      strokeWidth={0.04}
                    />
                    <SvgText
                      fill="#FFFFFF"
                      fontSize={0.34}
                      fontWeight="700"
                      textAnchor="middle"
                      x={x}
                      y={y - 0.32}
                    >
                      {name}
                    </SvgText>
                    <SvgText
                      fill="rgba(255,255,255,.7)"
                      fontSize={0.27}
                      textAnchor="middle"
                      x={x}
                      y={y + 0.5}
                    >
                      #{index + 1} · {(area.score - index * 690).toLocaleString("ko-KR")}
                    </SvgText>
                  </G>
                );
              })
            : null}
        </Svg>
        <View style={styles.mapControls}>
          <Pressable
            accessibilityLabel="지도 확대"
            onPress={() => setViewport((current) => zoomViewport(current, 0.72))}
            style={styles.mapButton}
          >
            <Plus color="#FFFFFF" size={17} />
          </Pressable>
          <Pressable
            accessibilityLabel="지도 축소"
            onPress={() => setViewport((current) => zoomViewport(current, 1.38))}
            style={styles.mapButton}
          >
            <Minus color="#FFFFFF" size={17} />
          </Pressable>
          <Pressable
            accessibilityLabel="서울 전체 보기"
            onPress={() => setViewport(SEOUL_VIEW)}
            style={styles.mapButton}
          >
            <LocateFixed color="#FFFFFF" size={16} />
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.mapStatus}>
          <Text style={styles.mapStatusTitle}>
            {level > 2 ? "동네 핫스폿" : viewport.width > 80 ? "전국" : "서울 25개 구"}
          </Text>
          <Text style={styles.mapStatusCopy}>드래그 · 확대 · 지역 선택</Text>
        </View>
      </View>
      <View style={styles.mapQuick}>
        <Pressable onPress={() => setViewport(NATIONAL_VIEW)}>
          <Text style={styles.quickText}>전국</Text>
        </Pressable>
        <Pressable onPress={() => setViewport(SEOUL_VIEW)}>
          <Text style={styles.quickText}>서울 전체</Text>
        </Pressable>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>기본 → 활성 → 버닝 → 과열</Text>
      </View>

      <FilterRow values={periods} selected={period} onSelect={setPeriod} styles={styles} />
      <FilterRow values={sports} selected={sport} onSelect={setSport} styles={styles} />
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.eyebrow}>
              {area.province} · {area.heatLevel} {area.heat}° · {period}
            </Text>
            <Text style={styles.districtName}>{area.name}</Text>
            <Text style={styles.change}>
              {area.change >= 0 ? `▲ ${area.change}` : `▼ ${Math.abs(area.change)}`} 지난 기간 대비
            </Text>
          </View>
          <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.place}>#{rank}</Text>
        </View>
        <View style={styles.stats}>
          <Stat label="지역 인원" value={area.members.toLocaleString("ko-KR")} styles={styles} />
          <Stat
            label="리그 참여"
            value={area.participants.toLocaleString("ko-KR")}
            styles={styles}
          />
          <Stat
            label="참여율"
            value={`${((area.participants / area.active) * 100).toFixed(1)}%`}
            styles={styles}
          />
          <Stat label="지역 점수" value={area.score.toLocaleString("ko-KR")} styles={styles} />
        </View>
        <View style={styles.trend}>
          <Text style={styles.panelSubTitle}>최근 활동량</Text>
          <View style={styles.trendBars}>
            {[42, 55, 48, 68, 62, 78, area.heat].map((value, index) => (
              <View
                key={index}
                style={[
                  styles.trendBar,
                  { height: 8 + value * 0.34 },
                  index === 6 && styles.trendBarActive,
                ]}
              />
            ))}
          </View>
        </View>
        <View style={styles.leader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {rankerNames[Number(area.code) % rankerNames.length]!.slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>THIS REGION RANKER</Text>
            <Text style={styles.leaderName}>
              {rankerNames[Number(area.code) % rankerNames.length]}
            </Text>
            <Text style={styles.leaderTitle}>
              {sport} 기여 1위 · {Math.round(area.score * 0.078).toLocaleString("ko-KR")}pt
            </Text>
          </View>
          <Trophy color={colors.primary} size={24} />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{area.name} 지역 내 순위</Text>
        {rankerNames.slice(0, 5).map((name, index) => (
          <View key={name} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{index + 1}</Text>
            <View style={styles.rankCopy}>
              <Text numberOfLines={1} style={styles.rankName}>{name}</Text>
              <Text numberOfLines={1} style={styles.rankMeta}>
                {sport} · 활동 {9 - index}회 · {index < 2 ? "▲ 상승" : "— 유지"}
              </Text>
            </View>
            <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.rankScore}>{(area.score * 0.09 - index * 287).toFixed(0)}pt</Text>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>인접 경쟁 지역</Text>
        {rivals.map((item) => (
          <Pressable key={item.code} onPress={() => selectArea(item)} style={styles.rivalRow}>
            <View style={styles.rivalCopy}>
              <Text numberOfLines={1} style={styles.rankName}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.rankMeta}>
                {item.heatLevel} · 우리 지역과{" "}
                {Math.abs(item.score - area.score).toLocaleString("ko-KR")}점 차이
              </Text>
            </View>
            <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={styles.rankScore}>{item.score.toLocaleString("ko-KR")}pt</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.notice}>
        <ShieldCheck color={colors.primary} size={19} />
        <Text style={styles.noticeText}>
          경계는 통계청 시군구 자료를 인접 관계가 깨지지 않도록 단순화했습니다. 동네
          핫스폿·순위·점수는 실제 GROOV 기록 연동 전 샘플이며 정확한 사용자 위치나 운동 경로는
          표시하지 않습니다.
        </Text>
      </View>
    </Screen>
  );
}

function heatColor(heat: number, selected: boolean) {
  if (selected) return "#FF5A32";
  if (heat >= 76) return "rgba(255,72,35,.92)";
  if (heat >= 60) return "rgba(255,90,50,.68)";
  if (heat >= 42) return "rgba(255,120,77,.42)";
  return "rgba(255,210,190,.16)";
}
function FilterRow<T extends string>({
  values,
  selected,
  onSelect,
  styles,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
    >
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.filter, selected === value && styles.filterActive]}
        >
          <Text style={[styles.filterText, selected === value && styles.filterTextActive]}>
            {value}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", marginHorizontal: -5 },
    iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.1,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 26, letterSpacing: -1 },
    myRegion: {
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 10,
      textDecorationLine: "underline",
    },
    intro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    introTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    introCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 3 },
    map: {
      height: 470,
      borderRadius: radius["2xl"],
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#15110F",
      position: "relative",
    },
    mapControls: { position: "absolute", right: 10, top: 10, gap: 6 },
    mapButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(20,17,15,.82)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    mapStatus: {
      position: "absolute",
      left: 12,
      bottom: 12,
      backgroundColor: "rgba(20,17,15,.82)",
      borderRadius: radius.md,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    mapStatusTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    mapStatusCopy: {
      color: "rgba(255,255,255,.55)",
      fontFamily: fonts.regular,
      fontSize: 8,
      marginTop: 2,
    },
    mapQuick: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 9 },
    quickText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    legendText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8 },
    filters: { gap: 6 },
    filter: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    filterActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    filterText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
    filterTextActive: { color: colors.primary, fontFamily: fonts.bold },
    panel: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
    },
    panelHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    panelHeaderCopy: { flex: 1, minWidth: 0 },
    districtName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 25, marginTop: 2 },
    change: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8, marginTop: 3 },
    place: { maxWidth: 104, flexShrink: 1, color: colors.primary, fontFamily: fonts.displayExtra, fontSize: 35, textAlign: "right" },
    stats: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 13,
      marginTop: 10,
    },
    stat: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
    statValue: { maxWidth: "100%", color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 14 },
    statLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    panelSubTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    trend: { paddingTop: 13, gap: 8 },
    trendBars: { height: 42, flexDirection: "row", alignItems: "flex-end", gap: 5 },
    trendBar: { flex: 1, borderRadius: 3, backgroundColor: colors.primarySoft },
    trendBarActive: { backgroundColor: colors.primary },
    leader: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 14 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
    leaderName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, marginTop: 2 },
    leaderTitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 2 },
    section: { gap: 2 },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14, marginBottom: 5 },
    rankRow: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rankNumber: { color: colors.primary, fontFamily: fonts.displayExtra, fontSize: 17, width: 38, flexShrink: 0, textAlign: "center" },
    rankCopy: { flex: 1, minWidth: 0 },
    rankName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11 },
    rankMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    rankScore: { maxWidth: 104, flexShrink: 1, color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 13, textAlign: "right" },
    rivalRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rivalCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
    notice: {
      flexDirection: "row",
      gap: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 14,
    },
    noticeText: {
      flex: 1,
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 8,
      lineHeight: 15,
    },
  });
}
