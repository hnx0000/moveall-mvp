import { useRouter } from "expo-router";
import { Activity, ChevronLeft, Download, ShieldCheck } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../src/auth/auth-context";
import { CenterDialog } from "../../src/components/ui";
import {
  createPlatformHealthAdapter,
  type WearableAvailability,
} from "../../src/features/wearables";
import {
  isHealthAutoSyncEnabled,
  setHealthAutoSyncEnabled,
  syncHealthData,
} from "../../src/features/wearables/health-sync";
import { fonts, maxContentWidth, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const providerLabels = {
  "apple-health": "Apple 건강 · HealthKit",
  "health-connect": "Android Health Connect",
  mock: "지원되지 않는 환경",
  garmin: "Garmin",
} as const;

function availabilityMessage(availability: WearableAvailability | null) {
  if (!availability) return "연결 상태를 확인하고 있습니다.";
  if (availability.available) return "이 기기에서 건강 기록 연결을 사용할 수 있습니다.";
  if (availability.reason === "native-build-required") {
    return "Expo Go에서는 사용할 수 없습니다. GROOV 네이티브 앱 빌드가 필요합니다.";
  }
  if (availability.reason === "provider-not-installed") {
    return "기기에 건강 데이터 제공 앱이 없거나 사용할 수 없는 상태입니다.";
  }
  return "웹에서는 건강 앱 기록을 가져올 수 없습니다. iOS 또는 Android 앱에서 연결해 주세요.";
}

export default function HealthConnectionScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const adapter = useMemo(() => createPlatformHealthAdapter(), []);
  const [availability, setAvailability] = useState<WearableAvailability | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void adapter.availability().then(setAvailability);
    void isHealthAutoSyncEnabled().then(setPermissionGranted);
  }, [adapter]);

  const connect = async () => {
    setBusy(true);
    try {
      const current = await adapter.availability();
      setAvailability(current);
      if (!current.available) {
        setNotice(availabilityMessage(current));
        return;
      }
      const granted = await adapter.requestPermission();
      setPermissionGranted(granted);
      await setHealthAutoSyncEnabled(granted);
      setNotice(
        granted
          ? "건강 기록 읽기·쓰기 권한이 연결되었습니다. 앱을 열 때 완료 운동을 양방향으로 자동 동기화합니다."
          : "일부 필수 읽기·쓰기 권한이 허용되지 않았습니다. 건강 앱의 GROOV 권한을 확인해 주세요.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "건강 앱을 연결하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const importWorkouts = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const current = await adapter.availability();
      setAvailability(current);
      if (!current.available) {
        setNotice(availabilityMessage(current));
        return;
      }
      const result = await syncHealthData(session.accessToken, adapter, { force: true });
      setNotice(
        result.imported + result.exported + result.duplicates === 0
          ? "최근 30일 동안 새로 동기화할 운동 기록이 없습니다."
          : `건강 앱 → GROOV ${result.imported}개, GROOV → 건강 앱 ${result.exported}개를 동기화했습니다.${result.duplicates ? ` 중복 ${result.duplicates}개는 건너뛰었습니다.` : ""}${result.failed ? ` ${result.failed}개는 처리하지 못했습니다.` : ""}`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "운동 기록을 가져오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={22} />
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HEALTH DATA HUB</Text>
          <Text style={styles.title}>건강 앱 · 웨어러블</Text>
          <Text style={styles.copy}>
            건강 앱과 GROOV의 완료 운동을 양방향으로 연결합니다. 최초 권한 승인 뒤에는 앱이 활성화될
            때 새 기록을 자동으로 맞춥니다.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.iconBox}>
            <Activity color={colors.primary} size={24} />
          </View>
          <View style={styles.statusText}>
            <Text style={styles.provider}>{providerLabels[adapter.provider]}</Text>
            <Text style={styles.statusCopy}>{availabilityMessage(availability)}</Text>
          </View>
          <View
            style={[
              styles.statusDot,
              availability?.available ? styles.statusDotReady : styles.statusDotOff,
            ]}
          />
        </View>

        <View style={styles.noticeCard}>
          <ShieldCheck color={colors.primary} size={19} />
          <Text style={styles.noticeCopy}>
            GROOV는 운동·심박·걸음·거리·칼로리·고도를 읽고, GROOV에서 완료한 운동·거리·칼로리는 건강
            앱에 저장합니다. Apple Watch와 Galaxy Watch가 건강 앱에 남긴 완료 기록도 이 경로로
            들어옵니다.
          </Text>
        </View>

        <Pressable
          disabled={busy}
          onPress={() => void connect()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>권한 확인 · 연결</Text>
          )}
        </Pressable>
        <Pressable
          disabled={busy || !availability?.available}
          onPress={() => void importWorkouts()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
            (busy || !availability?.available) && styles.disabled,
          ]}
        >
          <Download color={colors.ink} size={17} />
          <Text style={styles.secondaryText}>지금 양방향 동기화</Text>
        </Pressable>

        <Text style={styles.footnote}>
          {permissionGranted
            ? "권한 연결됨 · 앱 활성화 시 15분 간격으로 새 기록을 자동 동기화합니다."
            : "연결 전 · 승인하기 전에는 건강 데이터가 전송되지 않습니다."}
        </Text>
      </ScrollView>
      <CenterDialog
        visible={notice !== null}
        title="건강 앱 연결 안내"
        {...(notice ? { message: notice } : {})}
        onClose={() => setNotice(null)}
      />
    </SafeAreaView>
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
      gap: 14,
    },
    back: { width: 42, height: 42, justifyContent: "center" },
    hero: { gap: 8, marginBottom: 8 },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 29 },
    copy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 20 },
    statusCard: {
      minHeight: 96,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconBox: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    statusText: { flex: 1, gap: 5 },
    provider: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
    statusCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16 },
    statusDot: { width: 9, height: 9, borderRadius: 5 },
    statusDotReady: { backgroundColor: colors.primary },
    statusDotOff: { backgroundColor: colors.border },
    noticeCard: {
      borderRadius: 14,
      padding: 15,
      backgroundColor: colors.primarySoft,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    noticeCopy: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.medium,
      fontSize: 10,
      lineHeight: 17,
    },
    primaryButton: {
      minHeight: 54,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
    },
    primaryText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
    secondaryButton: {
      minHeight: 54,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    secondaryText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 13 },
    pressed: { opacity: 0.75 },
    disabled: { opacity: 0.38 },
    footnote: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
      lineHeight: 15,
      textAlign: "center",
    },
  });
}
