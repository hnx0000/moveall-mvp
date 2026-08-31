import { sportLabels, type Routine, type SportType } from "@moveall/contracts";
import * as Location from "expo-location";
import {
  Check,
  ChevronDown,
  CircleStop,
  Link2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Save,
  TimerReset,
  Watch,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { fonts, radius, space, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

type RecorderPhase = "setup" | "starting" | "recording" | "paused" | "review" | "saving" | "done";
type DivingSource = "device" | "manual";
type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
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
  onClose,
  onSaved,
}: {
  sport: SportType;
  routines: Routine[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [phase, setPhase] = useState<RecorderPhase>(
    setupSports.includes(sport) ? "setup" : "starting",
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [gpsStatus, setGpsStatus] = useState("GPS 준비 중");
  const [error, setError] = useState<string | null>(null);
  const [bodyWeight, setBodyWeight] = useState("70");
  const [poolLength, setPoolLength] = useState("25");
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [completedRoutineItems, setCompletedRoutineItems] = useState<number[]>([]);
  const [divingSource, setDivingSource] = useState<DivingSource>("device");
  const [divingDevice, setDivingDevice] = useState("다이빙 컴퓨터");
  const [maxDepth, setMaxDepth] = useState("");
  const [dynamicDistance, setDynamicDistance] = useState("");
  const [devicePrepared, setDevicePrepared] = useState(false);
  const [targetAlert, setTargetAlert] = useState<string | null>(null);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const startedAtRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  const savingRef = useRef(false);
  const targetAlertKeysRef = useRef<string[]>([]);

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
  const distanceKm = useMemo(() => calculateTrackDistance(points), [points]);
  const elevation = useMemo(() => calculateElevation(points), [points]);
  const weightKg = clampNumber(bodyWeight, 30, 250, 70);
  const calories = calculateCalories(sport, weightKg, elapsedSeconds);
  const paceSecondsPerKm = distanceKm > 0 ? elapsedSeconds / distanceKm : 0;
  const averageSpeedKmh = elapsedSeconds > 0 ? distanceKm / (elapsedSeconds / 3600) : 0;
  const distanceM = distanceKm * 1000;
  const poolLengthM = clampNumber(poolLength, 10, 100, 25);
  const laps = poolLengthM > 0 ? Math.floor(distanceM / poolLengthM) : 0;
  const swimPaceSeconds = distanceM >= 25 ? elapsedSeconds / (distanceM / 100) : 0;
  const active = phase === "recording";
  const canClose = phase === "setup" || phase === "done" || phase === "starting";

  const stopGps = useCallback(() => {
    watchRef.current?.remove();
    watchRef.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "recording") return undefined;
    const timer = setInterval(() => setElapsedSeconds((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording" || selectedRoutineItems.length === 0) return;
    selectedRoutineItems.forEach((item, index) => {
      const target = parseRoutineTarget(item.target);
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
  }, [distanceKm, elapsedSeconds, phase, selectedRoutine, selectedRoutineItems]);

  useEffect(() => () => stopGps(), [stopGps]);

  const beginGps = useCallback(
    async (reset: boolean) => {
      setError(null);
      setGpsStatus("GPS 연결 중");
      if (reset) {
        setElapsedSeconds(0);
        setPoints([]);
        startedAtRef.current = new Date().toISOString();
      }
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setPhase(setupSports.includes(sport) ? "setup" : "paused");
          setGpsStatus("GPS 권한 필요");
          setError("실시간 거리 기록을 위해 위치 권한을 허용해 주세요.");
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const firstPoint = toTrackPoint(current);
        setPoints((existing) => (reset ? [firstPoint] : appendTrackPoint(existing, firstPoint)));
        setPhase("recording");
        setGpsStatus("GPS 기록 중");
        stopGps();
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 3,
          },
          (nextLocation) => {
            const nextPoint = toTrackPoint(nextLocation);
            setPoints((existing) => appendTrackPoint(existing, nextPoint));
            setGpsStatus(
              nextPoint.accuracy && nextPoint.accuracy > 30 ? "GPS 신호 약함" : "GPS 기록 중",
            );
          },
          () => {
            setGpsStatus("GPS 연결 끊김");
            setError("GPS 수신이 끊겼습니다. 타이머는 계속 기록됩니다.");
          },
        );
      } catch {
        setPhase(setupSports.includes(sport) ? "setup" : "paused");
        setGpsStatus("GPS 연결 실패");
        setError("현재 위치를 가져오지 못했습니다. 야외에서 다시 시도해 주세요.");
      }
    },
    [sport, stopGps],
  );

  useEffect(() => {
    if (setupSports.includes(sport) || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void beginGps(true);
  }, [beginGps, sport]);

  function startConfiguredWorkout() {
    setError(null);
    setElapsedSeconds(0);
    setCompletedRoutineItems([]);
    setTargetAlert(null);
    targetAlertKeysRef.current = [];
    startedAtRef.current = new Date().toISOString();
    if (sport === "swimming") {
      if (!Number.isFinite(Number(poolLength)) || Number(poolLength) < 10) {
        setError("수영장 길이를 10m 이상으로 설정해 주세요.");
        return;
      }
      void beginGps(true);
      return;
    }
    setPhase("recording");
  }

  function pauseWorkout() {
    stopGps();
    setPhase("paused");
    if (gpsSports.includes(sport)) setGpsStatus("일시정지");
  }

  function resumeWorkout() {
    if (gpsSports.includes(sport)) {
      void beginGps(false);
      return;
    }
    setPhase("recording");
  }

  function toggleRoutineItem(index: number) {
    setCompletedRoutineItems((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    );
  }

  async function finishWorkout() {
    stopGps();
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
    const fallbackStartedAt = new Date(endedAt.getTime() - Math.max(1, elapsedSeconds) * 1000);
    const startedAt = startedAtRef.current ? new Date(startedAtRef.current) : fallbackStartedAt;
    if (startedAt.getTime() >= endedAt.getTime()) startedAt.setTime(endedAt.getTime() - 1000);
    const allRoutineItemsCompleted =
      selectedRoutineItems.length > 0 &&
      completedRoutineItems.length === selectedRoutineItems.length;
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
          completed: completedRoutineItems.length,
          total: selectedRoutineItems.length,
          divingSource,
          divingDevice,
        }),
        metrics: {
          durationMinutes: Number(Math.max(1, elapsedSeconds / 60).toFixed(2)),
          calories,
          ...(distanceKm > 0
            ? {
                distanceKm: Number(distanceKm.toFixed(3)),
                distanceM: Math.round(distanceM),
              }
            : {}),
          ...(gpsSports.includes(sport)
            ? {
                elevationGainM: Math.round(elevation.gain),
                maxElevationM: Math.round(elevation.max),
                gpsPointCount: points.length,
              }
            : {}),
          ...(sport === "running" && paceSecondsPerKm > 0
            ? { paceSeconds: Number(paceSecondsPerKm.toFixed(1)) }
            : {}),
          ...(sport === "cycling" && distanceKm > 0
            ? {
                paceSeconds: Number(paceSecondsPerKm.toFixed(1)),
                averageSpeedKmh: Number(averageSpeedKmh.toFixed(1)),
              }
            : {}),
          ...(sport === "swimming"
            ? {
                poolLengthM,
                laps,
                swimPaceSeconds: Number(swimPaceSeconds.toFixed(1)),
              }
            : {}),
          ...(sport === "strength"
            ? {
                exerciseCount: completedRoutineItems.length,
                sets: completedRoutineItems.length,
                routineCompletion: allRoutineItemsCompleted ? 1 : 0,
              }
            : {}),
          ...(sport === "diving"
            ? {
                maxDepthM: Math.max(0, Number(maxDepth) || 0),
                dynamicDistanceM: Math.max(0, Number(dynamicDistance) || 0),
                divingDeviceCode,
              }
            : {}),
        },
        source: sport === "diving" && divingSource === "device" ? "wearable" : "manual",
      });
      setPhase("done");
      await onSaved();
    } catch (caught) {
      setPhase(sport === "diving" ? "review" : "paused");
      setError(caught instanceof Error ? caught.message : "운동 기록을 저장하지 못했습니다.");
    } finally {
      savingRef.current = false;
    }
  }

  function resetRecorder() {
    stopGps();
    setElapsedSeconds(0);
    setPoints([]);
    setCompletedRoutineItems([]);
    setMaxDepth("");
    setDynamicDistance("");
    setError(null);
    setTargetAlert(null);
    targetAlertKeysRef.current = [];
    setGpsStatus("GPS 준비 중");
    startedAtRef.current = null;
    autoStartedRef.current = false;
    savingRef.current = false;
    setPhase(setupSports.includes(sport) ? "setup" : "starting");
    if (!setupSports.includes(sport)) {
      setTimeout(() => {
        autoStartedRef.current = true;
        void beginGps(true);
      }, 0);
    }
  }

  return (
    <View style={styles.shell}>
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
          routines={sportRoutines}
          selectedRoutine={selectedRoutine}
          setBodyWeight={setBodyWeight}
          setDevicePrepared={setDevicePrepared}
          setDivingDevice={setDivingDevice}
          setDivingSource={setDivingSource}
          setPoolLength={setPoolLength}
          setSelectedRoutineId={setSelectedRoutineId}
          sport={sport}
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
          <View style={styles.doneActions}>
            <Pressable
              accessibilityRole="button"
              onPress={resetRecorder}
              style={styles.secondaryButton}
            >
              <RotateCcw color={colors.ink} size={16} />
              <Text style={styles.secondaryButtonText}>한 번 더</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>완료</Text>
            </Pressable>
          </View>
        </View>
      ) : phase === "review" ? (
        <DivingReview
          colors={colors}
          devicePrepared={devicePrepared}
          divingDevice={divingDevice}
          divingSource={divingSource}
          dynamicDistance={dynamicDistance}
          elapsedSeconds={elapsedSeconds}
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
              <Text style={styles.timer}>{formatClock(elapsedSeconds)}</Text>
            </View>
            {gpsSports.includes(sport) ? (
              <View style={styles.gpsBadge}>
                <MapPin color={colors.primary} size={14} />
                <Text style={styles.gpsText}>{gpsStatus}</Text>
              </View>
            ) : null}
          </View>

          {gpsSports.includes(sport) ? (
            <GpsMetrics
              averageSpeedKmh={averageSpeedKmh}
              calories={calories}
              colors={colors}
              distanceKm={distanceKm}
              elevationGain={elevation.gain}
              laps={laps}
              paceSecondsPerKm={paceSecondsPerKm}
              sport={sport}
              styles={styles}
              swimPaceSeconds={swimPaceSeconds}
            />
          ) : null}

          {sport === "strength" ? (
            <View style={styles.routineTracking}>
              <Text style={styles.blockLabel}>
                {selectedRoutine?.title ?? "자유 근력 운동"} · {completedRoutineItems.length}/
                {selectedRoutineItems.length}
              </Text>
              {selectedRoutineItems.length ? (
                selectedRoutineItems.map((item, index) => {
                  const checked = completedRoutineItems.includes(index);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      key={`${item.order}-${item.name}`}
                      onPress={() => toggleRoutineItem(index)}
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
                      </View>
                    </Pressable>
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
                  종료 후 수심과 다이나믹 기록을 확인해 저장합니다.
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
          <Text style={styles.setupHint}>시작 후 루틴 항목을 하나씩 체크할 수 있습니다.</Text>
        </View>
      ) : null}

      {sport === "swimming" ? (
        <>
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
            <Text style={styles.setupHint}>
              GPS 거리 ÷ 수영장 길이로 랩을 자동 계산합니다. 실내에서는 GPS 오차가 있을 수 있습니다.
            </Text>
          </View>
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
                제조사 계정 연동 전에는 종료 후 측정기에 표시된 값을 확인 입력합니다.
              </Text>
            </View>
          ) : (
            <Text style={styles.setupHint}>
              운동 종료 후 최대 수심과 다이나믹 거리를 직접 입력합니다.
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
  calories,
  laps,
  swimPaceSeconds,
  styles,
  colors,
}: {
  sport: SportType;
  distanceKm: number;
  paceSecondsPerKm: number;
  averageSpeedKmh: number;
  elevationGain: number;
  calories: number;
  laps: number;
  swimPaceSeconds: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const metrics =
    sport === "swimming"
      ? [
          { label: "거리", value: `${Math.round(distanceKm * 1000)} m` },
          { label: "랩", value: `${laps} lap` },
          { label: "페이스", value: formatPace(swimPaceSeconds, "/100m") },
          { label: "칼로리", value: `${calories} kcal` },
        ]
      : sport === "cycling"
        ? [
            { label: "거리", value: `${distanceKm.toFixed(2)} km` },
            { label: "평균속도", value: `${averageSpeedKmh.toFixed(1)} km/h` },
            { label: "고도 상승", value: `${Math.round(elevationGain)} m` },
            { label: "칼로리", value: `${calories} kcal` },
          ]
        : [
            { label: "거리", value: `${distanceKm.toFixed(2)} km` },
            { label: "페이스", value: formatPace(paceSecondsPerKm, "/km") },
            { label: "고도 상승", value: `${Math.round(elevationGain)} m` },
            { label: "칼로리", value: `${calories} kcal` },
          ];
  return (
    <View style={styles.metricGrid}>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.metricCell}>
          <Text style={styles.metricLabel}>{metric.label}</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>{metric.value}</Text>
        </View>
      ))}
    </View>
  );
}

function DivingReview({
  elapsedSeconds,
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
  elapsedSeconds: number;
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
        <Text style={styles.reviewTime}>{formatClock(elapsedSeconds)}</Text>
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
          <Text style={styles.inputLabel}>최대 수심</Text>
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
          <Text style={styles.inputLabel}>다이나믹</Text>
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
  };
}

function appendTrackPoint(points: TrackPoint[], next: TrackPoint) {
  if (next.accuracy !== null && next.accuracy > 60) return points;
  const previous = points.at(-1);
  if (!previous) return [next];
  const delta = haversineKm(previous, next) * 1000;
  if (delta < 1.5 || delta > 250) return points;
  return [...points, next];
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

function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatPace(value: number, unit: string) {
  if (!value || !Number.isFinite(value)) return `--:-- ${unit}`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} ${unit}`;
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
      backgroundColor: colors.danger,
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
      fontSize: 32,
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
      minHeight: 49,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 11,
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
      backgroundColor: colors.danger,
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
    doneActions: { width: "100%", flexDirection: "row", gap: space[2], marginTop: space[3] },
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
