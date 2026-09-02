import {
  sportLabels,
  sportValues,
  type FeedPost,
  type PublicMemberProfile,
  type SportType,
  type WorkoutSession,
} from "@moveall/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { demoAvatarSources } from "../../src/demo-avatars";
import { TapTalkIcon } from "../../src/components/tap-icons";
import { fonts, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";
import { formatSensorMetricLine } from "../../src/workout-metrics";

type MemberTab = "records" | "posts";

export default function MemberProfilePage() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState<PublicMemberProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<MemberTab>("records");

  const loadProfile = useCallback(async () => {
    if (!session || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, status] = await Promise.all([
        api.memberProfile(session.accessToken, userId),
        api.followStatus(session.accessToken, userId),
      ]);
      setProfile(nextProfile);
      setFollowing(status.following);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  async function toggleFollow() {
    if (!session || !userId || followBusy) return;
    setFollowBusy(true);
    try {
      if (following) await api.unfollow(session.accessToken, userId);
      else await api.follow(session.accessToken, userId);
      setFollowing((current) => !current);
      setProfile((current) =>
        current
          ? {
              ...current,
              followersCount: Math.max(0, current.followersCount + (following ? -1 : 1)),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "팔로우 상태를 바꾸지 못했습니다.");
    } finally {
      setFollowBusy(false);
    }
  }

  function reportProfile() {
    if (!session || !userId || reportBusy) return;
    Alert.alert(
      "프로필 신고",
      "괴롭힘, 사칭, 개인정보 침해 등 운영팀의 확인이 필요한 계정만 신고해 주세요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "신고 접수",
          style: "destructive",
          onPress: () => {
            setReportBusy(true);
            void api
              .createReport(session.accessToken, {
                targetType: "user",
                targetId: userId,
                reason: "other",
                details: "사용자 프로필에서 접수한 신고",
              })
              .then(() => Alert.alert("신고 접수 완료", "운영팀이 내용을 확인하겠습니다."))
              .catch((caught) =>
                setError(
                  caught instanceof ApiError ? caught.message : "신고를 접수하지 못했습니다.",
                ),
              )
              .finally(() => setReportBusy(false));
          },
        },
      ],
    );
  }

  function blockProfile() {
    if (!session || !userId || blockBusy) return;
    Alert.alert(
      "이 사용자를 차단할까요?",
      "서로의 프로필·팔로우·탭톡이 제한되고 기존 팔로우 관계가 해제됩니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "차단하기",
          onPress: () => {
            setBlockBusy(true);
            void api
              .blockUser(session.accessToken, userId)
              .then(() => {
                Alert.alert("차단 완료", "이 사용자의 활동을 더 이상 표시하지 않습니다.", [
                  { text: "확인", onPress: () => router.back() },
                ]);
              })
              .catch((caught) =>
                setError(
                  caught instanceof ApiError ? caught.message : "사용자를 차단하지 못했습니다.",
                ),
              )
              .finally(() => setBlockBusy(false));
          },
        },
      ],
    );
  }

  const earnedMedals = profile?.medals.filter((medal) => medal.earned) ?? [];
  const avatarSource =
    profile?.user.avatarDataUri !== undefined
      ? { uri: profile.user.avatarDataUri }
      : userId
        ? demoAvatarSources[userId]
        : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>← BACK</Text>
          </Pressable>
          <Text style={styles.brand}>GROOV</Text>
          <View style={styles.topSpacer} />
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>프로필을 불러오는 중</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void loadProfile()}>
              <Text style={styles.retry}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {profile ? (
          <>
            <View style={styles.identityRow}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarText}>{profile.user.displayName.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.identityCopy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{profile.user.displayName}</Text>
                  {profile.isPrivate ? <Lock color={colors.muted} size={13} /> : null}
                </View>
                <Text style={styles.handle}>GROOV MEMBER · 공개한 활동만 표시</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                disabled={followBusy}
                onPress={() => void toggleFollow()}
                style={[styles.followButton, following && styles.followButtonActive]}
              >
                <Text style={[styles.followText, following && styles.followTextActive]}>
                  {followBusy
                    ? "…"
                    : following
                      ? "팔로잉"
                      : profile.isPrivate
                        ? "팔로우 요청"
                        : "+ 팔로우"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/profile/message", params: { userId: profile.user.id } })
                }
                style={styles.messageButton}
              >
                <TapTalkIcon color={colors.ink} size={15} strokeWidth={1.8} />
                <Text style={styles.messageText}>탭톡</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={reportBusy}
                onPress={reportProfile}
                style={styles.reportButton}
              >
                <Text style={styles.reportText}>{reportBusy ? "…" : "신고"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={blockBusy}
                onPress={blockProfile}
                style={styles.reportButton}
              >
                <Text style={styles.reportText}>{blockBusy ? "…" : "차단"}</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <Stat
                label="기록"
                value={profile.isPrivate ? "—" : profile.workouts.length}
                styles={styles}
              />
              <Stat label="팔로워" value={profile.followersCount} styles={styles} />
              <Stat label="팔로잉" value={profile.followingCount} styles={styles} />
              <Stat
                label="게시물"
                value={profile.isPrivate ? "—" : profile.posts.length}
                styles={styles}
              />
            </View>

            {profile.isPrivate ? (
              <View style={styles.privateCard}>
                <View style={styles.privateLock}>
                  <Lock color="#FFFFFF" size={24} />
                </View>
                <Text style={styles.privateTitle}>비공개 계정입니다</Text>
                <Text style={styles.privateCopy}>
                  이 사용자가 팔로우 요청을 승인하면 공개한 운동 기록, 메달과 피드를 볼 수 있습니다.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.eyebrow}>PUBLIC RECORDS</Text>
                    <Text style={styles.sectionTitle}>운동별 기록</Text>
                  </View>
                  <Text style={styles.sectionCount}>{profile.workouts.length} TOTAL</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sportRow}
                >
                  <SportOrb count={profile.workouts.length} label="전체" selected styles={styles} />
                  {sportValues.map((sport) => (
                    <SportOrb
                      key={sport}
                      count={profile.workouts.filter((workout) => workout.sport === sport).length}
                      label={shortSportLabel(sport)}
                      selected={false}
                      styles={styles}
                    />
                  ))}
                </ScrollView>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.eyebrow}>MEDAL CABINET</Text>
                    <Text style={styles.sectionTitle}>공개 메달</Text>
                  </View>
                  <Text style={styles.sectionCount}>{earnedMedals.length} EARNED</Text>
                </View>

                {earnedMedals.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.medalRow}
                  >
                    {earnedMedals.map((medal) => (
                      <View key={medal.id} style={styles.medalItem}>
                        <View style={styles.medalSphere}>
                          <Text style={styles.medalGlyph}>{sportGlyph(medal.sport)}</Text>
                        </View>
                        <Text numberOfLines={1} style={styles.medalName}>
                          {medal.title}
                        </Text>
                        <Text style={styles.medalTier}>{medal.tier.toUpperCase()}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.inlineEmpty}>아직 공개한 메달이 없습니다.</Text>
                )}

                <View style={styles.tabBar}>
                  {(
                    [
                      ["records", `기록 ${profile.workouts.length}`],
                      ["posts", `피드 ${profile.posts.length}`],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable key={value} onPress={() => setTab(value)} style={styles.tabButton}>
                      <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
                        {label}
                      </Text>
                      {tab === value ? <View style={styles.tabLine} /> : null}
                    </Pressable>
                  ))}
                </View>

                {tab === "records" ? (
                  <RecordList styles={styles} workouts={profile.workouts} />
                ) : (
                  <PostGrid posts={profile.posts} styles={styles} />
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: number | string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SportOrb({
  count,
  label,
  selected,
  styles,
}: {
  count: number;
  label: string;
  selected: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sportItem}>
      <View style={[styles.sportOrb, selected && styles.sportOrbSelected]}>
        <Text style={[styles.sportCount, selected && styles.sportCountSelected]}>{count}</Text>
      </View>
      <Text style={[styles.sportLabel, selected && styles.sportLabelSelected]}>{label}</Text>
    </View>
  );
}

function RecordList({
  workouts,
  styles,
}: {
  workouts: WorkoutSession[];
  styles: ReturnType<typeof createStyles>;
}) {
  if (!workouts.length) return <Text style={styles.inlineEmpty}>공개한 운동 기록이 없습니다.</Text>;
  return (
    <View style={styles.recordList}>
      {workouts.map((workout) => (
        <View key={workout.id} style={styles.recordCard}>
          <View style={styles.recordTop}>
            <Text style={styles.recordSport}>{sportLabels[workout.sport]}</Text>
            <Text style={styles.recordDate}>{formatDate(workout.endedAt)}</Text>
          </View>
          <Text style={styles.recordMetric}>{primaryMetric(workout)}</Text>
          <Text numberOfLines={1} style={styles.recordNote}>
            {workout.notes ?? "운동 기록"}
          </Text>
          <Text style={styles.recordMeta}>
            {durationLabel(workout)} · {calorieLabel(workout)}
          </Text>
          <Text style={styles.recordSensorMetric}>{formatSensorMetricLine(workout)}</Text>
        </View>
      ))}
    </View>
  );
}

function PostGrid({
  posts,
  styles,
}: {
  posts: FeedPost[];
  styles: ReturnType<typeof createStyles>;
}) {
  if (!posts.length) return <Text style={styles.inlineEmpty}>공개한 피드가 없습니다.</Text>;
  return (
    <View style={styles.postGrid}>
      {posts.map((post) => (
        <View key={post.id} style={styles.postCard}>
          <View style={styles.postTop}>
            <Text style={styles.postType}>{post.contentType.toUpperCase()}</Text>
            <Text style={styles.postSport}>{sportLabels[post.sport]}</Text>
          </View>
          <Text numberOfLines={5} style={styles.postContent}>
            {post.content}
          </Text>
          <Text style={styles.postReaction}>
            ♥ {post.likeCount} · 댓글 {post.comments.length}
          </Text>
        </View>
      ))}
    </View>
  );
}

function shortSportLabel(sport: SportType) {
  return sport === "strength" ? "근력" : sportLabels[sport];
}

function sportGlyph(sport: SportType) {
  return (
    { running: "R", hiking: "H", cycling: "C", strength: "S", swimming: "W", diving: "D" } as const
  )[sport];
}

function primaryMetric(workout: WorkoutSession) {
  const metrics = workout.metrics;
  if (workout.sport === "strength") return `${metrics.exerciseCount ?? 0} MOVES`;
  if (workout.sport === "diving") return `${metrics.maxDepthM ?? 0}M DEPTH`;
  if (workout.sport === "swimming") return `${metrics.distanceM ?? 0}M`;
  return `${Number(metrics.distanceKm ?? 0).toFixed(2)}KM`;
}

function durationLabel(workout: WorkoutSession) {
  const minutes = Number(workout.metrics.durationMinutes ?? 0);
  return `${Math.floor(minutes / 60)}H ${Math.round(minutes % 60)}M`;
}

function calorieLabel(workout: WorkoutSession) {
  return `${Math.round(Number(workout.metrics.calories ?? 0))} KCAL`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(
    new Date(value),
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: 448,
      alignSelf: "center",
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 110,
      gap: space[5],
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    topSpacer: { width: 40 },
    back: { color: colors.muted, fontSize: 9, fontFamily: fonts.bold },
    brand: { color: colors.primary, fontSize: 16, fontFamily: fonts.displayItalic },
    centerState: { paddingVertical: 80, alignItems: "center", gap: 12 },
    stateText: { color: colors.muted, fontSize: 10, fontFamily: fonts.medium },
    errorCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: 14,
      gap: 8,
    },
    error: { color: colors.primary, fontSize: 10, fontFamily: fonts.medium },
    retry: { color: colors.primary, fontSize: 9, fontFamily: fonts.bold },
    identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 72, height: 72, borderRadius: 36 },
    avatarFallback: {
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontSize: 24, fontFamily: fonts.bold },
    identityCopy: { flex: 1, gap: 5 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    name: { color: colors.ink, fontSize: 23, fontFamily: fonts.displayExtra, flexShrink: 1 },
    handle: { color: colors.muted, fontSize: 7, fontFamily: fonts.bold, letterSpacing: 0.7 },
    actions: { flexDirection: "row", gap: 8 },
    followButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    followButtonActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    followText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bold },
    followTextActive: { color: colors.ink },
    messageButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    messageText: { color: colors.ink, fontSize: 10, fontFamily: fonts.bold },
    reportButton: {
      minWidth: 58,
      minHeight: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    reportText: { color: colors.primary, fontSize: 9, fontFamily: fonts.bold },
    statsRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 15,
    },
    stat: { flex: 1, alignItems: "center", gap: 4 },
    statValue: { color: colors.ink, fontSize: 16, fontFamily: fonts.displayExtra },
    statLabel: { color: colors.muted, fontSize: 8, fontFamily: fonts.medium },
    privateCard: {
      minHeight: 310,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      padding: 36,
      gap: 13,
      backgroundColor: colors.surface,
    },
    privateLock: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 3,
    },
    privateTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.displayExtra },
    privateCopy: {
      maxWidth: 286,
      color: colors.muted,
      fontSize: 10,
      lineHeight: 17,
      fontFamily: fonts.medium,
      textAlign: "center",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    eyebrow: { color: colors.primary, fontSize: 7, fontFamily: fonts.bold, letterSpacing: 1.1 },
    sectionTitle: { color: colors.ink, fontSize: 20, fontFamily: fonts.displayExtra, marginTop: 3 },
    sectionCount: { color: colors.muted, fontSize: 7, fontFamily: fonts.bold },
    sportRow: { gap: 13, paddingRight: 22 },
    sportItem: { width: 52, alignItems: "center", gap: 7 },
    sportOrb: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    sportOrbSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    sportCount: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
    sportCountSelected: { color: "#FFFFFF" },
    sportLabel: { color: colors.muted, fontSize: 7, fontFamily: fonts.medium },
    sportLabelSelected: { color: colors.primary, fontFamily: fonts.bold },
    medalRow: { gap: 14, paddingRight: 22 },
    medalItem: { width: 68, alignItems: "center", gap: 5 },
    medalSphere: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    medalGlyph: { color: "#FFFFFF", fontSize: 18, fontFamily: fonts.displayItalic },
    medalName: { color: colors.ink, fontSize: 7, fontFamily: fonts.bold, maxWidth: 68 },
    medalTier: { color: colors.muted, fontSize: 6, fontFamily: fonts.medium },
    inlineEmpty: { color: colors.muted, fontSize: 10, paddingVertical: 28, textAlign: "center" },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    tabButton: { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" },
    tabText: { color: colors.muted, fontSize: 10, fontFamily: fonts.bold },
    tabTextActive: { color: colors.ink },
    tabLine: {
      position: "absolute",
      bottom: -1,
      width: "100%",
      height: 2,
      backgroundColor: colors.primary,
    },
    recordList: { gap: 9 },
    recordCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 15,
      gap: 7,
    },
    recordTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    recordSport: { color: colors.primary, fontSize: 8, fontFamily: fonts.bold },
    recordDate: { color: colors.muted, fontSize: 7, fontFamily: fonts.medium },
    recordMetric: { color: colors.ink, fontSize: 25, fontFamily: fonts.displayExtra },
    recordNote: { color: colors.ink, fontSize: 10, fontFamily: fonts.semibold },
    recordMeta: { color: colors.muted, fontSize: 8, fontFamily: fonts.medium },
    recordSensorMetric: {
      color: colors.primary,
      fontSize: 8,
      lineHeight: 13,
      fontFamily: fonts.semibold,
    },
    postGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    postCard: {
      width: "48.8%",
      minHeight: 190,
      borderRadius: radius.md,
      backgroundColor: colors.ink,
      padding: 14,
      justifyContent: "space-between",
      gap: 14,
    },
    postTop: { gap: 3 },
    postType: { color: colors.primary, fontSize: 7, fontFamily: fonts.bold },
    postSport: { color: "rgba(255,255,255,0.55)", fontSize: 7, fontFamily: fonts.medium },
    postContent: { color: "#FFFFFF", fontSize: 11, lineHeight: 18, fontFamily: fonts.semibold },
    postReaction: { color: "rgba(255,255,255,0.52)", fontSize: 7, fontFamily: fonts.medium },
  });
}
