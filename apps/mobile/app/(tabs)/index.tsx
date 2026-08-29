import {
  sportLabels,
  type Medal,
  type Routine,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { CirclePlus } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Defs, Image as SvgImage, Mask, Rect, Svg } from "react-native-svg";
import sportLogoSheet from "../../assets/images/sport-logo-sheet.jpg";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
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

const sportLogoIndex: Record<SportType, number> = {
  running: 0,
  hiking: 1,
  cycling: 2,
  strength: 3,
  swimming: 4,
  diving: 5,
};

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loader = useCallback(() => api.sports(), []);
  const { data: sports, error, loading, reload } = useAsyncData(loader);
  const [routineStarted, setRoutineStarted] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [savingCompletion, setSavingCompletion] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>("running");
  const [notificationOpen, setNotificationOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const [nextRoutines, nextWorkouts, nextMedals] = await Promise.all([
        api.routines(session.accessToken),
        api.workouts(session.accessToken),
        api.medals(session.accessToken),
      ]);
      setRoutines(nextRoutines);
      setWorkouts(nextWorkouts);
      setMedals(nextMedals);
    } catch {
      setDashboardError("홈 기록을 불러오지 못했습니다.");
    } finally {
      setDashboardLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const todayWorkouts = useMemo(
    () => workouts.filter((workout) => isSameLocalDay(new Date(workout.endedAt), new Date())),
    [workouts],
  );
  const todayRoutine = useMemo(
    () =>
      routines.find((routine) => routine.daysOfWeek.includes(new Date().getDay())) ?? routines[0],
    [routines],
  );
  const todayRoutineItems = useMemo(
    () => [...(todayRoutine?.items ?? [])].sort((left, right) => left.order - right.order),
    [todayRoutine],
  );
  const routineCompletionCount = useMemo(
    () =>
      todayRoutine
        ? workouts.filter((workout) => workout.notes?.includes(`[routine:${todayRoutine.id}]`))
            .length
        : 0,
    [todayRoutine, workouts],
  );
  const selectedSportWorkouts = useMemo(
    () => todayWorkouts.filter((workout) => workout.sport === selectedSport),
    [selectedSport, todayWorkouts],
  );
  const activitySummary = useMemo(
    () => summarizeSportActivity(selectedSport, selectedSportWorkouts),
    [selectedSport, selectedSportWorkouts],
  );

  useEffect(() => {
    setRoutineStarted(false);
    setCompleted([]);
    setCompletionMessage(null);
  }, [todayRoutine?.id]);

  function toggleStep(index: number) {
    if (!routineStarted) return;
    setCompleted((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  async function completeRoutine() {
    if (!session || !todayRoutine || completed.length !== todayRoutineItems.length) return;
    setSavingCompletion(true);
    setDashboardError(null);
    try {
      const endedAt = new Date();
      const durationMinutes = Math.max(10, todayRoutineItems.length * 10);
      const previouslyEarned = new Set(
        medals.filter((medal) => medal.earned).map((medal) => medal.id),
      );
      await api.createWorkoutSession(session.accessToken, {
        sport: todayRoutine.sport,
        startedAt: new Date(endedAt.getTime() - durationMinutes * 60_000).toISOString(),
        endedAt: endedAt.toISOString(),
        perceivedExertion: 6,
        notes: `[routine:${todayRoutine.id}] ${todayRoutine.title} 완료`,
        metrics: {
          routineCompletion: 1,
          calories: todayRoutineItems.length * 70,
          ...(todayRoutine.sport === "strength"
            ? {
                exerciseCount: todayRoutineItems.length,
                cycles: todayRoutineItems.length,
                sets: todayRoutineItems.length,
              }
            : {}),
        },
        source: "manual",
      });
      const [nextWorkouts, nextMedals] = await Promise.all([
        api.workouts(session.accessToken),
        api.medals(session.accessToken),
      ]);
      const newMedal = nextMedals.find((medal) => medal.earned && !previouslyEarned.has(medal.id));
      setWorkouts(nextWorkouts);
      setMedals(nextMedals);
      setCompletionMessage(
        newMedal
          ? `${todayRoutine.title} ${routineCompletionCount + 1}회 완료 · ${newMedal.title} 메달을 획득했습니다!`
          : `${todayRoutine.title} ${routineCompletionCount + 1}회 완료 · 다음 메달까지 계속 이어가세요.`,
      );
      setRoutineStarted(false);
      setCompleted([]);
    } catch {
      setDashboardError("루틴 완료 기록을 저장하지 못했습니다.");
    } finally {
      setSavingCompletion(false);
    }
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
        <View style={styles.activityHeading}>
          <Text style={styles.kicker}>오늘의 활동</Text>
          <Text style={styles.activityDayCount}>{todayWorkouts.length}회 기록</Text>
        </View>
        {dashboardLoading ? (
          <StatePanel state="loading" message="오늘의 기록을 확인하고 있어요." />
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.activitySportTabs}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {homeSportOrder.map((sport) => {
                const active = selectedSport === sport;
                const count = todayWorkouts.filter((workout) => workout.sport === sport).length;
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    key={sport}
                    onPress={() => setSelectedSport(sport)}
                    style={[styles.activitySportTab, active && styles.activitySportTabActive]}
                  >
                    <Text
                      style={[
                        styles.activitySportTabText,
                        active && styles.activitySportTabTextActive,
                      ]}
                    >
                      {sportLabels[sport]}
                    </Text>
                    {count > 0 ? (
                      <View
                        style={[styles.activitySportDot, active && styles.activitySportDotActive]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Card style={styles.activityRecordCard}>
              <View style={styles.activityRecordedRow}>
                <View>
                  <Text style={styles.activityStateLabel}>
                    {selectedSportWorkouts.length > 0 ? "RECORDED TODAY" : "READY TO MOVE"}
                  </Text>
                  <Text style={styles.activitySportName}>{sportLabels[selectedSport]}</Text>
                </View>
                <View style={styles.recordCountBadge}>
                  <Text style={styles.recordCountText}>
                    {selectedSportWorkouts.length > 0
                      ? `${selectedSportWorkouts.length}회 기록`
                      : "기록 전"}
                  </Text>
                </View>
              </View>

              <View style={styles.activityPrimaryRow}>
                <View>
                  <Text style={styles.activityPrimaryLabel}>{activitySummary.primaryLabel}</Text>
                  <View style={styles.distanceRow}>
                    <Text style={styles.distance}>{activitySummary.primaryValue}</Text>
                    <Text style={styles.unit}>{activitySummary.primaryUnit}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/routines", params: { sport: selectedSport } })
                  }
                  style={styles.activityStartButton}
                >
                  <Text style={styles.activityStartButtonText}>
                    {selectedSportWorkouts.length > 0 ? "추가 기록" : "기록 시작"}
                  </Text>
                </Pressable>
              </View>

              {activitySummary.cycles ? (
                <View style={styles.cyclePanel}>
                  <View style={styles.cycleHeading}>
                    <Text style={styles.cycleTitle}>오늘의 사이클</Text>
                    <Text style={styles.cycleCount}>
                      {activitySummary.cycles.completed}/{activitySummary.cycles.total}
                    </Text>
                  </View>
                  <View style={styles.cycleRow}>
                    {Array.from({ length: activitySummary.cycles.total }, (_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.cycleCheck,
                          index < activitySummary.cycles!.completed && styles.cycleCheckDone,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cycleCheckText,
                            index < activitySummary.cycles!.completed && styles.cycleCheckTextDone,
                          ]}
                        >
                          {index < activitySummary.cycles!.completed ? "✓" : index + 1}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.metrics}>
                {activitySummary.metrics.map((metric, index) => (
                  <Metric
                    align={index === activitySummary.metrics.length - 1 ? "right" : "left"}
                    colors={colors}
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                  />
                ))}
              </View>
            </Card>
          </>
        )}
      </View>

      {dashboardError ? <Text style={styles.dashboardError}>{dashboardError}</Text> : null}
      {completionMessage ? (
        <View style={styles.completionBanner}>
          <Text style={styles.completionBannerEyebrow}>ROUTINE COMPLETE</Text>
          <Text style={styles.completionBannerText}>{completionMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>오늘의 루틴</Text>
      </View>
      {todayRoutine ? (
        <Card style={styles.routineCard}>
          <View style={styles.sectionHeading}>
            <Text style={styles.routineType}>{sportLabels[todayRoutine.sport].toUpperCase()}</Text>
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {routineStarted
                  ? `${completed.length}/${todayRoutineItems.length}`
                  : `${routineCompletionCount}회`}
              </Text>
            </View>
          </View>
          <Text style={styles.routineTitle}>{todayRoutine.title}</Text>
          <Text style={styles.routineGuide}>
            내 정보에서 저장한 첫 번째 루틴 · 완료할 때마다 기록과 메달에 반영됩니다.
          </Text>
          <View style={styles.routineList}>
            {todayRoutineItems.map((item, index) => {
              const isDone = completed.includes(index);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isDone, disabled: !routineStarted }}
                  disabled={!routineStarted}
                  key={`${item.order}-${item.name}`}
                  onPress={() => toggleStep(index)}
                  style={({ pressed }) => [styles.routineItem, pressed && styles.pressed]}
                >
                  <View style={[styles.stepNumber, isDone && styles.stepNumberDone]}>
                    <Text style={[styles.stepNumberText, isDone && styles.stepNumberTextDone]}>
                      {isDone ? "✓" : index + 1}
                    </Text>
                  </View>
                  <View style={styles.routineItemCopy}>
                    <Text style={[styles.routineText, isDone && styles.routineTextDone]}>
                      {item.name}
                    </Text>
                    <Text style={styles.routineTarget}>{item.target}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            disabled={
              savingCompletion || (routineStarted && completed.length !== todayRoutineItems.length)
            }
            label={
              savingCompletion
                ? "완료 저장 중"
                : !routineStarted
                  ? "루틴 시작"
                  : completed.length === todayRoutineItems.length
                    ? "루틴 완료 기록하기"
                    : `${completed.length}/${todayRoutineItems.length} 진행 중`
            }
            onPress={() => (routineStarted ? void completeRoutine() : setRoutineStarted(true))}
            style={styles.routineButton}
          />
        </Card>
      ) : (
        <Card style={styles.noRoutineCard}>
          <Text style={styles.noRoutineEyebrow}>NO ROUTINE YET</Text>
          <Text style={styles.noRoutineTitle}>오늘 실행할 루틴을 만들어보세요.</Text>
          <Text style={styles.noRoutineText}>
            내 정보에서 운동 종류와 이름, 세부 항목을 정하면 홈에 바로 연결됩니다.
          </Text>
          <PrimaryButton
            label="내 정보에서 루틴 만들기"
            onPress={() => router.push({ pathname: "/profile", params: { tab: "routines" } })}
          />
        </Card>
      )}

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
                  <SportLogo selected={selected} sport={sport.id} />
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

function SportLogo({ selected, sport }: { selected: boolean; sport: SportType }) {
  const { colors } = useAppTheme();
  const cell = 48;
  const maskId = `sport-logo-${sport}`;

  return (
    <Svg height={cell} viewBox={`0 0 ${cell} ${cell}`} width={cell}>
      <Defs>
        <Mask
          height={cell}
          id={maskId}
          maskContentUnits="userSpaceOnUse"
          maskUnits="userSpaceOnUse"
          width={cell}
          x={0}
          y={0}
        >
          <SvgImage
            height={cell * 2 + 4}
            href={sportLogoSheet}
            preserveAspectRatio="none"
            width={cell * 6}
            x={-sportLogoIndex[sport] * cell}
            y={0}
          />
        </Mask>
      </Defs>
      <Rect
        fill={selected ? "#FFFFFF" : colors.ink}
        height={cell}
        mask={`url(#${maskId})`}
        width={cell}
      />
    </Svg>
  );
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

type SportActivitySummary = {
  primaryLabel: string;
  primaryValue: string;
  primaryUnit: string;
  metrics: Array<{ label: string; value: string }>;
  cycles?: { completed: number; total: number };
};

function summarizeSportActivity(
  sport: SportType,
  workouts: WorkoutSession[],
): SportActivitySummary {
  const durationSeconds = workouts.reduce((total, workout) => total + workoutDuration(workout), 0);
  const distanceKm = sumMetric(workouts, "distanceKm");
  const calories = Math.round(sumMetric(workouts, "calories"));

  if (sport === "running") {
    const paceSeconds = weightedPace(workouts, durationSeconds, distanceKm);
    return {
      primaryLabel: "평균 페이스",
      primaryValue: formatPace(paceSeconds),
      primaryUnit: "/km",
      metrics: [
        { label: "거리", value: `${distanceKm.toFixed(2)} km` },
        { label: "시간", value: formatClock(durationSeconds) },
        { label: "소모", value: `${calories} kcal` },
      ],
    };
  }

  if (sport === "cycling") {
    const averageSpeed = durationSeconds > 0 ? distanceKm / (durationSeconds / 3600) : 0;
    return {
      primaryLabel: "라이딩 페이스",
      primaryValue: averageSpeed > 0 ? averageSpeed.toFixed(1) : "0.0",
      primaryUnit: "km/h",
      metrics: [
        { label: "거리", value: `${distanceKm.toFixed(2)} km` },
        { label: "시간", value: formatClock(durationSeconds) },
        { label: "소모", value: `${calories} kcal` },
      ],
    };
  }

  if (sport === "hiking") {
    return {
      primaryLabel: "활동 시간",
      primaryValue: formatClock(durationSeconds),
      primaryUnit: "",
      metrics: [
        { label: "거리", value: `${distanceKm.toFixed(2)} km` },
        { label: "고도 상승", value: `${Math.round(sumMetric(workouts, "elevationGainM"))} m` },
        { label: "소모", value: `${calories} kcal` },
      ],
    };
  }

  if (sport === "swimming") {
    const laps = Math.round(sumMetric(workouts, "laps"));
    const distanceM =
      sumMetric(workouts, "distanceM") || Math.round(sumMetric(workouts, "distanceKm") * 1000);
    return {
      primaryLabel: "수영 시간",
      primaryValue: formatClock(durationSeconds),
      primaryUnit: "",
      metrics: [
        { label: "거리", value: `${Math.round(distanceM)} m` },
        { label: "랩", value: `${laps} lap` },
        { label: "소모", value: `${calories} kcal` },
      ],
    };
  }

  if (sport === "diving") {
    const depthPb = Math.max(0, ...workouts.map((workout) => workout.metrics.maxDepthM ?? 0));
    const dynamicDistance = sumMetric(workouts, "dynamicDistanceM");
    return {
      primaryLabel: "수심 PB",
      primaryValue: depthPb > 0 ? depthPb.toFixed(1) : "0.0",
      primaryUnit: "m",
      metrics: [
        { label: "다이나믹", value: `${Math.round(dynamicDistance)} m` },
        { label: "다이빙 시간", value: formatClock(durationSeconds) },
        { label: "세션", value: `${workouts.length}회` },
      ],
    };
  }

  const recordedExerciseCount = Math.round(sumMetric(workouts, "exerciseCount"));
  const exerciseCount = recordedExerciseCount > 0 ? recordedExerciseCount : workouts.length;
  const cycles = Math.round(
    sumMetric(workouts, "cycles") ||
      sumMetric(workouts, "sets") ||
      sumMetric(workouts, "routineCompletion"),
  );
  const cycleTotal = cycles > 4 ? Math.min(cycles, 8) : 4;
  return {
    primaryLabel: "실행 운동",
    primaryValue: `${exerciseCount}`,
    primaryUnit: "종목",
    metrics: [
      { label: "완료 세트", value: `${Math.round(sumMetric(workouts, "sets"))} set` },
      { label: "운동 시간", value: formatClock(durationSeconds) },
      { label: "볼륨", value: `${Math.round(sumMetric(workouts, "volumeKg"))} kg` },
    ],
    cycles: { completed: Math.min(cycles, cycleTotal), total: cycleTotal },
  };
}

function workoutDuration(workout: WorkoutSession) {
  const elapsed = (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000;
  return Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
}

function sumMetric(workouts: WorkoutSession[], key: string) {
  return workouts.reduce((total, workout) => total + (workout.metrics[key] ?? 0), 0);
}

function weightedPace(workouts: WorkoutSession[], durationSeconds: number, distanceKm: number) {
  if (distanceKm > 0 && durationSeconds > 0) return durationSeconds / distanceKm;
  const recordedPaces = workouts
    .map((workout) => workout.metrics.paceSeconds)
    .filter((pace): pace is number => typeof pace === "number" && pace > 0);
  return recordedPaces.length > 0
    ? recordedPaces.reduce((total, pace) => total + pace, 0) / recordedPaces.length
    : 0;
}

function formatClock(seconds: number) {
  if (seconds <= 0) return "00:00";
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatPace(seconds: number) {
  if (seconds <= 0 || !Number.isFinite(seconds)) return "--'--\"";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}'${(rounded % 60).toString().padStart(2, "0")}"`;
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
    activityHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    activityDayCount: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
    activitySportTabs: { gap: 8, paddingTop: space[3], paddingBottom: space[3] },
    activitySportTab: {
      minHeight: 32,
      paddingHorizontal: 13,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    activitySportTabActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    activitySportTabText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10 },
    activitySportTabTextActive: { color: "#FFFFFF" },
    activitySportDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
    activitySportDotActive: { backgroundColor: "#FFFFFF" },
    activityRecordCard: { padding: space[5] },
    activitySportName: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 17,
      marginTop: 4,
    },
    activityPrimaryRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: space[4],
    },
    activityPrimaryLabel: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 10,
      letterSpacing: 0.4,
    },
    activityStartButton: {
      minHeight: 34,
      paddingHorizontal: 13,
      borderRadius: radius.full,
      backgroundColor: colors.hero,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    activityStartButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    cyclePanel: {
      marginTop: space[3],
      padding: space[3],
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      gap: space[2],
    },
    cycleHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cycleTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
    cycleCount: { color: colors.primary, fontFamily: fonts.bold, fontSize: 10 },
    cycleRow: { flexDirection: "row", gap: 7 },
    cycleCheck: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cycleCheckDone: { borderColor: colors.primary, backgroundColor: colors.primary },
    cycleCheckText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 9 },
    cycleCheckTextDone: { color: "#FFFFFF" },
    activityEmptyCard: {
      minHeight: 96,
      marginTop: space[3],
      padding: space[4],
      flexDirection: "row",
      alignItems: "center",
      gap: space[3],
    },
    activityEmptyMark: {
      width: 42,
      height: 42,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    activityEmptyMarkText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 20 },
    activityEmptyCopy: { flex: 1 },
    activityEmptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    activityEmptyText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    textLink: { color: colors.primary, fontFamily: fonts.bold, fontSize: 10 },
    activityRecordedRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    activityStateLabel: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 9,
      letterSpacing: 1,
      marginTop: space[3],
    },
    recordCountBadge: {
      marginTop: space[4],
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.full,
    },
    recordCountText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
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
    dashboardError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 11 },
    completionBanner: {
      padding: space[4],
      borderRadius: radius.xl,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      gap: 4,
    },
    completionBannerEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 9,
      letterSpacing: 1,
    },
    completionBannerText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 },
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
    routineGuide: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 15 },
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
    routineItemCopy: { flex: 1 },
    routineTarget: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 2 },
    routineButton: { marginTop: space[2] },
    noRoutineCard: { padding: space[5], gap: space[3] },
    noRoutineEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 9,
      letterSpacing: 1,
    },
    noRoutineTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    noRoutineText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
    viewAll: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
    sportGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
    sportButton: {
      width: "30%",
      flexGrow: 1,
      minHeight: 98,
      alignItems: "center",
      justifyContent: "center",
      gap: space[2],
      borderRadius: radius["2xl"],
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    sportButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    sportLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 },
    sportSelectedText: { color: "#FFFFFF" },
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
