import {
  NicknameSchema,
  RoutineCreateInputSchema,
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
import * as ImageManipulator from "expo-image-manipulator";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { CenterDialog } from "../../src/components/ui";
import {
  fonts,
  maxContentWidth,
  radius,
  shadows,
  typography,
  type ThemeColors,
} from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";
import { sortWorkoutsForDisplay } from "../../src/workout-display";
import { formatSensorMetricLine } from "../../src/workout-metrics";

type ProfileTab = "records" | "posts" | "routines";
type RecordFilter = "all" | SportType;
type RoutineSport = "strength" | "swimming" | "diving";
type RoutineDraftItem = {
  name: string;
  target: string;
  repetitions: string;
  sets: string;
  estimatedMinutes: string;
  restMinutes: string;
};

const routineSports: RoutineSport[] = ["strength", "swimming", "diving"];
const emptyRoutineItem = (): RoutineDraftItem => ({
  name: "",
  target: "",
  repetitions: "",
  sets: "",
  estimatedMinutes: "",
  restMinutes: "",
});

function strengthRoutineTarget(item: RoutineDraftItem) {
  return `${item.repetitions}회 · ${item.sets}세트 · 예상 ${item.estimatedMinutes}분 · 휴식 ${item.restMinutes}분`;
}

function parseStrengthRoutineTarget(name: string, target: string): RoutineDraftItem {
  return {
    name,
    target,
    repetitions: target.match(/(\d+(?:\.\d+)?)\s*회/)?.[1] ?? "",
    sets: target.match(/(\d+(?:\.\d+)?)\s*세트/)?.[1] ?? "",
    estimatedMinutes: target.match(/예상\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? "",
    restMinutes: target.match(/휴식\s*(\d+(?:\.\d+)?)\s*분/)?.[1] ?? "",
  };
}

const emptySocial: SocialSummary = {
  followersCount: 0,
  followingCount: 0,
  followers: [],
  following: [],
};

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { session, logout, updateUser } = useAuth();
  const [tab, setTab] = useState<ProfileTab>(params.tab === "routines" ? "routines" : "records");
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
  const [routineSport, setRoutineSport] = useState<RoutineSport>("strength");
  const [routineItems, setRoutineItems] = useState<RoutineDraftItem[]>([emptyRoutineItem()]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [pendingDeleteRoutineId, setPendingDeleteRoutineId] = useState<string | null>(null);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
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
      if (params.tab === "routines") setTab("routines");
      void loadProfile();
    }, [loadProfile, params.tab]),
  );

  const visibleWorkouts = useMemo(
    () =>
      sortWorkoutsForDisplay(
        recordFilter === "all"
          ? workouts
          : workouts.filter((workout) => workout.sport === recordFilter),
      ),
    [recordFilter, workouts],
  );
  const earnedMedals = medals.filter((medal) => medal.earned);
  const pendingDeleteRoutine =
    routines.find((routine) => routine.id === pendingDeleteRoutineId) ?? null;

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
            quality: 0.35,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.35,
          });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) {
      setError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.");
      return;
    }
    const sanitized = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 512, height: 512 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    ).catch(() => null);
    if (!sanitized?.base64) {
      setError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.");
      return;
    }
    const avatarDataUri = `data:image/jpeg;base64,${sanitized.base64}`;
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

  const resetRoutineComposer = () => {
    setRoutineTitle("");
    setRoutineSport("strength");
    setRoutineItems([emptyRoutineItem()]);
    setEditingRoutineId(null);
  };

  const saveRoutine = async () => {
    if (!session) return;
    const activeItems = routineItems.filter((item) =>
      [
        item.name,
        item.target,
        item.repetitions,
        item.sets,
        item.estimatedMinutes,
        item.restMinutes,
      ].some((value) => value.trim()),
    );
    if (routineSport === "strength") {
      const invalidItem = activeItems.find(
        (item) =>
          !item.name.trim() ||
          !(Number(item.repetitions) > 0) ||
          !(Number(item.sets) > 0) ||
          !(Number(item.estimatedMinutes) > 0) ||
          !Number.isFinite(Number(item.restMinutes)) ||
          Number(item.restMinutes) < 0,
      );
      if (invalidItem || activeItems.length === 0) {
        setError("근력 루틴은 운동명·횟수·세트·예상 시간·휴식 시간을 모두 입력해 주세요.");
        return;
      }
    }
    const parsed = RoutineCreateInputSchema.safeParse({
      title: routineTitle.trim(),
      sport: routineSport,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      items: activeItems
        .filter((item) => item.name.trim() && (routineSport === "strength" || item.target.trim()))
        .map((item, order) => ({
          name: item.name.trim(),
          target: routineSport === "strength" ? strengthRoutineTarget(item) : item.target.trim(),
          order,
        })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "루틴 내용을 확인해 주세요.");
      return;
    }
    setSavingRoutine(true);
    setError(null);
    setRoutineMessage(null);
    try {
      if (editingRoutineId) {
        const routine = await api.updateRoutine(session.accessToken, editingRoutineId, parsed.data);
        setRoutines((current) =>
          current.map((item) => (item.id === editingRoutineId ? routine : item)),
        );
        setRoutineMessage("루틴을 수정했습니다.");
      } else {
        const routine = await api.createRoutine(session.accessToken, parsed.data);
        setRoutines((current) => [routine, ...current]);
        setRoutineMessage("새 루틴을 저장했습니다. 홈의 오늘 루틴에 바로 연결됩니다.");
      }
      resetRoutineComposer();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "루틴을 저장하지 못했습니다.");
    } finally {
      setSavingRoutine(false);
    }
  };

  const editRoutine = (routine: Routine) => {
    setRoutineTitle(routine.title);
    setRoutineSport(
      routineSports.includes(routine.sport as RoutineSport)
        ? (routine.sport as RoutineSport)
        : "strength",
    );
    setRoutineItems(
      [...routine.items]
        .sort((left, right) => left.order - right.order)
        .map(({ name, target }) =>
          routine.sport === "strength"
            ? parseStrengthRoutineTarget(name, target)
            : { ...emptyRoutineItem(), name, target },
        ),
    );
    setEditingRoutineId(routine.id);
    setRoutineMessage("수정할 내용을 바꾼 뒤 저장해 주세요.");
  };

  const deleteRoutine = async (routineId: string) => {
    if (!session) return;
    setSavingRoutine(true);
    setError(null);
    try {
      await api.deleteRoutine(session.accessToken, routineId);
      setRoutines((current) => current.filter((routine) => routine.id !== routineId));
      if (editingRoutineId === routineId) resetRoutineComposer();
      setPendingDeleteRoutineId(null);
      setRoutineMessage("루틴을 제거했습니다.");
    } catch (caught) {
      setPendingDeleteRoutineId(null);
      setError(caught instanceof ApiError ? caught.message : "루틴을 제거하지 못했습니다.");
    } finally {
      setSavingRoutine(false);
    }
  };

  const moveRoutine = async (index: number, direction: -1 | 1) => {
    if (!session) return;
    const target = index + direction;
    if (target < 0 || target >= routines.length) return;
    const next = [...routines];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setRoutines(next);
    try {
      const ordered = await api.reorderRoutines(session.accessToken, {
        routineIds: next.map((routine) => routine.id),
      });
      setRoutines(ordered);
      setRoutineMessage("홈에 표시되는 루틴 순서를 변경했습니다.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "순서를 변경하지 못했습니다.");
      await loadProfile();
    }
  };

  const updateRoutineItem = (index: number, field: keyof RoutineDraftItem, value: string) => {
    setRoutineItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  };

  const moveRoutineItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= routineItems.length) return;
    setRoutineItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <CenterDialog
        busy={savingRoutine}
        confirmLabel={savingRoutine ? "제거 중" : "루틴 제거"}
        danger
        eyebrow="DELETE ROUTINE"
        message={
          pendingDeleteRoutine
            ? `${pendingDeleteRoutine.title} 루틴은 제거 후 다시 복구할 수 없습니다.`
            : ""
        }
        onClose={() => setPendingDeleteRoutineId(null)}
        onConfirm={() => {
          if (pendingDeleteRoutine) void deleteRoutine(pendingDeleteRoutine.id);
        }}
        title="이 루틴을 제거할까요?"
        visible={pendingDeleteRoutine !== null}
      />
      <CenterDialog
        message={error ?? ""}
        onClose={() => setError(null)}
        title="확인이 필요합니다"
        visible={error !== null && pendingDeleteRoutine === null}
      />
      <CenterDialog
        message={routineMessage ?? ""}
        onClose={() => setRoutineMessage(null)}
        title="처리했습니다"
        visible={routineMessage !== null && error === null && pendingDeleteRoutine === null}
      />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>GROOV</Text>
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

        <Pressable
          onPress={() => router.push("/profile/goals" as never)}
          style={styles.goalsShortcut}
        >
          <View>
            <Text style={styles.goalsShortcutEyebrow}>MY PRIVATE GOALS</Text>
            <Text style={styles.goalsShortcutTitle}>존중에서 시작한 목표</Text>
          </View>
          <Text style={styles.goalsShortcutArrow}>→</Text>
        </Pressable>

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
              sport={sport}
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
              <View style={styles.routineComposerHeader}>
                <View>
                  <Text style={styles.cardEyebrow}>
                    {editingRoutineId ? "EDIT ROUTINE" : "NEW ROUTINE"}
                  </Text>
                  <Text style={styles.routineComposerTitle}>
                    {editingRoutineId ? "루틴 수정" : "나만의 루틴 만들기"}
                  </Text>
                </View>
                {editingRoutineId ? (
                  <Pressable onPress={resetRoutineComposer}>
                    <Text style={styles.textAction}>취소</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fieldLabel}>운동 종류</Text>
              <View style={styles.routineSportRow}>
                {routineSports.map((sport) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: routineSport === sport }}
                    key={sport}
                    onPress={() => setRoutineSport(sport)}
                    style={[
                      styles.routineSportChip,
                      routineSport === sport && styles.routineSportChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.routineSportText,
                        routineSport === sport && styles.routineSportTextActive,
                      ]}
                    >
                      {sportLabels[sport]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>루틴 이름</Text>
              <TextInput
                value={routineTitle}
                onChangeText={setRoutineTitle}
                placeholder="예: 출근 전 전신 루틴"
                placeholderTextColor={colors.muted}
                style={styles.routineInput}
              />
              <View style={styles.fieldHeading}>
                <Text style={styles.fieldLabel}>루틴 항목</Text>
                <Pressable
                  onPress={() => setRoutineItems((current) => [...current, emptyRoutineItem()])}
                >
                  <Text style={styles.textAction}>+ 항목 추가</Text>
                </Pressable>
              </View>
              <View style={styles.routineDraftList}>
                {routineItems.map((item, index) => (
                  <View key={`routine-item-${index}`} style={styles.routineDraftItem}>
                    <View style={styles.routineItemNumber}>
                      <Text style={styles.routineItemNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.routineItemFields}>
                      <TextInput
                        onChangeText={(value) => updateRoutineItem(index, "name", value)}
                        placeholder="운동명 또는 단계"
                        placeholderTextColor={colors.muted}
                        style={styles.routineItemInput}
                        value={item.name}
                      />
                      {routineSport === "strength" ? (
                        <View style={styles.strengthDetailGrid}>
                          <RoutineNumberField
                            label="횟수"
                            onChangeText={(value) => updateRoutineItem(index, "repetitions", value)}
                            styles={styles}
                            unit="회"
                            value={item.repetitions}
                          />
                          <RoutineNumberField
                            label="세트"
                            onChangeText={(value) => updateRoutineItem(index, "sets", value)}
                            styles={styles}
                            unit="세트"
                            value={item.sets}
                          />
                          <RoutineNumberField
                            label="예상 소요"
                            onChangeText={(value) =>
                              updateRoutineItem(index, "estimatedMinutes", value)
                            }
                            styles={styles}
                            unit="분"
                            value={item.estimatedMinutes}
                          />
                          <RoutineNumberField
                            label="세트 휴식"
                            onChangeText={(value) => updateRoutineItem(index, "restMinutes", value)}
                            styles={styles}
                            unit="분"
                            value={item.restMinutes}
                          />
                        </View>
                      ) : (
                        <TextInput
                          onChangeText={(value) => updateRoutineItem(index, "target", value)}
                          placeholder="횟수·시간·거리"
                          placeholderTextColor={colors.muted}
                          style={styles.routineTargetInput}
                          value={item.target}
                        />
                      )}
                    </View>
                    <View style={styles.itemActions}>
                      <Pressable
                        accessibilityLabel={`${index + 1}번 항목 위로`}
                        disabled={index === 0}
                        onPress={() => moveRoutineItem(index, -1)}
                      >
                        <Text style={[styles.iconAction, index === 0 && styles.actionDisabled]}>
                          ↑
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${index + 1}번 항목 아래로`}
                        disabled={index === routineItems.length - 1}
                        onPress={() => moveRoutineItem(index, 1)}
                      >
                        <Text
                          style={[
                            styles.iconAction,
                            index === routineItems.length - 1 && styles.actionDisabled,
                          ]}
                        >
                          ↓
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${index + 1}번 항목 제거`}
                        disabled={routineItems.length === 1}
                        onPress={() =>
                          setRoutineItems((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.iconAction,
                            routineItems.length === 1 && styles.actionDisabled,
                          ]}
                        >
                          ×
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
              <Pressable
                disabled={savingRoutine}
                onPress={() => void saveRoutine()}
                style={[styles.primaryButton, savingRoutine && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {savingRoutine ? "저장 중" : editingRoutineId ? "수정 내용 저장" : "루틴 저장"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.savedRoutineHeader}>
              <Text style={styles.savedRoutineTitle}>저장한 루틴</Text>
              <Text style={styles.savedRoutineCount}>{routines.length}개</Text>
            </View>
            {routines.map((routine, index) => (
              <View key={routine.id} style={styles.routineCard}>
                <View style={styles.routineCardHeader}>
                  <View style={styles.routineCardCopy}>
                    <Text style={styles.cardEyebrow}>{sportLabels[routine.sport]}</Text>
                    <Text style={styles.cardTitle}>{routine.title}</Text>
                    <Text style={styles.routineMeta}>
                      {routine.items.length}개 항목 · 매일 표시
                    </Text>
                  </View>
                  <View style={styles.routineOrderActions}>
                    <Pressable
                      accessibilityLabel={`${routine.title} 위로 이동`}
                      disabled={index === 0}
                      onPress={() => void moveRoutine(index, -1)}
                    >
                      <Text style={[styles.orderAction, index === 0 && styles.actionDisabled]}>
                        ↑
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`${routine.title} 아래로 이동`}
                      disabled={index === routines.length - 1}
                      onPress={() => void moveRoutine(index, 1)}
                    >
                      <Text
                        style={[
                          styles.orderAction,
                          index === routines.length - 1 && styles.actionDisabled,
                        ]}
                      >
                        ↓
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.routinePreviewList}>
                  {[...routine.items]
                    .sort((left, right) => left.order - right.order)
                    .map((item, itemIndex) => (
                      <View key={`${routine.id}-${item.order}`} style={styles.routinePreviewItem}>
                        <Text style={styles.routinePreviewNumber}>{itemIndex + 1}</Text>
                        <Text style={styles.routinePreviewName}>{item.name}</Text>
                        <Text style={styles.routinePreviewTarget}>{item.target}</Text>
                      </View>
                    ))}
                </View>
                <View style={styles.routineCardActions}>
                  <Pressable onPress={() => editRoutine(routine)}>
                    <Text style={styles.secondaryAction}>수정</Text>
                  </Pressable>
                  <Pressable onPress={() => setPendingDeleteRoutineId(routine.id)}>
                    <Text style={styles.deleteAction}>제거</Text>
                  </Pressable>
                </View>
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
        <Pressable onPress={() => router.push("/profile/account")} style={styles.accountButton}>
          <Text style={styles.accountText}>계정 · 보안 · 개인정보</Text>
        </Pressable>
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
  sport,
  onPress,
  styles,
}: {
  active: boolean;
  count: number;
  label: string;
  sport?: SportType;
  onPress(): void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.orbItem}>
      <View style={[styles.recordOrb, active && styles.recordOrbActive]}>
        <Text style={[styles.orbSportGlyph, active && styles.orbSportGlyphActive]}>
          {sport ? sportGlyph(sport) : "·"}
        </Text>
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
          <Text style={styles.recordSensorMetric}>{formatSensorMetricLine(workout)}</Text>
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

function RoutineNumberField({
  label,
  unit,
  value,
  onChangeText,
  styles,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.strengthDetailField}>
      <Text style={styles.strengthDetailLabel}>{label}</Text>
      <View style={styles.strengthDetailInputRow}>
        <TextInput
          accessibilityLabel={label}
          keyboardType="decimal-pad"
          onChangeText={onChangeText}
          placeholder="0"
          style={styles.strengthDetailInput}
          value={value}
        />
        <Text style={styles.strengthDetailUnit}>{unit}</Text>
      </View>
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
    goalsShortcut: {
      minHeight: 62,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    goalsShortcutEyebrow: {
      color: colors.primary,
      fontSize: 7,
      fontFamily: fonts.bold,
      letterSpacing: 0.8,
    },
    goalsShortcutTitle: { color: colors.ink, fontSize: 12, fontFamily: fonts.bold, marginTop: 4 },
    goalsShortcutArrow: { color: colors.primary, fontSize: 20, fontFamily: fonts.regular },
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
      overflow: "hidden",
    },
    recordOrbActive: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    orbSportGlyph: {
      position: "absolute",
      color: colors.border,
      fontSize: 27,
      opacity: 0.32,
      fontFamily: fonts.displayItalic,
    },
    orbSportGlyphActive: { color: "#FFFFFF", opacity: 0.2 },
    orbCount: { ...typography.numeric(15), color: colors.muted, zIndex: 1 },
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
    error: { color: colors.primary, fontSize: 10, fontWeight: "700", lineHeight: 16 },
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
    recordSensorMetric: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 8,
      lineHeight: 13,
    },
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
    routineComposerHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    routineComposerTitle: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 17,
      marginTop: 4,
    },
    fieldLabel: { color: colors.muted, fontFamily: fonts.bold, fontSize: 9 },
    fieldHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    textAction: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    routineSportRow: { flexDirection: "row", gap: 7 },
    routineSportChip: {
      flex: 1,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
    },
    routineSportChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
    routineSportText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 9 },
    routineSportTextActive: { color: colors.background },
    routineInput: {
      minHeight: 44,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontSize: 13,
      fontWeight: "800",
    },
    routineDraftList: { gap: 8 },
    routineDraftItem: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      padding: 9,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    routineItemNumber: {
      width: 24,
      height: 24,
      borderRadius: radius.full,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    routineItemNumberText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    routineItemFields: { flex: 1 },
    routineItemInput: {
      minHeight: 28,
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    routineTargetInput: {
      minHeight: 27,
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
    },
    strengthDetailGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      paddingTop: 8,
    },
    strengthDetailField: {
      width: "48%",
      gap: 4,
    },
    strengthDetailLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 7 },
    strengthDetailInputRow: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 8,
      backgroundColor: colors.surfaceMuted,
    },
    strengthDetailInput: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 10,
      paddingVertical: 6,
    },
    strengthDetailUnit: { color: colors.muted, fontFamily: fonts.medium, fontSize: 8 },
    itemActions: { alignItems: "center", justifyContent: "center", gap: 2 },
    iconAction: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, paddingHorizontal: 5 },
    actionDisabled: { color: colors.border },
    primaryButton: {
      minHeight: 43,
      borderRadius: 6,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    buttonDisabled: { opacity: 0.5 },
    routineMessage: {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: 10,
      fontFamily: fonts.semibold,
      fontSize: 9,
    },
    savedRoutineHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginTop: 8,
    },
    savedRoutineTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    savedRoutineCount: { color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
    routineCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      padding: 14,
      gap: 11,
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    routineCardHeader: { flexDirection: "row", alignItems: "flex-start" },
    routineCardCopy: { flex: 1 },
    routineMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
    routineOrderActions: { flexDirection: "row", gap: 4 },
    orderAction: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 15,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    routinePreviewList: { gap: 5 },
    routinePreviewItem: { flexDirection: "row", alignItems: "center", gap: 7 },
    routinePreviewNumber: {
      width: 18,
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
    },
    routinePreviewName: { flex: 1, color: colors.ink, fontFamily: fonts.medium, fontSize: 9 },
    routinePreviewTarget: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8 },
    routineCardActions: {
      minHeight: 29,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 15,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    secondaryAction: { color: colors.ink, fontFamily: fonts.bold, fontSize: 9 },
    deleteAction: { color: colors.danger, fontFamily: fonts.bold, fontSize: 9 },
    deleteConfirmText: { flex: 1, color: colors.muted, fontFamily: fonts.medium, fontSize: 9 },
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
    accountButton: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    accountText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
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
