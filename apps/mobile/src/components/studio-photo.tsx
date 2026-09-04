import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform, View } from "react-native";
import { clamp } from "./record-studio-model";
import { StudioTransformHandles } from "./studio-transform-handles";

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
  const [frame, setFrame] = useState({ x: 0, y: 0, scale: 1, rotation: 0 });
  const latest = useRef({ frame, editing, displayScale, onEdit });
  latest.current = { frame, editing, displayScale, onEdit };
  const start = useRef({ frame, distance: 0, angle: 0, dx: 0, dy: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.editing,
        onMoveShouldSetPanResponder: () => latest.current.editing,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = { frame: latest.current.frame, distance: 0, angle: 0, dx: 0, dy: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          const original = start.current;
          if (touches.length >= 2) {
            const a = touches[0]!,
              b = touches[1]!;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            const angle = Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
            if (!original.distance) {
              start.current = {
                frame: latest.current.frame,
                distance,
                angle,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            setFrame({
              ...original.frame,
              scale: clamp((original.frame.scale * distance) / original.distance, 0.15, 6),
              rotation: original.frame.rotation + ((angle - original.angle) * 180) / Math.PI,
            });
          } else {
            if (original.distance) {
              start.current = {
                frame: latest.current.frame,
                distance: 0,
                angle: 0,
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
  const cover = Math.min(360 / size.width, 640 / size.height);
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
      <View
        style={{
          position: "absolute",
          width,
          height,
          left: (360 - width) / 2 + frame.x,
          top: (640 - height) / 2 + frame.y,
          transform: [{ scale: frame.scale }, { rotate: `${frame.rotation}deg` }],
        }}
      >
        <View pointerEvents="none" style={{ width, height }}>
          <Image
            source={{ uri }}
            resizeMode="cover"
            onError={onError}
            onLoad={onLoad}
            style={{
              position: "absolute",
              width,
              height,
            }}
          />
        </View>
        {editing ? (
          <StudioTransformHandles
            width={width}
            height={height}
            scale={frame.scale}
            rotation={frame.rotation}
            displayScale={displayScale}
            onChange={(patch) => {
              setFrame((value) => ({ ...value, ...patch }));
              onEdit();
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
