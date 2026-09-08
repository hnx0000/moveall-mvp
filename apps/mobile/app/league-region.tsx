import type { LeagueMode, LeaguePeriod, LeagueSnapshot } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronLeft, Flame, ShieldCheck, Trophy } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GroovRankingMap } from "../src/components/groov-map-frame";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth/auth-context";
import { Screen, StatePanel } from "../src/components/ui";
import { koreaMunicipalities, type KoreaMunicipality } from "../src/assets/korea-municipal-paths";
import { fonts, radius, type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const sports = ["전체", "러닝", "근력", "사이클", "등산", "수영", "다이빙"] as const;
const periods = ["이번 주", "이번 달", "시즌"] as const;
const seoulAreas = koreaMunicipalities.filter((area) => area.province === "서울");
const sportModes: Record<(typeof sports)[number], LeagueMode> = {
  전체: "activity",
  러닝: "running",
  근력: "strength",
  사이클: "cycling",
  등산: "hiking",
  수영: "swimming",
  다이빙: "diving",
};
const periodModes: Record<(typeof periods)[number], LeaguePeriod> = {
  "이번 주": "week",
  "이번 달": "month",
  시즌: "season",
};

function normalizeAdministrativeName(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s/g, "")
    .replace(/(특별자치도|특별자치시|특별시|광역시|도|시)$/u, "");
}

function municipalityStanding(snapshot: LeagueSnapshot | null, area: KoreaMunicipality) {
  return (
    snapshot?.regions.find((region) => {
      const sameMunicipality =
        normalizeAdministrativeName(region.regionName) === normalizeAdministrativeName(area.name);
      const sameProvince =
        !region.province ||
        normalizeAdministrativeName(region.province) === normalizeAdministrativeName(area.province);
      return sameMunicipality && sameProvince;
    }) ?? null
  );
}

export default function LeagueRegionScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedCode, setSelectedCode] = useState("11100");
  const [mapFocus, setMapFocus] = useState(0);
  const [sport, setSport] = useState<(typeof sports)[number]>("전체");
  const [period, setPeriod] = useState<(typeof periods)[number]>("이번 주");
  const [snapshot, setSnapshot] = useState<LeagueSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | undefined>();
  const selectedArea =
    koreaMunicipalities.find((item) => item.code === selectedCode) ?? seoulAreas[0]!;
  const maxPoints = Math.max(0, ...(snapshot?.regions.map((region) => region.points) ?? []));
  const regionAreas = koreaMunicipalities.map((item) => {
    const standing = municipalityStanding(snapshot, item);
    const heat = maxPoints > 0 && standing ? Math.round((standing.points / maxPoints) * 100) : 0;
    const heatLevel = heat >= 76 ? "과열" : heat >= 60 ? "버닝" : heat >= 42 ? "활성" : "기본";
    return { ...item, standing, heat, heatLevel, score: standing?.points ?? 0 };
  });
  const ranked = regionAreas.filter((item) => item.standing).sort((a, b) => b.score - a.score);
  const area = regionAreas.find((item) => item.code === selectedArea.code) ?? {
    ...selectedArea,
    standing: null,
    heat: 0,
    heatLevel: "기본",
    score: 0,
  };
  const rank = area.standing?.rank ?? null;
  const selectedPlayers =
    snapshot && snapshot.region?.regionKey === area.standing?.regionKey ? snapshot.players : [];
  const rivals = ranked
    .filter((item) => item.code !== area.code)
    .sort((a, b) => Math.abs(a.score - area.score) - Math.abs(b.score - area.score))
    .slice(0, 2);

  const reload = useCallback(async () => {
    if (!session) return;
    try {
      const next = await api.league(session.accessToken, {
        mode: sportModes[sport],
        period: periodModes[period],
        ...(selectedRegionKey ? { regionKey: selectedRegionKey } : {}),
      });
      setSnapshot(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "지역 집계를 불러오지 못했어요.");
    }
  }, [period, selectedRegionKey, session, sport]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void reload();
      }, 3_000);
      return () => clearInterval(timer);
    }, [reload]),
  );
  function selectArea(item: KoreaMunicipality) {
    setSelectedCode(item.code);
    setSelectedRegionKey(municipalityStanding(snapshot, item)?.regionKey ?? `empty:${item.code}`);
  }

  function selectMyRegion() {
    const viewerStanding = snapshot?.regions.find(
      (region) => region.regionKey === snapshot.viewer.regionKey,
    );
    const mine = viewerStanding
      ? koreaMunicipalities.find((item) => {
          const sameMunicipality =
            normalizeAdministrativeName(viewerStanding.regionName) ===
            normalizeAdministrativeName(item.name);
          const sameProvince =
            !viewerStanding.province ||
            normalizeAdministrativeName(viewerStanding.province) ===
              normalizeAdministrativeName(item.province);
          return sameMunicipality && sameProvince;
        })
      : undefined;
    if (mine) {
      setSelectedCode(mine.code);
      setSelectedRegionKey(viewerStanding?.regionKey);
      setMapFocus((value) => value + 1);
      return;
    }
    setSelectedRegionKey(undefined);
  }

  return (
    <Screen title="">
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="리그로 돌아가기"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <ChevronLeft color={colors.ink} size={25} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>MUNICIPAL LEAGUE / LIVE</Text>
          <Text style={styles.title}>지역 리그</Text>
        </View>
        <Pressable onPress={selectMyRegion}>
          <Text style={styles.myRegion}>내 지역</Text>
        </Pressable>
      </View>
      <View style={styles.intro}>
        <View>
          <Text style={styles.introTitle}>움직임이 도시를 달군다</Text>
          <Text style={styles.introCopy}>운동 저장 즉시 서버 집계 · 3초 간격 순위 갱신</Text>
        </View>
        <Flame color={colors.primary} fill={colors.primary} size={25} />
      </View>
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}

      <GroovRankingMap
        state={{ league: snapshot, selection: { code: selectedCode, focus: mapFocus } }}
        onRegionSelect={({ code }) => {
          const item = koreaMunicipalities.find((candidate) => candidate.code === code);
          if (item) selectArea(item);
        }}
      />

      <FilterRow values={periods} selected={period} onSelect={setPeriod} styles={styles} />
      <FilterRow values={sports} selected={sport} onSelect={setSport} styles={styles} />
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.eyebrow}>
              {area.province} · {area.heatLevel} {area.heat}° · {period}
            </Text>
            <Text style={styles.districtName}>{area.name}</Text>
            <Text style={styles.change}>
              {snapshot
                ? `${new Date(snapshot.generatedAt).toLocaleTimeString("ko-KR")} 기준`
                : "집계 연결 중"}
            </Text>
          </View>
          <Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={styles.place}>
            {rank ? `#${rank}` : "—"}
          </Text>
        </View>
        <View style={styles.stats}>
          <Stat
            label="지역 인원"
            value={(area.standing?.memberCount ?? 0).toLocaleString("ko-KR")}
            styles={styles}
          />
          <Stat
            label="리그 참여"
            value={(area.standing?.participantCount ?? 0).toLocaleString("ko-KR")}
            styles={styles}
          />
          <Stat
            label="참여율"
            value={`${(area.standing?.participationRate ?? 0).toFixed(1)}%`}
            styles={styles}
          />
          <Stat label="지역 점수" value={area.score.toLocaleString("ko-KR")} styles={styles} />
        </View>
        {area.standing?.leader ? (
          <View style={styles.leader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{area.standing.leader.displayName.slice(0, 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>THIS REGION RANKER</Text>
              <Text style={styles.leaderName}>{area.standing.leader.displayName}</Text>
              <Text style={styles.leaderTitle}>
                {sport} 기여 1위 · {area.standing.leader.points.toLocaleString("ko-KR")}pt
              </Text>
            </View>
            <Trophy color={colors.primary} size={24} />
          </View>
        ) : (
          <Text style={styles.emptyCopy}>이 지역에는 아직 집계된 기록이 없습니다.</Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{area.name} 지역 내 순위</Text>
        {selectedPlayers.length > 0 ? (
          selectedPlayers.map((player) => (
            <View key={player.userId} style={styles.rankRow}>
              <Text style={styles.rankNumber}>{player.rank}</Text>
              <View style={styles.rankCopy}>
                <Text numberOfLines={1} style={styles.rankName}>
                  {player.displayName}
                  {player.mine ? " · 나" : ""}
                </Text>
                <Text numberOfLines={1} style={styles.rankMeta}>
                  {sport} · 집계 기록 {player.activityCount}회
                </Text>
              </View>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={styles.rankScore}
              >
                {player.points.toLocaleString("ko-KR")}pt
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyCopy}>선택 지역의 참여 기록이 없습니다.</Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>점수 차가 가까운 지역</Text>
        {rivals.map((item) => (
          <Pressable key={item.code} onPress={() => selectArea(item)} style={styles.rivalRow}>
            <View style={styles.rivalCopy}>
              <Text numberOfLines={1} style={styles.rankName}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={styles.rankMeta}>
                {item.heatLevel} · 우리 지역과{" "}
                {Math.abs(item.score - area.score).toLocaleString("ko-KR")}점 차이
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              numberOfLines={1}
              style={styles.rankScore}
            >
              {item.score.toLocaleString("ko-KR")}pt
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.notice}>
        <ShieldCheck color={colors.primary} size={19} />
        <Text style={styles.noticeText}>
          지도 경계는 통계청 시군구 자료를 단순화한 시각 정보입니다. 점수·인원·참여율·순위는 서버의
          실제 운동 원장에서 집계하며, 사용자의 정확한 위치와 운동 경로는 공개하지 않습니다.
        </Text>
      </View>
    </Screen>
  );
}

function FilterRow<T extends string>({
  values,
  selected,
  onSelect,
  styles,
}: {
  values: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
    >
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.filter, selected === value && styles.filterActive]}
        >
          <Text style={[styles.filterText, selected === value && styles.filterTextActive]}>
            {value}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", marginHorizontal: -5 },
    iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.1,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 26, letterSpacing: -1 },
    myRegion: {
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 10,
      textDecorationLine: "underline",
    },
    intro: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    introTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    introCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 3 },
    filters: { gap: 6 },
    filter: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    filterActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    filterText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
    filterTextActive: { color: colors.primary, fontFamily: fonts.bold },
    panel: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
    },
    panelHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    panelHeaderCopy: { flex: 1, minWidth: 0 },
    districtName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 25, marginTop: 2 },
    change: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8, marginTop: 3 },
    place: {
      maxWidth: 104,
      flexShrink: 1,
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 35,
      textAlign: "right",
    },
    stats: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 13,
      marginTop: 10,
    },
    stat: { flex: 1, minWidth: 0, paddingHorizontal: 3 },
    statValue: {
      maxWidth: "100%",
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 14,
    },
    statLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    panelSubTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    trend: { paddingTop: 13, gap: 8 },
    trendBars: { height: 42, flexDirection: "row", alignItems: "flex-end", gap: 5 },
    trendBar: { flex: 1, borderRadius: 3, backgroundColor: colors.primarySoft },
    trendBarActive: { backgroundColor: colors.primary },
    leader: { flexDirection: "row", alignItems: "center", gap: 11, paddingTop: 14 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
    leaderName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12, marginTop: 2 },
    leaderTitle: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginTop: 2 },
    section: { gap: 2 },
    emptyCopy: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 10,
      paddingVertical: 14,
    },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14, marginBottom: 5 },
    rankRow: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rankNumber: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 17,
      width: 38,
      flexShrink: 0,
      textAlign: "center",
    },
    rankCopy: { flex: 1, minWidth: 0 },
    rankName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 11 },
    rankMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8, marginTop: 2 },
    rankScore: {
      maxWidth: 104,
      flexShrink: 1,
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 13,
      textAlign: "right",
    },
    rivalRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rivalCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
    notice: {
      flexDirection: "row",
      gap: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 14,
    },
    noticeText: {
      flex: 1,
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 8,
      lineHeight: 15,
    },
  });
}
