import { sportLabels, type SportType } from "@moveall/contracts";
import { Check, ChevronLeft, ChevronRight, LockKeyhole, X } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { fonts } from "../theme";
import { medalArtworkSources } from "./medal-artwork-sources";
import {
  medalDefinitions,
  medalSportOrder,
  type MedalCategory,
  type MedalDefinition,
  type MedalGrade,
} from "./medal-design-catalog";

const gradeNames: Record<MedalGrade, string> = {
  bronze: "브론즈",
  silver: "실버",
  gold: "골드",
  diamond: "다이아",
  platinum: "플래티넘",
  master: "마스터",
};
const gradeColors: Record<MedalGrade, string> = {
  bronze: "#e7a06d",
  silver: "#cbd1d5",
  gold: "#f3cb77",
  diamond: "#b9e4fa",
  platinum: "#d0b7ee",
  master: "#ff603e",
};
const categories: { key: MedalCategory; name: string; count: number; subtitle: string }[] = [
  { key: "activity", name: "활동일", count: 36, subtitle: "기록을 쌓아 만든 여섯 단계" },
  { key: "specialty", name: "종목 특화", count: 36, subtitle: "거리 · 탐험 · 루틴, 나만의 축적" },
  { key: "special", name: "특별성취", count: 34, subtitle: "완주와 돌파, 처음의 순간을 간직하다" },
];
function gradeLabel(d: MedalDefinition) {
  return d.grade ? gradeNames[d.grade] : "특별성취 · 무등급";
}
function ink(d: MedalDefinition) {
  return d.grade ? gradeColors[d.grade] : "#ff603e";
}

/** Complete raster relief. No sport icon, typography or grade plate is overlaid on the artwork. */

export function MedalDesignArtwork({
  definition,
  size = 150,
  locked = false,
}: {
  definition: MedalDefinition;
  size?: number;
  locked?: boolean;
}) {
  const source = medalArtworkSources[definition.id];
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={`${definition.title}, ${gradeLabel(definition)}${locked ? ", 잠금 예시" : ", 디자인 예시"}`}
    >
      {source ? (
        <Image
          source={source}
          resizeMode="contain"
          style={{ width: size, height: size, borderRadius: size / 2, opacity: locked ? 0.28 : 1 }}
        />
      ) : (
        <Text style={s.note}>입체 메달 제작 중</Text>
      )}
      {locked && source ? (
        <View style={[s.lock, { right: size * 0.06, bottom: size * 0.06 }]}>
          <LockKeyhole size={16} color="#e7e9e6" />
        </View>
      ) : null}
    </View>
  );
}

export function MedalDesignGallery() {
  const readyCount = Object.keys(medalArtworkSources).length;
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [category, setCategory] = useState<MedalCategory>("activity");
  const [sport, setSport] = useState<SportType | "all">("strength");
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<MedalDefinition | null>(null);
  const available = measuredWidth || Math.max(250, width - 76);
  const columns = available >= 880 ? 6 : available >= 560 ? 3 : 2;
  const tileWidth = Math.floor((available - (columns - 1) * 12) / columns);
  const artSize = Math.min(tileWidth, 210);
  const active = categories.find((c) => c.key === category)!;
  const visible = useMemo(
    () =>
      medalDefinitions.filter(
        (d) => d.category === category && (sport === "all" || d.sport === sport),
      ),
    [category, sport],
  );
  const selectedIndex = selected ? visible.findIndex((d) => d.id === selected.id) : -1;
  function selectNeighbor(delta: number) {
    const next = visible[selectedIndex + delta];
    if (next) setSelected(next);
  }
  return (
    <View style={s.gallery}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>GROOV MEDALS</Text>
          <Text style={s.title}>달성 메달</Text>
        </View>
        <Text style={s.total}>
          106<Text style={s.totalUnit}> PIECES</Text>
        </Text>
      </View>
      <Text style={s.disclaimer}>
        {readyCount < medalDefinitions.length
          ? `재제작 진행 중 · ${readyCount}/${medalDefinitions.length}종 연결됨\n`
          : ""}
        디자인 보관함 전용 · 실제 MY와 획득 상태에는 적용되지 않습니다.
      </Text>
      <View style={s.categoryTabs}>
        {categories.map((c) => (
          <Pressable
            key={c.key}
            testID={"medal-category-" + c.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === c.key }}
            accessibilityLabel={c.name + " " + c.count + "종"}
            onPress={() => setCategory(c.key)}
            style={[s.categoryTab, category === c.key && s.categoryActive]}
          >
            <Text style={[s.categoryText, category === c.key && { color: "#ff603e" }]}>
              {c.name}
            </Text>
            <Text style={s.categoryCount}>{c.count}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.sportFilters}
      >
        {(["all", ...medalSportOrder] as const).map((key) => (
          <Pressable
            key={key}
            testID={"medal-sport-" + key}
            accessibilityRole="button"
            accessibilityLabel={key === "all" ? "모든 종목" : sportLabels[key] + " 메달"}
            accessibilityState={{ selected: sport === key }}
            onPress={() => setSport(key)}
            style={[s.sportFilter, sport === key && s.sportActive]}
          >
            <Text style={[s.filterText, sport === key && { color: "#f3f3ed" }]}>
              {key === "all" ? "전체" : sportLabels[key]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.sectionIntro}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{active.name}</Text>
          <Text style={s.note}>{active.subtitle}</Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="잠금 상태 미리보기"
          accessibilityState={{ checked: locked }}
          onPress={() => setLocked((v) => !v)}
          style={s.lockToggle}
        >
          <LockKeyhole size={14} color={locked ? "#ff603e" : "#929b95"} />
          <Text style={[s.note, locked && { color: "#ff603e" }]}>잠금 {locked ? "ON" : "OFF"}</Text>
        </Pressable>
      </View>
      <View onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)} style={{ gap: 34 }}>
        {medalSportOrder
          .filter((key) => sport === "all" || sport === key)
          .map((key) => (
            <View key={key} style={s.series}>
              <View style={s.seriesHeading}>
                <Text style={s.seriesSport}>{sportLabels[key]}</Text>
                <View style={s.rule} />
                <Text style={s.note}>{visible.filter((d) => d.sport === key).length}종</Text>
              </View>
              <View style={s.grid}>
                {visible
                  .filter((d) => d.sport === key)
                  .map((d) => (
                    <Pressable
                      key={d.id}
                      testID={"medal-design-" + d.id}
                      accessibilityRole="button"
                      accessibilityLabel={d.title + " 디자인 상세"}
                      onPress={() => setSelected(d)}
                      style={({ pressed }) => [
                        s.tile,
                        { width: tileWidth, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <MedalDesignArtwork definition={d} size={artSize} locked={locked} />
                      <Text style={[s.grade, { color: locked ? "#68716b" : ink(d) }]}>
                        {gradeLabel(d)}
                      </Text>
                      <Text style={s.medalTitle}>{d.title}</Text>
                      {d.title === "첫 세트" ||
                      d.title === "첫 러닝" ||
                      d.title === "첫 산행" ||
                      d.title === "첫 물살" ||
                      d.title === "첫 다이빙" ||
                      d.title === "첫 페달" ? (
                        <Text style={s.note}>첫 활동 · 1일</Text>
                      ) : null}
                      {d.optional && <Text style={s.optional}>스쿠바 선택형</Text>}
                    </Pressable>
                  ))}
              </View>
            </View>
          ))}
      </View>
      <Text style={s.footerNote}>
        메달을 누르면 조형과 각인, 정확한 성취 조건을 확인할 수 있습니다.
        {category === "special"
          ? "\n특별성취는 일반 6등급과 별개의 기념 메달입니다."
          : "\n브론즈 → 실버 → 골드 → 다이아 → 플래티넘 → 마스터"}
      </Text>
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.scrim}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="메달 상세 배경 닫기"
            onPress={() => setSelected(null)}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.dialog} accessibilityViewIsModal>
            <View style={s.dialogTop}>
              <Text style={s.eyebrow}>DESIGN PREVIEW / NOT AWARDED</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="메달 상세 닫기"
                onPress={() => setSelected(null)}
                style={s.iconButton}
              >
                <X size={22} color="#f4f3ee" />
              </Pressable>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={s.dialogContent}>
                <MedalDesignArtwork
                  definition={selected}
                  size={Math.min(width - 72, 380)}
                  locked={locked}
                />
                <Text style={[s.grade, { color: ink(selected) }]}>{gradeLabel(selected)}</Text>
                <Text style={s.detailTitle}>{selected.title}</Text>
                <Text style={s.condition}>{selected.description}</Text>
                <View style={s.conditionPanel}>
                  <Check color="#ff603e" size={16} />
                  <Text style={s.conditionText}>
                    {selected.category === "special"
                      ? "해당 조건 최초 달성 1회 · 일반 등급과 별도"
                      : "목표 " +
                        selected.target.toLocaleString("en-US") +
                        selected.unit +
                        " · " +
                        selected.stage +
                        "/6 단계"}
                  </Text>
                </View>
                {selected.optional && (
                  <Text style={s.note}>
                    스쿠바 선택형입니다. 프리다이빙 사용자의 필수 과제가 아닙니다.
                  </Text>
                )}
                <View style={s.scaleCheck}>
                  <MedalDesignArtwork definition={selected} size={72} />
                  <MedalDesignArtwork definition={selected} size={72} locked />
                  <Text style={s.note}>72px / 잠금 비교</Text>
                </View>
                <Text style={s.note}>필요 데이터: {selected.requiredData.join(" / ")}</Text>
                <Text style={s.note}>
                  {selected.verification === "pending-data"
                    ? "추가 데이터·검증 필요"
                    : "완료 운동 데이터 기반 조건"}{" "}
                  · 지급 기능 미연결
                </Text>
                <Text selectable style={s.assetId}>
                  {selected.id}
                </Text>
              </ScrollView>
            )}
            <View style={s.pager}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="이전 메달"
                disabled={selectedIndex <= 0}
                onPress={() => selectNeighbor(-1)}
                style={[s.iconButton, selectedIndex <= 0 && { opacity: 0.25 }]}
              >
                <ChevronLeft color="#e9eae5" size={23} />
              </Pressable>
              <Text style={s.note}>
                {selectedIndex + 1} / {visible.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="다음 메달"
                disabled={selectedIndex >= visible.length - 1}
                onPress={() => selectNeighbor(1)}
                style={[s.iconButton, selectedIndex >= visible.length - 1 && { opacity: 0.25 }]}
              >
                <ChevronRight color="#e9eae5" size={23} />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  gallery: {
    backgroundColor: "#090c0b",
    padding: 14,
    gap: 20,
    borderWidth: 1,
    borderColor: "#232925",
  },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  eyebrow: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.7, color: "#89928c" },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 38, color: "#f1f2ed", marginTop: 6 },
  total: { color: "#ff603e", fontFamily: fonts.displayExtra, fontSize: 28 },
  totalUnit: { color: "#89928c", fontSize: 8 },
  disclaimer: { color: "#8c9690", fontFamily: fonts.medium, fontSize: 11, lineHeight: 18 },
  categoryTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#2b302d" },
  categoryTab: {
    flex: 1,
    minHeight: 48,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  categoryActive: { borderBottomColor: "#ff603e" },
  categoryText: { fontFamily: fonts.bold, fontSize: 13, color: "#afb5b0" },
  categoryCount: { fontFamily: fonts.display, fontSize: 10, color: "#69766e" },
  sportFilters: { gap: 7 },
  sportFilter: {
    minHeight: 38,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#29302b",
  },
  sportActive: { backgroundColor: "#272d29", borderColor: "#465048" },
  filterText: { fontFamily: fonts.bold, fontSize: 12, color: "#929c94" },
  sectionIntro: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 20, color: "#f1f2ed" },
  note: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, color: "#929e95" },
  lockToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 },
  series: { gap: 15 },
  seriesHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  seriesSport: { color: "#bfc7c1", fontFamily: fonts.bold, fontSize: 13 },
  rule: { flex: 1, height: 1, backgroundColor: "#272e28" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, rowGap: 25 },
  tile: { alignItems: "center", minWidth: 0, gap: 6, paddingBottom: 7 },
  grade: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  medalTitle: {
    color: "#eeeee9",
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  optional: { color: "#a59180", fontSize: 10 },
  lock: {
    position: "absolute",
    backgroundColor: "#161e19",
    borderRadius: 20,
    padding: 7,
    borderWidth: 1,
    borderColor: "#49554b",
  },
  footerNote: {
    color: "#7e8d82",
    fontSize: 11,
    lineHeight: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#272e28",
  },
  scrim: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000d",
  },
  dialog: {
    backgroundColor: "#090c0b",
    width: "100%",
    maxWidth: 490,
    maxHeight: "94%",
    borderColor: "#323e35",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  dialogTop: {
    paddingLeft: 18,
    paddingRight: 5,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dialogContent: { paddingHorizontal: 20, paddingBottom: 20, alignItems: "center", gap: 13 },
  detailTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 33,
    color: "#f3f3ee",
    textAlign: "center",
  },
  condition: {
    fontFamily: fonts.medium,
    color: "#c3cbc4",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
  },
  conditionPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#171c18",
    width: "100%",
    padding: 12,
  },
  conditionText: { flex: 1, color: "#c3cbc4", fontSize: 12, lineHeight: 20 },
  scaleCheck: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  assetId: { color: "#566a5c", fontSize: 10 },
  pager: {
    borderTopWidth: 1,
    borderTopColor: "#272e28",
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
