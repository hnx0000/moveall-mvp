import type { ContentReport, ModerationReportUpdateInput } from "@moveall/contracts";
import { useRouter } from "expo-router";
import { ChevronLeft, ShieldCheck } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError, api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { fonts, maxContentWidth, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

const statusLabels: Record<ContentReport["status"], string> = {
  open: "접수",
  reviewing: "검토 중",
  resolved: "조치 완료",
  dismissed: "종결",
};

export default function ModerationScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setReports(await api.moderationReports(session.accessToken));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "신고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (report: ContentReport, status: ModerationReportUpdateInput["status"]) => {
    if (!session) return;
    setBusyId(report.id);
    setError(null);
    try {
      const updated = await api.updateModerationReport(session.accessToken, report.id, { status });
      setReports((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "신고 상태를 변경하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={22} />
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MODERATION DESK</Text>
          <Text style={styles.title}>운영 신고 관리</Text>
          <Text style={styles.copy}>접수된 신고를 검토하고 처리 상태를 기록합니다.</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && reports.length === 0 ? (
          <View style={styles.empty}>
            <ShieldCheck color={colors.primary} size={24} />
            <Text style={styles.emptyText}>현재 접수된 신고가 없습니다.</Text>
          </View>
        ) : null}
        {reports.map((report) => (
          <View key={report.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.target}>{report.targetType.toUpperCase()}</Text>
              <Text style={styles.status}>{statusLabels[report.status]}</Text>
            </View>
            <Text style={styles.reason}>{report.reason}</Text>
            <Text style={styles.details}>{report.details ?? "추가 설명 없음"}</Text>
            <Text style={styles.meta}>{new Date(report.createdAt).toLocaleString("ko-KR")}</Text>
            <View style={styles.actions}>
              <Action
                disabled={busyId === report.id}
                label="검토 중"
                onPress={() => void update(report, "reviewing")}
                styles={styles}
              />
              <Action
                disabled={busyId === report.id}
                label="조치 완료"
                onPress={() => void update(report, "resolved")}
                primary
                styles={styles}
              />
              <Action
                disabled={busyId === report.id}
                label="종결"
                onPress={() => void update(report, "dismissed")}
                styles={styles}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({
  disabled,
  label,
  onPress,
  primary = false,
  styles,
}: {
  disabled: boolean;
  label: string;
  onPress(): void;
  primary?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, primary && styles.actionPrimary, disabled && styles.disabled]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
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
      padding: space[5],
      paddingBottom: 64,
      gap: 12,
    },
    back: { width: 42, height: 42, justifyContent: "center" },
    hero: { gap: 7, marginBottom: 10 },
    eyebrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.3 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 28 },
    copy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 19 },
    error: { color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
    empty: {
      minHeight: 180,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    emptyText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: 16,
      gap: 8,
      backgroundColor: colors.surface,
    },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    target: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 },
    status: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    reason: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    details: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
    meta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8 },
    actions: { flexDirection: "row", gap: 6, marginTop: 4 },
    action: {
      flex: 1,
      minHeight: 38,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    actionPrimary: { borderColor: colors.primary, backgroundColor: colors.primary },
    actionText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 9 },
    actionTextPrimary: { color: "#FFFFFF" },
    disabled: { opacity: 0.45 },
  });
}
