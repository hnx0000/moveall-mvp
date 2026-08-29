import {
  NicknameSchema,
  sportLabels,
  sportValues,
  type FeedPost,
  type Medal,
  type Routine,
  type SocialSummary,
  type SportType,
  type UserProfile,
  type WorkoutSession,
} from "@moveall/contracts";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import {
  fonts,
  maxContentWidth,
  radius,
  shadows,
  typography,
  type ThemeColors,
} from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type ProfileTab = "records" | "posts" | "routines";
type RecordFilter = "all" | SportType;

const emptySocial: SocialSummary = {
  followersCount: 0,
  followingCount: 0,
  followers: [],
  following: [],
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, logout, updateUser } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("records");
  const [recordFilter] = useState<RecordFilter>("all");
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [social, setSocial] = useState<SocialSummary>(emptySocial);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [nextWorkouts, nextPosts, nextMedals, nextSocial, nextRoutines, nextProfile] =
        await Promise.all([
          api.workouts(session.accessToken),
          api.myPosts(session.accessToken),
          api.medals(session.accessToken),
          api.socialSummary(session.accessToken),
          api.routines(session.accessToken),
          api.profile(session.accessToken),
        ]);
      setWorkouts(nextWorkouts);
      setPosts(nextPosts);
      setMedals(nextMedals);
      setSocial(nextSocial);
      setRoutines(nextRoutines);
      setProfile(nextProfile);
      setNicknameDraft(nextProfile.displayName);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const visibleWorkouts = useMemo(
    () =>
      recordFilter === "all"
        ? workouts
        : workouts.filter((workout) => workout.sport === recordFilter),
    [recordFilter, workouts],
  );
  const earnedMedals = medals.filter((medal) => medal.earned);

  const saveNickname = async () => {
    if (!session) return;
    const parsed = NicknameSchema.safeParse(nicknameDraft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "닉네임을 확인해 주세요.");
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      const nextProfile = await api.updateProfile(session.accessToken, {
        displayName: parsed.data,
      });
      setProfile(nextProfile);
      setEditingNickname(false);
      await updateUser({
        id: nextProfile.id,
        email: nextProfile.email,
        displayName: nextProfile.displayName,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "닉네임을 변경하지 못했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  const changeAvatar = async (source: "camera" | "library") => {
    if (!session) return;
    setError(null);
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(source === "camera" ? "카메라 권한이 필요합니다." : "사진 접근 권한이 필요합니다.");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            base64: true,
            quality: 0.35,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            base64: true,
            quality: 0.35,
          });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.");
      return;
    }
    const mimeType = asset.mimeType === "image/png" ? "image/png" : "image/jpeg";
    const avatarDataUri = `data:${mimeType};base64,${asset.base64}`;
    setSavingProfile(true);
    try {
      const nextProfile = await api.updateProfile(session.accessToken, { avatarDataUri });
      setProfile(nextProfile);
      setAvatarMenuOpen(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "프로필 사진을 변경하지 못했습니다.");
    } finally {
      setSavingProfile(false);
    }
  };

  const createRoutine = async () => {
    if (!session || routineTitle.trim().length < 2) return;
    setSavingRoutine(true);
    setError(null);
    try {
      const routine = await api.createRoutine(session.accessToken, {
        title: routineTitle.trim(),
        sport: recordFilter === "all" ? "strength" : recordFilter,
        daysOfWeek: [1, 3, 5],
        items: [{ name: "운동 시작", target: "내 페이스로 30분", order: 0 }],
      });
      setRoutines((current) => [routine, ...current]);
      setRoutineTitle("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "루틴을 저장하지 못했습니다.");
    } finally {
      setSavingRoutine(false);
    }
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>MOVEALL</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/admin")}>
            <Text style={styles.adminLink}>ADMIN ↗</Text>
          </Pressable>
        </View>

        <View style={styles.identityRow}>
          <Pressable
            accessibilityLabel="프로필 사진 변경"
            onPress={() => setAvatarMenuOpen((current) => !current)}
            style={styles.avatar}
          >
            {profile?.avatarDataUri ? (
              <Image source={{ uri: profile.avatarDataUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {session.user.displayName.slice(0, 1).toUpperCase()}
              </Text>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditGlyph}>+</Text>
            </View>
          </Pressable>
          <View style={styles.identityCopy}>
            {editingNickname ? (
              <View style={styles.nicknameEditor}>
                <TextInput
                  autoCapitalize="none"
                  autoFocus
                  maxLength={20}
                  onChangeText={setNicknameDraft}
                  onSubmitEditing={() => void saveNickname()}
                  returnKeyType="done"
                  style={styles.nicknameInput}
                  value={nicknameDraft}
                />
                <Pressable disabled={savingProfile} onPress={() => void saveNickname()}>
                  <Text style={styles.nicknameSave}>{savingProfile ? "…" : "저장"}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityLabel="닉네임 변경"
                onPress={() => {
                  setNicknameDraft(profile?.displayName ?? session.user.displayName);
                  setEditingNickname(true);
                }}
              >
                <Text style={styles.displayName}>
                  {profile?.displayName ?? session.user.displayName}
                </Text>
                <Text style={styles.editHint}>탭해서 닉네임 수정</Text>
              </Pressable>
            )}
            <Text style={styles.email}>{session.user.email}</Text>
          </View>
        </View>

        {avatarMenuOpen ? (
          <View style={styles.avatarMenu}>
            <Text style={styles.avatarMenuTitle}>PROFILE PHOTO</Text>
            <View style={styles.avatarMenuActions}>
              <Pressable
                onPress={() => void changeAvatar("camera")}
                style={styles.avatarMenuButton}
              >
                <Text style={styles.avatarMenuButtonText}>카메라</Text>
              </Pressable>
              <Pressable
                onPress={() => void changeAvatar("library")}
                style={styles.avatarMenuButton}
              >
                <Text style={styles.avatarMenuButtonText}>사진첩</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Stat
            value={workouts.length}
            label="기록"
            styles={styles}
            onPress={() => router.push("/profile/records")}
          />
          <Stat
            value={social.followersCount}
            label="팔로워"
            styles={styles}
            onPress={() => router.push("/profile/followers")}
          />
          <Stat
            value={social.followingCount}
            label="팔로잉"
            styles={styles}
            onPress={() => router.push("/profile/following")}
          />
          <Stat
            value={posts.length}
            label="게시물"
            styles={styles}
            onPress={() => router.push("/profile/content")}
          />
        </View>

        <SectionHeader eyebrow="MY RECORDS" title="운동별 기록" styles={styles} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.orbs}
        >
          <RecordOrb
            active
            count={workouts.length}
            label="전체"
            onPress={() => {
              router.push("/profile/records");
            }}
            styles={styles}
          />
          {sportValues.map((sport) => (
            <RecordOrb
              key={sport}
              active={false}
              count={workouts.filter((workout) => workout.sport === sport).length}
              label={shortSportLabel(sport)}
              onPress={() => {
                router.push({ pathname: "/profile/sport", params: { sport } });
              }}
              styles={styles}
            />
          ))}
        </ScrollView>

        <View style={styles.medalHeader}>
          <SectionHeader eyebrow="MEDAL CABINET" title="달성 메달" styles={styles} />
          <Text style={styles.medalCount}>
            {earnedMedals.length} / {medals.length}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.medalRow}
        >
          {medals.slice(0, 12).map((medal) => (
            <View key={medal.id} style={styles.medalItem}>
              <View
                style={[
                  styles.medalSphere,
                  medal.earned ? styles.medalEarned : styles.medalLocked,
                  medal.physicalRewardEligible && styles.medalSpecial,
                ]}
              >
                <Text style={[styles.medalGlyph, !medal.earned && styles.medalGlyphLocked]}>
                  {medal.earned ? sportGlyph(medal.sport) : "·"}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.medalName}>
                {medal.title}
              </Text>
              <Text style={styles.medalProgress}>
                {medal.progress}/{medal.target}
              </Text>
              {medal.physicalRewardEligible ? (
                <Text style={styles.physicalTag}>REAL EDITION</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <View style={styles.tabBar}>
          {(
            [
              ["records", "기록"],
              ["posts", "게시물"],
              ["routines", "루틴"],
            ] as const
          ).map(([value, label]) => (
            <Pressable key={value} onPress={() => setTab(value)} style={styles.tabButton}>
              <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
              {tab === value ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && tab === "records" ? (
          <RecordList workouts={visibleWorkouts.slice(0, 3)} styles={styles} />
        ) : null}
        {!loading && tab === "posts" ? (
          <PostList
            onOpen={() => router.push("/profile/content")}
            posts={posts.slice(0, 3)}
            styles={styles}
          />
        ) : null}
        {!loading && tab === "routines" ? (
          <View style={styles.contentSection}>
            <View style={styles.routineComposer}>
              <Text style={styles.cardEyebrow}>NEW ROUTINE</Text>
              <TextInput
                value={routineTitle}
                onChangeText={setRoutineTitle}
                placeholder="예: 월수금 러닝 베이스"
                placeholderTextColor={colors.muted}
                style={styles.routineInput}
              />
              <Pressable
                disabled={savingRoutine || routineTitle.trim().length < 2}
                onPress={() => void createRoutine()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  {savingRoutine ? "저장 중" : "+ 새 루틴 저장"}
                </Text>
              </Pressable>
            </View>
            {routines.slice(0, 3).map((routine) => (
              <View key={routine.id} style={styles.routineCard}>
                <View>
                  <Text style={styles.cardEyebrow}>{sportLabels[routine.sport]}</Text>
                  <Text style={styles.cardTitle}>{routine.title}</Text>
                </View>
                <Text style={styles.routineMeta}>
                  주 {routine.daysOfWeek.length}회 · {routine.items.length} 단계
                </Text>
              </View>
            ))}
            {routines.length === 0 ? (
              <Empty copy="저장한 루틴이 없습니다." styles={styles} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.settings}>
          <View>
            <Text style={styles.settingsTitle}>다크 모드</Text>
            <Text style={styles.settingsCopy}>앱 전체 화면 모드</Text>
          </View>
          <Switch
            value={mode === "dark"}
            onValueChange={(enabled) => setMode(enabled ? "dark" : "light")}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <Pressable onPress={() => void logout()} style={styles.logoutButton}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  eyebrow,
  title,
  styles,
}: {
  eyebrow: string;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Stat({
  value,
  label,
  styles,
  onPress,
}: {
  value: number;
  label: string;
  styles: ReturnType<typeof createStyles>;
  onPress(): void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function RecordOrb({
  active,
  count,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  count: number;
  label: string;
  onPress(): void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.orbItem}>
      <View style={[styles.recordOrb, active && styles.recordOrbActive]}>
        <Text style={[styles.orbCount, active && styles.orbCountActive]}>{count}</Text>
      </View>
      <Text style={[styles.orbLabel, active && styles.orbLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function RecordList({
  workouts,
  styles,
}: {
  workouts: WorkoutSession[];
  styles: ReturnType<typeof createStyles>;
}) {
  if (workouts.length === 0)
    return (
      <Empty
        copy="아직 이 운동 기록이 없습니다. 기록 탭에서 첫 운동을 남겨보세요."
        styles={styles}
      />
    );
  return (
    <View style={styles.contentSection}>
      {workouts.map((workout) => (
        <View key={workout.id} style={styles.recordCard}>
          <View>
            <Text style={styles.cardEyebrow}>{sportLabels[workout.sport]}</Text>
            <Text style={styles.cardTitle}>
              {new Date(workout.startedAt).toLocaleDateString("ko-KR")}
            </Text>
          </View>
          <View style={styles.recordMetrics}>
            <Text style={styles.metricStrong}>{formatPrimaryMetric(workout)}</Text>
            <Text style={styles.metricSub}>
              {durationMinutes(workout)}분 · 강도 {workout.perceivedExertion}/10
            </Text>
          </View>
          {workout.notes ? <Text style={styles.recordNote}>{workout.notes}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function PostList({
  posts,
  onOpen,
  styles,
}: {
  posts: FeedPost[];
  onOpen(): void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (posts.length === 0)
    return (
      <Empty copy="공유한 게시물이 없습니다. 운동 기록을 스토리로 이어보세요." styles={styles} />
    );
  return (
    <View style={styles.postGrid}>
      {posts.map((post) => (
        <Pressable key={post.id} onPress={onOpen} style={styles.postTile}>
          <Text style={styles.postSport}>{shortSportLabel(post.sport).toUpperCase()}</Text>
          <Text numberOfLines={4} style={styles.postContent}>
            {post.content}
          </Text>
          <Text style={styles.postMeta}>
            {post.contentType === "story" ? "STORY" : "POST"} · 좋아요 {post.likeCount} · 댓글{" "}
            {post.comments.length}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Empty({ copy, styles }: { copy: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMark}>＋</Text>
      <Text style={styles.emptyText}>{copy}</Text>
    </View>
  );
}

function shortSportLabel(sport: SportType): string {
  return sport === "strength" ? "근력" : sportLabels[sport];
}
function sportGlyph(sport: SportType): string {
  return sport === "strength"
    ? "S"
    : sport === "running"
      ? "R"
      : sport === "hiking"
        ? "H"
        : sport === "diving"
          ? "D"
          : sport === "cycling"
            ? "C"
            : "W";
}
function durationMinutes(workout: WorkoutSession): number {
  return Math.max(
    1,
    Math.round((Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 60_000),
  );
}
function formatPrimaryMetric(workout: WorkoutSession): string {
  const distance = workout.metrics.distanceKm;
  if (typeof distance === "number") return `${distance.toFixed(2)} km`;
  const calories = workout.metrics.calories;
  if (typeof calories === "number") return `${Math.round(calories)} kcal`;
  return `${durationMinutes(workout)} MIN`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: maxContentWidth,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 110,
      gap: 22,
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: { ...typography.wordmark(18), color: colors.primary },
    adminLink: { color: colors.muted, fontSize: 9, fontFamily: fonts.bold, letterSpacing: 1 },
    identityRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: {
      width: 62,
      height: 62,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    avatarImage: { width: 62, height: 62, borderRadius: radius.full },
    avatarText: { color: "#FFFFFF", fontSize: 24, fontFamily: fonts.bold },
    avatarEditBadge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 21,
      height: 21,
      borderRadius: 11,
      backgroundColor: colors.ink,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarEditGlyph: { color: colors.background, fontSize: 13, fontWeight: "900" },
    identityCopy: { flex: 1, gap: 3 },
    displayName: { color: colors.ink, fontSize: 22, fontFamily: fonts.bold },
    editHint: { color: colors.primary, fontSize: 8, fontFamily: fonts.semibold, marginTop: 2 },
    email: { color: colors.muted, fontSize: 10, fontFamily: fonts.regular },
    nicknameEditor: { flexDirection: "row", alignItems: "center", gap: 9 },
    nicknameInput: {
      flex: 1,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.primary,
      fontSize: 18,
      fontFamily: fonts.bold,
      paddingVertical: 4,
    },
    nicknameSave: { color: colors.primary, fontSize: 10, fontFamily: fonts.bold },
    avatarMenu: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      gap: 9,
    },
    avatarMenuTitle: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    avatarMenuActions: { flexDirection: "row", gap: 8 },
    avatarMenuButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 6,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarMenuButtonText: { color: colors.ink, fontSize: 9, fontWeight: "900" },
    statsRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 15,
    },
    stat: { flex: 1, alignItems: "center", gap: 3 },
    statValue: { ...typography.numeric(17), color: colors.ink },
    statLabel: { color: colors.muted, fontSize: 9, fontFamily: fonts.medium },
    sectionEyebrow: {
      color: colors.primary,
      fontSize: 8,
      fontFamily: fonts.bold,
      letterSpacing: 1,
    },
    sectionTitle: { color: colors.ink, fontSize: 18, fontFamily: fonts.bold, marginTop: 3 },
    orbs: { gap: 14, paddingRight: 18 },
    orbItem: { width: 54, alignItems: "center", gap: 7 },
    recordOrb: {
      width: 52,
      height: 52,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    recordOrbActive: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    orbCount: { ...typography.numeric(15), color: colors.muted },
    orbCountActive: { color: "#FFFFFF" },
    orbLabel: { color: colors.muted, fontSize: 8, fontWeight: "800" },
    orbLabelActive: { color: colors.primary },
    medalHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    medalCount: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    medalRow: { gap: 14, paddingRight: 20 },
    medalItem: { width: 66, alignItems: "center", gap: 5 },
    medalSphere: {
      width: 58,
      height: 58,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    medalEarned: { backgroundColor: colors.primary, borderColor: colors.primary },
    medalSpecial: { borderColor: colors.primary, borderWidth: 2 },
    medalLocked: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    medalGlyph: { color: "#FFFFFF", fontSize: 16, fontFamily: fonts.displayItalic },
    medalGlyphLocked: { color: colors.muted },
    medalName: {
      color: colors.ink,
      width: 66,
      textAlign: "center",
      fontSize: 7,
      fontWeight: "800",
    },
    medalProgress: { color: colors.muted, fontSize: 7 },
    physicalTag: { color: colors.primary, fontSize: 5, fontWeight: "900", letterSpacing: 0.4 },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    tabButton: { flex: 1, alignItems: "center", paddingVertical: 11, position: "relative" },
    tabText: { color: colors.muted, fontSize: 10, fontFamily: fonts.semibold },
    tabTextActive: { color: colors.ink },
    tabUnderline: {
      position: "absolute",
      height: 2,
      backgroundColor: colors.primary,
      left: 8,
      right: 8,
      bottom: -1,
    },
    loading: { paddingVertical: 44 },
    error: { color: "#C94732", fontSize: 10, fontWeight: "700", lineHeight: 16 },
    contentSection: { gap: 9 },
    recordCard: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 14,
      gap: 8,
    },
    cardEyebrow: { color: colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
    cardTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold, marginTop: 3 },
    recordMetrics: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    metricStrong: { ...typography.numeric(24), color: colors.ink },
    metricSub: { color: colors.muted, fontSize: 8 },
    recordNote: { color: colors.muted, fontSize: 9, lineHeight: 15 },
    postGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    postTile: {
      width: "48.5%",
      minHeight: 154,
      backgroundColor: colors.ink,
      borderRadius: radius.xl,
      padding: 14,
      justifyContent: "space-between",
      ...shadows.card,
    },
    postSport: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
    postContent: { color: "#FFFFFF", fontSize: 12, lineHeight: 19, fontWeight: "800" },
    postMeta: { color: "#A3A3A3", fontSize: 7 },
    networkGrid: { flexDirection: "row", gap: 12 },
    peopleColumn: {
      flex: 1,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      padding: 13,
    },
    personRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    personAvatar: {
      width: 29,
      height: 29,
      borderRadius: 15,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    personAvatarText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    personName: { color: colors.ink, fontSize: 9, fontWeight: "800", flex: 1 },
    emptySmall: { color: colors.muted, fontSize: 8 },
    routineComposer: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.xl,
      padding: 14,
      gap: 10,
    },
    routineInput: {
      minHeight: 44,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontSize: 13,
      fontWeight: "800",
    },
    primaryButton: {
      minHeight: 43,
      borderRadius: 6,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    routineCard: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 13,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    routineMeta: { color: colors.muted, fontSize: 8 },
    empty: {
      alignItems: "center",
      paddingVertical: 44,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    emptyMark: { color: colors.primary, fontSize: 24, fontWeight: "300" },
    emptyText: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 16,
      textAlign: "center",
      maxWidth: 280,
    },
    settings: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 18,
      marginTop: 48,
    },
    settingsTitle: { color: colors.ink, fontSize: 13, fontFamily: fonts.bold },
    settingsCopy: { color: colors.muted, fontSize: 8, marginTop: 3 },
    logoutButton: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: { color: colors.background, fontSize: 10, fontWeight: "900" },
  });
}
