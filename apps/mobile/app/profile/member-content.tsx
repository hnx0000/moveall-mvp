import { sportLabels, type PublicMemberProfile, type MemberConnections } from "@moveall/contracts";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Screen } from "../../src/components/ui";
import { useAppTheme } from "../../src/theme-context";
import { formatSensorMetricLine } from "../../src/workout-metrics";

export default function MemberContent() {
  const {
    userId,
    mode = "records",
    recordId,
  } = useLocalSearchParams<{ userId: string; mode: string; recordId?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [profile, setProfile] = useState<PublicMemberProfile | null>(null);
  const [social, setSocial] = useState<MemberConnections | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isSocial = mode === "followers" || mode === "following";
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");
      setProfile(null);
      setSocial(null);
      if (!session || !userId) {
        setLoading(false);
        return;
      }
      void (async () => {
        try {
          if (isSocial) {
            const value = await api.memberConnections(session.accessToken, userId);
            if (active) setSocial(value);
          } else {
            const value = await api.memberProfile(session.accessToken, userId);
            if (active) setProfile(value);
          }
        } catch (caught) {
          if (active) setError(caught instanceof Error ? caught.message : "불러오지 못했습니다.");
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [session, userId, isSocial]),
  );
  const title = recordId
    ? "기록 상세"
    : mode === "followers"
      ? "팔로워"
      : mode === "following"
        ? "팔로잉"
        : mode === "posts"
          ? "게시물"
          : "운동 기록";
  const hidden =
    profile?.isPrivate ||
    (mode === "followers" ? social?.followersHidden : social?.followingHidden);
  const people = (mode === "followers" ? social?.followers : social?.following) ?? [];
  const records = profile?.workouts.filter((item) => !recordId || item.id === recordId) ?? [];
  const card = { padding: 18, borderRadius: 16, backgroundColor: colors.surface, gap: 10 } as const;
  return (
    <Screen title={title}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={{ color: colors.primary }}>← 뒤로</Text>
      </Pressable>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={{ color: colors.danger }}>{error}</Text>
      ) : hidden ? (
        <Text style={{ color: colors.muted }}>공개된 내용이 없습니다.</Text>
      ) : (
        <>
          {isSocial ? (
            people.length ? (
              people.map((person) => (
                <Pressable
                  key={person.id}
                  style={card}
                  onPress={() =>
                    router.push({ pathname: "/profile/member", params: { userId: person.id } })
                  }
                >
                  <Text style={{ color: colors.ink }}>{person.displayName} →</Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: colors.muted }}>표시할 계정이 없습니다.</Text>
            )
          ) : null}
          {!isSocial && mode !== "posts" ? (
            records.length ? (
              records.map((workout) => (
                <Pressable
                  key={workout.id}
                  style={card}
                  disabled={!!recordId}
                  onPress={() =>
                    router.push({
                      pathname: "./member-content",
                      params: { userId, mode: "records", recordId: workout.id },
                    })
                  }
                >
                  <Text style={{ color: colors.ink, fontSize: 20 }}>
                    {sportLabels[workout.sport]}
                  </Text>
                  <Text style={{ color: colors.muted }}>
                    {new Date(workout.startedAt).toLocaleString("ko-KR")} ~{" "}
                    {new Date(workout.endedAt).toLocaleString("ko-KR")}
                  </Text>
                  <Text style={{ color: colors.ink }}>{workout.notes || "운동 기록"}</Text>
                  <Text style={{ color: colors.ink }}>{formatSensorMetricLine(workout)}</Text>
                  {Object.entries(workout.metrics).map(([key, value]) => (
                    <View key={key}>
                      <Text style={{ color: colors.ink }}>
                        {metricLabels[key] ?? key}: {String(value)}
                      </Text>
                    </View>
                  ))}
                </Pressable>
              ))
            ) : (
              <Text style={{ color: colors.muted }}>공개된 기록이 없습니다.</Text>
            )
          ) : null}
          {mode === "posts" ? (
            profile?.posts.length ? (
              profile.posts.map((post) => (
                <Pressable
                  key={post.id}
                  style={card}
                  onPress={() =>
                    router.push({ pathname: "/(tabs)/community", params: { post: post.id } })
                  }
                >
                  <Text style={{ color: colors.ink }}>{post.content}</Text>
                  <Text style={{ color: colors.muted }}>
                    {new Date(post.createdAt).toLocaleString("ko-KR")} · 자세히 보기 →
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: colors.muted }}>공개된 게시물이 없습니다.</Text>
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

const metricLabels: Record<string, string> = {
  averageHeartRateBpm: "평균 심박수(bpm)",
  maximumHeartRateBpm: "최대 심박수(bpm)",
  strokeCount: "총 스트로크 수",
  averageSwolf: "평균 SWOLF",
  averagePaceSecondsPerKm: "평균 페이스(초/km)",
  averageSpeedKmh: "평균 속도(km/h)",
  durationMinutes: "운동 시간(분)",
  distanceKm: "거리(km)",
  distanceM: "거리(m)",
  calories: "소모 열량(kcal)",
  elevationGainM: "누적 상승(m)",
  exerciseCount: "운동 수",
  sets: "세트 수",
  volumeKg: "총 볼륨(kg)",
  maxDepthM: "최대 수심(m)",
  laps: "랩 수",
  avgHeartRate: "평균 심박수",
  maxHeartRate: "최대 심박수",
};
