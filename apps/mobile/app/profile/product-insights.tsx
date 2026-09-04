import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { Screen } from "../../src/components/ui";
import { fonts } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

export default function ProductInsightsScreen() {
  const { session } = useAuth();
  return <PurposeInsights key={session?.user.id ?? "anonymous"} token={session?.accessToken} />;
}

function PurposeInsights({ token }: { token: string | undefined }) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [registeredFrom, setRegisteredFrom] = useState<string | undefined>();
  const load = useCallback(async () => {
    if (!token) throw new Error("관리자 계정으로 로그인해 주세요.");
    return api.usagePurposeSummary(token, registeredFrom ? { registeredFrom } : {});
  }, [token, registeredFrom]);
  const { data, loading, error, reload } = useAsyncData(load);
  const label = (value: string) => <Text style={[s.body, { color: colors.muted }]}>{value}</Text>;
  const button = (value: string, onPress: () => void, active = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        s.chip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <Text style={[s.body, { color: active ? colors.primary : colors.ink }]}>{value}</Text>
    </Pressable>
  );
  return (
    <Screen
      title="사용 목적 통계"
      onRefresh={async () => {
        await reload();
      }}
      refreshing={loading}
      action={
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()}>
          <ArrowLeft color={colors.ink} />
        </Pressable>
      }
    >
      {label("가입할 때 선택한 가장 큰 목적입니다. 실제 이용 행동이나 만족도를 의미하지는 않아요.")}
      <View style={s.row}>
        {button("전체 가입자", () => setRegisteredFrom(undefined), !registeredFrom)}
        {button(
          "최근 30일 가입",
          () => setRegisteredFrom(new Date(Date.now() - 30 * 86_400_000).toISOString()),
          Boolean(registeredFrom),
        )}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <View style={s.section}>
          {label(error)}
          {button("다시 불러오기", () => void reload())}
        </View>
      ) : data ? (
        <>
          {data.source === "preview" ? (
            <View style={[s.notice, { backgroundColor: colors.primarySoft }]}>
              <Text style={[s.body, { color: colors.ink }]}>
                미리보기 모드 · 실제 가입자 통계가 아닙니다. 데모 인물과 테스트 응답은 집계하지
                않아요.
              </Text>
            </View>
          ) : null}
          <View style={[s.summary, { borderColor: colors.border }]}>
            <Text style={[s.total, { color: colors.ink }]}>{data.respondents}명 응답</Text>
            {label(
              `집계 대상 ${data.totalUsers}명 · 응답률 ${data.responseRatePercent === null ? "—" : `${data.responseRatePercent}%`}`,
            )}
            {label(`건너뜀 ${data.skipped}명 · 미수집 ${data.uncollected}명`)}
            {label(`운영자·기본 데모 계정 ${data.excludedUsers}명 제외`)}
          </View>
          {!data.respondents
            ? label("아직 응답이 없습니다. 사용자 비율을 임의로 채우지 않습니다.")
            : null}
          <View style={s.section}>
            {data.distribution.map((item) => (
              <View key={item.purpose} style={[s.metric, { borderColor: colors.border }]}>
                <View style={[s.row, { justifyContent: "space-between" }]}>
                  <Text style={[s.metricName, { color: colors.ink }]}>{item.label}</Text>
                  <Text style={[s.percent, { color: colors.primary }]}>
                    {item.percent === null ? "—" : `${item.percent}%`}
                  </Text>
                </View>
                <View style={[s.track, { backgroundColor: colors.border }]}>
                  <View
                    style={{
                      height: "100%",
                      width: `${item.percent ?? 0}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                </View>
                {label(`${item.count}명`)}
              </View>
            ))}
          </View>
          {label(
            "유형별 비율 = 해당 유형 응답자 ÷ 전체 응답자. 건너뜀·미수집은 별도 표시하며 반올림으로 합계가 100%와 조금 다를 수 있어요.",
          )}
          {label(
            "미수집에는 설문 도입 이전 가입자와 온보딩 미완료자가 포함됩니다. 소수 응답만으로 우선순위를 단정하지 말고, 네 유형의 만족도 검증과 함께 판단해 주세요.",
          )}
          {label(
            `질문 v${data.questionVersion} · ${new Date(data.generatedAt).toLocaleString("ko-KR")} 집계`,
          )}
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  section: { gap: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderRadius: 12 },
  notice: { padding: 16, borderRadius: 16 },
  summary: { padding: 20, gap: 10, borderWidth: 1, borderRadius: 18 },
  total: { fontFamily: fonts.bold, fontSize: 26 },
  metric: { padding: 18, gap: 10, borderWidth: 1, borderRadius: 16 },
  metricName: { fontFamily: fonts.semibold, fontSize: 16 },
  percent: { fontFamily: fonts.displayExtra, fontSize: 24 },
  track: { height: 7, borderRadius: 4, overflow: "hidden" },
});
