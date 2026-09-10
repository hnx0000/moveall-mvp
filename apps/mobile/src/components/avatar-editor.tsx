import { useRef, useState } from "react"; import { uiLayout } from "../theme";
import { Image, Modal, PanResponder, Pressable, Text, View } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

type Photo = { uri: string; width: number; height: number };
export function AvatarEditor({
  photo,
  onCancel,
  onSave,
}: {
  photo: Photo;
  onCancel: () => void;
  onSave: (uri: string) => Promise<void>;
}) {
  const [size, setSize] = useState(280);
  const [position, setPosition] = useState({ x: 0, y: 0, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(position);
  current.current = position;
  const start = useRef(position);
  const pinch = useRef(0);
  const cropSize = size * 0.8;
  const base = Math.max(cropSize / photo.width, cropSize / photo.height);
  const constrain = (x: number, y: number, zoom: number) => {
    zoom = Math.max(1, Math.min(4, zoom));
    const maxX = (photo.width * base * zoom - cropSize) / 2;
    const maxY = (photo.height * base * zoom - cropSize) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)), zoom };
  };
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !busy,
    onMoveShouldSetPanResponder: () => !busy,
    onPanResponderGrant: (event) => {
      start.current = current.current;
      const [a, b] = event.nativeEvent.touches;
      pinch.current = a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
    },
    onPanResponderMove: (event, gesture) => {
      const [a, b] = event.nativeEvent.touches;
      const distance = a && b ? Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) : 0;
      if (distance && !pinch.current) {
        pinch.current = distance;
        start.current = current.current;
      }
      const zoom =
        distance && pinch.current
          ? (start.current.zoom * distance) / pinch.current
          : start.current.zoom;
      setPosition(constrain(start.current.x + gesture.dx, start.current.y + gesture.dy, zoom));
    },
  });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const scale = base * position.zoom;
      const side = Math.min(photo.width, photo.height, Math.round(cropSize / scale));
      const originX = Math.max(
        0,
        Math.min(
          photo.width - side,
          Math.round((photo.width - cropSize / scale) / 2 - position.x / scale),
        ),
      );
      const originY = Math.max(
        0,
        Math.min(
          photo.height - side,
          Math.round((photo.height - cropSize / scale) / 2 - position.y / scale),
        ),
      );
      const result = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          { crop: { originX, originY, width: side, height: side } },
          { resize: { width: 512, height: 512 } },
        ],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!result.base64) throw new Error("사진을 처리하지 못했습니다.");
      await onSave(`data:image/jpeg;base64,${result.base64}`);
    } catch {
      setError("사진을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal transparent animationType="fade" onRequestClose={() => !busy && onCancel()}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#000c",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            padding: 20,
            gap: 18,
            backgroundColor: "#191c19",
            borderRadius: uiLayout.dialogRadius,
          }}
        >
          <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>프로필 사진 편집</Text>
          <Text style={{ color: "#bec5bc", fontSize: 14 }}>
            사진을 움직이거나 두 손가락으로 확대하세요. 원 안이 프로필에 표시됩니다.
          </Text>
          <View
            onLayout={(e) => setSize(e.nativeEvent.layout.width)}
            {...responder.panHandlers}
            style={{
              width: "100%",
              aspectRatio: 1,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#fff8",
              backgroundColor: "#000",
            }}
          >
            <Image
              source={{ uri: photo.uri }}
              style={{
                position: "absolute",
                width: photo.width * base * position.zoom,
                height: photo.height * base * position.zoom,
                left: (size - photo.width * base * position.zoom) / 2 + position.x,
                top: (size - photo.height * base * position.zoom) / 2 + position.y,
              }}
            />
            <View
              pointerEvents="none"
              style={{ position: "absolute", inset: "10%", borderWidth: 1, borderColor: "#fff9" }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                inset: "10%",
                borderRadius: cropSize / 2,
                borderWidth: 2,
                borderColor: "#fff",
              }}
            />
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            {[-0.2, 0, 0.2].map((step) => (
              <Pressable
                key={step}
                disabled={busy}
                accessibilityLabel={step < 0 ? "축소" : step > 0 ? "확대" : "위치 초기화"}
                onPress={() =>
                  setPosition(
                    step === 0
                      ? { x: 0, y: 0, zoom: 1 }
                      : constrain(position.x, position.y, position.zoom + step),
                  )
                }
                style={{ padding: 12 }}
              >
                <Text style={{ color: "white", fontSize: 16 }}>
                  {step < 0 ? "−" : step > 0 ? "+" : "초기화"}
                </Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={{ color: "#ff907b" }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable disabled={busy} onPress={onCancel} style={{ padding: 12 }}>
              <Text style={{ color: "white" }}>취소</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void save()}
              style={{ padding: 12, backgroundColor: "#ff613b", borderRadius: uiLayout.controlRadius }}
            >
              <Text style={{ color: "#fff" }}>{busy ? "저장 중…" : "이 사진으로 저장"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
