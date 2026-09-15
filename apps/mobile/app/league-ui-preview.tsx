import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Flame,
  Layers2,
  MapPin,
  ShieldCheck,
  Trophy,
  X,
  Zap,
} from "lucide-react-native";
import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wordmark } from "../src/components/ui";
import { fonts } from "../src/theme";
import {
  leagueConcepts,
  leaguePreviewSnapshot,
  leaguePreviewSports,
  type LeagueConceptId,
  type PreviewPlayer,
} from "../src/previews/league-ui-concepts";

const ORANGE = "#FF5A36";
const INK = "#F5F3EE";
const MUTED = "#9C9F99";
const LINE = "#30342F";
type Snapshot = ReturnType<typeof leaguePreviewSnapshot>;
type DialogKind = "rules" | "records" | "ranking" | "region";
const number = (value: number) => value.toLocaleString("ko-KR");

export default function LeagueUiPreview() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<LeagueConceptId>(1);
  const [compare, setCompare] = useState(false);
  const [sport, setSport] = useState(0);
  const [overtake, setOvertake] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const snapshot = leaguePreviewSnapshot(sport, overtake);
  const concept = leagueConcepts.find((item) => item.id === selected)!;
  const available = Math.min(width - 24, 1440);
  const columns = width >= 1160 ? 3 : width >= 760 ? 2 : 1;
  const cardWidth = Math.min(440, compare ? (available - (columns - 1) * 20) / columns : available);

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.pageContent}>
        <View style={s.lab}>
          <View style={s.labTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="기존 리그로 돌아가기"
              onPress={() => router.push("/knowledge")}
              style={s.back}
            >
              <ArrowLeft size={19} color={INK} />
            </Pressable>
            <View style={s.flex}>
              <Text style={s.labEyebrow}>GROOV / DESIGN STUDY</Text>
              <Text style={s.labTitle}>리그, 다섯 가지 방향</Text>
            </View>
            <Text style={s.previewBadge}>미적용 시안</Text>
          </View>
          <Text style={s.labNote}>
            동네 → 내 순위·점수 → 참여 현황 → 개인 랭킹 → 지역 순위. 큰 구성은 그대로, 경쟁의
            분위기만 다르게.
          </Text>
          <View style={s.optionRow}>
            {leagueConcepts.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: !compare && selected === item.id }}
                accessibilityLabel={`${item.id}안 ${item.name}`}
                onPress={() => {
                  setSelected(item.id);
                  setCompare(false);
                }}
                style={[s.option, !compare && selected === item.id && s.optionOn]}
              >
                <Text style={[s.optionNumber, !compare && selected === item.id && s.black]}>
                  {String(item.id).padStart(2, "0")}
                </Text>
                <Text style={[s.optionName, !compare && selected === item.id && s.black]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.tools}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: compare }}
              onPress={() => setCompare(!compare)}
              style={[s.toolButton, compare && s.toolOn]}
            >
              <Layers2 size={15} color={compare ? ORANGE : INK} />
              <Text style={s.toolText}>{compare ? "한 안씩 보기" : "5안 한눈에 비교"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="라이벌 역전 상황 예시"
              accessibilityState={{ checked: overtake }}
              onPress={() => setOvertake(!overtake)}
              style={[s.toolButton, overtake && s.toolOn]}
            >
              {overtake ? <Check size={15} color={ORANGE} /> : <Zap size={15} color={INK} />}
              <Text style={s.toolText}>라이벌 역전 예시</Text>
            </Pressable>
          </View>
          <Text style={s.disclaimer}>
            동일한 가상 데이터로 비교합니다. 실제 기록·순위·공유앱에는 영향을 주지 않습니다.
          </Text>
        </View>

        {!compare && (
          <View style={[s.direction, { maxWidth: 440 }]}>
            <Text style={s.directionCode}>
              {String(concept.id).padStart(2, "0")} / {concept.code}
            </Text>
            <Text style={s.directionNote}>{concept.note}</Text>
          </View>
        )}
        <View style={s.frames}>
          {(compare ? leagueConcepts : [concept]).map((item) => (
            <View key={item.id} style={{ width: cardWidth }}>
              {compare && (
                <View style={s.compareCaption}>
                  <Text style={s.directionCode}>
                    {String(item.id).padStart(2, "0")} / {item.name}
                  </Text>
                  <Text style={s.directionNote}>{item.note}</Text>
                </View>
              )}
              <LeagueConcept
                id={item.id}
                snapshot={snapshot}
                sport={sport}
                onSport={setSport}
                onDialog={setDialog}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={dialog !== null}
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={s.scrim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="미리보기 상세 닫기"
            onPress={() => setDialog(null)}
          />
          <View style={s.dialog} accessibilityViewIsModal>
            <View style={s.dialogHeader}>
              <Text style={s.sectionTitle}>
                {dialog === "rules"
                  ? "디자인 미리보기 안내"
                  : dialog === "ranking"
                    ? `${leaguePreviewSports[sport]} 개인 랭킹`
                    : dialog === "records"
                      ? "집계 기록 예시"
                      : "지역 순위 예시"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="닫기"
                onPress={() => setDialog(null)}
                style={s.back}
              >
                <X color={INK} size={22} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.dialogBody}>
              <Text style={s.helper}>가상 데이터 · 실제 집계 결과 아님</Text>
              {dialog === "rules" && (
                <Text style={s.ruleText}>
                  현재 리그의 구성과 기능 흐름을 유지한 디자인 비교입니다.{"\n\n"}종목을 누르면 해당
                  종목의 샘플 점수가 표시됩니다. ‘라이벌 역전 예시’를 켜면 경쟁자의 점수가 올라간
                  상황을 다섯 가지 디자인에서 비교할 수 있습니다.{"\n\n"}실제 리그의 점수 공식, GPS
                  기록, 회원 데이터, 로고는 변경하지 않았습니다.
                </Text>
              )}
              {dialog === "ranking" &&
                snapshot.players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    id={selected}
                    max={snapshot.maxPoints}
                  />
                ))}
              {dialog === "records" && (
                <>
                  <Text style={s.dialogNumber}>
                    {snapshot.mine.count}
                    <Text style={s.helper}>회</Text>
                  </Text>
                  <Text style={s.ruleText}>
                    내 {leaguePreviewSports[sport]} 기록에 연결되는 상세 화면 자리입니다. 이번
                    시안에는 실제 운동 기록을 불러오거나 저장하지 않습니다.
                  </Text>
                </>
              )}
              {dialog === "region" &&
                [
                  ["현재 동네", "12,840"],
                  ["옆 동네", "12,310"],
                  ["강변 동네", "11,920"],
                ].map(([name, score], index) => (
                  <View key={name} style={s.regionExample}>
                    <Text style={s.orange}>{index + 1}</Text>
                    <Text style={[s.playerName, s.flex]}>{name}</Text>
                    <Text style={s.playerScore}>
                      {score}
                      <Text style={s.helper}>pt</Text>
                    </Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function LeagueConcept({
  id,
  snapshot,
  sport,
  onSport,
  onDialog,
}: {
  id: LeagueConceptId;
  snapshot: Snapshot;
  sport: number;
  onSport: (index: number) => void;
  onDialog: (kind: DialogKind) => void;
}) {
  const light = id === 3;
  return (
    <View style={[s.frame, id === 5 && s.editorialFrame]}>
      <View style={s.brandRow}>
        <Wordmark size={28} />
        <Text style={s.issue}>LOCAL LEAGUE</Text>
      </View>
      <View style={s.body}>
        <View style={[s.location, id === 4 && s.heatLocation]}>
          <MapPin size={20} color={ORANGE} strokeWidth={1.8} />
          <View style={s.flex}>
            <Text style={s.locationTitle}>현재 동네</Text>
            <Text style={s.locationMeta}>2026 가을 시즌 · 샘플 리그</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="집계 규칙 미리보기"
            style={s.rulesButton}
            onPress={() => onDialog("rules")}
          >
            <ShieldCheck size={17} color={MUTED} />
            <Text style={s.rulesText}>규칙</Text>
          </Pressable>
        </View>

        <View
          style={[
            s.hero,
            id === 2 && s.rivalBorder,
            id === 3 && s.seasonBorder,
            id === 4 && s.heatBorder,
            id === 5 && s.editorialHero,
          ]}
        >
          <Hero id={id} snapshot={snapshot} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="내 집계 기록 예시 보기"
            onPress={() => onDialog("records")}
            style={[s.recordStrip, light && s.recordStripLight]}
          >
            <Text style={[s.recordLabel, light && s.black]}>집계 기록</Text>
            <Text style={[s.recordValue, light && s.black]}>{snapshot.mine.count}회</Text>
            <View style={s.flex} />
            <Text style={[s.recordHint, light && s.darkMuted]}>내 기록 보기</Text>
            <ChevronRight size={17} color={light ? "#181B17" : ORANGE} />
          </Pressable>
        </View>

        <View style={[s.metrics, id === 3 && s.metricsCards, id === 4 && s.metricsHeat]}>
          {[
            ["지역 인원", `${snapshot.members}`, "명"],
            ["참여 인원", `${snapshot.participants}`, "명"],
            ["참여율", snapshot.participation, "%"],
          ].map(([label, value, unit], index) => (
            <View
              key={label}
              style={[s.metric, index > 0 && s.metricDivider, id === 3 && s.metricCard]}
            >
              <Text style={s.metricLabel}>{label}</Text>
              <Text style={[s.metricValue, id === 4 && index === 2 && s.orange]}>
                {value}
                <Text style={s.metricUnit}>{unit}</Text>
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.ranking, id === 5 && s.editorialRanking]}>
          <View style={s.rankingHead}>
            <View style={s.flex}>
              <Text style={s.eyebrow}>
                {id === 2 ? "THE NEXT RIVAL" : id === 4 ? "WHO'S MOVING" : "NEAR MY RANK"}
              </Text>
              <Text style={s.sectionTitle}>지역 개인 랭킹</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => onDialog("ranking")}
              style={s.viewAll}
            >
              <Text style={s.viewAllText}>전체 보기</Text>
              <ArrowUpRight size={15} color={MUTED} />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.sports}
          >
            {leaguePreviewSports.map((label, index) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityState={{ selected: index === sport }}
                onPress={() => onSport(index)}
                style={[s.sport, index === sport && s.sportOn]}
              >
                <Text style={[s.sportText, index === sport && s.orange]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.players}>
            {snapshot.nearby.map((player) => (
              <PlayerRow key={player.id} player={player} id={id} max={snapshot.maxPoints} />
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지역 점수와 순위 예시 보기"
          onPress={() => onDialog("region")}
          style={[
            s.regionCta,
            id === 2 && s.rivalCta,
            id === 3 && s.seasonCta,
            id === 5 && s.editorialCta,
          ]}
        >
          <View style={s.flex}>
            <Text style={[s.eyebrow, id === 5 && s.black]}>REGION RANKING</Text>
            <Text style={[s.ctaTitle, id === 5 && s.black]}>지역 점수와 순위 보기</Text>
            <Text style={[s.ctaNote, id === 5 && s.black]}>우리 동네의 다음 상대는?</Text>
          </View>
          <View style={[s.ctaArrow, id === 5 && s.ctaArrowDark]}>
            <ArrowRight size={22} color={id === 5 ? INK : "#0A0D0B"} />
          </View>
        </Pressable>
        <Text style={s.frameFoot}>DESIGN PREVIEW · 실제 순위가 아닌 샘플입니다</Text>
      </View>
    </View>
  );
}

function Hero({ id, snapshot: data }: { id: LeagueConceptId; snapshot: Snapshot }) {
  const lead = data.mine.rank === 1;
  if (id === 1)
    return (
      <LinearGradient colors={["#1B211B", "#101410", "#0C100C"]} style={s.heroInner}>
        <View pointerEvents="none" style={s.trackLines}>
          {[0, 1, 2, 3].map((line) => (
            <View
              key={line}
              style={[
                s.trackLine,
                { right: line * 14, width: 100 + line * 14, height: 172 + line * 14 },
              ]}
            />
          ))}
        </View>
        <Text style={s.eyebrow}>REGIONAL LEAGUE / 2026</Text>
        <Text style={s.heroTitle}>{lead ? "지금, 선두를\n달리는 중." : "한 칸 더,\n앞으로."}</Text>
        <RankScore data={data} />
        <View style={s.paceNote}>
          <View style={s.shortLine} />
          <Text style={s.gapText}>{data.gapLabel}</Text>
          <ArrowUpRight size={16} color={ORANGE} />
        </View>
      </LinearGradient>
    );
  if (id === 2)
    return (
      <View style={[s.heroInner, s.rivalInner]}>
        <View style={s.heroTop}>
          <Text style={s.eyebrow}>RIVAL MATCH</Text>
          <View style={s.matchTag}>
            <Zap size={13} color={ORANGE} />
            <Text style={s.tagText}>접전 포인트</Text>
          </View>
        </View>
        <Text style={s.heroTitle}>
          {lead ? "1위는, 지키는 게\n더 재밌지." : "바로 위가\n사정권."}
        </Text>
        <RankScore data={data} />
        <View style={s.rivalRibbon}>
          <View style={s.rivalAvatar}>
            <Text style={s.avatarText}>{data.rival.initials}</Text>
          </View>
          <View style={s.flex}>
            <Text style={s.rivalName}>
              {data.rival.rank}위 {data.rival.name}
            </Text>
            <Text style={s.helper}>
              {number(data.rival.points)}pt · {lead ? "나를 추격하는 중" : "내 앞의 라이벌"}
            </Text>
          </View>
          <View>
            <Text style={s.gapNumber}>
              {number(data.gap)}
              <Text style={s.smallUnit}>pt</Text>
            </Text>
            <Text style={s.gapCaption}>{lead ? "점수 차이" : "다음 순위까지"}</Text>
          </View>
        </View>
      </View>
    );
  if (id === 3)
    return (
      <View style={[s.heroInner, s.paper]}>
        <View style={s.heroTop}>
          <Text style={[s.eyebrow, s.black]}>MY SEASON SCORECARD</Text>
          <Text style={s.seasonIndex}>2026 / FALL</Text>
        </View>
        <Text style={[s.heroTitle, s.black]}>올가을,{"\n"}나의 스코어.</Text>
        <View style={s.paperRule} />
        <RankScore data={data} light />
        <View style={s.paperBottom}>
          <View style={s.paperSeal}>
            <Trophy size={16} color={ORANGE} />
            <Text style={s.paperSealText}>{lead ? "SEASON LEADER" : "KEEP MOVING"}</Text>
          </View>
          <Text style={s.paperGap}>{data.gapLabel}</Text>
        </View>
      </View>
    );
  if (id === 4)
    return (
      <LinearGradient colors={["#281C13", "#12140F", "#0D120E"]} style={s.heroInner}>
        <View style={s.heroTop}>
          <Text style={s.eyebrow}>NEIGHBORHOOD HEAT</Text>
          <Flame color={ORANGE} size={22} />
        </View>
        <Text style={s.heroTitle}>함께 뛰는 동네,{"\n"}뜨거워지는 순위.</Text>
        <RankScore data={data} glow />
        <View style={s.heatMeter}>
          <View style={s.heatMeterLabels}>
            <Text style={s.helper}>동네 참여 열기</Text>
            <Text style={s.heatPercent}>{data.participation}%</Text>
          </View>
          <View style={s.heatSegments}>
            {Array.from({ length: data.members }, (_, index) => (
              <View
                key={index}
                style={[s.heatSegment, index < data.participants && s.heatSegmentOn]}
              />
            ))}
          </View>
          <Text style={s.heatFoot}>19명 중 16명이 이번 시즌에 참여했어요.</Text>
        </View>
      </LinearGradient>
    );
  return (
    <View style={[s.heroInner, s.editionInner]}>
      <Image
        source={require("../assets/images/profile/medal-texture-v3.png")}
        style={s.editionTexture}
        resizeMode="cover"
        accessible={false}
      />
      <View style={s.heroTop}>
        <Text style={s.eyebrow}>THE LOCAL LEAGUE</Text>
        <Text style={s.editionIssue}>VOL. 2026</Text>
      </View>
      <Text style={s.editionHeadline}>MOVE UP.</Text>
      <Text style={s.editionSub}>기록이 곧, 나의 순위.</Text>
      <View style={s.editionScore}>
        <View style={s.editionRank}>
          <Text style={s.eyebrow}>MY RANK</Text>
          <Text style={s.editionRankNumber}>{String(data.mine.rank).padStart(2, "0")}</Text>
        </View>
        <View style={s.editionPointBox}>
          <Text style={s.editionPointLabel}>SEASON POINTS</Text>
          <Text style={s.editionPoints} adjustsFontSizeToFit numberOfLines={1}>
            {number(data.mine.points)}
          </Text>
          <View style={s.editionPointBottom}>
            <Text style={s.editionPt}>PT</Text>
            <ArrowUpRight size={28} color="#101410" />
          </View>
        </View>
      </View>
      <View style={s.editionBottom}>
        <Text style={s.helper}>/{data.players.length} PLAYERS</Text>
        <Text style={s.gapText}>{data.gapLabel}</Text>
      </View>
    </View>
  );
}

function RankScore({
  data,
  light = false,
  glow = false,
}: {
  data: Snapshot;
  light?: boolean;
  glow?: boolean;
}) {
  return (
    <View style={s.rankScore}>
      <View style={s.rankPart}>
        <Text style={[s.kicker, light && s.darkMuted]}>MY RANK</Text>
        <View style={s.rankBaseline}>
          <Text style={[s.rankNumber, light && s.black, glow && s.rankGlow]}>
            {String(data.mine.rank).padStart(2, "0")}
          </Text>
          <Text style={[s.rankDenominator, light && s.darkMuted]}>/{data.players.length}</Text>
        </View>
      </View>
      <View style={s.pointsPart}>
        <Text style={[s.kicker, light && s.darkMuted]}>2026 가을 시즌</Text>
        <Text style={[s.points, light && s.black]} adjustsFontSizeToFit numberOfLines={1}>
          {number(data.mine.points)}
          <Text style={s.pointUnit}>pt</Text>
        </Text>
        <View style={s.rankStatus}>
          {data.mine.rank === 1 ? (
            <Trophy color={light ? "#222A23" : ORANGE} size={14} />
          ) : (
            <ArrowUpRight color={ORANGE} size={14} />
          )}
          <Text style={[s.rankStatusText, light && s.darkMuted]}>
            {data.mine.rank === 1 ? "현재 선두" : "다음 순위를 향해"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PlayerRow({
  player,
  id,
  max,
}: {
  player: PreviewPlayer;
  id: LeagueConceptId;
  max: number;
}) {
  const percent = (player.points / max) * 100;
  return (
    <View
      style={[
        s.player,
        player.mine && s.playerMine,
        id === 2 && player.mine && s.playerRival,
        id === 5 && player.mine && s.playerEdition,
      ]}
    >
      <Text style={[s.playerRank, player.mine && s.orange]}>
        {String(player.rank).padStart(2, "0")}
      </Text>
      <View style={[s.avatar, player.mine && s.avatarMine, id === 5 && s.avatarSquare]}>
        <Text style={s.avatarText}>{player.initials}</Text>
      </View>
      <View style={s.flex}>
        <View style={s.playerTop}>
          <Text style={[s.playerName, player.mine && s.orange]} numberOfLines={1}>
            {player.name}
            {player.mine ? " · 나" : ""}
          </Text>
          <Text style={[s.playerScore, player.mine && s.orange]}>
            {number(player.points)}
            <Text style={s.smallUnit}>pt</Text>
          </Text>
        </View>
        <View style={s.playerMeta}>
          <Text style={s.helper}>집계 기록 {player.count}회</Text>
          {id === 2 && player.rank === 1 && <Text style={s.leading}>LEADING</Text>}
        </View>
        {(id === 1 || id === 4) && (
          <View style={[s.playerProgress, id === 4 && s.playerProgressHeat]}>
            <View
              style={[
                s.playerProgressFill,
                { width: `${percent}%`, backgroundColor: player.mine ? ORANGE : "#626A60" },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#161A17" },
  pageContent: { padding: 12, paddingBottom: 48, alignItems: "center" },
  lab: {
    width: "100%",
    maxWidth: 1440,
    padding: 16,
    borderWidth: 1,
    borderColor: "#3B403A",
    backgroundColor: "#1C211D",
    marginBottom: 22,
  },
  labTop: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  labEyebrow: { color: MUTED, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1.4 },
  labTitle: { color: INK, fontFamily: fonts.bold, fontSize: 22, lineHeight: 32 },
  previewBadge: {
    color: ORANGE,
    fontFamily: fonts.medium,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#74523D",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  labNote: {
    color: "#B7BCB4",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 760,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  option: {
    minHeight: 52,
    minWidth: 124,
    flexGrow: 1,
    flexBasis: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#42483F",
  },
  optionOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  optionNumber: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 20 },
  optionName: { color: INK, fontFamily: fonts.bold, fontSize: 14 },
  black: { color: "#101510" },
  darkMuted: { color: "#5C6359" },
  tools: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: LINE,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  toolOn: { borderColor: ORANGE },
  toolText: { fontFamily: fonts.medium, fontSize: 13, color: INK },
  disclaimer: {
    color: MUTED,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 10,
  },
  direction: { width: "100%", marginBottom: 14, gap: 6 },
  directionCode: {
    color: ORANGE,
    fontFamily: fonts.displayExtra,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  directionNote: { color: "#BFC5BB", fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
  frames: {
    width: "100%",
    maxWidth: 1440,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  compareCaption: { minHeight: 102, gap: 7, paddingVertical: 12 },
  frame: { backgroundColor: "#0A0E0A", borderWidth: 1, borderColor: "#333A32", overflow: "hidden" },
  editorialFrame: { backgroundColor: "#0B0D0B" },
  brandRow: {
    minHeight: 78,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    gap: 12,
  },
  issue: { fontSize: 12, fontFamily: fonts.display, color: MUTED, letterSpacing: 1.1 },
  body: { padding: 16, gap: 16 },
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 74,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#111711",
  },
  heatLocation: { borderColor: "#55412B" },
  locationTitle: { color: INK, fontFamily: fonts.bold, fontSize: 16 },
  locationMeta: {
    color: MUTED,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  rulesButton: { flexDirection: "row", gap: 4, minHeight: 44, alignItems: "center" },
  rulesText: { color: MUTED, fontFamily: fonts.medium, fontSize: 12 },
  hero: { borderWidth: 1, borderColor: "#384033", overflow: "hidden" },
  heroInner: {
    padding: 18,
    minHeight: 318,
    justifyContent: "space-between",
    gap: 16,
    overflow: "hidden",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  eyebrow: {
    color: ORANGE,
    fontFamily: fonts.displayExtra,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: INK,
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 35,
    letterSpacing: -1,
  },
  rankScore: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  rankPart: { flex: 1.1 },
  kicker: {
    color: MUTED,
    fontFamily: fonts.display,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.8,
  },
  rankBaseline: { flexDirection: "row", alignItems: "baseline" },
  rankNumber: {
    color: ORANGE,
    fontFamily: fonts.displayExtra,
    fontSize: 76,
    lineHeight: 86,
    letterSpacing: -5,
    flexShrink: 1,
  },
  rankDenominator: { color: MUTED, fontFamily: fonts.display, fontSize: 17, marginLeft: 5 },
  pointsPart: { flex: 1.2, paddingBottom: 10, minWidth: 0 },
  points: {
    color: INK,
    fontFamily: fonts.displayExtra,
    fontSize: 32,
    lineHeight: 42,
    letterSpacing: -1,
  },
  pointUnit: { fontSize: 14, letterSpacing: 0 },
  rankStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  rankStatusText: { color: MUTED, fontFamily: fonts.medium, fontSize: 12 },
  trackLines: {
    position: "absolute",
    right: -64,
    top: -35,
    width: 160,
    height: 250,
    opacity: 0.55,
  },
  trackLine: {
    position: "absolute",
    top: 0,
    borderWidth: 1,
    borderColor: "#AA5634",
    borderBottomLeftRadius: 96,
  },
  paceNote: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 7 },
  shortLine: { width: 30, height: 3, backgroundColor: ORANGE },
  gapText: { fontFamily: fonts.medium, fontSize: 12, color: "#D5D9CF" },
  recordStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    backgroundColor: "#1B211B",
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  recordStripLight: { backgroundColor: "#DEDFD7", borderTopColor: "#C1C5B9" },
  recordLabel: { color: MUTED, fontFamily: fonts.medium, fontSize: 12 },
  recordValue: { color: INK, fontFamily: fonts.bold, fontSize: 15 },
  recordHint: { color: MUTED, fontFamily: fonts.regular, fontSize: 12 },
  rivalBorder: { borderColor: "#A14C30", borderTopWidth: 4, borderTopColor: ORANGE },
  rivalInner: { backgroundColor: "#181611", paddingBottom: 0 },
  matchTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  tagText: { color: ORANGE, fontFamily: fonts.medium, fontSize: 12 },
  rivalRibbon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#302317",
    padding: 10,
    marginHorizontal: -18,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: "#725037",
  },
  rivalAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#555448",
    alignItems: "center",
    justifyContent: "center",
  },
  rivalName: { color: INK, fontFamily: fonts.bold, fontSize: 12 },
  gapNumber: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 22, textAlign: "right" },
  gapCaption: { color: MUTED, fontFamily: fonts.regular, fontSize: 12, textAlign: "right" },
  seasonBorder: { borderColor: "#DADDD2" },
  paper: { backgroundColor: "#EEF0E7" },
  seasonIndex: { color: "#626C5D", fontFamily: fonts.display, fontSize: 12 },
  paperRule: { height: 1, backgroundColor: "#BFC7B6" },
  paperBottom: { gap: 8 },
  paperSeal: { flexDirection: "row", gap: 6, alignItems: "center" },
  paperSealText: {
    color: "#272F23",
    fontFamily: fonts.displayExtra,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  paperGap: { color: "#68715F", fontFamily: fonts.medium, fontSize: 12 },
  heatBorder: { borderColor: "#75452A" },
  rankGlow: {
    textShadowColor: "#FF5A3677",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  heatMeter: { gap: 8 },
  heatMeterLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heatPercent: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 16 },
  heatSegments: { flexDirection: "row", gap: 3 },
  heatSegment: { flex: 1, height: 12, backgroundColor: "#323729", borderRadius: 1 },
  heatSegmentOn: { backgroundColor: ORANGE, boxShadow: "0 0 7px #FF5A3644" },
  heatFoot: { color: MUTED, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  editorialHero: { borderColor: "#343D32" },
  editionInner: { paddingTop: 16, gap: 8, backgroundColor: "#141A13" },
  editionTexture: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.13,
  },
  editionIssue: { color: MUTED, fontFamily: fonts.display, fontSize: 12 },
  editionHeadline: {
    color: INK,
    fontFamily: fonts.displayItalic,
    fontSize: 42,
    lineHeight: 49,
    letterSpacing: -2,
  },
  editionSub: { color: INK, fontFamily: fonts.bold, fontSize: 17 },
  editionScore: { flexDirection: "row", gap: 12, marginTop: 6, alignItems: "stretch" },
  editionRank: { flex: 1, justifyContent: "center" },
  editionRankNumber: {
    color: INK,
    fontFamily: fonts.displayItalic,
    fontSize: 89,
    lineHeight: 100,
    letterSpacing: -7,
  },
  editionPointBox: {
    flex: 1.2,
    backgroundColor: ORANGE,
    padding: 12,
    justifyContent: "space-between",
  },
  editionPointLabel: {
    color: "#292714",
    fontFamily: fonts.displayExtra,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  editionPoints: {
    color: "#101410",
    fontFamily: fonts.displayExtra,
    fontSize: 37,
    lineHeight: 50,
    letterSpacing: -1.7,
  },
  editionPt: { color: "#101410", fontFamily: fonts.displayExtra, fontSize: 14 },
  editionPointBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editionBottom: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingTop: 9 },
  metrics: { flexDirection: "row", paddingVertical: 10 },
  metric: { flex: 1, alignItems: "center", gap: 5 },
  metricDivider: { borderLeftWidth: 1, borderLeftColor: LINE },
  metricLabel: { color: MUTED, fontFamily: fonts.regular, fontSize: 12 },
  metricValue: { color: INK, fontFamily: fonts.displayExtra, fontSize: 24, lineHeight: 31 },
  metricUnit: { fontFamily: fonts.medium, fontSize: 13 },
  metricsCards: { gap: 6, paddingVertical: 0 },
  metricCard: {
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#111710",
  },
  metricsHeat: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#3C412E",
    paddingVertical: 14,
  },
  orange: { color: ORANGE },
  ranking: { borderWidth: 1, borderColor: LINE, paddingTop: 16 },
  editorialRanking: { borderWidth: 0, borderTopWidth: 3, borderTopColor: INK },
  rankingHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  sectionTitle: { color: INK, fontFamily: fonts.bold, fontSize: 18, lineHeight: 29, marginTop: 3 },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 44 },
  viewAllText: { color: MUTED, fontFamily: fonts.medium, fontSize: 12 },
  sports: { paddingHorizontal: 14, gap: 20, paddingTop: 10 },
  sport: {
    minHeight: 46,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sportOn: { borderBottomColor: ORANGE },
  sportText: { color: MUTED, fontFamily: fonts.bold, fontSize: 13 },
  players: { padding: 8, paddingTop: 0 },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 86,
    paddingHorizontal: 7,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  playerMine: { backgroundColor: "#332319", borderBottomColor: "#60432D" },
  playerRival: { borderLeftWidth: 3, borderLeftColor: ORANGE, paddingLeft: 4 },
  playerEdition: { backgroundColor: "#252A20" },
  playerRank: {
    width: 25,
    fontFamily: fonts.displayExtra,
    fontSize: 20,
    color: MUTED,
    letterSpacing: -1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252C23",
  },
  avatarMine: { backgroundColor: ORANGE },
  avatarSquare: { borderRadius: 4 },
  avatarText: { color: INK, fontFamily: fonts.bold, fontSize: 12 },
  playerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  playerName: { color: INK, fontFamily: fonts.bold, fontSize: 14, flexShrink: 1 },
  playerScore: { color: INK, fontFamily: fonts.displayExtra, fontSize: 17 },
  smallUnit: { fontFamily: fonts.display, fontSize: 12 },
  playerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  helper: { color: MUTED, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  leading: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 12 },
  playerProgress: { marginTop: 7, height: 2, backgroundColor: "#343B30", overflow: "hidden" },
  playerProgressHeat: { height: 4 },
  playerProgressFill: { height: "100%" },
  regionCta: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: ORANGE,
    padding: 14,
  },
  rivalCta: { backgroundColor: "#211A12" },
  seasonCta: { borderColor: "#6A745E", backgroundColor: "#151B12" },
  editorialCta: { backgroundColor: ORANGE },
  ctaTitle: { color: INK, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, marginTop: 4 },
  ctaNote: { color: MUTED, fontFamily: fonts.regular, fontSize: 12, marginTop: 5 },
  ctaArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaArrowDark: { backgroundColor: "#182016" },
  frameFoot: {
    color: "#737E6D",
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
  },
  scrim: {
    flex: 1,
    backgroundColor: "#000B",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: "#101610",
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  dialogBody: { padding: 16, gap: 10 },
  ruleText: { color: INK, fontFamily: fonts.regular, fontSize: 14, lineHeight: 25 },
  dialogNumber: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 54 },
  regionExample: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
});
