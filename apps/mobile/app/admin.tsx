import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  deliveryStatusLabels,
  featureAudits,
  gapAudits,
  pageAudits,
  type AuditPriority,
  type DeliveryStatus,
  type PageAudit,
} from "../src/admin/audit-catalog";
import {
  createRunningDiagnostics,
  runDiagnostics,
  type DiagnosticResult,
  type DiagnosticState,
} from "../src/admin/diagnostics";
import { useAuth } from "../src/auth/auth-context";
import { type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const recommendationSteps = [
  {
    order: "01",
    title: "기록을 진짜 데이터로 닫기",
    copy: "GPS·수동 기록을 workout-session에 저장하고, 저장 성공을 포인트 지급의 기준으로 만듭니다.",
  },
  {
    order: "02",
    title: "인증샷을 공유 가능한 자산으로",
    copy: "임시 사진 URI 대신 업로드·썸네일·합성 메타데이터를 저장해 다른 사용자도 동일한 스토리를 보게 합니다.",
  },
  {
    order: "03",
    title: "신뢰를 제품 기능으로",
    copy: "바이블에 전문가 승인, 개정 이력, 신고와 모더레이션을 넣어 안전 정보를 운영 가능한 구조로 만듭니다.",
  },
  {
    order: "04",
    title: "그다음 워치와 성장 기능",
    copy: "기록 저장률과 4주 유지율을 확인한 뒤 워치, 크루, 보상, 커머스 순서로 확장합니다.",
  },
];

export default function AdminScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isWide = width >= 920;
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>(createRunningDiagnostics());
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const runAllChecks = useCallback(async () => {
    setDiagnostics(createRunningDiagnostics());
    const results = await runDiagnostics(session?.accessToken ?? null);
    setDiagnostics(results);
    setLastCheckedAt(new Date());
  }, [session?.accessToken]);

  useEffect(() => {
    void runAllChecks();
  }, [runAllChecks]);

  const pageScore = Math.round(
    pageAudits.reduce((total, page) => total + page.score, 0) / pageAudits.length,
  );
  const passCount = diagnostics.filter((item) => item.state === "pass").length;
  const failCount = diagnostics.filter((item) => item.state === "fail").length;
  const blockedCount = diagnostics.filter((item) => item.state === "blocked").length;
  const running = diagnostics.some((item) => item.state === "running");

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>MOVEALL</Text>
            <Text style={styles.adminLabel}>PRODUCT CONTROL</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/profile")}
            style={styles.exitButton}
          >
            <Text style={styles.exitText}>내 정보로</Text>
          </Pressable>
        </View>

        <View style={[styles.hero, isWide && styles.heroWide]}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>MVP OPERATIONS BOARD</Text>
            <Text style={styles.heroTitle}>지금 작동하는 것과{`\n`}비어 있는 것을 한눈에.</Text>
            <Text style={styles.heroText}>
              화면 응답과 API를 자동 검사하고, 코드 기준 완성도·남은 공백·추천 구현 순서를 함께
              보여줍니다.
            </Text>
          </View>
          <View style={styles.heroScore}>
            <Text style={styles.heroScoreValue}>{pageScore}</Text>
            <Text style={styles.heroScoreUnit}>/ 100</Text>
            <Text style={styles.heroScoreLabel}>현재 MVP 구조 완성도</Text>
          </View>
        </View>

        <View style={styles.securityNotice}>
          <Text style={styles.securityNoticeLabel}>DEV ONLY</Text>
          <Text style={styles.securityNoticeText}>
            현재는 개발 진단 화면입니다. 운영 배포 전 서버 기반 관리자 역할 검사가 반드시
            필요합니다.
          </Text>
        </View>

        <View style={styles.statGrid}>
          <StatCard
            label="관리 화면"
            value={`${pageAudits.length}`}
            meta="전체 페이지"
            styles={styles}
          />
          <StatCard
            label="자동 검사"
            value={`${passCount}/${diagnostics.length}`}
            meta={running ? "검사 중" : "통과"}
            styles={styles}
          />
          <StatCard
            label="즉시 수정"
            value={`${gapAudits.filter((gap) => gap.priority === "P0").length}`}
            meta="P0 항목"
            styles={styles}
          />
          <StatCard
            label="실행 상태"
            value={failCount ? "ISSUE" : running ? "CHECK" : "LIVE"}
            meta={blockedCount ? `${blockedCount}개 조건부` : "연결 정상"}
            styles={styles}
          />
        </View>

        <SectionHeading
          eyebrow="LIVE DIAGNOSTICS"
          title="기능 작동 검사"
          meta={lastCheckedAt ? `${formatTime(lastCheckedAt)} 마지막 검사` : "첫 검사 준비 중"}
          action={
            <Pressable
              accessibilityRole="button"
              disabled={running}
              onPress={() => void runAllChecks()}
              style={[styles.refreshButton, running && styles.refreshButtonDisabled]}
            >
              <Text style={styles.refreshText}>{running ? "검사 중" : "전체 다시 검사"}</Text>
            </Pressable>
          }
          styles={styles}
        />

        <View style={[styles.diagnosticGrid, isWide && styles.diagnosticGridWide]}>
          {diagnostics.map((item) => (
            <DiagnosticRow key={item.id} result={item} styles={styles} />
          ))}
        </View>

        <SectionHeading
          eyebrow="PAGE MAP"
          title="페이지별 현황"
          meta="화면을 열어 직접 확인할 수 있습니다."
          styles={styles}
        />

        <View style={styles.pageGrid}>
          {pageAudits.map((page) => (
            <PageCard
              isWide={isWide}
              key={page.id}
              onOpen={() => router.push(page.route)}
              page={page}
              styles={styles}
            />
          ))}
        </View>

        <SectionHeading
          eyebrow="FEATURE MATRIX"
          title="기능별 실제 상태"
          meta="작동 방식과 남은 공백을 분리했습니다."
          styles={styles}
        />

        <View style={styles.matrix}>
          {featureAudits.map((feature) => (
            <View key={feature.id} style={[styles.matrixRow, isWide && styles.matrixRowWide]}>
              <View style={styles.matrixTitleRow}>
                <StatusBadge status={feature.status} styles={styles} />
                <Text style={styles.matrixArea}>{feature.area}</Text>
              </View>
              <Text style={styles.matrixBehavior}>{feature.behavior}</Text>
              <Text style={styles.matrixGap}>{feature.gap}</Text>
            </View>
          ))}
        </View>

        <SectionHeading
          eyebrow="GAP QUEUE"
          title="수정이 필요한 곳"
          meta="P0부터 처리하면 제품 루프가 닫힙니다."
          styles={styles}
        />

        <View style={styles.gapList}>
          {gapAudits.map((gap) => (
            <View key={gap.id} style={styles.gapCard}>
              <View style={styles.gapTop}>
                <PriorityBadge priority={gap.priority} styles={styles} />
                <Text style={styles.gapArea}>{gap.area}</Text>
              </View>
              <Text style={styles.gapTitle}>{gap.title}</Text>
              <Text style={styles.gapEvidence}>{gap.evidence}</Text>
              <View style={styles.recommendBox}>
                <Text style={styles.recommendLabel}>RECOMMEND</Text>
                <Text style={styles.recommendText}>{gap.recommendation}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionHeading
          eyebrow="NEXT DIRECTION"
          title="추천 개발 순서"
          meta="기능 수보다 신뢰 가능한 반복 사용 루프가 우선입니다."
          styles={styles}
        />

        <View style={styles.roadmap}>
          {recommendationSteps.map((step) => (
            <View key={step.order} style={styles.roadmapItem}>
              <Text style={styles.roadmapOrder}>{step.order}</Text>
              <View style={styles.roadmapCopy}>
                <Text style={styles.roadmapTitle}>{step.title}</Text>
                <Text style={styles.roadmapText}>{step.copy}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  meta,
  styles,
}: {
  label: string;
  value: string;
  meta: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statMeta}>{meta}</Text>
    </View>
  );
}

function SectionHeading({
  eyebrow,
  title,
  meta,
  action,
  styles,
}: {
  eyebrow: string;
  title: string;
  meta: string;
  action?: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionMeta}>{meta}</Text>
      </View>
      {action}
    </View>
  );
}

function DiagnosticRow({
  result,
  styles,
}: {
  result: DiagnosticResult;
  styles: ReturnType<typeof createStyles>;
}) {
  const label: Record<DiagnosticState, string> = {
    running: "CHECK",
    pass: "PASS",
    fail: "FAIL",
    blocked: "WAIT",
  };
  return (
    <View style={styles.diagnosticRow}>
      <View style={[styles.diagnosticDot, diagnosticDotStyle(result.state, styles)]}>
        {result.state === "running" ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
      </View>
      <View style={styles.diagnosticCopy}>
        <Text style={styles.diagnosticArea}>{result.area}</Text>
        <Text style={styles.diagnosticLabel}>{result.label}</Text>
        <Text style={styles.diagnosticDetail}>{result.detail}</Text>
      </View>
      <View style={styles.diagnosticRight}>
        <Text style={[styles.diagnosticState, diagnosticTextStyle(result.state, styles)]}>
          {label[result.state]}
        </Text>
        {result.durationMs ? <Text style={styles.duration}>{result.durationMs}ms</Text> : null}
      </View>
    </View>
  );
}

function PageCard({
  page,
  onOpen,
  isWide,
  styles,
}: {
  page: PageAudit;
  onOpen: () => void;
  isWide: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.pageCard, isWide && styles.pageCardWide]}>
      <View style={styles.pageMock}>
        <View style={styles.mockTop}>
          <Text style={styles.mockBrand}>MOVEALL</Text>
          <View style={styles.mockCircle} />
        </View>
        <View style={styles.mockTitleLine} />
        <View style={styles.mockFeatureRow}>
          <View style={[styles.mockFeature, styles.mockFeatureStrong]} />
          <View style={styles.mockFeature} />
          <View style={styles.mockFeature} />
        </View>
        <View style={styles.mockCard} />
      </View>
      <View style={styles.pageCardBody}>
        <View style={styles.pageCardTop}>
          <View>
            <Text style={styles.pageRoute}>{page.route}</Text>
            <Text style={styles.pageTitle}>{page.title}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>{page.score}</Text>
          </View>
        </View>
        <StatusBadge status={page.status} styles={styles} />
        <Text style={styles.pageSummary}>{page.summary}</Text>
        <Text style={styles.listLabel}>작동</Text>
        <Text style={styles.listText}>{page.working.join(" · ")}</Text>
        <Text style={styles.listLabel}>비어 있음</Text>
        <Text style={styles.listText}>{page.gaps.join(" · ")}</Text>
        <View style={styles.componentRow}>
          {page.components.map((component) => (
            <Text key={component} style={styles.componentChip}>
              {component}
            </Text>
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen} style={styles.openButton}>
          <Text style={styles.openButtonText}>{page.title} 화면 열기 →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatusBadge({
  status,
  styles,
}: {
  status: DeliveryStatus;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.statusBadge, statusBadgeStyle(status, styles)]}>
      <View style={[styles.statusDot, statusDotStyle(status, styles)]} />
      <Text style={[styles.statusText, statusTextStyle(status, styles)]}>
        {deliveryStatusLabels[status]}
      </Text>
    </View>
  );
}

function PriorityBadge({
  priority,
  styles,
}: {
  priority: AuditPriority;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.priorityBadge, priority === "P0" && styles.priorityBadgeP0]}>
      <Text style={[styles.priorityText, priority === "P0" && styles.priorityTextP0]}>
        {priority}
      </Text>
    </View>
  );
}

function statusBadgeStyle(status: DeliveryStatus, styles: ReturnType<typeof createStyles>) {
  return {
    ready: styles.statusReadyBackground,
    partial: styles.statusPartialBackground,
    device: styles.statusDeviceBackground,
    planned: styles.statusPlannedBackground,
  }[status];
}

function statusDotStyle(status: DeliveryStatus, styles: ReturnType<typeof createStyles>) {
  return {
    ready: styles.statusReadyDot,
    partial: styles.statusPartialDot,
    device: styles.statusDeviceDot,
    planned: styles.statusPlannedDot,
  }[status];
}

function statusTextStyle(status: DeliveryStatus, styles: ReturnType<typeof createStyles>) {
  return {
    ready: styles.statusReadyText,
    partial: styles.statusPartialText,
    device: styles.statusDeviceText,
    planned: styles.statusPlannedText,
  }[status];
}

function diagnosticDotStyle(state: DiagnosticState, styles: ReturnType<typeof createStyles>) {
  return {
    running: styles.diagnosticRunning,
    pass: styles.diagnosticPass,
    fail: styles.diagnosticFail,
    blocked: styles.diagnosticBlocked,
  }[state];
}

function diagnosticTextStyle(state: DiagnosticState, styles: ReturnType<typeof createStyles>) {
  return {
    running: styles.diagnosticRunningText,
    pass: styles.diagnosticPassText,
    fail: styles.diagnosticFailText,
    blocked: styles.diagnosticBlockedText,
  }[state];
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 1180,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 80,
      gap: 18,
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: {
      color: colors.primary,
      fontSize: 17,
      fontStyle: "italic",
      fontWeight: "900",
      letterSpacing: 0.7,
    },
    adminLabel: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.5 },
    exitButton: {
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    exitText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    hero: {
      borderRadius: 16,
      padding: 24,
      gap: 24,
      backgroundColor: colors.hero,
      overflow: "hidden",
    },
    heroWide: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    heroCopy: { flex: 1, maxWidth: 710 },
    heroKicker: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.4,
    },
    heroTitle: { color: "#FFFFFF", fontSize: 32, lineHeight: 39, fontWeight: "900", marginTop: 8 },
    heroText: {
      color: "rgba(255,255,255,0.58)",
      fontSize: 12,
      lineHeight: 20,
      marginTop: 10,
      maxWidth: 620,
    },
    heroScore: { minWidth: 170, alignItems: "flex-end" },
    heroScoreValue: { color: colors.primary, fontSize: 58, lineHeight: 62, fontWeight: "900" },
    heroScoreUnit: { color: "rgba(255,255,255,0.48)", fontSize: 11, fontWeight: "800" },
    heroScoreLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", marginTop: 7 },
    securityNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    securityNoticeLabel: {
      color: colors.primary,
      fontSize: 8,
      fontWeight: "900",
      letterSpacing: 1,
    },
    securityNoticeText: { flex: 1, color: colors.ink, fontSize: 10, lineHeight: 16 },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    statCard: {
      flexGrow: 1,
      flexBasis: 170,
      minHeight: 108,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      backgroundColor: colors.surface,
    },
    statLabel: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    statValue: { color: colors.ink, fontSize: 26, fontWeight: "900", marginTop: 10 },
    statMeta: { color: colors.primary, fontSize: 9, fontWeight: "900", marginTop: 4 },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 20,
    },
    sectionCopy: { flex: 1 },
    sectionEyebrow: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
    sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 4 },
    sectionMeta: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
    refreshButton: {
      minHeight: 38,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    refreshButtonDisabled: { opacity: 0.45 },
    refreshText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    diagnosticGrid: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    diagnosticGridWide: { flexDirection: "row", flexWrap: "wrap" },
    diagnosticRow: {
      flexBasis: "50%",
      minWidth: 290,
      flexGrow: 1,
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 13,
      borderBottomWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    diagnosticDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    diagnosticRunning: { backgroundColor: colors.muted },
    diagnosticPass: { backgroundColor: "#168A53" },
    diagnosticFail: { backgroundColor: colors.danger },
    diagnosticBlocked: { backgroundColor: "#7D6A45" },
    diagnosticCopy: { flex: 1 },
    diagnosticArea: { color: colors.primary, fontSize: 7, fontWeight: "900" },
    diagnosticLabel: { color: colors.ink, fontSize: 11, fontWeight: "900", marginTop: 2 },
    diagnosticDetail: { color: colors.muted, fontSize: 9, marginTop: 3 },
    diagnosticRight: { alignItems: "flex-end" },
    diagnosticState: { fontSize: 8, fontWeight: "900" },
    diagnosticRunningText: { color: colors.muted },
    diagnosticPassText: { color: "#168A53" },
    diagnosticFailText: { color: colors.danger },
    diagnosticBlockedText: { color: "#9A7642" },
    duration: { color: colors.muted, fontSize: 7, marginTop: 4 },
    pageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    pageCard: {
      width: "100%",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.surface,
    },
    pageCardWide: { width: "49.4%" },
    pageMock: { height: 145, backgroundColor: colors.surfaceMuted, padding: 14 },
    mockTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    mockBrand: { color: colors.primary, fontSize: 7, fontWeight: "900", fontStyle: "italic" },
    mockCircle: {
      width: 11,
      height: 11,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.muted,
    },
    mockTitleLine: {
      width: "43%",
      height: 10,
      borderRadius: 3,
      backgroundColor: colors.ink,
      marginTop: 15,
    },
    mockFeatureRow: { flexDirection: "row", gap: 6, marginTop: 10 },
    mockFeature: { width: 42, height: 13, borderRadius: 7, backgroundColor: colors.border },
    mockFeatureStrong: { backgroundColor: colors.primary },
    mockCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 6,
      marginTop: 10,
    },
    pageCardBody: { padding: 15 },
    pageCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pageRoute: { color: colors.primary, fontSize: 8, fontWeight: "900" },
    pageTitle: { color: colors.ink, fontSize: 19, fontWeight: "900", marginTop: 3 },
    scoreBadge: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreValue: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    statusBadge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginTop: 10,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 8, fontWeight: "900" },
    statusReadyBackground: { backgroundColor: "rgba(22,138,83,0.12)" },
    statusPartialBackground: { backgroundColor: colors.primarySoft },
    statusDeviceBackground: { backgroundColor: "rgba(62,111,181,0.12)" },
    statusPlannedBackground: { backgroundColor: colors.surfaceMuted },
    statusReadyDot: { backgroundColor: "#168A53" },
    statusPartialDot: { backgroundColor: colors.primary },
    statusDeviceDot: { backgroundColor: "#3E6FB5" },
    statusPlannedDot: { backgroundColor: colors.muted },
    statusReadyText: { color: "#168A53" },
    statusPartialText: { color: colors.primary },
    statusDeviceText: { color: "#3E6FB5" },
    statusPlannedText: { color: colors.muted },
    pageSummary: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 10 },
    listLabel: { color: colors.ink, fontSize: 8, fontWeight: "900", marginTop: 10 },
    listText: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 3 },
    componentRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 },
    componentChip: {
      color: colors.ink,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 4,
      fontSize: 7,
      fontWeight: "800",
    },
    openButton: {
      minHeight: 40,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 13,
      alignItems: "flex-end",
      justifyContent: "flex-end",
    },
    openButtonText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    matrix: { borderTopWidth: 1, borderTopColor: colors.border },
    matrixRow: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 6,
    },
    matrixRowWide: { flexDirection: "row", alignItems: "center" },
    matrixTitleRow: { width: 180, flexDirection: "row", alignItems: "center", gap: 8 },
    matrixArea: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    matrixBehavior: { flex: 1, color: colors.ink, fontSize: 10, lineHeight: 16 },
    matrixGap: { flex: 1, color: colors.muted, fontSize: 10, lineHeight: 16 },
    gapList: { gap: 10 },
    gapCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 15,
    },
    gapTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    priorityBadge: {
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
    },
    priorityBadgeP0: { backgroundColor: colors.primary },
    priorityText: { color: colors.muted, fontSize: 8, fontWeight: "900" },
    priorityTextP0: { color: "#FFFFFF" },
    gapArea: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    gapTitle: { color: colors.ink, fontSize: 15, fontWeight: "900", marginTop: 10 },
    gapEvidence: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
    recommendBox: {
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
      paddingLeft: 10,
      marginTop: 12,
    },
    recommendLabel: { color: colors.primary, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
    recommendText: { color: colors.ink, fontSize: 10, lineHeight: 17, marginTop: 3 },
    roadmap: { borderRadius: 12, backgroundColor: colors.hero, padding: 18 },
    roadmapItem: {
      flexDirection: "row",
      gap: 14,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.1)",
    },
    roadmapOrder: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    roadmapCopy: { flex: 1 },
    roadmapTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
    roadmapText: { color: "rgba(255,255,255,0.56)", fontSize: 10, lineHeight: 17, marginTop: 5 },
  });
}
