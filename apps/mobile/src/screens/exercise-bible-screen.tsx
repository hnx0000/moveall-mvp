import { sportValues, type SportType } from "@moveall/contracts";
import { Bookmark } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { Card, Screen, StatePanel } from "../components/ui";
import { useAsyncData } from "../hooks/use-async-data";
import { fonts, radius, space, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

type KnowledgeFilter = "all" | SportType;

const filters: Array<{ id: KnowledgeFilter; label: string }> = [
  { id: "all", label: "전체" },
  { id: "running", label: "러닝" },
  { id: "hiking", label: "등산" },
  { id: "cycling", label: "사이클" },
  { id: "strength", label: "근력" },
  { id: "swimming", label: "수영" },
  { id: "diving", label: "다이빙" },
];

// Kept separate so the Bible can move between tabs without coupling it to League.
export function ExerciseBibleScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [knowledgeFilter, setKnowledgeFilter] = useState<KnowledgeFilter>("all");
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);

  const knowledgeLoader = useCallback(async () => {
    if (knowledgeFilter !== "all") return api.knowledge(knowledgeFilter);
    const groups = await Promise.all(sportValues.map((sport) => api.knowledge(sport)));
    return groups.flat();
  }, [knowledgeFilter]);
  const { data: articles, error, loading, reload } = useAsyncData(knowledgeLoader);

  useEffect(() => setExpandedArticle(null), [knowledgeFilter]);

  function toggleBookmark(articleId: string) {
    setBookmarkedArticles((current) =>
      current.includes(articleId)
        ? current.filter((item) => item !== articleId)
        : [...current, articleId],
    );
  }

  return (
    <Screen title="">
      <View style={styles.labHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>GROOV LAB</Text>
          <Text style={styles.labTitle}>운동 바이블</Text>
        </View>
        <Text style={styles.labCopy}>기록을 만드는 지식</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {filters.map((item) => {
            const active = knowledgeFilter === item.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={item.id}
                onPress={() => setKnowledgeFilter(item.id)}
                style={[styles.filter, active && styles.filterActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {loading ? <StatePanel state="loading" message="운동 지식을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {articles?.length === 0 ? (
        <StatePanel state="empty" message="준비된 콘텐츠가 없습니다." />
      ) : null}

      {articles?.slice(0, knowledgeFilter === "all" ? 4 : undefined).map((article) => {
        const expanded = expandedArticle === article.id;
        const bookmarked = bookmarkedArticles.includes(article.id);
        return (
          <Card key={article.id} style={styles.articleCard}>
            <View style={styles.articleMeta}>
              <Text style={styles.articleCategory}>{article.category}</Text>
              <Text style={styles.articleReview}>근거 자료 확인</Text>
              <Pressable
                accessibilityLabel={bookmarked ? "북마크 해제" : "북마크"}
                accessibilityRole="button"
                onPress={() => toggleBookmark(article.id)}
                style={styles.bookmark}
              >
                <Bookmark
                  color={bookmarked ? colors.primary : colors.muted}
                  fill={bookmarked ? colors.primarySoft : "transparent"}
                  size={19}
                  strokeWidth={2}
                />
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpandedArticle(expanded ? null : article.id)}
            >
              <Text style={styles.articleTitle}>{article.title}</Text>
              <Text numberOfLines={expanded ? undefined : 2} style={styles.articleSummary}>
                {article.summary}
              </Text>
            </Pressable>
            {expanded ? (
              <View style={styles.articleBody}>
                {article.keyPoints.map((point, index) => (
                  <View key={point} style={styles.pointRow}>
                    <Text style={styles.pointNumber}>{String(index + 1).padStart(2, "0")}</Text>
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
                <Text style={styles.safety}>{article.safetyNotice}</Text>
                {article.sources.slice(0, 2).map((source) => (
                  <Pressable
                    accessibilityRole="link"
                    key={source.url}
                    onPress={() => void Linking.openURL(source.url)}
                    style={styles.sourceLink}
                  >
                    <Text numberOfLines={1} style={styles.sourceTitle}>
                      {source.organization} · {source.title}
                    </Text>
                    <Text style={styles.sourceArrow}>↗</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.4,
    },
    labHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    labTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 23, marginTop: 3 },
    labCopy: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginBottom: 3 },
    filters: { flexDirection: "row", gap: space[2], paddingRight: 20 },
    filter: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.full,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 },
    filterTextActive: { color: "#FFFFFF" },
    articleCard: { padding: 17, gap: 11 },
    articleMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
    articleCategory: { color: colors.primary, fontFamily: fonts.bold, fontSize: 9 },
    articleReview: {
      color: colors.warning,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 7,
      paddingVertical: 3,
      fontFamily: fonts.semibold,
      fontSize: 8,
    },
    bookmark: {
      marginLeft: "auto",
      minWidth: 30,
      minHeight: 30,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    articleTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
    articleSummary: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 5,
    },
    articleBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11, gap: 7 },
    pointRow: { flexDirection: "row", gap: 9 },
    pointNumber: { width: 24, color: colors.primary, fontFamily: fonts.displayExtra, fontSize: 9 },
    pointText: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 16,
    },
    safety: {
      color: colors.danger,
      fontFamily: fonts.regular,
      fontSize: 9,
      lineHeight: 15,
      marginTop: 4,
    },
    sourceLink: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: radius.sm,
      padding: 9,
      marginTop: 3,
    },
    sourceTitle: { flex: 1, color: colors.primary, fontFamily: fonts.semibold, fontSize: 9 },
    sourceArrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14 },
  });
}
