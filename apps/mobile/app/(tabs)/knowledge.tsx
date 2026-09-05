import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Screen } from "../../src/components/ui";
import { readNeighborhoodPreferences } from "../../src/neighborhood-preferences";
import { fonts, radius, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type RankMode = "activity" | "running" | "strength" | "cycling" | "diving" | "swimming";
type RankRow = { rank: number; name: string; score: string; mine?: boolean };

const modes: { id: RankMode; label: string }[] = [
  { id: "activity", label: "액티비티" },
  { id: "running", label: "러닝" },
  { id: "strength", label: "근력" },
  { id: "cycling", label: "사이클" },
  { id: "diving", label: "다이빙" },
  { id: "swimming", label: "수영" },
];

const rankMeta: Record<RankMode, { rank: number; total: number; score: string; label: string }> = {
  activity: { rank: 323, total: 354, score: "7,839pt", label: "시즌 활동점수" },
  running: { rank: 18, total: 126, score: "22′48″", label: "5km PB" },
  strength: { rank: 47, total: 98, score: "315kg", label: "3대 합계" },
  cycling: { rank: 12, total: 73, score: "31.8km/h", label: "40km 평균속도" },
  diving: { rank: 9, total: 41, score: "26m", label: "CWT PB" },
  swimming: { rank: 34, total: 89, score: "1′42″", label: "100m PB" },
};

const names = ["하늘", "준", "지영", "태오", "서아", "민지", "도윤", "유나", "건우", "수아"];

function surrounding(mode: RankMode): RankRow[] {
  const meta = rankMeta[mode];
  return [-2, -1, 0, 1, 2].map((offset, index) => ({
    rank: Math.max(1, meta.rank + offset),
    name: offset === 0 ? "나" : names[(meta.rank + index) % names.length]!,
    score:
      offset === 0
        ? meta.score
        : mode === "activity"
          ? `${(7839 - offset * 21).toLocaleString("ko-KR")}pt`
          : mode === "running"
            ? ["22′31″", "22′39″", "22′56″", "23′02″"][offset < 0 ? offset + 2 : offset + 1]!
            : `${Math.max(1, Number.parseFloat(meta.score) - offset * 2)}${meta.score.replace(/[\d.,′″]/g, "")}`,
    mine: offset === 0,
  }));
}

function topTen(mode: RankMode): RankRow[] {
  const meta = rankMeta[mode];
  return names.map((name, index) => ({
    rank: index + 1,
    name,
    score:
      mode === "activity"
        ? `${(14601 - index * 21).toLocaleString("ko-KR")}pt`
        : mode === "running"
          ? ["19′42″", "20′05″", "20′18″", "20′41″", "21′02″", "21′18″", "21′33″", "21′50″", "22′04″", "22′16″"][index]!
          : `${Math.max(Number.parseFloat(meta.score), 100) + (10 - index) * 3}${meta.score.replace(/[\d.,′″]/g, "")}`,
    mine: meta.rank === index + 1,
  }));
}

export default function LeagueScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width <= 390;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<RankMode>("activity");
  const [neighborhood, setNeighborhood] = useState("쌍문동");
  const [fullRanking, setFullRanking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const meta = rankMeta[mode];

  useEffect(() => {
    void readNeighborhoodPreferences().then((saved) => {
      if (saved?.neighborhood) setNeighborhood(saved.neighborhood);
    });
  }, []);

  return (
    <Screen title="">
      <View style={styles.locationBar}>
        <View style={styles.locationIcon}><MapPin color={colors.primary} size={16} strokeWidth={2.4} /></View>
        <View style={styles.locationText}><Text style={styles.locationName}>{neighborhood}</Text><Text style={styles.locationMeta}>인증된 동네</Text></View>
        <ShieldCheck color={colors.primary} size={17} />
        <Pressable accessibilityRole="button" onPress={() => setRulesOpen(true)}><Text style={styles.rulesLink}>쟁탈 규칙</Text></Pressable>
      </View>

      <LinearGradient colors={["#37231C", "#1E1B18", "#121211"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, compact && styles.heroCompact]}>
        <View style={styles.heroOrb} />
        <Text style={styles.eyebrow}>SEASON MATCH / PERSONAL</Text>
        <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>{neighborhood}의 순위가{"\n"}<Text style={[styles.heroTitleStrong, compact && styles.heroTitleStrongCompact]}>오늘도 움직인다.</Text></Text>
        <View style={[styles.heroStats, compact && styles.heroStatsCompact]}>
          <View style={styles.rankStat}><Text style={styles.statLabel}>MY RANK</Text><View style={styles.rankLine}><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={[styles.rankValue, compact && styles.rankValueCompact]}>{meta.rank}</Text><Text numberOfLines={1} style={[styles.rankTotal, compact && styles.rankTotalCompact]}>/ {meta.total}</Text></View></View>
          <View style={[styles.scoreStat, compact && styles.scoreStatCompact]}><Text style={styles.statLabel}>{meta.label}</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.scoreValue}>{meta.score}</Text><Text style={styles.syncText}>운동 기록 자동 반영</Text></View>
        </View>
        <View style={styles.titleBand}><Text style={styles.titleBandLabel}>시즌 호칭</Text><Text style={styles.titleBandValue}>{neighborhood} 움직임의 씨앗</Text><ChevronRight color={colors.primary} size={16} /></View>
      </LinearGradient>

      <View style={styles.neighborhoodStats}>
        <View style={styles.neighborhoodStat}><Text style={styles.neighborhoodStatLabel}>동네 인원</Text><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.neighborhoodStatValue}>354명</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.neighborhoodStat}><Text style={styles.neighborhoodStatLabel}>이번 주 활동</Text><Text adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1} style={styles.neighborhoodStatValue}>186명</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.neighborhoodStat}><Text style={styles.neighborhoodStatLabel}>내 점수</Text><Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={styles.neighborhoodStatValue}>{meta.score}</Text></View>
      </View>

      <View style={styles.rankingCard}>
        <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>NEAR MY RANK</Text><Text style={styles.sectionTitle}>내 주변 개인 랭킹</Text></View><Pressable accessibilityRole="button" onPress={() => setFullRanking(true)}><Text style={styles.viewAll}>전체 보기 ↗</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {modes.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === item.id }} key={item.id} onPress={() => setMode(item.id)} style={[styles.modeButton, mode === item.id && styles.modeButtonActive]}><Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>{item.label}</Text></Pressable>)}
        </ScrollView>
        {surrounding(mode).map((row) => <RankingRow key={`${mode}-${row.rank}`} row={row} styles={styles} />)}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push("/league-region")} style={({ pressed }) => [styles.regionButton, pressed && styles.pressed]}>
        <View><Text style={styles.eyebrow}>DISTRICT LEAGUE</Text><Text style={styles.regionButtonTitle}>지역의 열기와 랭커를 한눈에</Text><Text style={styles.regionButtonCopy}>과열 지역 · 지역 인플루언서 · 경쟁 현황</Text></View><View style={styles.regionArrow}><ChevronRight color="#12100F" size={21} strokeWidth={2.5} /></View>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setFullRanking(false)} visible={fullRanking}>
        <View style={[styles.modalPage, { backgroundColor: colors.background }]}><View style={styles.modalHeader}><Pressable onPress={() => setFullRanking(false)}><Text style={styles.closeText}>‹</Text></Pressable><Text style={styles.modalTitle}>{neighborhood} 개인 랭킹</Text><View style={styles.headerSpacer} /></View><ScrollView contentContainerStyle={styles.modalContent}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>{modes.map((item) => <Pressable key={item.id} onPress={() => setMode(item.id)} style={[styles.modeButton, mode === item.id && styles.modeButtonActive]}><Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>{topTen(mode).map((row) => <RankingRow key={`top-${mode}-${row.rank}`} row={row} styles={styles} />)}{meta.rank > 10 ? <><Text style={styles.ellipsis}>•••</Text><RankingRow row={surrounding(mode)[2]!} styles={styles} /></> : null}</ScrollView></View>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setRulesOpen(false)} transparent visible={rulesOpen}><View style={styles.dialogBackdrop}><View style={styles.dialog}><View style={styles.dialogHeader}><Trophy color={colors.primary} size={22} /><Text style={styles.dialogTitle}>동네 쟁탈 규칙</Text><Pressable onPress={() => setRulesOpen(false)}><Text style={styles.dialogClose}>×</Text></Pressable></View><Text style={styles.rule}>01  인증된 같은 동네 주민끼리 개인 순위를 겨룹니다.</Text><Text style={styles.rule}>02  액티비티와 종목별 PB는 섞지 않고 분리합니다.</Text><Text style={styles.rule}>03  검증된 운동 기록은 별도 입력 없이 자동 반영됩니다.</Text><Text style={styles.rule}>04  향후 지역 리그도 기존 개인 랭킹을 유지합니다.</Text></View></View></Modal>
    </Screen>
  );
}

function RankingRow({ row, styles }: { row: RankRow; styles: ReturnType<typeof createStyles> }) {
  return <View style={[styles.rankRow, row.mine && styles.rankRowMine]}><Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={[styles.rankNumber, row.mine && styles.mineText]}>{row.rank}</Text><View style={[styles.avatar, row.mine && styles.avatarMine]}><Text style={[styles.avatarText, row.mine && styles.avatarTextMine]}>{row.name.slice(0, 1)}</Text></View><View style={styles.ranker}><Text numberOfLines={1} style={[styles.rankerName, row.mine && styles.mineText]}>{row.name}{row.mine ? " · 내 기록" : ""}</Text><Text numberOfLines={1} style={styles.rankerMeta}>{row.mine ? "인증 사용자" : "이번 주 활동 중"}</Text></View><Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={[styles.rankerScore, row.mine && styles.mineText]}>{row.score}</Text></View>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  pressed: { opacity: .78 }, locationBar: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 11 }, locationIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }, locationText: { flex: 1 }, locationName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 }, locationMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 1 }, rulesLink: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9, textDecorationLine: "underline" },
  hero: { borderRadius: radius["2xl"], overflow: "hidden", padding: 20, paddingBottom: 0, borderWidth: 1, borderColor: "#583225" }, heroCompact: { paddingHorizontal: 18 }, heroOrb: { position: "absolute", right: -45, top: -42, width: 170, height: 170, borderRadius: 85, backgroundColor: "rgba(255,90,50,.12)", borderWidth: 1, borderColor: "rgba(255,120,75,.25)" }, eyebrow: { color: colors.primary, fontFamily: fonts.displayExtra, fontSize: 9, letterSpacing: 1.25 }, heroTitle: { color: "#F7F3EF", fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, letterSpacing: -1, marginTop: 10 }, heroTitleCompact: { fontSize: 20, lineHeight: 27 }, heroTitleStrong: { fontSize: 28 }, heroTitleStrongCompact: { fontSize: 25 }, heroStats: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 8, marginBottom: 20 }, heroStatsCompact: { flexDirection: "column", alignItems: "stretch", gap: 8, marginTop: 12 }, rankStat: { flex: 1.15, minWidth: 0 }, scoreStat: { flex: .85, minWidth: 0, paddingBottom: 8 }, scoreStatCompact: { flex: 0, paddingTop: 10, paddingBottom: 0, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.08)" }, statLabel: { color: "#A9A39D", fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 1 }, rankLine: { flexDirection: "row", alignItems: "flex-end", minWidth: 0 }, rankValue: { flexShrink: 1, color: colors.primary, fontFamily: fonts.displayExtra, fontSize: 92, lineHeight: 96, letterSpacing: -6 }, rankValueCompact: { fontSize: 76, lineHeight: 80, letterSpacing: -4 }, rankTotal: { flexShrink: 0, color: "#B7B0AA", fontFamily: fonts.display, fontSize: 17, marginBottom: 14, marginLeft: 4 }, rankTotalCompact: { fontSize: 15, marginBottom: 10 }, scoreValue: { flexShrink: 1, color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 28, marginTop: 6 }, syncText: { color: "#8D8781", fontFamily: fonts.regular, fontSize: 9, marginTop: 3 }, titleBand: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,.04)", marginHorizontal: -20, paddingHorizontal: 20, paddingVertical: 13, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.06)" }, titleBandLabel: { color: "#89837E", fontFamily: fonts.medium, fontSize: 9 }, titleBandValue: { color: "#F7F3EF", fontFamily: fonts.bold, fontSize: 11, flex: 1 },
  neighborhoodStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 2 }, neighborhoodStat: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 }, neighborhoodStatLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9 }, neighborhoodStatValue: { maxWidth: "100%", color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 14, marginTop: 2 }, statDivider: { width: 1, height: 24, backgroundColor: colors.border }, rankingCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 15 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }, sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16, marginTop: 2 }, viewAll: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 }, modeRow: { gap: 17, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 9 }, modeButton: { paddingVertical: 10 }, modeButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary }, modeText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 }, modeTextActive: { color: colors.primary, fontFamily: fonts.bold }, rankRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingHorizontal: 4 }, rankRowMine: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 8, marginHorizontal: -4 }, rankNumber: { width: 40, flexShrink: 0, color: colors.muted, fontFamily: fonts.display, fontSize: 18, textAlign: "center" }, mineText: { color: colors.primary }, avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted }, avatarMine: { backgroundColor: colors.primary }, avatarText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 }, avatarTextMine: { color: "#FFFFFF" }, ranker: { flex: 1, minWidth: 0 }, rankerName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 }, rankerMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 2 }, rankerScore: { maxWidth: 92, flexShrink: 1, color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 15, textAlign: "right" },
  regionButton: { minHeight: 88, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, regionButtonTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14, marginTop: 4 }, regionButtonCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 3 }, regionArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  modalPage: { flex: 1 }, modalHeader: { minHeight: 66, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, closeText: { color: colors.ink, fontSize: 34 }, modalTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 }, headerSpacer: { width: 24 }, modalContent: { width: "100%", maxWidth: 448, alignSelf: "center", padding: 20, paddingBottom: 50 }, ellipsis: { color: colors.muted, textAlign: "center", letterSpacing: 5, paddingVertical: 12 }, dialogBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.76)", alignItems: "center", justifyContent: "center", padding: 20 }, dialog: { width: "100%", maxWidth: 400, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 13 }, dialogHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, dialogTitle: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 17 }, dialogClose: { color: colors.muted, fontSize: 25 }, rule: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 18 },
}); }
