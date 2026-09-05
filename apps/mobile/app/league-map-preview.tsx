import { useRouter } from "expo-router";
import { Check, ChevronLeft, Maximize2, RotateCcw } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { koreaMunicipalities, type KoreaMunicipality } from "../src/assets/korea-municipal-paths";
import { SEOUL_VIEW, focusViewport, type LeagueViewport } from "../src/components/league-map-model";
import { fonts } from "../src/theme";

const ORANGE = "#FF4B28";
const BLACK = "#0B0A09";
const PANEL = "#171411";
const LINE = "#3A302B";
const seoulAreas = koreaMunicipalities.filter((area) => area.province === "서울");

const OPTIONS = [
  { id: 1, code: "FOCUS", name: "선택 집중형", note: "지도에는 선택한 구만 표시" },
  { id: 2, code: "INDEX", name: "숫자 핀형", note: "이름 대신 순위 핀만 표시" },
  { id: 3, code: "SPLIT", name: "지도·랭킹 분리형", note: "지도와 상위 랭킹을 분리" },
  { id: 4, code: "TOP 5", name: "상위권 콜아웃형", note: "TOP 5만 지도에 노출" },
  { id: 5, code: "LENS", name: "확대 탐색형", note: "선택 지역과 인접권만 노출" },
] as const;

function score(area: KoreaMunicipality) {
  return 42000 + area.heat * 470 + (Number(area.code) % 1700);
}

function heatColor(area: KoreaMunicipality, selected: boolean) {
  if (selected) return "#FF6848";
  if (area.heat >= 76) return "#F14625";
  if (area.heat >= 60) return "#B94329";
  if (area.heat >= 42) return "#73382A";
  return "#302A26";
}

export default function LeagueMapPreview() {
  const router = useRouter();
  const [option, setOption] = useState(1);
  const [chosen, setChosen] = useState<number | null>(null);
  const [selectedCode, setSelectedCode] = useState("11100");
  const [viewport, setViewport] = useState<LeagueViewport>(SEOUL_VIEW);
  const lastTap = useRef({ code: "", at: 0 });
  const ranked = useMemo(
    () => [...seoulAreas].sort((a, b) => score(b) - score(a)),
    [],
  );
  const selected = seoulAreas.find((area) => area.code === selectedCode) ?? seoulAreas[0]!;
  const rank = ranked.findIndex((area) => area.code === selected.code) + 1;
  const focused = viewport.width < SEOUL_VIEW.width;

  function handleAreaPress(area: KoreaMunicipality) {
    const now = Date.now();
    const doubleTap = lastTap.current.code === area.code && now - lastTap.current.at < 360;
    setSelectedCode(area.code);
    lastTap.current = { code: area.code, at: now };
    if (doubleTap) {
      setViewport(focused ? SEOUL_VIEW : focusViewport(area.center, 7.4));
      lastTap.current = { code: "", at: 0 };
    }
  }

  function changeOption(id: number) {
    setOption(id);
    setViewport(SEOUL_VIEW);
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로가기" onPress={() => router.back()} style={styles.iconButton}>
          <ChevronLeft color="#FFFFFF" size={24} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>REGION MAP / READABILITY TEST</Text>
          <Text style={styles.title}>지역 리그 지도 5안</Text>
        </View>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.guide}>한 번 눌러 지역 선택 · 같은 지역을 두 번 눌러 확대</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRail}>
          {OPTIONS.map((item) => (
            <Pressable
              accessibilityLabel={`${item.id}번 ${item.name}`}
              key={item.id}
              onPress={() => changeOption(item.id)}
              style={[styles.optionButton, option === item.id && styles.optionButtonOn]}
            >
              <Text style={[styles.optionNumber, option === item.id && styles.optionTextOn]}>0{item.id}</Text>
              <Text style={[styles.optionCode, option === item.id && styles.optionTextOn]}>{item.code}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.optionIntro}>
          <Text style={styles.optionTitle}>{OPTIONS[option - 1]!.name}</Text>
          <Text style={styles.optionNote}>{OPTIONS[option - 1]!.note}</Text>
        </View>

        {option === 3 ? <TopRail ranked={ranked} selectedCode={selectedCode} onSelect={handleAreaPress} /> : null}

        <View style={[styles.mapFrame, option === 3 && styles.mapFrameSplit]}>
          <Svg
            accessibilityLabel={`${OPTIONS[option - 1]!.name} 서울 지도`}
            height="100%"
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            width="100%"
          >
            <G>
              {seoulAreas.map((area) => {
                const isSelected = area.code === selectedCode;
                return (
                  <Path
                    accessibilityLabel={`${area.name}, ${ranked.findIndex((item) => item.code === area.code) + 1}위`}
                    d={area.path}
                    fill={heatColor(area, isSelected)}
                    key={area.code}
                    onPress={() => handleAreaPress(area)}
                    stroke={isSelected ? "#FFFFFF" : "rgba(255,222,210,.66)"}
                    strokeWidth={isSelected ? viewport.width / 100 : viewport.width / 440}
                  />
                );
              })}
            </G>
            <MapLabels option={option} ranked={ranked} selected={selected} viewport={viewport} />
          </Svg>

          {option === 1 ? <FocusCard selected={selected} rank={rank} /> : null}
          {option === 2 ? <IndexCard selected={selected} rank={rank} /> : null}
          {option === 3 ? <SplitBar selected={selected} rank={rank} /> : null}
          {option === 4 ? <TopFiveLegend ranked={ranked} selected={selected} /> : null}
          {option === 5 ? <LensCard selected={selected} rank={rank} focused={focused} /> : null}

          <Pressable
            accessibilityLabel={focused ? "서울 전체 보기" : "선택 지역 확대"}
            onPress={() => setViewport(focused ? SEOUL_VIEW : focusViewport(selected.center, 7.4))}
            style={styles.zoomButton}
          >
            {focused ? <RotateCcw color="#FFFFFF" size={17} /> : <Maximize2 color="#FFFFFF" size={17} />}
          </Pressable>
        </View>

        <View style={styles.readabilityRow}>
          <View style={styles.readabilityItem}><Text style={styles.readabilityValue}>1</Text><Text style={styles.readabilityLabel}>선택지역</Text></View>
          <View style={styles.readabilityDivider} />
          <View style={styles.readabilityItem}><Text style={styles.readabilityValue}>{option === 2 ? "25" : option === 4 ? "5" : option === 5 ? "3" : "0"}</Text><Text style={styles.readabilityLabel}>지도 표식</Text></View>
          <View style={styles.readabilityDivider} />
          <View style={styles.readabilityItem}><Text style={styles.readabilityValue}>2×</Text><Text style={styles.readabilityLabel}>확대 동작</Text></View>
        </View>

        <Pressable onPress={() => setChosen(option)} style={[styles.selectButton, chosen === option && styles.selectButtonOn]}>
          {chosen === option ? <Check color={BLACK} size={20} strokeWidth={3} /> : null}
          <Text style={[styles.selectButtonText, chosen === option && styles.selectButtonTextOn]}>
            {chosen === option ? `${option}번 시안 선택됨` : `${option}번 시안 선택`}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MapLabels({ option, ranked, selected, viewport }: { option: number; ranked: KoreaMunicipality[]; selected: KoreaMunicipality; viewport: LeagueViewport }) {
  const topFive = ranked.slice(0, 5);
  const nearest = [...seoulAreas]
    .filter((area) => area.code !== selected.code)
    .sort((a, b) => Math.hypot(a.center[0] - selected.center[0], a.center[1] - selected.center[1]) - Math.hypot(b.center[0] - selected.center[0], b.center[1] - selected.center[1]))
    .slice(0, 2);
  if (option === 1 || option === 3) return null;
  if (option === 2) {
    return <G pointerEvents="none">{seoulAreas.map((area) => {
      const areaRank = ranked.findIndex((item) => item.code === area.code) + 1;
      const active = area.code === selected.code;
      return <G key={`pin-${area.code}`}>
        <Circle cx={area.center[0]} cy={area.center[1]} fill={active ? "#FFFFFF" : areaRank <= 5 ? ORANGE : "rgba(12,10,9,.78)"} r={viewport.width / 68} />
        <SvgText x={area.center[0]} y={area.center[1] + viewport.width / 190} textAnchor="middle" fill={active ? BLACK : "#FFFFFF"} fontSize={viewport.width / 78} fontWeight="800">{areaRank}</SvgText>
      </G>;
    })}</G>;
  }
  const visible = option === 4 ? topFive : [selected, ...nearest];
  return <G pointerEvents="none">{visible.map((area, index) => {
    const areaRank = ranked.findIndex((item) => item.code === area.code) + 1;
    const active = area.code === selected.code;
    const width = viewport.width / 5.7;
    const height = viewport.width / 15;
    return <G key={`callout-${area.code}`}>
      <Rect x={area.center[0] - width / 2} y={area.center[1] - height / 2} width={width} height={height} rx={height / 2} fill={active ? "#FFFFFF" : "rgba(12,10,9,.88)"} />
      <SvgText x={area.center[0]} y={area.center[1] + height / 7} textAnchor="middle" fill={active ? BLACK : "#FFFFFF"} fontSize={viewport.width / 53} fontWeight="800">{area.name.replace("구", "")} · {areaRank}</SvgText>
    </G>;
  })}</G>;
}

function FocusCard({ selected, rank }: { selected: KoreaMunicipality; rank: number }) {
  return <View pointerEvents="none" style={styles.focusCard}><Text style={styles.cardEyebrow}>SELECTED DISTRICT</Text><Text style={styles.focusName}>{selected.name.replace("구", "")}</Text><View style={styles.focusStats}><Text style={styles.focusRank}>#{rank}</Text><Text numberOfLines={1} style={styles.focusScore}>{score(selected).toLocaleString("ko-KR")}pt</Text></View></View>;
}

function IndexCard({ selected, rank }: { selected: KoreaMunicipality; rank: number }) {
  return <View pointerEvents="none" style={styles.indexCard}><Text style={styles.indexRank}>#{rank}</Text><View><Text style={styles.indexName}>{selected.name}</Text><Text style={styles.indexScore}>{score(selected).toLocaleString("ko-KR")}pt</Text></View></View>;
}

function SplitBar({ selected, rank }: { selected: KoreaMunicipality; rank: number }) {
  return <View pointerEvents="none" style={styles.splitBar}><View><Text style={styles.cardEyebrow}>CURRENT</Text><Text style={styles.splitName}>{selected.name}</Text></View><Text style={styles.splitRank}>#{rank}</Text><Text style={styles.splitScore}>{score(selected).toLocaleString("ko-KR")}pt</Text></View>;
}

function TopRail({ ranked, selectedCode, onSelect }: { ranked: KoreaMunicipality[]; selectedCode: string; onSelect: (area: KoreaMunicipality) => void }) {
  return <View style={styles.topRail}>{ranked.slice(0, 3).map((area, index) => <Pressable key={area.code} onPress={() => onSelect(area)} style={[styles.topRailItem, area.code === selectedCode && styles.topRailItemOn]}><Text style={styles.topRailRank}>0{index + 1}</Text><Text style={styles.topRailName}>{area.name.replace("구", "")}</Text><Text style={styles.topRailScore}>{Math.round(score(area) / 1000)}K</Text></Pressable>)}</View>;
}

function TopFiveLegend({ ranked, selected }: { ranked: KoreaMunicipality[]; selected: KoreaMunicipality }) {
  const selectedRank = ranked.findIndex((area) => area.code === selected.code) + 1;
  return <View pointerEvents="none" style={styles.topFiveLegend}><Text style={styles.cardEyebrow}>TOP 5 ONLY</Text><Text style={styles.topFiveCopy}>{selectedRank <= 5 ? `${selected.name} · TOP ${selectedRank}` : `${selected.name} 선택됨`}</Text></View>;
}

function LensCard({ selected, rank, focused }: { selected: KoreaMunicipality; rank: number; focused: boolean }) {
  return <View pointerEvents="none" style={styles.lensCard}><View style={styles.lensDot} /><View style={{ flex: 1 }}><Text style={styles.lensName}>{selected.name}</Text><Text style={styles.lensMeta}>#{rank} · {score(selected).toLocaleString("ko-KR")}pt</Text></View><Text style={styles.lensState}>{focused ? "확대됨" : "2× 확대"}</Text></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BLACK },
  header: { minHeight: 82, paddingTop: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: LINE },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center" },
  eyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 11, letterSpacing: 1.1 },
  title: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 23, marginTop: 3 },
  content: { padding: 18, paddingBottom: 48, maxWidth: 520, width: "100%", alignSelf: "center" },
  guide: { color: "#B9AFA8", fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  optionRail: { gap: 8, paddingVertical: 16 },
  optionButton: { minWidth: 76, height: 62, borderRadius: 16, borderWidth: 1, borderColor: LINE, backgroundColor: PANEL, paddingHorizontal: 12, justifyContent: "center" },
  optionButtonOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  optionNumber: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 18 },
  optionCode: { color: "#9D928B", fontFamily: fonts.displayExtra, fontSize: 10, letterSpacing: 0.8, marginTop: 2 },
  optionTextOn: { color: BLACK },
  optionIntro: { marginBottom: 12 },
  optionTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 24 },
  optionNote: { color: "#A99E97", fontFamily: fonts.regular, fontSize: 14, marginTop: 4 },
  mapFrame: { height: 460, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "#584037", backgroundColor: "#241F1B" },
  mapFrameSplit: { height: 410, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  zoomButton: { position: "absolute", right: 14, top: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(12,10,9,.86)", borderWidth: 1, borderColor: "rgba(255,255,255,.18)", alignItems: "center", justifyContent: "center" },
  cardEyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 10, letterSpacing: 1 },
  focusCard: { position: "absolute", left: 14, bottom: 14, width: 190, padding: 16, borderRadius: 22, backgroundColor: "rgba(12,10,9,.92)", borderWidth: 1, borderColor: "rgba(255,255,255,.2)" },
  focusName: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 34, marginTop: 3 },
  focusStats: { flexDirection: "row", alignItems: "baseline", gap: 9 },
  focusRank: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 18 },
  focusScore: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 17, flexShrink: 1 },
  indexCard: { position: "absolute", left: 14, top: 14, minWidth: 150, padding: 12, borderRadius: 18, backgroundColor: "rgba(12,10,9,.9)", flexDirection: "row", alignItems: "center", gap: 10 },
  indexRank: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 28 },
  indexName: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },
  indexScore: { color: "#B9AFA8", fontFamily: fonts.semibold, fontSize: 12 },
  splitBar: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 78, paddingHorizontal: 16, backgroundColor: "rgba(12,10,9,.94)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.16)", flexDirection: "row", alignItems: "center", gap: 12 },
  splitName: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18 },
  splitRank: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 30, marginLeft: "auto" },
  splitScore: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 14 },
  topRail: { flexDirection: "row", gap: 7, marginBottom: 8 },
  topRailItem: { flex: 1, minWidth: 0, height: 78, padding: 10, borderRadius: 16, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE },
  topRailItemOn: { borderColor: ORANGE },
  topRailRank: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 12 },
  topRailName: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16, marginTop: 2 },
  topRailScore: { color: "#9D928B", fontFamily: fonts.displayExtra, fontSize: 12 },
  topFiveLegend: { position: "absolute", left: 14, bottom: 14, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: "rgba(12,10,9,.9)" },
  topFiveCopy: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16, marginTop: 3 },
  lensCard: { position: "absolute", left: 14, right: 14, bottom: 14, minHeight: 68, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "rgba(12,10,9,.92)", borderWidth: 1, borderColor: "rgba(255,255,255,.16)", flexDirection: "row", alignItems: "center", gap: 11 },
  lensDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: ORANGE },
  lensName: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18 },
  lensMeta: { color: "#B9AFA8", fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  lensState: { color: ORANGE, fontFamily: fonts.bold, fontSize: 12 },
  readabilityRow: { height: 76, marginTop: 12, borderRadius: 20, backgroundColor: PANEL, borderWidth: 1, borderColor: LINE, flexDirection: "row", alignItems: "center" },
  readabilityItem: { flex: 1, alignItems: "center" },
  readabilityValue: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 20 },
  readabilityLabel: { color: "#92877F", fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  readabilityDivider: { width: 1, height: 28, backgroundColor: LINE },
  selectButton: { marginTop: 12, height: 56, borderRadius: 18, borderWidth: 1, borderColor: ORANGE, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  selectButtonOn: { backgroundColor: ORANGE },
  selectButtonText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 16 },
  selectButtonTextOn: { color: BLACK },
});
