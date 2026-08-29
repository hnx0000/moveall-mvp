import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { CirclePlus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SportType } from "@moveall/contracts";
import { api } from "../../src/api/client";
import { SportGlyph } from "../../src/components/sport-glyph";
import { BellButton, Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import { useAsyncData } from "../../src/hooks/use-async-data";
import {
  fonts,
  gradients,
  radius,
  shadows,
  space,
  typography,
  type ThemeColors,
} from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const homeSportOrder: SportType[] = [
  "running",
  "hiking",
  "cycling",
  "strength",
  "swimming",
  "diving",
];

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

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>오늘의 루틴</Text>
      </View>
      <Card style={styles.routineCard}>
        <View style={styles.sectionHeading}>
          <Text style={styles.routineType}>RUNNING · 30 MIN</Text>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{completed.length}/3</Text>
          </View>
        </View>
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
        <PrimaryButton
          disabled={completed.length === routineItems.length}
          label={
            completed.length === routineItems.length
              ? "오늘 루틴 완료"
              : routineStarted
                ? "진행 중 · 항목을 눌러 완료"
                : "루틴 시작"
          }
          onPress={() => setRoutineStarted(true)}
          style={styles.routineButton}
        />
      </Card>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>바로 기록하기</Text>
        <Text style={styles.viewAll}>전체</Text>
      </View>
      {loading ? <StatePanel state="loading" message="운동 종목을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {sports ? (
        <View style={styles.sportGrid}>
          {homeSportOrder
            .map((sportId) => sports.find((sport) => sport.id === sportId))
            .filter((sport) => sport !== undefined)
            .map((sport) => {
              const selected = selectedSport === sport.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={sport.id}
                  onPress={() => setSelectedSport(sport.id)}
                  style={({ pressed }) => [
                    styles.sportButton,
                    selected && styles.sportButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.sportIconShell, selected && styles.sportIconShellSelected]}>
                    <SportGlyph sport={sport.id} />
                  </View>
                  <Text style={[styles.sportLabel, selected && styles.sportSelectedText]}>
                    {sport.label}
                  </Text>
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
        <LinearGradient
          colors={gradients.primary.colors}
          end={gradients.primary.end}
          start={gradients.primary.start}
          style={[styles.recordPlus, shadows.pop]}
        >
          <CirclePlus color="#FFFFFF" size={26} strokeWidth={2.4} />
        </LinearGradient>
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
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: space[4],
      borderRadius: radius.md,
    },
    noticeText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
    noticeClose: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
    activitySection: {
      paddingTop: space[2],
      paddingBottom: space[5],
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    kicker: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 14 },
    distanceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 4 },
    distance: { ...typography.numeric(60), color: colors.ink, lineHeight: 66 },
    unit: {
      color: colors.muted,
      fontFamily: fonts.bold,
      fontSize: 17,
      marginLeft: 7,
      marginBottom: 8,
    },
    metrics: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: space[4],
      paddingTop: space[4],
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metric: { minWidth: 90 },
    metricRight: { alignItems: "flex-end" },
    metricValue: { ...typography.numeric(19), color: colors.ink },
    metricLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 4 },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    counter: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    counterText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
    routineCard: { padding: space[5], gap: space[3] },
    routineType: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 0.8,
    },
    routineTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 21 },
    routineList: { gap: space[2], marginTop: space[1] },
    routineItem: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: space[3] },
    stepNumber: {
      width: 25,
      height: 25,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumberDone: { backgroundColor: colors.primary },
    stepNumberText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 10 },
    stepNumberTextDone: { color: "#FFFFFF" },
    routineText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
    routineTextDone: { color: colors.muted, textDecorationLine: "line-through" },
    routineButton: { marginTop: space[2] },
    viewAll: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
    sportButton: {
      width: "30%",
      flexGrow: 1,
      minHeight: 104,
      alignItems: "center",
      justifyContent: "center",
      gap: space[2],
      borderRadius: radius["2xl"],
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    sportButtonSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    sportIconShell: {
      width: 52,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#151515",
      borderRadius: radius.lg,
    },
    sportIconShellSelected: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    sportLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 },
    sportSelectedText: { color: colors.primary },
    recordCta: {
      minHeight: 84,
      borderRadius: radius["2xl"],
      backgroundColor: colors.hero,
      paddingHorizontal: space[5],
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    recordCtaKicker: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 10,
      letterSpacing: 0.7,
    },
    recordCtaTitle: {
      color: "#FFFFFF",
      fontFamily: fonts.bold,
      fontSize: 18,
      marginTop: 5,
    },
    recordPlus: {
      width: 46,
      height: 46,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.72 },
  });
}
