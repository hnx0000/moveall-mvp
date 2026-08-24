import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { BellButton, Screen, StatePanel } from "../../src/components/ui";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const sportIcons: Record<string, string> = {
  strength: "◆",
  running: "↗",
  hiking: "△",
  diving: "≋",
  cycling: "◉",
  swimming: "≈",
};

const routineItems = ["워밍업 걷기 5분", "편안한 러닝 20분", "쿨다운 걷기 5분"];

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loader = useCallback(() => api.sports(), []);
  const { data: sports, error, loading, reload } = useAsyncData(loader);
  const [routineStarted, setRoutineStarted] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [selectedSport, setSelectedSport] = useState("running");
  const [notificationOpen, setNotificationOpen] = useState(false);

  function toggleStep(index: number) {
    if (!routineStarted) return;
    setCompleted((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  return (
    <Screen
      title=""
      action={<BellButton onPress={() => setNotificationOpen((current) => !current)} />}
    >
      {notificationOpen ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>오늘 확인할 새 알림이 없습니다.</Text>
          <Pressable accessibilityRole="button" onPress={() => setNotificationOpen(false)}>
            <Text style={styles.noticeClose}>닫기</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.activitySection}>
        <Text style={styles.kicker}>오늘의 활동</Text>
        <View style={styles.distanceRow}>
          <Text style={styles.distance}>5.24</Text>
          <Text style={styles.unit}>km</Text>
        </View>
        <View style={styles.metrics}>
          <Metric value="32:18" label="시간" colors={colors} />
          <Metric value={"6'10\""} label="평균 페이스" colors={colors} />
          <Metric value="384" label="kcal" colors={colors} align="right" />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>오늘의 루틴</Text>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{completed.length}/3</Text>
        </View>
      </View>
      <Text style={styles.routineType}>RUNNING · 30 MIN</Text>
      <Text style={styles.routineTitle}>편안한 이지런</Text>
      <View style={styles.routineList}>
        {routineItems.map((item, index) => {
          const isDone = completed.includes(index);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone, disabled: !routineStarted }}
              disabled={!routineStarted}
              key={item}
              onPress={() => toggleStep(index)}
              style={({ pressed }) => [styles.routineItem, pressed && styles.pressed]}
            >
              <View style={[styles.stepNumber, isDone && styles.stepNumberDone]}>
                <Text style={[styles.stepNumberText, isDone && styles.stepNumberTextDone]}>
                  {isDone ? "✓" : index + 1}
                </Text>
              </View>
              <Text style={[styles.routineText, isDone && styles.routineTextDone]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={completed.length === routineItems.length}
        onPress={() => setRoutineStarted(true)}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.pressed,
          completed.length === routineItems.length && styles.disabled,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {completed.length === routineItems.length
            ? "오늘 루틴 완료"
            : routineStarted
              ? "진행 중 · 항목을 눌러 완료"
              : "루틴 시작"}
        </Text>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>바로 기록하기</Text>
        <Text style={styles.viewAll}>전체</Text>
      </View>
      {loading ? <StatePanel state="loading" message="운동 종목을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {sports ? (
        <View style={styles.sportGrid}>
          {sports.map((sport) => {
            const selected = selectedSport === sport.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={sport.id}
                onPress={() => setSelectedSport(sport.id)}
                style={({ pressed }) => [styles.sportButton, pressed && styles.pressed]}
              >
                <View style={[styles.sportVisual, selected && styles.sportButtonSelected]}>
                  <Text style={[styles.sportIcon, selected && styles.sportSelectedText]}>
                    {sportIcons[sport.id]}
                  </Text>
                  <Text style={[styles.sportLabel, selected && styles.sportSelectedText]}>
                    {sport.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: "/routines", params: { sport: selectedSport } })}
        style={({ pressed }) => [styles.recordCta, pressed && styles.pressed]}
      >
        <View>
          <Text style={styles.recordCtaKicker}>운동 · 일상 · 공유</Text>
          <Text style={styles.recordCtaTitle}>지금 운동 기록 만들기</Text>
        </View>
        <View style={styles.recordPlus}>
          <Text style={styles.recordPlusText}>＋</Text>
        </View>
      </Pressable>
    </Screen>
  );
}

function Metric({
  value,
  label,
  colors,
  align = "left",
}: {
  value: string;
  label: string;
  colors: ThemeColors;
  align?: "left" | "right";
}) {
  const styles = createStyles(colors);
  return (
    <View style={[styles.metric, align === "right" && styles.metricRight]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    notice: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      borderRadius: 7,
    },
    noticeText: { color: colors.muted, fontSize: 11 },
    noticeClose: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    activitySection: { paddingTop: 4 },
    kicker: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    distanceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 10 },
    distance: {
      color: colors.ink,
      fontSize: 59,
      lineHeight: 65,
      fontWeight: "900",
      letterSpacing: -2.4,
    },
    unit: { color: colors.ink, fontSize: 15, fontWeight: "900", marginLeft: 7, marginBottom: 10 },
    metrics: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
    metric: { minWidth: 90 },
    metricRight: { alignItems: "flex-end" },
    metricValue: { color: colors.ink, fontSize: 17, fontWeight: "900" },
    metricLabel: { color: colors.muted, fontSize: 10, marginTop: 5 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
    counter: {
      backgroundColor: colors.primarySoft,
      borderRadius: 7,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    counterText: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    routineType: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
    routineTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: -7 },
    routineList: { gap: 4 },
    routineItem: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 11 },
    stepNumber: {
      width: 23,
      height: 23,
      borderRadius: 6,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberDone: { backgroundColor: colors.primary },
    stepNumberText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    stepNumberTextDone: { color: "#FFFFFF" },
    routineText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
    routineTextDone: { color: colors.muted, textDecorationLine: "line-through" },
    primaryButton: {
      minHeight: 43,
      borderRadius: 7,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
    disabled: { opacity: 0.5 },
    viewAll: { color: colors.muted, fontSize: 11 },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
    sportButton: {
      width: "31%",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 7,
    },
    sportVisual: {
      width: 74,
      minHeight: 64,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 8,
    },
    sportButtonSelected: { backgroundColor: colors.primary },
    sportIcon: { color: colors.ink, fontSize: 22, fontWeight: "400" },
    sportLabel: { color: colors.ink, fontSize: 11, fontWeight: "700" },
    sportSelectedText: { color: "#FFFFFF" },
    recordCta: {
      minHeight: 70,
      borderRadius: 8,
      backgroundColor: colors.hero,
      paddingHorizontal: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    recordCtaKicker: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
    recordCtaTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginTop: 5 },
    recordPlus: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    recordPlusText: { color: "#FFFFFF", fontSize: 25, fontWeight: "300", lineHeight: 27 },
    pressed: { opacity: 0.72 },
  });
}
