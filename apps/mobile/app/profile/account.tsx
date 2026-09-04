import type { AccountSession } from "@moveall/contracts";
import { useRouter } from "expo-router";
import { Activity, ChevronLeft, LockKeyhole, ShieldCheck, Trash2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { CenterDialog } from "../../src/components/ui";
import { fonts, maxContentWidth, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";
import { postWorkoutSettings } from "../../src/post-workout-settings";

export default function AccountScreen() {
  const router = useRouter();
  const { session, replaceSession, logout } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [postPrompt, setPostPrompt] = useState(true);
  const [postPromptBusy, setPostPromptBusy] = useState(true);
  useEffect(() => {
    let active = true;
    setPostPromptBusy(true);
    if (!session)
      return () => {
        active = false;
      };
    void postWorkoutSettings.read(session.user.id).then((enabled) => {
      if (active) {
        setPostPrompt(enabled);
        setPostPromptBusy(false);
      }
    });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  async function changePostPrompt(enabled: boolean) {
    if (!session || postPromptBusy) return;
    setPostPromptBusy(true);
    try {
      await postWorkoutSettings.write(session.user.id, enabled);
      setPostPrompt(enabled);
    } catch {
      setNotice("게시 안내 설정을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setPostPromptBusy(false);
    }
  }
  const isAdmin = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .includes(session?.user.email.toLowerCase() ?? "");

  const loadSessions = async () => {
    if (session) setSessions(await api.accountSessions(session.accessToken));
  };
  useEffect(() => {
    void loadSessions();
  }, [session]);

  const changePassword = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const next = await api.changePassword(session.accessToken, { currentPassword, newPassword });
      await replaceSession(next);
      setCurrentPassword("");
      setNewPassword("");
      setNotice("비밀번호가 변경되고 다른 로그인 세션이 종료되었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (item: AccountSession) => {
    if (!session || item.current) return;
    await api.revokeAccountSession(session.accessToken, item.id);
    await loadSessions();
  };

  const deleteAccount = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await api.deleteAccount(session.accessToken, {
        confirmation: "GROOV 탈퇴",
        ...(deletePassword ? { currentPassword: deletePassword } : {}),
      });
      setDeleteOpen(false);
      await logout();
    } catch (error) {
      setDeleteOpen(false);
      setNotice(error instanceof Error ? error.message : "계정을 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={22} />
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ACCOUNT SECURITY</Text>
          <Text style={styles.title}>계정 및 보안</Text>
          <Text style={styles.copy}>로그인 세션, 비밀번호와 계정 삭제를 한곳에서 관리합니다.</Text>
        </View>

        <Pressable onPress={() => router.push("./privacy")} style={styles.sessionRow}>
          <Text style={styles.rowTitle}>공개 범위 · 차단 목록 · 제한 목록 →</Text>
        </Pressable>
        <View style={styles.sessionRow}>
          <View style={styles.sessionText}>
            <Text style={styles.rowTitle}>운동 저장 후 게시 안내</Text>
            <Text style={styles.rowCopy}>
              기본 켜짐 · 끄면 기록만 저장하고 끝납니다. 이 기기의 현재 계정에 적용됩니다.
            </Text>
          </View>
          <Switch
            accessibilityLabel="운동 저장 후 게시 안내"
            value={postPrompt}
            disabled={postPromptBusy}
            onValueChange={(enabled) => void changePostPrompt(enabled)}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
        <SectionTitle
          icon={<ShieldCheck color={colors.primary} size={18} />}
          title="로그인 세션"
          styles={styles}
        />
        {sessions.map((item) => (
          <View key={item.id} style={styles.sessionRow}>
            <View style={styles.sessionText}>
              <Text style={styles.rowTitle}>{item.current ? "현재 기기" : "다른 로그인"}</Text>
              <Text style={styles.rowCopy}>
                최근 사용 {new Date(item.lastSeenAt).toLocaleString("ko-KR")}
              </Text>
            </View>
            {item.current ? (
              <Text style={styles.currentBadge}>CURRENT</Text>
            ) : (
              <Pressable onPress={() => void revoke(item)}>
                <Text style={styles.revokeText}>종료</Text>
              </Pressable>
            )}
          </View>
        ))}

        <SectionTitle
          icon={<LockKeyhole color={colors.primary} size={18} />}
          title="비밀번호 변경"
          styles={styles}
        />
        <TextInput
          secureTextEntry
          placeholder="현재 비밀번호"
          placeholderTextColor={colors.muted}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.input}
        />
        <TextInput
          secureTextEntry
          placeholder="새 비밀번호 · 12자 이상, 영문+숫자"
          placeholderTextColor={colors.muted}
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
        />
        <Pressable
          disabled={busy || !currentPassword || newPassword.length < 12}
          onPress={() => void changePassword()}
          style={[
            styles.primaryButton,
            (busy || !currentPassword || newPassword.length < 12) && styles.disabled,
          ]}
        >
          <Text style={styles.primaryText}>비밀번호 변경</Text>
        </Pressable>

        <View style={styles.linkGroup}>
          <Pressable onPress={() => router.push("/profile/health" as never)} style={styles.linkRow}>
            <View style={styles.linkLabel}>
              <Activity color={colors.primary} size={17} />
              <Text style={styles.rowTitle}>건강 앱 · 웨어러블 기록</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/privacy")} style={styles.linkRow}>
            <Text style={styles.rowTitle}>개인정보 처리방침</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/terms")} style={styles.linkRow}>
            <Text style={styles.rowTitle}>이용약관</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/consent")} style={styles.linkRow}>
            <Text style={styles.rowTitle}>동의 및 데이터 설정</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/legal/account-deletion" as never)}
            style={styles.linkRow}
          >
            <Text style={styles.rowTitle}>계정 삭제 안내</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/legal/support" as never)} style={styles.linkRow}>
            <Text style={styles.rowTitle}>지원 및 문의</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {isAdmin ? (
            <>
              <Pressable
                onPress={() => router.push("/profile/moderation" as never)}
                style={styles.linkRow}
              >
                <Text style={styles.rowTitle}>운영 신고 관리</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/profile/product-insights")}
                style={styles.linkRow}
              >
                <Text style={styles.rowTitle}>사용 목적 통계</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        <SectionTitle
          icon={<Trash2 color={colors.primary} size={18} />}
          title="계정 삭제"
          styles={styles}
        />
        <Text style={styles.warning}>
          탈퇴하면 운동 기록, 루틴, 게시물, 댓글, 관계와 업로드 미디어가 삭제됩니다.
        </Text>
        <TextInput
          placeholder="GROOV 탈퇴 입력"
          placeholderTextColor={colors.muted}
          value={deletePhrase}
          onChangeText={setDeletePhrase}
          style={styles.input}
        />
        <TextInput
          secureTextEntry
          placeholder="비밀번호 계정만 현재 비밀번호 입력"
          placeholderTextColor={colors.muted}
          value={deletePassword}
          onChangeText={setDeletePassword}
          style={styles.input}
        />
        <Pressable
          disabled={deletePhrase !== "GROOV 탈퇴"}
          onPress={() => setDeleteOpen(true)}
          style={[styles.deleteButton, deletePhrase !== "GROOV 탈퇴" && styles.disabled]}
        >
          <Text style={styles.deleteText}>계정 영구 삭제</Text>
        </Pressable>
      </ScrollView>
      <CenterDialog
        visible={deleteOpen}
        eyebrow="FINAL CONFIRMATION"
        title="정말 계정을 삭제할까요?"
        message="삭제 후에는 되돌릴 수 없습니다."
        confirmLabel="삭제"
        busy={busy}
        danger
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteAccount()}
      />
      <CenterDialog
        visible={notice !== null}
        title="계정 안내"
        {...(notice ? { message: notice } : {})}
        onClose={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

function SectionTitle({
  icon,
  title,
  styles,
}: {
  icon: ReactNode;
  title: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      {icon}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: maxContentWidth,
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 64,
      gap: 12,
    },
    back: { width: 42, height: 42, justifyContent: "center" },
    hero: { gap: 7, marginBottom: 14 },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 30 },
    copy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    sessionRow: {
      minHeight: 68,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sessionText: { gap: 4 },
    rowTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    rowCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
    currentBadge: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1,
    },
    revokeText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      color: colors.ink,
      fontFamily: fonts.medium,
      fontSize: 12,
      paddingHorizontal: 15,
      backgroundColor: colors.surface,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
    disabled: { opacity: 0.35 },
    linkGroup: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      overflow: "hidden",
      marginTop: 16,
    },
    linkRow: {
      minHeight: 54,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    linkLabel: { flexDirection: "row", alignItems: "center", gap: 9 },
    chevron: { color: colors.muted, fontSize: 22 },
    warning: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 18 },
    deleteButton: {
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    deleteText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  });
}
