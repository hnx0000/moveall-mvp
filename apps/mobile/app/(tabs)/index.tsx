import {
  sportLabels,
  type Medal,
  type Routine,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Defs, Image as SvgImage, Mask, Rect, Svg } from "react-native-svg";
import sportLogoSheet from "../../assets/images/sport-logo-sheet.jpg";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { LiveWorkoutRecorder } from "../../src/components/live-workout-recorder";
import { BellButton, Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import { markRecordGoalAchieved, readRecordGoals, workoutMeetsRecordGoal } from "../../src/goals";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { fonts, radius, shadows, space, typography, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";
import { sortWorkoutsForDisplay } from "../../src/workout-display";
import { aggregateSensorMetrics, formatSensorMetricLine } from "../../src/workout-metrics";

const homeSportOrder: SportType[] = [
  "running",
  "hiking",
  "cycling",
  "strength",
  "swimming",
  "diving",
];
const homeGpsSports: SportType[] = ["running", "hiking", "cycling", "swimming"];

const sportLogoIndex: Record<SportType, number> = {
  running: 0,
  hiking: 1,
  cycling: 2,
  strength: 3,
  swimming: 4,
  diving: 5,
};

const sportLogoSourceCell = 362;
const sportLogoCropSize = 350;
const sportLogoCenters: Record<SportType, { x: number; y: number }> = {
  running: { x: 199, y: 184 },
  hiking: { x: 209.5, y: 181 },
  cycling: { x: 205, y: 171.5 },
  strength: { x: 195, y: 194 },
  swimming: { x: 189.5, y: 181.5 },
  diving: { x: 179.5, y: 176.5 },
};

const workoutMetricEditFields: Record<
  SportType,
  { key: string; label: string; placeholder: string }[]
> = {
  running: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "5.12" },
    { key: "paceSeconds", label: "페이스 (초/km)", placeholder: "363" },
    { key: "calories", label: "칼로리 (kcal)", placeholder: "368" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "148" },
    { key: "maximumHeartRateBpm", label: "최대 심박수 (bpm)", placeholder: "174" },
    { key: "steps", label: "걸음", placeholder: "5210" },
    { key: "averageCadenceSpm", label: "평균 케이던스 (spm)", placeholder: "168" },
  ],
  hiking: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "6.42" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "126" },
    { key: "elevationGainM", label: "고도 상승 (m)", placeholder: "498" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "132" },
    { key: "maximumHeartRateBpm", label: "최대 심박수 (bpm)", placeholder: "158" },
    { key: "steps", label: "걸음", placeholder: "12340" },
  ],
  cycling: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "18.62" },
    { key: "averageSpeedKmh", label: "평균 속도 (km/h)", placeholder: "19.3" },
    { key: "calories", label: "칼로리 (kcal)", placeholder: "514" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "141" },
    { key: "maximumHeartRateBpm", label: "최대 심박수 (bpm)", placeholder: "169" },
  ],
  strength: [
    { key: "exerciseCount", label: "운동 수", placeholder: "5" },
    { key: "sets", label: "완료 세트", placeholder: "16" },
    { key: "volumeKg", label: "총 볼륨 (kg)", placeholder: "4280" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "128" },
    { key: "maximumHeartRateBpm", label: "최대 심박수 (bpm)", placeholder: "156" },
  ],
  swimming: [
    { key: "distanceM", label: "거리 (m)", placeholder: "1200" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "42" },
    { key: "laps", label: "랩 수", placeholder: "48" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "136" },
    { key: "totalStrokes", label: "총 스트로크", placeholder: "864" },
    { key: "averageSwolf", label: "평균 SWOLF", placeholder: "48" },
  ],
  diving: [
    { key: "maxDepthM", label: "최대 수심 (m)", placeholder: "18" },
    { key: "dynamicDistanceM", label: "다이나믹 (m)", placeholder: "42" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "55" },
    { key: "averageHeartRateBpm", label: "평균 심박수 (bpm)", placeholder: "112" },
    { key: "maximumHeartRateBpm", label: "최대 심박수 (bpm)", placeholder: "138" },
    { key: "waterTemperatureC", label: "수온 (°C)", placeholder: "27" },
  ],
};

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const loader = useCallback(() => api.sports(), []);
  const { data: sports, error, loading, reload } = useAsyncData(loader);
  const [routineProgress, setRoutineProgress] = useState<Record<string, number[]>>({});
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [savingRoutineId, setSavingRoutineId] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<SportType>("running");
  const [recordingSport, setRecordingSport] = useState<SportType | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editExertion, setEditExertion] = useState("5");
  const [editMetrics, setEditMetrics] = useState<Record<string, string>>({});
  const [pendingDeleteWorkout, setPendingDeleteWorkout] = useState<WorkoutSession | null>(null);
  const [recordActionError, setRecordActionError] = useState<string | null>(null);
  const [savingRecordAction, setSavingRecordAction] = useState(false);
  const [gpsReadiness, setGpsReadiness] = useState("GPS 상태 확인 중");
  const recordSportScrollRef = useRef<ScrollView>(null);
  const recordSportScrollOffsetRef = useRef(0);
  const recordSportDragOriginRef = useRef(0);
  const routineCelebrationAnimation = useRef(new Animated.Value(0)).current;
  const recordSportPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Platform.OS === "web" &&
          Math.abs(gesture.dx) > 6 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          recordSportDragOriginRef.current = recordSportScrollOffsetRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          recordSportScrollRef.current?.scrollTo({
            x: Math.max(0, recordSportDragOriginRef.current - gesture.dx),
            animated: false,
          });
        },
        onPanResponderRelease: () => undefined,
        onPanResponderTerminate: () => undefined,
      }),
    [],
  );

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
      readRecordGoals()
        .filter(
          (goal) =>
            !goal.achieved && nextWorkouts.some((workout) => workoutMeetsRecordGoal(goal, workout)),
        )
        .forEach((goal) => markRecordGoalAchieved(goal.id));
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void Promise.all([
        Location.hasServicesEnabledAsync(),
        Location.getForegroundPermissionsAsync(),
      ])
        .then(([servicesEnabled, permission]) => {
          if (!active) return;
          if (!servicesEnabled) setGpsReadiness("휴대폰 위치 서비스 꺼짐");
          else if (permission.granted) setGpsReadiness("휴대폰 GPS 준비됨 · 고정밀 위치 측정");
          else setGpsReadiness("기록 시작 시 GPS 권한 요청");
        })
        .catch(() => {
          if (active) setGpsReadiness("기록 시작 시 GPS 상태 확인");
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const todayWorkouts = useMemo(
    () => workouts.filter((workout) => isSameLocalDay(new Date(workout.endedAt), new Date())),
    [workouts],
  );
  const todayRoutines = useMemo(() => {
    const scheduled = routines.filter((routine) =>
      routine.daysOfWeek.includes(new Date().getDay()),
    );
    return scheduled.length ? scheduled : routines;
  }, [routines]);
  const completedTodayRoutineIds = useMemo(
    () =>
      new Set(
        todayWorkouts.flatMap((workout) =>
          todayRoutines
            .filter((routine) => workout.notes?.includes(`[routine:${routine.id}]`))
            .map((routine) => routine.id),
        ),
      ),
    [todayRoutines, todayWorkouts],
  );
  const selectedSportWorkouts = useMemo(
    () => todayWorkouts.filter((workout) => workout.sport === selectedSport),
    [selectedSport, todayWorkouts],
  );
  const activitySummary = useMemo(
    () => summarizeSportActivity(selectedSport, selectedSportWorkouts),
    [selectedSport, selectedSportWorkouts],
  );
  const selectedSportHistory = useMemo(
    () => sortWorkoutsForDisplay(workouts.filter((workout) => workout.sport === selectedSport)),
    [selectedSport, workouts],
  );

  useEffect(() => {
    if (!completionMessage) return undefined;
    routineCelebrationAnimation.setValue(0);
    const animation = Animated.spring(routineCelebrationAnimation, {
      toValue: 1,
      damping: 16,
      stiffness: 190,
      mass: 0.8,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [completionMessage, routineCelebrationAnimation]);

  function toggleStep(routineId: string, index: number) {
    setRoutineProgress((current) => {
      const completedSteps = current[routineId] ?? [];
      return {
        ...current,
        [routineId]: completedSteps.includes(index)
          ? completedSteps.filter((item) => item !== index)
          : [...completedSteps, index],
      };
    });
  }

  async function completeRoutine(routine: Routine) {
    const routineItems = [...routine.items].sort((left, right) => left.order - right.order);
    const completedSteps = routineProgress[routine.id] ?? [];
    if (
      !session ||
      savingRoutineId !== null ||
      routineItems.length === 0 ||
      completedSteps.length !== routineItems.length
    )
      return;
    setSavingRoutineId(routine.id);
    setDashboardError(null);
    try {
      const endedAt = new Date();
      const strengthTotals = strengthRoutineTotals(routineItems);
      const durationMinutes =
        routine.sport === "strength" && strengthTotals.minutes > 0
          ? strengthTotals.minutes
          : Math.max(10, routineItems.length * 10);
      const previouslyEarned = new Set(
        medals.filter((medal) => medal.earned).map((medal) => medal.id),
      );
      await api.createWorkoutSession(session.accessToken, {
        sport: routine.sport,
        startedAt: new Date(endedAt.getTime() - durationMinutes * 60_000).toISOString(),
        endedAt: endedAt.toISOString(),
        perceivedExertion: 6,
        notes: `[routine:${routine.id}] ${routine.title} 완료`,
        metrics: {
          routineCompletion: 1,
          calories: routineItems.length * 70,
          ...(routine.sport === "strength"
            ? {
                exerciseCount: routineItems.length,
                cycles: routineItems.length,
                sets: strengthTotals.sets || routineItems.length,
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
      const completionCount = nextWorkouts.filter((workout) =>
        workout.notes?.includes(`[routine:${routine.id}]`),
      ).length;
      const nextCompletionMessage = newMedal
        ? `${routine.title} ${completionCount}회 완료 · ${newMedal.title} 메달을 획득했습니다!`
        : `${routine.title} ${completionCount}회 완료`;
      setRoutineProgress((current) => {
        const next = { ...current };
        delete next[routine.id];
        return next;
      });
      setCompletionMessage(nextCompletionMessage);
    } catch {
      setDashboardError("루틴 완료 기록을 저장하지 못했습니다.");
    } finally {
      setSavingRoutineId(null);
    }
  }

  function beginWorkoutEdit(workout: WorkoutSession) {
    setPendingDeleteWorkout(null);
    setRecordActionError(null);
    setEditingWorkout(workout);
    setEditNotes(workout.notes ?? "");
    setEditExertion(String(workout.perceivedExertion));
    setEditMetrics(
      Object.fromEntries(
        workoutMetricEditFields[workout.sport].map((field) => [
          field.key,
          workout.metrics[field.key] === undefined ? "" : String(workout.metrics[field.key]),
        ]),
      ),
    );
  }

  async function saveWorkoutEdit() {
    if (!session || !editingWorkout || savingRecordAction) return;
    const perceivedExertion = Number(editExertion);
    if (!Number.isInteger(perceivedExertion) || perceivedExertion < 1 || perceivedExertion > 10) {
      setRecordActionError("운동 강도는 1부터 10 사이의 정수로 입력해 주세요.");
      return;
    }
    const nextMetrics = { ...editingWorkout.metrics };
    for (const field of workoutMetricEditFields[editingWorkout.sport]) {
      const rawValue = editMetrics[field.key]?.trim() ?? "";
      if (!rawValue) {
        delete nextMetrics[field.key];
        continue;
      }
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        setRecordActionError(`${field.label} 항목에 0 이상의 숫자를 입력해 주세요.`);
        return;
      }
      nextMetrics[field.key] = numericValue;
    }
    setSavingRecordAction(true);
    setRecordActionError(null);
    try {
      const updated = await api.updateWorkoutSession(session.accessToken, editingWorkout.id, {
        notes: editNotes.trim() || null,
        perceivedExertion,
        metrics: nextMetrics,
      });
      setWorkouts((current) =>
        current.map((workout) => (workout.id === updated.id ? updated : workout)),
      );
      setEditingWorkout(null);
    } catch {
      setRecordActionError("운동 기록을 수정하지 못했습니다.");
    } finally {
      setSavingRecordAction(false);
    }
  }

  async function deleteWorkout() {
    if (!session || !pendingDeleteWorkout || savingRecordAction) return;
    setSavingRecordAction(true);
    setRecordActionError(null);
    try {
      await api.deleteWorkoutSession(session.accessToken, pendingDeleteWorkout.id);
      const nextMedals = await api.medals(session.accessToken);
      setWorkouts((current) => current.filter((workout) => workout.id !== pendingDeleteWorkout.id));
      setMedals(nextMedals);
      setPendingDeleteWorkout(null);
    } catch {
      setRecordActionError("운동 기록을 제거하지 못했습니다.");
    } finally {
      setSavingRecordAction(false);
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
          <View>
            <Text style={styles.homeSectionEyebrow}>TODAY'S ACTIVITY</Text>
            <Text style={styles.kicker}>오늘의 활동</Text>
          </View>
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
                    accessibilityLabel={`${sportLabels[sport]} 기록 보기`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    disabled={recordingSport !== null}
                    key={sport}
                    onPress={(event) => {
                      if (Platform.OS === "web") {
                        (
                          event.currentTarget as unknown as {
                            blur?: () => void;
                          }
                        ).blur?.();
                      }
                      setSelectedSport(sport);
                    }}
                    style={[
                      styles.activitySportIconTab,
                      active && styles.activitySportIconTabActive,
                      recordingSport !== null && styles.recordingSelectionLocked,
                    ]}
                  >
                    <View style={styles.activitySportIconFrame}>
                      <SportLogo selected={active} size={27} sport={sport} />
                    </View>
                    {count > 0 ? (
                      <View
                        style={[
                          styles.activitySportCount,
                          active && styles.activitySportCountActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.activitySportCountText,
                            active && styles.activitySportCountTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
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

              <View style={styles.activityGpsInfo}>
                <MapPin color={colors.primary} size={14} />
                <View style={styles.activityGpsCopy}>
                  <Text style={styles.activityGpsTitle}>
                    {homeGpsSports.includes(selectedSport) ? "GPS 정보" : "타이머 기록"}
                  </Text>
                  <Text style={styles.activityGpsText}>
                    {homeGpsSports.includes(selectedSport)
                      ? gpsReadiness
                      : `${sportLabels[selectedSport]}은 운동시간과 수행 항목을 중심으로 기록합니다.`}
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
                  disabled={recordingSport !== null}
                  onPress={() => setRecordingSport(selectedSport)}
                  style={[
                    styles.activityStartButton,
                    recordingSport !== null && styles.activityStartButtonDisabled,
                  ]}
                >
                  <Text style={styles.activityStartButtonText}>
                    {recordingSport === selectedSport
                      ? "기록 중"
                      : selectedSportWorkouts.length > 0
                        ? "추가 기록"
                        : "기록 시작"}
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
                {activitySummary.metrics.map((metric, index) =>
                  metric.hidden ? (
                    <View key={`metric-spacer-${index}`} style={styles.metric} />
                  ) : (
                    <Metric
                      align={index % 3 === 2 ? "right" : "left"}
                      colors={colors}
                      key={`${metric.label}-${index}`}
                      label={metric.label}
                      value={metric.value}
                    />
                  ),
                )}
              </View>

              {recordingSport === selectedSport ? (
                <LiveWorkoutRecorder
                  history={workouts}
                  onClose={() => setRecordingSport(null)}
                  onSaved={async () => {
                    setRecordingSport(null);
                    await loadDashboard();
                  }}
                  routines={routines}
                  sport={recordingSport}
                />
              ) : null}
            </Card>
          </>
        )}
      </View>

      {dashboardError ? <Text style={styles.dashboardError}>{dashboardError}</Text> : null}

      <Modal
        animationType="none"
        onRequestClose={() => setCompletionMessage(null)}
        transparent
        visible={completionMessage !== null}
      >
        {completionMessage ? (
          <View accessibilityLiveRegion="assertive" style={styles.routineCelebrationBackdrop}>
            <Animated.View
              style={[
                styles.routineCelebrationCopy,
                {
                  opacity: routineCelebrationAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                  transform: [
                    {
                      translateY: routineCelebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                    {
                      scale: routineCelebrationAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.88, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.routineCelebrationEyebrow}>ROUTINE COMPLETE</Text>
              <Text style={styles.routineCelebrationMessage}>{completionMessage}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setCompletionMessage(null)}
                style={styles.routineCelebrationConfirm}
              >
                <Text style={styles.routineCelebrationConfirmText}>확인</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : null}
      </Modal>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.homeSectionEyebrow}>TODAY'S ROUTINE</Text>
          <Text style={styles.sectionTitle}>오늘의 루틴</Text>
        </View>
      </View>
      {todayRoutines.length ? (
        <View style={styles.todayRoutineStack}>
          {todayRoutines.map((routine) => {
            const routineItems = [...routine.items].sort((left, right) => left.order - right.order);
            const completedSteps = routineProgress[routine.id] ?? [];
            const completedToday = completedTodayRoutineIds.has(routine.id);
            const completionCount = workouts.filter((workout) =>
              workout.notes?.includes(`[routine:${routine.id}]`),
            ).length;
            return (
              <Card
                key={routine.id}
                style={[styles.routineCard, completedToday && styles.routineCardCompleted]}
              >
                <View style={styles.sectionHeading}>
                  <Text style={styles.routineType}>{sportLabels[routine.sport].toUpperCase()}</Text>
                  <View style={styles.counter}>
                    <Text style={styles.counterText}>
                      {completedToday
                        ? "오늘 완료"
                        : completedSteps.length > 0
                          ? `${completedSteps.length}/${routineItems.length}`
                          : `${completionCount}회`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.routineTitle}>{routine.title}</Text>
                <Text style={styles.routineGuide}>
                  {completedToday
                    ? "오늘 루틴을 완료했습니다. 내일 다시 실행할 수 있습니다."
                    : "시작 절차 없이 항목을 바로 체크하세요. 완료 기록은 기록과 메달에 반영됩니다."}
                </Text>
                <View style={styles.routineList}>
                  {routineItems.map((item, index) => {
                    const isDone = completedToday || completedSteps.includes(index);
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isDone, disabled: completedToday }}
                        disabled={completedToday || savingRoutineId !== null}
                        key={`${item.order}-${item.name}`}
                        onPress={() => toggleStep(routine.id, index)}
                        style={({ pressed }) => [styles.routineItem, pressed && styles.pressed]}
                      >
                        <View style={[styles.stepNumber, isDone && styles.stepNumberDone]}>
                          <Text
                            style={[styles.stepNumberText, isDone && styles.stepNumberTextDone]}
                          >
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
                    completedToday ||
                    savingRoutineId !== null ||
                    routineItems.length === 0 ||
                    completedSteps.length !== routineItems.length
                  }
                  label={
                    completedToday
                      ? "오늘 완료됨"
                      : savingRoutineId === routine.id
                        ? "완료 기록 중"
                        : completedSteps.length === routineItems.length && routineItems.length > 0
                          ? "루틴 완료 기록하기"
                          : `${completedSteps.length}/${routineItems.length} 체크`
                  }
                  onPress={() => void completeRoutine(routine)}
                  style={styles.routineButton}
                />
              </Card>
            );
          })}
        </View>
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
        <View>
          <Text style={styles.homeSectionEyebrow}>ACTIVITY RECORDS</Text>
          <Text style={styles.sectionTitle}>기록</Text>
        </View>
      </View>
      {loading ? <StatePanel state="loading" message="운동 종목을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {sports ? (
        <View {...recordSportPanResponder.panHandlers} style={styles.recordSportDragSurface}>
          <ScrollView
            accessibilityHint="좌우로 드래그해 다른 운동 종목을 볼 수 있습니다."
            contentContainerStyle={styles.activitySportTabs}
            horizontal
            onScroll={(event) => {
              recordSportScrollOffsetRef.current = event.nativeEvent.contentOffset.x;
            }}
            ref={recordSportScrollRef}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
          >
            {homeSportOrder
              .map((sportId) => sports.find((sport) => sport.id === sportId))
              .filter((sport) => sport !== undefined)
              .map((sport) => {
                const selected = selectedSport === sport.id;
                const hasRecords = workouts.some((workout) => workout.sport === sport.id);
                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    disabled={recordingSport !== null}
                    key={sport.id}
                    onPress={() => setSelectedSport(sport.id)}
                    style={[
                      styles.activitySportTab,
                      selected && styles.activitySportTabActive,
                      recordingSport !== null && styles.recordingSelectionLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.activitySportTabText,
                        selected && styles.activitySportTabTextActive,
                      ]}
                    >
                      {sport.label}
                    </Text>
                    {hasRecords ? (
                      <View
                        style={[styles.activitySportDot, selected && styles.activitySportDotActive]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.historySection}>
        <View style={styles.historyHeading}>
          <View>
            <Text style={styles.historyEyebrow}>ACTIVITY ARCHIVE</Text>
            <Text style={styles.historyTitle}>{sportLabels[selectedSport]} 이전 기록</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: "/profile/sport", params: { sport: selectedSport } })
            }
          >
            <Text style={styles.historyViewAll}>전체 {selectedSportHistory.length}개 보기 →</Text>
          </Pressable>
        </View>

        {selectedSportHistory.length === 0 ? (
          <Card style={styles.historyEmptyCard}>
            <Text style={styles.historyEmptyTitle}>
              아직 {sportLabels[selectedSport]} 기록이 없습니다.
            </Text>
            <Text style={styles.historyEmptyText}>
              첫 기록을 남기면 날짜와 핵심 지표가 여기에 쌓입니다.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: "/routines", params: { sport: selectedSport } })
              }
              style={styles.historyStartButton}
            >
              <Text style={styles.historyStartButtonText}>첫 기록 시작</Text>
            </Pressable>
          </Card>
        ) : (
          <View style={styles.historyList}>
            {selectedSportHistory.slice(0, 4).map((workout, index) => {
              return (
                <SwipeableWorkoutRow
                  index={index}
                  key={workout.id}
                  onDelete={() => {
                    setEditingWorkout(null);
                    setRecordActionError(null);
                    setPendingDeleteWorkout(workout);
                  }}
                  onEdit={() => beginWorkoutEdit(workout)}
                  workout={workout}
                />
              );
            })}
          </View>
        )}

        {editingWorkout ? (
          <Card style={styles.recordEditor}>
            <View style={styles.recordEditorHeading}>
              <View>
                <Text style={styles.recordEditorEyebrow}>EDIT RECORD</Text>
                <Text style={styles.recordEditorTitle}>
                  {sportLabels[editingWorkout.sport]} 기록 수정
                </Text>
              </View>
              <Text style={styles.recordEditorDate}>
                {formatHistoryDate(editingWorkout.endedAt)}
              </Text>
            </View>
            <Text style={styles.recordEditorLabel}>운동 메모</Text>
            <TextInput
              accessibilityLabel="운동 기록 메모"
              maxLength={1000}
              multiline
              onChangeText={setEditNotes}
              placeholder="운동 내용과 컨디션을 남겨보세요."
              placeholderTextColor={colors.muted}
              style={styles.recordEditorInput}
              value={editNotes}
            />
            <View style={styles.recordMetricGrid}>
              {workoutMetricEditFields[editingWorkout.sport].map((field) => (
                <View key={field.key} style={styles.recordMetricField}>
                  <Text style={styles.recordEditorLabel}>{field.label}</Text>
                  <TextInput
                    accessibilityLabel={field.label}
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setEditMetrics((current) => ({ ...current, [field.key]: value }))
                    }
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.muted}
                    style={styles.recordMetricInput}
                    value={editMetrics[field.key] ?? ""}
                  />
                </View>
              ))}
              <View style={styles.recordMetricField}>
                <Text style={styles.recordEditorLabel}>운동 강도 (1–10)</Text>
                <TextInput
                  accessibilityLabel="운동 강도"
                  keyboardType="number-pad"
                  maxLength={2}
                  onChangeText={setEditExertion}
                  placeholder="5"
                  placeholderTextColor={colors.muted}
                  style={styles.recordMetricInput}
                  value={editExertion}
                />
              </View>
            </View>
            <View style={styles.recordEditorActions}>
              <Pressable
                accessibilityRole="button"
                disabled={savingRecordAction}
                onPress={() => setEditingWorkout(null)}
                style={[styles.recordSecondaryButton, savingRecordAction && styles.actionDisabled]}
              >
                <Text style={styles.recordSecondaryButtonText}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingRecordAction}
                onPress={() => void saveWorkoutEdit()}
                style={[styles.recordSaveButton, savingRecordAction && styles.actionDisabled]}
              >
                <Text style={styles.recordSaveButtonText}>
                  {savingRecordAction ? "저장 중" : "수정 저장"}
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        <Modal
          animationType="fade"
          onRequestClose={() => {
            if (!savingRecordAction) setPendingDeleteWorkout(null);
          }}
          transparent
          visible={pendingDeleteWorkout !== null}
        >
          <View style={styles.recordDeleteBackdrop}>
            <View style={styles.recordDeleteConfirm}>
              <Text style={styles.recordDeleteEyebrow}>DELETE RECORD</Text>
              <Text style={styles.recordDeleteTitle}>이 기록을 제거할까요?</Text>
              <Text numberOfLines={2} style={styles.recordDeleteText}>
                {pendingDeleteWorkout
                  ? `${formatHistoryDate(pendingDeleteWorkout.endedAt)} · ${pendingDeleteWorkout.notes ?? sportLabels[pendingDeleteWorkout.sport]}`
                  : ""}
              </Text>
              <Text style={styles.recordDeleteWarning}>제거한 기록은 다시 복구할 수 없습니다.</Text>
              {recordActionError ? (
                <Text style={styles.recordActionError}>{recordActionError}</Text>
              ) : null}
              <View style={styles.recordDeleteActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingRecordAction}
                  onPress={() => setPendingDeleteWorkout(null)}
                  style={[styles.recordDeleteCancel, savingRecordAction && styles.actionDisabled]}
                >
                  <Text style={styles.recordDeleteCancelText}>취소</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingRecordAction}
                  onPress={() => void deleteWorkout()}
                  style={[styles.recordDeleteButton, savingRecordAction && styles.actionDisabled]}
                >
                  <Text style={styles.recordDeleteButtonText}>
                    {savingRecordAction ? "제거 중" : "기록 제거"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {recordActionError && !pendingDeleteWorkout ? (
          <Text style={styles.recordActionError}>{recordActionError}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const workoutActionWidth = 132;

function SwipeableWorkoutRow({
  workout,
  index,
  onEdit,
  onDelete,
}: {
  workout: WorkoutSession;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragOrigin = useRef(0);
  const [open, setOpen] = useState(false);
  const summary = summarizeSportActivity(workout.sport, [workout]);

  const settle = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      Animated.spring(translateX, {
        toValue: nextOpen ? -workoutActionWidth : 0,
        useNativeDriver: Platform.OS !== "web",
        damping: 22,
        stiffness: 240,
        mass: 0.8,
      }).start();
    },
    [translateX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragOrigin.current = open ? -workoutActionWidth : 0;
          translateX.stopAnimation();
        },
        onPanResponderMove: (_event, gesture) => {
          translateX.setValue(
            Math.max(-workoutActionWidth, Math.min(0, dragOrigin.current + gesture.dx)),
          );
        },
        onPanResponderRelease: (_event, gesture) => {
          const position = dragOrigin.current + gesture.dx;
          settle(position < -workoutActionWidth * 0.38 || gesture.vx < -0.45);
        },
        onPanResponderTerminate: () => settle(open),
      }),
    [open, settle, translateX],
  );

  return (
    <View style={styles.historySwipeShell}>
      <View style={[styles.historyActions, { pointerEvents: open ? "auto" : "none" }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            settle(false);
            onEdit();
          }}
          style={[styles.historyActionButton, styles.historyEditButton]}
        >
          <Text style={styles.historyActionText}>수정</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            settle(false);
            onDelete();
          }}
          style={[styles.historyActionButton, styles.historyRemoveButton]}
        >
          <Text style={styles.historyActionText}>제거</Text>
        </Pressable>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        <Pressable
          accessibilityHint="왼쪽으로 밀면 수정과 제거 버튼이 열립니다."
          accessibilityLabel={`${sportLabels[workout.sport]} 기록 관리`}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => settle(!open)}
          style={styles.historyCard}
        >
          <View style={styles.historyIndex}>
            <Text style={styles.historyIndexText}>{String(index + 1).padStart(2, "0")}</Text>
          </View>
          <View style={styles.historyBody}>
            <Text style={styles.historyDate}>{formatHistoryDate(workout.endedAt)}</Text>
            <Text numberOfLines={1} style={styles.historyNote}>
              {workout.notes ?? `${sportLabels[workout.sport]} 운동 기록`}
            </Text>
            <Text style={styles.historySubMetric}>
              {summary.metrics
                .slice(0, 2)
                .map((metric) => `${metric.label} ${metric.value}`)
                .join(" · ")}
            </Text>
            <Text style={styles.historySensorMetric}>{formatSensorMetricLine(workout)}</Text>
          </View>
          <View style={styles.historyPrimary}>
            <Text style={styles.historyPrimaryLabel}>{summary.primaryLabel}</Text>
            <Text style={styles.historyPrimaryValue}>
              {summary.primaryValue}
              {summary.primaryUnit ? ` ${summary.primaryUnit}` : ""}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
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

function SportLogo({
  selected,
  sport,
  size = 48,
}: {
  selected: boolean;
  sport: SportType;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const cell = size;
  const maskId = `sport-logo-${sport}`;
  const sourceCenter = sportLogoCenters[sport];
  const sourceX = sportLogoIndex[sport] * sportLogoSourceCell + sourceCenter.x;
  const sourceY = sourceCenter.y;
  const activeWeightOffsets = selected
    ? [
        { x: 0, y: 0 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: -2 },
        { x: 0, y: 2 },
      ]
    : [{ x: 0, y: 0 }];

  if (sport === "strength") {
    const iconColor = selected ? "#FFFFFF" : colors.ink;
    const strokeWidth = selected ? 1.2 : 0.85;
    const barHeight = selected ? 1.3 : 0.95;
    return (
      <Svg height={cell} viewBox="0 0 28 28" width={cell}>
        <Rect
          fill="none"
          height={8}
          rx={1.4}
          stroke={iconColor}
          strokeWidth={strokeWidth}
          width={3}
          x={2}
          y={10}
        />
        <Rect
          fill="none"
          height={14}
          rx={1.8}
          stroke={iconColor}
          strokeWidth={strokeWidth}
          width={4}
          x={5.5}
          y={7}
        />
        <Rect
          fill={iconColor}
          height={barHeight}
          rx={barHeight / 2}
          width={9}
          x={9.5}
          y={14 - barHeight / 2}
        />
        <Rect
          fill="none"
          height={14}
          rx={1.8}
          stroke={iconColor}
          strokeWidth={strokeWidth}
          width={4}
          x={18.5}
          y={7}
        />
        <Rect
          fill="none"
          height={8}
          rx={1.4}
          stroke={iconColor}
          strokeWidth={strokeWidth}
          width={3}
          x={23}
          y={10}
        />
      </Svg>
    );
  }

  return (
    <Svg height={cell} viewBox={`0 0 ${sportLogoCropSize} ${sportLogoCropSize}`} width={cell}>
      <Defs>
        {activeWeightOffsets.map((offset, index) => (
          <Mask
            height={sportLogoCropSize}
            id={`${maskId}-${index}`}
            key={`${offset.x}-${offset.y}`}
            maskContentUnits="userSpaceOnUse"
            maskUnits="userSpaceOnUse"
            width={sportLogoCropSize}
            x={0}
            y={0}
          >
            <SvgImage
              height={sportLogoSourceCell * 2}
              href={sportLogoSheet}
              preserveAspectRatio="none"
              width={sportLogoSourceCell * 6}
              x={-(sourceX - sportLogoCropSize / 2) + offset.x}
              y={-(sourceY - sportLogoCropSize / 2) + offset.y}
            />
            <Rect
              fill="#000000"
              height={30}
              width={sportLogoCropSize}
              x={0}
              y={sportLogoCropSize - 30}
            />
          </Mask>
        ))}
      </Defs>
      {activeWeightOffsets.map((offset, index) => (
        <Rect
          fill={selected ? "#FFFFFF" : colors.ink}
          height={sportLogoCropSize}
          key={`${offset.x}-${offset.y}`}
          mask={`url(#${maskId}-${index})`}
          width={sportLogoCropSize}
        />
      ))}
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

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type SportActivitySummary = {
  primaryLabel: string;
  primaryValue: string;
  primaryUnit: string;
  metrics: Array<{ label: string; value: string; hidden?: boolean }>;
  cycles?: { completed: number; total: number };
};

function summarizeSportActivity(
  sport: SportType,
  workouts: WorkoutSession[],
): SportActivitySummary {
  const durationSeconds = workouts.reduce((total, workout) => total + workoutDuration(workout), 0);
  const distanceKm = sumMetric(workouts, "distanceKm");
  const calories = Math.round(sumMetric(workouts, "calories"));
  const sensorMetrics = aggregateSensorMetrics(workouts, sport);
  const sensorValue = (label: string) =>
    sensorMetrics.find((metric) => metric.label === label)?.value ??
    (label.includes("심박") ? "0 bpm" : "0");

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
        { label: "평균 심박수", value: sensorValue("평균 심박수") },
        { label: "최대 심박수", value: sensorValue("최대 심박수") },
        { label: "걸음", value: sensorValue("걸음") },
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
        { label: "평균 심박수", value: sensorValue("평균 심박수") },
        { label: "최대 심박수", value: sensorValue("최대 심박수") },
        { label: "", value: "", hidden: true },
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
        { label: "걸음", value: sensorValue("걸음") },
        { label: "소모", value: `${calories} kcal` },
        { label: "평균 심박수", value: sensorValue("평균 심박수") },
        { label: "최대 심박수", value: sensorValue("최대 심박수") },
        { label: "누적 고도", value: `${Math.round(sumMetric(workouts, "elevationGainM"))} m` },
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
        { label: "평균 심박수", value: sensorValue("평균 심박수") },
        { label: "총 스트로크", value: sensorValue("총 스트로크") },
        { label: "평균 SWOLF", value: sensorValue("평균 SWOLF") },
      ],
    };
  }

  if (sport === "diving") {
    const depthValues = workouts
      .map((workout) => workout.metrics.maxDepthM ?? 0)
      .filter((value) => value > 0);
    const dynamicValues = workouts
      .map((workout) => workout.metrics.dynamicDistanceM ?? 0)
      .filter((value) => value > 0);
    const averageDepth = averageMetricValues(depthValues);
    const depthPb = depthValues.length ? Math.max(...depthValues) : 0;
    const averageDynamic = averageMetricValues(dynamicValues);
    const dynamicPb = dynamicValues.length ? Math.max(...dynamicValues) : 0;
    const depthSessions = workouts.filter((workout) => (workout.metrics.maxDepthM ?? 0) > 0).length;
    const dynamicSessions = workouts.filter(
      (workout) => (workout.metrics.dynamicDistanceM ?? 0) > 0,
    ).length;
    return {
      primaryLabel: "다이빙 시간",
      primaryValue: formatClock(durationSeconds),
      primaryUnit: "",
      metrics: [
        { label: "평균 DEPTH", value: `${averageDepth.toFixed(1)} m` },
        { label: "PB", value: `${depthPb.toFixed(1)} m` },
        { label: "세션", value: `${depthSessions}회` },
        { label: "평균 DYNAMIC", value: `${Math.round(averageDynamic)} m` },
        { label: "PB", value: `${Math.round(dynamicPb)} m` },
        { label: "세션", value: `${dynamicSessions}회` },
        { label: "평균 심박수", value: sensorValue("평균 심박수") },
        { label: "최대 심박수", value: sensorValue("최대 심박수") },
        { label: "수온", value: sensorValue("수온") },
      ],
    };
  }

  const recordedExerciseCount = Math.round(sumMetric(workouts, "exerciseCount"));
  const exerciseCount = recordedExerciseCount > 0 ? recordedExerciseCount : workouts.length;
  return {
    primaryLabel: "운동 시간",
    primaryValue: formatClock(durationSeconds),
    primaryUnit: "",
    metrics: [
      { label: "완료 종목", value: `${exerciseCount}` },
      { label: "완료 세트", value: `${Math.round(sumMetric(workouts, "sets"))} set` },
      { label: "소모", value: `${calories} kcal` },
      { label: "평균 심박수", value: sensorValue("평균 심박수") },
      { label: "최대 심박수", value: sensorValue("최대 심박수") },
      { label: "볼륨", value: `${Math.round(sumMetric(workouts, "volumeKg"))} kg` },
    ],
  };
}

function averageMetricValues(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function workoutDuration(workout: WorkoutSession) {
  const elapsed = (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000;
  return Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
}

function strengthRoutineTotals(items: Routine["items"]) {
  return items.reduce(
    (totals, item) => {
      const sets = Math.max(
        1,
        Math.round(Number(item.target.match(/(\d+(?:\.\d+)?)\s*세트/)?.[1] ?? 1)),
      );
      const estimatedMinutes = Number(item.target.match(/예상\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? 0);
      const restMinutes = Number(item.target.match(/휴식\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? 0);
      return {
        sets: totals.sets + sets,
        minutes: totals.minutes + estimatedMinutes + restMinutes * Math.max(0, sets - 1),
      };
    },
    { sets: 0, minutes: 0 },
  );
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
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const remainingSeconds = Math.floor((centiseconds % 6_000) / 100);
  const hundredths = centiseconds % 100;
  return [hours, minutes, remainingSeconds, hundredths]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatPace(seconds: number) {
  if (seconds <= 0 || !Number.isFinite(seconds)) return "--/--";
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
    homeSectionEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1,
      marginBottom: 4,
    },
    kicker: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    activityHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    activityDayCount: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
    recordSportDragSurface: { width: "100%", overflow: "hidden" },
    activitySportTabs: { gap: 8, paddingTop: space[3], paddingBottom: space[3] },
    activitySportIconTab: {
      width: 46,
      height: 46,
      padding: 0,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      outlineColor: "transparent",
      outlineWidth: 0,
    },
    activitySportIconFrame: {
      width: 27,
      height: 27,
      alignItems: "center",
      justifyContent: "center",
    },
    activitySportIconTabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    activitySportCount: {
      position: "absolute",
      top: -2,
      right: -1,
      minWidth: 15,
      height: 15,
      paddingHorizontal: 3,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.ink,
      borderWidth: 2,
      borderColor: colors.background,
    },
    activitySportCountActive: { backgroundColor: "#FFFFFF", borderColor: colors.primary },
    activitySportCountText: { color: colors.background, fontFamily: fonts.bold, fontSize: 6 },
    activitySportCountTextActive: { color: colors.primary },
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
    recordingSelectionLocked: { opacity: 0.55 },
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
    activityStartButtonDisabled: { opacity: 0.7 },
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
    activityGpsInfo: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: space[3],
      paddingHorizontal: 11,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    activityGpsCopy: { flex: 1 },
    activityGpsTitle: { color: colors.primary, fontFamily: fonts.bold, fontSize: 8 },
    activityGpsText: {
      color: colors.ink,
      fontFamily: fonts.medium,
      fontSize: 8,
      marginTop: 2,
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
    distance: { ...typography.numeric(36), color: colors.ink, lineHeight: 44 },
    unit: {
      color: colors.muted,
      fontFamily: fonts.bold,
      fontSize: 15,
      marginLeft: 6,
      marginBottom: 5,
    },
    metrics: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
      marginTop: space[4],
      paddingTop: space[4],
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metric: { width: "30%", flexGrow: 0, flexShrink: 0 },
    metricRight: { alignItems: "flex-end" },
    metricValue: { ...typography.numeric(19), color: colors.ink },
    metricLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, marginTop: 4 },
    sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    dashboardError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 11 },
    routineCelebrationBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(8,7,6,0.9)",
      paddingHorizontal: 34,
    },
    routineCelebrationCopy: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },
    routineCelebrationEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayItalic,
      fontSize: 13,
      letterSpacing: 2.4,
      textAlign: "center",
    },
    routineCelebrationMessage: {
      maxWidth: 330,
      color: "#FFFFFF",
      fontFamily: fonts.bold,
      fontSize: 22,
      lineHeight: 33,
      letterSpacing: -0.7,
      textAlign: "center",
      textShadowColor: "rgba(0,0,0,0.55)",
      textShadowOffset: { width: 0, height: 3 },
      textShadowRadius: 12,
    },
    routineCelebrationConfirm: {
      minWidth: 128,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      marginTop: 10,
      paddingHorizontal: 28,
    },
    routineCelebrationConfirmText: {
      color: "#FFFFFF",
      fontFamily: fonts.bold,
      fontSize: 12,
    },
    counter: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    counterText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
    todayRoutineStack: { gap: space[3] },
    routineCard: { padding: space[5], gap: space[3] },
    routineCardCompleted: { opacity: 0.52 },
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
    historySection: { gap: space[3], marginTop: space[2] },
    historyHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    historyEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1,
    },
    historyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: 4 },
    historyViewAll: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 9 },
    historyEmptyCard: { padding: space[5], gap: space[2] },
    historyEmptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    historyEmptyText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 16,
    },
    historyStartButton: {
      minHeight: 38,
      marginTop: space[2],
      borderRadius: radius.full,
      backgroundColor: colors.hero,
      alignItems: "center",
      justifyContent: "center",
    },
    historyStartButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    historyList: { borderTopWidth: 1, borderTopColor: colors.border, overflow: "hidden" },
    historySwipeShell: {
      minHeight: 86,
      overflow: "hidden",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    historyActions: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: workoutActionWidth,
      flexDirection: "row",
    },
    historyActionButton: { flex: 1, alignItems: "center", justifyContent: "center" },
    historyEditButton: { backgroundColor: "#282320" },
    historyRemoveButton: { backgroundColor: colors.primary },
    historyActionText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 11 },
    historyCard: {
      minHeight: 86,
      flexDirection: "row",
      alignItems: "center",
      gap: space[3],
      paddingVertical: space[3],
      paddingHorizontal: 2,
      backgroundColor: colors.background,
    },
    historyIndex: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    historyIndexText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    historyBody: { flex: 1, minWidth: 0 },
    historyDate: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
    historyNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 4 },
    historySubMetric: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8, marginTop: 4 },
    historySensorMetric: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 8,
      marginTop: 4,
    },
    historyPrimary: { alignItems: "flex-end", maxWidth: 120 },
    historyPrimaryLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8 },
    historyPrimaryValue: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 14,
      marginTop: 4,
    },
    recordEditor: { padding: space[4], gap: space[3] },
    recordEditorHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: space[3],
    },
    recordEditorEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1,
    },
    recordEditorTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, marginTop: 4 },
    recordEditorDate: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8 },
    recordEditorLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 10 },
    recordEditorInput: {
      minHeight: 88,
      paddingHorizontal: space[3],
      paddingVertical: space[3],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      color: colors.ink,
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 17,
      textAlignVertical: "top",
    },
    recordMetricGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
    recordMetricField: { width: "47%", flexGrow: 1, gap: 5 },
    recordMetricInput: {
      minHeight: 42,
      paddingHorizontal: space[3],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 11,
    },
    recordEditorActions: { flexDirection: "row", gap: space[2] },
    recordSecondaryButton: {
      minHeight: 40,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
    },
    recordSecondaryButtonText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    recordSaveButton: {
      minHeight: 40,
      flex: 2,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    recordSaveButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    recordDeleteBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: space[5],
      backgroundColor: "rgba(0, 0, 0, 0.72)",
    },
    recordDeleteConfirm: {
      width: "100%",
      maxWidth: 390,
      padding: space[5],
      gap: space[3],
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    recordDeleteEyebrow: {
      color: colors.danger,
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 1,
    },
    recordDeleteTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 19 },
    recordDeleteText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 16,
    },
    recordDeleteWarning: { color: colors.danger, fontFamily: fonts.medium, fontSize: 9 },
    recordDeleteActions: { flexDirection: "row", alignItems: "center", gap: space[2] },
    recordDeleteCancel: {
      minHeight: 42,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
    },
    recordDeleteCancelText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    recordDeleteButton: {
      minHeight: 42,
      flex: 1.4,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
      backgroundColor: colors.danger,
    },
    recordDeleteButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    recordActionError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 10 },
    actionDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.72 },
  });
}
