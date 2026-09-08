import {
  sportLabels,
  sportValues,
  type Medal,
  type MedalTier,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Check,
  SlidersHorizontal,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SportLogo } from "../components/sport-logo";
import { CenterDialog } from "../components/ui";
import { fonts, typography, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";
import { sortWorkoutsForDisplay } from "../workout-display";
import { workoutDurationMilliseconds } from "../workout-duration";
import { formatSensorMetricLine } from "../workout-metrics";
import {
  availableRecordMetrics,
  defaultRecordMetrics,
  moveRecordMetric,
  normalizeRecordMetrics,
  recordMetricStorageKey,
  summarizeRecords,
  type RecordFilter,
  type RecordMetricId,
} from "./record-summary";

export function RecordsScreen(props: { sport?: SportType }) {
  const { session, loginLifetime } = useAuth();
  // A token refresh keeps the editor mounted; a different login clears the old account's data.
  return (
    <RecordsContent
      key={`${session?.user.id ?? "guest"}:${loginLifetime}:${props.sport ?? "all"}`}
      {...props}
    />
  );
}

function RecordsContent({ sport }: { sport?: SportType }) {
  const router = useRouter();
  const pageScroll = useRef<ScrollView>(null);
  const sportScroll = useRef<ScrollView>(null);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<RecordFilter>(sport ?? "all");
  const [medalsExpanded, setMedalsExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFilter(sport ?? "all");
      pageScroll.current?.scrollTo({ y: 0, animated: false });
      sportScroll.current?.scrollTo({ x: 0, animated: false });
    }, [sport]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      if (!session) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void Promise.all([api.workouts(session.accessToken), api.medals(session.accessToken)])
        .then(([nextWorkouts, nextMedals]) => {
          if (!active) return;
          setWorkouts(sortWorkoutsForDisplay(nextWorkouts));
          setMedals(nextMedals);
          setLoaded(true);
        })
        .catch((caught) => {
          if (active)
            setError(caught instanceof ApiError ? caught.message : "기록을 불러오지 못했습니다.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [session]),
  );

  const visibleWorkouts =
    filter === "all" ? workouts : workouts.filter((item) => item.sport === filter);
  const visibleMedals = filter === "all" ? medals : medals.filter((item) => item.sport === filter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView ref={pageScroll} contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Text style={styles.brand}>GROOV</Text>
        </View>
        <View style={styles.sportRecordsSection}>
          <View>
            <Text style={styles.eyebrow}>MY RECORDS</Text>
            <Text style={styles.title}>운동별 기록</Text>
          </View>
          <ScrollView
            ref={sportScroll}
            horizontal
            accessibilityLabel="운동별 기록 종목 선택"
            showsHorizontalScrollIndicator={false}
            style={styles.sportRecordsStrip}
            contentContainerStyle={styles.orbs}
          >
            {(["all", ...sportValues] as const).map((itemSport) => {
              const selected = filter === itemSport;
              const count =
                itemSport === "all"
                  ? workouts.length
                  : workouts.filter((item) => item.sport === itemSport).length;
              const label =
                itemSport === "all"
                  ? "전체"
                  : itemSport === "strength"
                    ? "근력"
                    : sportLabels[itemSport];
              return (
                <Pressable
                  key={itemSport}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label} 기록 ${count}개`}
                  onPress={() => setFilter(itemSport)}
                  style={styles.orbItem}
                >
                  <View style={[styles.recordOrb, selected && styles.recordOrbActive]}>
                    {itemSport !== "all" ? (
                      <View
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={styles.orbLogo}
                      >
                        <SportLogo
                          sport={itemSport}
                          selected={false}
                          size={44}
                          color={selected ? "#FFFFFF" : colors.ink}
                        />
                      </View>
                    ) : null}
                    <Text style={[styles.orbCount, selected && styles.orbCountActive]}>
                      {count}
                    </Text>
                  </View>
                  <Text style={[styles.orbLabel, selected && styles.orbLabelActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {session && loaded ? (
          <RecordTotals
            key={`${session.user.id}:${filter}`}
            userId={session.user.id}
            filter={filter}
            workouts={workouts}
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`단계별 메달 ${medalsExpanded ? "접기" : "펼치기"}`}
          accessibilityState={{ expanded: medalsExpanded }}
          onPress={() => setMedalsExpanded((value) => !value)}
          style={styles.medalToggle}
        >
          <View>
            <Text style={styles.eyebrow}>MEDAL CABINET</Text>
            <Text style={styles.sectionTitle}>단계별 메달</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.sectionCount}>
              {visibleMedals.filter((item) => item.earned).length}/{visibleMedals.length}
            </Text>
            {medalsExpanded ? (
              <ChevronUp size={20} color={colors.muted} />
            ) : (
              <ChevronDown size={20} color={colors.muted} />
            )}
          </View>
        </Pressable>
        {medalsExpanded ? (
          <View style={styles.medalGrid}>
            {visibleMedals.map((medal) => (
              <MedalCard key={medal.id} medal={medal} styles={styles} />
            ))}
            {!loading && !visibleMedals.length ? (
              <Text style={styles.empty}>표시할 메달이 없습니다.</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.eyebrow}>ACTIVITY LOG</Text>
            <Text style={styles.sectionTitle}>상세 기록</Text>
          </View>
          <Text style={styles.sectionCount}>{visibleWorkouts.length}</Text>
        </View>
        {!loading && !error && visibleWorkouts.length === 0 ? (
          <Text style={styles.empty}>아직 기록이 없습니다.</Text>
        ) : null}
        <View style={styles.recordList}>
          {visibleWorkouts.map((workout, index) => (
            <View key={workout.id} style={styles.recordCard}>
              <Text style={styles.recordIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.recordBody}>
                <Text style={styles.recordSport}>{sportLabels[workout.sport]}</Text>
                <Text style={styles.recordDate}>
                  {new Date(workout.startedAt).toLocaleDateString("ko-KR")}
                </Text>
                <Text style={styles.recordNote}>{workout.notes ?? "기록된 메모가 없습니다."}</Text>
                <Text style={styles.recordSensorMetric}>{formatSensorMetricLine(workout)}</Text>
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

function RecordTotals({
  workouts,
  filter,
  userId,
}: {
  workouts: WorkoutSession[];
  filter: RecordFilter;
  userId: string;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const metrics = useMemo(() => summarizeRecords(workouts, filter), [workouts, filter]);
  const [ids, setIds] = useState<RecordMetricId[]>(() => defaultRecordMetrics(filter));
  const [savedIds, setSavedIds] = useState(ids);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const key = `${recordMetricStorageKey(userId)}:${filter}`;
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (!active) return;
        const next = normalizeRecordMetrics(raw ? JSON.parse(raw) : null, filter);
        setIds(next);
        setSavedIds(next);
      })
      .catch(() => {
        if (active) setNotice("저장한 배치를 불러오지 못해 기본 배치로 표시했어요.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [key, filter]);
  const save = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(ids));
      setSavedIds(ids);
      setEditing(false);
    } catch {
      setNotice("배치를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.totals}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.eyebrow}>LIFETIME TOTALS</Text>
          <Text style={styles.sectionTitle}>누적 기록</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!ready || saving}
          onPress={() => (editing ? void save() : setEditing(true))}
          style={styles.editButton}
        >
          {editing ? (
            <Check size={16} color={colors.primary} />
          ) : (
            <SlidersHorizontal size={16} color={colors.primary} />
          )}
          <Text style={styles.actionText}>
            {saving ? "저장 중" : editing ? "완료" : "배치 편집"}
          </Text>
        </Pressable>
      </View>
      {editing ? (
        <View style={styles.metricEditor}>
          <Text style={styles.editorCopy}>
            보고 싶은 수치를 고르고, 화살표로 순서를 바꾸세요. 배치는 이 기기에 종목별로 저장돼요.
          </Text>
          <View style={styles.metricOptions}>
            {availableRecordMetrics(filter).map((id) => {
              const checked = ids.includes(id);
              const disabled = saving || (checked && ids.length === 1);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled }}
                  disabled={disabled}
                  onPress={() =>
                    setIds((current) =>
                      checked ? current.filter((item) => item !== id) : [...current, id],
                    )
                  }
                  style={[styles.metricOption, checked && styles.metricOptionSelected]}
                >
                  {checked ? <Check size={13} color={colors.primary} /> : null}
                  <Text style={[styles.optionText, checked && styles.optionTextSelected]}>
                    {metrics[id].label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.editorActions}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => setIds(defaultRecordMetrics(filter))}
              style={styles.editButton}
            >
              <Text style={styles.actionText}>기본 배치</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => {
                setIds(savedIds);
                setEditing(false);
              }}
              style={styles.editButton}
            >
              <Text style={styles.editorCopy}>취소</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.summaryGrid}>
        {ids.map((id, index) => {
          const metric = metrics[id];
          return (
            <View key={id} style={styles.summary}>
              <Text style={styles.summaryLabel}>{metric.label}</Text>
              <View style={styles.metricValueRow}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>
                  {metric.value.toLocaleString("ko-KR", { maximumFractionDigits: metric.digits })}
                </Text>
                <Text style={styles.metricUnit}>{metric.unit}</Text>
              </View>
              {editing ? (
                <View style={styles.reorderControls}>
                  <Text style={styles.metricOrder}>{index + 1}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${metric.label} 앞으로 이동`}
                    disabled={saving || index === 0}
                    onPress={() => setIds((current) => moveRecordMetric(current, id, -1))}
                    style={[styles.reorderButton, index === 0 && styles.disabled]}
                  >
                    <ArrowUp size={18} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${metric.label} 뒤로 이동`}
                    disabled={saving || index === ids.length - 1}
                    onPress={() => setIds((current) => moveRecordMetric(current, id, 1))}
                    style={[styles.reorderButton, index === ids.length - 1 && styles.disabled]}
                  >
                    <ArrowDown size={18} color={colors.primary} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
      {ids.includes("depth") ? <Text style={styles.metricNote}>{metrics.depth.note}</Text> : null}
      {ids.includes("volume") ? (
        <Text style={styles.metricNote}>누적 무게는 저장한 총 볼륨의 합계예요.</Text>
      ) : null}
      <CenterDialog
        visible={notice !== null}
        title="누적 기록"
        message={notice ?? ""}
        onClose={() => setNotice(null)}
      />
    </View>
  );
}

function MedalCard({ medal, styles }: { medal: Medal; styles: ReturnType<typeof createStyles> }) {
  const special = medal.physicalRewardEligible;
  return (
    <View style={[styles.medalCard, special && styles.medalCardSpecial]}>
      <View
        style={[
          styles.medalMark,
          special && styles.medalMarkSpecial,
          !medal.earned && styles.medalMarkLocked,
        ]}
      >
        <Text style={[styles.medalGlyph, !medal.earned && styles.medalGlyphLocked]}>
          {medal.earned ? tierGlyph(medal.tier) : "·"}
        </Text>
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
  return `${Math.round(workoutDurationMilliseconds(workout) / 60_000)} MIN`;
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
    back: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      paddingVertical: 12,
    },
    brand: { ...typography.wordmark(18), color: colors.primary },
    eyebrow: { color: colors.primary, fontSize: 12, fontFamily: fonts.bold, letterSpacing: 1.2 },
    title: { ...typography.title(24), color: colors.ink, marginTop: 5 },
    // Nested ScrollViews default to flexShrink: 1 on web. Reserve the sport row
    // independently so a long activity list cannot squeeze it out of view.
    sportRecordsSection: { flexShrink: 0, gap: 14 },
    sportRecordsStrip: { flexGrow: 0, flexShrink: 0, minHeight: 90 },
    orbs: { gap: 14, paddingVertical: 5, paddingRight: 4, alignItems: "flex-start" },
    orbItem: { width: 54, flexShrink: 0, alignItems: "center", gap: 7 },
    recordOrb: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    recordOrbActive: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    orbLogo: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.2,
    },
    orbCount: { ...typography.numeric(17), color: colors.ink, zIndex: 1 },
    orbCountActive: { color: "#FFFFFF" },
    orbLabel: { color: colors.muted, fontSize: 12, fontFamily: fonts.semibold },
    orbLabelActive: { color: colors.primary },
    totals: { gap: 12 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    editButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 4,
    },
    actionText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
    metricEditor: {
      padding: 14,
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
    },
    editorCopy: { color: colors.muted, fontSize: 13, lineHeight: 21 },
    metricOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    metricOption: {
      minHeight: 40,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metricOptionSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    optionText: { color: colors.muted, fontSize: 12, fontFamily: fonts.medium },
    optionTextSelected: { color: colors.primary },
    editorActions: { flexDirection: "row", justifyContent: "space-between" },
    summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    summary: {
      width: "48%",
      flexGrow: 1,
      minWidth: 125,
      padding: 15,
      minHeight: 100,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 10,
    },
    metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 5, minWidth: 0 },
    summaryValue: { ...typography.numeric(27), color: colors.ink, flexShrink: 1 },
    metricUnit: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
    summaryLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
    metricNote: { color: colors.muted, fontSize: 12, lineHeight: 19 },
    reorderControls: { flexDirection: "row", alignItems: "center", gap: 4 },
    reorderButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
    },
    metricOrder: { color: colors.muted, fontSize: 12, flex: 1 },
    disabled: { opacity: 0.25 },
    sectionHead: {
      marginTop: 16,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    sectionTitle: { color: colors.ink, fontSize: 18, fontFamily: fonts.bold, marginTop: 3 },
    sectionCount: { color: colors.muted, fontSize: 12, fontWeight: "900" },
    medalToggle: {
      minHeight: 74,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      marginTop: 12,
    },
    medalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    medalCard: {
      width: "31%",
      flexGrow: 1,
      minHeight: 154,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      alignItems: "center",
      gap: 5,
      justifyContent: "center",
    },
    medalCardSpecial: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    medalMark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    medalMarkSpecial: { width: 58, borderRadius: 8 },
    medalMarkLocked: { backgroundColor: colors.primarySoft },
    medalGlyphLocked: { color: colors.primary },
    medalGlyph: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
    medalTier: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    medalTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", maxWidth: "100%" },
    medalProgress: { color: colors.muted, fontSize: 12 },
    realEdition: { color: colors.primary, fontSize: 12, fontWeight: "900", textAlign: "center" },
    recordList: { gap: 8 },
    recordCard: {
      flexDirection: "row",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 16,
      alignItems: "center",
    },
    recordIndex: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    recordBody: { flex: 1, gap: 3 },
    recordSport: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    recordDate: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    recordNote: { color: colors.muted, fontSize: 12, lineHeight: 19 },
    recordSensorMetric: { color: colors.primary, fontSize: 12, lineHeight: 19, fontWeight: "800" },
    recordMetric: { alignItems: "flex-end", gap: 3 },
    recordMetricStrong: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    recordMetricSub: { color: colors.muted, fontSize: 12 },
    error: { color: colors.primary, fontSize: 13 },
    empty: { color: colors.muted, paddingVertical: 40, textAlign: "center", fontSize: 14 },
  });
}
