import type { LeagueMode, LeaguePlayerStanding, LeagueSnapshot } from "@moveall/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Screen, StatePanel } from "../../src/components/ui";
import { fonts, radius, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const modes: { id: LeagueMode; label: string }[] = [
  { id: "activity", label: "전체" },
  { id: "running", label: "러닝" },
  { id: "hiking", label: "등산" },
  { id: "strength", label: "근력" },
  { id: "cycling", label: "사이클" },
  { id: "swimming", label: "수영" },
  { id: "diving", label: "다이빙" },
];

export default function LeagueScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<LeagueMode>("activity");
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullRanking, setFullRanking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const reload = useCallback(
    async (quiet = false) => {
      if (!session) return;
      if (!quiet) setLoading(true);
      try {
        setSnapshot(await api.league(session.accessToken, { mode, period: "season" }));
        setError(null);
      } catch (reason) {
        if (!quiet)
          setError(reason instanceof Error ? reason.message : "지역 리그를 불러오지 못했어요.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [mode, session],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void reload(true);
      }, 3_000);
      return () => clearInterval(timer);
    }, [reload]),
  );

  const neighborhood = snapshot?.viewer.regionName ?? "동네 미인증";
  const players = snapshot?.players ?? [];
  const viewerIndex = players.findIndex((player) => player.mine);
  const nearby =
    viewerIndex >= 0
      ? players.slice(Math.max(0, viewerIndex - 2), Math.min(players.length, viewerIndex + 3))
      : players.slice(0, 5);
  const region = snapshot?.region;
  const verificationCopy =
    snapshot?.viewer.verification === "verified"
      ? "인증된 동네 · 운동 저장 즉시 반영"
      : snapshot?.viewer.verification === "expired"
        ? "동네 인증이 만료되어 새 기록은 집계되지 않아요"
        : "동네 인증 후 지역 리그에 참여할 수 있어요";

  return (
    <Screen title="">
      <View style={styles.locationBar}>
        <View style={styles.locationIcon}>
          <MapPin color={colors.primary} size={16} strokeWidth={2.4} />
        </View>
        <View style={styles.locationText}>
          <Text style={styles.locationName}>{neighborhood}</Text>
          <Text style={styles.locationMeta}>{verificationCopy}</Text>
        </View>
        <ShieldCheck
          color={snapshot?.viewer.verification === "verified" ? colors.primary : colors.muted}
          size={17}
        />
        <Pressable onPress={() => setRulesOpen(true)}>
          <Text style={styles.rulesLink}>집계 규칙</Text>
        </Pressable>
      </View>

      {loading ? <StatePanel state="loading" message="실시간 순위를 계산하고 있어요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}

      {snapshot ? (
        <>
          <LinearGradient
            colors={["#37231C", "#1E1B18", "#121211"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroOrb} />
            <Text style={styles.eyebrow}>REGIONAL LEAGUE / LIVE</Text>
            <Text style={styles.heroTitle}>
              {neighborhood}의 순위가{"\n"}
              <Text style={styles.heroTitleStrong}>지금 움직인다.</Text>
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.rankStat}>
                <Text style={styles.statLabel}>MY RANK</Text>
                <View style={styles.rankLine}>
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    numberOfLines={1}
                    style={styles.rankValue}
                  >
                    {snapshot.viewer.rank ?? "—"}
                  </Text>
                  <Text style={styles.rankTotal}>/ {players.length}</Text>
                </View>
              </View>
              <View style={styles.scoreStat}>
                <Text style={styles.statLabel}>{snapshot.season.name}</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                  numberOfLines={1}
                  style={styles.scoreValue}
                >
                  {snapshot.viewer.points.toLocaleString("ko-KR")}pt
                </Text>
                <Text style={styles.syncText}>서버 집계 · 3초 간격 갱신</Text>
              </View>
            </View>
            <View style={styles.titleBand}>
              <Text style={styles.titleBandLabel}>집계 기록</Text>
              <Text style={styles.titleBandValue}>{snapshot.viewer.activityCount}회</Text>
              <ChevronRight color={colors.primary} size={16} />
            </View>
          </LinearGradient>

          <View style={styles.neighborhoodStats}>
            <Metric label="지역 인원" value={`${region?.memberCount ?? 0}명`} styles={styles} />
            <View style={styles.statDivider} />
            <Metric
              label="참여 인원"
              value={`${region?.participantCount ?? 0}명`}
              styles={styles}
            />
            <View style={styles.statDivider} />
            <Metric
              label="참여율"
              value={`${(region?.participationRate ?? 0).toFixed(1)}%`}
              styles={styles}
            />
          </View>

          <View style={styles.rankingCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.eyebrow}>NEAR MY RANK</Text>
                <Text style={styles.sectionTitle}>지역 개인 랭킹</Text>
              </View>
              <Pressable onPress={() => setFullRanking(true)}>
                <Text style={styles.viewAll}>전체 보기 ↗</Text>
              </Pressable>
            </View>
            <ModeRow mode={mode} onChange={setMode} styles={styles} />
            {nearby.length > 0 ? (
              nearby.map((player) => (
                <RankingRow key={player.userId} player={player} styles={styles} />
              ))
            ) : (
              <Text style={styles.emptyCopy}>아직 집계된 기록이 없습니다.</Text>
            )}
          </View>

          <Pressable
            onPress={() => router.push("/league-region")}
            style={({ pressed }) => [styles.regionButton, pressed && styles.pressed]}
          >
            <View style={styles.regionCopy}>
              <Text style={styles.eyebrow}>REGION RANKING</Text>
              <Text style={styles.regionButtonTitle}>지역 점수와 순위 보기</Text>
              <Text style={styles.regionButtonCopy}>
                실제 참여 인원 · 참여율 · 지역별 누적 점수
              </Text>
            </View>
            <View style={styles.regionArrow}>
              <ChevronRight color="#12100F" size={21} strokeWidth={2.5} />
            </View>
          </Pressable>
        </>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setFullRanking(false)}
        visible={fullRanking}
      >
        <View style={[styles.modalPage, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setFullRanking(false)}>
              <Text style={styles.closeText}>‹</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{neighborhood} 개인 랭킹</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ModeRow mode={mode} onChange={setMode} styles={styles} />
            {players.map((player) => (
              <RankingRow key={`all-${player.userId}`} player={player} styles={styles} />
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setRulesOpen(false)}
        transparent
        visible={rulesOpen}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}>
              <Trophy color={colors.primary} size={22} />
              <Text style={styles.dialogTitle}>지역 리그 집계 규칙</Text>
              <Pressable onPress={() => setRulesOpen(false)}>
                <Text style={styles.dialogClose}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.rule}>
              01 동네 인증은 30일간 유효하며 서버 저장 시각을 기준으로 합니다.
            </Text>
            <Text style={styles.rule}>
              02 러닝·등산·사이클은 인증 지역에서 출발하고 돌아온 GPS 경로만 점수화합니다.
            </Text>
            <Text style={styles.rule}>
              03 수영·다이빙은 시설 특성을 반영해 인증 지역 거주만으로 참여할 수 있습니다.
            </Text>
            <Text style={styles.rule}>
              04 시간·거리·칼로리·운동강도와 종목별 지표를 동일한 공식으로 계산합니다.
            </Text>
            <Text style={styles.rule}>
              05 기록 수정·삭제도 점수 원장에 반영되며 순위는 3초마다 갱신됩니다.
            </Text>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ModeRow({
  mode,
  onChange,
  styles,
}: {
  mode: LeagueMode;
  onChange: (mode: LeagueMode) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.modeRow}
    >
      {modes.map((item) => (
        <Pressable
          accessibilityState={{ selected: mode === item.id }}
          key={item.id}
          onPress={() => onChange(item.id)}
          style={[styles.modeButton, mode === item.id && styles.modeButtonActive]}
        >
          <Text style={[styles.modeText, mode === item.id && styles.modeTextActive]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function RankingRow({
  player,
  styles,
}: {
  player: LeaguePlayerStanding;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.rankRow, player.mine && styles.rankRowMine]}>
      <Text style={[styles.rankNumber, player.mine && styles.mineText]}>{player.rank}</Text>
      <View style={[styles.avatar, player.mine && styles.avatarMine]}>
        <Text style={[styles.avatarText, player.mine && styles.avatarTextMine]}>
          {player.displayName.slice(0, 1)}
        </Text>
      </View>
      <View style={styles.ranker}>
        <Text numberOfLines={1} style={[styles.rankerName, player.mine && styles.mineText]}>
          {player.displayName}
          {player.mine ? " · 나" : ""}
        </Text>
        <Text style={styles.rankerMeta}>집계 기록 {player.activityCount}회</Text>
      </View>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        style={[styles.rankerScore, player.mine && styles.mineText]}
      >
        {player.points.toLocaleString("ko-KR")}pt
      </Text>
    </View>
  );
}

function Metric({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.neighborhoodStat}>
      <Text style={styles.neighborhoodStatLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.neighborhoodStatValue}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    pressed: { opacity: 0.78 },
    locationBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: 11,
    },
    locationIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    locationText: { flex: 1 },
    locationName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
    locationMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 1 },
    rulesLink: {
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 9,
      textDecorationLine: "underline",
    },
    hero: {
      borderRadius: radius["2xl"],
      overflow: "hidden",
      padding: 20,
      paddingBottom: 0,
      borderWidth: 1,
      borderColor: "#583225",
    },
    heroOrb: {
      position: "absolute",
      right: -45,
      top: -42,
      width: 170,
      height: 170,
      borderRadius: 85,
      backgroundColor: "rgba(255,90,50,.12)",
      borderWidth: 1,
      borderColor: "rgba(255,120,75,.25)",
    },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 9,
      letterSpacing: 1.25,
    },
    heroTitle: {
      color: "#F7F3EF",
      fontFamily: fonts.bold,
      fontSize: 22,
      lineHeight: 32,
      letterSpacing: -1,
      marginTop: 10,
    },
    heroTitleStrong: { fontSize: 28 },
    heroStats: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
      marginTop: 10,
      marginBottom: 20,
    },
    rankStat: { flex: 1.15, minWidth: 0 },
    scoreStat: { flex: 0.85, minWidth: 0, paddingBottom: 8 },
    statLabel: { color: "#A9A39D", fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 1 },
    rankLine: { flexDirection: "row", alignItems: "flex-end" },
    rankValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 76,
      lineHeight: 82,
      letterSpacing: -4,
    },
    rankTotal: {
      color: "#B7B0AA",
      fontFamily: fonts.display,
      fontSize: 15,
      marginBottom: 12,
      marginLeft: 4,
    },
    scoreValue: { color: "#FFFFFF", fontFamily: fonts.displayExtra, fontSize: 23, marginTop: 6 },
    syncText: { color: "#8D8781", fontFamily: fonts.regular, fontSize: 8, marginTop: 3 },
    titleBand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: "rgba(255,255,255,.04)",
      marginHorizontal: -20,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,.06)",
    },
    titleBandLabel: { color: "#89837E", fontFamily: fonts.medium, fontSize: 9 },
    titleBandValue: { color: "#F7F3EF", fontFamily: fonts.bold, fontSize: 11, flex: 1 },
    neighborhoodStats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
    neighborhoodStat: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 },
    neighborhoodStatLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9 },
    neighborhoodStatValue: {
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 14,
      marginTop: 2,
    },
    statDivider: { width: 1, height: 24, backgroundColor: colors.border },
    rankingCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      padding: 15,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16, marginTop: 2 },
    viewAll: { color: colors.muted, fontFamily: fonts.medium, fontSize: 10 },
    modeRow: { gap: 17, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 9 },
    modeButton: { paddingVertical: 10 },
    modeButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    modeText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
    modeTextActive: { color: colors.primary, fontFamily: fonts.bold },
    rankRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingHorizontal: 4,
    },
    rankRowMine: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      marginHorizontal: -4,
    },
    rankNumber: {
      width: 38,
      color: colors.muted,
      fontFamily: fonts.display,
      fontSize: 18,
      textAlign: "center",
    },
    mineText: { color: colors.primary },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    avatarMine: { backgroundColor: colors.primary },
    avatarText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    avatarTextMine: { color: "#FFFFFF" },
    ranker: { flex: 1, minWidth: 0 },
    rankerName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
    rankerMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 2 },
    rankerScore: {
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 14,
      textAlign: "right",
    },
    emptyCopy: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
      textAlign: "center",
      paddingVertical: 24,
    },
    regionButton: {
      minHeight: 88,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.surface,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    regionCopy: { flex: 1, minWidth: 0 },
    regionButtonTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14, marginTop: 4 },
    regionButtonCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 3 },
    regionArrow: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    modalPage: { flex: 1 },
    modalHeader: {
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeText: { color: colors.ink, fontSize: 34 },
    modalTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    headerSpacer: { width: 24 },
    modalContent: {
      width: "100%",
      maxWidth: 448,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 50,
    },
    dialogBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,.76)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    dialog: {
      width: "100%",
      maxWidth: 400,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 13,
    },
    dialogHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
    dialogTitle: { flex: 1, color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    dialogClose: { color: colors.muted, fontSize: 25 },
    rule: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 18 },
  });
}
