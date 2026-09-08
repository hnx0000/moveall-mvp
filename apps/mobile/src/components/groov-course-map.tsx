import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Maximize2 } from "lucide-react-native";
import { GroovMapFrame, MapModal } from "./groov-map-frame";
import type { WorkoutMapProps } from "./workout-map.types";

// Planned courses are display-only. GPS filtering, timing and persistence stay in the recorder.
export function GroovCourseMap({
  points,
  currentPoint,
  height = 208,
  compact = false,
  onFullScreenPress,
  badgeLabel,
  controlsBottom = 0,
}: WorkoutMapProps) {
  const [expanded, setExpanded] = useState(false);
  const state = { points, currentPoint, badgeLabel, controlsBottom };
  return (
    <View style={{ height, width: "100%", overflow: "hidden", backgroundColor: "#101113" }}>
      <GroovMapFrame kind="course" compact={compact} state={state} />
      {compact ? (
        <Pressable
          accessibilityLabel="코스지도 전체화면 열기"
          onPress={() => (onFullScreenPress ? onFullScreenPress() : setExpanded(true))}
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "flex-end",
            alignItems: "flex-end",
            padding: 12,
            paddingBottom: 25,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              backgroundColor: "#111e",
              padding: 9,
              borderRadius: 10,
            }}
          >
            <Maximize2 size={15} color="#ff5733" />
            <Text style={{ fontSize: 12, color: "#fff" }}>코스지도</Text>
          </View>
        </Pressable>
      ) : null}
      {expanded ? (
        <MapModal kind="course" state={state} onClose={() => setExpanded(false)} />
      ) : null}
    </View>
  );
}
