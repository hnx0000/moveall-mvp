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
import { AvatarEditor } from "../../src/components/avatar-editor";
import { AchievementMedal, medalProgressPercent } from "../../src/components/achievement-medal";
import { ReorderableList } from "../../src/components/reorderable-list";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Camera, ChevronRight, Images, Plus, Settings, X } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { CenterDialog, Wordmark } from "../../src/components/ui";
import { uiLayout,
  fonts,
  radius,
  shadows,
  typography,
  type ThemeColors,
} from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type ProfileTab = "posts" | "routines";
type RoutineDraftItem = {
  draftId: string;
  name: string;
  target: string;
  repetitions: string;
  sets: string;
  estimatedMinutes: string;
  restMinutes: string;
};

const routineSports = sportValues;
let routineDraftSequence = 0;
const emptyRoutineItem = (): RoutineDraftItem => ({
  draftId: `routine-draft-${++routineDraftSequence}`,
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
    ...emptyRoutineItem(),
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
  const routineScrollView = useRef<ScrollView>(null);
  const routineScrollMetrics = useRef({ offset: 0, height: 0, contentHeight: 0 });
  const routineScroll = { view: routineScrollView, metrics: routineScrollMetrics };
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { width: viewportWidth } = useWindowDimensions();
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, Math.min(viewportWidth, 430)), [colors, viewportWidth]);
  const { session, logout, updateUser } = useAuth();
  const [tab, setTab] = useState<ProfileTab>(params.tab === "routines" ? "routines" : "posts");
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [showAllMedals, setShowAllMedals] = useState(false);
  const [social, setSocial] = useState<SocialSummary>(emptySocial);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const pendingAvatarSource = useRef<"camera" | "library" | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [temporarySettingsOpen, setTemporarySettingsOpen] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [routineSport, setRoutineSport] = useState<SportType>("strength");
  const [routineItems, setRoutineItems] = useState<RoutineDraftItem[]>([emptyRoutineItem()]);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [pendingDeleteRoutineId, setPendingDeleteRoutineId] = useState<string | null>(null);
  const [routineMessage, setRoutineMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [draggingRoutine, setDraggingRoutine] = useState(false);
  const [reorderingRoutine, setReorderingRoutine] = useState(false);
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
            allowsEditing: false,
            aspect: [1, 1],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            aspect: [1, 1],
            quality: 1,
          });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) {
      setError("사진을 처리하지 못했습니다. 다른 사진을 선택해 주세요.");
      return;
    }
    setPendingPhoto(asset);
    setAvatarMenuOpen(false);
  };

  const launchAvatarSource = (source: "camera" | "library") => {
    void changeAvatar(source).catch(() =>
      setError(source === "camera" ? "카메라를 열지 못했습니다. 다시 시도해 주세요." : "사진첩을 열지 못했습니다. 다시 시도해 주세요."),
    );
  };

  const selectAvatarSource = (source: "camera" | "library") => {
    setAvatarMenuOpen(false);
    // iOS must finish dismissing this modal before presenting the native picker.
    if (Platform.OS === "ios") pendingAvatarSource.current = source;
    else launchAvatarSource(source);
  };

  const saveAvatar = async (avatarDataUri: string) => {
    if (!session) throw new Error("로그인이 필요합니다.");
    setSavingProfile(true);
    try {
      const nextProfile = await api.updateProfile(session.accessToken, { avatarDataUri });
      setProfile(nextProfile);
      setAvatarMenuOpen(false);
      setPendingPhoto(null);
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
    setRoutineSport(routine.sport);
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

  const reorderRoutines = async (next: Routine[]) => {
    if (!session || reorderingRoutine) return;
    setReorderingRoutine(true);
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
    } finally {
      setReorderingRoutine(false);
    }
  };

  const updateRoutineItem = (index: number, field: keyof RoutineDraftItem, value: string) => {
    setRoutineItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  };

  if (!session) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal transparent animationType="fade" statusBarTranslucent visible={avatarMenuOpen}
        onRequestClose={() => setAvatarMenuOpen(false)}
        onDismiss={() => {
          const source = pendingAvatarSource.current;
          pendingAvatarSource.current = null;
          if (source) launchAvatarSource(source);
        }}>
        <View style={styles.avatarMenuBackdrop} accessibilityViewIsModal>
          <Pressable accessibilityRole="button" accessibilityLabel="프로필 사진 선택 닫기"
            onPress={() => setAvatarMenuOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.avatarMenu}>
            <View style={styles.avatarMenuHeader}>
              <Text accessibilityRole="header" style={styles.avatarMenuTitle}>프로필 사진</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="닫기"
                onPress={() => setAvatarMenuOpen(false)} style={styles.avatarMenuClose}>
                <X size={19} strokeWidth={1.6} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.avatarMenuActions}>
              <Pressable accessibilityRole="button" onPress={() => selectAvatarSource("camera")}
                style={({ pressed }) => [styles.avatarMenuButton, pressed && styles.avatarMenuButtonPressed]}>
                <Camera size={23} strokeWidth={1.5} color={colors.primary} />
                <Text style={styles.avatarMenuButtonText}>카메라</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => selectAvatarSource("library")}
                style={({ pressed }) => [styles.avatarMenuButton, pressed && styles.avatarMenuButtonPressed]}>
                <Images size={23} strokeWidth={1.5} color={colors.primary} />
                <Text style={styles.avatarMenuButtonText}>사진첩</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
      <ScrollView ref={routineScrollView} contentContainerStyle={styles.page} scrollEnabled={!draggingRoutine}
        scrollEventThrottle={16}
        onContentSizeChange={(_width, height) => { routineScrollMetrics.current.contentHeight = height; }}
        onLayout={event => { routineScrollMetrics.current.height = event.nativeEvent.layout.height; }}
        onScroll={event => { routineScrollMetrics.current.offset = event.nativeEvent.contentOffset.y; }}>
        {pendingPhoto ? (
          <AvatarEditor
            photo={pendingPhoto}
            onCancel={() => setPendingPhoto(null)}
            onSave={saveAvatar}
          />
        ) : null}
        <View style={styles.topBar}>
          <View>
            <View style={styles.brandWordmarkBox}><Wordmark size={24} /></View>
          </View>
          <Pressable
            accessibilityLabel="설정 메뉴"
            accessibilityRole="button"
            accessibilityState={{ expanded: temporarySettingsOpen }}
            hitSlop={5}
            onPress={() => setTemporarySettingsOpen((current) => !current)}
            style={styles.settingsButton}
          >
            <Settings color={colors.ink} size={18} strokeWidth={1.6} />
          </Pressable>
        </View>

        {temporarySettingsOpen ? (
          <View style={styles.temporarySettingsMenu}>
            <View style={styles.temporarySettingsHeading}>
              <Text style={styles.temporarySettingsEyebrow}>설정</Text>
              <Text style={styles.temporarySettingsCaption}>화면 테마</Text>
            </View>
            <Switch
              accessibilityLabel="다크 모드"
              value={mode === "dark"}
              onValueChange={(value) => setMode(value ? "dark" : "light")}
            />
          </View>
        ) : null}

        <View style={styles.identityRow}>
          <Pressable
            accessibilityLabel="프로필 사진 변경"
            accessibilityRole="button"
            accessibilityState={{ expanded: avatarMenuOpen }}
            onPress={() => setAvatarMenuOpen(true)}
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
              <View style={styles.avatarPlusDisc}>
                <View style={styles.avatarPlusCross}>
                  <View style={styles.avatarPlusHorizontal} />
                  <View style={styles.avatarPlusVertical} />
                </View>
              </View>
            </View>
          </Pressable>
          <View style={styles.identityCopy}>
            <View style={styles.myBadge}><Text style={styles.myBadgeText}>MY</Text></View>
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
              </Pressable>
            )}
            <Text style={styles.profileMotto}>“언제나 더 나은 하루”</Text>
            <Text style={styles.email}>{session.user.email}</Text>
          </View>
        </View>

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

        <View style={styles.medalCabinet}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
            <Image
                  source={require("../../assets/images/profile/medal-texture-v3.png")}
              style={[styles.medalBackdrop, { opacity: mode === "dark" ? 0.55 : 0.12 }]}
              resizeMode="cover"
              accessible={false}
            />
          </View>
          <View style={styles.medalHeader}>
            <View>
              <SectionHeader eyebrow="MEDAL CABINET" title="달성 메달" styles={styles} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={showAllMedals ? "메달 접기" : "전체 메달 보기"}
              accessibilityState={{ expanded: showAllMedals }} onPress={() => setShowAllMedals(value => !value)} style={styles.medalMore}>
              <Text style={styles.medalCount}>{earnedMedals.length} / {medals.length}</Text>
              <View style={styles.medalArrow}><ArrowRight color={colors.ink} size={17} style={{ transform: [{ rotate: showAllMedals ? "90deg" : "0deg" }] }} /></View>
            </Pressable>
          </View>
        <ScrollView
          horizontal={!showAllMedals}
          scrollEnabled={!showAllMedals}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.medalRow, showAllMedals && styles.medalRowExpanded]}
        >
          {medals.map((medal) => (
            <View key={medal.id} style={styles.medalItem}>
              <AchievementMedal medal={medal} size={styles.medalSphere.width} />
              <View style={styles.medalProgressTrack} accessibilityRole="progressbar"
                accessibilityLabel={`${medal.title} 진행률`}
                accessibilityValue={{ min: 0, max: 100, now: medalProgressPercent(medal) }}>
                <View style={[styles.medalProgressFill, {
                  width: `${medalProgressPercent(medal)}%`,
                  backgroundColor: medal.earned || medal.physicalRewardEligible ? colors.primary : "#4eaeb9",
                }]} />
              </View>
              <Text numberOfLines={1} style={styles.medalName}>
                {medal.title}
              </Text>
              <Text style={[styles.medalProgress, { color: medal.earned || medal.physicalRewardEligible ? colors.primary : "#6ab7c0" }]}>
                {medal.progress}/{medal.target}
              </Text>
            </View>
          ))}
        </ScrollView>
        </View>

        <View style={styles.tabBar}>
          {(
            [
              ["posts", "게시물"],
              ["routines", "루틴"],
            ] as const
          ).map(([value, label]) => (
            <Pressable key={value} hitSlop={{ top: 5, bottom: 5 }} accessibilityRole="tab" accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={styles.tabButton}>
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
        {!loading && tab === "posts" ? (
          <PostList
            onOpen={() => router.push("/profile/content")}
            onCreate={() => router.push("/compose?direct=1")}
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
              <ReorderableList scroll={routineScroll} items={routineItems} itemKey={item => item.draftId}
                itemLabel={(item, index) => item.name || `${index + 1}번 항목`}
                onReorder={setRoutineItems} onDraggingChange={setDraggingRoutine} disabled={savingRoutine}
                renderItem={(item, index, handle) => (
                  <View style={styles.routineDraftItem}>
                    <View style={styles.routineDragRail}>
                    <View style={styles.routineItemNumber}>
                      <Text style={styles.routineItemNumberText}>{index + 1}</Text>
                    </View>
                    {handle}
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${index + 1}번 항목 제거`}
                        style={styles.routineItemRemove}
                        disabled={routineItems.length === 1 || savingRoutine}
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
                )}
              />
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
            <ReorderableList scroll={routineScroll} items={routines} itemKey={routine => routine.id}
              itemLabel={routine => routine.title} onReorder={next => void reorderRoutines(next)}
              onDraggingChange={setDraggingRoutine} disabled={savingRoutine || reorderingRoutine}
              renderItem={(routine, _index, handle) => (
              <View style={styles.routineCard}>
                <View style={styles.routineCardHeader}>
                  {handle}
                  <View style={styles.routineCardCopy}>
                    <Text style={styles.cardEyebrow}>{sportLabels[routine.sport]}</Text>
                    <Text style={styles.cardTitle}>{routine.title}</Text>
                    <Text style={styles.routineMeta}>
                      {routine.items.length}개 항목 · 매일 표시
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${routine.title} 제거`}
                    disabled={savingRoutine || reorderingRoutine} style={styles.routineRemove}
                    onPress={() => setPendingDeleteRoutineId(routine.id)}>
                    <Text style={styles.deleteAction}>제거</Text>
                  </Pressable>
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
                </View>
              </View>
            )} />
            {routines.length === 0 ? (
              <Empty copy="저장한 루틴이 없습니다." styles={styles} />
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/profile/goals" as never)}
          style={styles.goalsShortcut}
        >
          <View style={styles.goalsShortcutCopy}>
            <Text style={styles.goalsShortcutEyebrow}>MY PRIVATE GOALS</Text>
            <Text style={styles.goalsShortcutTitle}>존중에서 시작한 목표</Text>
          </View>
          <Image
            source={require("../../assets/images/profile/keep-going-v1.png")}
            style={styles.keepGoingSticker}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.goalsShortcutArrow}><ArrowRight color="#FFFFFF" size={17} /></View>
        </Pressable>
        <View style={styles.settings}>
          <View>
            <Text style={styles.settingsTitle}>다크 모드</Text>
            <Text style={styles.settingsCopy}>앱 전체 화면 모드</Text>
          </View>
          <Pressable
            accessibilityLabel="다크 모드"
            accessibilityRole="switch"
            accessibilityState={{ checked: mode === "dark" }}
            onPress={() => setMode(mode === "dark" ? "light" : "dark")}
            style={styles.themeToggleTarget}
          >
            <View style={[styles.themeToggleTrack, mode === "dark" && styles.themeToggleTrackOn]}>
              <View style={[styles.themeToggleThumb, mode === "dark" && styles.themeToggleThumbOn]} />
            </View>
          </Pressable>
        </View>
        <Pressable hitSlop={4} onPress={() => router.push("/profile/account")} style={styles.accountButton}>
          <Text style={styles.accountText}>계정 · 보안 · 개인정보</Text>
          <ChevronRight color={colors.ink} size={16} strokeWidth={1.4} style={styles.accountChevron} />
        </Pressable>
        <Pressable hitSlop={5} onPress={() => void logout()} style={styles.logoutButton}>
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
    <Pressable hitSlop={{ top: 4, bottom: 4 }} onPress={onPress} style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function PostList({
  posts,
  onOpen,
  onCreate,
  styles,
}: {
  posts: FeedPost[];
  onOpen(): void;
  onCreate(): void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (posts.length === 0)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="첫 게시물 만들기" onPress={onCreate} style={styles.empty}>
        <Plus color={styles.emptyMark.color} size={30} strokeWidth={1.8} />
        <Text style={styles.emptyTitle}>공유한 게시물이 없습니다.</Text>
        <Text style={styles.emptyText}>오늘의 기록을 소소하게 이어보세요.</Text>
      </Pressable>
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
function createStyles(colors: ThemeColors, pageWidth = 430) {
  // Reference is 860px wide at 2x. Keep its five medal columns on phone widths.
  const medalWidth = (pageWidth - 30 - 28 - 32) / 5;
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: 430,
      alignSelf: "center",
      paddingHorizontal: 15,
      paddingTop: 14,
      paddingBottom: 17,
      gap: 0,
    },
    topBar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 6, minHeight: 36, marginBottom: 13 },
    brandWordmarkBox: { height: 23, justifyContent: "center" },
    myBadge: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.muted, borderRadius: 6, paddingHorizontal: 5, minHeight: 13, justifyContent: "center", marginBottom: 3 },
    myBadgeText: { color: colors.ink, fontFamily: fonts.display, fontSize: 8, lineHeight: 10, letterSpacing: 1 },
    profileMotto: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9, lineHeight: 13, marginTop: 3 },
    brand: { ...typography.wordmark(18), color: colors.primary },
    settingsButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    temporarySettingsMenu: {
      marginTop: 0,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.dialogRadius,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    temporarySettingsHeading: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    temporarySettingsEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 7,
      letterSpacing: 1.2,
    },
    temporarySettingsCaption: {
      marginTop: 3,
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 8,
    },
    temporarySettingsItem: {
      minHeight: 62,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    temporarySettingsTitle: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 11,
    },
    temporarySettingsDescription: {
      marginTop: 3,
      color: colors.muted,
      fontFamily: fonts.medium,
      fontSize: 8,
    },
    temporarySettingsArrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    identityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 6, minHeight: 72 },
    avatar: {
      width: 72,
      height: 72,
      flexShrink: 0,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    avatarImage: { width: 72, height: 72, borderRadius: radius.full },
    avatarText: { color: "#FFFFFF", fontSize: 28, fontFamily: fonts.bold },
    avatarEditBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarPlusDisc: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
    avatarPlusCross: { width: 8, height: 8, position: "relative" },
    avatarPlusHorizontal: { position: "absolute", left: 0, top: 3, width: 8, height: 2, backgroundColor: colors.primary },
    avatarPlusVertical: { position: "absolute", left: 3, top: 0, width: 2, height: 8, backgroundColor: colors.primary },
    identityCopy: { flex: 1, minWidth: 0, gap: 0 },
    displayName: { color: colors.ink, fontSize: 18, lineHeight: 23, fontFamily: fonts.bold, letterSpacing: -0.5 },
    editHint: { color: colors.primary, fontSize: 8, fontFamily: fonts.semibold, marginTop: 2 },
    email: { color: colors.ink, fontSize: 9, lineHeight: 13, fontFamily: fonts.regular, flexShrink: 1, marginTop: 1 },
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
    avatarMenuBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
    avatarMenuHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    avatarMenuClose: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    avatarMenu: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.panelRadius,
      padding: 16,
      gap: 16,
    },
    avatarMenuTitle: { color: colors.ink, fontSize: 17, fontFamily: fonts.bold },
    avatarMenuActions: { flexDirection: "row", gap: 8 },
    avatarMenuButton: {
      flex: 1,
      minHeight: 88,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.controlRadius,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarMenuButtonPressed: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    avatarMenuButtonText: { color: colors.ink, fontSize: 14, fontFamily: fonts.semibold },
    statsRow: {
      flexDirection: "row",
      borderRightWidth: 1,
      borderRightColor: colors.border,
      width: "68%",
      paddingVertical: 0,
      marginTop: 16,
      marginBottom: 20,
      marginLeft: 8,
    },
    stat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1, borderLeftWidth: 1, borderLeftColor: colors.border, minHeight: 36 },
    statValue: { ...typography.numeric(18), lineHeight: 22, color: colors.ink },
    statLabel: { color: colors.ink, fontSize: 10, lineHeight: 13, fontFamily: fonts.medium },
    goalsShortcut: {
      minHeight: 53,
      overflow: "hidden",
      marginTop: 8,
      marginHorizontal: 2,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "transparent",
      paddingHorizontal: 12,
      paddingVertical: 9,
      gap: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    goalsShortcutEyebrow: {
      color: colors.primary,
      fontSize: 8,
      lineHeight: 11,
      fontFamily: fonts.bold,
      letterSpacing: 0.8,
    },
    goalsShortcutTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontFamily: fonts.bold, marginTop: 3 },
    goalsShortcutArrow: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    goalsShortcutCopy: { flex: 1, paddingRight: 86 },
    // Oversized lettering deliberately bleeds below the card, as in the reference.
    keepGoingSticker: { position: "absolute", right: 44, bottom: -15, width: 92, height: 78 },
    sectionEyebrow: {
      color: colors.ink,
      fontSize: 7,
      lineHeight: 9,
      fontFamily: fonts.bold,
      letterSpacing: 1.4,
    },
    sectionTitle: { color: colors.ink, fontSize: 20, lineHeight: 23, fontFamily: fonts.bold, marginTop: 1 },
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
    medalCabinet: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 8, gap: 10, minHeight: 156, overflow: "hidden", backgroundColor: colors.background },
    medalBackdrop: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
    medalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    medalMore: { flexDirection: "row", gap: 7, alignItems: "center", minHeight: 30 },
    medalArrow: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    medalCount: { color: colors.ink, fontSize: 12, lineHeight: 16, fontFamily: fonts.display },
    medalRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
    medalRowExpanded: { flexWrap: "wrap", rowGap: 18 },
    medalItem: { width: medalWidth, alignItems: "center", gap: 1 },
    medalSphere: { width: Math.min(56, medalWidth) },
    medalProgressTrack: { width: "86%", height: 3, borderRadius: 2, backgroundColor: "#293033", overflow: "hidden", marginTop: 2, marginBottom: 4 },
    medalProgressFill: { height: "100%", borderRadius: 2 },
    medalName: {
      color: colors.ink,
      width: "100%",
      lineHeight: 11,
      textAlign: "center",
      fontSize: 9,
      fontWeight: "800",
    },
    medalProgress: { color: colors.ink, fontSize: 9, lineHeight: 12 },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: 2 },
    tabButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 27, paddingVertical: 5, position: "relative" },
    tabText: { color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
    tabTextActive: { color: colors.ink },
    tabUnderline: {
      position: "absolute",
      height: 2,
      backgroundColor: colors.primary,
      left: 12,
      right: 12,
      bottom: -1,
    },
    loading: { paddingVertical: 44 },
    error: { color: colors.primary, fontSize: 10, fontWeight: "700", lineHeight: 16 },
    contentSection: { gap: 9, marginTop: 17 },
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
    postGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 17 },
    postTile: {
      width: "48.5%",
      minHeight: 154,
      backgroundColor: colors.surface,
      borderRadius: uiLayout.panelRadius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      justifyContent: "space-between",
      ...shadows.card,
    },
    postSport: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
    postContent: { color: colors.ink, fontSize: 12, lineHeight: 19, fontWeight: "800" },
    postMeta: { color: "#A3A3A3", fontSize: 7 },
    networkGrid: { flexDirection: "row", gap: 12 },
    peopleColumn: {
      flex: 1,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.panelRadius,
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
      backgroundColor: colors.background,
      borderRadius: uiLayout.panelRadius,
      borderWidth: 1,
      borderColor: colors.border,
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
    routineSportRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    routineSportChip: {
      width: "31.8%",
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: uiLayout.controlRadius,
      backgroundColor: colors.surface,
    },
    routineSportChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    routineSportText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12 },
    routineSportTextActive: { color: "#FFFFFF" },
    routineInput: {
      minHeight: 44,
      color: colors.ink,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontSize: 13,
      fontWeight: "800",
    },
    routineDragRail: { alignItems: "center", alignSelf: "stretch", justifyContent: "center" },
    routineItemRemove: { position: "absolute", top: 0, right: 0, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    routineRemove: { alignSelf: "flex-start", minWidth: 36, minHeight: 36, alignItems: "flex-end", justifyContent: "center" },
    routineDraftItem: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      padding: 9,
      paddingRight: 34,
      borderRadius: uiLayout.panelRadius,
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
      borderRadius: uiLayout.controlRadius,
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
    iconAction: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, paddingHorizontal: 5 },
    actionDisabled: { color: colors.border },
    primaryButton: {
      minHeight: 43,
      borderRadius: uiLayout.controlRadius,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    buttonDisabled: { opacity: 0.5 },
    routineMessage: {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: uiLayout.panelRadius,
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
      borderRadius: uiLayout.panelRadius,
      padding: 14,
      gap: 11,
      backgroundColor: colors.background,
      ...shadows.card,
    },
    routineCardHeader: { flexDirection: "row", alignItems: "flex-start" },
    routineCardCopy: { flex: 1 },
    routineMeta: { color: colors.muted, fontSize: 8, marginTop: 4 },
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
      justifyContent: "center",
      minHeight: 125,
      paddingVertical: 20,
      paddingHorizontal: 12,
      gap: 5,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 17,
      marginHorizontal: 1,
    },
    emptyMark: { color: colors.primary, fontSize: 24, fontWeight: "300" },
    emptyTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, textAlign: "center", marginTop: 4 },
    emptyText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
      maxWidth: 280,
    },
    settings: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 0,
      paddingHorizontal: 12,
      minHeight: 44,
      marginTop: 12,
      marginBottom: 3,
    },
    settingsTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontFamily: fonts.bold },
    settingsCopy: { color: colors.ink, fontSize: 9, lineHeight: 13, marginTop: 2 },
    themeToggleTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    themeToggleTrack: { width: 36, height: 21, borderRadius: 11, backgroundColor: colors.border, justifyContent: "center", padding: 1 },
    themeToggleTrackOn: { backgroundColor: colors.primary },
    themeToggleThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: "#FFFFFF", alignSelf: "flex-start" },
    themeToggleThumbOn: { alignSelf: "flex-end" },
    accountButton: {
      minHeight: 37,
      marginHorizontal: 2,
      borderRadius: 0,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    accountText: { color: colors.ink, fontSize: 11, lineHeight: 16, fontFamily: fonts.bold },
    accountChevron: { position: "absolute", right: 12 },
    logoutButton: {
      minHeight: 33,
      marginTop: 11,
      marginHorizontal: 2,
      borderRadius: 0,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: { color: colors.background, fontSize: 11, lineHeight: 16, fontFamily: fonts.bold },
  });
}
