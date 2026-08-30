import {
  sportLabels,
  type Medal,
  type Routine,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
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
import { BellButton, Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { fonts, radius, shadows, space, typography, type ThemeColors } from "../../src/theme";
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

const workoutMetricEditFields: Record<
  SportType,
  { key: string; label: string; placeholder: string }[]
> = {
  running: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "5.12" },
    { key: "paceSeconds", label: "페이스 (초/km)", placeholder: "363" },
    { key: "calories", label: "칼로리 (kcal)", placeholder: "368" },
  ],
  hiking: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "6.42" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "126" },
    { key: "elevationGainM", label: "고도 상승 (m)", placeholder: "498" },
  ],
  cycling: [
    { key: "distanceKm", label: "거리 (km)", placeholder: "18.62" },
    { key: "averageSpeedKmh", label: "평균 속도 (km/h)", placeholder: "19.3" },
    { key: "calories", label: "칼로리 (kcal)", placeholder: "514" },
  ],
  strength: [
    { key: "exerciseCount", label: "운동 수", placeholder: "5" },
    { key: "sets", label: "완료 세트", placeholder: "16" },
    { key: "volumeKg", label: "총 볼륨 (kg)", placeholder: "4280" },
  ],
  swimming: [
    { key: "distanceM", label: "거리 (m)", placeholder: "1200" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "42" },
    { key: "laps", label: "랩 수", placeholder: "48" },
  ],
  diving: [
    { key: "maxDepthM", label: "최대 수심 (m)", placeholder: "18" },
    { key: "dynamicDistanceM", label: "다이나믹 (m)", placeholder: "42" },
    { key: "durationMinutes", label: "시간 (분)", placeholder: "55" },
  ],
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
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editExertion, setEditExertion] = useState("5");
  const [editMetrics, setEditMetrics] = useState<Record<string, string>>({});
  const [pendingDeleteWorkout, setPendingDeleteWorkout] = useState<WorkoutSession | null>(null);
  const [recordActionError, setRecordActionError] = useState<string | null>(null);
  const [savingRecordAction, setSavingRecordAction] = useState(false);

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
  const selectedSportHistory = useMemo(
    () =>
      workouts
        .filter((workout) => workout.sport === selectedSport)
        .sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt)),
    [selectedSport, workouts],
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
        <Text style={styles.sectionTitle}>기록</Text>
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

        {pendingDeleteWorkout ? (
          <Card style={styles.recordDeleteConfirm}>
            <View style={styles.recordDeleteCopy}>
              <Text style={styles.recordDeleteTitle}>이 기록을 제거할까요?</Text>
              <Text numberOfLines={1} style={styles.recordDeleteText}>
                {pendingDeleteWorkout.notes ?? sportLabels[pendingDeleteWorkout.sport]}
              </Text>
            </View>
            <View style={styles.recordDeleteActions}>
              <Pressable
                accessibilityRole="button"
                disabled={savingRecordAction}
                onPress={() => setPendingDeleteWorkout(null)}
                style={styles.recordDeleteCancel}
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
                  {savingRecordAction ? "제거 중" : "제거 확정"}
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {recordActionError ? (
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
    recordDeleteConfirm: {
      padding: space[4],
      flexDirection: "row",
      alignItems: "center",
      gap: space[3],
      borderColor: colors.border,
    },
    recordDeleteCopy: { flex: 1, minWidth: 0 },
    recordDeleteTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
    recordDeleteText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 4 },
    recordDeleteActions: { flexDirection: "row", alignItems: "center", gap: space[2] },
    recordDeleteCancel: { paddingHorizontal: 6, paddingVertical: 10 },
    recordDeleteCancelText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 9 },
    recordDeleteButton: {
      minHeight: 36,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    },
    recordDeleteButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 9 },
    recordActionError: { color: colors.danger, fontFamily: fonts.medium, fontSize: 10 },
    actionDisabled: { opacity: 0.55 },
    pressed: { opacity: 0.72 },
  });
}
