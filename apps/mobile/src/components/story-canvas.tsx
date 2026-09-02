import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { type ThemeColors } from "../theme";
import { RouteTrace } from "./route-trace";
import { WorkoutMap } from "./workout-map";
import { type MapPoint } from "./workout-map.types";

export type StoryBackground = "photo" | "map" | "ink";
export type StoryLayer = "record" | "route" | "text" | "points";
export type StoryLayout = "editorial" | "centered" | "split" | "low";
export type StoryMetricKey = "distance" | "duration" | "pace";
export type StoryScale = "compact" | "standard" | "bold";
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
  distanceUnit?: string;
  duration: string;
  layout?: StoryLayout;
  layers: StoryLayer[];
  metricOrder?: StoryMetricKey[];
  moveScore: number;
  pace: string;
  photoSource?: ImageSourcePropType;
  photoUri: string | null;
  routePoints: MapPoint[];
  sportLabel: string;
  themeLabel: string;
  visibility: StoryVisibility;
  scale?: StoryScale;
  height?: number;
};

export function StoryCanvas({
  background,
  colors,
  customText,
  distance,
  distanceUnit = "KM",
  duration,
  layout = "editorial",
  layers,
  metricOrder = ["distance", "duration", "pace"],
  moveScore,
  pace,
  photoSource,
  photoUri,
  routePoints,
  sportLabel,
  themeLabel,
  visibility,
  scale = "standard",
  height = 356,
}: StoryCanvasProps) {
  const showMap = background === "map" && visibility.route;
  const resolvedPhotoSource = photoSource ?? (photoUri ? { uri: photoUri } : null);
  const showPhoto = background === "photo" && resolvedPhotoSource;
  const customTextStyle =
    layout === "centered"
      ? styles.customTextCentered
      : layout === "split"
        ? styles.customTextSplit
        : layout === "low"
          ? styles.customTextLow
          : styles.customTextEditorial;
  const metricValues: Record<StoryMetricKey, string> = {
    distance: `${distance} ${distanceUnit}`,
    duration,
    pace,
  };
  const metrics = metricOrder
    .filter((key) => visibility[key])
    .map((key) => ({ key, value: metricValues[key] }));
  const compact = scale === "compact";
  const bold = scale === "bold";

  return (
    <View accessibilityLabel="운동 스토리 편집 미리보기" style={[styles.canvas, { height }]}>
      {showMap ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <WorkoutMap
            backgroundColor={colors.map}
            currentPoint={undefined}
            height={height}
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
          resizeMode="cover"
          source={resolvedPhotoSource}
          style={styles.photoBackground}
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
        <Text style={styles.brand}>GROOV</Text>
        <Text style={styles.sport}>{sportLabel}</Text>
      </View>
      {layers.includes("text") && customText.trim() ? (
        <Text
          numberOfLines={3}
          style={[
            styles.customText,
            customTextStyle,
            compact && styles.customTextCompact,
            bold && styles.customTextBold,
          ]}
        >
          {customText.trim()}
        </Text>
      ) : null}
      <View
        style={[
          styles.bottomContent,
          showMap && styles.mapBottomContent,
          layout === "centered" && styles.bottomContentCentered,
        ]}
      >
        <Text style={styles.theme}>{themeLabel}</Text>
        {layers.includes("record") && metrics.length ? (
          <View style={[styles.metrics, layout === "centered" && styles.metricsCentered]}>
            {metrics.map((metric, index) => (
              <Text
                key={metric.key}
                style={[
                  index === 0 ? styles.metricMain : styles.metric,
                  compact && (index === 0 ? styles.metricMainCompact : styles.metricCompact),
                  bold && (index === 0 ? styles.metricMainBold : styles.metricBold),
                ]}
              >
                {metric.value}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {layers.includes("points") && visibility.points ? (
        <View
          style={[
            styles.scoreBadge,
            layout === "split" ? styles.scoreBadgeLeft : styles.scoreBadgeRight,
            compact && styles.scoreBadgeCompact,
            bold && styles.scoreBadgeBold,
          ]}
        >
          <Text style={styles.scoreLabel}>GROOV POINTS</Text>
          <Text style={styles.scoreValue}>{moveScore.toLocaleString()} P</Text>
        </View>
      ) : null}
      {background === "photo" && !resolvedPhotoSource ? (
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
  photoBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
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
    color: "#FFFFFF",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  customTextEditorial: { left: 20, right: 85, top: 86 },
  customTextCentered: {
    left: 32,
    right: 32,
    top: 178,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 34,
  },
  customTextSplit: {
    left: 148,
    right: 20,
    top: 112,
    textAlign: "right",
    fontSize: 22,
    lineHeight: 28,
  },
  customTextLow: {
    left: 20,
    right: 20,
    bottom: 132,
    fontSize: 27,
    lineHeight: 33,
  },
  customTextCompact: { fontSize: 20, lineHeight: 25 },
  customTextBold: { fontSize: 30, lineHeight: 36 },
  bottomContent: { position: "absolute", left: 18, right: 18, bottom: 18 },
  mapBottomContent: { bottom: 36 },
  bottomContentCentered: { alignItems: "center" },
  theme: { color: "rgba(255,255,255,0.75)", fontSize: 9, fontWeight: "800" },
  metrics: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 6 },
  metricsCentered: { justifyContent: "center" },
  metricMain: { color: "#FFFFFF", fontSize: 28, lineHeight: 32, fontWeight: "900" },
  metric: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", marginBottom: 4 },
  metricMainCompact: { fontSize: 22, lineHeight: 26 },
  metricCompact: { fontSize: 9 },
  metricMainBold: { fontSize: 34, lineHeight: 38 },
  metricBold: { fontSize: 13 },
  scoreBadge: {
    position: "absolute",
    top: 56,
    borderRadius: 10,
    backgroundColor: "rgba(255,90,36,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  scoreBadgeRight: { right: 16 },
  scoreBadgeLeft: { left: 16 },
  scoreBadgeCompact: { paddingHorizontal: 8, paddingVertical: 6 },
  scoreBadgeBold: { paddingHorizontal: 13, paddingVertical: 10 },
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
