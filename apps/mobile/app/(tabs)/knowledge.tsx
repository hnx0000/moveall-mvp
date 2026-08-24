import { sportLabels, sportValues, type SportType } from "@moveall/contracts";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Card, PrimaryButton, Screen, StatePanel } from "../../src/components/ui";
import { ArticleArtwork } from "../../src/components/workout-artwork";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type KnowledgeFilter = "all" | SportType;

export default function KnowledgeScreen() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [filter, setFilter] = useState<KnowledgeFilter>("all");
  const loader = useCallback(async () => {
    if (filter !== "all") return api.knowledge(filter);
    const groups = await Promise.all(sportValues.map((item) => api.knowledge(item)));
    return groups.flat();
  }, [filter]);
  const { data: articles, error, loading, reload } = useAsyncData(loader);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feedbackArticleId, setFeedbackArticleId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(null);
    setFeedbackArticleId(null);
    setFeedback("");
    setContext("");
  }, [filter]);

  async function submitFeedback(articleId: string) {
    if (!session || feedback.trim().length < 2) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.createKnowledgeFeedback(session.accessToken, articleId, {
        content: feedback.trim(),
        ...(context.trim() ? { context: context.trim() } : {}),
      });
      setFeedback("");
      setContext("");
      await reload();
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "피드백을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function toggleBookmark(articleId: string) {
    setBookmarkedIds((current) =>
      current.includes(articleId)
        ? current.filter((item) => item !== articleId)
        : [...current, articleId],
    );
  }

  const filters: Array<{ id: KnowledgeFilter; label: string }> = [
    { id: "all", label: "전체" },
    ...sportValues.map((item) => ({ id: item, label: sportLabels[item] })),
  ];

  return (
    <Screen title="">
      <View>
        <Text style={styles.pageTitle}>운동 바이블</Text>
        <Text style={styles.pageSubtitle}>
          공식 근거, 전문가 검수, 실제 상황 피드백을 정리해 보여드립니다.
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filters}>
          {filters.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item.id }}
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.filter, filter === item.id && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {loading ? <StatePanel state="loading" message="운동 지식을 불러오는 중이에요." /> : null}
      {error ? <StatePanel state="error" message={error} onRetry={() => void reload()} /> : null}
      {articles?.length === 0 ? (
        <StatePanel state="empty" message="준비된 콘텐츠가 없습니다." />
      ) : null}

      {articles?.map((article, index) => {
        const expanded = expandedId === article.id;
        const feedbackOpen = feedbackArticleId === article.id;
        const bookmarked = bookmarkedIds.includes(article.id);
        return (
          <Card key={article.id} style={styles.articleCard}>
            <View style={styles.badgeRow}>
              <Text style={styles.category}>{article.category}</Text>
              <Text style={styles.reviewBadge}>전문가 검수 전</Text>
              <Pressable
                accessibilityLabel={bookmarked ? "북마크 해제" : "북마크"}
                accessibilityRole="button"
                onPress={() => toggleBookmark(article.id)}
                style={styles.bookmark}
              >
                <Text style={[styles.bookmarkText, bookmarked && styles.bookmarkActive]}>
                  {bookmarked ? "▣" : "▢"}
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setExpandedId(expanded ? null : article.id)}
              style={styles.articleHeader}
            >
              <View style={styles.articleCopy}>
                <Text style={styles.articleTitle}>{article.title}</Text>
                <Text numberOfLines={expanded ? undefined : 3} style={styles.summary}>
                  {article.summary}
                </Text>
              </View>
              <ArticleArtwork colors={colors} kind={index % 3} />
            </Pressable>

            {expanded ? (
              <View style={styles.articleBody}>
                <Text style={styles.bodyTitle}>핵심 체크</Text>
                {article.keyPoints.map((point, pointIndex) => (
                  <View key={point} style={styles.pointRow}>
                    <Text style={styles.pointNumber}>{pointIndex + 1}</Text>
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
                <View style={styles.contextBox}>
                  <Text style={styles.contextTitle}>상황에 따라 달라지는 점</Text>
                  <Text style={styles.contextText}>{article.situationalNote}</Text>
                </View>
                <Text style={styles.safety}>{article.safetyNotice}</Text>
                <Text style={styles.sourceHeading}>근거 자료</Text>
                {article.sources.map((source) => (
                  <Pressable
                    accessibilityRole="link"
                    key={source.url}
                    onPress={() => void Linking.openURL(source.url)}
                    style={styles.sourceLink}
                  >
                    <View style={styles.sourceCopy}>
                      <Text style={styles.sourceTitle}>{source.title}</Text>
                      <Text style={styles.sourceOrg}>{source.organization}</Text>
                    </View>
                    <Text style={styles.sourceArrow}>↗</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.feedbackSummary}>
              <Text style={styles.feedbackCount}>상황 피드백 {article.feedback.length}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: feedbackOpen }}
                onPress={() => setFeedbackArticleId(feedbackOpen ? null : article.id)}
              >
                <Text style={styles.feedbackButtonText}>
                  {feedbackOpen ? "닫기" : "피드백 보기"}
                </Text>
              </Pressable>
            </View>

            {feedbackOpen ? (
              <View style={styles.feedbackArea}>
                {article.feedback.length ? (
                  article.feedback.map((item) => (
                    <View key={item.id} style={styles.feedbackItem}>
                      <View style={styles.feedbackMeta}>
                        <Text style={styles.feedbackAuthor}>{item.authorDisplayName}</Text>
                        {item.context ? (
                          <Text style={styles.feedbackContext}>{item.context}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.feedbackContent}>{item.content}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyFeedback}>아직 공유된 상황이 없습니다.</Text>
                )}
                {session ? (
                  <View style={styles.feedbackForm}>
                    <Text style={styles.formTitle}>내 상황 공유하기</Text>
                    <TextInput
                      accessibilityLabel="상황 요약"
                      maxLength={120}
                      onChangeText={setContext}
                      placeholder="예: 러닝 입문 · 주 3회 (선택)"
                      placeholderTextColor={colors.muted}
                      style={styles.contextInput}
                      value={context}
                    />
                    <TextInput
                      accessibilityLabel="지식 콘텐츠 피드백"
                      maxLength={500}
                      multiline
                      onChangeText={setFeedback}
                      placeholder="내 상황에서는 어떻게 적용됐는지 공유해 주세요."
                      placeholderTextColor={colors.muted}
                      style={styles.feedbackInput}
                      value={feedback}
                    />
                    {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
                    <PrimaryButton
                      label={saving ? "저장 중..." : "상황 피드백 등록"}
                      disabled={saving || feedback.trim().length < 2}
                      onPress={() => void submitFeedback(article.id)}
                    />
                  </View>
                ) : (
                  <Text style={styles.loginHint}>
                    내 정보에서 로그인하면 상황 피드백을 남길 수 있습니다.
                  </Text>
                )}
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
    pageTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
    pageSubtitle: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
    filters: { flexDirection: "row", gap: 7, paddingVertical: 2, paddingRight: 16 },
    filter: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.ink, fontSize: 9, fontWeight: "800" },
    filterTextActive: { color: "#FFFFFF" },
    articleCard: { gap: 10 },
    badgeRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    category: { color: colors.primary, fontSize: 9, fontWeight: "900" },
    reviewBadge: {
      color: colors.warning,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 3,
      fontSize: 8,
      fontWeight: "800",
    },
    bookmark: {
      marginLeft: "auto",
      minWidth: 30,
      minHeight: 30,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    bookmarkText: { color: colors.ink, fontSize: 20, fontWeight: "300" },
    bookmarkActive: { color: colors.primary },
    articleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    articleCopy: { flex: 1 },
    articleTitle: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: "900" },
    summary: { color: colors.muted, fontSize: 10, lineHeight: 17, marginTop: 7 },
    articleBody: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    bodyTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", marginBottom: 9 },
    pointRow: { flexDirection: "row", gap: 9, marginBottom: 8 },
    pointNumber: {
      width: 21,
      height: 21,
      borderRadius: 11,
      backgroundColor: colors.primarySoft,
      color: colors.primary,
      textAlign: "center",
      textAlignVertical: "center",
      fontSize: 9,
      fontWeight: "900",
    },
    pointText: { flex: 1, color: colors.ink, fontSize: 11, lineHeight: 17 },
    contextBox: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 7,
      padding: 10,
      marginTop: 3,
    },
    contextTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    contextText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 4 },
    safety: { color: colors.danger, fontSize: 9, lineHeight: 15, marginTop: 9 },
    sourceHeading: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: "900",
      marginTop: 12,
      marginBottom: 5,
    },
    sourceLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primarySoft,
      borderRadius: 7,
      padding: 9,
      marginBottom: 5,
    },
    sourceCopy: { flex: 1 },
    sourceTitle: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    sourceOrg: { color: colors.muted, fontSize: 8, marginTop: 3 },
    sourceArrow: { color: colors.primary, fontSize: 16 },
    feedbackSummary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 9,
    },
    feedbackCount: { color: colors.ink, fontSize: 10, fontWeight: "800" },
    feedbackButtonText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
    feedbackArea: { gap: 8 },
    feedbackItem: { backgroundColor: colors.surfaceMuted, borderRadius: 7, padding: 9 },
    feedbackMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    feedbackAuthor: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    feedbackContext: { color: colors.primary, fontSize: 8, fontWeight: "800" },
    feedbackContent: { color: colors.ink, fontSize: 10, lineHeight: 16, marginTop: 4 },
    emptyFeedback: { color: colors.muted, fontSize: 10 },
    feedbackForm: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
    formTitle: { color: colors.ink, fontSize: 11, fontWeight: "900", marginBottom: 7 },
    contextInput: {
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
      backgroundColor: colors.background,
      padding: 9,
      marginBottom: 6,
      fontSize: 10,
    },
    feedbackInput: {
      minHeight: 74,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
      backgroundColor: colors.background,
      padding: 9,
      textAlignVertical: "top",
      marginBottom: 8,
      fontSize: 10,
    },
    error: { color: colors.danger, fontSize: 9, marginBottom: 7 },
    loginHint: {
      color: colors.muted,
      fontSize: 9,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
  });
}
