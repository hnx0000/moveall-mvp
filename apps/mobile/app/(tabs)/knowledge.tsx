import type { LeagueMode, LeaguePlayerStanding, LeagueSnapshot } from "@moveall/contracts";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, usePreviewApi } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Screen, StatePanel } from "../../src/components/ui";
import { uiLayout, fonts, radius, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";
import { leagueRankProgress } from "../../src/components/league-rank-progress";

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
  const { colors, mode: colorMode } = useAppTheme();
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
  const topTen = players.slice(0, 10);
  const viewerOutsideTopTen = players.find((player) => player.mine && !topTen.includes(player));
  const progress = snapshot ? leagueRankProgress(players, snapshot.viewer) : null;
  const region = snapshot?.region;
  const verificationCopy =
    usePreviewApi ? "샘플 리그 · 가상 기록으로 계산한 순위" : snapshot?.viewer.verification === "verified"
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
            colors={colorMode === "dark" ? ["#281C13", "#12140F", "#0D120E"] : ["#F8E5D9", colors.surface, colors.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroTrophy}>
              <Trophy size={220} strokeWidth={0.9} color={colors.primary} />
            </View>
            <Text style={styles.eyebrow}>{usePreviewApi ? "REGIONAL LEAGUE / DEMO" : "REGIONAL LEAGUE / LIVE"}</Text>
            <Text style={styles.heroTitle}>
              함께 뛰는 동네,{"\n"}
              <Text style={styles.heroTitleStrong}>뜨거워지는 순위.</Text>
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
                <Text style={styles.syncText}>{usePreviewApi ? "샘플 기록 집계 · 실제 순위 아님" : "서버 집계 · 3초 간격 갱신"}</Text>
              </View>
            </View>
            <View style={styles.rankProgress}>
              <View style={styles.progressHeading}>
                <Text style={styles.progressLabel}>{progress?.kind === "chasing" ? `${progress.rank}위까지 남은 점수` : progress?.kind === "leader" ? "정상을 지키는 중" : "나의 다음 순위"}</Text>
                <Text style={styles.progressPercent}>{progress?.kind === "chasing" ? `${progress.remainingPercent.toFixed(1)}% 남음` : progress?.kind === "leader" ? "1위 유지 중" : "—"}</Text>
              </View>
              {progress?.kind === "chasing" ? (
                <View accessibilityRole="progressbar" accessibilityLabel="다음 순위 목표 점수 도달률" accessibilityValue={{ min: 0, max: 100, now: progress.reachedPercent, text: `${progress.remainingPercent.toFixed(1)}% 남음` }} style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress.reachedPercent}%` }]} />
                  <View pointerEvents="none" style={styles.progressTicks}>{Array.from({ length: 19 }, (_, index) => <View key={index} style={styles.progressTick} />)}</View>
                </View>
              ) : progress?.kind === "leader" ? <View style={styles.leaderRule} /> : null}
              <Text style={styles.progressFoot}>
                {progress?.kind === "chasing" ? `${progress.remainingPoints.toLocaleString("ko-KR")}pt 더 쌓으면 추월 · 목표 ${progress.targetPoints.toLocaleString("ko-KR")}pt`
                  : progress?.kind === "leader" ? progress.gap === null ? "이번 시즌 첫 주자예요. 나의 페이스를 이어가세요." : `2위와 ${progress.gap.toLocaleString("ko-KR")}pt 차이 · 나의 페이스를 이어가세요.`
                    : progress?.kind === "unranked" ? "집계 가능한 운동을 기록하면 순위 도전이 시작돼요." : "다음 순위 정보를 불러오는 중이에요."}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="내 집계 기록 보기" onPress={() => router.push("/profile/records")} style={styles.titleBand}>
              <Text style={styles.titleBandLabel}>집계 기록</Text>
              <Text style={styles.titleBandValue}>{snapshot.viewer.activityCount}회</Text>
              <ChevronRight color={colors.primary} size={16} />
            </Pressable>
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
                <Text style={styles.eyebrow}>REGION TOP 10</Text>
                <Text style={styles.sectionTitle}>지역 개인 랭킹</Text>
              </View>
              <Pressable onPress={() => setFullRanking(true)}>
                <Text style={styles.viewAll}>전체 보기 ↗</Text>
              </Pressable>
            </View>
            <ModeRow mode={mode} onChange={setMode} styles={styles} />
            {topTen.length > 0 ? (
              topTen.map((player) => (
                <RankingRow key={player.userId} player={player} styles={styles} compact />
              ))
            ) : (
              <Text style={styles.emptyCopy}>아직 집계된 기록이 없습니다.</Text>
            )}
            {viewerOutsideTopTen ? <View style={styles.myRankFooter}><RankingRow player={viewerOutsideTopTen} styles={styles} compact /></View> : null}
          </View>

          <Pressable
            onPress={() => router.push("/league-region")}
            style={({ pressed }) => [styles.regionButton, pressed && styles.pressed]}
          >
            <View style={styles.regionCopy}>
              <Text style={styles.eyebrow}>REGION RANKING</Text>
              <Text style={styles.regionButtonTitle}>지역 점수와 순위 보기</Text>
              <Text style={styles.regionButtonCopy}>
                {usePreviewApi ? "샘플 참여 인원 · 참여율 · 지역별 누적 점수" : "실제 참여 인원 · 참여율 · 지역별 누적 점수"}
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
            <Text style={styles.rule}>
              06 다음 순위의 목표는 바로 위 순위보다 1pt 높은 점수입니다. 남은 비율은 (목표 점수 − 내 점수) ÷ 목표 점수로 계산하며, 다른 사람의 기록에 따라 달라집니다.
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
  compact = false,
}: {
  player: LeaguePlayerStanding;
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View accessibilityLabel={`${player.rank}위 ${player.displayName}${player.mine ? ", 나" : ""}, ${player.points}점, 집계 기록 ${player.activityCount}회`} style={[styles.rankRow, compact && styles.rankRowCompact, player.mine && styles.rankRowMine]}>
      <Text style={[styles.rankNumber, player.mine && styles.mineText]}>{player.rank}</Text>
      <View style={[styles.avatar, compact && styles.avatarCompact, player.mine && styles.avatarMine]}>
        <Text style={[styles.avatarText, player.mine && styles.avatarTextMine]}>
          {player.displayName.slice(0, 1)}
        </Text>
      </View>
      <View style={styles.ranker}>
        <Text numberOfLines={1} style={[styles.rankerName, player.mine && styles.mineText]}>
          {player.displayName}
          {player.mine ? " · 나" : ""}
        </Text>
        {!compact ? <Text style={styles.rankerMeta}>집계 기록 {player.activityCount}회</Text> : null}
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
      borderRadius: uiLayout.panelRadius,
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
      borderRadius: uiLayout.panelRadius,
      overflow: "hidden",
      padding: 20,
      paddingBottom: 0,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroTrophy: {
      position: "absolute",
      right: -32,
      top: 15,
      opacity: 0.085,
      transform: [{ rotate: "-14deg" }],
    },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 12,
      letterSpacing: 1.25,
    },
    heroTitle: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 22,
      lineHeight: 32,
      letterSpacing: -1,
      marginTop: 10,
    },
    heroTitleStrong: { fontSize: 25 },
    heroStats: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 12,
      marginTop: 10,
      marginBottom: 20,
    },
    rankStat: { flex: 1.15, minWidth: 0 },
    scoreStat: { flex: 0.85, minWidth: 0, paddingBottom: 8 },
    statLabel: { color: colors.muted, fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 1 },
    rankLine: { flexDirection: "row", alignItems: "flex-end" },
    rankValue: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 76,
      lineHeight: 82,
      letterSpacing: -4,
      textShadowColor: "#FF5A3677",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 18,
    },
    rankTotal: {
      color: colors.muted,
      fontFamily: fonts.display,
      fontSize: 15,
      marginBottom: 12,
      marginLeft: 4,
    },
    scoreValue: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 23, marginTop: 6 },
    syncText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 3 },
    rankProgress: { gap: 9, paddingBottom: 18 },
    progressHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
    progressLabel: { fontSize: 12, color: colors.muted, fontFamily: fonts.medium },
    progressPercent: { fontSize: 16, color: colors.primary, fontFamily: fonts.displayExtra },
    progressTrack: { height: 10, backgroundColor: "#38362D", overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: colors.primary },
    progressTicks: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row", justifyContent: "space-evenly" },
    progressTick: { width: 3, height: "100%", backgroundColor: colors.background },
    progressFoot: { fontSize: 12, lineHeight: 19, color: colors.muted },
    leaderRule: { height: 2, backgroundColor: colors.primary, opacity: 0.45 },
    titleBand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      backgroundColor: colors.surfaceMuted,
      marginHorizontal: -20,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    titleBandLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
    titleBandValue: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11, flex: 1 },
    neighborhoodStats: { flexDirection: "row", alignItems: "center", paddingHorizontal: 2 },
    neighborhoodStat: { flex: 1, minWidth: 0, alignItems: "center", paddingHorizontal: 4 },
    neighborhoodStatLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
    neighborhoodStatValue: {
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 20,
      marginTop: 2,
    },
    statDivider: { width: 1, height: 24, backgroundColor: colors.border },
    rankingCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.panelRadius,
      padding: 15,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16, marginTop: 2 },
    viewAll: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
    modeRow: { gap: 17, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: 9 },
    modeButton: { paddingVertical: 10 },
    modeButtonActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    modeText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
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
      borderRadius: uiLayout.panelRadius,
      paddingHorizontal: 8,
      marginHorizontal: -4,
    },
    rankRowCompact: { minHeight: 42, paddingVertical: 6, gap: 6 },
    avatarCompact: { width: 25, height: 25, borderRadius: 13 },
    myRankFooter: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
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
    rankerName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
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
      borderRadius: uiLayout.panelRadius,
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
      borderRadius: uiLayout.dialogRadius,
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
