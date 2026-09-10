import type { Medal } from "@moveall/contracts";
import { Crown, LockKeyhole, PersonStanding } from "lucide-react-native";
import { Image, StyleSheet, Text, View } from "react-native";
import copperCoin from "../../assets/images/profile/achievement-copper-v1.png";
import graphiteCoin from "../../assets/images/profile/achievement-graphite-v1.png";
import { SportLogo } from "./sport-logo";
import { fonts } from "../theme";

const sportLetters = { running: "R", hiking: "H", cycling: "C", strength: "S", swimming: "W", diving: "D" } as const;

/** Metallic artwork is separate from live symbols, progress, and achievement state. */
export function AchievementMedal({ medal, size }: { medal: Medal; size: number }) {
  const iconColor = medal.earned ? "#fff3d7" : "#a7afb7";
  const emblem = medal.tier === "newbie"
    ? <Text style={[styles.letter, { color: iconColor, fontSize: size * .35, lineHeight: size * .44 }]}>{sportLetters[medal.sport]}</Text>
    : medal.tier === "instructor"
      ? <Crown size={size * .4} color={iconColor} fill={iconColor} strokeWidth={1.1} />
      : medal.tier === "advanced"
        ? <PersonStanding size={size * .43} color={iconColor} strokeWidth={2.2} />
        : <SportLogo sport={medal.sport} selected={false} color={iconColor} size={size * .46} />;
  return <View style={{ width: size, height: size }} accessible
    accessibilityLabel={`${medal.title}, ${medal.earned ? "달성" : "미달성"}, ${medal.progress}/${medal.target}${medal.physicalRewardEligible ? ", 실물 보상 대상" : ""}`}>
    <Image source={medal.earned ? copperCoin : graphiteCoin} style={styles.coin} resizeMode="contain" />
    <View pointerEvents="none" style={styles.emblem}>{emblem}</View>
    {!medal.earned ? <View style={styles.lock}>
      <LockKeyhole size={9} color="#f5f5f2" fill="#f5f5f2" strokeWidth={1.6} />
    </View> : null}
  </View>;
}

export function medalProgressPercent(medal: Pick<Medal, "progress" | "target">) {
  return medal.target > 0 && Number.isFinite(medal.progress)
    ? Math.max(0, Math.min(100, medal.progress / medal.target * 100)) : 0;
}

const styles = StyleSheet.create({
  coin: { width: "100%", height: "100%" },
  emblem: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingBottom: 1 },
  letter: { fontFamily: fonts.displayItalic, textAlign: "center", includeFontPadding: false, textShadowColor: "#0008", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  lock: { position: "absolute", right: 1, bottom: 3, width: 13, height: 13, backgroundColor: "#16191c", borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
