import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "../theme";

export function RunningArtwork({
  colors,
  compact = false,
}: {
  colors: ThemeColors;
  compact?: boolean;
}) {
  const styles = createStyles(colors);

  return (
    <View style={[styles.scene, compact && styles.sceneCompact]}>
      <View style={styles.sun} />
      <View style={styles.skyLine} />
      <View style={[styles.building, { left: "5%", height: 29 }]} />
      <View style={[styles.building, { left: "15%", height: 42 }]} />
      <View style={[styles.building, { left: "27%", height: 24 }]} />
      <View style={[styles.building, { left: "38%", height: 52 }]} />
      <View style={[styles.building, { left: "55%", height: 33 }]} />
      <View style={[styles.building, { left: "68%", height: 45 }]} />
      <View style={[styles.building, { left: "82%", height: 27 }]} />
      <View style={[styles.runner, compact && styles.runnerCompact]}>
        <View style={styles.head} />
        <View style={styles.body} />
        <View style={[styles.limb, styles.armBack]} />
        <View style={[styles.limb, styles.armFront]} />
        <View style={[styles.limb, styles.legBack]} />
        <View style={[styles.limb, styles.legFront]} />
      </View>
      {!compact ? (
        <View style={styles.posterCopy}>
          <Text style={styles.posterTag}>TODAY&apos;S RUN</Text>
          <Text style={styles.posterValue}>5.24 KM</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ArticleArtwork({ colors, kind }: { colors: ThemeColors; kind: number }) {
  const styles = createStyles(colors);
  const symbols = ["↗", "◌", "◆"];
  return (
    <View
      style={[styles.article, kind === 1 && styles.articleCool, kind === 2 && styles.articleDark]}
    >
      <View style={styles.articleDisc} />
      <Text style={styles.articleSymbol}>{symbols[kind % symbols.length]}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scene: {
      height: 232,
      overflow: "hidden",
      borderRadius: 8,
      backgroundColor: colors.map,
      position: "relative",
    },
    sceneCompact: { height: 92, borderRadius: 7 },
    sun: {
      position: "absolute",
      right: "12%",
      top: "18%",
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: "#F4C38F",
      opacity: 0.9,
    },
    skyLine: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 54,
      height: 2,
      backgroundColor: colors.border,
    },
    building: {
      position: "absolute",
      bottom: 54,
      width: "9%",
      backgroundColor: colors.muted,
      opacity: 0.55,
    },
    runner: { position: "absolute", right: "22%", bottom: 42, width: 64, height: 112 },
    runnerCompact: { transform: [{ scale: 0.62 }], right: "10%", bottom: 8 },
    head: {
      position: "absolute",
      left: 27,
      top: 3,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#18191B",
    },
    body: {
      position: "absolute",
      left: 27,
      top: 18,
      width: 13,
      height: 42,
      borderRadius: 7,
      backgroundColor: "#18191B",
      transform: [{ rotate: "10deg" }],
    },
    limb: {
      position: "absolute",
      width: 9,
      height: 43,
      borderRadius: 5,
      backgroundColor: "#18191B",
    },
    armBack: { left: 16, top: 24, transform: [{ rotate: "48deg" }] },
    armFront: { left: 43, top: 26, transform: [{ rotate: "-48deg" }] },
    legBack: { left: 14, top: 58, height: 50, transform: [{ rotate: "45deg" }] },
    legFront: { left: 42, top: 58, height: 51, transform: [{ rotate: "-36deg" }] },
    posterCopy: { position: "absolute", left: 15, bottom: 13 },
    posterTag: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
    posterValue: { color: "#FFFFFF", fontSize: 34, lineHeight: 39, fontWeight: "900" },
    article: {
      width: 74,
      height: 74,
      borderRadius: 7,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.map,
    },
    articleCool: { backgroundColor: "#DCE6E4" },
    articleDark: { backgroundColor: "#D8D8D6" },
    articleDisc: {
      position: "absolute",
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surface,
      opacity: 0.75,
    },
    articleSymbol: { color: colors.ink, fontSize: 27, fontWeight: "300" },
  });
}
