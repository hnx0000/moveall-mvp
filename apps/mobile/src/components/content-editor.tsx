import {
  sportLabels,
  sportValues,
  type PostAudience,
  type PublicUser,
  type SharingCrew,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Map as MapIcon,
  Eye,
  EyeOff,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Check,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Plus,
  Type,
  Trash2,
  X,
} from "lucide-react-native";
import { Asset } from "expo-asset";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { captureRef } from "react-native-view-shot";
import sportLogoSheet from "../../assets/images/sport-logo-sheet.jpg";
import { api, usePreviewApi } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { uploadMediaAsset } from "../media/upload";
import { exportStudioImage, prepareStudioExport } from "../media/studio-export";
import { fonts } from "../theme";
import { useAppTheme } from "../theme-context";
import { CenterDialog } from "./ui";
import { SportLogo } from "./sport-logo";
import { StudioPhoto } from "./studio-photo";
import { StudioMap } from "./studio-map";
import { EditableLayer, RouteGraphic } from "./studio-layers";
import type { SnapGuides } from "./studio-snap";
import { hideDraggedLayer, isOverTrash, type LayerDrag, type TrashBounds } from "./studio-trash";
import { SAMPLE_RUNNING_WORKOUT } from "./studio-sample-workout";
import { audienceComplete, PostAudiencePicker } from "./post-audience-picker";
import {
  brandVisible,
  detachedRoute,
  layer,
  recordGroup,
  regroupRecord,
  ROUTE_ORANGE,
  SAMPLE_STUDIO_ROUTE,
  STUDIO_BACKGROUNDS,
  ungroupRecord,
  workoutMetricLayers,
  type StudioLayer,
  type XY,
} from "./record-studio-model";

type Step = "base" | "sport" | "record" | "edit" | "settings";
type Panel = "background" | "layers" | "selection" | null;
const NO_POINTS: NonNullable<WorkoutSession["routePoints"]> = [];
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export function ContentEditor({
  contentType = "post",
  directEditor: _directEditor = false,
  initialWorkoutId,
  initialCaption,
  initialPhoto,
  onClose,
  onPosted,
}: {
  contentType?: "post" | "story";
  directEditor?: boolean;
  initialWorkoutId?: string | undefined;
  initialCaption?: string | undefined;
  initialPhoto?: string | undefined;
  onClose: () => void;
  onPosted: () => Promise<unknown>;
}) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const window = useWindowDimensions();
  const [step, setStep] = useState<Step>("base");
  const [recordReturn, setRecordReturn] = useState<"base" | "edit">("edit");
  const [filter, setFilter] = useState("original");
  const [colorTools, setColorTools] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [sport, setSport] = useState<SportType>("running");
  const [background, setBackground] = useState<"solid" | "photo" | "map">(
    initialPhoto ? "photo" : "solid",
  );
  const [solid, setSolid] = useState<string>("#171513");
  const [photo, setPhoto] = useState<string | null>(initialPhoto ?? null);
  const [photoReset, setPhotoReset] = useState(0);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [recordMode, setRecordMode] = useState<"text" | "map" | "route">("text");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [layers, setLayers] = useState<StudioLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({});
  const [dragActive, setDragActive] = useState(false);
  const [trashHot, setTrashHot] = useState(false);
  const [hiddenMessage, setHiddenMessage] = useState<string | null>(null);
  const trashTarget = useRef<View>(null);
  const trashBounds = useRef<TrashBounds | null>(null);
  const dragId = useRef<string | null>(null);
  function measureTrash() {
    trashTarget.current?.measureInWindow((x, y, width, height) => {
      trashBounds.current = { x, y, width, height };
    });
  }
  function handleLayerDrag(event: LayerDrag) {
    if (event.phase === "move") {
      if (dragId.current !== event.origin.id) {
        dragId.current = event.origin.id;
        measureTrash();
        setHiddenMessage(null);
      }
      setDragActive(true);
      setTrashHot(isOverTrash(event.x, event.y, trashBounds.current));
      return;
    }
    if (event.phase === "end" && isOverTrash(event.x, event.y, trashBounds.current)) {
      setLayers((items) => hideDraggedLayer(items, event.origin));
      setSelectedId(null);
      setHiddenMessage(`${event.origin.label} 숨김 · 레이어의 눈 아이콘으로 다시 켤 수 있어요.`);
    }
    dragId.current = null;
    setDragActive(false);
    setTrashHot(false);
    setSnapGuides({});
  }
  const [sampleRoute, setSampleRoute] = useState(false);
  const [showBrand, setShowBrand] = useState(true);
  const [mapLabels, setMapLabels] = useState(false);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [mapRoute, setMapRoute] = useState<XY[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [routeDetached, setRouteDetached] = useState(true);
  const [imageReady, setImageReady] = useState(false);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [audience, setAudience] = useState<PostAudience>({ scope: "public" });
  const [commentAudience, setCommentAudience] = useState<PostAudience>({ scope: "public" });
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [crews, setCrews] = useState<SharingCrew[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [preparedExport, setPreparedExport] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [privacyAction, setPrivacyAction] = useState<"post" | "export" | null>(null);
  const canvas = useRef<View>(null);
  const points = sampleRoute ? SAMPLE_STUDIO_ROUTE : (workout?.routePoints ?? NO_POINTS);
  const freeRoute = useMemo(() => detachedRoute(points), [points]);
  const routeLayer = layers.find((entry) => entry.kind === "route");
  const group = layers.find((entry) => entry.kind === "group");
  const selected = layers.find((entry) => entry.id === selectedId);
  const lockedRoute = background === "map" && !routeDetached;
  const backgroundUri = background === "map" ? mapImage : photo;
  const ink = background === "solid" && solid === "#FFFFFF" ? "#171513" : "#FFFFFF";
  const hasArtwork = background !== "solid" || layers.some((entry) => entry.visible);
  const canCapture =
    (background === "solid" || Boolean(backgroundUri && imageReady)) && Boolean(sheetUri);
  const displayScale = Math.max(
    0.32,
    Math.min(
      (window.width - 32) / 360,
      (window.height - (step === "base" ? 290 : selected ? 330 : 190)) / 640,
      1,
    ),
  );
  const receiveMap = useCallback((uri: string, projected: XY[]) => {
    setMapImage(uri);
    setMapRoute(projected);
    setMapError(null);
  }, []);
  const failMap = useCallback((message: string) => setMapError(message), []);

  useEffect(() => {
    setImageReady(false);
  }, [backgroundUri]);
  useEffect(() => {
    setMapImage(null);
    setMapRoute([]);
    setMapError(null);
  }, [points, mapLabels, mapAttempt]);
  useEffect(() => {
    setPreparedExport(null);
  }, [layers, background, solid, photo, showBrand, mapImage, filter]);
  useEffect(() => {
    let active = true;
    void Asset.fromModule(sportLogoSheet as number)
      .downloadAsync()
      .then(async (asset) => {
        const result = await ImageManipulator.manipulateAsync(asset.localUri ?? asset.uri, [], {
          base64: true,
          format: ImageManipulator.SaveFormat.PNG,
        });
        if (active && result.base64) setSheetUri(`data:image/png;base64,${result.base64}`);
      })
      .catch(() => {
        if (active) setNotice("운동 로고를 불러오지 못했습니다. 편집기를 다시 열어 주세요.");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true;
    void Promise.all([
      api.socialSummary(session.accessToken),
      api.sharingCrews(session.accessToken),
    ])
      .then(([social, groups]) => {
        if (!active) return;
        setPeople([
          ...new Map(
            [...social.followers, ...social.following].map((person) => [person.id, person]),
          ).values(),
        ]);
        setCrews(groups);
      })
      .catch(() => {
        if (active) setLoadError("공개 대상 목록을 불러오지 못했습니다. 다시 열어 주세요.");
      });
    if (initialWorkoutId)
      void api
        .workouts(session.accessToken)
        .then((items) => {
          if (!active) return;
          const item = items.find((entry) => entry.id === initialWorkoutId);
          if (item) {
            setWorkout(item);
            setSport(item.sport);
            setLayers([recordGroup(item)]);
          }
        })
        .catch(() => {
          if (active) setNotice("기록을 가져오지 못했습니다. 기록 목록에서 다시 선택해 주세요.");
        });
    return () => {
      active = false;
    };
  }, [session, initialWorkoutId]);

  const notifyError = (error: unknown, fallback: string) => {
    setPanel(null);
    setNotice(error instanceof Error ? error.message : fallback);
  };
  function updateLayer(id: string, patch: Partial<StudioLayer>) {
    setLayers((items) =>
      items.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              scale: Math.max(0.15, Math.min(6, patch.scale ?? entry.scale)),
              ...(patch.color && entry.children
                ? { children: entry.children.map((child) => ({ ...child, color: patch.color! })) }
                : {}),
            }
          : entry,
      ),
    );
  }
  function chooseSolid(color: string) {
    setSolid(color);
    setBackground("solid");
    setRouteDetached(true);
    const nextInk = color === "#FFFFFF" ? "#171513" : "#FFFFFF";
    setLayers((items) =>
      items.map((entry) => ({
        ...entry,
        color: entry.kind === "route" ? ROUTE_ORANGE : nextInk,
        ...(entry.children
          ? { children: entry.children.map((child) => ({ ...child, color: nextInk })) }
          : {}),
      })),
    );
    setPanel(null);
  }
  async function choosePhoto(kind: "camera" | "gallery") {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      if (Platform.OS !== "web") {
        const permission =
          kind === "camera"
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            kind === "camera" ? "카메라 접근을 허용해 주세요." : "사진 접근을 허용해 주세요.",
          );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 1,
      };
      const result =
        kind === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const optimized = await ImageManipulator.manipulateAsync(
        asset.uri,
        asset.width > 1920 ? [{ resize: { width: 1920 } }] : [],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      setPhoto(optimized.uri);
      setBackground("photo");
      setRouteDetached(true);
      setPanel(null);
    } catch (error) {
      notifyError(error, "사진을 가져오지 못했습니다.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function openRecords(nextSport = sport) {
    setSport(nextSport);
    setStep("record");
    setPanel(null);
    setLoading(true);
    setLoadError(null);
    if (!session) {
      setLoading(false);
      setLoadError("로그인 후 기록을 가져올 수 있습니다.");
      return;
    }
    try {
      setWorkouts(
        (await api.workouts(session.accessToken)).sort(
          (a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt),
        ),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  function attachWorkout(item: WorkoutSession) {
    if (recordMode !== "text" && (item.routePoints?.length ?? 0) < 2) {
      setNotice("이 기록에는 GPS 경로가 없습니다. 텍스트 기록으로 가져와 주세요.");
      return;
    }
    setWorkout(item);
    setSport(item.sport);
    setSampleRoute(item.id === SAMPLE_RUNNING_WORKOUT.id);
    setSelectedId(null);
    const route = {
      ...layer("route", "route", "", "GPS 루트", 180, 236, 180, 200),
      color: ROUTE_ORANGE,
      visible: (item.routePoints?.length ?? 0) > 1,
    };
    setLayers((items) =>
      recordMode === "route"
        ? [...items.filter((entry) => entry.kind !== "route"), route]
        : [
            ...items.filter((entry) => entry.kind === "text"),
            recordGroup(item, recordMode === "map" ? "#FFFFFF" : ink),
            route,
          ],
    );
    if (recordMode === "route") setSelectedId(route.id);
    if (recordMode === "map") {
      setBackground("map");
      setRouteDetached(true);
    }
    setStep(recordReturn);
  }
  function toggleSample() {
    const enabled = !sampleRoute;
    setSampleRoute(enabled);
    setLayers((items) => [
      ...items.filter((entry) => entry.kind !== "route"),
      {
        ...layer("route", "route", "", "GPS 루트", 180, 236, 180, 200),
        color: ROUTE_ORANGE,
        visible: enabled || (workout?.routePoints?.length ?? 0) > 1,
      },
    ]);
    if (!enabled && (workout?.routePoints?.length ?? 0) < 2 && background === "map")
      setBackground("solid");
  }
  function clearWorkout(nextSport = sport) {
    setWorkout(null);
    setSport(nextSport);
    setSampleRoute(false);
    setSelectedId(null);
    if (background === "map") setBackground(photo ? "photo" : "solid");
    setLayers((items) => [
      ...items.filter((entry) => entry.kind === "text"),
      { ...layer("sport", "sport", "", "종목 로고", 48, 552, 44, 44), color: ink },
    ]);
  }
  function toggleMetric(id: string) {
    if (!workout) return;
    if (!group) {
      const metric = layers.find((entry) => entry.id === id);
      if (metric) updateLayer(id, { visible: !metric.visible });
      return;
    }
    setLayers((items) =>
      items.map((entry) =>
        entry.id === group.id
          ? {
              ...entry,
              children: (entry.children ?? []).map((child) =>
                child.id === id ? { ...child, visible: !child.visible } : child,
              ),
            }
          : entry,
      ),
    );
  }
  function toggleRecordGrouping() {
    setSelectedId(null);
    setSnapGuides({});
    setLayers((items) => {
      const current = items.find((entry) => entry.kind === "group");
      if (current)
        return items.flatMap((entry) =>
          entry.id === current.id ? ungroupRecord(entry, true) : [entry],
        );
      const children = items.filter((entry) => ["metric", "sport", "brand"].includes(entry.kind));
      if (!children.length) return items;
      const grouped = regroupRecord(children);
      return [...items.filter((entry) => !children.includes(entry)), grouped];
    });
  }
  async function capture(external = false) {
    if (!canCapture)
      throw new Error("사진 또는 지도를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.");
    const returnStep = step;
    setSnapGuides({});
    setStep("edit");
    setPanel(null);
    setSelectedId(null);
    setExporting(external);
    await frame();
    try {
      return await captureRef(canvas, {
        format: external ? "png" : "jpg",
        quality: 0.94,
        result: Platform.OS === "web" ? "data-uri" : "tmpfile",
        width: 1080,
        height: 1920,
      });
    } finally {
      setExporting(false);
      setStep(returnStep);
    }
  }
  async function nextToSettings() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      setPreview(hasArtwork ? await capture() : null);
      setStep("settings");
    } catch (error) {
      notifyError(error, "미리보기를 만들지 못했습니다.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function perform(action: "post" | "export") {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPrivacyAction(null);
    try {
      if (action === "export") {
        const uri = await capture(true);
        await prepareStudioExport(uri);
        setPreparedExport(uri);
        return;
      }
      if (contentType === "post" && (!workout || workout.id === SAMPLE_RUNNING_WORKOUT.id))
        throw new Error("피드 게시물에는 실제로 저장된 운동 기록을 하나 이상 연결해 주세요.");
      if (!preview && !caption.trim())
        throw new Error("본문을 작성하거나 편집 화면에서 콘텐츠를 추가해 주세요.");
      if (!audienceComplete(audience) || !audienceComplete(commentAudience))
        throw new Error("공개할 대상을 선택해 주세요.");
      let mediaId: string | undefined;
      if (preview && !usePreviewApi)
        mediaId = (
          await uploadMediaAsset({
            token: session.accessToken,
            uri: preview,
            kind: contentType === "story" ? "story-image" : "post-image",
            contentType: "image/jpeg",
            byteSize: 0,
          })
        ).mediaId;
      await api.createPost(
        session.accessToken,
        {
          sport,
          contentType,
          content:
            caption.trim() || `${sportLabels[sport]} · ${workout ? "운동 기록" : "오늘의 순간"}`,
          audience,
          commentAudience,
          ...(workout && workout.id !== SAMPLE_RUNNING_WORKOUT.id
            ? { workoutSessionId: workout.id }
            : {}),
          ...(mediaId ? { mediaId } : {}),
        },
        usePreviewApi ? (preview ?? undefined) : undefined,
      );
      await onPosted();
    } catch (error) {
      notifyError(error, "게시하지 못했습니다. 편집 내용은 그대로 유지됩니다.");
    } finally {
      setExporting(false);
      busyRef.current = false;
      setBusy(false);
    }
  }
  function requestAction(action: "post" | "export") {
    if (points.length > 1 && !sampleRoute && (background === "map" || routeLayer?.visible))
      setPrivacyAction(action);
    else void perform(action);
  }
  function back() {
    if (busy) return;
    if (step === "settings") {
      setStep("edit");
      return;
    }
    if (step === "record") {
      setStep(recordReturn);
      return;
    }
    if (step === "sport") {
      setStep("edit");
      return;
    }
    if (step === "edit") {
      setSelectedId(null);
      setStep("base");
      return;
    }
    if (hasArtwork || caption.trim()) setConfirmClose(true);
    else onClose();
  }
  const text = (value: string, muted = false) => (
    <Text style={[s.body, { color: muted ? colors.muted : colors.ink }]}>{value}</Text>
  );
  const button = (value: string, press: () => void, active = false, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={press}
      style={[
        s.chip,
        {
          backgroundColor: active ? colors.primarySoft : colors.surface,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={[s.label, { color: active ? colors.primary : colors.ink }]}>{value}</Text>
    </Pressable>
  );
  const primary = (value: string, press: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={press}
      style={[s.primary, { backgroundColor: colors.primary, opacity: busy || disabled ? 0.4 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>{value}</Text>}
    </Pressable>
  );
  const paint = (entry: StudioLayer) => (
    <EditableLayer
      key={entry.id}
      item={entry}
      sport={sport}
      route={freeRoute}
      selected={selectedId === entry.id && !busy}
      displayScale={displayScale}
      interactive={!busy && step === "edit" && selectedId !== "photo"}
      sheetUri={sheetUri}
      onSelect={() => setSelectedId(entry.id)}
      onChange={(patch) => updateLayer(entry.id, patch)}
      showBrand={showBrand && !exporting}
      snapEnabled={snapEnabled}
      siblings={layers.filter((item) => showBrand || item.kind !== "brand")}
      onSnapGuides={setSnapGuides}
      onDrag={handleLayerDrag}
    />
  );
  const canvasView = (
    <View
      style={{
        width: 360 * displayScale,
        height: 640 * displayScale,
        overflow: "hidden",
        borderRadius: 16,
        alignSelf: "center",
      }}
    >
      <View
        style={{
          width: 360,
          height: 640,
          transformOrigin: "top left",
          transform: [{ scale: busy && Platform.OS === "web" ? 1 : displayScale }],
        }}
      >
        {background === "map" && points.length > 1 && !mapImage ? (
          <StudioMap
            key={`${sampleRoute ? "sample" : workout?.id}-${mapLabels}-${mapAttempt}`}
            points={points}
            labels={mapLabels}
            onSnapshot={receiveMap}
            onError={failMap}
          />
        ) : null}
        <View ref={canvas} collapsable={false} style={[s.canvas, { backgroundColor: solid }]}>
          {background === "photo" && photo ? (
            <StudioPhoto
              key={`${photo}-${photoReset}`}
              uri={photo}
              editing={step === "base" && !busy}
              displayScale={displayScale}
              onLoad={() => setImageReady(true)}
              onError={() => {
                setImageReady(false);
                setNotice("사진을 읽지 못했습니다. 다시 선택해 주세요.");
              }}
              onEdit={() => setPreparedExport(null)}
            />
          ) : background === "map" && mapImage ? (
            <Image
              source={{ uri: mapImage }}
              resizeMode="cover"
              onLoad={() => setImageReady(true)}
              onError={() => setMapError("지도를 읽지 못했습니다.")}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          {background !== "solid" && filter !== "original" ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor:
                    filter === "warm" ? "#FF9B4533" : filter === "cool" ? "#457AFF33" : "#00000055",
                },
              ]}
            />
          ) : null}
          {lockedRoute && routeLayer?.visible ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <RouteGraphic points={mapRoute} width={360} height={640} />
            </View>
          ) : null}
          {layers
            .filter(
              (entry) =>
                entry.visible &&
                !(entry.kind === "route" && lockedRoute) &&
                (showBrand || entry.kind !== "brand"),
            )
            .map(paint)}
          {!busy && !exporting && step === "edit" && snapEnabled ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {snapGuides.x !== undefined ? (
                <View
                  style={{
                    position: "absolute",
                    left: snapGuides.x,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: "#FA67D5",
                  }}
                />
              ) : null}
              {snapGuides.y !== undefined ? (
                <View
                  style={{
                    position: "absolute",
                    top: snapGuides.y,
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: "#FA67D5",
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {brandVisible(showBrand, exporting) &&
          (exporting || (!group && !layers.some((entry) => entry.kind === "brand"))) ? (
            <Text pointerEvents="none" style={[s.brand, { color: ink }]}>
              GROOV
            </Text>
          ) : null}
          {workout?.id === SAMPLE_RUNNING_WORKOUT.id ||
          (sampleRoute && (routeLayer?.visible || background === "map")) ? (
            <Text style={s.sampleBadge}>예시 루트 · 실제 운동 기록 아님</Text>
          ) : null}
          {background === "map" ? (
            <Text pointerEvents="none" style={s.credit}>
              {Platform.OS === "web"
                ? "© OpenMapTiles · © OpenStreetMap contributors"
                : Platform.OS === "ios"
                  ? "Maps © Apple"
                  : "Map data © Google"}
            </Text>
          ) : null}
        </View>
        {!hasArtwork && background !== "solid" && !busy ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.center]}>
            <Plus size={32} color={colors.muted} />
            <Text style={[s.empty, { color: colors.muted }]}>
              사진을 더하거나{"\n"}기록만 담아도 좋아요.
            </Text>
          </View>
        ) : null}
        {background === "map" && !mapImage ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.center]}>
            {mapError ? (
              <Text style={s.empty}>{mapError}</Text>
            ) : (
              <ActivityIndicator color={colors.primary} />
            )}
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === "base" ? "편집 닫기" : "이전 단계"}
          onPress={back}
          disabled={busy}
          hitSlop={12}
        >
          <ArrowLeft color={colors.ink} size={22} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={[s.heading, { color: colors.ink }]}>
            {contentType === "story" ? "새 스토리" : "새 게시물"}
          </Text>
          <Text style={[s.meta, { color: colors.muted }]}>
            {step === "base"
              ? "01 / 배경"
              : step === "sport"
                ? "종목"
                : step === "record"
                  ? "운동 기록"
                  : step === "edit"
                    ? "02 / 자유 편집"
                    : "게시 설정"}
            {contentType === "story" ? " · 24시간" : ""}
          </Text>
        </View>
        {step === "edit" || step === "base" ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || (hasArtwork && !canCapture)}
            onPress={() => {
              setSelectedId(null);
              if (step === "base") setStep("edit");
              else void nextToSettings();
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            hitSlop={10}
          >
            <Text
              style={[
                s.label,
                { color: colors.primary, opacity: hasArtwork && !canCapture ? 0.4 : 1 },
              ]}
            >
              다음
            </Text>
            <ArrowRight size={20} color={colors.primary} />
          </Pressable>
        ) : step === "settings" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="게시물 공유"
            disabled={
              busy ||
              !session ||
              (!preview && !caption.trim()) ||
              !audienceComplete(audience) ||
              !audienceComplete(commentAudience)
            }
            onPress={() => requestAction("post")}
            hitSlop={10}
          >
            <Text style={[s.label, { color: colors.primary }]}>{busy ? "공유 중" : "공유"}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>
      {step === "sport" ? (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={[s.title, { color: colors.ink }]}>어떤 운동을 담을까요?</Text>
          <View style={s.sports}>
            {sportValues.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: sport === value }}
                onPress={() => {
                  if (value !== sport) clearWorkout(value);
                }}
                style={[
                  s.sport,
                  {
                    backgroundColor: sport === value ? colors.primarySoft : colors.surface,
                    borderColor: sport === value ? colors.primary : colors.border,
                  },
                ]}
              >
                <SportLogo sport={value} selected={sport === value} size={44} />
                <Text style={[s.label, { color: sport === value ? colors.primary : colors.ink }]}>
                  {sportLabels[value]}
                </Text>
              </Pressable>
            ))}
          </View>
          {primary("기록 선택으로", () => void openRecords())}
        </ScrollView>
      ) : null}
      {step === "record" ? (
        <ScrollView contentContainerStyle={s.page}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {sportValues.map((value) => (
              <View key={value}>
                {button(sportLabels[value], () => setSport(value), sport === value)}
              </View>
            ))}
          </ScrollView>
          <View style={s.row}>
            {button("텍스트 기록", () => setRecordMode("text"), recordMode === "text")}
            {button("지도 기록", () => setRecordMode("map"), recordMode === "map")}
            {button("루트만", () => setRecordMode("route"), recordMode === "route")}
          </View>
          <Text style={[s.title, { color: colors.ink }]}>{sportLabels[sport]} 기록 가져오기</Text>
          {sport === "running" ? (
            <View style={[s.record, { borderColor: colors.primary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.ink }]}>테스트 러닝 · 호수 한 바퀴</Text>
                <Text style={[s.meta, { color: colors.muted }]}>
                  예시 GPS 경로 · 편집 전용 · 기록/메달에 저장되지 않음
                </Text>
                {button("테스트 러닝 가져오기", () => attachWorkout(SAMPLE_RUNNING_WORKOUT))}
              </View>
            </View>
          ) : null}
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : loadError ? (
            <>
              {text(loadError, true)}
              {button("다시 불러오기", () => void openRecords())}
            </>
          ) : (
            workouts
              .filter((item) => item.sport === sport)
              .map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => attachWorkout(item)}
                  style={[s.record, { borderColor: colors.border }]}
                >
                  <SportLogo sport={item.sport} selected={false} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.label, { color: colors.ink }]}>
                      {new Date(item.endedAt).toLocaleDateString("ko-KR")}
                    </Text>
                    <Text style={[s.meta, { color: colors.muted }]} numberOfLines={2}>
                      {workoutMetricLayers(item)
                        .slice(0, 3)
                        .map((metric) => metric.text)
                        .join(" · ")}
                    </Text>
                    <Text style={[s.meta, { color: colors.muted }]}>
                      {(item.routePoints?.length ?? 0) > 1 ? "GPS 루트 있음" : "GPS 루트 없음"}
                    </Text>
                  </View>
                  <ChevronRight color={colors.muted} size={20} />
                </Pressable>
              ))
          )}
          {!loading && !loadError && !workouts.some((item) => item.sport === sport)
            ? text("아직 이 종목의 기록이 없습니다.", true)
            : null}
          {button("기록 없이 편집", () => {
            clearWorkout();
            setStep(recordReturn);
          })}
        </ScrollView>
      ) : null}
      {/* Keep the live canvas mounted at the last step so edits, photo crops and exports never reset. */}
      <View
        style={step === "edit" || step === "base" ? s.editArea : s.hiddenCanvas}
        pointerEvents={step === "edit" || step === "base" ? "auto" : "none"}
      >
        <ScrollView
          contentContainerStyle={{ padding: 12, gap: 8, flexGrow: 1, justifyContent: "center" }}
          scrollEnabled={false}
          keyboardShouldPersistTaps="handled"
        >
          {canvasView}
          {hiddenMessage ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[s.meta, { color: colors.muted, textAlign: "center" }]}
            >
              {hiddenMessage}
            </Text>
          ) : null}
          {step === "edit" ? (
            <View style={[s.row, { justifyContent: "center", flexWrap: "wrap" }]}>
              {workout && layers.some((entry) => entry.kind === "group" || entry.kind === "metric")
                ? button(
                    group ? "기록: 한 덩어리 → 개별 편집" : "기록: 개별 → 한 덩어리",
                    toggleRecordGrouping,
                    Boolean(group),
                  )
                : null}
              {button(
                snapEnabled ? "자석 ON" : "자석 OFF",
                () => {
                  setSnapEnabled(!snapEnabled);
                  setSnapGuides({});
                },
                snapEnabled,
              )}
            </View>
          ) : null}
          {mapError && background === "map"
            ? button("지도 다시 불러오기", () => setMapAttempt((value) => value + 1))
            : null}
          <Text style={[s.meta, { color: colors.muted, textAlign: "center" }]}>
            {step === "base"
              ? "드래그로 이동 · 두 손가락으로 확대와 회전"
              : "선택해서 이동 · 두 손가락으로 크기와 회전 조절"}
          </Text>
        </ScrollView>
        {step === "base" ? (
          <View style={{ alignItems: "center", gap: 8, padding: 12 }}>
            <View style={s.row}>
              {[
                { icon: Camera, label: "사진 촬영", action: () => void choosePhoto("camera") },
                { icon: ImageIcon, label: "갤러리", action: () => void choosePhoto("gallery") },
                {
                  icon: MapIcon,
                  label: "지도",
                  action: () => {
                    if (points.length > 1) {
                      setBackground("map");
                      setRouteDetached(true);
                    } else {
                      setRecordMode("map");
                      setRecordReturn("base");
                      void openRecords();
                    }
                  },
                },
              ].map((tool) => (
                <Pressable
                  key={tool.label}
                  accessibilityRole="button"
                  accessibilityLabel={tool.label}
                  disabled={busy}
                  onPress={tool.action}
                  style={[
                    s.baseTool,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <tool.icon size={21} color={colors.ink} />
                </Pressable>
              ))}
            </View>
            <View style={s.row}>
              {STUDIO_BACKGROUNDS.map((entry) => (
                <Pressable
                  key={entry.color}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.label} 배경`}
                  accessibilityState={{ selected: background === "solid" && solid === entry.color }}
                  onPress={() => chooseSolid(entry.color)}
                  style={[
                    s.baseTool,
                    {
                      backgroundColor: entry.color,
                      borderColor:
                        background === "solid" && solid === entry.color
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  {background === "solid" && solid === entry.color ? (
                    <Check size={18} color={entry.ink} />
                  ) : null}
                </Pressable>
              ))}
            </View>
            {background !== "solid" ? (
              <View style={s.row}>
                {[
                  { id: "original", name: "원본" },
                  { id: "warm", name: "웜" },
                  { id: "cool", name: "쿨" },
                  { id: "dim", name: "무드" },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === item.id }}
                    onPress={() => setFilter(item.id)}
                    style={{ padding: 10 }}
                  >
                    <Text
                      style={[
                        s.meta,
                        { color: filter === item.id ? colors.primary : colors.muted },
                      ]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <>
            {selected ? (
              <View style={{ paddingHorizontal: 16, gap: 8 }}>
                {selected.kind === "text" ? (
                  <>
                    <TextInput
                      accessibilityLabel="사진 위 텍스트"
                      value={selected.text}
                      onChangeText={(value) =>
                        updateLayer(selected.id, {
                          text: value,
                          height: Math.max(40, value.split("\n").length * 32),
                        })
                      }
                      multiline
                      maxLength={400}
                      placeholder="텍스트 입력"
                      placeholderTextColor={colors.muted}
                      style={{
                        color: colors.ink,
                        fontSize: 16,
                        padding: 8,
                        fontFamily: fonts.regular,
                      }}
                    />
                    <View style={[s.row, { justifyContent: "center" }]}>
                      {button("A−", () =>
                        updateLayer(selected.id, { scale: selected.scale - 0.1 }),
                      )}
                      {button("A+", () =>
                        updateLayer(selected.id, { scale: selected.scale + 0.1 }),
                      )}
                      {button("↶", () =>
                        updateLayer(selected.id, { rotation: selected.rotation - 5 }),
                      )}
                      {button("↷", () =>
                        updateLayer(selected.id, { rotation: selected.rotation + 5 }),
                      )}
                    </View>
                  </>
                ) : null}
                <View style={[s.row, { justifyContent: "center" }]}>
                  {(
                    [
                      { align: "left", icon: AlignLeft },
                      { align: "center", icon: AlignCenter },
                      { align: "right", icon: AlignRight },
                    ] as const
                  ).map((tool) => (
                    <Pressable
                      key={tool.align}
                      accessibilityLabel={`${tool.align === "left" ? "왼쪽" : tool.align === "center" ? "가운데" : "오른쪽"} 정렬`}
                      onPress={() =>
                        updateLayer(selected.id, {
                          textAlign: tool.align,
                          x:
                            tool.align === "center"
                              ? 180
                              : tool.align === "left"
                                ? (selected.width * selected.scale) / 2
                                : 360 - (selected.width * selected.scale) / 2,
                        })
                      }
                      style={{ padding: 10 }}
                    >
                      <tool.icon size={20} color={colors.ink} />
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityLabel="색상 도구"
                    onPress={() => setColorTools(!colorTools)}
                    style={{ padding: 10 }}
                  >
                    <Palette size={20} color={colorTools ? colors.primary : colors.ink} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={selected.visible ? "선택 요소 숨기기" : "선택 요소 표시"}
                    onPress={() => updateLayer(selected.id, { visible: !selected.visible })}
                    style={{ padding: 10 }}
                  >
                    {selected.visible ? (
                      <Eye size={20} color={colors.ink} />
                    ) : (
                      <EyeOff size={20} color={colors.muted} />
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityLabel="선택 완료"
                    onPress={() => setSelectedId(null)}
                    style={{ padding: 10 }}
                  >
                    <Check size={20} color={colors.primary} />
                  </Pressable>
                </View>
                {colorTools ? (
                  <View style={[s.row, { justifyContent: "center" }]}>
                    {["#FFFFFF", "#171513", ROUTE_ORANGE, "#FFD86B", "#B7D9FF"].map((color) => (
                      <Pressable
                        key={color}
                        accessibilityLabel={`${color} 요소 색상`}
                        onPress={() => updateLayer(selected.id, { color })}
                        style={[
                          s.color,
                          {
                            width: 28,
                            height: 28,
                            backgroundColor: color,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
            <View style={[s.toolbar, { borderColor: colors.border }]}>
              {[
                {
                  icon: SportLogo,
                  label: "기록",
                  action: () => {
                    setRecordReturn("edit");
                    setRecordMode("text");
                    void openRecords();
                  },
                },
                {
                  icon: MapIcon,
                  label: "루트",
                  action: () => {
                    if (routeLayer && points.length > 1) {
                      setRouteDetached(true);
                      updateLayer(routeLayer.id, { visible: true });
                      setSelectedId(routeLayer.id);
                    } else {
                      setRecordReturn("edit");
                      setRecordMode("route");
                      void openRecords();
                    }
                  },
                },
                {
                  icon: Type,
                  label: "텍스트",
                  action: () => {
                    const entry = {
                      ...layer(
                        `text-${Date.now()}`,
                        "text",
                        "나의 움직임",
                        "텍스트",
                        180,
                        260,
                        300,
                        90,
                      ),
                      color: ink,
                    };
                    setLayers((items) => [...items, entry]);
                    setSelectedId(entry.id);
                  },
                },
                { icon: Layers, label: "레이어", action: () => setPanel("layers") },
              ].map((tool) => (
                <Pressable
                  key={tool.label}
                  accessibilityRole="button"
                  onPress={tool.action}
                  disabled={busy}
                  style={s.tool}
                >
                  {tool.label === "기록" ? (
                    <SportLogo sport={sport} selected={false} size={25} />
                  ) : (
                    <tool.icon size={23} color={colors.ink} selected={false} sport={sport} />
                  )}
                  <Text style={[s.meta, { color: colors.ink }]}>{tool.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
      {step === "settings" ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
          <View style={s.captionRow}>
            {preview ? (
              <Image source={{ uri: preview }} resizeMode="cover" style={s.thumbnail} />
            ) : (
              <View style={[s.thumbnail, s.center, { backgroundColor: colors.surface }]}>
                <Type color={colors.muted} />
              </View>
            )}
            <TextInput
              accessibilityLabel="게시물 코멘트 및 본문"
              placeholder="코멘트를 남겨보세요. #나의그루브"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={2000}
              value={caption}
              onChangeText={setCaption}
              style={[s.caption, { color: colors.ink }]}
            />
          </View>
          <View style={s.row}>
            {[...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])].map((tag) => (
              <Text key={tag} style={[s.meta, { color: colors.primary }]}>
                {tag}
              </Text>
            ))}
          </View>
          <PostAudiencePicker
            label="게시물 공개 범위"
            value={audience}
            onChange={setAudience}
            people={people}
            crews={crews}
            onError={setNotice}
            onCreateCrew={async (name, memberIds) => {
              const crew = await api.createSharingCrew(session!.accessToken, { name, memberIds });
              setCrews((items) => [...items, crew]);
              return crew;
            }}
          />
          <PostAudiencePicker
            label="댓글 허용 범위"
            value={commentAudience}
            onChange={setCommentAudience}
            people={people}
            crews={crews}
            comments
            onError={setNotice}
            onCreateCrew={async (name, memberIds) => {
              const crew = await api.createSharingCrew(session!.accessToken, { name, memberIds });
              setCrews((items) => [...items, crew]);
              return crew;
            }}
          />
          {text("댓글은 게시물을 볼 수 있는 사람 중 선택한 범위에만 허용돼요.", true)}
          {contentType === "story"
            ? text("게시 후 24시간 동안 스토리에 표시됩니다. 일반 피드에는 올라가지 않아요.", true)
            : null}
          {loadError ? text(loadError, true) : null}
          {primary(
            contentType === "story" ? "스토리 게시" : "게시물 공유",
            () => requestAction("post"),
            !session ||
              (!preview && !caption.trim()) ||
              !audienceComplete(audience) ||
              !audienceComplete(commentAudience),
          )}
          {preview ? button("외부 공유용 이미지 만들기", () => requestAction("export")) : null}
          {preparedExport ? (
            <View style={{ gap: 12 }}>
              <Image
                source={{ uri: preparedExport }}
                resizeMode="contain"
                style={{ width: "100%", aspectRatio: 9 / 16, maxHeight: 360 }}
              />
              {primary(
                "이미지 저장 / 외부로 공유",
                () =>
                  void exportStudioImage(preparedExport).catch((error) =>
                    notifyError(error, "공유 창을 열지 못했습니다."),
                  ),
              )}
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <View style={s.backdrop}>
          <SafeAreaView style={[s.sheet, { backgroundColor: colors.background }]}>
            <View style={s.sheetHeader}>
              <Text style={[s.heading, { color: colors.ink }]}>
                {panel === "background"
                  ? "배경"
                  : panel === "layers"
                    ? "레이어"
                    : `${selected?.label ?? "요소"} 편집`}
              </Text>
              <Pressable accessibilityLabel="도구 닫기" onPress={() => setPanel(null)} hitSlop={12}>
                <X color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 18, gap: 16 }}
            >
              {panel === "background" ? (
                <>
                  <View style={s.row}>
                    {button("사진 촬영", () => void choosePhoto("camera"))}
                    {button("갤러리", () => void choosePhoto("gallery"))}
                  </View>
                  <View style={s.row}>
                    {STUDIO_BACKGROUNDS.map((entry) => (
                      <Pressable
                        key={entry.color}
                        accessibilityLabel={`${entry.label} 배경`}
                        onPress={() => chooseSolid(entry.color)}
                        style={[
                          s.swatch,
                          {
                            backgroundColor: entry.color,
                            borderColor:
                              solid === entry.color && background === "solid"
                                ? colors.primary
                                : colors.border,
                          },
                        ]}
                      >
                        <Text style={[s.meta, { color: entry.ink }]}>{entry.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {button(
                    "운동 지도 배경",
                    () => {
                      if (points.length < 2) {
                        setPanel(null);
                        setNotice(
                          "먼저 GPS가 있는 기록을 가져오거나 레이어에서 예시 루트를 선택해 주세요.",
                        );
                        return;
                      }
                      setBackground("map");
                      setRouteDetached(false);
                      setPanel(null);
                    },
                    background === "map",
                  )}
                  {background === "photo" ? (
                    <View style={s.row}>
                      {button("사진 구도 조절", () => {
                        setSelectedId("photo");
                        setPanel(null);
                      })}
                      {button("사진 구도 초기화", () => setPhotoReset((value) => value + 1))}
                    </View>
                  ) : null}
                  {background === "map" ? (
                    <View style={s.switchRow}>
                      {text("최소 지명 표시")}
                      <Switch
                        value={mapLabels}
                        onValueChange={setMapLabels}
                        trackColor={{ true: colors.primary, false: colors.border }}
                      />
                    </View>
                  ) : null}
                </>
              ) : panel === "layers" ? (
                <>
                  <View style={s.switchRow}>
                    {text("GROOV 로고")}
                    <Pressable
                      accessibilityLabel="GROOV 로고 표시"
                      accessibilityRole="button"
                      onPress={() => setShowBrand(!showBrand)}
                      style={{ padding: 10 }}
                    >
                      {showBrand ? (
                        <Eye size={21} color={colors.ink} />
                      ) : (
                        <EyeOff size={21} color={colors.muted} />
                      )}
                    </Pressable>
                  </View>
                  {text("외부로 저장·공유할 때는 우측 상단에 로고가 표시돼요.", true)}
                  {!group && !layers.some((entry) => entry.kind === "sport")
                    ? button("종목 로고 추가", () =>
                        setLayers((items) => [
                          ...items,
                          {
                            ...layer("sport", "sport", "", "종목 로고", 48, 552, 44, 44),
                            color: ink,
                          },
                        ]),
                      )
                    : null}
                  {workout ? (
                    <>
                      <Text style={[s.label, { color: colors.ink }]}>보여줄 기록</Text>
                      <View style={s.row}>
                        {workoutMetricLayers(workout).map((metric) => (
                          <View key={metric.id}>
                            {button(
                              metric.label,
                              () => toggleMetric(metric.id),
                              Boolean(
                                (group?.children ?? layers).find((entry) => entry.id === metric.id)
                                  ?.visible,
                              ),
                            )}
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    button("운동 기록 가져오기", () => {
                      setPanel(null);
                      setStep("sport");
                    })
                  )}
                  {layers.map((entry) => (
                    <View key={entry.id} style={s.switchRow}>
                      {text(entry.label)}
                      <Pressable
                        accessibilityLabel={`${entry.label} 표시`}
                        accessibilityRole="button"
                        onPress={() => updateLayer(entry.id, { visible: !entry.visible })}
                        style={{ padding: 10 }}
                      >
                        {entry.visible ? (
                          <Eye size={21} color={colors.ink} />
                        ) : (
                          <EyeOff size={21} color={colors.muted} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                  {background === "map" && routeLayer
                    ? button(
                        lockedRoute ? "지도에서 루트만 분리" : "루트를 지도 좌표에 맞추기",
                        () => setRouteDetached((value) => !value),
                      )
                    : null}
                  {button(
                    sampleRoute ? "예시 루트 제거" : "예시 루트로 테스트",
                    toggleSample,
                    sampleRoute,
                  )}
                  {sampleRoute
                    ? text(
                        "예시 루트는 편집 테스트용이며 개인 운동 기록·메달에 반영되지 않습니다.",
                        true,
                      )
                    : null}
                </>
              ) : selected ? (
                <>
                  {selected.kind === "text" ? (
                    <TextInput
                      accessibilityLabel="레이어 텍스트"
                      value={selected.text}
                      onChangeText={(value) => updateLayer(selected.id, { text: value })}
                      multiline
                      maxLength={140}
                      style={[s.input, { color: colors.ink, borderColor: colors.border }]}
                    />
                  ) : null}
                  <View style={s.row}>
                    {button("− 크기", () =>
                      updateLayer(selected.id, { scale: selected.scale - 0.1 }),
                    )}
                    {text(`${Math.round(selected.scale * 100)}%`)}
                    {button("+ 크기", () =>
                      updateLayer(selected.id, { scale: selected.scale + 0.1 }),
                    )}
                    {button("회전 15°", () =>
                      updateLayer(selected.id, { rotation: selected.rotation + 15 }),
                    )}
                  </View>
                  <View style={s.row}>
                    {button("←", () => updateLayer(selected.id, { x: selected.x - 6 }))}
                    {button("→", () => updateLayer(selected.id, { x: selected.x + 6 }))}
                    {button("↑", () => updateLayer(selected.id, { y: selected.y - 6 }))}
                    {button("↓", () => updateLayer(selected.id, { y: selected.y + 6 }))}
                    {button("가운데", () => updateLayer(selected.id, { x: 180 }))}
                  </View>
                  {selected.kind !== "route" ? (
                    <View style={s.row}>
                      {STUDIO_BACKGROUNDS.map((entry) => (
                        <Pressable
                          key={entry.color}
                          accessibilityLabel={`${entry.label} 글자색`}
                          onPress={() => updateLayer(selected.id, { color: entry.color })}
                          style={[
                            s.color,
                            { backgroundColor: entry.color, borderColor: colors.border },
                          ]}
                        >
                          {selected.color === entry.color ? (
                            <Check color={entry.ink} size={18} />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    text("GPS 루트는 GROOV 주황색으로 표시합니다.", true)
                  )}
                  <View style={s.row}>
                    {button("맨 앞으로", () =>
                      setLayers((items) => [
                        ...items.filter((entry) => entry.id !== selected.id),
                        selected,
                      ]),
                    )}
                    {button("맨 뒤로", () =>
                      setLayers((items) => [
                        selected,
                        ...items.filter((entry) => entry.id !== selected.id),
                      ]),
                    )}
                    {button("숨기기", () => {
                      updateLayer(selected.id, { visible: false });
                      setPanel(null);
                      setSelectedId(null);
                    })}
                    {selected.kind === "text"
                      ? button("텍스트 숨기기", () => {
                          updateLayer(selected.id, { visible: false });
                          setPanel(null);
                          setSelectedId(null);
                        })
                      : null}
                  </View>
                </>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      <CenterDialog
        visible={confirmClose}
        title="편집을 나갈까요?"
        message="아직 게시하지 않은 편집 내용이 사라집니다."
        confirmLabel="나가기"
        cancelLabel="계속 편집"
        onConfirm={onClose}
        onClose={() => setConfirmClose(false)}
      />
      <CenterDialog
        visible={privacyAction !== null}
        title="GPS 경로를 공유할까요?"
        message="출발·도착 위치에서 집이나 직장이 드러날 수 있습니다. 공개할 경로인지 확인해 주세요."
        confirmLabel="확인하고 계속"
        cancelLabel="돌아가기"
        onConfirm={() => {
          if (privacyAction) void perform(privacyAction);
        }}
        onClose={() => setPrivacyAction(null)}
      />
      <CenterDialog
        visible={notice !== null}
        title="안내"
        message={notice ?? ""}
        confirmLabel="확인"
        onClose={() => setNotice(null)}
      />
      <View
        pointerEvents="none"
        accessibilityElementsHidden={!dragActive}
        importantForAccessibility={dragActive ? "auto" : "no-hide-descendants"}
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 100,
          opacity: dragActive && step === "edit" && !busy ? 1 : 0,
        }}
      >
        <View
          ref={trashTarget}
          collapsable={false}
          onLayout={measureTrash}
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: trashHot ? "#D43838" : "#252525EE",
            borderWidth: 2,
            borderColor: trashHot ? "#FFFFFF" : "#FFFFFF66",
          }}
        >
          <Trash2 size={30} color="#FFFFFF" />
        </View>
        <Text
          style={{
            color: "#FFFFFF",
            backgroundColor: "#252525EE",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginTop: 6,
            fontSize: 14,
          }}
        >
          {trashHot ? "놓으면 숨기기" : "여기로 끌어 숨기기"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, width: "100%", maxWidth: 540, alignSelf: "center" },
  baseTool: {
    width: 52,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heading: { fontFamily: fonts.bold, fontSize: 18 },
  title: { fontFamily: fonts.bold, fontSize: 23 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25 },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
  meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 19 },
  page: {
    padding: 22,
    paddingBottom: 40,
    gap: 18,
    width: "100%",
    maxWidth: 540,
    alignSelf: "center",
    flexGrow: 1,
  },
  basePreview: {
    minHeight: 280,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 20,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  primary: {
    minHeight: 54,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fonts.bold, fontSize: 16, color: "#FFFFFF" },
  sports: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  sport: {
    width: "47%",
    flexGrow: 1,
    minHeight: 116,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  record: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  editArea: { flex: 1 },
  hiddenCanvas: { position: "absolute", left: -10000, top: 0, width: 400, height: 700 },
  canvas: { width: 360, height: 640, overflow: "hidden", position: "relative" },
  center: { justifyContent: "center", alignItems: "center", gap: 12 },
  brand: {
    position: "absolute",
    top: 24,
    right: 22,
    fontFamily: fonts.displayItalic,
    fontStyle: "italic",
    fontSize: 25,
  },
  credit: {
    position: "absolute",
    bottom: 4,
    right: 6,
    color: "#FFFFFF",
    backgroundColor: "#00000090",
    fontSize: 7,
    padding: 3,
  },
  sampleBadge: {
    position: "absolute",
    top: 62,
    left: 20,
    backgroundColor: "#171513DD",
    padding: 7,
    borderRadius: 8,
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: fonts.medium,
  },
  empty: {
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 27,
    padding: 25,
    textAlign: "center",
    color: "#FFFFFF",
  },
  toolbar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "space-around",
  },
  tool: { minWidth: 64, minHeight: 50, gap: 5, alignItems: "center", justifyContent: "center" },
  captionRow: { flexDirection: "row", gap: 16, minHeight: 156 },
  thumbnail: { width: 84, height: 140, borderRadius: 10 },
  caption: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlignVertical: "top",
    minWidth: 0,
    padding: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
  },
  swatch: {
    minWidth: 88,
    flexGrow: 1,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  color: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    minHeight: 100,
  },
});
