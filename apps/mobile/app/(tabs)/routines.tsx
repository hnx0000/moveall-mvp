import { sportLabels, sportValues, type SportType } from "@moveall/contracts";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, PrimaryButton, Screen } from "../../src/components/ui";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type RecordMode = "map" | "photo" | "manual";

const mapSports: SportType[] = ["running", "hiking", "cycling", "swimming", "diving"];
const photoSports: SportType[] = ["strength", "swimming", "diving"];

const proofPrompts: Record<SportType, string[]> = {
  running: ["러닝화", "완주 셀피", "오늘의 하늘"],
  hiking: ["정상 인증", "등산 장비", "트레일 풍경"],
  cycling: ["오늘의 자전거", "라이딩 룩", "휴식 포인트"],
  strength: ["오늘의 눈바디", "오늘의 운동복", "운동 장비"],
  swimming: ["오늘의 수영복", "수영 장비", "레인 인증"],
  diving: ["오늘의 장비", "다이빙 슈트", "포인트 인증"],
};

const modeLabels: Array<{ id: RecordMode; label: string }> = [
  { id: "map", label: "지도 기록" },
  { id: "photo", label: "사진 기록" },
  { id: "manual", label: "수동 기록" },
];

export default function RecordScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const fromHome = sportValues.find((item) => item === params.sport);
  const initialMode: RecordMode = fromHome && photoSports.includes(fromHome) ? "photo" : "map";
  const [mode, setMode] = useState<RecordMode>(initialMode);
  const [sport, setSport] = useState<SportType>(fromHome ?? "running");
  const [workoutDone, setWorkoutDone] = useState(false);
  const [photoPrompt, setPhotoPrompt] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("45");

  const availableSports = mode === "map" ? mapSports : mode === "photo" ? photoSports : sportValues;
  const readyToShare = workoutDone && photoPrompt !== null;

  function chooseMode(nextMode: RecordMode) {
    setMode(nextMode);
    setSport(nextMode === "map" ? "running" : nextMode === "photo" ? "strength" : "running");
    setWorkoutDone(false);
    setPhotoPrompt(null);
  }

  function chooseSport(nextSport: SportType) {
    setSport(nextSport);
    setWorkoutDone(false);
    setPhotoPrompt(null);
  }

  function shareDraft() {
    if (!readyToShare) return;
    const recordText = mode === "map" ? "5.24km · 32분 18초" : `${manualValue || "45"}분 운동`;
    router.push({
      pathname: "/community",
      params: {
        draft: `${sportLabels[sport]} ${recordText} 완료! ${photoPrompt} 인증과 함께 오늘의 움직임을 남깁니다.`,
        sport,
      },
    });
  }

  return (
    <Screen title="">
      <View style={styles.modeTabs}>
        {modeLabels.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === item.id }}
            key={item.id}
            onPress={() => chooseMode(item.id)}
            style={[styles.modeTab, mode === item.id && styles.modeTabActive]}
          >
            <Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>1. 오늘의 운동</Text>

      {mode === "map" ? (
        <MapPreview colors={colors} />
      ) : mode === "photo" ? (
        <PhotoPreview colors={colors} sport={sport} />
      ) : (
        <View style={styles.manualPanel}>
          <Text style={styles.manualLabel}>운동 시간</Text>
          <View style={styles.manualInputRow}>
            <TextInput
              accessibilityLabel="수동 운동 시간"
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setManualValue}
              style={styles.manualInput}
              value={manualValue}
            />
            <Text style={styles.manualUnit}>분</Text>
          </View>
          <Text style={styles.manualHint}>수동 기록은 추후 마일리지 검증 대상에서 분리됩니다.</Text>
        </View>
      )}

      {mode === "map" ? (
        <View style={styles.mapLegend}>
          <Text style={styles.mapLegendIcon}>♧</Text>
          <Text style={styles.mapLegendText}>지도 미리보기</Text>
        </View>
      ) : null}

      <View style={styles.sports}>
        {availableSports.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sport === item }}
            key={item}
            onPress={() => chooseSport(item)}
            style={[styles.sportChip, sport === item && styles.sportChipActive]}
          >
            <Text style={[styles.sportText, sport === item && styles.sportTextActive]}>
              {sportLabels[item]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.recordSummary}>
        <View style={styles.recordCopy}>
          <Text style={styles.recordValue}>{mode === "map" ? "5.24" : manualValue || "45"}</Text>
          <Text style={styles.recordUnit}>{mode === "map" ? "km" : "min"}</Text>
        </View>
        <Text style={styles.recordStatus}>{workoutDone ? "완료" : "기록 전"}</Text>
      </View>
      <PrimaryButton
        label={workoutDone ? "운동 기록 완료" : "운동 완료로 기록"}
        disabled={workoutDone || (mode === "manual" && !manualValue)}
        onPress={() => setWorkoutDone(true)}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>2. 인증샷 한 장</Text>
      <Text style={styles.helper}>
        실제 카메라 연결 전, 원하는 인증샷 구성을 미리 체험할 수 있어요.
      </Text>
      <View style={styles.proofGrid}>
        {proofPrompts[sport].map((prompt, index) => {
          const selected = photoPrompt === prompt;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={prompt}
              onPress={() => setPhotoPrompt(prompt)}
              style={[styles.proofCard, selected && styles.proofCardSelected]}
            >
              <Text style={[styles.proofIcon, selected && styles.proofIconSelected]}>
                {index === 0 ? "♧" : index === 1 ? "♙" : "◡"}
              </Text>
              <Text style={styles.proofText}>{prompt}</Text>
              <Text style={[styles.proofAction, selected && styles.proofActionSelected]}>
                {selected ? "선택됨" : "미리보기 추가"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>3. 스토리로 완성</Text>
      <Card style={styles.storyPreview}>
        <View style={styles.storyTop}>
          <Text style={styles.storyTag}>TODAY&apos;S MOVE</Text>
          <Text style={styles.storySport}>{sportLabels[sport]}</Text>
        </View>
        <Text style={styles.storyValue}>
          {mode === "map" ? "5.24 KM" : `${manualValue || "45"} MIN`}
        </Text>
        <View style={styles.storyProof}>
          <Text style={styles.storyProofText}>{photoPrompt ?? "인증샷을 선택해 주세요"}</Text>
        </View>
      </Card>
      <PrimaryButton label="스토리 초안 만들기" disabled={!readyToShare} onPress={shareDraft} />
    </Screen>
  );
}

function MapPreview({ colors }: { colors: ThemeColors }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.map}>
      {[22, 54, 86, 118, 150].map((top) => (
        <View key={top} style={[styles.mapHorizontal, { top }]} />
      ))}
      {[40, 104, 168, 232, 296].map((left) => (
        <View key={left} style={[styles.mapVertical, { left }]} />
      ))}
      <View
        style={[styles.route, { left: 43, top: 116, width: 89, transform: [{ rotate: "-25deg" }] }]}
      />
      <View
        style={[styles.route, { left: 116, top: 92, width: 80, transform: [{ rotate: "17deg" }] }]}
      />
      <View
        style={[styles.route, { left: 180, top: 72, width: 80, transform: [{ rotate: "-32deg" }] }]}
      />
      <View
        style={[styles.route, { left: 243, top: 54, width: 58, transform: [{ rotate: "25deg" }] }]}
      />
      <View style={styles.startPin}>
        <Text style={styles.pinText}>S</Text>
      </View>
      <View style={styles.finishPin}>
        <Text style={styles.pinText}>F</Text>
      </View>
    </View>
  );
}

function PhotoPreview({ colors, sport }: { colors: ThemeColors; sport: SportType }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.photoPreview}>
      <View style={styles.cameraMark}>
        <Text style={styles.cameraIcon}>◎</Text>
      </View>
      <Text style={styles.photoTitle}>{sportLabels[sport]} 인증을 남겨보세요</Text>
      <Text style={styles.photoHint}>오늘 움직였다는 사실만으로 충분합니다.</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modeTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    modeTab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center" },
    modeTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    modeText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    modeTextActive: { color: colors.ink },
    sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900" },
    map: {
      height: 190,
      overflow: "hidden",
      borderRadius: 8,
      backgroundColor: colors.map,
      position: "relative",
    },
    mapHorizontal: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: colors.mapLine,
    },
    mapVertical: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: colors.mapLine,
    },
    route: { position: "absolute", height: 5, borderRadius: 3, backgroundColor: colors.primary },
    startPin: {
      position: "absolute",
      left: 35,
      top: 125,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    finishPin: {
      position: "absolute",
      right: 18,
      top: 50,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    pinText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    mapLegend: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: -7 },
    mapLegendIcon: { color: colors.ink, fontSize: 17 },
    mapLegendText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
    photoPreview: {
      height: 190,
      borderRadius: 8,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    cameraMark: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    cameraIcon: { color: colors.primary, fontSize: 22 },
    photoTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", marginTop: 10 },
    photoHint: { color: colors.muted, fontSize: 10, marginTop: 4 },
    manualPanel: {
      minHeight: 190,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 18,
      justifyContent: "center",
    },
    manualLabel: { color: colors.ink, fontSize: 12, fontWeight: "800" },
    manualInputRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
    manualInput: {
      color: colors.ink,
      fontSize: 44,
      lineHeight: 52,
      fontWeight: "900",
      minWidth: 92,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    manualUnit: { color: colors.muted, fontSize: 14, marginLeft: 8, marginBottom: 8 },
    manualHint: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 12 },
    sports: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    sportChip: {
      minWidth: 60,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: "center",
    },
    sportChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sportText: { color: colors.ink, fontSize: 10, fontWeight: "800" },
    sportTextActive: { color: "#FFFFFF" },
    recordSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    recordCopy: { flexDirection: "row", alignItems: "flex-end" },
    recordValue: {
      color: colors.ink,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "900",
      letterSpacing: -1,
    },
    recordUnit: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: "900",
      marginLeft: 6,
      marginBottom: 5,
    },
    recordStatus: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
    helper: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: -11 },
    proofGrid: { flexDirection: "row", gap: 8 },
    proofCard: {
      flex: 1,
      minHeight: 132,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 10,
      justifyContent: "space-between",
    },
    proofCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    proofIcon: { color: colors.ink, fontSize: 28, fontWeight: "300" },
    proofIconSelected: { color: colors.primary },
    proofText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    proofAction: { color: colors.muted, fontSize: 9 },
    proofActionSelected: { color: colors.primary, fontWeight: "800" },
    storyPreview: { minHeight: 205, backgroundColor: colors.hero, borderColor: colors.hero },
    storyTop: { flexDirection: "row", justifyContent: "space-between" },
    storyTag: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    storySport: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
    storyValue: { color: "#FFFFFF", fontSize: 42, fontWeight: "900", marginTop: 21 },
    storyProof: {
      minHeight: 58,
      borderRadius: 6,
      backgroundColor: "rgba(255,255,255,0.1)",
      marginTop: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    storyProofText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  });
}
