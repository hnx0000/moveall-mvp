import { useMemo, useRef } from "react";
import { PanResponder, Platform, View } from "react-native";
import { resizeFromHandle } from "./studio-transform";

/** Mouse handles complement the two-finger canvas gestures. Never rendered in exports. */
export function StudioTransformHandles({
  width,
  height,
  scale,
  rotation,
  displayScale,
  onChange,
  minimal = false,
}: {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  displayScale: number;
  onChange: (patch: { scale?: number; rotation?: number }) => void;
  minimal?: boolean;
}) {
  const latest = useRef({ scale, rotation, displayScale, onChange, width, height });
  latest.current = { scale, rotation, displayScale, onChange, width, height };
  const origin = useRef({ scale, rotation });
  const responders = useMemo(
    () =>
      ["nw", "ne", "sw", "se", "rotate"].map((corner) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            origin.current = { scale: latest.current.scale, rotation: latest.current.rotation };
          },
          onPanResponderMove: (_event, gesture) => {
            const current = latest.current;
            if (corner === "rotate")
              current.onChange({
                rotation: origin.current.rotation + gesture.dx / current.displayScale,
              });
            else {
              current.onChange({
                scale: resizeFromHandle({
                  ...current,
                  ...origin.current,
                  corner,
                  dx: gesture.dx,
                  dy: gesture.dy,
                }),
              });
            }
          },
        }),
      ),
    [],
  );
  if (Platform.OS !== "web") return null;
  const handleScale = scale * displayScale;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        inset: 0,
        borderWidth: minimal ? 0 : 1,
        borderColor: "#FFFFFF99",
      }}
    >
      {responders.map((pan, index) =>
        minimal && index !== 3 ? null : (
          <View
            key={index}
            {...pan.panHandlers}
            accessibilityLabel={index === 4 ? "회전 핸들" : "크기 조절 핸들"}
            style={{
              position: "absolute",
              width: 18 / handleScale,
              height: 18 / handleScale,
              borderWidth: 2 / handleScale,
              borderColor: "#171513",
              backgroundColor: minimal ? "#FFFFFF99" : "#FFFFFF",
              borderRadius: index === 4 ? 20 : 3,
              ...(index === 4
                ? { left: width / 2 - 9 / handleScale, top: 8 / handleScale }
                : { [index % 2 ? "right" : "left"]: 0, [index > 1 ? "bottom" : "top"]: 0 }),
              ...({
                cursor:
                  index === 4 ? "grab" : index === 0 || index === 3 ? "nwse-resize" : "nesw-resize",
                touchAction: "none",
              } as object),
            }}
          />
        ),
      )}
    </View>
  );
}
