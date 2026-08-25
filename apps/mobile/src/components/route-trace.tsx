import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { type MapPoint } from "./workout-map.types";

export function RouteTrace({
  points,
  color,
  strokeWidth = 4,
}: {
  points: MapPoint[];
  color: string;
  strokeWidth?: number;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  }

  const screenPoints = normalize(points, size.width, size.height);

  return (
    <View onLayout={onLayout} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {screenPoints.slice(1).map((point, index) => {
        const previous = screenPoints[index]!;
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`${index}-${point.x}-${point.y}`}
            style={[
              styles.segment,
              {
                backgroundColor: color,
                height: strokeWidth,
                left: (previous.x + point.x) / 2 - length / 2,
                top: (previous.y + point.y) / 2 - strokeWidth / 2,
                transform: [{ rotate: `${angle}deg` }],
                width: length,
              },
            ]}
          />
        );
      })}
      {screenPoints[0] ? (
        <View
          style={[
            styles.endpoint,
            {
              backgroundColor: "#171719",
              left: screenPoints[0].x - 6,
              top: screenPoints[0].y - 6,
            },
          ]}
        />
      ) : null}
      {screenPoints.length > 1 && screenPoints.at(-1) ? (
        <View
          style={[
            styles.endpoint,
            {
              backgroundColor: color,
              left: screenPoints.at(-1)!.x - 6,
              top: screenPoints.at(-1)!.y - 6,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function normalize(points: MapPoint[], width: number, height: number) {
  if (points.length < 2 || width <= 0 || height <= 0) return [];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = Math.max(maxLatitude - minLatitude, 0.000001);
  const longitudeRange = Math.max(maxLongitude - minLongitude, 0.000001);
  const padding = Math.min(width, height) * 0.14;
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);

  return points.map((point) => ({
    x: padding + ((point.longitude - minLongitude) / longitudeRange) * drawableWidth,
    y: padding + (1 - (point.latitude - minLatitude) / latitudeRange) * drawableHeight,
  }));
}

const styles = StyleSheet.create({
  segment: { position: "absolute", borderRadius: 999 },
  endpoint: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
