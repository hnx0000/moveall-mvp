import { sportValues, type SportType } from "@moveall/contracts";
import * as Location from "expo-location";
import {
  Bookmark,
  ChevronRight,
  Clock3,
  Crown,
  MapPin,
  ShieldCheck,
  Swords,
  Trophy,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../src/api/client";
import { useAuth } from "../../src/auth/auth-context";
import { Card, Screen, StatePanel } from "../../src/components/ui";
import { useAsyncData } from "../../src/hooks/use-async-data";
import { fonts, radius, space, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type KnowledgeFilter = "all" | SportType;
type LocalRanker = { name: string; value: string; movement: string };
type LocalContest = {
  epithet: string;
  recordLabel: string;
  champion: string;
  record: string;
  myRecord: string;
  gap: string;
  entrants: number;
  defenseTime: string;
  medalCode: string;
  seasonGoal: string;
  leaders: LocalRanker[];
};

const leagueSportOrder: SportType[] = [
  "running",
  "hiking",
  "cycling",
  "strength",
  "swimming",
  "diving",
];

const leagueSports: Record<SportType, { short: string; mark: string }> = {
  running: { short: "러닝", mark: "R" },
  hiking: { short: "등산", mark: "H" },
  cycling: { short: "사이클", mark: "C" },
  strength: { short: "근력", mark: "S" },
  swimming: { short: "수영", mark: "W" },
  diving: { short: "다이빙", mark: "D" },
};

function contest(
  epithet: string,
  recordLabel: string,
  champion: string,
  record: string,
  myRecord: string,
  gap: string,
  entrants: number,
  medalCode: string,
  seasonGoal: string,
  second: [string, string, string],
): LocalContest {
  return {
    epithet,
    recordLabel,
    champion,
    record,
    myRecord,
    gap,
    entrants,
    defenseTime: "D-04 · 18:21:09",
    medalCode,
    seasonGoal,
    leaders: [
      { name: champion, value: record, movement: "—" },
      { name: second[0], value: second[1], movement: second[2] },
      { name: "MVP 점검자", value: myRecord, movement: "▲ 2" },
    ],
  };
}

const contestSeeds: Record<SportType, LocalContest> = {
  running: contest(
    "스프린터",
    "5KM BEST",
    "러너민지",
    "21:08",
    "22:41",
    "01:33 단축하면 1위",
    184,
    "SSANGMUN RUN 01",
    "5km GPS 기록",
    ["구름준", "21:54", "▲ 1"],
  ),
  hiking: contest(
    "산신령",
    "도봉산 왕복",
    "산타는도윤",
    "01:47:12",
    "01:58:34",
    "11:22 단축하면 1위",
    96,
    "SSANGMUN HIKE 01",
    "정상 GPS 인증",
    ["북한산람쥐", "01:51:08", "▲ 2"],
  ),
  cycling: contest(
    "페달왕",
    "20KM BEST",
    "체인준",
    "34:20",
    "37:48",
    "03:28 단축하면 1위",
    71,
    "SSANGMUN CYCLE 01",
    "20km GPS 기록",
    ["페달소라", "35:09", "▲ 4"],
  ),
  strength: contest(
    "헬창",
    "3대 TOTAL",
    "강철민수",
    "420 KG",
    "395 KG",
    "25 KG 올리면 1위",
    238,
    "SSANGMUN IRON 01",
    "스쿼트·벤치·데드리프트",
    ["쇠질유나", "405 KG", "▲ 1"],
  ),
  swimming: contest(
    "물개",
    "1KM BEST",
    "레인하린",
    "17:06",
    "18:42",
    "01:36 단축하면 1위",
    84,
    "SSANGMUN SWIM 01",
    "1km 수영 기록",
    ["물빛수영", "17:51", "▲ 2"],
  ),
  diving: contest(
    "딥다이버",
    "DEPTH PB",
    "블루도윤",
    "38 M",
    "31 M",
    "7 M 깊어지면 1위",
    43,
    "SSANGMUN DEEP 01",
    "다이빙 컴퓨터 인증",
    ["숨참는민지", "34 M", "▲ 1"],
  ),
};

function neighborhoodFromAddress(address?: Location.LocationGeocodedAddress) {
  if (!address) return "현재 동네";
  const candidates = [
    address.street,
    address.district,
    address.subregion,
    address.city,
    address.region,
  ];
  return (
    candidates.find((value): value is string =>
      Boolean(value && (value.endsWith("동") || value.endsWith("읍") || value.endsWith("면"))),
    ) ??
    address.district ??
    address.city ??
    "현재 동네"
  );
}

export default function KnowledgeScreen() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const [neighborhood, setNeighborhood] = useState("쌍문동");
  const [verified, setVerified] = useState(true);
  const [verificationMessage, setVerificationMessage] = useState("MVP 위치 인증 완료 · 29일 남음");
  const [verifying, setVerifying] = useState(false);
  const [selectedSport, setSelectedSport] = useState<SportType>("strength");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [submittedSports, setSubmittedSports] = useState<SportType[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
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

  const currentContest = contestSeeds[selectedSport];
  const displayName = session?.user.displayName ?? "MVP 점검자";
  const leaders = useMemo(
    () =>
      currentContest.leaders.map((leader) =>
        leader.name === "MVP 점검자" ? { ...leader, name: displayName } : leader,
      ),
    [currentContest.leaders, displayName],
  );
  const submitted = submittedSports.includes(selectedSport);

  async function verifyNeighborhood() {
    setVerifying(true);
    setNotice(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setVerified(false);
        setVerificationMessage("위치 권한을 허용하면 동네 인증을 완료할 수 있어요.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync(position.coords);
      const verifiedNeighborhood = neighborhoodFromAddress(addresses[0]);
      setNeighborhood(verifiedNeighborhood);
      setVerified(true);
      setVerificationMessage("GPS 위치 인증 완료 · 30일 남음");
      setNotice(`${verifiedNeighborhood} 리그에 입장했습니다.`);
    } catch {
      setVerified(false);
      setVerificationMessage("현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  }

  function selectSport(sport: SportType) {
    setSelectedSport(sport);
    setChallengeOpen(false);
    setNotice(null);
  }

  function submitChallenge() {
    if (!verified) {
      setNotice("기록을 제출하려면 먼저 동네 인증이 필요합니다.");
      return;
    }
    setSubmittedSports((current) =>
      current.includes(selectedSport) ? current : [...current, selectedSport],
    );
    setChallengeOpen(false);
    setNotice("기록 접수 완료. GPS·센서 기록 검증 후 순위에 반영됩니다.");
  }

  function toggleBookmark(articleId: string) {
    setBookmarkedArticles((current) =>
      current.includes(articleId)
        ? current.filter((item) => item !== articleId)
        : [...current, articleId],
    );
  }

  const filters: Array<{ id: KnowledgeFilter; label: string }> = [
    { id: "all", label: "전체" },
    ...leagueSportOrder.map((sport) => ({ id: sport, label: leagueSports[sport].short })),
  ];

  return (
    <Screen title="">
      <View style={styles.versionRow}>
        <View>
          <Text style={styles.version}>GROOV 2.0</Text>
          <Text style={styles.pageTitle}>동네 리그</Text>
        </View>
        <View style={styles.seasonBadge}>
          <Text style={styles.seasonText}>SEASON 01</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}>
          <View style={styles.pinShell}>
            <MapPin color="#FF5A32" size={20} strokeWidth={2.4} />
          </View>
          <View style={styles.heroLocation}>
            <Text style={styles.heroEyebrow}>MY NEIGHBORHOOD</Text>
            <Text style={styles.neighborhood}>{neighborhood}</Text>
          </View>
          {verified ? (
            <View style={styles.verifiedBadge}>
              <ShieldCheck color="#FFFFFF" size={13} strokeWidth={2.5} />
              <Text style={styles.verifiedText}>인증됨</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.heroCopy}>같은 동네의 기록을 깨고, 이번 시즌의 이름을 가져가세요.</Text>
        <View style={styles.verificationRow}>
          <Text style={styles.verificationMessage}>{verificationMessage}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={verifying}
            onPress={() => void verifyNeighborhood()}
            style={({ pressed }) => [styles.reverifyButton, pressed && styles.pressed]}
          >
            <Text style={styles.reverifyText}>{verifying ? "확인 중" : "GPS 재인증"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>TITLE MATCH</Text>
          <Text style={styles.sectionTitle}>이번 시즌 타이틀</Text>
        </View>
        <Text style={styles.sectionMeta}>매주 월요일 갱신</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.sportTabs}>
          {leagueSportOrder.map((sport) => {
            const active = sport === selectedSport;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={sport}
                onPress={() => selectSport(sport)}
                style={({ pressed }) => [
                  styles.sportTab,
                  active && styles.sportTabActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.sportMark, active && styles.sportMarkActive]}>
                  {leagueSports[sport].mark}
                </Text>
                <Text style={[styles.sportTabText, active && styles.sportTabTextActive]}>
                  {leagueSports[sport].short}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.titleCard}>
        <View style={styles.titleCardTop}>
          <View style={styles.titleMedal}>
            <Crown color="#12100F" size={27} strokeWidth={2.4} />
          </View>
          <View style={styles.titleIdentity}>
            <Text style={styles.titleLabel}>CURRENT TITLE</Text>
            <Text style={styles.localTitle}>
              {neighborhood} {currentContest.epithet}
            </Text>
            <Text style={styles.championName}>{currentContest.champion}</Text>
          </View>
        </View>
        <View style={styles.recordBand}>
          <View>
            <Text style={styles.recordLabel}>{currentContest.recordLabel}</Text>
            <Text style={styles.recordValue}>{currentContest.record}</Text>
          </View>
          <View style={styles.defenseBox}>
            <Text style={styles.defenseLabel}>방어 종료</Text>
            <Text style={styles.defenseTime}>{currentContest.defenseTime}</Text>
          </View>
        </View>
        <View style={styles.myRecordRow}>
          <View>
            <Text style={styles.myRecordLabel}>내 최고 기록</Text>
            <Text style={styles.myRecordValue}>{currentContest.myRecord}</Text>
          </View>
          <View style={styles.gapPill}>
            <Text style={styles.gapText}>{currentContest.gap}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={submitted}
          onPress={() => setChallengeOpen((current) => !current)}
          style={({ pressed }) => [
            styles.challengeButton,
            submitted && styles.challengeButtonSubmitted,
            pressed && styles.pressed,
          ]}
        >
          {submitted ? (
            <ShieldCheck color="#12100F" size={17} strokeWidth={2.5} />
          ) : (
            <Swords color="#12100F" size={17} strokeWidth={2.5} />
          )}
          <Text style={styles.challengeButtonText}>
            {submitted ? "기록 검증 중" : "내 기록으로 도전"}
          </Text>
        </Pressable>
      </View>

      {challengeOpen ? (
        <Card style={styles.challengeTicket}>
          <View style={styles.ticketHeading}>
            <View>
              <Text style={styles.ticketEyebrow}>CHALLENGE TICKET</Text>
              <Text style={styles.ticketTitle}>{currentContest.seasonGoal}</Text>
            </View>
            <Text style={styles.ticketRecord}>{currentContest.myRecord}</Text>
          </View>
          <View style={styles.checkList}>
            <Text style={styles.checkItem}>✓ 최근 30일 이내 기록</Text>
            <Text style={styles.checkItem}>✓ GPS·기기 데이터 연결됨</Text>
            <Text style={styles.checkItem}>✓ {neighborhood} 인증 범위 충족</Text>
          </View>
          <Text style={styles.ticketNote}>
            부정 기록은 자동 제외되며, 같은 기록이면 먼저 등록한 사용자가 우선입니다.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={submitChallenge}
            style={({ pressed }) => [styles.ticketButton, pressed && styles.pressed]}
          >
            <Text style={styles.ticketButtonText}>이 기록으로 제출</Text>
            <ChevronRight color="#FFFFFF" size={18} />
          </Pressable>
        </Card>
      ) : null}

      {notice ? (
        <View style={styles.notice}>
          <ShieldCheck color={colors.primary} size={17} strokeWidth={2.4} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <Card style={styles.rankCard}>
        <View style={styles.rankHeader}>
          <View>
            <Text style={styles.rankEyebrow}>LIVE RANK</Text>
            <Text style={styles.rankTitle}>
              {neighborhood} {leagueSports[selectedSport].short}
            </Text>
          </View>
          <View style={styles.entrants}>
            <Text style={styles.entrantsValue}>{currentContest.entrants}</Text>
            <Text style={styles.entrantsLabel}>참가자</Text>
          </View>
        </View>
        {leaders.map((leader, index) => (
          <View key={leader.name} style={styles.rankRow}>
            <Text style={[styles.rankNumber, index === 0 && styles.rankNumberFirst]}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <View style={[styles.avatar, index === 0 && styles.avatarFirst]}>
              <Text style={[styles.avatarText, index === 0 && styles.avatarTextFirst]}>
                {leader.name.slice(0, 1)}
              </Text>
            </View>
            <Text style={styles.rankerName}>{leader.name}</Text>
            <View style={styles.rankValueArea}>
              <Text style={styles.rankerValue}>{leader.value}</Text>
              <Text style={styles.rankMovement}>{leader.movement}</Text>
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>쟁탈 규칙</Text>
        </View>
      </View>
      <View style={styles.rulesRow}>
        <View style={styles.ruleCard}>
          <Clock3 color={colors.primary} size={21} strokeWidth={2.4} />
          <Text style={styles.ruleNumber}>01</Text>
          <Text style={styles.ruleTitle}>7일 방어</Text>
          <Text style={styles.ruleCopy}>타이틀을 일주일 지키면 시즌 메달이 확정됩니다.</Text>
        </View>
        <View style={styles.ruleCard}>
          <ShieldCheck color={colors.primary} size={21} strokeWidth={2.4} />
          <Text style={styles.ruleNumber}>02</Text>
          <Text style={styles.ruleTitle}>검증 기록만</Text>
          <Text style={styles.ruleCopy}>GPS·센서·장소 인증을 통과한 기록만 경쟁합니다.</Text>
        </View>
      </View>

      <View style={styles.vault}>
        <View style={styles.vaultHeading}>
          <View>
            <Text style={styles.vaultEyebrow}>SEASON MEDAL VAULT</Text>
            <Text style={styles.vaultTitle}>동네를 대표한 증거</Text>
          </View>
          <Trophy color="#FF5A32" size={25} strokeWidth={2.2} />
        </View>
        <View style={styles.medalRow}>
          {leagueSportOrder.slice(0, 4).map((sport, index) => (
            <View key={sport} style={styles.medalSlot}>
              <View style={[styles.medalOrb, index === 0 && styles.medalOrbEarned]}>
                <Text style={[styles.medalOrbText, index === 0 && styles.medalOrbTextEarned]}>
                  {leagueSports[sport].mark}
                </Text>
              </View>
              <Text style={styles.medalName}>{leagueSports[sport].short}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.medalCode}>
          {currentContest.medalCode} · 실물 메달 신청은 시즌 종료 후 오픈
        </Text>
      </View>

      <View style={styles.labDivider} />
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
    pressed: { opacity: 0.78 },
    versionRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: 2,
    },
    version: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 11,
      letterSpacing: 1.5,
    },
    pageTitle: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 30,
      letterSpacing: -1,
      marginTop: 2,
    },
    seasonBadge: {
      backgroundColor: colors.ink,
      borderRadius: radius.full,
      paddingHorizontal: 11,
      paddingVertical: 7,
      marginBottom: 4,
    },
    seasonText: {
      color: colors.background,
      fontFamily: fonts.display,
      fontSize: 9,
      letterSpacing: 1,
    },
    hero: {
      minHeight: 204,
      backgroundColor: "#171513",
      borderRadius: radius["3xl"],
      padding: 20,
      overflow: "hidden",
      justifyContent: "space-between",
    },
    heroGlow: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      right: -72,
      top: -82,
      backgroundColor: "#39211A",
      borderWidth: 22,
      borderColor: "#241A16",
    },
    heroTop: { flexDirection: "row", alignItems: "center" },
    pinShell: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#2B201C",
      alignItems: "center",
      justifyContent: "center",
    },
    heroLocation: { flex: 1, marginLeft: 12 },
    heroEyebrow: { color: "#9E928A", fontFamily: fonts.display, fontSize: 8, letterSpacing: 1.5 },
    neighborhood: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 25, marginTop: 1 },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "#FF5A32",
      borderRadius: radius.full,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    verifiedText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 9 },
    heroCopy: {
      maxWidth: 290,
      color: "#FFFFFF",
      fontFamily: fonts.bold,
      fontSize: 18,
      lineHeight: 28,
      marginTop: 16,
    },
    verificationRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: "#302B28",
      paddingTop: 14,
      marginTop: 18,
      gap: 8,
    },
    verificationMessage: { flex: 1, color: "#A89E98", fontFamily: fonts.regular, fontSize: 9 },
    reverifyButton: {
      borderWidth: 1,
      borderColor: "#4A423D",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    reverifyText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 9 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginTop: 6,
    },
    sectionEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.4,
    },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20, marginTop: 3 },
    sectionMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, marginBottom: 3 },
    sportTabs: { flexDirection: "row", gap: 9, paddingRight: 20 },
    sportTab: {
      width: 62,
      height: 69,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    sportTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sportMark: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 16 },
    sportMarkActive: { color: "#FFFFFF" },
    sportTabText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 9 },
    sportTabTextActive: { color: "#FFFFFF" },
    titleCard: { backgroundColor: "#171513", borderRadius: radius["3xl"], padding: 20, gap: 16 },
    titleCardTop: { flexDirection: "row", alignItems: "center" },
    titleMedal: {
      width: 59,
      height: 59,
      borderRadius: 30,
      backgroundColor: "#FF5A32",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 5,
      borderColor: "#45261E",
    },
    titleIdentity: { marginLeft: 13 },
    titleLabel: { color: "#83766E", fontFamily: fonts.display, fontSize: 8, letterSpacing: 1.3 },
    localTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 22, marginTop: 2 },
    championName: { color: "#FF6A44", fontFamily: fonts.semibold, fontSize: 11, marginTop: 2 },
    recordBand: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: "#302B28",
      paddingVertical: 15,
    },
    recordLabel: { color: "#83766E", fontFamily: fonts.display, fontSize: 8, letterSpacing: 1.1 },
    recordValue: {
      color: "#FFFFFF",
      fontFamily: fonts.displayExtra,
      fontSize: 32,
      letterSpacing: -1,
    },
    defenseBox: { alignItems: "flex-end" },
    defenseLabel: { color: "#83766E", fontFamily: fonts.regular, fontSize: 8 },
    defenseTime: { color: "#FFFFFF", fontFamily: fonts.display, fontSize: 11, marginTop: 3 },
    myRecordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    myRecordLabel: { color: "#83766E", fontFamily: fonts.regular, fontSize: 9 },
    myRecordValue: { color: "#FFFFFF", fontFamily: fonts.display, fontSize: 18, marginTop: 1 },
    gapPill: {
      backgroundColor: "#2B2420",
      borderRadius: radius.full,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    gapText: { color: "#FF7A58", fontFamily: fonts.semibold, fontSize: 9 },
    challengeButton: {
      minHeight: 48,
      borderRadius: radius.lg,
      backgroundColor: "#FF5A32",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    challengeButtonSubmitted: { backgroundColor: "#78D9A5" },
    challengeButtonText: { color: "#12100F", fontFamily: fonts.bold, fontSize: 12 },
    challengeTicket: { padding: 18, gap: 14, borderColor: colors.primary },
    ticketHeading: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    ticketEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.2,
    },
    ticketTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, marginTop: 3 },
    ticketRecord: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 22 },
    checkList: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      padding: 13,
      gap: 7,
    },
    checkItem: { color: colors.ink, fontFamily: fonts.medium, fontSize: 10 },
    ticketNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 9, lineHeight: 15 },
    ticketButton: {
      minHeight: 44,
      borderRadius: radius.md,
      backgroundColor: colors.ink,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    ticketButtonText: { color: colors.background, fontFamily: fonts.bold, fontSize: 11 },
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      padding: 12,
    },
    noticeText: {
      flex: 1,
      color: colors.ink,
      fontFamily: fonts.semibold,
      fontSize: 10,
      lineHeight: 16,
    },
    rankCard: { padding: 18, gap: 0 },
    rankHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    rankEyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.2,
    },
    rankTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
    entrants: { alignItems: "flex-end" },
    entrantsValue: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 16 },
    entrantsLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 8 },
    rankRow: {
      minHeight: 57,
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rankNumber: { width: 30, color: colors.muted, fontFamily: fonts.display, fontSize: 11 },
    rankNumberFirst: { color: colors.primary },
    avatar: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 9,
    },
    avatarFirst: { backgroundColor: colors.ink },
    avatarText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10 },
    avatarTextFirst: { color: colors.background },
    rankerName: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 11 },
    rankValueArea: { alignItems: "flex-end" },
    rankerValue: { color: colors.ink, fontFamily: fonts.displayExtra, fontSize: 12 },
    rankMovement: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 8, marginTop: 1 },
    rulesRow: { flexDirection: "row", gap: 10 },
    ruleCard: {
      flex: 1,
      minHeight: 166,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xl,
      padding: 15,
    },
    ruleNumber: {
      color: colors.border,
      fontFamily: fonts.displayExtra,
      fontSize: 28,
      marginTop: 11,
    },
    ruleTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, marginTop: -4 },
    ruleCopy: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
      lineHeight: 15,
      marginTop: 7,
    },
    vault: { backgroundColor: "#171513", borderRadius: radius["3xl"], padding: 19 },
    vaultHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    vaultEyebrow: {
      color: "#FF5A32",
      fontFamily: fonts.displayExtra,
      fontSize: 8,
      letterSpacing: 1.1,
    },
    vaultTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18, marginTop: 3 },
    medalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
    medalSlot: { width: "23%", alignItems: "center" },
    medalOrb: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: "#3C3531",
      backgroundColor: "#211E1B",
      alignItems: "center",
      justifyContent: "center",
    },
    medalOrbEarned: { backgroundColor: "#FF5A32", borderColor: "#FF8B6E" },
    medalOrbText: { color: "#665A54", fontFamily: fonts.displayExtra, fontSize: 15 },
    medalOrbTextEarned: { color: "#FFFFFF" },
    medalName: { color: "#B5A9A2", fontFamily: fonts.semibold, fontSize: 8, marginTop: 6 },
    medalCode: {
      color: "#766B64",
      fontFamily: fonts.regular,
      fontSize: 8,
      marginTop: 17,
      textAlign: "center",
    },
    labDivider: { height: 1, backgroundColor: colors.border, marginVertical: 11 },
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
