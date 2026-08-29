import {
  sportLabels,
  type Medal,
  type MedalTier,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

export function RecordsScreen({ sport }: { sport?: SportType }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      setLoading(true);
      void Promise.all([api.workouts(session.accessToken), api.medals(session.accessToken)])
        .then(([nextWorkouts, nextMedals]) => {
          setWorkouts(sport ? nextWorkouts.filter((item) => item.sport === sport) : nextWorkouts);
          setMedals(sport ? nextMedals.filter((item) => item.sport === sport) : nextMedals);
        })
        .catch((caught) =>
          setError(caught instanceof ApiError ? caught.message : "기록을 불러오지 못했습니다."),
        )
        .finally(() => setLoading(false));
    }, [session, sport]),
  );

  const totalMinutes = workouts.reduce(
    (sum, item) =>
      sum +
      Math.max(1, Math.round((Date.parse(item.endedAt) - Date.parse(item.startedAt)) / 60_000)),
    0,
  );
  const totalDistance = workouts.reduce((sum, item) => sum + (item.metrics.distanceKm ?? 0), 0);
  const title = sport ? sportLabels[sport] : "전체 운동";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Text style={styles.brand}>GROOV</Text>
        </View>
        <Text style={styles.eyebrow}>MY PERFORMANCE</Text>
        <Text style={styles.title}>{title} 아카이브</Text>
        <Text style={styles.lead}>운동을 쌓은 시간과 단계별 메달을 한 화면에서 확인합니다.</Text>

        <View style={styles.summaryRow}>
          <Summary value={String(workouts.length)} label="기록" styles={styles} />
          <Summary value={`${totalMinutes}`} label="누적 분" styles={styles} />
          <Summary value={totalDistance.toFixed(1)} label="누적 KM" styles={styles} />
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>MEDAL CABINET</Text>
            <Text style={styles.sectionTitle}>단계별 메달</Text>
          </View>
          <Text style={styles.sectionCount}>
            {medals.filter((item) => item.earned).length}/{medals.length}
          </Text>
        </View>
        <View style={styles.medalGrid}>
          {medals.map((medal) => (
            <MedalCard key={medal.id} medal={medal} styles={styles} />
          ))}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>ACTIVITY LOG</Text>
            <Text style={styles.sectionTitle}>상세 기록</Text>
          </View>
          <Text style={styles.sectionCount}>{workouts.length}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && workouts.length === 0 ? (
          <Text style={styles.empty}>아직 기록이 없습니다.</Text>
        ) : null}
        <View style={styles.recordList}>
          {workouts.map((workout, index) => (
            <View key={workout.id} style={styles.recordCard}>
              <Text style={styles.recordIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.recordBody}>
                <Text style={styles.recordSport}>{sportLabels[workout.sport]}</Text>
                <Text style={styles.recordDate}>
                  {new Date(workout.startedAt).toLocaleDateString("ko-KR")}
                </Text>
                <Text style={styles.recordNote}>{workout.notes ?? "기록된 메모가 없습니다."}</Text>
              </View>
              <View style={styles.recordMetric}>
                <Text style={styles.recordMetricStrong}>{primaryMetric(workout)}</Text>
                <Text style={styles.recordMetricSub}>강도 {workout.perceivedExertion}/10</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({
  value,
  label,
  styles,
}: {
  value: string;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MedalCard({ medal, styles }: { medal: Medal; styles: ReturnType<typeof createStyles> }) {
  const special = medal.physicalRewardEligible;
  return (
    <View
      style={[
        styles.medalCard,
        special && styles.medalCardSpecial,
        !medal.earned && styles.medalCardLocked,
      ]}
    >
      <View style={[styles.medalMark, special && styles.medalMarkSpecial]}>
        <Text style={styles.medalGlyph}>{medal.earned ? tierGlyph(medal.tier) : "·"}</Text>
      </View>
      <Text style={styles.medalTier}>{tierLabel(medal.tier)}</Text>
      <Text numberOfLines={1} style={styles.medalTitle}>
        {medal.title}
      </Text>
      <Text style={styles.medalProgress}>
        {medal.progress}/{medal.target}
      </Text>
      {special ? (
        <Text style={styles.realEdition}>
          {medal.earned ? "실물 메달 신청 가능" : "REAL EDITION LOCKED"}
        </Text>
      ) : null}
    </View>
  );
}

function tierLabel(tier: MedalTier) {
  return tier === "newbie"
    ? "뉴비"
    : tier === "intermediate"
      ? "중급자"
      : tier === "advanced"
        ? "상급자"
        : tier === "athlete"
          ? "선수급"
          : "강사급";
}
function tierGlyph(tier: MedalTier) {
  return tier === "newbie"
    ? "N"
    : tier === "intermediate"
      ? "I"
      : tier === "advanced"
        ? "A"
        : tier === "athlete"
          ? "★"
          : "M";
}
function primaryMetric(workout: WorkoutSession) {
  if (typeof workout.metrics.distanceKm === "number")
    return `${workout.metrics.distanceKm.toFixed(2)} KM`;
  if (typeof workout.metrics.volumeKg === "number")
    return `${Math.round(workout.metrics.volumeKg)} KG`;
  return `${Math.round((Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 60_000)} MIN`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: 448,
      alignSelf: "center",
      padding: 22,
      paddingBottom: 100,
      gap: 18,
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    back: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    brand: { color: colors.primary, fontSize: 16, fontWeight: "900", fontStyle: "italic" },
    eyebrow: { color: colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: -1 },
    lead: { color: colors.muted, fontSize: 11, lineHeight: 18 },
    summaryRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 16,
    },
    summary: { flex: 1, alignItems: "center", gap: 3 },
    summaryValue: { color: colors.ink, fontSize: 22, fontWeight: "900" },
    summaryLabel: { color: colors.muted, fontSize: 7, fontWeight: "800" },
    sectionHead: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 3 },
    sectionCount: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    medalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    medalCard: {
      width: "31.8%",
      minHeight: 154,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
      gap: 5,
      justifyContent: "center",
    },
    medalCardSpecial: { backgroundColor: colors.ink, borderColor: colors.primary, borderWidth: 2 },
    medalCardLocked: { opacity: 0.48 },
    medalMark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    medalMarkSpecial: { width: 58, borderRadius: 8 },
    medalGlyph: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
    medalTier: { color: colors.primary, fontSize: 7, fontWeight: "900" },
    medalTitle: { color: colors.ink, fontSize: 9, fontWeight: "900", maxWidth: "100%" },
    medalProgress: { color: colors.muted, fontSize: 7 },
    realEdition: { color: colors.primary, fontSize: 6, fontWeight: "900", letterSpacing: 0.5 },
    recordList: { gap: 8 },
    recordCard: {
      flexDirection: "row",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 16,
      alignItems: "center",
    },
    recordIndex: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    recordBody: { flex: 1, gap: 3 },
    recordSport: { color: colors.primary, fontSize: 7, fontWeight: "900" },
    recordDate: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    recordNote: { color: colors.muted, fontSize: 8, lineHeight: 13 },
    recordMetric: { alignItems: "flex-end", gap: 3 },
    recordMetricStrong: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    recordMetricSub: { color: colors.muted, fontSize: 7 },
    error: { color: "#C94732", fontSize: 10 },
    empty: { color: colors.muted, paddingVertical: 40, textAlign: "center", fontSize: 10 },
  });
}
