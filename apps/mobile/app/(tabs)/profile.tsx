import type { RoutineCreateInput, SportType } from "@moveall/contracts";
import { sportLabels } from "@moveall/contracts";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Card, PrimaryButton, Screen, SectionTitle, StatePanel } from "../../src/components/ui";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { spacing, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const routineSports: SportType[] = ["running", "strength", "swimming"];
const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
const publicDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "true";

export default function ProfileScreen() {
  const { session, restoring, login, register, logout } = useAuth();
  const { colors, mode, toggleMode } = useAppTheme();
  const styles = createStyles(colors);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (authMode === "register") await register({ email, password, displayName });
      else await login({ email, password });
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "인증 요청을 처리하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      title=""
      action={
        <Pressable
          accessibilityLabel="설정 안내"
          accessibilityRole="button"
          onPress={() => setSettingsOpen((current) => !current)}
          style={styles.gearButton}
        >
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      }
    >
      {publicDemoMode ? (
        <View style={styles.demoNotice}>
          <Text style={styles.demoNoticeTitle}>공개 MVP 데모</Text>
          <Text style={styles.demoNoticeText}>
            계정과 작성 내용은 운영 서버에 저장되지 않습니다.
          </Text>
        </View>
      ) : null}
      {settingsOpen ? (
        <Text style={styles.settingsNotice}>화면 설정과 루틴을 이곳에서 관리합니다.</Text>
      ) : null}

      {restoring ? <StatePanel state="loading" message="로그인 정보를 확인하고 있어요." /> : null}

      {!restoring && session ? (
        <>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{session.user.displayName.slice(0, 1)}</Text>
            </View>
            <View style={styles.userCopy}>
              <Text style={styles.name}>{session.user.displayName}</Text>
              <Text style={styles.email}>{session.user.email}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void logout()}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.settingCard}>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>다크 모드</Text>
          <Text style={styles.settingText}>
            {mode === "dark" ? "어두운 화면을 사용 중입니다." : "기본 화이트 화면을 사용 중입니다."}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="다크 모드 전환"
          accessibilityRole="switch"
          accessibilityState={{ checked: mode === "dark" }}
          onPress={toggleMode}
          style={[styles.themeSwitch, mode === "dark" && styles.themeSwitchActive]}
        >
          <View style={[styles.themeThumb, mode === "dark" && styles.themeThumbActive]} />
        </Pressable>
      </View>

      <View style={styles.divider} />

      {!restoring && session ? (
        <RoutineManager token={session.accessToken} colors={colors} />
      ) : null}

      {!restoring && !session ? (
        <Card>
          <Text style={styles.authTitle}>
            {authMode === "register" ? "MoveAll 시작하기" : "다시 오신 것을 환영해요"}
          </Text>
          <Text style={styles.authSubtitle}>운동 기록과 루틴을 저장하려면 계정이 필요합니다.</Text>
          {authMode === "register" ? (
            <TextInput
              accessibilityLabel="표시 이름"
              autoCapitalize="none"
              maxLength={30}
              placeholder="표시 이름"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
          ) : null}
          <TextInput
            accessibilityLabel="이메일"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="이메일"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            accessibilityLabel="비밀번호"
            autoCapitalize="none"
            autoComplete={authMode === "register" ? "new-password" : "current-password"}
            placeholder="비밀번호 12자 이상, 영문과 숫자 포함"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton
            label={submitting ? "처리 중..." : authMode === "register" ? "계정 만들기" : "로그인"}
            disabled={
              submitting ||
              !email ||
              !password ||
              (authMode === "register" && displayName.trim().length < 2)
            }
            onPress={() => void submit()}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAuthMode(authMode === "register" ? "login" : "register");
              setError(null);
            }}
            style={styles.authSwitch}
          >
            <Text style={styles.authSwitchText}>
              {authMode === "register" ? "이미 계정이 있나요? 로그인" : "처음인가요? 계정 만들기"}
            </Text>
          </Pressable>
        </Card>
      ) : null}
    </Screen>
  );
}

function RoutineManager({ token, colors }: { token: string; colors: ThemeColors }) {
  const styles = createStyles(colors);
  const loader = useCallback(() => api.routines(token), [token]);
  const { data: routines, error, loading, reload } = useAsyncData(loader);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("나의 주 3회 루틴");
  const [sport, setSport] = useState<SportType>("running");
  const [days, setDays] = useState<number[]>([2, 4, 6]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    );
  }

  async function saveRoutine() {
    if (!title.trim() || days.length === 0) return;
    const itemsBySport: Record<SportType, RoutineCreateInput["items"]> = {
      running: [
        { name: "워밍업 걷기", target: "5분", order: 0 },
        { name: "편안한 러닝", target: "20분", order: 1 },
        { name: "쿨다운", target: "5분", order: 2 },
      ],
      strength: [
        { name: "전신 워밍업", target: "5분", order: 0 },
        { name: "기본 전신 운동", target: "30분", order: 1 },
        { name: "정리 운동", target: "5분", order: 2 },
      ],
      swimming: [
        { name: "자유형 워밍업", target: "200m", order: 0 },
        { name: "편안한 지속 수영", target: "20분", order: 1 },
        { name: "쿨다운", target: "100m", order: 2 },
      ],
      hiking: [],
      diving: [],
      cycling: [],
    };
    setSaving(true);
    setSaveError(null);
    try {
      await api.createRoutine(token, {
        title: title.trim(),
        sport,
        daysOfWeek: days,
        items: itemsBySport[sport],
      });
      setShowForm(false);
      await reload();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "루틴을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View style={styles.sectionRow}>
        <SectionTitle>내 루틴</SectionTitle>
        <Pressable accessibilityRole="button" onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addRoutine}>{showForm ? "취소" : "+ 새 루틴"}</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionHelp}>홈에는 오늘 실행할 루틴만 표시됩니다.</Text>
      {showForm ? (
        <Card>
          <TextInput
            accessibilityLabel="루틴 이름"
            maxLength={80}
            onChangeText={setTitle}
            placeholder="루틴 이름"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={title}
          />
          <Text style={styles.fieldLabel}>운동</Text>
          <View style={styles.choiceRow}>
            {routineSports.map((item) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: sport === item }}
                key={item}
                onPress={() => setSport(item)}
                style={[styles.choice, sport === item && styles.choiceActive]}
              >
                <Text style={[styles.choiceText, sport === item && styles.choiceTextActive]}>
                  {sportLabels[item]}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>반복 요일</Text>
          <View style={styles.dayRow}>
            {dayLabels.map((label, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: days.includes(index) }}
                key={label}
                onPress={() => toggleDay(index)}
                style={[styles.day, days.includes(index) && styles.dayActive]}
              >
                <Text style={[styles.dayText, days.includes(index) && styles.dayTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
          <PrimaryButton
            label={saving ? "저장 중..." : "홈 루틴으로 저장"}
            disabled={saving || !title.trim() || days.length === 0}
            onPress={() => void saveRoutine()}
          />
        </Card>
      ) : null}
      {loading ? <StatePanel state="loading" message="루틴을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {routines?.length === 0 && !showForm ? (
        <StatePanel state="empty" message="아직 저장한 루틴이 없어요. 새 루틴을 만들어 보세요." />
      ) : null}
      {routines?.map((routine) => (
        <Card key={routine.id}>
          <View style={styles.savedRoutineHeader}>
            <View>
              <Text style={styles.savedRoutineSport}>{sportLabels[routine.sport]}</Text>
              <Text style={styles.savedRoutineTitle}>{routine.title}</Text>
            </View>
            <Text style={styles.savedRoutineDays}>주 {routine.daysOfWeek.length}회</Text>
          </View>
          <Text style={styles.savedRoutineItems}>
            {routine.items.map((item) => item.name).join(" · ")}
          </Text>
        </Card>
      ))}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    gearButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    gearIcon: { color: colors.ink, fontSize: 20 },
    settingsNotice: { color: colors.primary, fontSize: 10, marginTop: -8 },
    demoNotice: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 7,
      backgroundColor: colors.primarySoft,
      padding: 10,
    },
    demoNoticeTitle: { color: colors.primary, fontSize: 11, fontWeight: "900" },
    demoNoticeText: { color: colors.muted, fontSize: 9, marginTop: 3 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
    settingCard: {
      minHeight: 64,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    settingCopy: { flex: 1 },
    settingTitle: { color: colors.ink, fontWeight: "900", fontSize: 16 },
    settingText: { color: colors.muted, fontSize: 11, marginTop: 4 },
    themeSwitch: {
      width: 44,
      height: 26,
      borderRadius: 13,
      padding: 3,
      backgroundColor: colors.border,
      justifyContent: "center",
    },
    themeSwitchActive: { backgroundColor: colors.primary },
    themeThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
    },
    themeThumbActive: { alignSelf: "flex-end" },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
    userCopy: { flex: 1 },
    name: { color: colors.ink, fontWeight: "900", fontSize: 19 },
    email: { color: colors.muted, marginTop: 4, fontSize: 10 },
    logoutButton: {
      minHeight: 47,
      borderRadius: 7,
      backgroundColor: colors.hero,
      alignItems: "center",
      justifyContent: "center",
    },
    logoutText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
    authTitle: { color: colors.ink, fontWeight: "900", fontSize: 21 },
    authSubtitle: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 4,
      marginBottom: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      color: colors.ink,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      paddingVertical: 13,
      marginBottom: spacing.sm,
    },
    error: { color: colors.danger, lineHeight: 20, marginBottom: spacing.sm, fontSize: 11 },
    authSwitch: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
    },
    authSwitchText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
    sectionRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    addRoutine: { color: colors.primary, fontWeight: "900", fontSize: 12 },
    sectionHelp: { color: colors.muted, fontSize: 10, marginTop: -10 },
    fieldLabel: { color: colors.ink, fontWeight: "900", fontSize: 12, marginBottom: spacing.xs },
    choiceRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
    choice: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      alignItems: "center",
    },
    choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    choiceText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
    choiceTextActive: { color: "#FFFFFF" },
    dayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
    day: {
      width: 37,
      height: 37,
      borderRadius: 19,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    dayActive: { backgroundColor: colors.primary },
    dayText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    dayTextActive: { color: "#FFFFFF" },
    savedRoutineHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    savedRoutineSport: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    savedRoutineTitle: { color: colors.ink, fontWeight: "900", fontSize: 16, marginTop: 3 },
    savedRoutineDays: {
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      fontWeight: "900",
      fontSize: 10,
    },
    savedRoutineItems: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  });
}
