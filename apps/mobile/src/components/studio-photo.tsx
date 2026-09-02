import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform, View } from "react-native";
import { clamp } from "./record-studio-model";

export function StudioPhoto({
  uri,
  editing,
  displayScale,
  onLoad,
  onError,
  onEdit,
}: {
  uri: string;
  editing: boolean;
  displayScale: number;
  onLoad: () => void;
  onError: () => void;
  onEdit: () => void;
}) {
  const [size, setSize] = useState({ width: 360, height: 640 });
  useEffect(() => {
    let active = true;
    // RN Web's load event does not provide nativeEvent.source dimensions.
    Image.getSize(
      uri,
      (width, height) => {
        if (active && width > 0 && height > 0) setSize({ width, height });
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [uri]);
  const [frame, setFrame] = useState({ x: 0, y: 0, scale: 1 });
  const latest = useRef({ frame, editing, displayScale, onEdit });
  latest.current = { frame, editing, displayScale, onEdit };
  const start = useRef({ frame, distance: 0, dx: 0, dy: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.editing,
        onMoveShouldSetPanResponder: () => latest.current.editing,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = { frame: latest.current.frame, distance: 0, dx: 0, dy: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          const original = start.current;
          if (touches.length >= 2) {
            const a = touches[0]!,
              b = touches[1]!;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (!original.distance) {
              start.current = {
                frame: latest.current.frame,
                distance,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            setFrame({
              ...original.frame,
              scale: clamp((original.frame.scale * distance) / original.distance, 1, 4),
            });
          } else {
            if (original.distance) {
              start.current = {
                frame: latest.current.frame,
                distance: 0,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            setFrame({
              ...original.frame,
              x: original.frame.x + (gesture.dx - original.dx) / latest.current.displayScale,
              y: original.frame.y + (gesture.dy - original.dy) / latest.current.displayScale,
            });
          }
          latest.current.onEdit();
        },
      }),
    [],
  );
  const cover = Math.max(360 / size.width, 640 / size.height) * frame.scale;
  const width = size.width * cover,
    height = size.height * cover;
  return (
    <View
      {...pan.panHandlers}
      style={{
        position: "absolute",
        width: 360,
        height: 640,
        overflow: "hidden",
        ...(Platform.OS === "web" && editing
          ? ({ touchAction: "none", cursor: "move" } as object)
          : {}),
      }}
    >
      <View pointerEvents="none" style={{ position: "absolute", width: 360, height: 640 }}>
        <Image
          source={{ uri }}
          resizeMode="cover"
          onError={onError}
          onLoad={onLoad}
          style={{
            position: "absolute",
            width,
            height,
            left: (360 - width) / 2 + clamp(frame.x, -(width - 360) / 2, (width - 360) / 2),
            top: (640 - height) / 2 + clamp(frame.y, -(height - 640) / 2, (height - 640) / 2),
          }}
        />
      </View>
    </View>
  );
}
