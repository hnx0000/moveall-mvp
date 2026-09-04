import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  AtSign,
  Camera,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImagePlus,
  Map,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Trophy,
  Type,
  Undo2,
} from "lucide-react-native";
import { ReactNode, useMemo, useRef, useState } from "react";
import {
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import samplePhoto from "../assets/images/people/minji/story-01.jpg";
import {
  applyGesture,
  EditorDocumentV2,
  EditorLayer,
  EditorTransform,
  initialEditorDocument,
  PhotoAdjustments,
  pushHistory,
  touchGeometry,
} from "../src/editor-v2/editor-model";
import { fonts } from "../src/theme";
import { useAppTheme } from "../src/theme-context";
import { RouteTrace } from "../src/components/route-trace";

const ORANGE = "#FF5A36";
const BLACK = "#080807";
const ADJUSTMENTS: Array<{ key: keyof PhotoAdjustments; label: string }> = [
  { key: "brightness", label: "밝기" },
  { key: "contrast", label: "대비" },
  { key: "saturation", label: "채도" },
  { key: "warmth", label: "온도" },
  { key: "highlights", label: "하이라이트" },
  { key: "shadows", label: "그림자" },
];

export default function EditorV2Lab() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [step, setStep] = useState(1);
  const [doc, setDoc] = useState<EditorDocumentV2>(initialEditorDocument);
  const [sourceChosen, setSourceChosen] = useState(false);
  const [sourceMode, setSourceMode] = useState<"photo" | "map" | "record">("photo");
  const [activePanel, setActivePanel] = useState<"adjust" | "record" | "text" | "mention">(
    "adjust",
  );
  const [past, setPast] = useState<EditorDocumentV2[]>([]);
  const [future, setFuture] = useState<EditorDocumentV2[]>([]);
  const [selected, setSelected] = useState<string | "photo" | null>("photo");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [guide, setGuide] = useState<"x" | "y" | "both" | null>(null);
  const canvasWidth = Math.min(windowWidth - 24, 430);
  const ratio =
    doc.ratio === "1:1"
      ? 1
      : doc.ratio === "2:3"
        ? 2 / 3
        : doc.ratio === "3:2"
          ? 3 / 2
          : doc.ratio === "4:5"
            ? 4 / 5
            : 9 / 16;
  const canvasHeight = canvasWidth / ratio;
  const canvas = useMemo(
    () => ({ width: canvasWidth, height: canvasHeight }),
    [canvasWidth, canvasHeight],
  );

  const mutate = (recipe: (current: EditorDocumentV2) => EditorDocumentV2, checkpoint = false) => {
    setDoc((current) => {
      if (checkpoint) setPast((items) => pushHistory(items, current));
      return recipe(current);
    });
    if (checkpoint) setFuture([]);
  };
  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => pushHistory(items, doc));
    setDoc(previous);
    setPast((items) => items.slice(0, -1));
  };
  const redo = () => {
    const next = future.at(-1);
    if (!next) return;
    setPast((items) => pushHistory(items, doc));
    setDoc(next);
    setFuture((items) => items.slice(0, -1));
  };
  const updateTransform = (
    target: string | "photo",
    transform: EditorTransform,
    checkpoint = false,
  ) =>
    mutate(
      (current) =>
        target === "photo"
          ? { ...current, photo: transform }
          : {
              ...current,
              layers: current.layers.map((layer) =>
                layer.id === target ? { ...layer, ...transform } : layer,
              ),
            },
      checkpoint,
    );
  const addText = () => {
    const layer: EditorLayer = {
      id: `text-${Date.now()}`,
      type: "text",
      text: "오늘의 기록",
      x: 0.5,
      y: 0.35,
      scale: 1,
      rotation: 0,
      visible: true,
      zIndex: doc.layers.length + 1,
    };
    mutate((current) => ({ ...current, layers: [...current.layers, layer] }), true);
    setSelected(layer.id);
  };
  const addRecord = (layout: "core" | "stub" = "core") => {
    const layer: EditorLayer = {
      id: `record-${Date.now()}`,
      type: "record",
      text: "7.34",
      x: 0.5,
      y: 0.62,
      scale: 1,
      rotation: 0,
      visible: true,
      zIndex: doc.layers.length + 1,
      recordLayout: layout,
    };
    mutate((current) => ({ ...current, layers: [...current.layers, layer] }), true);
    setSelected(layer.id);
  };
  const removeSelected = () => {
    if (!selected || selected === "photo") return;
    mutate(
      (current) => ({
        ...current,
        layers: current.layers.filter((layer) => layer.id !== selected),
      }),
      true,
    );
    setSelected(null);
  };
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0]!);
      setSelected("photo");
    }
  };
  const chooseGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0]!);
      setSourceMode("photo");
      setSourceChosen(true);
      setStep(1);
      setSelected("photo");
    }
  };
  const chooseCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!result.canceled) {
      setPhoto(result.assets[0]!);
      setSourceMode("photo");
      setSourceChosen(true);
      setStep(1);
      setSelected("photo");
    }
  };
  const chooseMap = () => {
    setSourceMode("map");
    setSourceChosen(true);
    setStep(2);
    setSelected(null);
  };
  const chooseRecord = (layout: "core" | "stub") => {
    const layer: EditorLayer = {
      id: `record-${Date.now()}`,
      type: "record",
      text: "7.34",
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      visible: true,
      zIndex: 1,
      recordLayout: layout,
    };
    setDoc({ ...initialEditorDocument, layers: [layer] });
    setSourceMode("record");
    setSourceChosen(true);
    setStep(2);
    setSelected(layer.id);
  };

  if (!sourceChosen)
    return (
      <SourcePicker
        colors={colors}
        onBack={() => router.back()}
        onCamera={chooseCamera}
        onGallery={chooseGallery}
        onMap={chooseMap}
        onRecord={chooseRecord}
      />
    );

  return (
    <View style={[s.page, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => (step > 1 ? setStep(step - 1) : setSourceChosen(false))}
          style={s.headerButton}
        >
          <ChevronLeft color={colors.ink} size={24} />
        </Pressable>
        <View style={s.headerCopy}>
          <Text style={s.eyebrow}>EDITOR V2 · LAB</Text>
          <Text style={[s.headerTitle, { color: colors.ink }]}>STEP 0{step}</Text>
        </View>
        <Pressable
          onPress={() => setStep(Math.min(3, step + 1))}
          disabled={step === 3}
          style={s.headerButton}
        >
          {step < 3 ? <ChevronRight color={ORANGE} size={24} /> : <Text style={s.done}>완료</Text>}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.stepRow}>
          <Step n={1} active={step === 1} label="사진" />
          <Step n={2} active={step === 2} label="레이어" />
          <Step n={3} active={step === 3} label="게시" />
        </View>
        {step < 3 ? (
          <>
            <View style={[s.canvas, { width: canvasWidth, height: canvasHeight }]}>
              {sourceMode === "photo" ? (
                <Transformable
                  target="photo"
                  transform={doc.photo}
                  canvas={canvas}
                  onSelect={setSelected}
                  onChange={updateTransform}
                  onGuide={setGuide}
                >
                  <Image
                    resizeMode="cover"
                    source={photo?.uri ? { uri: photo.uri } : samplePhoto}
                    style={[s.photo, adjustmentImageStyle(doc.adjustments)]}
                  />
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, adjustmentOverlay(doc.adjustments)]}
                  />
                </Transformable>
              ) : sourceMode === "map" ? (
                <View style={StyleSheet.absoluteFill}>
                  <View style={s.mapGrid} />
                  <View style={s.mapRoute}>
                    <RouteTrace color={ORANGE} points={LAB_ROUTE} strokeWidth={5} />
                  </View>
                  <Text style={s.mapCaption}>GPS COURSE · SAMPLE</Text>
                </View>
              ) : null}
              {doc.layers
                .filter((layer) => layer.visible)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((layer) => (
                  <Transformable
                    key={layer.id}
                    target={layer.id}
                    transform={layer}
                    canvas={canvas}
                    onSelect={setSelected}
                    onChange={updateTransform}
                    onGuide={setGuide}
                  >
                    <LayerView layer={layer} />
                  </Transformable>
                ))}
              {(guide === "x" || guide === "both") && (
                <View pointerEvents="none" style={s.guideX} />
              )}
              {(guide === "y" || guide === "both") && (
                <View pointerEvents="none" style={s.guideY} />
              )}
              <ToolDock active={activePanel} onSelect={setActivePanel} />
            </View>
            <View style={s.quickBar}>
              <IconButton label="실행 취소" onPress={undo}>
                <Undo2 size={19} color={past.length ? ORANGE : "#4B2B23"} />
              </IconButton>
              <IconButton label="다시 실행" onPress={redo}>
                <Redo2 size={19} color={future.length ? ORANGE : "#4B2B23"} />
              </IconButton>
              <Text style={s.selection}>
                {selected ? `${selected.toUpperCase()} 선택됨` : "캔버스를 눌러 선택"}
              </Text>
              {selected && selected !== "photo" ? (
                <IconButton label="삭제" onPress={removeSelected}>
                  <Trash2 size={19} color={ORANGE} />
                </IconButton>
              ) : null}
            </View>
            {activePanel === "adjust" ? (
              <PhotoTools
                doc={doc}
                pickPhoto={pickPhoto}
                setDoc={(next) => mutate(() => next, true)}
              />
            ) : activePanel === "record" ? (
              <RecordTools
                addRecord={addRecord}
                doc={doc}
                update={(next) => mutate(() => next, true)}
              />
            ) : activePanel === "text" ? (
              <LayerTools
                addText={addText}
                doc={doc}
                selected={selected}
                update={(next) => mutate(() => next, true)}
              />
            ) : (
              <MentionTools />
            )}
          </>
        ) : (
          <PublishStep caption={caption} setCaption={setCaption} doc={doc} />
        )}
      </ScrollView>
    </View>
  );
}

const LAB_ROUTE = [
  { latitude: 37.5202, longitude: 126.9944 },
  { latitude: 37.521, longitude: 126.999 },
  { latitude: 37.5204, longitude: 127.004 },
  { latitude: 37.5188, longitude: 127.009 },
  { latitude: 37.5175, longitude: 127.014 },
  { latitude: 37.5184, longitude: 127.019 },
  { latitude: 37.5205, longitude: 127.024 },
];

function SourcePicker({
  colors,
  onBack,
  onCamera,
  onGallery,
  onMap,
  onRecord,
}: {
  colors: { background: string; border: string; ink: string; muted: string };
  onBack: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onMap: () => void;
  onRecord: (layout: "core" | "stub") => void;
}) {
  const [recordOpen, setRecordOpen] = useState(false);
  return (
    <View style={[s.page, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} style={s.headerButton}>
          <ChevronLeft color={colors.ink} size={24} />
        </Pressable>
        <View style={s.headerCopy}>
          <Text style={s.eyebrow}>EDITOR V2 · START</Text>
          <Text style={[s.headerTitle, { color: colors.ink }]}>무엇으로 시작할까요?</Text>
        </View>
        <View style={s.headerButton} />
      </View>
      <ScrollView contentContainerStyle={s.sourceContent}>
        <Text style={[s.sourceLead, { color: colors.ink }]}>소스를 먼저 선택하세요.</Text>
        <Text style={[s.sourceSub, { color: colors.muted }]}>
          사진과 카메라는 선택 즉시 보정 단계로 이동합니다.
        </Text>
        <View style={s.sourceGrid}>
          <SourceCard
            icon={<Camera color={ORANGE} size={27} />}
            title="카메라"
            note="촬영 후 바로 보정"
            onPress={onCamera}
          />
          <SourceCard
            icon={<ImagePlus color={ORANGE} size={27} />}
            title="갤러리"
            note="사진 선택 후 보정"
            onPress={onGallery}
          />
          <SourceCard
            icon={<Map color={ORANGE} size={27} />}
            title="지도"
            note="GPS 코스 선택"
            onPress={onMap}
          />
          <SourceCard
            icon={<Trophy color={ORANGE} size={27} />}
            title="기록"
            note="지표와 시안 선택"
            onPress={() => setRecordOpen(!recordOpen)}
          />
        </View>
        {recordOpen ? (
          <View style={s.recordChooser}>
            <Text style={s.recordChooserTitle}>기록 피드 시안</Text>
            <Text style={s.sourceSub}>강조 기록 1개 · 보조 기록 3개</Text>
            <View style={s.recordChoices}>
              <Pressable onPress={() => onRecord("core")} style={s.recordChoice}>
                <Text style={s.choiceLabel}>CORE</Text>
                <Text style={s.choiceBig}>7.34</Text>
                <Text style={s.choiceMeta}>KM · 44:03 · 526 KCAL</Text>
              </Pressable>
              <Pressable onPress={() => onRecord("stub")} style={[s.recordChoice, s.choiceStub]}>
                <View style={s.choiceRail} />
                <Text style={s.choiceLabel}>STUB</Text>
                <Text style={s.choiceBig}>7.34</Text>
                <Text style={s.choiceMeta}>KM · 44:03 · 526 KCAL</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
function SourceCard({
  icon,
  title,
  note,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.sourceCard}>
      {icon}
      <Text style={s.sourceTitle}>{title}</Text>
      <Text style={s.sourceNote}>{note}</Text>
    </Pressable>
  );
}

function ToolDock({
  active,
  onSelect,
}: {
  active: "adjust" | "record" | "text" | "mention";
  onSelect: (value: "adjust" | "record" | "text" | "mention") => void;
}) {
  const items = [
    {
      id: "adjust" as const,
      label: "세부보정",
      icon: <SlidersHorizontal size={18} color={ORANGE} />,
    },
    { id: "record" as const, label: "기록", icon: <Trophy size={18} color={ORANGE} /> },
    { id: "text" as const, label: "텍스트/로고", icon: <Type size={18} color={ORANGE} /> },
    { id: "mention" as const, label: "언급", icon: <AtSign size={18} color={ORANGE} /> },
  ];
  return (
    <View style={s.toolDock}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item.id)}
          style={[s.dockItem, active === item.id && s.dockItemOn]}
        >
          {item.icon}
          <Text style={s.dockLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function RecordTools({
  addRecord,
  doc,
  update,
}: {
  addRecord: (layout: "core" | "stub") => void;
  doc: EditorDocumentV2;
  update: (doc: EditorDocumentV2) => void;
}) {
  const records = doc.layers.filter((layer) => layer.type === "record");
  return (
    <View style={s.tools}>
      <View style={s.toolTitle}>
        <Trophy color={ORANGE} size={17} />
        <Text style={s.toolTitleText}>기록 오버레이</Text>
      </View>
      <Text style={s.hint}>강조 기록을 고르고 시안을 눌러 캔버스에 추가하세요.</Text>
      <View style={s.chips}>
        <Pressable onPress={() => addRecord("core")} style={s.actionChip}>
          <Text style={s.actionChipText}>CORE 추가</Text>
        </Pressable>
        <Pressable onPress={() => addRecord("stub")} style={s.chip}>
          <Text style={s.chipText}>STUB 추가</Text>
        </Pressable>
      </View>
      {records.map((layer) => (
        <View key={layer.id} style={s.recordListRow}>
          <Text style={s.recordListText}>
            {layer.recordLayout?.toUpperCase()} · {layer.text} KM
          </Text>
          <Pressable
            onPress={() =>
              update({
                ...doc,
                layers: doc.layers.map((item) =>
                  item.id === layer.id
                    ? { ...item, text: item.text === "7.34" ? "44:03" : "7.34" }
                    : item,
                ),
              })
            }
          >
            <Text style={s.recordListAction}>강조 기록 변경</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
function MentionTools() {
  return (
    <View style={s.tools}>
      <View style={s.toolTitle}>
        <AtSign color={ORANGE} size={17} />
        <Text style={s.toolTitleText}>언급</Text>
      </View>
      <TextInput placeholder="@사용자 검색" placeholderTextColor="#784333" style={s.textInput} />
      <Text style={s.hint}>언급은 결과물 위 태그가 아니라 게시물의 연결 정보로 저장됩니다.</Text>
    </View>
  );
}

function Transformable({
  target,
  transform,
  canvas,
  children,
  onSelect,
  onChange,
  onGuide,
}: {
  target: string | "photo";
  transform: EditorTransform;
  canvas: { width: number; height: number };
  children: ReactNode;
  onSelect: (id: string | "photo") => void;
  onChange: (id: string | "photo", value: EditorTransform, checkpoint?: boolean) => void;
  onGuide: (guide: "x" | "y" | "both" | null) => void;
}) {
  const start = useRef(transform);
  const initialTouch = useRef<ReturnType<typeof touchGeometry>>(null);
  const moved = useRef(false);
  const latest = useRef(transform);
  latest.current = transform;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: () => false,
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onSelect(target);
          start.current = latest.current;
          initialTouch.current = touchGeometry(event.nativeEvent.touches);
          moved.current = false;
        },
        onPanResponderMove: (event, gesture) => {
          const geometry = touchGeometry(event.nativeEvent.touches);
          const initial = initialTouch.current;
          const next = applyGesture(
            start.current,
            {
              dx: gesture.dx,
              dy: gesture.dy,
              scale: geometry && initial ? geometry.distance / initial.distance : 1,
              rotation: geometry && initial ? geometry.angle - initial.angle : 0,
            },
            canvas,
            target === "photo",
          );
          const snapX = target !== "photo" && Math.abs(next.x - 0.5) < 0.018;
          const snapY = target !== "photo" && Math.abs(next.y - 0.5) < 0.018;
          onGuide(snapX && snapY ? "both" : snapX ? "x" : snapY ? "y" : null);
          moved.current = true;
          onChange(target, { ...next, x: snapX ? 0.5 : next.x, y: snapY ? 0.5 : next.y });
        },
        onPanResponderRelease: () => {
          onGuide(null);
          if (moved.current) onChange(target, latest.current, true);
        },
        onPanResponderTerminate: () => onGuide(null),
      }),
    [canvas.height, canvas.width, onChange, onGuide, onSelect, target],
  );
  if (target === "photo")
    return (
      <View
        {...responder.panHandlers}
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: (transform.x - 0.5) * canvas.width },
              { translateY: (transform.y - 0.5) * canvas.height },
              { scale: transform.scale },
              { rotate: `${transform.rotation}deg` },
            ],
          },
        ]}
      >
        {children}
      </View>
    );
  return (
    <View
      {...responder.panHandlers}
      style={[
        s.layer,
        {
          left: transform.x * canvas.width - 100,
          top: transform.y * canvas.height - 42,
          zIndex: 10,
          transform: [{ scale: transform.scale }, { rotate: `${transform.rotation}deg` }],
        },
      ]}
    >
      {children}
    </View>
  );
}

function LayerView({ layer }: { layer: EditorLayer }) {
  return layer.type === "text" ? (
    <Text style={s.layerText}>{layer.text}</Text>
  ) : (
    <View style={[s.record, layer.recordLayout === "stub" && s.recordStub]}>
      {layer.recordLayout === "stub" ? <View style={s.recordStubRail} /> : null}
      <Text style={s.recordLabel}>RUNNING · TODAY</Text>
      <View style={s.recordLine}>
        <Text style={s.recordValue}>{layer.text}</Text>
        <Text style={s.recordUnit}>{layer.text.includes(":") ? "TIME" : "KM"}</Text>
      </View>
      <Text style={s.recordMeta}>44:03 TIME · 6′00″ PACE · 526 KCAL</Text>
    </View>
  );
}
function PhotoTools({
  doc,
  pickPhoto,
  setDoc,
}: {
  doc: EditorDocumentV2;
  pickPhoto: () => void;
  setDoc: (doc: EditorDocumentV2) => void;
}) {
  const change = (key: keyof PhotoAdjustments, delta: number) =>
    setDoc({
      ...doc,
      adjustments: {
        ...doc.adjustments,
        [key]: Math.max(-100, Math.min(100, doc.adjustments[key] + delta)),
      },
    });
  const reset = () => setDoc({ ...doc, adjustments: initialEditorDocument.adjustments });
  return (
    <View style={s.tools}>
      <View style={s.toolTitle}>
        <ImagePlus color={ORANGE} size={17} />
        <Text style={s.toolTitleText}>사진과 보정</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Pressable onPress={pickPhoto} style={s.actionChip}>
          <Text style={s.actionChipText}>갤러리</Text>
        </Pressable>
        {(["1:1", "2:3", "3:2", "4:5", "9:16"] as const).map((ratio) => (
          <Pressable
            key={ratio}
            onPress={() => setDoc({ ...doc, ratio })}
            style={[s.chip, doc.ratio === ratio && s.chipOn]}
          >
            <Text style={[s.chipText, doc.ratio === ratio && s.chipTextOn]}>{ratio}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.orientationRow}>
        <Pressable
          onPress={() => setDoc({ ...doc, ratio: "2:3" })}
          style={[s.orientationButton, doc.ratio === "2:3" && s.orientationOn]}
        >
          <Text style={s.orientationText}>세로 2:3</Text>
        </Pressable>
        <Pressable
          onPress={() => setDoc({ ...doc, ratio: "3:2" })}
          style={[s.orientationButton, doc.ratio === "3:2" && s.orientationOn]}
        >
          <Text style={s.orientationText}>가로 3:2</Text>
        </Pressable>
      </View>
      <View style={s.adjustHead}>
        <Text style={s.adjustTitle}>세부 보정</Text>
        <Pressable onPress={reset} style={s.resetButton}>
          <RotateCcw color={ORANGE} size={13} />
          <Text style={s.resetText}>초기화</Text>
        </Pressable>
      </View>
      <View style={s.adjustList}>
        {ADJUSTMENTS.map(({ key, label }) => (
          <View key={key} style={s.adjustRow}>
            <Text style={s.adjustLabel}>{label}</Text>
            <Pressable onPress={() => change(key, -10)} style={s.adjustButton}>
              <Text style={s.adjustButtonText}>−</Text>
            </Pressable>
            <View style={s.adjustTrack}>
              <View style={s.adjustCenter} />
              <View
                style={[
                  s.adjustFill,
                  doc.adjustments[key] < 0
                    ? { right: "50%", width: `${Math.abs(doc.adjustments[key]) / 2}%` }
                    : { left: "50%", width: `${doc.adjustments[key] / 2}%` },
                ]}
              />
            </View>
            <Pressable onPress={() => change(key, 10)} style={s.adjustButton}>
              <Text style={s.adjustButtonText}>＋</Text>
            </Pressable>
            <Text style={s.adjustValue}>{doc.adjustments[key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
function LayerTools({
  addText,
  doc,
  selected,
  update,
}: {
  addText: () => void;
  doc: EditorDocumentV2;
  selected: string | "photo" | null;
  update: (doc: EditorDocumentV2) => void;
}) {
  const layer = doc.layers.find((item) => item.id === selected);
  return (
    <View style={s.tools}>
      <View style={s.toolTitle}>
        <Type color={ORANGE} size={17} />
        <Text style={s.toolTitleText}>텍스트와 기록</Text>
      </View>
      <View style={s.chips}>
        <Pressable onPress={addText} style={s.actionChip}>
          <Text style={s.actionChipText}>텍스트 추가</Text>
        </Pressable>
        {layer ? (
          <Pressable
            onPress={() =>
              update({
                ...doc,
                layers: doc.layers.map((item) =>
                  item.id === layer.id ? { ...item, visible: !item.visible } : item,
                ),
              })
            }
            style={s.chip}
          >
            <Eye color={ORANGE} size={15} />
            <Text style={s.chipText}>숨기기</Text>
          </Pressable>
        ) : null}
      </View>
      {layer?.type === "text" ? (
        <TextInput
          value={layer.text}
          onChangeText={(text) =>
            update({
              ...doc,
              layers: doc.layers.map((item) => (item.id === layer.id ? { ...item, text } : item)),
            })
          }
          placeholder="텍스트 입력"
          placeholderTextColor="#784333"
          style={s.textInput}
        />
      ) : null}
      <Text style={s.hint}>
        한 손가락으로 이동하고 두 손가락으로 확대·회전하세요. 선택 박스는 표시되지 않습니다.
      </Text>
    </View>
  );
}
function PublishStep({
  caption,
  setCaption,
  doc,
}: {
  caption: string;
  setCaption: (value: string) => void;
  doc: EditorDocumentV2;
}) {
  return (
    <View style={s.publish}>
      <Text style={s.publishTitle}>게시 전 확인</Text>
      <Text style={s.publishMeta}>
        {doc.ratio} · 레이어 {doc.layers.filter((layer) => layer.visible).length}개 · 사진 보정
        저장됨
      </Text>
      <TextInput
        multiline
        value={caption}
        onChangeText={setCaption}
        placeholder="코멘트를 입력하세요"
        placeholderTextColor="#704034"
        style={[s.textInput, s.caption]}
      />
      <View style={s.publishRow}>
        <Text style={s.publishLabel}>공개 범위</Text>
        <Text style={s.publishValue}>전체 공개</Text>
      </View>
      <View style={s.publishRow}>
        <Text style={s.publishLabel}>댓글</Text>
        <Text style={s.publishValue}>허용</Text>
      </View>
      <View style={s.labNotice}>
        <Text style={s.labNoticeText}>V2 실험판은 실제 게시물을 생성하지 않습니다.</Text>
      </View>
    </View>
  );
}
function Step({ n, active, label }: { n: number; active: boolean; label: string }) {
  return (
    <View style={s.step}>
      <View style={[s.stepDot, active && s.stepDotOn]}>
        <Text style={[s.stepNumber, active && s.stepNumberOn]}>{n}</Text>
      </View>
      <Text style={[s.stepLabel, active && s.stepLabelOn]}>{label}</Text>
    </View>
  );
}
function IconButton({
  children,
  label,
  onPress,
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={s.iconButton}>
      {children}
    </Pressable>
  );
}
function adjustmentImageStyle(value: PhotoAdjustments) {
  if (Platform.OS !== "web") return { opacity: 1 + Math.min(value.brightness, 0) / 180 };
  return {
    filter: `brightness(${100 + value.brightness}%) contrast(${100 + value.contrast}%) saturate(${100 + value.saturation}%)`,
  } as never;
}
function adjustmentOverlay(value: PhotoAdjustments) {
  const warmth = value.warmth;
  const highlights = Math.max(value.highlights, 0);
  const shadows = Math.max(value.shadows, 0);
  return {
    backgroundColor:
      warmth > 0
        ? `rgba(255,90,54,${warmth / 500})`
        : warmth < 0
          ? `rgba(30,90,150,${Math.abs(warmth) / 500})`
          : highlights > 0
            ? `rgba(255,225,190,${highlights / 700})`
            : shadows > 0
              ? `rgba(0,0,0,${shadows / 700})`
              : "transparent",
  };
}

const s = StyleSheet.create({
  page: { flex: 1 },
  header: {
    height: 72,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center" },
  eyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 1.4 },
  headerTitle: { fontFamily: fonts.bold, fontSize: 15, marginTop: 2 },
  done: { color: ORANGE, fontFamily: fonts.bold, fontSize: 11 },
  scroll: { padding: 12, paddingBottom: 60, alignItems: "center" },
  stepRow: {
    width: "100%",
    maxWidth: 430,
    flexDirection: "row",
    justifyContent: "center",
    gap: 38,
    paddingVertical: 13,
  },
  step: { alignItems: "center", gap: 4 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#5A3025",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  stepNumber: { color: ORANGE, fontFamily: fonts.bold, fontSize: 8 },
  stepNumberOn: { color: BLACK },
  stepLabel: { color: "#734333", fontFamily: fonts.medium, fontSize: 8 },
  stepLabelOn: { color: ORANGE },
  canvas: { backgroundColor: BLACK, borderRadius: 4, overflow: "hidden", position: "relative" },
  photo: { width: "100%", height: "100%" },
  layer: {
    position: "absolute",
    width: 200,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  layerText: {
    color: ORANGE,
    fontFamily: fonts.bold,
    fontSize: 24,
    textAlign: "center",
    textShadowColor: BLACK,
    textShadowRadius: 5,
  },
  record: {
    backgroundColor: "rgba(8,8,7,.84)",
    borderLeftWidth: 5,
    borderLeftColor: ORANGE,
    borderRadius: 8,
    padding: 12,
    width: 190,
  },
  recordStub: { paddingLeft: 24 },
  recordStubRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 15,
    backgroundColor: ORANGE,
  },
  recordLabel: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 7, letterSpacing: 1 },
  recordLine: { flexDirection: "row", alignItems: "baseline" },
  recordValue: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 38, letterSpacing: -2 },
  recordUnit: { color: ORANGE, fontFamily: fonts.bold, fontSize: 8, marginLeft: 5 },
  recordMeta: { color: ORANGE, fontFamily: fonts.medium, fontSize: 6, opacity: 0.65 },
  guideX: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: ORANGE,
  },
  guideY: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: ORANGE,
  },
  quickBar: {
    width: "100%",
    maxWidth: 430,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#261611",
  },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  selection: {
    flex: 1,
    color: "#8B5040",
    fontFamily: fonts.medium,
    fontSize: 8,
    textAlign: "center",
  },
  tools: { width: "100%", maxWidth: 430, paddingVertical: 16, gap: 13 },
  toolTitle: { flexDirection: "row", alignItems: "center", gap: 7 },
  toolTitleText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 12 },
  chips: { flexDirection: "row", gap: 8, alignItems: "center" },
  chip: {
    height: 37,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#4A291F",
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { color: ORANGE, fontFamily: fonts.medium, fontSize: 9 },
  chipTextOn: { color: BLACK, fontFamily: fonts.bold },
  actionChip: {
    height: 37,
    borderRadius: 19,
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChipText: { color: BLACK, fontFamily: fonts.bold, fontSize: 9 },
  adjustHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adjustTitle: { color: ORANGE, fontFamily: fonts.bold, fontSize: 10 },
  resetButton: { flexDirection: "row", alignItems: "center", gap: 5 },
  resetText: { color: ORANGE, fontFamily: fonts.medium, fontSize: 8 },
  adjustList: { gap: 8 },
  adjustRow: { height: 32, flexDirection: "row", alignItems: "center", gap: 7 },
  adjustLabel: { width: 55, color: ORANGE, fontFamily: fonts.medium, fontSize: 8 },
  adjustButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#4A291F",
    alignItems: "center",
    justifyContent: "center",
  },
  adjustButtonText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 14 },
  adjustTrack: { flex: 1, height: 3, backgroundColor: "#362019", position: "relative" },
  adjustCenter: {
    position: "absolute",
    left: "50%",
    top: -3,
    width: 1,
    height: 9,
    backgroundColor: "#714032",
  },
  adjustFill: { position: "absolute", height: 3, backgroundColor: ORANGE },
  adjustValue: {
    width: 27,
    color: ORANGE,
    fontFamily: fonts.bold,
    fontSize: 8,
    textAlign: "right",
  },
  orientationRow: { flexDirection: "row", gap: 8 },
  orientationButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#4A291F",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  orientationOn: { backgroundColor: "#2B1711", borderColor: ORANGE },
  orientationText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 9 },
  textInput: {
    borderWidth: 1,
    borderColor: "#4A291F",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: ORANGE,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  hint: { color: "#815044", fontFamily: fonts.medium, fontSize: 8, lineHeight: 13 },
  publish: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: BLACK,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  publishTitle: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 21 },
  publishMeta: { color: ORANGE, opacity: 0.55, fontFamily: fonts.medium, fontSize: 9 },
  caption: { height: 110, textAlignVertical: "top" },
  publishRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#2D1913",
  },
  publishLabel: { color: ORANGE, fontFamily: fonts.medium, fontSize: 10 },
  publishValue: { color: ORANGE, fontFamily: fonts.bold, fontSize: 10 },
  labNotice: { backgroundColor: ORANGE, borderRadius: 10, padding: 12 },
  labNoticeText: { color: BLACK, fontFamily: fonts.bold, fontSize: 9, textAlign: "center" },
  sourceContent: {
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 60,
  },
  sourceLead: { fontFamily: fonts.bold, fontSize: 25, marginTop: 15 },
  sourceSub: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 16, marginTop: 6 },
  sourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  sourceCard: {
    width: "48.5%",
    height: 150,
    backgroundColor: BLACK,
    borderWidth: 1,
    borderColor: "#321A13",
    borderRadius: 18,
    padding: 18,
    justifyContent: "flex-end",
  },
  sourceTitle: { color: ORANGE, fontFamily: fonts.bold, fontSize: 16, marginTop: 15 },
  sourceNote: { color: ORANGE, opacity: 0.5, fontFamily: fonts.medium, fontSize: 8, marginTop: 4 },
  recordChooser: { marginTop: 18, backgroundColor: BLACK, borderRadius: 18, padding: 16 },
  recordChooserTitle: { color: ORANGE, fontFamily: fonts.bold, fontSize: 15 },
  recordChoices: { flexDirection: "row", gap: 9, marginTop: 14 },
  recordChoice: {
    flex: 1,
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#4A291F",
    borderRadius: 13,
    padding: 13,
    justifyContent: "center",
  },
  choiceStub: { paddingLeft: 23, overflow: "hidden" },
  choiceRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 12,
    backgroundColor: ORANGE,
  },
  choiceLabel: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 7, letterSpacing: 1 },
  choiceBig: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 33 },
  choiceMeta: { color: ORANGE, opacity: 0.5, fontFamily: fonts.medium, fontSize: 6 },
  toolDock: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(8,8,7,.72)",
    borderRadius: 17,
    padding: 5,
    flexDirection: "row",
    zIndex: 30,
  },
  dockItem: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 12,
  },
  dockItemOn: { backgroundColor: "rgba(255,90,54,.17)" },
  dockLabel: { color: ORANGE, fontFamily: fonts.medium, fontSize: 6 },
  mapGrid: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#171410",
    borderWidth: 1,
    borderColor: "#2F241E",
  },
  mapRoute: { position: "absolute", left: 35, right: 35, top: 50, bottom: 70 },
  mapCaption: {
    position: "absolute",
    left: 16,
    bottom: 76,
    color: ORANGE,
    fontFamily: fonts.displayExtra,
    fontSize: 8,
    letterSpacing: 1,
  },
  recordListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#321B14",
    paddingTop: 10,
  },
  recordListText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 9 },
  recordListAction: { color: ORANGE, opacity: 0.65, fontFamily: fonts.medium, fontSize: 8 },
});
