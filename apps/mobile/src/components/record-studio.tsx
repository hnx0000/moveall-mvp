import { sportLabels, sportValues, type SportType, type WorkoutSession } from "@moveall/contracts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
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
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { Camera, Image as ImageIcon, Map, X, Download, Move } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Asset } from "expo-asset";
import sportLogoSheet from "../../assets/images/sport-logo-sheet.jpg";
import { api, usePreviewApi } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { uploadMediaAsset } from "../media/upload";
import { exportStudioImage, prepareStudioExport } from "../media/studio-export";
import { fonts } from "../theme";
import { useAppTheme } from "../theme-context";
import { CenterDialog } from "./ui";
import { SportLogo } from "./sport-logo";
import { StudioMap } from "./studio-map";
import { StudioPhoto } from "./studio-photo";
import {
  brandVisible,
  constrainLayer,
  detachedRoute,
  fitRouteMap,
  initialLayers,
  layer,
  ROUTE_ORANGE,
  routePath,
  type StudioLayer,
  type XY,
} from "./record-studio-model";

const NO_POINTS: NonNullable<WorkoutSession["routePoints"]> = [];
const PALETTE = ["#FFFFFF", "#181614", ROUTE_ORANGE, "#F1D9BD", "#BCD6EB", "#C8DDC1"];
const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export function RecordStudio({
  avatarUri,
  autoOpen = false,
  directEditor = false,
  contentType = "post",
  onClose,
  onPosted,
  initialWorkoutId,
  initialCaption,
  initialPhoto,
  loadWorkouts = api.workouts,
}: {
  avatarUri: string | null;
  autoOpen?: boolean;
  directEditor?: boolean;
  contentType?: "post" | "story";
  onClose?: () => void;
  onPosted: () => Promise<unknown>;
  initialWorkoutId?: string | undefined;
  initialCaption?: string | undefined;
  initialPhoto?: string | undefined;
  loadWorkouts?: (token: string) => Promise<WorkoutSession[]>;
}) {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [open, setOpen] = useState(autoOpen);
  const [background, setBackground] = useState<"photo" | "map" | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoReset, setPhotoReset] = useState(0);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [picker, setPicker] = useState(false);
  const [filter, setFilter] = useState<SportType | "all">("all");
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<StudioLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBrand, setShowBrand] = useState(true);
  const [routeDetached, setRouteDetached] = useState(false);
  const [labels, setLabels] = useState(false);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [mapRoute, setMapRoute] = useState<XY[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [privacyAction, setPrivacyAction] = useState<"post" | "export" | null>(null);
  const [preparedExport, setPreparedExport] = useState<string | null>(null);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const canvas = useRef<View>(null);
  const displayScale = Math.min(windowWidth - 32, 396) / 360;
  const points = workout?.routePoints ?? NO_POINTS;
  const camera = useMemo(() => fitRouteMap(points), [points]);
  const freeRoute = useMemo(() => detachedRoute(points), [points]);
  const selected = layers.find((item) => item.id === selectedId);
  const routeLayer = layers.find((item) => item.kind === "route");
  const lockedRoute = background === "map" && !routeDetached;
  const backgroundUri = background === "map" ? mapImage : photo;
  const canCapture = Boolean(backgroundUri && imageReady && sheetUri && workout);
  const receiveMap = useCallback((uri: string, projected: XY[]) => {
    setMapImage(uri);
    setMapRoute(projected);
    setMapError(null);
  }, []);
  const failMap = useCallback((message: string) => setMapError(message), []);

  useEffect(() => {
    if (!session || (!initialWorkoutId && !initialCaption && !initialPhoto)) return;
    let active = true;
    setCaption(initialCaption ?? "");
    setOpen(true);
    if (initialPhoto) {
      setPhoto(initialPhoto);
      setBackground("photo");
      setRouteDetached(true);
    }
    if (initialWorkoutId)
      void loadWorkouts(session.accessToken)
        .then((items) => {
          const item = items.find((record) => record.id === initialWorkoutId);
          if (!active || !item) return;
          setWorkout(item);
          setLayers(initialLayers(item));
          if (!initialPhoto && (item.routePoints?.length ?? 0) > 1) setBackground("map");
        })
        .catch(() => {
          if (active)
            setNotice("공유할 기록을 불러오지 못했습니다. 기록 목록에서 다시 선택해 주세요.");
        });
    return () => {
      active = false;
    };
  }, [initialWorkoutId, initialCaption, initialPhoto, session, loadWorkouts]);

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
        if (active)
          setNotice("운동 로고를 준비하지 못했습니다. 네트워크를 확인하고 다시 열어 주세요.");
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setImageReady(false);
  }, [backgroundUri]);
  useEffect(() => {
    setMapImage(null);
    setMapError(null);
  }, [points, labels, mapAttempt]);
  useEffect(() => {
    setPreparedExport(null);
  }, [layers, photo, mapImage, showBrand, routeDetached]);

  async function chooseRecord() {
    if (!session) {
      setNotice("로그인 후 기록을 가져올 수 있습니다.");
      return;
    }
    setPicker(true);
    setLoading(true);
    try {
      setWorkouts(
        (await loadWorkouts(session.accessToken)).sort(
          (a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt),
        ),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }
  async function chooseBase(kind: "camera" | "gallery" | "map") {
    if (busyRef.current) return;
    if (!session) {
      setNotice("로그인 후 운동을 공유할 수 있습니다.");
      return;
    }
    if (kind === "map") {
      setBackground("map");
      setRouteDetached(false);
      setOpen(true);
      if (!workout) await chooseRecord();
      return;
    }
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
            kind === "camera"
              ? "촬영하려면 카메라 권한이 필요합니다."
              : "사진을 선택하려면 사진 접근 권한이 필요합니다.",
          );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 1,
        allowsMultipleSelection: false,
      };
      const result =
        kind === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      // Resize and strip EXIF locally before either preview or upload.
      const asset = result.assets[0];
      const optimized = await ImageManipulator.manipulateAsync(
        asset.uri,
        asset.width > 1920 ? [{ resize: { width: 1920 } }] : [],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      setPhoto(optimized.uri);
      setBackground("photo");
      setRouteDetached(true);
      setOpen(true);
      if (!workout) await chooseRecord();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "사진을 가져오지 못했습니다.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function selectWorkout(item: WorkoutSession) {
    setWorkout(item);
    setLayers(initialLayers(item));
    setSelectedId(null);
    setPicker(false);
    setRouteDetached(background !== "map");
  }
  function updateLayer(id: string, patch: Partial<StudioLayer>) {
    setLayers((current) =>
      current.map((item) => (item.id === id ? constrainLayer({ ...item, ...patch }) : item)),
    );
  }
  async function perform(action: "post" | "export") {
    if (busyRef.current || !session) return;
    if (background && !canCapture) {
      setNotice(
        "배경과 기록이 준비된 뒤 다시 시도해 주세요. GPS가 없는 기록은 사진 배경을 사용할 수 있습니다.",
      );
      return;
    }
    if (!background && !caption.trim()) {
      setNotice("공유할 이야기를 작성해 주세요.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setPrivacyAction(null);
    try {
      let uri: string | undefined;
      if (background) {
        setSelectedId(null);
        setExporting(action === "export");
        await nextFrame();
        uri = await captureRef(canvas, {
          format: action === "export" ? "png" : "jpg",
          quality: 0.94,
          result: Platform.OS === "web" ? "data-uri" : "tmpfile",
          width: 1080,
          height: 1920,
        });
      }
      if (action === "export" && uri) {
        // A second explicit tap preserves browser Web Share's user activation.
        await prepareStudioExport(uri);
        setPreparedExport(uri);
        return;
      }
      let mediaId: string | undefined;
      if (uri && !usePreviewApi)
        mediaId = (
          await uploadMediaAsset({
            token: session.accessToken,
            uri,
            kind: "post-image",
            contentType: "image/jpeg",
            byteSize: 0,
          })
        ).mediaId;
      await api.createPost(
        session.accessToken,
        {
          sport: workout?.sport ?? (filter === "all" ? "running" : filter),
          content: caption.trim() || `${sportLabels[workout!.sport]} · 오늘의 기록`,
          ...(workout ? { workoutSessionId: workout.id } : {}),
          ...(mediaId ? { mediaId } : {}),
        },
        usePreviewApi ? uri : undefined,
      );
      setOpen(false);
      setCaption("");
      setBackground(null);
      setPhoto(null);
      setWorkout(null);
      setLayers([]);
      setPreparedExport(null);
      await onPosted();
      setNotice("피드에 공유했습니다.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "저장하지 못했습니다. 편집 내용은 유지됩니다.",
      );
    } finally {
      setExporting(false);
      busyRef.current = false;
      setBusy(false);
    }
  }
  function requestAction(action: "post" | "export") {
    if (points.length > 1 && (background === "map" || routeLayer?.visible))
      setPrivacyAction(action);
    else void perform(action);
  }
  const button = (text: string, onPress: () => void, active = false, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        s.chip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: active ? colors.primary : colors.ink,
          fontFamily: fonts.semibold,
          fontSize: 13,
        }}
      >
        {text}
      </Text>
    </Pressable>
  );
  const baseActions = (
    <View style={s.actions}>
      {(
        [
          ["camera", Camera, "사진"],
          ["gallery", ImageIcon, "갤러리"],
          ["map", Map, "지도"],
        ] as const
      ).map(([key, Icon, labelText]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={
            labelText === "지도" ? "지도 배경으로 기록 꾸미기" : `${labelText} 선택`
          }
          disabled={busy}
          onPress={() => void chooseBase(key)}
          style={s.baseButton}
        >
          <Icon size={24} color={colors.muted} />
          <Text style={[s.small, { color: colors.muted }]}>{labelText}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <>
      {!autoOpen ? <View style={[s.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            session ? setOpen(true) : setNotice("로그인 후 운동을 공유할 수 있습니다.")
          }
          style={s.prompt}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.center, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={{ color: colors.ink }}>
                {session?.user.displayName.slice(0, 1) ?? "M"}
              </Text>
            </View>
          )}
          <Text style={{ color: colors.muted, flex: 1, fontFamily: fonts.medium }}>
            오늘의 움직임, 나만의 한 장으로.
          </Text>
        </Pressable>
        {baseActions}
      </View> : null}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) { setOpen(false); onClose?.(); }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[s.header, { borderColor: colors.border }]}>
            <View>
              <Text style={[s.eyebrow, { color: colors.primary }]}>RECORD STUDIO</Text>
              <Text style={[s.heading, { color: colors.ink }]}>움직임을, 나답게.</Text>
            </View>
            <Pressable
              accessibilityLabel="편집 닫기 · 초안 유지"
              disabled={busy}
              onPress={() => { setOpen(false); onClose?.(); }}
              hitSlop={12}
            >
              <X color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <Text style={[s.small, { color: colors.muted }]}>
              01 배경 선택 → 02 기록 선택 → 03 자유롭게 편집
            </Text>
            {baseActions}
            {background ? (
              <View style={s.row}>
                {button(
                  workout ? `${sportLabels[workout.sport]} · 기록 변경` : "운동 기록 선택",
                  () => void chooseRecord(),
                  true,
                )}
                {workout ? (
                  <Text style={[s.small, { color: colors.muted }]}>
                    {new Date(workout.endedAt).toLocaleDateString("ko-KR")}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[s.small, { color: colors.muted }]}>
                배경 없이 글만 공유할 수도 있어요.
              </Text>
            )}
            {background && workout ? (
              <>
                <View
                  style={{
                    width: 360 * displayScale,
                    height: 640 * displayScale,
                    alignSelf: "center",
                    borderRadius: 22,
                    overflow: "hidden",
                    backgroundColor: colors.surface,
                  }}
                >
                  <View
                    style={{
                      width: 360,
                      height: 640,
                      // html2canvas mishandles SVGs under an ancestor scale. Capture
                      // the unscaled 360×640 artwork, then export at 1080×1920.
                      transform: [{ scale: busy && Platform.OS === "web" ? 1 : displayScale }],
                      transformOrigin: "top left",
                    }}
                  >
                    {background === "map" && camera && !mapImage ? (
                      <StudioMap
                        key={`${workout.id}-${labels}-${mapAttempt}`}
                        points={points}
                        labels={labels}
                        onSnapshot={receiveMap}
                        onError={failMap}
                      />
                    ) : null}
                    <View
                      ref={canvas}
                      collapsable={false}
                      style={[s.canvas, { backgroundColor: "#171513" }]}
                    >
                      {background === "photo" && photo ? (
                        <StudioPhoto
                          key={`${photo}-${photoReset}`}
                          uri={photo}
                          editing={selectedId === "photo-frame" && !busy}
                          displayScale={displayScale}
                          onLoad={() => setImageReady(true)}
                          onError={() => {
                            setImageReady(false);
                            setNotice("사진을 읽지 못했습니다. 다시 선택해 주세요.");
                          }}
                          onEdit={() => setPreparedExport(null)}
                        />
                      ) : backgroundUri ? (
                        <Image
                          source={{ uri: backgroundUri }}
                          resizeMode="cover"
                          onLoad={() => setImageReady(true)}
                          onError={() => {
                            setImageReady(false);
                            setNotice("배경 이미지를 읽지 못했습니다. 배경을 다시 선택해 주세요.");
                          }}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, s.center]}>
                          {background === "map" && !camera ? (
                            <Text style={s.whiteHint}>
                              이 기록에는 GPS 경로가 없습니다.{"\n"}사진 배경을 선택해 주세요.
                            </Text>
                          ) : (
                            <ActivityIndicator color={colors.primary} />
                          )}
                        </View>
                      )}
                      <Svg
                        pointerEvents="none"
                        width={360}
                        height={640}
                        style={StyleSheet.absoluteFill}
                      >
                        <Defs>
                          <LinearGradient id="studio-shade" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#000" stopOpacity=".05" />
                            <Stop offset=".45" stopColor="#000" stopOpacity=".03" />
                            <Stop offset="1" stopColor="#000" stopOpacity=".72" />
                          </LinearGradient>
                        </Defs>
                        <Rect width={360} height={640} fill="url(#studio-shade)" />
                      </Svg>
                      {lockedRoute && routeLayer?.visible && camera ? (
                        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                          <RouteGraphic points={mapRoute} width={360} height={640} />
                        </View>
                      ) : null}
                      {layers
                        .filter((item) => item.visible && !(item.kind === "route" && lockedRoute))
                        .map((item) => (
                          <EditableLayer
                            key={item.id}
                            item={item}
                            sport={workout.sport}
                            route={freeRoute}
                            selected={selectedId === item.id && !busy}
                            displayScale={displayScale}
                            sheetUri={sheetUri}
                            interactive={!busy && selectedId !== "photo-frame"}
                            onSelect={() => setSelectedId(item.id)}
                            onChange={(patch) => updateLayer(item.id, patch)}
                          />
                        ))}
                      {brandVisible(showBrand, exporting) ? (
                        <Text pointerEvents="none" style={s.brand}>
                          GROOV
                        </Text>
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
                  </View>
                </View>
                {mapError && background === "map" ? (
                  <View>
                    <Text style={{ color: colors.primary }}>{mapError}</Text>
                    {button("지도 다시 불러오기", () => setMapAttempt((n) => n + 1))}
                  </View>
                ) : null}
                <View style={s.row}>
                  <Move size={16} color={colors.primary} />
                  <Text style={[s.small, { color: colors.muted, flex: 1 }]}>
                    요소를 탭하고 드래그 · 두 손가락으로 크기/회전 조절
                  </Text>
                </View>
                <View style={s.row}>
                  {button("+ 텍스트", () => {
                    const item = layer(
                      `text-${Date.now()}`,
                      "text",
                      "나만의 한 줄",
                      "자유 텍스트",
                      180,
                      300,
                      300,
                      70,
                    );
                    setLayers((current) => [...current, item]);
                    setSelectedId(item.id);
                  })}
                  {button("선택 해제", () => setSelectedId(null))}
                  {background === "photo"
                    ? button(
                        selectedId === "photo-frame" ? "배경 구도 완료" : "배경 구도 조절",
                        () => setSelectedId(selectedId === "photo-frame" ? null : "photo-frame"),
                        selectedId === "photo-frame",
                      )
                    : null}
                  {background === "photo"
                    ? button("사진 구도 초기화", () => {
                        setPhotoReset((value) => value + 1);
                        setPreparedExport(null);
                      })
                    : null}
                  {button("배치 초기화", () => {
                    setLayers(initialLayers(workout));
                    setSelectedId(null);
                  })}
                </View>
                <View
                  style={[s.panel, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[s.subheading, { color: colors.ink }]}>보여줄 요소</Text>
                  <View style={s.row}>
                    {layers.map((item) => (
                      <View key={item.id}>
                        {button(
                          `${item.visible ? "✓ " : "+ "}${item.label}`,
                          () => {
                            if (item.kind === "route" && points.length < 2) {
                              setNotice("저장된 GPS 좌표가 없어 경로를 표시할 수 없습니다.");
                              return;
                            }
                            updateLayer(item.id, { visible: !item.visible });
                            setSelectedId(item.id);
                          },
                          item.visible,
                        )}
                      </View>
                    ))}
                  </View>
                  <View style={s.switchRow}>
                    <Text style={{ color: colors.ink }}>GROOV 로고 · 우측 상단</Text>
                    <Switch
                      accessibilityLabel="앱 안에서 GROOV 로고 표시"
                      value={showBrand}
                      disabled={busy}
                      onValueChange={setShowBrand}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  </View>
                  <Text style={[s.small, { color: colors.muted }]}>
                    앱 안에서는 숨길 수 있어요. 외부 저장·공유에는 항상 표시됩니다.
                  </Text>
                  {background === "map" ? (
                    <>
                      <View style={s.switchRow}>
                        <Text style={{ color: colors.ink }}>최소 지명 표시</Text>
                        <Switch
                          accessibilityLabel="지도 지명 표시"
                          value={labels}
                          disabled={busy}
                          onValueChange={setLabels}
                          trackColor={{ true: colors.primary, false: colors.border }}
                        />
                      </View>
                      <View style={s.row}>
                        {button(
                          routeDetached ? "지도 좌표에 다시 맞추기" : "경로만 분리해서 꾸미기",
                          () => setRouteDetached((value) => !value),
                          routeDetached,
                        )}
                      </View>
                    </>
                  ) : null}
                </View>
                {selected ? (
                  <View
                    style={[
                      s.panel,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                  >
                    <Text style={[s.subheading, { color: colors.ink }]}>{selected.label} 편집</Text>
                    {selected.kind === "text" ? (
                      <TextInput
                        accessibilityLabel="자유 텍스트 편집"
                        value={selected.text}
                        maxLength={140}
                        multiline
                        onChangeText={(text) => updateLayer(selected.id, { text })}
                        style={[s.input, { color: colors.ink, borderColor: colors.border }]}
                      />
                    ) : null}
                    {selected.kind === "route" && lockedRoute ? (
                      <Text style={[s.small, { color: colors.muted }]}>
                        지도와 경로의 위치를 맞춘 상태입니다. 자유롭게 이동하려면 경로를 분리하세요.
                      </Text>
                    ) : (
                      <>
                        <View style={s.row}>
                          {button("− 크기", () =>
                            updateLayer(selected.id, { scale: selected.scale - 0.1 }),
                          )}
                          <Text style={{ color: colors.ink }}>
                            {Math.round(selected.scale * 100)}%
                          </Text>
                          {button("+ 크기", () =>
                            updateLayer(selected.id, { scale: selected.scale + 0.1 }),
                          )}
                          {button("↻ 15°", () =>
                            updateLayer(selected.id, { rotation: selected.rotation + 15 }),
                          )}
                        </View>
                        <View style={s.row}>
                          {button("←", () => updateLayer(selected.id, { x: selected.x - 5 }))}
                          {button("→", () => updateLayer(selected.id, { x: selected.x + 5 }))}
                          {button("↑", () => updateLayer(selected.id, { y: selected.y - 5 }))}
                          {button("↓", () => updateLayer(selected.id, { y: selected.y + 5 }))}
                          {button("가운데", () => updateLayer(selected.id, { x: 180 }))}
                          {button("맨 앞으로", () =>
                            setLayers((items) => [
                              ...items.filter((item) => item.id !== selected.id),
                              selected,
                            ]),
                          )}
                        </View>
                      </>
                    )}
                    {selected.kind !== "route" ? (
                      <>
                        <View style={s.row}>
                          {PALETTE.map((color) => (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${color} 색상`}
                              key={color}
                              onPress={() => updateLayer(selected.id, { color })}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: color,
                                borderWidth: selected.color === color ? 3 : 1,
                                borderColor:
                                  selected.color === color ? colors.primary : colors.border,
                              }}
                            />
                          ))}
                        </View>
                        <TextInput
                          accessibilityLabel="직접 색상 입력 HEX"
                          placeholder="#FFFFFF"
                          placeholderTextColor={colors.muted}
                          maxLength={7}
                          key={`${selected.id}-color`}
                          defaultValue={selected.color}
                          onEndEditing={(event) => {
                            if (/^#[\da-f]{6}$/i.test(event.nativeEvent.text))
                              updateLayer(selected.id, { color: event.nativeEvent.text });
                          }}
                          style={[s.input, { color: colors.ink, borderColor: colors.border }]}
                        />
                      </>
                    ) : (
                      <Text style={[s.small, { color: colors.muted }]}>
                        GPS 경로는 GROOV 주황색으로 표시합니다.
                      </Text>
                    )}
                    {button(selected.visible ? "숨기기" : "다시 표시", () =>
                      updateLayer(selected.id, { visible: !selected.visible }),
                    )}
                  </View>
                ) : null}
              </>
            ) : null}
            <TextInput
              accessibilityLabel="피드 이야기"
              placeholder="오늘 어떤 운동을 했나요? #나의그루브"
              placeholderTextColor={colors.muted}
              multiline
              value={caption}
              onChangeText={setCaption}
              maxLength={2000}
              style={[s.input, { color: colors.ink, borderColor: colors.border, minHeight: 100 }]}
            />
            <View style={s.row}>
              {[...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])].map((tag) => (
                <Text key={tag} style={{ color: colors.primary }}>
                  {tag}
                </Text>
              ))}
            </View>
            {background && workout ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy || !canCapture}
                onPress={() => requestAction("export")}
                style={[
                  s.exportButton,
                  { borderColor: colors.border, opacity: canCapture ? 1 : 0.4 },
                ]}
              >
                <Download color={colors.ink} size={18} />
                <Text style={{ color: colors.ink }}>외부 공유 이미지 만들기</Text>
              </Pressable>
            ) : null}
            {preparedExport ? (
              <View style={{ gap: 12 }}>
                <Text style={[s.subheading, { color: colors.ink }]}>외부 공유 미리보기</Text>
                <Image
                  accessibilityLabel="GROOV 로고가 포함된 외부 공유 이미지"
                  source={{ uri: preparedExport }}
                  resizeMode="contain"
                  style={{ width: "100%", aspectRatio: 9 / 16, borderRadius: 16 }}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void exportStudioImage(preparedExport).catch((error) =>
                      setNotice(
                        error instanceof Error ? error.message : "공유 창을 열지 못했습니다.",
                      ),
                    )
                  }
                  style={[s.primary, { backgroundColor: colors.primary }]}
                >
                  <Text style={s.primaryText}>이미지 저장 / 다른 앱으로 공유</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy || (background ? !canCapture : !caption.trim())}
              onPress={() => requestAction("post")}
              style={[
                s.primary,
                {
                  backgroundColor: colors.primary,
                  opacity: busy || (background ? !canCapture : !caption.trim()) ? 0.45 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryText}>피드에 공유</Text>
              )}
            </Pressable>
            <Text style={[s.small, { color: colors.muted }]}>
              편집 화면을 닫아도 이 페이지에 머무는 동안 초안이 유지됩니다.
            </Text>
          </ScrollView>
        </SafeAreaView>
        <Modal
          visible={picker}
          transparent
          animationType="fade"
          onRequestClose={() => setPicker(false)}
        >
          <View style={s.backdrop}>
            <SafeAreaView style={[s.picker, { backgroundColor: colors.surface }]}>
              <View style={s.header}>
                <Text style={[s.heading, { color: colors.ink }]}>어떤 기록을 담을까요?</Text>
                <Pressable accessibilityLabel="기록 목록 닫기" onPress={() => setPicker(false)}>
                  <X color={colors.ink} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
                style={{ flexGrow: 0 }}
                showsHorizontalScrollIndicator={false}
              >
                {button("전체", () => setFilter("all"), filter === "all")}
                {sportValues.map((sport) => (
                  <View key={sport}>
                    {button(sportLabels[sport], () => setFilter(sport), filter === sport)}
                  </View>
                ))}
              </ScrollView>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                {loading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  workouts
                    .filter((item) => filter === "all" || item.sport === filter)
                    .map((item) => (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        onPress={() => selectWorkout(item)}
                        style={[s.record, { borderColor: colors.border }]}
                      >
                        <SportLogo selected={false} sport={item.sport} size={34} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.ink, fontFamily: fonts.bold }}>
                            {sportLabels[item.sport]} ·{" "}
                            {new Date(item.endedAt).toLocaleDateString("ko-KR")}
                          </Text>
                          <Text numberOfLines={1} style={[s.small, { color: colors.muted }]}>
                            {item.notes?.replace(/\[routine:[^\]]+\]\s*/g, "") || "운동 기록"}
                          </Text>
                          <Text
                            style={[
                              s.small,
                              {
                                color:
                                  (item.routePoints?.length ?? 0) > 1
                                    ? colors.primary
                                    : colors.muted,
                              },
                            ]}
                          >
                            {(item.routePoints?.length ?? 0) > 1
                              ? `GPS ${item.routePoints!.length.toLocaleString()}개 지점`
                              : "GPS 경로 없음 · 사진에 기록만 표시 가능"}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                )}
                {!loading && !workouts.some((item) => filter === "all" || item.sport === filter) ? (
                  <Text style={{ color: colors.muted }}>아직 선택할 운동 기록이 없습니다.</Text>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
        <CenterDialog
          visible={Boolean(privacyAction)}
          title="경로를 공유할까요?"
          message="지도와 경로에서 집·직장 등 출발·도착 위치가 드러날 수 있습니다. 공개할 경로인지 확인해 주세요."
          confirmLabel="확인하고 계속"
          cancelLabel="돌아가기"
          onConfirm={() => {
            if (privacyAction) void perform(privacyAction);
          }}
          onClose={() => setPrivacyAction(null)}
        />
        <CenterDialog
          visible={Boolean(notice) && open}
          title="안내"
          message={notice ?? ""}
          confirmLabel="확인"
          onClose={() => setNotice(null)}
        />
      </Modal>
      <CenterDialog
        visible={Boolean(notice) && !open}
        title="안내"
        message={notice ?? ""}
        confirmLabel="확인"
        onClose={() => setNotice(null)}
      />
    </>
  );
}

function RouteGraphic({ points, width, height }: { points: XY[]; width: number; height: number }) {
  if (points.length < 2) return null;
  const first = points[0]!,
    last = points.at(-1)!;
  const path = routePath(points);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path
        d={path}
        stroke="#FFFFFF"
        strokeOpacity={0.85}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={path}
        stroke={ROUTE_ORANGE}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={first.x}
        cy={first.y}
        r={4}
        fill="#FFFFFF"
        stroke={ROUTE_ORANGE}
        strokeWidth={2}
      />
      <Circle cx={last.x} cy={last.y} r={4} fill={ROUTE_ORANGE} stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
  );
}

function EditableLayer({
  item,
  sport,
  route,
  selected,
  displayScale,
  interactive,
  sheetUri,
  onSelect,
  onChange,
}: {
  item: StudioLayer;
  sport: SportType;
  route: XY[];
  selected: boolean;
  displayScale: number;
  interactive: boolean;
  sheetUri: string | null;
  onSelect: () => void;
  onChange: (patch: Partial<StudioLayer>) => void;
}) {
  const latest = useRef({ item, onChange, onSelect, interactive, displayScale });
  latest.current = { item, onChange, onSelect, interactive, displayScale };
  const gestureStart = useRef({ item, distance: 0, angle: 0, dx: 0, dy: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.interactive,
        onMoveShouldSetPanResponder: () => latest.current.interactive,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          latest.current.onSelect();
          gestureStart.current = { item: latest.current.item, distance: 0, angle: 0, dx: 0, dy: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          const start = gestureStart.current;
          if (touches.length >= 2) {
            const a = touches[0]!,
              b = touches[1]!;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            const angle = Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
            if (!start.distance) {
              gestureStart.current = {
                item: latest.current.item,
                distance,
                angle,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            latest.current.onChange({
              scale: (start.item.scale * distance) / start.distance,
              rotation: start.item.rotation + ((angle - start.angle) * 180) / Math.PI,
            });
          } else {
            if (start.distance) {
              gestureStart.current = {
                item: latest.current.item,
                distance: 0,
                angle: 0,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            latest.current.onChange({
              x: start.item.x + (gesture.dx - start.dx) / latest.current.displayScale,
              y: start.item.y + (gesture.dy - start.dy) / latest.current.displayScale,
            });
          }
        },
      }),
    [],
  );
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={`${item.label} · 이동 및 크기 조절`}
      style={{
        position: "absolute",
        left: item.x - item.width / 2,
        top: item.y - item.height / 2,
        width: item.width,
        height: item.height,
        transform: [{ scale: item.scale }, { rotate: `${item.rotation}deg` }],
        ...(Platform.OS === "web"
          ? ({ touchAction: "none", cursor: "move", userSelect: "none" } as object)
          : {}),
      }}
    >
      <View pointerEvents="none" style={{ flex: 1, justifyContent: "center" }}>
        {item.kind === "route" ? (
          <RouteGraphic points={route} width={item.width} height={item.height} />
        ) : item.kind === "sport" ? (
          <SportLogo
            selected={false}
            color={item.color}
            sport={sport}
            size={item.width}
            {...(sheetUri ? { sheetUri } : {})}
          />
        ) : item.kind === "metric" ? (
          <>
            <Text
              style={{ color: item.color, fontFamily: fonts.medium, fontSize: 11, opacity: 0.9 }}
            >
              {item.label}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={{
                color: item.color,
                fontFamily: fonts.displayExtra,
                fontSize: 27,
                lineHeight: 37,
              }}
            >
              {item.text}
            </Text>
          </>
        ) : (
          <Text
            numberOfLines={6}
            adjustsFontSizeToFit
            minimumFontScale={0.35}
            style={{ color: item.color, fontFamily: fonts.bold, fontSize: 23, lineHeight: 30 }}
          >
            {item.text}
          </Text>
        )}
      </View>
      {selected ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderWidth: 1, borderStyle: "dashed", borderColor: ROUTE_ORANGE, borderRadius: 5 },
          ]}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  composer: { borderWidth: 1, borderRadius: 24, overflow: "hidden" },
  prompt: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  center: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", paddingVertical: 14 },
  baseButton: { flex: 1, alignItems: "center", gap: 7 },
  header: {
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: { fontFamily: fonts.displayExtra, letterSpacing: 2, fontSize: 10 },
  heading: { fontFamily: fonts.bold, fontSize: 21, marginTop: 4 },
  subheading: { fontFamily: fonts.bold, fontSize: 16 },
  content: {
    padding: 16,
    gap: 16,
    maxWidth: 660,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 40,
  },
  small: { fontSize: 11, lineHeight: 18, fontFamily: fonts.medium },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 13 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  canvas: { position: "absolute", width: 360, height: 640, overflow: "hidden" },
  brand: {
    position: "absolute",
    top: 22,
    right: 22,
    color: "#FFFFFF",
    fontFamily: fonts.displayItalic,
    fontSize: 24,
    fontStyle: "italic",
    textShadowColor: "#00000040",
    textShadowRadius: 4,
  },
  credit: {
    position: "absolute",
    bottom: 5,
    right: 8,
    color: "#FFFFFF",
    fontSize: 7,
    backgroundColor: "#00000080",
    padding: 3,
  },
  whiteHint: { color: "#FFFFFF", padding: 26, textAlign: "center", lineHeight: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.regular,
    minWidth: 0,
  },
  primary: {
    borderRadius: 20,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  primaryText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },
  exportButton: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#000000B3",
  },
  picker: {
    width: "100%",
    maxWidth: 540,
    maxHeight: "85%",
    borderRadius: 24,
    overflow: "hidden",
    gap: 12,
  },
  record: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
});
