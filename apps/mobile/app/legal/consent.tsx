import { useRouter } from "expo-router";
import { Check, ChevronLeft } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import {
  cancelHealthSync,
  isHealthSyncAccount,
  setHealthAutoSyncEnabled,
} from "../../src/features/wearables/health-sync";
import { CenterDialog } from "../../src/components/ui";
import { POLICY_VERSION } from "../../src/legal/policies";
import { fonts, maxContentWidth, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type OptionalConsent =
  "healthDataAccepted" | "locationAccepted" | "mediaAccepted" | "marketingAccepted";

export default function ConsentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [options, setOptions] = useState<Record<OptionalConsent, boolean>>({
    healthDataAccepted: false,
    locationAccepted: false,
    mediaAccepted: false,
    marketingAccepted: false,
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const generation = useRef(0);

  useEffect(() => {
    const revision = ++generation.current;
    const userId = sessionRef.current?.user.id;
    setLoadedFor(null);
    setBusy(false);
    setSaved(false);
    setNotice(null);
    setOptions({
      healthDataAccepted: false,
      locationAccepted: false,
      mediaAccepted: false,
      marketingAccepted: false,
    });
    if (!userId) return;
    const current = () => generation.current === revision && sessionRef.current?.user.id === userId;
    void api
      .consent(sessionRef.current!.accessToken)
      .then((consent) => {
        if (!current()) return;
        setOptions({
          healthDataAccepted: consent?.healthDataAccepted ?? false,
          locationAccepted: consent?.locationAccepted ?? false,
          mediaAccepted: consent?.mediaAccepted ?? false,
          marketingAccepted: consent?.marketingAccepted ?? false,
        });
        setLoadedFor(userId);
      })
      .catch((error: unknown) => {
        if (current())
          setNotice(
            error instanceof Error
              ? error.message
              : "동의 설정을 불러오지 못했습니다. 다시 열어 주세요.",
          );
      });
    return () => {
      generation.current++;
    };
  }, [session?.user.id]);

  const save = async () => {
    if (!session || busy || loadedFor !== session.user.id) return;
    const userId = session.user.id;
    const revision = generation.current;
    const current = () =>
      generation.current === revision &&
      sessionRef.current?.user.id === userId &&
      isHealthSyncAccount(userId);
    setBusy(true);
    try {
      if (!options.healthDataAccepted) {
        cancelHealthSync(session.user.id);
        await setHealthAutoSyncEnabled(false, session.user.id);
      }
      if (!current()) return;
      await api.updateConsent(sessionRef.current!.accessToken, {
        termsVersion: POLICY_VERSION,
        privacyVersion: POLICY_VERSION,
        termsAccepted: true,
        privacyAccepted: true,
        ...options,
      });
      if (current()) setSaved(true);
    } catch (error) {
      if (current())
        setNotice(error instanceof Error ? error.message : "동의 설정을 저장하지 못했습니다.");
    } finally {
      if (current()) setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={22} />
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>DATA CONTROL</Text>
          <Text style={styles.title}>동의 및 데이터 설정</Text>
          <Text style={styles.copy}>필수 약관과 선택 권한을 목적별로 따로 관리합니다.</Text>
        </View>
        <ConsentRow
          label="이용약관"
          description={`${POLICY_VERSION} 버전 · 필수`}
          enabled
          locked
          styles={styles}
        />
        <ConsentRow
          label="개인정보 처리방침"
          description={`${POLICY_VERSION} 버전 · 필수`}
          enabled
          locked
          styles={styles}
        />
        <ConsentRow
          label="운동·건강정보"
          description="심박, 걸음, 완료 운동 양방향 동기화"
          enabled={options.healthDataAccepted}
          locked={busy || loadedFor !== session?.user.id}
          onPress={() => setOptions((v) => ({ ...v, healthDataAccepted: !v.healthDataAccepted }))}
          styles={styles}
        />
        <ConsentRow
          label="운동 중 위치"
          description="운동 중 GPS 경로·거리·고도, 백그라운드 기록"
          enabled={options.locationAccepted}
          locked={busy || loadedFor !== session?.user.id}
          onPress={() => setOptions((v) => ({ ...v, locationAccepted: !v.locationAccepted }))}
          styles={styles}
        />
        <ConsentRow
          label="사진·영상"
          description="프로필과 운동 인증 미디어"
          enabled={options.mediaAccepted}
          locked={busy || loadedFor !== session?.user.id}
          onPress={() => setOptions((v) => ({ ...v, mediaAccepted: !v.mediaAccepted }))}
          styles={styles}
        />
        <ConsentRow
          label="마케팅 알림"
          description="혜택·이벤트 소식 · 선택"
          enabled={options.marketingAccepted}
          locked={busy || loadedFor !== session?.user.id}
          onPress={() => setOptions((v) => ({ ...v, marketingAccepted: !v.marketingAccepted }))}
          styles={styles}
        />
        <Pressable
          disabled={busy || !loadedFor || loadedFor !== session?.user.id}
          onPress={() => void save()}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>{busy ? "저장 중" : "선택 저장"}</Text>
        </Pressable>
      </ScrollView>
      <CenterDialog
        visible={notice !== null}
        title="동의 설정 확인"
        {...(notice ? { message: notice } : {})}
        onClose={() => setNotice(null)}
      />
      <CenterDialog
        visible={saved}
        title="동의 설정 저장 완료"
        message="선택한 데이터 권한이 반영되었습니다."
        onClose={() => setSaved(false)}
      />
    </SafeAreaView>
  );
}

function ConsentRow({
  label,
  description,
  enabled,
  locked = false,
  onPress,
  styles,
}: {
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onPress?: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable disabled={locked} onPress={onPress} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <View style={[styles.check, enabled && styles.checkActive]}>
        {enabled ? <Check color="#FFFFFF" size={15} strokeWidth={3} /> : null}
      </View>
    </Pressable>
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
      paddingVertical: 18,
      gap: 12,
    },
    back: { width: 42, height: 42, justifyContent: "center" },
    hero: { gap: 7, marginBottom: 12 },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 28 },
    copy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19 },
    row: {
      minHeight: 76,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 14,
    },
    rowText: { flex: 1, gap: 4 },
    rowTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    rowDescription: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    saveButton: {
      minHeight: 54,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
    },
    saveText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 14 },
  });
}
