import { Image, StyleSheet, Text, View } from "react-native";
import { type ThemeColors } from "../theme";
import { RouteTrace } from "./route-trace";
import { WorkoutMap } from "./workout-map";
import { type MapPoint } from "./workout-map.types";

export type StoryBackground = "photo" | "map" | "ink";
export type StoryLayer = "record" | "route" | "text" | "points";
export type StoryVisibility = {
  distance: boolean;
  duration: boolean;
  pace: boolean;
  route: boolean;
  points: boolean;
};

type StoryCanvasProps = {
  background: StoryBackground;
  colors: ThemeColors;
  customText: string;
  distance: string;
  duration: string;
  layers: StoryLayer[];
  moveScore: number;
  pace: string;
  photoUri: string | null;
  routePoints: MapPoint[];
  sportLabel: string;
  themeLabel: string;
  visibility: StoryVisibility;
};

export function StoryCanvas({
  background,
  colors,
  customText,
  distance,
  duration,
  layers,
  moveScore,
  pace,
  photoUri,
  routePoints,
  sportLabel,
  themeLabel,
  visibility,
}: StoryCanvasProps) {
  const showMap = background === "map" && visibility.route;
  const showPhoto = background === "photo" && photoUri;
  const metrics = [
    visibility.distance ? `${distance} KM` : null,
    visibility.duration ? duration : null,
    visibility.pace ? pace : null,
  ].filter(Boolean);

  return (
    <View accessibilityLabel="운동 스토리 편집 미리보기" style={styles.canvas}>
      {showMap ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <WorkoutMap
            backgroundColor={colors.map}
            currentPoint={undefined}
            height={356}
            isSample={false}
            minimal
            points={routePoints}
            primaryColor={colors.primary}
            showBadge={false}
            staticMode
          />
        </View>
      ) : showPhoto ? (
        <Image
          accessibilityLabel="스토리 배경 인증샷"
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.inkBackground]}>
          <View style={[styles.inkRing, styles.inkRingLarge]} />
          <View style={[styles.inkRing, styles.inkRingSmall]} />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, showMap ? styles.mapShade : styles.photoShade]} />
      {layers.includes("route") && visibility.route && background !== "map" ? (
        <View style={styles.routeFrame}>
          <RouteTrace color={colors.primary} points={routePoints} strokeWidth={5} />
        </View>
      ) : null}
      <View style={styles.topLine}>
        <Text style={styles.brand}>MOVEALL</Text>
        <Text style={styles.sport}>{sportLabel}</Text>
      </View>
      {layers.includes("text") && customText.trim() ? (
        <Text numberOfLines={3} style={styles.customText}>
          {customText.trim()}
        </Text>
      ) : null}
      <View style={styles.bottomContent}>
        <Text style={styles.theme}>{themeLabel}</Text>
        {layers.includes("record") && metrics.length ? (
          <View style={styles.metrics}>
            {metrics.map((metric, index) => (
              <Text
                key={`${metric}-${index}`}
                style={index === 0 ? styles.metricMain : styles.metric}
              >
                {metric}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {layers.includes("points") && visibility.points ? (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreLabel}>MOVE SCORE</Text>
          <Text style={styles.scoreValue}>{moveScore.toLocaleString()} P</Text>
        </View>
      ) : null}
      {background === "photo" && !photoUri ? (
        <View style={styles.emptyPhoto}>
          <Text style={styles.emptyPhotoText}>ADD YOUR CUT</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    height: 356,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#171719",
  },
  inkBackground: { backgroundColor: "#111112" },
  inkRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
  },
  inkRingLarge: { width: 300, height: 300, right: -120, top: -80 },
  inkRingSmall: { width: 180, height: 180, right: -30, top: 20 },
  photoShade: { backgroundColor: "rgba(7,7,8,0.35)" },
  mapShade: { backgroundColor: "rgba(10,10,11,0.08)" },
  routeFrame: { position: "absolute", top: 55, left: 25, right: 25, bottom: 78 },
  topLine: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: "#FF5A24", fontSize: 9, fontWeight: "900", fontStyle: "italic" },
  sport: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  customText: {
    position: "absolute",
    left: 20,
    right: 85,
    top: 86,
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  bottomContent: { position: "absolute", left: 18, right: 18, bottom: 18 },
  theme: { color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "800" },
  metrics: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 6 },
  metricMain: { color: "#FFFFFF", fontSize: 28, lineHeight: 32, fontWeight: "900" },
  metric: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  scoreBadge: {
    position: "absolute",
    right: 16,
    top: 56,
    borderRadius: 10,
    backgroundColor: "rgba(255,90,36,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  scoreLabel: { color: "rgba(255,255,255,0.75)", fontSize: 6, fontWeight: "900" },
  scoreValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginTop: 2 },
  emptyPhoto: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPhotoText: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "900" },
});
