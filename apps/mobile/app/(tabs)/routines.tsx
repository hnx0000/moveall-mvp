import { sportLabels, sportValues, type SportType } from "@moveall/contracts";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { PrimaryButton, Screen } from "../../src/components/ui";
import {
  StoryCanvas,
  type StoryBackground,
  type StoryLayer,
  type StoryVisibility,
} from "../../src/components/story-canvas";
import { WorkoutMap } from "../../src/components/workout-map";
import { type MapPlace, type MapPoint } from "../../src/components/workout-map.types";
import { requestPedestrianRoute, type PlannedRoute } from "../../src/services/route-planner";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type StudioMode = "track" | "route" | "photo" | "manual";
type TrackingState = "idle" | "recording" | "paused" | "finished";
type RouteSelection = "start" | "finish";

const outdoorSports: SportType[] = ["running", "hiking", "cycling"];
const aquaticSports: SportType[] = ["swimming", "diving"];

const modeLabels: Array<{ id: StudioMode; label: string }> = [
  { id: "track", label: "기록" },
  { id: "route", label: "루트" },
  { id: "photo", label: "카메라" },
  { id: "manual", label: "직접" },
];

const proofPrompts: Record<SportType, string[]> = {
  running: ["러닝화", "완주 셀피", "오늘의 하늘"],
  hiking: ["정상 인증", "등산 장비", "트레일 풍경"],
  cycling: ["오늘의 자전거", "라이딩 룩", "휴식 포인트"],
  strength: ["오늘의 눈바디", "오늘의 운동복", "운동 장비"],
  swimming: ["오늘의 수영복", "수영모 + 수경샷", "레인 끝 인증"],
  diving: ["다이빙 물속 사진", "오늘의 다이빙 슈트", "마스크 + 핀 장비샷"],
};

const photoHeadlines: Record<SportType, string> = {
  running: "THE RUN CUT",
  hiking: "ABOVE THE CITY",
  cycling: "RIDE FRAME",
  strength: "BODY CHECK",
  swimming: "POOL SIDE",
  diving: "UNDER WATER",
};

const aquaticPlaces: Record<"swimming" | "diving", MapPlace[]> = {
  swimming: [
    {
      id: "pool-1",
      name: "수영장 후보",
      description: "실제 지도에서 운영 시간과 레인을 확인하세요.",
      latitude: 37.5248,
      longitude: 126.9381,
    },
    {
      id: "pool-2",
      name: "다른 수영장 후보",
      description: "사진만 남기고 장소는 숨길 수 있습니다.",
      latitude: 37.5178,
      longitude: 126.9537,
    },
  ],
  diving: [
    {
      id: "diving-1",
      name: "다이빙풀 후보",
      description: "수심과 장비 대여 여부를 확인하세요.",
      latitude: 37.5133,
      longitude: 127.0729,
    },
    {
      id: "diving-2",
      name: "프리다이빙 센터 후보",
      description: "장소보다 물속 사진만 남겨도 됩니다.",
      latitude: 37.5215,
      longitude: 127.0864,
    },
  ],
};

const initialVisibility: StoryVisibility = {
  distance: true,
  duration: true,
  pace: true,
  route: true,
  points: true,
};

export default function MoveStudioScreen() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const requestedSport = sportValues.find((value) => value === params.sport);
  const initialSport: SportType = requestedSport ?? "running";
  const [sport, setSport] = useState<SportType>(initialSport);
  const [mode, setMode] = useState<StudioMode>(
    outdoorSports.includes(initialSport) ? "track" : "photo",
  );
  const [trackingState, setTrackingState] = useState<TrackingState>("idle");
  const [recordedPoints, setRecordedPoints] = useState<MapPoint[]>([]);
  const [currentPoint, setCurrentPoint] = useState<MapPoint | undefined>();
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPrompt, setPhotoPrompt] = useState(proofPrompts[initialSport][0] ?? "오늘의 운동");
  const [manualValue, setManualValue] = useState("45");
  const [actionError, setActionError] = useState<string | null>(null);
  const [routeSelection, setRouteSelection] = useState<RouteSelection>("start");
  const [planStart, setPlanStart] = useState<MapPoint | null>(null);
  const [planFinish, setPlanFinish] = useState<MapPoint | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [planning, setPlanning] = useState(false);
  const [storyBackground, setStoryBackground] = useState<StoryBackground>(
    outdoorSports.includes(initialSport) ? "map" : "photo",
  );
  const [storyLayers, setStoryLayers] = useState<StoryLayer[]>(["record", "route", "points"]);
  const [storyText, setStoryText] = useState("오늘의 움직임.");
  const [visibility, setVisibility] = useState<StoryVisibility>(initialVisibility);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const workoutStartedAtRef = useRef<string | null>(null);

  const isOutdoor = outdoorSports.includes(sport);
  const isAquatic = isAquaticSport(sport);
  const selectedPlaces = isAquatic ? aquaticPlaces[sport] : [];
  const recordedDistance = useMemo(() => calculateRouteDistance(recordedPoints), [recordedPoints]);
  const displayDistance = recordedDistance || plannedRoute?.distanceKm || 0;
  const displayDuration =
    durationSeconds ||
    (mode === "track" && plannedRoute
      ? plannedRoute.durationSeconds
      : Math.max(0, Number(manualValue) || 0) * 60);
  const paceSeconds = displayDistance > 0 ? displayDuration / displayDistance : 0;
  const routeForStory = recordedPoints.length > 1 ? recordedPoints : (plannedRoute?.points ?? []);
  const projectedMoveScore = Math.max(0, Math.round(displayDistance * 100 + displayDuration / 60));
  const moveScore = workoutDone ? projectedMoveScore : 0;
  const readyToShare = workoutDone && (storyBackground !== "photo" || photoUri !== null);

  useEffect(() => {
    if (trackingState !== "recording") return undefined;
    const timer = setInterval(() => setDurationSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [trackingState]);

  useEffect(
    () => () => {
      locationWatchRef.current?.remove();
      locationWatchRef.current = null;
    },
    [],
  );

  const selectPlanPoint = useCallback(
    (point: MapPoint) => {
      setActionError(null);
      setPlannedRoute(null);
      if (routeSelection === "start") {
        setPlanStart(point);
        setRouteSelection("finish");
      } else {
        setPlanFinish(point);
      }
    },
    [routeSelection],
  );

  function stopLocationWatch() {
    locationWatchRef.current?.remove();
    locationWatchRef.current = null;
  }

  function resetTrack() {
    stopLocationWatch();
    setTrackingState("idle");
    setRecordedPoints([]);
    setCurrentPoint(undefined);
    setDurationSeconds(0);
    setWorkoutDone(false);
    setSavedWorkoutId(null);
    workoutStartedAtRef.current = null;
    setActionError(null);
  }

  function chooseSport(nextSport: SportType) {
    resetTrack();
    setSport(nextSport);
    setMode(outdoorSports.includes(nextSport) ? "track" : "photo");
    setPhotoUri(null);
    setPhotoPrompt(proofPrompts[nextSport][0] ?? "오늘의 운동");
    setPlanStart(null);
    setPlanFinish(null);
    setPlannedRoute(null);
    setStoryBackground(outdoorSports.includes(nextSport) ? "map" : "photo");
  }

  async function startLocationWatch(reset: boolean) {
    setActionError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setActionError("GPS 권한이 필요합니다.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const firstPoint = toMapPoint(location);
      if (reset) {
        setDurationSeconds(0);
        setRecordedPoints([firstPoint]);
        setWorkoutDone(false);
        setSavedWorkoutId(null);
        workoutStartedAtRef.current = new Date().toISOString();
      } else {
        setRecordedPoints((current) => appendPoint(current, firstPoint));
      }
      setCurrentPoint(firstPoint);
      setTrackingState("recording");
      stopLocationWatch();
      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 4 },
        (nextLocation) => {
          const nextPoint = toMapPoint(nextLocation);
          setCurrentPoint(nextPoint);
          setRecordedPoints((current) => appendPoint(current, nextPoint));
        },
        () => setActionError("GPS 기록이 끊겼습니다."),
      );
    } catch {
      setTrackingState("idle");
      setActionError("현재 위치를 가져오지 못했습니다.");
    }
  }

  async function setCurrentLocationAsStart() {
    setActionError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setActionError("GPS 권한이 필요합니다.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPlanStart(toMapPoint(location));
      setRouteSelection("finish");
      setPlannedRoute(null);
    } catch {
      setActionError("현재 위치를 출발점으로 지정하지 못했습니다.");
    }
  }

  async function buildWalkingRoute() {
    if (!planStart || !planFinish) return;
    setPlanning(true);
    setActionError(null);
    try {
      const route = await requestPedestrianRoute(planStart, planFinish);
      setPlannedRoute(route);
      setStoryBackground("map");
      setStoryLayers((current) => (current.includes("route") ? current : [...current, "route"]));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "루트를 만들지 못했습니다.");
    } finally {
      setPlanning(false);
    }
  }

  function pauseWorkout() {
    stopLocationWatch();
    setTrackingState("paused");
  }

  async function persistWorkout(notes: string) {
    if (!session || savingWorkout) return;
    setSavingWorkout(true);
    setActionError(null);
    const endedAt = new Date();
    const effectiveDuration = Math.max(60, displayDuration || 60);
    const startedAt =
      workoutStartedAtRef.current ??
      new Date(endedAt.getTime() - effectiveDuration * 1000).toISOString();
    try {
      const saved = await api.createWorkoutSession(session.accessToken, {
        sport,
        startedAt,
        endedAt: endedAt.toISOString(),
        perceivedExertion: 5,
        notes,
        metrics: {
          durationMinutes: Math.max(1, Math.round(effectiveDuration / 60)),
          ...(displayDistance > 0 ? { distanceKm: Number(displayDistance.toFixed(3)) } : {}),
          moveScore: projectedMoveScore,
        },
        source: "manual",
      });
      setSavedWorkoutId(saved.id);
      setWorkoutDone(true);
      return saved;
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "운동 기록을 저장하지 못했습니다.");
      return undefined;
    } finally {
      setSavingWorkout(false);
    }
  }

  async function finishWorkout() {
    stopLocationWatch();
    setTrackingState("paused");
    const saved = await persistWorkout(`${sportLabels[sport]} GPS 기록`);
    if (saved) setTrackingState("finished");
  }

  async function choosePhoto(source: "camera" | "library") {
    setActionError(null);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setActionError("카메라 권한이 필요합니다.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.88,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [4, 5],
              quality: 0.88,
            });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setStoryBackground("photo");
      }
    } catch {
      setActionError("사진을 불러오지 못했습니다.");
    }
  }

  function toggleStoryLayer(layer: StoryLayer) {
    setStoryLayers((current) =>
      current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer],
    );
  }

  function toggleVisibility(key: keyof StoryVisibility) {
    setVisibility((current) => {
      const next = { ...current, [key]: !current[key] };
      if (key === "route" && !next.route && storyBackground === "map") {
        setStoryBackground("ink");
      }
      return next;
    });
  }

  function shareDraft() {
    if (!readyToShare) return;
    const route = simplifyRoute(routeForStory);
    router.push({
      pathname: "/community",
      params: {
        draft: `${sportLabels[sport]} · ${photoPrompt}`,
        sport,
        background: storyBackground,
        layers: storyLayers.join(","),
        storyText,
        distance: displayDistance.toFixed(2),
        duration: formatDuration(displayDuration),
        pace: formatPace(paceSeconds),
        points: String(moveScore),
        route: JSON.stringify(route),
        privacy: JSON.stringify(visibility),
        ...(photoUri ? { photo: photoUri } : {}),
        ...(savedWorkoutId ? { workoutSessionId: savedWorkoutId } : {}),
      },
    });
  }

  const planPins = plannedRoute?.points ?? [planStart, planFinish].filter(isMapPoint);

  return (
    <Screen title="">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MOVE STUDIO</Text>
        <Text style={styles.title}>기록하고, 잘라내고, 남긴다.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.sports}>
          {sportValues.map((item) => (
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
      </ScrollView>

      <View style={styles.modeBar}>
        {modeLabels.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mode === item.id }}
            key={item.id}
            onPress={() => setMode(item.id)}
            style={[styles.modeButton, mode === item.id && styles.modeButtonActive]}
          >
            <Text style={[styles.modeLabel, mode === item.id && styles.modeLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "track" && isOutdoor ? (
        <View style={styles.deck}>
          <WorkoutMap
            backgroundColor={colors.map}
            currentPoint={currentPoint}
            isSample={trackingState === "idle"}
            minimal
            points={recordedPoints}
            primaryColor={colors.primary}
            {...(plannedRoute ? { plannedPoints: plannedRoute.points } : {})}
          />
          <View style={styles.metricsPanel}>
            <Metric label="KM" value={displayDistance.toFixed(2)} styles={styles} />
            <Metric label="TIME" value={formatDuration(displayDuration)} styles={styles} />
            <Metric label="PACE" value={formatPace(paceSeconds)} styles={styles} />
          </View>
          {plannedRoute ? (
            <Text style={styles.planAttached}>
              PLANNED · {plannedRoute.distanceKm.toFixed(1)} KM · 보행 가능 도로 기반
            </Text>
          ) : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          <TrackingControls
            onFinish={() => void finishWorkout()}
            onPause={pauseWorkout}
            onReset={resetTrack}
            onResume={() => void startLocationWatch(false)}
            onStart={() => void startLocationWatch(true)}
            state={trackingState}
            styles={styles}
          />
        </View>
      ) : mode === "route" && isOutdoor ? (
        <View style={styles.deck}>
          <View style={styles.deckHeading}>
            <Text style={styles.deckTitle}>ROUTE BUILDER</Text>
            <Text style={styles.deckMeta}>PEDESTRIAN · OSM</Text>
          </View>
          <WorkoutMap
            backgroundColor={colors.map}
            badgeLabel={routeSelection === "start" ? "SET START" : "SET FINISH"}
            currentPoint={undefined}
            isSample
            minimal
            onPointPress={selectPlanPoint}
            plannedPoints={planPins}
            points={[]}
            primaryColor={colors.primary}
          />
          <View style={styles.routeSelectors}>
            <RouteSelector
              active={routeSelection === "start"}
              label="출발"
              ready={planStart !== null}
              onPress={() => setRouteSelection("start")}
              styles={styles}
            />
            <View style={styles.routeLine} />
            <RouteSelector
              active={routeSelection === "finish"}
              label="도착"
              ready={planFinish !== null}
              onPress={() => setRouteSelection("finish")}
              styles={styles}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void setCurrentLocationAsStart()}
            style={styles.currentStart}
          >
            <Text style={styles.currentStartText}>현재 위치를 출발로</Text>
          </Pressable>
          {plannedRoute ? (
            <View style={styles.routeSummary}>
              <Text style={styles.routeSummaryValue}>{plannedRoute.distanceKm.toFixed(2)} KM</Text>
              <Text style={styles.routeSummaryMeta}>
                {formatDuration(plannedRoute.durationSeconds)} · 통행 제한과 보행로 반영
              </Text>
            </View>
          ) : null}
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          <PrimaryButton
            disabled={!planStart || !planFinish || planning}
            label={planning ? "ROUTING..." : plannedRoute ? "루트 다시 만들기" : "보행 루트 만들기"}
            onPress={() => void buildWalkingRoute()}
          />
          {plannedRoute ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setMode("track")}
              style={styles.textButton}
            >
              <Text style={styles.textButtonLabel}>이 루트로 GPS 기록 시작 →</Text>
            </Pressable>
          ) : null}
        </View>
      ) : mode === "route" && isAquatic ? (
        <View style={styles.deck}>
          <View style={styles.deckHeading}>
            <Text style={styles.deckTitle}>{sport === "swimming" ? "POOL MAP" : "DIVE MAP"}</Text>
            <Text style={styles.deckMeta}>OPTIONAL</Text>
          </View>
          <WorkoutMap
            backgroundColor={colors.map}
            compact
            currentPoint={undefined}
            isSample
            minimal
            places={selectedPlaces}
            points={[]}
            primaryColor={colors.primary}
          />
          <Link asChild href={getVenueSearchUrl(sport)}>
            <Pressable accessibilityRole="link" style={styles.venueLink}>
              <Text style={styles.venueLinkText}>실제 장소 검색 ↗</Text>
            </Pressable>
          </Link>
        </View>
      ) : mode === "route" || (mode === "track" && !isOutdoor) ? (
        <View style={styles.emptyDeck}>
          <Text style={styles.emptyDeckTitle}>NO ROUTE NEEDED</Text>
          <Text style={styles.emptyDeckText}>이 종목은 카메라 컷이 중심입니다.</Text>
          <Pressable accessibilityRole="button" onPress={() => setMode("photo")}>
            <Text style={styles.emptyDeckAction}>카메라 열기 →</Text>
          </Pressable>
        </View>
      ) : mode === "photo" ? (
        <View style={styles.deck}>
          <View style={styles.photoHero}>
            {photoUri ? (
              <Image
                accessibilityLabel="선택한 운동 사진"
                source={{ uri: photoUri }}
                style={styles.photo}
              />
            ) : (
              <View style={styles.photoEmpty}>
                <Text style={styles.photoEyebrow}>{photoHeadlines[sport]}</Text>
                <Text style={styles.photoEmptyTitle}>{proofPrompts[sport][0]}</Text>
              </View>
            )}
            <View style={styles.photoShade} />
            <Text style={styles.photoHeroLabel}>{photoPrompt}</Text>
          </View>
          <View style={styles.photoActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void choosePhoto("camera")}
              style={styles.photoPrimary}
            >
              <Text style={styles.photoPrimaryText}>촬영</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void choosePhoto("library")}
              style={styles.photoSecondary}
            >
              <Text style={styles.photoSecondaryText}>사진 선택</Text>
            </Pressable>
          </View>
          <View style={styles.promptRow}>
            {proofPrompts[sport].map((prompt) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: photoPrompt === prompt }}
                key={prompt}
                onPress={() => setPhotoPrompt(prompt)}
                style={[styles.promptChip, photoPrompt === prompt && styles.promptChipActive]}
              >
                <Text
                  style={[styles.promptText, photoPrompt === prompt && styles.promptTextActive]}
                >
                  {prompt}
                </Text>
              </Pressable>
            ))}
          </View>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
          <PrimaryButton
            disabled={workoutDone || savingWorkout}
            label={workoutDone ? "기록 저장됨" : savingWorkout ? "저장 중..." : "이 컷으로 기록"}
            onPress={() => void persistWorkout(photoPrompt)}
          />
        </View>
      ) : (
        <View style={styles.deck}>
          <Text style={styles.deckTitle}>MANUAL LOG</Text>
          <View style={styles.manualRow}>
            <TextInput
              accessibilityLabel="운동 시간"
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={setManualValue}
              style={styles.manualInput}
              value={manualValue}
            />
            <Text style={styles.manualUnit}>MIN</Text>
          </View>
          <PrimaryButton
            disabled={workoutDone || savingWorkout || !manualValue}
            label={workoutDone ? "기록 저장됨" : savingWorkout ? "저장 중..." : "기록 확정"}
            onPress={() => void persistWorkout(`${sportLabels[sport]} 직접 기록`)}
          />
        </View>
      )}

      <View style={styles.studioDivider} />
      <View style={styles.storyHeading}>
        <View>
          <Text style={styles.eyebrow}>STORY CUT</Text>
          <Text style={styles.storyTitle}>공개할 것만 남겨.</Text>
        </View>
        <Text style={styles.storyStatus}>{workoutDone ? "READY" : "EDITING"}</Text>
      </View>

      <StoryCanvas
        background={storyBackground}
        colors={colors}
        customText={storyText}
        distance={displayDistance.toFixed(2)}
        duration={formatDuration(displayDuration)}
        layers={storyLayers}
        moveScore={moveScore}
        pace={formatPace(paceSeconds)}
        photoUri={photoUri}
        routePoints={routeForStory}
        sportLabel={sportLabels[sport]}
        themeLabel={photoPrompt}
        visibility={visibility}
      />

      <ToolGroup label="BACKDROP">
        <ToolChip
          active={storyBackground === "photo"}
          label="PHOTO"
          onPress={() => setStoryBackground("photo")}
          styles={styles}
        />
        <ToolChip
          active={storyBackground === "map"}
          label="MAP"
          onPress={() => {
            setVisibility((current) => ({ ...current, route: true }));
            setStoryBackground("map");
          }}
          styles={styles}
        />
        <ToolChip
          active={storyBackground === "ink"}
          label="INK"
          onPress={() => setStoryBackground("ink")}
          styles={styles}
        />
      </ToolGroup>

      <ToolGroup label="LAYERS">
        {(["record", "route", "text", "points"] as StoryLayer[]).map((layer) => (
          <ToolChip
            active={storyLayers.includes(layer)}
            key={layer}
            label={{ record: "RECORD", route: "TRACE", text: "TEXT", points: "SCORE" }[layer]}
            onPress={() => toggleStoryLayer(layer)}
            styles={styles}
          />
        ))}
      </ToolGroup>

      {storyLayers.includes("text") ? (
        <TextInput
          accessibilityLabel="스토리 문구"
          maxLength={70}
          onChangeText={setStoryText}
          placeholder="YOUR LINE"
          placeholderTextColor={colors.muted}
          style={styles.storyInput}
          value={storyText}
        />
      ) : null}

      <View style={styles.privacyPanel}>
        <View style={styles.privacyHeading}>
          <Text style={styles.privacyTitle}>공개 범위</Text>
          <Text style={styles.privacyMeta}>피드에서 한 번 더 확인</Text>
        </View>
        <View style={styles.privacyRow}>
          {(
            [
              ["distance", "거리"],
              ["duration", "시간"],
              ["pace", "페이스"],
              ["route", "경로"],
              ["points", "점수"],
            ] as Array<[keyof StoryVisibility, string]>
          ).map(([key, label]) => (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: visibility[key] }}
              key={key}
              onPress={() => toggleVisibility(key)}
              style={[styles.privacyChip, visibility[key] && styles.privacyChipActive]}
            >
              <View style={[styles.privacyDot, visibility[key] && styles.privacyDotActive]} />
              <Text style={[styles.privacyText, visibility[key] && styles.privacyTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!readyToShare ? (
        <Text style={styles.shareHint}>
          {storyBackground === "photo" && !photoUri
            ? "PHOTO 배경에는 사진이 필요합니다."
            : "기록을 확정하세요."}
        </Text>
      ) : null}
      <PrimaryButton label="피드에서 마무리" disabled={!readyToShare} onPress={shareDraft} />
    </Screen>
  );
}

function Metric({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function RouteSelector({
  active,
  label,
  ready,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  ready: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.routeSelector}>
      <View style={[styles.routeSelectorDot, ready && styles.routeSelectorReady]} />
      <Text style={[styles.routeSelectorText, active && styles.routeSelectorTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TrackingControls({
  state,
  onStart,
  onPause,
  onResume,
  onFinish,
  onReset,
  styles,
}: {
  state: TrackingState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onReset: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (state === "idle") {
    return (
      <Pressable accessibilityRole="button" onPress={onStart} style={styles.trackPrimary}>
        <View style={styles.recordDot} />
        <Text style={styles.trackPrimaryText}>GPS START</Text>
      </Pressable>
    );
  }
  if (state === "finished") {
    return (
      <Pressable accessibilityRole="button" onPress={onReset} style={styles.trackFinished}>
        <Text style={styles.trackFinishedText}>REC SAVED · 다시 기록</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.trackRow}>
      <Pressable
        accessibilityRole="button"
        onPress={state === "recording" ? onPause : onResume}
        style={styles.trackSecondary}
      >
        <Text style={styles.trackSecondaryText}>{state === "recording" ? "PAUSE" : "RESUME"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onFinish} style={styles.trackPrimarySmall}>
        <Text style={styles.trackPrimaryText}>FINISH</Text>
      </Pressable>
    </View>
  );
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={baseStyles.toolGroup}>
      <Text style={baseStyles.toolLabel}>{label}</Text>
      <View style={baseStyles.toolRow}>{children}</View>
    </View>
  );
}

function ToolChip({
  active,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.toolChip, active && styles.toolChipActive]}
    >
      <Text style={[styles.toolChipText, active && styles.toolChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function isAquaticSport(sport: SportType): sport is "swimming" | "diving" {
  return aquaticSports.includes(sport);
}

function isMapPoint(point: MapPoint | null): point is MapPoint {
  return point !== null;
}

function getVenueSearchUrl(sport: SportType): `https://${string}` {
  const query = sport === "diving" ? "내 주변 다이빙풀 프리다이빙 센터" : "내 주변 수영장";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function toMapPoint(location: Location.LocationObject): MapPoint {
  return { latitude: location.coords.latitude, longitude: location.coords.longitude };
}

function appendPoint(points: MapPoint[], point: MapPoint) {
  const previous = points.at(-1);
  if (previous && distanceBetween(previous, point) < 0.003) return points;
  return [...points, point];
}

function calculateRouteDistance(points: MapPoint[]) {
  return points
    .slice(1)
    .reduce((total, point, index) => total + distanceBetween(points[index]!, point), 0);
}

function distanceBetween(start: MapPoint, finish: MapPoint) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(finish.latitude - start.latitude);
  const longitudeDelta = toRadians(finish.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const finishLatitude = toRadians(finish.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(finishLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPace(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--'--\"";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}'${String(seconds).padStart(2, "0")}"`;
}

function simplifyRoute(points: MapPoint[]) {
  if (points.length <= 40) return points;
  const interval = Math.ceil(points.length / 39);
  const simplified = points.filter((_, index) => index % interval === 0);
  const last = points.at(-1);
  if (last && simplified.at(-1) !== last) simplified.push(last);
  return simplified;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { gap: 5, marginBottom: 1 },
    eyebrow: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
    title: {
      color: colors.ink,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    sports: { flexDirection: "row", gap: 7, paddingRight: 18 },
    sportChip: {
      minHeight: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    sportChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    sportText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    sportTextActive: { color: colors.background },
    modeBar: {
      flexDirection: "row",
      borderRadius: 9,
      padding: 3,
      backgroundColor: colors.surfaceMuted,
    },
    modeButton: {
      flex: 1,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 7,
    },
    modeButtonActive: { backgroundColor: colors.surface },
    modeLabel: { color: colors.muted, fontSize: 10, fontWeight: "900" },
    modeLabelActive: { color: colors.ink },
    deck: { gap: 10 },
    deckHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    deckTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
    deckMeta: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.7 },
    metricsPanel: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    metricItem: { flex: 1, minHeight: 61, alignItems: "center", justifyContent: "center" },
    metricValue: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    metricLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", marginTop: 4 },
    planAttached: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
    error: { color: colors.danger, fontSize: 9, lineHeight: 14 },
    trackPrimary: {
      minHeight: 50,
      borderRadius: 9,
      backgroundColor: colors.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
    trackPrimaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 0.9 },
    trackRow: { flexDirection: "row", gap: 8 },
    trackSecondary: {
      flex: 1,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    trackSecondaryText: { color: colors.ink, fontSize: 9, fontWeight: "900" },
    trackPrimarySmall: {
      flex: 1.3,
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    trackFinished: {
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    trackFinishedText: { color: colors.primary, fontSize: 9, fontWeight: "900" },
    routeSelectors: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
    routeSelector: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 34 },
    routeSelectorDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.border,
    },
    routeSelectorReady: { backgroundColor: colors.primary, borderColor: colors.primary },
    routeSelectorText: { color: colors.muted, fontSize: 10, fontWeight: "900" },
    routeSelectorTextActive: { color: colors.ink },
    routeLine: { flex: 1, height: 1, backgroundColor: colors.border, marginHorizontal: 10 },
    currentStart: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
    currentStartText: { color: colors.primary, fontSize: 9, fontWeight: "900" },
    routeSummary: { borderRadius: 9, backgroundColor: colors.primarySoft, padding: 12 },
    routeSummaryValue: { color: colors.primary, fontSize: 18, fontWeight: "900" },
    routeSummaryMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
    textButton: { minHeight: 35, alignItems: "center", justifyContent: "center" },
    textButtonLabel: { color: colors.ink, fontSize: 9, fontWeight: "900" },
    venueLink: {
      minHeight: 46,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    venueLinkText: { color: colors.ink, fontSize: 9, fontWeight: "900" },
    emptyDeck: {
      minHeight: 174,
      borderRadius: 12,
      backgroundColor: colors.hero,
      padding: 20,
      justifyContent: "flex-end",
      gap: 7,
    },
    emptyDeckTitle: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    emptyDeckText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
    emptyDeckAction: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 9,
      fontWeight: "800",
      marginTop: 5,
    },
    photoHero: { height: 250, borderRadius: 12, overflow: "hidden", position: "relative" },
    photo: { width: "100%", height: "100%" },
    photoEmpty: { flex: 1, backgroundColor: colors.hero, padding: 20, justifyContent: "center" },
    photoEyebrow: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    photoEmptyTitle: {
      color: "#FFFFFF",
      fontSize: 25,
      lineHeight: 31,
      fontWeight: "900",
      marginTop: 6,
    },
    photoShade: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(0,0,0,0.18)",
    },
    photoHeroLabel: {
      position: "absolute",
      left: 16,
      bottom: 14,
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },
    photoActions: { flexDirection: "row", gap: 8 },
    photoPrimary: {
      flex: 1,
      minHeight: 46,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    photoPrimaryText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    photoSecondary: {
      flex: 1,
      minHeight: 46,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    photoSecondaryText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    promptRow: { flexDirection: "row", gap: 6 },
    promptChip: {
      flex: 1,
      minHeight: 43,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    promptChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    promptText: { color: colors.muted, fontSize: 8, fontWeight: "800", textAlign: "center" },
    promptTextActive: { color: colors.primary },
    manualRow: { flexDirection: "row", alignItems: "flex-end", paddingVertical: 30 },
    manualInput: {
      color: colors.ink,
      fontSize: 58,
      lineHeight: 65,
      fontWeight: "900",
      minWidth: 120,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    manualUnit: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      marginLeft: 9,
      marginBottom: 9,
    },
    studioDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    storyHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    storyTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
    storyStatus: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    toolChip: {
      minHeight: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    toolChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    toolChipText: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
    toolChipTextActive: { color: colors.background },
    storyInput: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.ink,
      paddingHorizontal: 12,
      fontSize: 11,
      fontWeight: "800",
    },
    privacyPanel: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    privacyHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    privacyTitle: { color: colors.ink, fontSize: 11, fontWeight: "900" },
    privacyMeta: { color: colors.muted, fontSize: 7 },
    privacyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    privacyChip: {
      minHeight: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
    },
    privacyChipActive: { backgroundColor: colors.primarySoft },
    privacyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    privacyDotActive: { backgroundColor: colors.primary },
    privacyText: { color: colors.muted, fontSize: 8, fontWeight: "800" },
    privacyTextActive: { color: colors.primary },
    shareHint: { color: colors.muted, fontSize: 8, marginTop: -4 },
  });
}

const baseStyles = StyleSheet.create({
  toolGroup: { gap: 8 },
  toolLabel: { color: "#8A8A86", fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
});
