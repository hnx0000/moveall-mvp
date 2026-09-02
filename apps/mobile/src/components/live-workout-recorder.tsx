import { sportLabels, type Routine, type SportType, type WorkoutSession } from "@moveall/contracts";
import * as Location from "expo-location";
import {
  Check,
  ChevronDown,
  CircleStop,
  Link2,
  MapPin,
  Pause,
  Play,
  Save,
  TimerReset,
  Watch,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import {
  clearBackgroundTrack,
  consumeBackgroundTrack,
  startBackgroundTrack,
  stopBackgroundTrack,
} from "../features/location/background-location";
import { fonts, radius, space, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";
import { WorkoutMap } from "./workout-map";
import { type MapPoint } from "./workout-map.types";
import { createGroovPulseAnimation, GroovPulseRings } from "./groov-pulse-rings";

export type WorkoutTrackPreview = {
  points: MapPoint[];
  status: string;
  usesGps: boolean;
};

type RecorderPhase = "setup" | "starting" | "recording" | "paused" | "review" | "saving" | "done";
type DivingSource = "device" | "manual";
type SwimEnvironment = "indoor" | "outdoor";
type CountdownValue = "3" | "2" | "1" | "GROOV!";
type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};

const gpsSports: SportType[] = ["running", "hiking", "cycling", "swimming"];
const setupSports: SportType[] = ["strength", "swimming", "diving"];
const assumedMet: Record<SportType, number> = {
  running: 8.3,
  hiking: 6.0,
  cycling: 7.5,
  strength: 5.0,
  swimming: 8.0,
  diving: 5.0,
};

export function LiveWorkoutRecorder({
  sport,
  routines,
  history,
  onClose,
  onSaved,
  onTrackChange,
  showMap = true,
}: {
  sport: SportType;
  routines: Routine[];
  history: WorkoutSession[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onTrackChange?: (track: WorkoutTrackPreview) => void;
  showMap?: boolean;
}) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [phase, setPhase] = useState<RecorderPhase>(
    setupSports.includes(sport) ? "setup" : "starting",
  );
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState("GPS 준비 중");
  const [error, setError] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState("70");
  const [averageHeartRate, setAverageHeartRate] = useState("");
  const [maximumHeartRate, setMaximumHeartRate] = useState("");
  const [strengthVolume, setStrengthVolume] = useState("");
  const [runningSteps, setRunningSteps] = useState("");
  const [averageCadence, setAverageCadence] = useState("");
  const [swimEnvironment, setSwimEnvironment] = useState<SwimEnvironment>("indoor");
  const [poolLength, setPoolLength] = useState("25");
  const [swimStrokeCount, setSwimStrokeCount] = useState("");
  const [swimAverageSwolf, setSwimAverageSwolf] = useState("");
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [completedRoutineSets, setCompletedRoutineSets] = useState<string[]>([]);
  const [divingSource, setDivingSource] = useState<DivingSource>("device");
  const [divingDevice, setDivingDevice] = useState("다이빙 컴퓨터");
  const [maxDepth, setMaxDepth] = useState("");
  const [dynamicDistance, setDynamicDistance] = useState("");
  const [waterTemperature, setWaterTemperature] = useState("");
  const [devicePrepared, setDevicePrepared] = useState(false);
  const [targetAlert, setTargetAlert] = useState<string | null>(null);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const [startConfirmationOpen, setStartConfirmationOpen] = useState(!setupSports.includes(sport));
  const [countdownValue, setCountdownValue] = useState<CountdownValue | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const pointsRef = useRef<TrackPoint[]>([]);
  const savingRef = useRef(false);
  const targetAlertKeysRef = useRef<string[]>([]);
  const elapsedBaseMsRef = useRef(0);
  const timerStartedAtMsRef = useRef<number | null>(null);
  const countdownTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishedRef = useRef(false);
  const countdownEntrance = useRef(new Animated.Value(0)).current;
  const countdownPulse = useRef(new Animated.Value(0)).current;

  const sportRoutines = useMemo(
    () => routines.filter((routine) => routine.sport === sport),
    [routines, sport],
  );
  const selectedRoutine = useMemo(
    () =>
      sportRoutines.find((routine) => routine.id === selectedRoutineId) ?? sportRoutines[0] ?? null,
    [selectedRoutineId, sportRoutines],
  );
  const selectedRoutineItems = useMemo(
    () => [...(selectedRoutine?.items ?? [])].sort((left, right) => left.order - right.order),
    [selectedRoutine],
  );
  const routineSetCounts = useMemo(
    () => selectedRoutineItems.map((item) => parseStrengthRoutinePlan(item.target)?.sets ?? 1),
    [selectedRoutineItems],
  );
  const totalRoutineSets = routineSetCounts.reduce((total, count) => total + count, 0);
  const completedRoutineExerciseCount = selectedRoutineItems.filter((_, itemIndex) =>
    Array.from({ length: routineSetCounts[itemIndex] ?? 1 }, (_unused, setIndex) =>
      completedRoutineSets.includes(routineSetKey(itemIndex, setIndex)),
    ).every(Boolean),
  ).length;
  const distanceKm = useMemo(() => calculateTrackDistance(points), [points]);
  const elevation = useMemo(() => calculateElevation(points), [points]);
  const elapsedSeconds = elapsedMilliseconds / 1000;
  const weightKg = clampNumber(bodyWeight, 30, 250, 70);
  const calories = calculateCalories(sport, weightKg, elapsedSeconds);
  const paceSecondsPerKm = distanceKm > 0 ? elapsedSeconds / distanceKm : 0;
  const averageSpeedKmh = elapsedSeconds > 0 ? distanceKm / (elapsedSeconds / 3600) : 0;
  const distanceM = distanceKm * 1000;
  const poolLengthM = clampNumber(poolLength, 10, 100, 25);
  const laps =
    swimEnvironment === "indoor" && poolLengthM > 0 ? Math.floor(distanceM / poolLengthM) : 0;
  const swimPaceSeconds = distanceM >= 25 ? elapsedSeconds / (distanceM / 100) : 0;
  const measuredSwimStrokes = optionalMetric(swimStrokeCount, 1, 100_000);
  const calculatedSwolf =
    laps > 0 && measuredSwimStrokes ? elapsedSeconds / laps + measuredSwimStrokes / laps : 0;
  const estimatedCadence = estimateRunningCadence(averageSpeedKmh, distanceKm);
  const estimatedSteps =
    sport === "hiking"
      ? Math.round(distanceKm * 1380)
      : estimatedCadence > 0
        ? Math.round((elapsedSeconds / 60) * estimatedCadence)
        : 0;
  const measuredHeartRate = optionalMetric(averageHeartRate, 30, 250);
  const measuredMaximumHeartRate = optionalMetric(maximumHeartRate, 30, 250);
  const gpsAccuracy = points.at(-1)?.accuracy ?? null;
  const startMessage = useMemo(
    () => buildStartMessage(sport, history, selectedRoutine),
    [history, selectedRoutine, sport],
  );
  const active = phase === "recording";
  const canClose = phase === "setup" || phase === "done" || phase === "starting";

  useEffect(() => {
    onTrackChange?.({
      points,
      status: gpsStatus,
      usesGps: gpsSports.includes(sport) && (sport !== "swimming" || swimEnvironment === "outdoor"),
    });
  }, [gpsStatus, onTrackChange, points, sport, swimEnvironment]);

  const stopGps = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  const appendPoint = useCallback((point: TrackPoint, reset = false) => {
    setPoints((existing) => {
      const next = reset ? [point] : appendTrackPoint(existing, point);
      pointsRef.current = next;
      return next;
    });
  }, []);

  const drainBackgroundPoints = useCallback(async () => {
    const buffered = await consumeBackgroundTrack();
    if (buffered.length === 0) return pointsRef.current;
    let next = pointsRef.current;
    for (const point of buffered) next = appendTrackPoint(next, point);
    pointsRef.current = next;
    setPoints(next);
    return next;
  }, []);

  const clearCountdown = useCallback(() => {
    countdownTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    countdownTimeoutsRef.current = [];
    setCountdownValue(null);
  }, []);

  const freezeTimer = useCallback(() => {
    if (timerStartedAtMsRef.current === null) return elapsedBaseMsRef.current;
    const frozen = elapsedBaseMsRef.current + (Date.now() - timerStartedAtMsRef.current);
    elapsedBaseMsRef.current = frozen;
    timerStartedAtMsRef.current = null;
    setElapsedMilliseconds(frozen);
    return frozen;
  }, []);

  useEffect(() => {
    if (phase !== "recording") return undefined;
    timerStartedAtMsRef.current = Date.now();
    const timer = setInterval(() => {
      if (timerStartedAtMsRef.current === null) return;
      setElapsedMilliseconds(elapsedBaseMsRef.current + (Date.now() - timerStartedAtMsRef.current));
    }, 10);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" || !gpsSports.includes(sport)) return undefined;
    const drain = setInterval(() => void drainBackgroundPoints(), 5_000);
    return () => clearInterval(drain);
  }, [drainBackgroundPoints, phase, sport]);

  useEffect(() => {
    if (!countdownValue) return undefined;
    countdownEntrance.setValue(0);
    countdownPulse.setValue(0);
    Vibration.vibrate(countdownValue === "GROOV!" ? [0, 70, 45, 90] : 32);
    const animation = Animated.parallel([
      Animated.timing(countdownEntrance, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(2.2)),
        useNativeDriver: true,
      }),
      createGroovPulseAnimation(countdownPulse),
    ]);
    animation.start();
    return () => animation.stop();
  }, [countdownEntrance, countdownPulse, countdownValue]);

  useEffect(() => {
    if (phase !== "recording" || selectedRoutineItems.length === 0) return;
    let strengthCumulativeSeconds = 0;
    selectedRoutineItems.forEach((item, index) => {
      const strengthPlan = sport === "strength" ? parseStrengthRoutinePlan(item.target) : null;
      if (strengthPlan) {
        strengthCumulativeSeconds +=
          (strengthPlan.estimatedMinutes +
            strengthPlan.restMinutes * Math.max(0, strengthPlan.sets - 1)) *
          60;
      }
      const target = strengthPlan
        ? { kind: "time" as const, value: strengthCumulativeSeconds }
        : parseRoutineTarget(item.target);
      if (!target) return;
      const key = `${selectedRoutine?.id ?? "free"}-${index}-${target.kind}`;
      if (targetAlertKeysRef.current.includes(key)) return;
      const reached =
        target.kind === "time" ? elapsedSeconds >= target.value : distanceKm * 1000 >= target.value;
      if (!reached) return;
      targetAlertKeysRef.current.push(key);
      setTargetAlert(`그루비! ${item.name} ${item.target} 목표에 도달했어요.`);
      Vibration.vibrate([0, 220, 100, 220]);
    });
  }, [distanceKm, elapsedSeconds, phase, selectedRoutine, selectedRoutineItems, sport]);

  useEffect(
    () => () => {
      stopGps();
      void stopBackgroundTrack();
      countdownTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    },
    [stopGps],
  );

  const beginGps = useCallback(
    async (reset: boolean) => {
      if (finishedRef.current) return;
      setError(null);
      setGpsStatus("GPS 연결 중");
      if (reset) {
        elapsedBaseMsRef.current = 0;
        timerStartedAtMsRef.current = null;
        setElapsedMilliseconds(0);
        setPoints([]);
        pointsRef.current = [];
        await clearBackgroundTrack();
      }
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (finishedRef.current) return;
        if (!permission.granted) {
          setPhase(setupSports.includes(sport) ? "setup" : "paused");
          setGpsStatus("GPS 권한 필요");
          setError("실시간 거리 기록을 위해 위치 권한을 허용해 주세요.");
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (finishedRef.current) return;
        const firstPoint = toTrackPoint(current);
        appendPoint(firstPoint, reset);
        setPhase("recording");
        setGpsStatus(describeGpsAccuracy(firstPoint.accuracy));
        const backgroundActive = await startBackgroundTrack().catch(() => false);
        if (!backgroundActive) setGpsStatus("GPS 기록 중 · 화면 유지 권장");
        stopGps();
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 3,
          },
          (nextLocation) => {
            if (finishedRef.current) return;
            const nextPoint = toTrackPoint(nextLocation);
            appendPoint(nextPoint);
            setGpsStatus(describeGpsAccuracy(nextPoint.accuracy));
          },
          () => {
            setGpsStatus("GPS 연결 끊김");
            setError("GPS 수신이 끊겼습니다. 타이머는 계속 기록됩니다.");
          },
        );
      } catch {
        if (finishedRef.current) return;
        setPhase(setupSports.includes(sport) ? "setup" : "paused");
        setGpsStatus("GPS 연결 실패");
        setError("현재 위치를 가져오지 못했습니다. 야외에서 다시 시도해 주세요.");
      }
    },
    [appendPoint, sport, stopGps],
  );

  function startCountdown(onComplete: () => void) {
    if (finishedRef.current) return;
    clearCountdown();
    setPhase("starting");
    setCountdownValue("3");
    const sequence: Array<{ delay: number; value: CountdownValue }> = [
      { delay: 760, value: "2" },
      { delay: 1520, value: "1" },
      { delay: 2280, value: "GROOV!" },
    ];
    countdownTimeoutsRef.current = sequence.map(({ delay, value }) =>
      setTimeout(() => {
        if (!finishedRef.current) setCountdownValue(value);
      }, delay),
    );
    countdownTimeoutsRef.current.push(
      setTimeout(() => {
        countdownTimeoutsRef.current = [];
        setCountdownValue(null);
        if (!finishedRef.current) onComplete();
      }, 3040),
    );
  }

  function beginWorkoutNow(reset: boolean) {
    if (finishedRef.current) return;
    setError(null);
    if (reset) {
      elapsedBaseMsRef.current = 0;
      timerStartedAtMsRef.current = null;
      setElapsedMilliseconds(0);
      setCompletedRoutineSets([]);
      setTargetAlert(null);
      targetAlertKeysRef.current = [];
    }
    if (gpsSports.includes(sport)) {
      void beginGps(reset);
      return;
    }
    setPhase("recording");
  }

  function startConfiguredWorkout() {
    if (finishedRef.current) return;
    setError(null);
    if (sport === "swimming" && swimEnvironment === "indoor") {
      if (!Number.isFinite(Number(poolLength)) || Number(poolLength) < 10) {
        setError("수영장 길이를 10m 이상으로 설정해 주세요.");
        return;
      }
    }
    setStartConfirmationOpen(true);
  }

  function pauseWorkout() {
    freezeTimer();
    stopGps();
    void stopBackgroundTrack()
      .then(() => drainBackgroundPoints())
      .catch(() => undefined);
    setPhase("paused");
    if (gpsSports.includes(sport)) setGpsStatus("일시정지");
  }

  function resumeWorkout() {
    if (finishedRef.current) return;
    startCountdown(() => beginWorkoutNow(false));
  }

  function toggleRoutineSet(itemIndex: number, setIndex: number) {
    const key = routineSetKey(itemIndex, setIndex);
    setCompletedRoutineSets((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function finishWorkout() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearCountdown();
    setStartConfirmationOpen(false);
    freezeTimer();
    stopGps();
    await stopBackgroundTrack().catch(() => undefined);
    await drainBackgroundPoints();
    if (sport === "diving") {
      setPhase("review");
      return;
    }
    await persistWorkout();
  }

  async function persistWorkout() {
    if (savingRef.current) return;
    if (!session) {
      setError("기록을 저장할 로그인 세션을 확인하지 못했습니다.");
      return;
    }
    if (sport === "diving") {
      const depthValue = Number(maxDepth);
      const dynamicValue = Number(dynamicDistance);
      if (
        (!Number.isFinite(depthValue) || depthValue < 0) &&
        (!Number.isFinite(dynamicValue) || dynamicValue < 0)
      ) {
        setError("최대 수심 또는 다이나믹 거리 중 하나를 입력해 주세요.");
        return;
      }
    }
    savingRef.current = true;
    setPhase("saving");
    setError(null);
    const endedAt = new Date();
    const recordedElapsedMs = Math.max(10, elapsedBaseMsRef.current);
    const startedAt = new Date(endedAt.getTime() - recordedElapsedMs);
    const savedPoints = pointsRef.current;
    const savedDistanceKm = calculateTrackDistance(savedPoints);
    const savedDistanceM = savedDistanceKm * 1000;
    const savedElevation = calculateElevation(savedPoints);
    const savedElapsedSeconds = recordedElapsedMs / 1000;
    const savedPaceSecondsPerKm = savedDistanceKm > 0 ? savedElapsedSeconds / savedDistanceKm : 0;
    const savedAverageSpeedKmh =
      savedElapsedSeconds > 0 ? savedDistanceKm / (savedElapsedSeconds / 3600) : 0;
    const savedEstimatedCadence = estimateRunningCadence(savedAverageSpeedKmh, savedDistanceKm);
    const savedEstimatedSteps =
      sport === "hiking"
        ? Math.round(savedDistanceKm * 1380)
        : savedEstimatedCadence > 0
          ? Math.round((savedElapsedSeconds / 60) * savedEstimatedCadence)
          : 0;
    const savedLaps =
      swimEnvironment === "indoor" && poolLengthM > 0
        ? Math.floor(savedDistanceM / poolLengthM)
        : 0;
    const savedSwimPaceSeconds =
      savedDistanceM >= 25 ? savedElapsedSeconds / (savedDistanceM / 100) : 0;
    const savedCalculatedSwolf =
      savedLaps > 0 && measuredSwimStrokes
        ? savedElapsedSeconds / savedLaps + measuredSwimStrokes / savedLaps
        : 0;
    const allRoutineItemsCompleted =
      totalRoutineSets > 0 && completedRoutineSets.length === totalRoutineSets;
    const divingDeviceCode = divingSource === "device" ? deviceCode(divingDevice) : 0;

    try {
      await api.createWorkoutSession(session.accessToken, {
        sport,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        perceivedExertion: 5,
        notes: buildWorkoutNotes({
          sport,
          selectedRoutine,
          completed: completedRoutineExerciseCount,
          total: selectedRoutineItems.length,
          divingSource,
          divingDevice,
        }),
        metrics: {
          durationMinutes: Number((recordedElapsedMs / 60_000).toFixed(4)),
          calories,
          ...(optionalMetric(averageHeartRate, 30, 250) !== undefined
            ? { averageHeartRateBpm: Math.round(optionalMetric(averageHeartRate, 30, 250)!) }
            : {}),
          ...(optionalMetric(maximumHeartRate, 30, 250) !== undefined
            ? { maximumHeartRateBpm: Math.round(optionalMetric(maximumHeartRate, 30, 250)!) }
            : {}),
          ...(savedDistanceKm > 0
            ? {
                distanceKm: Number(savedDistanceKm.toFixed(3)),
                distanceM: Math.round(savedDistanceM),
              }
            : {}),
          ...(gpsSports.includes(sport)
            ? {
                elevationGainM: Math.round(savedElevation.gain),
                maxElevationM: Math.round(savedElevation.max),
                gpsPointCount: savedPoints.length,
              }
            : {}),
          ...((sport === "running" || sport === "hiking") &&
          (optionalMetric(runningSteps, 1, 200_000) !== undefined || savedEstimatedSteps > 0)
            ? {
                steps: Math.round(optionalMetric(runningSteps, 1, 200_000) ?? savedEstimatedSteps),
              }
            : {}),
          ...(sport === "running" && savedPaceSecondsPerKm > 0
            ? {
                paceSeconds: Number(savedPaceSecondsPerKm.toFixed(1)),
                ...(optionalMetric(averageCadence, 1, 300) !== undefined ||
                savedEstimatedCadence > 0
                  ? {
                      averageCadenceSpm: Math.round(
                        optionalMetric(averageCadence, 1, 300) ?? savedEstimatedCadence,
                      ),
                    }
                  : {}),
              }
            : {}),
          ...(sport === "cycling" && savedDistanceKm > 0
            ? {
                paceSeconds: Number(savedPaceSecondsPerKm.toFixed(1)),
                averageSpeedKmh: Number(savedAverageSpeedKmh.toFixed(1)),
              }
            : {}),
          ...(sport === "swimming"
            ? {
                swimEnvironmentCode: swimEnvironment === "indoor" ? 1 : 2,
                poolLengthM: swimEnvironment === "indoor" ? poolLengthM : 0,
                laps: savedLaps,
                swimPaceSeconds: Number(savedSwimPaceSeconds.toFixed(1)),
                totalStrokes: Math.round(measuredSwimStrokes ?? 0),
                averageSwolf: Number(
                  (optionalMetric(swimAverageSwolf, 1, 300) ?? savedCalculatedSwolf).toFixed(1),
                ),
              }
            : {}),
          ...(sport === "strength"
            ? {
                exerciseCount: completedRoutineExerciseCount,
                sets: completedRoutineSets.length,
                volumeKg: Math.max(0, optionalMetric(strengthVolume, 1, 1_000_000) ?? 0),
                routineCompletion: allRoutineItemsCompleted ? 1 : 0,
              }
            : {}),
          ...(sport === "diving"
            ? {
                maxDepthM: Math.max(0, Number(maxDepth) || 0),
                dynamicDistanceM: Math.max(0, Number(dynamicDistance) || 0),
                waterTemperatureC: Math.max(0, optionalMetric(waterTemperature, 1, 45) ?? 0),
                divingDeviceCode,
              }
            : {}),
        },
        source: sport === "diving" && divingSource === "device" ? "wearable" : "manual",
      });
      setPhase("done");
      await onSaved();
    } catch (caught) {
      finishedRef.current = false;
      setPhase(sport === "diving" ? "review" : "paused");
      setError(caught instanceof Error ? caught.message : "운동 기록을 저장하지 못했습니다.");
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <View style={styles.shell}>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setStartConfirmationOpen(false);
          if (!setupSports.includes(sport)) onClose();
        }}
        transparent
        visible={startConfirmationOpen}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmEyebrow}>READY TO GROOV</Text>
            <Text style={styles.confirmTitle}>{sportLabels[sport]} 기록을 시작할까요?</Text>
            <Text style={styles.startMessage}>{startMessage}</Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStartConfirmationOpen(false);
                  if (!setupSports.includes(sport)) onClose();
                }}
                style={styles.confirmCancel}
              >
                <Text style={styles.confirmCancelText}>취소</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setStartConfirmationOpen(false);
                  startCountdown(() => beginWorkoutNow(true));
                }}
                style={styles.confirmFinish}
              >
                <Text style={styles.confirmFinishText}>3초 후 시작</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={countdownValue !== null}>
        {countdownValue ? (
          <View accessibilityLiveRegion="assertive" style={styles.countdownBackdrop}>
            <View style={styles.countdownStage}>
              <GroovPulseRings progress={countdownPulse} color={colors.primary} />
              <Animated.View
                style={[
                  styles.countdownCopy,
                  {
                    opacity: countdownEntrance.interpolate({
                      inputRange: [0, 0.12, 1],
                      outputRange: [0, 1, 1],
                    }),
                    transform: [
                      {
                        translateY: countdownEntrance.interpolate({
                          inputRange: [0, 0.72, 1],
                          outputRange: [62, -8, 0],
                        }),
                      },
                      {
                        scale: countdownEntrance.interpolate({
                          inputRange: [0, 0.72, 1],
                          outputRange: [0.28, 1.24, 1],
                        }),
                      },
                      {
                        rotate: countdownEntrance.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["-5deg", "0deg"],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.countdownEyebrow}>READY TO MOVE</Text>
                <Text
                  style={[
                    styles.countdownValue,
                    countdownValue === "GROOV!" && styles.countdownWord,
                  ]}
                >
                  {countdownValue === "GROOV!" ? countdownValue : `${countdownValue}!`}
                </Text>
              </Animated.View>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setFinishConfirmationOpen(false)}
        transparent
        visible={finishConfirmationOpen}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmEyebrow}>FINISH WORKOUT</Text>
            <Text style={styles.confirmTitle}>기록을 종료할까요?</Text>
            <Text style={styles.confirmCopy}>
              현재까지의 {sportLabels[sport]} 기록을 중지하고 오늘의 활동에 저장합니다.
            </Text>
            <View style={styles.finishMetricGrid}>
              <View
                style={[
                  styles.finishMetricField,
                  (sport === "swimming" || sport === "diving") && styles.finishMetricFieldCompact,
                ]}
              >
                <Text style={styles.finishMetricLabel}>평균 심박수</Text>
                <View style={styles.finishMetricInputRow}>
                  <TextInput
                    accessibilityLabel="평균 심박수"
                    keyboardType="number-pad"
                    onChangeText={setAverageHeartRate}
                    placeholder="선택"
                    placeholderTextColor={colors.muted}
                    style={styles.finishMetricInput}
                    value={averageHeartRate}
                  />
                  <Text style={styles.finishMetricUnit}>bpm</Text>
                </View>
              </View>
              {["running", "hiking", "cycling", "strength", "diving"].includes(sport) ? (
                <View
                  style={[
                    styles.finishMetricField,
                    sport === "diving" && styles.finishMetricFieldCompact,
                  ]}
                >
                  <Text style={styles.finishMetricLabel}>최대 심박수</Text>
                  <View style={styles.finishMetricInputRow}>
                    <TextInput
                      accessibilityLabel="최대 심박수"
                      keyboardType="number-pad"
                      onChangeText={setMaximumHeartRate}
                      placeholder="선택"
                      placeholderTextColor={colors.muted}
                      style={styles.finishMetricInput}
                      value={maximumHeartRate}
                    />
                    <Text style={styles.finishMetricUnit}>bpm</Text>
                  </View>
                </View>
              ) : null}
              {sport === "diving" ? (
                <View style={[styles.finishMetricField, styles.finishMetricFieldCompact]}>
                  <Text style={styles.finishMetricLabel}>수온</Text>
                  <View style={styles.finishMetricInputRow}>
                    <TextInput
                      accessibilityLabel="다이빙 수온"
                      keyboardType="decimal-pad"
                      onChangeText={setWaterTemperature}
                      placeholder="선택"
                      placeholderTextColor={colors.muted}
                      style={styles.finishMetricInput}
                      value={waterTemperature}
                    />
                    <Text style={styles.finishMetricUnit}>°C</Text>
                  </View>
                </View>
              ) : null}
              {sport === "strength" ? (
                <View style={styles.finishMetricField}>
                  <Text style={styles.finishMetricLabel}>총 볼륨</Text>
                  <View style={styles.finishMetricInputRow}>
                    <TextInput
                      accessibilityLabel="근력운동 총 볼륨"
                      keyboardType="decimal-pad"
                      onChangeText={setStrengthVolume}
                      placeholder="선택"
                      placeholderTextColor={colors.muted}
                      style={styles.finishMetricInput}
                      value={strengthVolume}
                    />
                    <Text style={styles.finishMetricUnit}>kg</Text>
                  </View>
                </View>
              ) : null}
              {sport === "swimming" ? (
                <>
                  <View style={[styles.finishMetricField, styles.finishMetricFieldCompact]}>
                    <Text style={styles.finishMetricLabel}>총 스트로크</Text>
                    <View style={styles.finishMetricInputRow}>
                      <TextInput
                        accessibilityLabel="수영 총 스트로크"
                        keyboardType="number-pad"
                        onChangeText={setSwimStrokeCount}
                        placeholder="선택"
                        placeholderTextColor={colors.muted}
                        style={styles.finishMetricInput}
                        value={swimStrokeCount}
                      />
                      <Text style={styles.finishMetricUnit}>회</Text>
                    </View>
                  </View>
                  <View style={[styles.finishMetricField, styles.finishMetricFieldCompact]}>
                    <Text style={styles.finishMetricLabel}>평균 SWOLF</Text>
                    <View style={styles.finishMetricInputRow}>
                      <TextInput
                        accessibilityLabel="수영 평균 SWOLF"
                        keyboardType="decimal-pad"
                        onChangeText={setSwimAverageSwolf}
                        placeholder={
                          calculatedSwolf > 0 ? String(Math.round(calculatedSwolf)) : "선택"
                        }
                        placeholderTextColor={colors.muted}
                        style={styles.finishMetricInput}
                        value={swimAverageSwolf}
                      />
                    </View>
                  </View>
                </>
              ) : null}
              {sport === "running" || sport === "hiking" ? (
                <>
                  <View style={styles.finishMetricField}>
                    <Text style={styles.finishMetricLabel}>걸음</Text>
                    <View style={styles.finishMetricInputRow}>
                      <TextInput
                        accessibilityLabel="러닝 걸음 수"
                        keyboardType="number-pad"
                        onChangeText={setRunningSteps}
                        placeholder="선택"
                        placeholderTextColor={colors.muted}
                        style={styles.finishMetricInput}
                        value={runningSteps}
                      />
                      <Text style={styles.finishMetricUnit}>걸음</Text>
                    </View>
                  </View>
                  {sport === "running" ? (
                    <View style={styles.finishMetricField}>
                      <Text style={styles.finishMetricLabel}>평균 케이던스</Text>
                      <View style={styles.finishMetricInputRow}>
                        <TextInput
                          accessibilityLabel="러닝 평균 케이던스"
                          keyboardType="number-pad"
                          onChangeText={setAverageCadence}
                          placeholder="선택"
                          placeholderTextColor={colors.muted}
                          style={styles.finishMetricInput}
                          value={averageCadence}
                        />
                        <Text style={styles.finishMetricUnit}>spm</Text>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
            <Text style={styles.finishMetricHint}>
              워치 또는 측정 화면에 값이 있을 때 입력하세요. 비워두면 0으로 표시됩니다.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFinishConfirmationOpen(false)}
                style={styles.confirmCancel}
              >
                <Text style={styles.confirmCancelText}>계속 기록</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFinishConfirmationOpen(false);
                  void finishWorkout();
                }}
                style={styles.confirmFinish}
              >
                <Text style={styles.confirmFinishText}>종료 및 저장</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>LIVE WORKOUT</Text>
          <Text style={styles.title}>{sportLabels[sport]} 기록</Text>
        </View>
        {canClose ? (
          <Pressable accessibilityLabel="기록기 닫기" accessibilityRole="button" onPress={onClose}>
            <X color={colors.muted} size={21} />
          </Pressable>
        ) : (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{active ? "LIVE" : "PAUSED"}</Text>
          </View>
        )}
      </View>

      {phase === "setup" ? (
        <SetupPanel
          bodyWeight={bodyWeight}
          colors={colors}
          devicePrepared={devicePrepared}
          divingDevice={divingDevice}
          divingSource={divingSource}
          error={error}
          poolLength={poolLength}
          setSwimEnvironment={setSwimEnvironment}
          routines={sportRoutines}
          selectedRoutine={selectedRoutine}
          setBodyWeight={setBodyWeight}
          setDevicePrepared={setDevicePrepared}
          setDivingDevice={setDivingDevice}
          setDivingSource={setDivingSource}
          setPoolLength={setPoolLength}
          setSelectedRoutineId={setSelectedRoutineId}
          sport={sport}
          swimEnvironment={swimEnvironment}
          styles={styles}
          onStart={startConfiguredWorkout}
        />
      ) : phase === "done" ? (
        <View style={styles.donePanel}>
          <View style={styles.doneIcon}>
            <Check color="#FFFFFF" size={25} strokeWidth={2.7} />
          </View>
          <Text style={styles.doneTitle}>기록 저장 완료</Text>
          <Text style={styles.doneCopy}>오늘의 활동과 내 기록에 바로 반영했습니다.</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>완료</Text>
          </Pressable>
        </View>
      ) : phase === "review" ? (
        <DivingReview
          colors={colors}
          devicePrepared={devicePrepared}
          divingDevice={divingDevice}
          divingSource={divingSource}
          dynamicDistance={dynamicDistance}
          elapsedMilliseconds={elapsedMilliseconds}
          error={error}
          maxDepth={maxDepth}
          setDynamicDistance={setDynamicDistance}
          setMaxDepth={setMaxDepth}
          styles={styles}
          onSave={() => void persistWorkout()}
        />
      ) : (
        <View style={styles.trackingPanel}>
          <View style={styles.timerRow}>
            <View>
              <Text style={styles.timerLabel}>{active ? "운동 시간" : gpsStatus}</Text>
              <Text style={styles.timer}>{formatClock(elapsedMilliseconds)}</Text>
            </View>
            {gpsSports.includes(sport) ? (
              <View style={styles.gpsBadge}>
                <MapPin color={colors.primary} size={14} />
                <Text style={styles.gpsText}>{gpsStatus}</Text>
              </View>
            ) : null}
          </View>

          {gpsSports.includes(sport) ? (
            <>
              {showMap && (sport !== "swimming" || swimEnvironment === "outdoor") ? (
                <WorkoutMap
                  backgroundColor={colors.map}
                  badgeLabel={gpsStatus}
                  compact
                  currentPoint={points.at(-1)}
                  height={208}
                  minimal={false}
                  isSample={false}
                  points={points}
                  primaryColor={colors.primary}
                />
              ) : null}
              <GpsMetrics
                averageHeartRate={measuredHeartRate}
                averageSwolf={optionalMetric(swimAverageSwolf, 1, 300) ?? calculatedSwolf}
                maximumHeartRate={measuredMaximumHeartRate}
                averageSpeedKmh={averageSpeedKmh}
                calories={calories}
                colors={colors}
                distanceKm={distanceKm}
                elevationGain={elevation.gain}
                estimatedCadence={estimatedCadence}
                estimatedSteps={estimatedSteps}
                gpsAccuracy={gpsAccuracy}
                gpsPointCount={points.length}
                gpsStatus={gpsStatus}
                laps={laps}
                paceSecondsPerKm={paceSecondsPerKm}
                sport={sport}
                styles={styles}
                swimPaceSeconds={swimPaceSeconds}
                totalStrokes={measuredSwimStrokes ?? 0}
              />
            </>
          ) : null}

          {sport === "strength" ? (
            <View style={styles.routineTracking}>
              <Text style={styles.blockLabel}>
                {selectedRoutine?.title ?? "자유 근력 운동"} · {completedRoutineSets.length}/
                {totalRoutineSets}세트
              </Text>
              {selectedRoutineItems.length ? (
                selectedRoutineItems.map((item, index) => {
                  const setCount = routineSetCounts[index] ?? 1;
                  const setChecks = Array.from({ length: setCount }, (_unused, setIndex) =>
                    completedRoutineSets.includes(routineSetKey(index, setIndex)),
                  );
                  const checked = setChecks.every(Boolean);
                  return (
                    <View
                      key={`${item.order}-${item.name}`}
                      style={[styles.routineItem, checked && styles.routineItemChecked]}
                    >
                      <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
                        {checked ? <Check color="#FFFFFF" size={13} strokeWidth={3} /> : null}
                      </View>
                      <View style={styles.routineCopy}>
                        <Text style={[styles.routineName, checked && styles.routineNameChecked]}>
                          {item.name}
                        </Text>
                        <Text style={styles.routineTarget}>{item.target}</Text>
                        <View style={styles.routineSetRow}>
                          {setChecks.map((setChecked, setIndex) => (
                            <Pressable
                              accessibilityLabel={`${item.name} ${setIndex + 1}세트 ${setChecked ? "완료 취소" : "완료"}`}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: setChecked }}
                              key={`${item.order}-set-${setIndex}`}
                              onPress={() => toggleRoutineSet(index, setIndex)}
                              style={[
                                styles.routineSetButton,
                                setChecked && styles.routineSetButtonChecked,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.routineSetButtonText,
                                  setChecked && styles.routineSetButtonTextChecked,
                                ]}
                              >
                                {setChecked ? "✓" : setIndex + 1}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>저장된 근력 루틴이 없어 시간만 기록합니다.</Text>
              )}
            </View>
          ) : null}

          {sport === "diving" ? (
            <View style={styles.deviceLivePanel}>
              <Watch color={colors.primary} size={20} />
              <View style={styles.deviceLiveCopy}>
                <Text style={styles.deviceLiveTitle}>
                  {divingSource === "device" ? divingDevice : "수기 기록 모드"}
                </Text>
                <Text style={styles.deviceLiveText}>
                  시간과 연결된 측정값을 기록합니다. DYNAMIC은 종료 후 수기로 입력합니다.
                </Text>
              </View>
            </View>
          ) : null}

          {targetAlert ? (
            <Pressable onPress={() => setTargetAlert(null)} style={styles.targetAlert}>
              <Text style={styles.targetAlertTitle}>목표 알림</Text>
              <Text style={styles.targetAlertText}>{targetAlert}</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              disabled={phase === "starting" || phase === "saving"}
              onPress={active ? pauseWorkout : resumeWorkout}
              style={styles.secondaryButton}
            >
              {active ? (
                <Pause color={colors.ink} size={17} fill={colors.ink} />
              ) : (
                <Play color={colors.ink} size={17} fill={colors.ink} />
              )}
              <Text style={styles.secondaryButtonText}>{active ? "일시정지" : "계속"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={phase === "starting" || phase === "saving"}
              onPress={() => setFinishConfirmationOpen(true)}
              style={styles.stopButton}
            >
              {phase === "saving" ? (
                <Save color="#FFFFFF" size={17} />
              ) : (
                <CircleStop color="#FFFFFF" size={17} />
              )}
              <Text style={styles.stopButtonText}>
                {phase === "saving" ? "저장 중" : "종료 및 저장"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function SetupPanel({
  sport,
  routines,
  selectedRoutine,
  selectedRoutineId: _selectedRoutineId,
  setSelectedRoutineId,
  poolLength,
  setPoolLength,
  swimEnvironment,
  setSwimEnvironment,
  bodyWeight,
  setBodyWeight,
  divingSource,
  setDivingSource,
  divingDevice,
  setDivingDevice,
  devicePrepared,
  setDevicePrepared,
  error,
  onStart,
  styles,
  colors,
}: {
  sport: SportType;
  routines: Routine[];
  selectedRoutine: Routine | null;
  selectedRoutineId?: string;
  setSelectedRoutineId: (value: string) => void;
  poolLength: string;
  setPoolLength: (value: string) => void;
  swimEnvironment: SwimEnvironment;
  setSwimEnvironment: (value: SwimEnvironment) => void;
  bodyWeight: string;
  setBodyWeight: (value: string) => void;
  divingSource: DivingSource;
  setDivingSource: (value: DivingSource) => void;
  divingDevice: string;
  setDivingDevice: (value: string) => void;
  devicePrepared: boolean;
  setDevicePrepared: (value: boolean) => void;
  error: string | null;
  onStart: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const [routineListOpen, setRoutineListOpen] = useState(false);
  const selectedStrengthItems = [...(selectedRoutine?.items ?? [])].sort(
    (left, right) => left.order - right.order,
  );
  const selectedStrengthPlans = selectedStrengthItems.map((item) =>
    parseStrengthRoutinePlan(item.target),
  );
  const plannedSets = selectedStrengthPlans.reduce((total, plan) => total + (plan?.sets ?? 1), 0);
  const plannedMinutes = Math.round(
    selectedStrengthPlans.reduce(
      (total, plan) =>
        total +
        (plan?.estimatedMinutes ?? 0) +
        (plan?.restMinutes ?? 0) * Math.max(0, (plan?.sets ?? 1) - 1),
      0,
    ),
  );
  return (
    <View style={styles.setupPanel}>
      {sport === "strength" ? (
        <View style={styles.setupBlock}>
          <Text style={styles.blockLabel}>사용할 루틴</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRoutineListOpen((current) => !current)}
            style={styles.selectButton}
          >
            <Text style={styles.selectButtonText}>
              {selectedRoutine?.title ?? "자유 근력 운동"}
            </Text>
            <ChevronDown color={colors.muted} size={17} />
          </Pressable>
          {routineListOpen ? (
            <View style={styles.selectMenu}>
              {routines.map((routine) => (
                <Pressable
                  accessibilityRole="button"
                  key={routine.id}
                  onPress={() => {
                    setSelectedRoutineId(routine.id);
                    setRoutineListOpen(false);
                  }}
                  style={styles.selectMenuItem}
                >
                  <Text style={styles.selectMenuTitle}>{routine.title}</Text>
                  <Text style={styles.selectMenuMeta}>{routine.items.length}개 항목</Text>
                </Pressable>
              ))}
              {!routines.length ? (
                <Text style={styles.emptyText}>
                  저장된 근력 루틴이 없습니다. 시간만 기록합니다.
                </Text>
              ) : null}
            </View>
          ) : null}
          {selectedRoutine ? (
            <View style={styles.setupRoutinePreview}>
              <Text style={styles.setupRoutineSummary}>
                {selectedStrengthItems.length}종목 · 총 {plannedSets}세트 · 예상 {plannedMinutes}분
              </Text>
              {selectedStrengthItems.map((item, index) => (
                <View key={`${item.order}-${item.name}`} style={styles.setupRoutineItem}>
                  <Text style={styles.setupRoutineIndex}>{index + 1}</Text>
                  <View style={styles.setupRoutineCopy}>
                    <Text style={styles.setupRoutineName}>{item.name}</Text>
                    <Text style={styles.setupRoutineTarget}>{item.target}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.setupHint}>시작 후 운동별 세트를 하나씩 체크할 수 있습니다.</Text>
        </View>
      ) : null}

      {sport === "swimming" ? (
        <>
          <View style={styles.setupBlock}>
            <Text style={styles.blockLabel}>수영 환경</Text>
            <View style={styles.optionRow}>
              {(
                [
                  { value: "indoor", label: "실내수영" },
                  { value: "outdoor", label: "실외수영" },
                ] as const
              ).map((option) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: swimEnvironment === option.value }}
                  key={option.value}
                  onPress={() => setSwimEnvironment(option.value)}
                  style={[
                    styles.sourceButton,
                    swimEnvironment === option.value && styles.optionButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      swimEnvironment === option.value && styles.optionButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.setupHint}>
              {swimEnvironment === "indoor"
                ? "수영장 길이와 이동 거리를 기준으로 랩을 계산합니다."
                : "실외수영은 GPS 거리와 페이스를 기록하며 랩은 계산하지 않습니다."}
            </Text>
          </View>
          {swimEnvironment === "indoor" ? (
            <View style={styles.setupBlock}>
              <Text style={styles.blockLabel}>수영장 길이</Text>
              <View style={styles.optionRow}>
                {["25", "50"].map((value) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: poolLength === value }}
                    key={value}
                    onPress={() => setPoolLength(value)}
                    style={[styles.optionButton, poolLength === value && styles.optionButtonActive]}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        poolLength === value && styles.optionButtonTextActive,
                      ]}
                    >
                      {value}m
                    </Text>
                  </Pressable>
                ))}
                <TextInput
                  accessibilityLabel="사용자 지정 수영장 길이"
                  keyboardType="decimal-pad"
                  onChangeText={setPoolLength}
                  placeholder="직접 입력"
                  placeholderTextColor={colors.muted}
                  style={styles.inlineInput}
                  value={poolLength === "25" || poolLength === "50" ? "" : poolLength}
                />
              </View>
              <Text style={styles.setupHint}>기록 거리 ÷ 수영장 길이로 랩을 자동 계산합니다.</Text>
            </View>
          ) : null}
          <WeightInput
            bodyWeight={bodyWeight}
            colors={colors}
            setBodyWeight={setBodyWeight}
            styles={styles}
          />
        </>
      ) : null}

      {sport === "diving" ? (
        <View style={styles.setupBlock}>
          <Text style={styles.blockLabel}>기록 방식</Text>
          <View style={styles.optionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: divingSource === "device" }}
              onPress={() => setDivingSource("device")}
              style={[styles.sourceButton, divingSource === "device" && styles.optionButtonActive]}
            >
              <Watch color={divingSource === "device" ? "#FFFFFF" : colors.ink} size={17} />
              <Text
                style={[
                  styles.optionButtonText,
                  divingSource === "device" && styles.optionButtonTextActive,
                ]}
              >
                측정기 연동
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: divingSource === "manual" }}
              onPress={() => setDivingSource("manual")}
              style={[styles.sourceButton, divingSource === "manual" && styles.optionButtonActive]}
            >
              <TimerReset color={divingSource === "manual" ? "#FFFFFF" : colors.ink} size={17} />
              <Text
                style={[
                  styles.optionButtonText,
                  divingSource === "manual" && styles.optionButtonTextActive,
                ]}
              >
                수기 입력
              </Text>
            </Pressable>
          </View>
          {divingSource === "device" ? (
            <View style={styles.deviceSetup}>
              <TextInput
                accessibilityLabel="다이빙 측정기 이름"
                onChangeText={setDivingDevice}
                placeholder="예: Garmin Descent"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                value={divingDevice}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setDevicePrepared(!devicePrepared)}
                style={[styles.linkButton, devicePrepared && styles.linkButtonReady]}
              >
                <Link2 color={devicePrepared ? "#FFFFFF" : colors.primary} size={17} />
                <Text style={[styles.linkButtonText, devicePrepared && styles.linkButtonTextReady]}>
                  {devicePrepared ? "측정기 기록 수신 준비됨" : "측정기 연동 준비"}
                </Text>
              </Pressable>
              <Text style={styles.setupHint}>
                제조사 계정 연동 전에는 종료 후 측정기에 표시된 DEPTH·심박·수온을 확인 입력합니다.
                DYNAMIC은 수기로 기록합니다.
              </Text>
            </View>
          ) : (
            <Text style={styles.setupHint}>
              운동 시간은 자동 측정하고, 종료 후 DEPTH와 DYNAMIC을 직접 입력합니다.
            </Text>
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onStart} style={styles.primaryButtonLarge}>
        <Play color="#FFFFFF" fill="#FFFFFF" size={17} />
        <Text style={styles.primaryButtonText}>지금 기록 시작</Text>
      </Pressable>
    </View>
  );
}

function WeightInput({
  bodyWeight,
  setBodyWeight,
  styles,
  colors,
}: {
  bodyWeight: string;
  setBodyWeight: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.setupBlock}>
      <Text style={styles.blockLabel}>칼로리 계산 체중</Text>
      <View style={styles.inputWithUnit}>
        <TextInput
          accessibilityLabel="체중"
          keyboardType="decimal-pad"
          onChangeText={setBodyWeight}
          placeholder="70"
          placeholderTextColor={colors.muted}
          style={styles.weightInput}
          value={bodyWeight}
        />
        <Text style={styles.inputUnit}>kg</Text>
      </View>
      <Text style={styles.setupHint}>
        체중과 운동 강도를 기준으로 예상 소모 칼로리를 계산합니다.
      </Text>
    </View>
  );
}

function GpsMetrics({
  sport,
  distanceKm,
  paceSecondsPerKm,
  averageSpeedKmh,
  elevationGain,
  averageHeartRate,
  averageSwolf,
  maximumHeartRate,
  estimatedCadence,
  estimatedSteps,
  gpsAccuracy,
  gpsPointCount,
  gpsStatus,
  calories,
  laps,
  swimPaceSeconds,
  totalStrokes,
  styles,
  colors,
}: {
  sport: SportType;
  distanceKm: number;
  paceSecondsPerKm: number;
  averageSpeedKmh: number;
  elevationGain: number;
  averageHeartRate: number | undefined;
  averageSwolf: number;
  maximumHeartRate: number | undefined;
  estimatedCadence: number;
  estimatedSteps: number;
  gpsAccuracy: number | null;
  gpsPointCount: number;
  gpsStatus: string;
  calories: number;
  laps: number;
  swimPaceSeconds: number;
  totalStrokes: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const heartRateValue = averageHeartRate ? `${Math.round(averageHeartRate)} bpm` : "0 bpm";
  const maximumHeartRateValue = maximumHeartRate ? `${Math.round(maximumHeartRate)} bpm` : "0 bpm";
  const metrics =
    sport === "running"
      ? [
          { label: "거리", value: `${distanceKm.toFixed(2)} km` },
          { label: "페이스", value: formatPace(paceSecondsPerKm, "/km") },
          { label: "평균 심박수", value: heartRateValue },
          { label: "최대 심박수", value: maximumHeartRateValue },
          {
            label: "평균 케이던스",
            value: estimatedCadence > 0 ? `${Math.round(estimatedCadence)} spm` : "0 spm",
          },
          {
            label: "걸음",
            value: estimatedSteps > 0 ? estimatedSteps.toLocaleString("ko-KR") : "0",
          },
          { label: "칼로리", value: `${calories} kcal` },
        ]
      : sport === "swimming"
        ? [
            { label: "거리", value: `${Math.round(distanceKm * 1000)} m` },
            { label: "랩", value: `${laps} lap` },
            { label: "페이스", value: formatPace(swimPaceSeconds, "/100m") },
            { label: "평균 심박수", value: heartRateValue },
            { label: "총 스트로크", value: Math.round(totalStrokes).toLocaleString("ko-KR") },
            { label: "평균 SWOLF", value: averageSwolf > 0 ? `${Math.round(averageSwolf)}` : "0" },
            { label: "칼로리", value: `${calories} kcal` },
          ]
        : sport === "cycling"
          ? [
              { label: "거리", value: `${distanceKm.toFixed(2)} km` },
              { label: "칼로리", value: `${calories} kcal` },
              { label: "평균속도", value: `${averageSpeedKmh.toFixed(1)} km/h` },
              { label: "평균 심박수", value: heartRateValue },
              { label: "최대 심박수", value: maximumHeartRateValue },
            ]
          : [
              { label: "거리", value: `${distanceKm.toFixed(2)} km` },
              { label: "페이스", value: formatPace(paceSecondsPerKm, "/km") },
              { label: "고도 상승", value: `${Math.round(elevationGain)} m` },
              {
                label: "걸음",
                value: estimatedSteps > 0 ? estimatedSteps.toLocaleString("ko-KR") : "0",
              },
              { label: "평균 심박수", value: heartRateValue },
              { label: "최대 심박수", value: maximumHeartRateValue },
              { label: "칼로리", value: `${calories} kcal` },
            ];
  return (
    <View style={styles.gpsMetricStack}>
      <View style={styles.gpsInfoBar}>
        <MapPin color={colors.primary} size={14} />
        <Text style={styles.gpsInfoText}>
          {gpsStatus} · 정확도 {gpsAccuracy === null ? "확인 중" : `±${Math.round(gpsAccuracy)}m`} ·
          위치 {gpsPointCount}점
        </Text>
      </View>
      <View style={styles.metricGrid}>
        {metrics.map((metric) => (
          <View key={metric.label} style={styles.metricCell}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={[styles.metricValue, { color: colors.ink }]}>{metric.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DivingReview({
  elapsedMilliseconds,
  divingSource,
  divingDevice,
  devicePrepared,
  maxDepth,
  setMaxDepth,
  dynamicDistance,
  setDynamicDistance,
  error,
  onSave,
  styles,
  colors,
}: {
  elapsedMilliseconds: number;
  divingSource: DivingSource;
  divingDevice: string;
  devicePrepared: boolean;
  maxDepth: string;
  setMaxDepth: (value: string) => void;
  dynamicDistance: string;
  setDynamicDistance: (value: string) => void;
  error: string | null;
  onSave: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.reviewPanel}>
      <View style={styles.reviewHeading}>
        <Text style={styles.reviewTitle}>다이빙 기록 확인</Text>
        <Text style={styles.reviewTime}>{formatClock(elapsedMilliseconds)}</Text>
      </View>
      <View style={styles.reviewSource}>
        <Watch color={colors.primary} size={18} />
        <Text style={styles.reviewSourceText}>
          {divingSource === "device"
            ? `${divingDevice} · ${devicePrepared ? "연동 기록" : "측정값 확인 입력"}`
            : "수기 입력"}
        </Text>
      </View>
      <View style={styles.twoInputs}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>DEPTH</Text>
          <View style={styles.inputWithUnit}>
            <TextInput
              accessibilityLabel="최대 수심"
              keyboardType="decimal-pad"
              onChangeText={setMaxDepth}
              placeholder="18"
              placeholderTextColor={colors.muted}
              style={styles.weightInput}
              value={maxDepth}
            />
            <Text style={styles.inputUnit}>m</Text>
          </View>
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>DYNAMIC · 수기</Text>
          <View style={styles.inputWithUnit}>
            <TextInput
              accessibilityLabel="다이나믹 거리"
              keyboardType="decimal-pad"
              onChangeText={setDynamicDistance}
              placeholder="42"
              placeholderTextColor={colors.muted}
              style={styles.weightInput}
              value={dynamicDistance}
            />
            <Text style={styles.inputUnit}>m</Text>
          </View>
        </View>
      </View>
      <Text style={styles.setupHint}>
        DYNAMIC은 워치 버전 연동 전까지 이번 세션의 측정값을 수기로 입력합니다. PB는 저장된 전체
        기록에서 자동 계산됩니다.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onSave} style={styles.primaryButtonLarge}>
        <Save color="#FFFFFF" size={17} />
        <Text style={styles.primaryButtonText}>다이빙 기록 저장</Text>
      </Pressable>
    </View>
  );
}

function toTrackPoint(location: Location.LocationObject): TrackPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

function appendTrackPoint(points: TrackPoint[], next: TrackPoint) {
  if (next.accuracy !== null && next.accuracy > 120) return points;
  const previous = points.at(-1);
  if (!previous) return [next];
  const delta = haversineKm(previous, next) * 1000;
  if (delta < 1.5 || delta > 250) return points;
  return [...points, next];
}

function describeGpsAccuracy(accuracy: number | null) {
  if (accuracy === null || accuracy <= 65) return "GPS 기록 중";
  if (accuracy <= 120) return "GPS 정확도 보정 중";
  return "GPS 위치 확인 중";
}

function calculateTrackDistance(points: TrackPoint[]) {
  return points
    .slice(1)
    .reduce((total, point, index) => total + haversineKm(points[index]!, point), 0);
}

function haversineKm(left: TrackPoint, right: TrackPoint) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(left.latitude)) *
      Math.cos(toRadians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateElevation(points: TrackPoint[]) {
  const altitudes = points
    .map((point) => point.altitude)
    .filter((altitude): altitude is number => altitude !== null && Number.isFinite(altitude));
  let gain = 0;
  altitudes.slice(1).forEach((altitude, index) => {
    const delta = altitude - altitudes[index]!;
    if (delta >= 1 && delta <= 30) gain += delta;
  });
  return {
    gain,
    max: altitudes.length ? Math.max(...altitudes) : 0,
  };
}

function calculateCalories(sport: SportType, weightKg: number, elapsedSeconds: number) {
  const minutes = elapsedSeconds / 60;
  return Math.max(0, Math.round((assumedMet[sport] * 3.5 * weightKg * minutes) / 200));
}

function clampNumber(value: string, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function optionalMetric(value: string, min: number, max: number) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}

function formatClock(totalMilliseconds: number) {
  const centiseconds = Math.floor(totalMilliseconds / 10);
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const seconds = Math.floor((centiseconds % 6_000) / 100);
  const hundredths = centiseconds % 100;
  return [hours, minutes, seconds, hundredths]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatPace(value: number, unit: string) {
  if (!value || !Number.isFinite(value)) return `--/-- ${unit}`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} ${unit}`;
}

function estimateRunningCadence(averageSpeedKmh: number, distanceKm: number) {
  if (distanceKm <= 0 || averageSpeedKmh <= 0) return 0;
  return Math.min(190, Math.max(154, 151 + averageSpeedKmh * 1.8));
}

function buildStartMessage(
  sport: SportType,
  history: WorkoutSession[],
  selectedRoutine: Routine | null,
) {
  const recent = history
    .filter((workout) => workout.sport === sport)
    .sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt))
    .slice(0, 5);
  const averageMetric = (key: string) => {
    const values = recent
      .map((workout) => workout.metrics[key])
      .filter((value): value is number => typeof value === "number" && value > 0);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  };

  if (sport === "running") {
    const heartRate = averageMetric("averageHeartRateBpm");
    const cadence = averageMetric("averageCadenceSpm");
    if (heartRate > 158) {
      return "최근 평균 심박이 높았습니다. 초반 페이스를 낮추고, 오늘도 안전 러닝해볼까요?";
    }
    if (cadence > 0 && cadence < 165) {
      return "최근 케이던스가 낮았습니다. 보폭을 가볍게 줄이고 리듬을 유지해볼까요?";
    }
    return "페이스를 유지하며, 오늘도 안전 러닝해볼까요?";
  }
  if (sport === "hiking") {
    return averageMetric("elevationGainM") > 450
      ? "최근 오르막 비중이 높았습니다. 초반 체력을 아끼고 안전하게 정상까지 가볼까요?"
      : "호흡 가능한 속도를 유지하며 안전하게 산행해볼까요?";
  }
  if (sport === "cycling") {
    return averageMetric("averageSpeedKmh") > 24
      ? "최근 속도가 높았습니다. 초반 과속을 피하고 일정한 케이던스로 달려볼까요?"
      : "페이스를 일정하게 유지하며 오늘의 거리를 채워볼까요?";
  }
  if (sport === "strength") {
    return selectedRoutine
      ? `${selectedRoutine.title} 순서대로 자세를 지키며 각 항목을 완료해볼까요?`
      : "세트 사이 회복을 지키며 오늘의 근력 운동을 시작해볼까요?";
  }
  if (sport === "swimming") {
    const pace = averageMetric("swimPaceSeconds");
    return pace > 150
      ? "최근 후반 페이스가 떨어졌습니다. 초반 호흡을 여유 있게 가져가볼까요?"
      : "스트로크 리듬을 유지하며 오늘의 랩을 채워볼까요?";
  }
  return averageMetric("maxDepthM") > 20
    ? "최근 수심 기록이 깊었습니다. 이퀄라이징과 버디 체크를 먼저 확인할까요?"
    : "장비와 버디 상태를 확인하고 안전하게 다이빙을 시작할까요?";
}

function buildWorkoutNotes({
  sport,
  selectedRoutine,
  completed,
  total,
  divingSource,
  divingDevice,
}: {
  sport: SportType;
  selectedRoutine: Routine | null;
  completed: number;
  total: number;
  divingSource: DivingSource;
  divingDevice: string;
}) {
  if (sport === "strength" && selectedRoutine) {
    const completionTag =
      total > 0 && completed === total ? `[routine:${selectedRoutine.id}] ` : "";
    return `${completionTag}${selectedRoutine.title} · ${completed}/${total} 완료`;
  }
  if (sport === "diving") {
    return divingSource === "device" ? `${divingDevice} 측정 기록` : "다이빙 수기 기록";
  }
  return `${sportLabels[sport]} GPS 기록`;
}

function deviceCode(deviceName: string) {
  return [...deviceName].reduce((total, character) => total + character.charCodeAt(0), 0) % 100000;
}

function parseRoutineTarget(value: string) {
  const estimatedTimeMatch = value.match(/예상\s*(\d+(?:\.\d+)?)\s*분/);
  if (estimatedTimeMatch) {
    return { kind: "time" as const, value: Number(estimatedTimeMatch[1]) * 60 };
  }
  const timeMatch = value.match(/(\d+(?:\.\d+)?)\s*(분|시간)/);
  if (timeMatch) {
    const amount = Number(timeMatch[1]);
    return { kind: "time" as const, value: amount * (timeMatch[2] === "시간" ? 3600 : 60) };
  }
  const distanceMatch = value.match(/(\d+(?:\.\d+)?)\s*(km|킬로|m|미터)/i);
  if (distanceMatch) {
    const amount = Number(distanceMatch[1]);
    const unit = distanceMatch[2]?.toLowerCase();
    return {
      kind: "distance" as const,
      value: amount * (unit === "km" || unit === "킬로" ? 1000 : 1),
    };
  }
  return null;
}

function parseStrengthRoutinePlan(value: string) {
  const repetitions = Number(value.match(/(\d+(?:\.\d+)?)\s*회/)?.[1] ?? 0);
  const sets = Number(value.match(/(\d+(?:\.\d+)?)\s*세트/)?.[1] ?? 0);
  const estimatedMinutes = Number(value.match(/예상\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? 0);
  const restMinutes = Number(value.match(/휴식\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? 0);
  if (!repetitions && !sets && !estimatedMinutes && !restMinutes) return null;
  return {
    repetitions,
    sets: Math.max(1, Math.round(sets || 1)),
    estimatedMinutes,
    restMinutes,
  };
}

function routineSetKey(itemIndex: number, setIndex: number) {
  return `${itemIndex}-${setIndex}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    shell: {
      marginTop: space[4],
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: space[4],
    },
    confirmBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.72)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    confirmCard: {
      width: "100%",
      maxWidth: 400,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 11,
    },
    confirmEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1,
    },
    confirmTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    confirmCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 17 },
    startMessage: {
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 13,
      lineHeight: 21,
      paddingVertical: 5,
    },
    countdownBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(8,7,6,0.96)",
      overflow: "hidden",
    },
    countdownStage: {
      width: 280,
      height: 280,
      alignItems: "center",
      justifyContent: "center",
    },
    countdownCopy: {
      alignItems: "center",
      justifyContent: "center",
    },
    countdownEyebrow: {
      color: "rgba(255,255,255,0.62)",
      fontFamily: fonts.display,
      fontSize: 9,
      letterSpacing: 2.8,
      marginBottom: -5,
    },
    countdownValue: {
      color: colors.primary,
      fontFamily: fonts.displayItalic,
      fontSize: 138,
      lineHeight: 154,
      letterSpacing: -9,
      textShadowColor: "rgba(255,77,42,0.28)",
      textShadowOffset: { width: 0, height: 10 },
      textShadowRadius: 26,
    },
    countdownWord: {
      fontSize: 70,
      lineHeight: 86,
      letterSpacing: -4,
    },
    finishMetricGrid: {
      width: "100%",
      minWidth: 0,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    finishMetricField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "45%",
      minWidth: 0,
      maxWidth: "100%",
      gap: 5,
    },
    finishMetricFieldCompact: {
      flexBasis: "30%",
    },
    finishMetricLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 9 },
    finishMetricInputRow: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 10,
      width: "100%",
      minWidth: 0,
      maxWidth: "100%",
      overflow: "hidden",
    },
    finishMetricInput: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 12,
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      outlineWidth: 0,
    },
    finishMetricUnit: {
      flexShrink: 0,
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 8,
    },
    finishMetricHint: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 8,
      lineHeight: 13,
    },
    confirmActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    confirmCancel: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmCancelText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    confirmFinish: {
      flex: 1.25,
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    confirmFinishText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.3,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.full,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    liveText: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 0.8,
    },
    setupPanel: { gap: space[4], marginTop: space[4] },
    setupBlock: { gap: space[2] },
    blockLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11 },
    setupHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, lineHeight: 15 },
    selectButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
    },
    selectButtonText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
    selectMenu: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: "hidden",
    },
    selectMenuItem: {
      minHeight: 44,
      paddingHorizontal: 12,
      justifyContent: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    selectMenuTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 10 },
    selectMenuMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    setupRoutinePreview: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      padding: 11,
    },
    setupRoutineSummary: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    setupRoutineItem: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    setupRoutineIndex: {
      width: 18,
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
      paddingTop: 1,
    },
    setupRoutineCopy: { flex: 1 },
    setupRoutineName: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 },
    setupRoutineTarget: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 8,
      marginTop: 2,
    },
    optionRow: { flexDirection: "row", gap: space[2] },
    optionButton: {
      minWidth: 66,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      paddingHorizontal: 12,
    },
    optionButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    optionButtonText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 10 },
    optionButtonTextActive: { color: "#FFFFFF" },
    sourceButton: {
      flex: 1,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    inlineInput: {
      flex: 1,
      minHeight: 42,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 11,
      fontFamily: fonts.medium,
      fontSize: 10,
    },
    inputWithUnit: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      paddingHorizontal: 11,
    },
    weightInput: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.medium,
      fontSize: 12,
      paddingVertical: 8,
    },
    inputUnit: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10 },
    deviceSetup: { gap: space[2], marginTop: space[1] },
    textInput: {
      minHeight: 42,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      paddingHorizontal: 11,
      fontFamily: fonts.medium,
      fontSize: 10,
    },
    linkButton: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
    },
    linkButtonReady: { backgroundColor: colors.primary },
    linkButtonText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 10 },
    linkButtonTextReady: { color: "#FFFFFF" },
    primaryButtonLarge: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
    },
    primaryButton: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    primaryButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 11 },
    trackingPanel: { gap: space[4], marginTop: space[4] },
    timerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    timerLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
    timer: {
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 28,
      letterSpacing: -1,
      marginTop: 2,
    },
    gpsBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.full,
      paddingHorizontal: 9,
      paddingVertical: 6,
      marginBottom: 4,
    },
    gpsText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 8 },
    gpsMetricStack: { gap: space[2] },
    gpsInfoBar: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      borderRadius: radius.md,
      backgroundColor: colors.primarySoft,
    },
    gpsInfoText: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 8 },
    metricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    metricCell: {
      width: "50%",
      minHeight: 64,
      justifyContent: "center",
      paddingHorizontal: 12,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    metricLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8 },
    metricValue: { fontFamily: fonts.displayExtra, fontSize: 15, marginTop: 3 },
    routineTracking: { gap: space[2] },
    routineItem: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 11,
    },
    routineItemChecked: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkBoxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    routineCopy: { flex: 1 },
    routineName: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
    routineNameChecked: { color: colors.muted, textDecorationLine: "line-through" },
    routineTarget: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    routineSetRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
    routineSetButton: {
      width: 29,
      height: 29,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    routineSetButtonChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    routineSetButtonText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 9 },
    routineSetButtonTextChecked: { color: "#FFFFFF" },
    emptyText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
      lineHeight: 15,
      padding: 10,
    },
    deviceLivePanel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: 12,
    },
    deviceLiveCopy: { flex: 1 },
    deviceLiveTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    deviceLiveText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 8,
      lineHeight: 14,
      marginTop: 2,
    },
    targetAlert: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      padding: 12,
    },
    targetAlertTitle: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    targetAlertText: {
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 10,
      lineHeight: 16,
      marginTop: 3,
    },
    controls: { flexDirection: "row", gap: space[2] },
    secondaryButton: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    secondaryButtonText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    stopButton: {
      flex: 1.3,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
    },
    stopButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
    error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 9, lineHeight: 15 },
    donePanel: { alignItems: "center", gap: space[2], paddingTop: space[5] },
    doneIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    doneTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18, marginTop: 4 },
    doneCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
    reviewPanel: { gap: space[4], marginTop: space[4] },
    reviewHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    reviewTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    reviewTime: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 18 },
    reviewSource: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: 11,
    },
    reviewSourceText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 },
    twoInputs: { flexDirection: "row", gap: space[2] },
    inputGroup: { flex: 1, gap: 5 },
    inputLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
  });
}
