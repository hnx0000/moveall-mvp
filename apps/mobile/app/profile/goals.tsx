import { sportLabels } from "@moveall/contracts";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../src/components/ui";
import {
  markRecordGoalAchieved,
  readRecordGoals,
  removeRecordGoal,
  type RecordGoal,
} from "../../src/goals";
import { fonts, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

export default function GoalsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [goals, setGoals] = useState<RecordGoal[]>([]);

  useFocusEffect(
    useCallback(() => {
      setGoals(readRecordGoals());
    }, []),
  );

  return (
    <Screen title="나만의 목표" action={<Text style={styles.privateBadge}>PRIVATE</Text>}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← 내 정보</Text>
      </Pressable>
      <Text style={styles.heading}>존중에서 시작한 목표</Text>
      <Text style={styles.intro}>
        다른 사람의 기록을 목표로 저장했습니다. 기준을 충족한 새 운동 기록이 생기면 자동으로 달성
        처리됩니다.
      </Text>
      {goals.map((goal) => (
        <View key={goal.id} style={[styles.card, goal.achieved && styles.cardDone]}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.sport}>{sportLabels[goal.sport]}</Text>
              <Text style={styles.author}>{goal.authorName}님의 기록</Text>
            </View>
            <Text style={styles.visibility}>{goal.private ? "비공개 도전" : "공개 도전"}</Text>
          </View>
          <Text style={styles.content}>{goal.content}</Text>
          {goal.target ? <Text style={styles.target}>달성 기준 · {goal.target.label}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              disabled={goal.achieved}
              onPress={() => {
                markRecordGoalAchieved(goal.id);
                setGoals(readRecordGoals());
              }}
              style={[styles.primary, goal.achieved && styles.primaryDone]}
            >
              <Text style={styles.primaryText}>
                {goal.achieved ? "목표 달성" : "달성으로 표시"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                removeRecordGoal(goal.id);
                setGoals(readRecordGoals());
              }}
              style={styles.remove}
            >
              <Text style={styles.removeText}>제거</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {goals.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>아직 목표가 없습니다.</Text>
          <Text style={styles.emptyCopy}>
            피드에서 오른쪽 목표 아이콘을 눌러 기록을 담아보세요.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    privateBadge: { color: colors.primary, fontSize: 9, fontFamily: fonts.bold },
    back: { color: colors.muted, fontSize: 11, fontFamily: fonts.semibold },
    heading: { color: colors.ink, fontSize: 24, fontFamily: fonts.displayExtra },
    intro: { color: colors.muted, fontSize: 11, lineHeight: 18, marginBottom: space[2] },
    card: {
      padding: space[4],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 12,
    },
    cardDone: { opacity: 0.56 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
    sport: { color: colors.primary, fontSize: 9, fontFamily: fonts.bold },
    author: { color: colors.ink, fontSize: 15, fontFamily: fonts.bold, marginTop: 3 },
    visibility: { color: colors.muted, fontSize: 8, fontFamily: fonts.semibold },
    content: { color: colors.ink, fontSize: 12, lineHeight: 19 },
    target: { color: colors.primary, fontSize: 9, fontFamily: fonts.bold },
    actions: { flexDirection: "row", gap: 8 },
    primary: {
      flex: 1,
      minHeight: 40,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryDone: { backgroundColor: colors.primary },
    primaryText: { color: "#FFFFFF", fontSize: 10, fontFamily: fonts.bold },
    remove: {
      minWidth: 62,
      minHeight: 40,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.danger,
      alignItems: "center",
      justifyContent: "center",
    },
    removeText: { color: colors.danger, fontSize: 10, fontFamily: fonts.bold },
    empty: {
      minHeight: 180,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      padding: 20,
    },
    emptyTitle: { color: colors.ink, fontSize: 14, fontFamily: fonts.bold },
    emptyCopy: { color: colors.muted, fontSize: 10, textAlign: "center" },
  });
}
