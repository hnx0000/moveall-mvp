import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, ArrowUpRight, Bell, Bookmark, CalendarDays, ChevronRight, Ellipsis, Heart, House, LayoutGrid, MessageCircle, Plus, Search, Trophy, UserRound, X } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Wordmark } from "../src/components/ui";
import { FeedLikeSurface } from "../src/components/feed-like-surface";
import { TapShareIcon } from "../src/components/tap-icons";
import { demoAvatarSources } from "../src/demo-avatars";
import { fonts } from "../src/theme";
import runningPhoto from "../assets/images/people/seoa/story-01.jpg";
import strengthPhoto from "../assets/images/people/taeo/story-01.jpg";
import swimmingPhoto from "../assets/images/instagram/story-pool-lane.jpg";
import hikingPhoto from "../assets/images/people/minji/story-01.jpg";

const ORANGE = "#FF5A36", WHITE = "#F5F5F2", MUTED = "#A2A6A2", LINE = "#303631", BLACK = "#090D0B";
const concepts = [
  { id: 1, name: "사진 몰입형", english: "EDGE TO EDGE", note: "사진은 넓게, 기록은 짧고 선명하게. 지금 피드에서 가장 자연스러운 업그레이드." },
  { id: 2, name: "스포츠 매거진", english: "THE MOVEMENT", note: "큰 종목 타이포와 편집된 여백. 운동 한 번을 한 페이지의 화보처럼." },
  { id: 3, name: "네온 기록형", english: "AFTER HOURS", note: "어두운 프레임, 얇은 네온, 선명한 기록. 그루비의 야간 운동 무드." },
  { id: 4, name: "운동 로그형", english: "FIELD NOTES", note: "사진 아래 붙은 밝은 기록표와 타임라인. 운동이 차곡차곡 쌓이는 느낌." },
  { id: 5, name: "크루 소셜형", english: "GOOD COMPANY", note: "사람과 대화를 더 가까이. 사진, 응원, 댓글이 하나로 연결되는 피드." },
] as const;
const samples = [
  { id: "run", user: "seoa.run", person: "demo-friend-7", photo: runningPhoto, sport: "RUNNING", label: "러닝", metric: "5.20", unit: "KM", duration: "31분 12초", detail: "6′00″ /km", location: "서울 · 잠실", time: "3시간 전", caption: "빠르지 않아도 괜찮아. 오늘도 내 페이스로.", tags: "#러닝 #잠실러닝 #오운완", likes: 128, comments: 8, following: true },
  { id: "strength", user: "taeo.lift", person: "demo-friend-6", photo: strengthPhoto, sport: "STRENGTH", label: "근력", metric: "18", unit: "SETS", duration: "1시간 08분", detail: "4,820 kg", location: "서울 · 성수", time: "4시간 전", caption: "마지막 한 세트까지. 어제보다 조금 더.", tags: "#근력 #성수 #운동기록", likes: 86, comments: 5, following: false },
  { id: "swim", user: "yuna.blue", person: "demo-friend-4", photo: swimmingPhoto, sport: "SWIMMING", label: "수영", metric: "1.50", unit: "KM", duration: "42분 30초", detail: "2′50″ /100m", location: "서울 · 송파", time: "5시간 전", caption: "물속에서는 모든 게 조금 더 고요해진다.", tags: "#수영 #자유형 #오운완", likes: 64, comments: 3, following: true },
  { id: "hike", user: "minji.trail", person: "demo-friend-1", photo: hikingPhoto, sport: "HIKING", label: "등산", metric: "8.40", unit: "KM", duration: "2시간 16분", detail: "↑ 620 m", location: "서울 · 북한산", time: "6시간 전", caption: "정상보다 좋았던, 올라가는 동안의 대화.", tags: "#등산 #북한산 #주말운동", likes: 92, comments: 6, following: true },
] as const;
type Sample = typeof samples[number];
type Concept = typeof concepts[number];
type PreviewDialog = { title: string; body?: string; story?: Sample } | null;

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.iconButton}>{children}</Pressable>;
}

export default function FeedUiPreview() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(1);
  const [compare, setCompare] = useState(false);
  const available = Math.max(0, Math.min(width - 24, 1440));
  const columns = width >= 1160 ? 3 : width >= 780 ? 2 : 1;
  const frameWidth = Math.min(440, compare ? (available - (columns - 1) * 20) / columns : available);
  return <SafeAreaView style={s.page}>
    <ScrollView contentContainerStyle={s.pageContent}>
      <View style={s.lab}>
        <View style={s.row}>
          <IconButton label="기존 피드로 돌아가기" onPress={() => router.push("/")}><ArrowLeft size={20} color={WHITE} /></IconButton>
          <View style={s.flex}><Text style={s.eyebrow}>GROOV / DESIGN STUDY</Text><Text style={s.labTitle}>피드, 다섯 가지 방향</Text></View>
          <Text style={s.badge}>미적용 시안</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.options}>
          {concepts.map((concept) => <Pressable key={concept.id} accessibilityRole="button" accessibilityState={{ selected: selected === concept.id && !compare }} onPress={() => { setSelected(concept.id); setCompare(false); }} style={[s.option, selected === concept.id && !compare && s.optionOn]}>
            <Text style={[s.optionNumber, selected === concept.id && !compare && s.black]}>0{concept.id}</Text>
            <Text style={[s.optionName, selected === concept.id && !compare && s.black]}>{concept.name}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Pressable accessibilityRole="button" onPress={() => setCompare(!compare)} style={s.compareButton}><LayoutGrid size={16} color={ORANGE} /><Text style={s.buttonText}>{compare ? "한 안씩 보기" : "5안 한눈에 비교"}</Text></Pressable>
          <Text style={s.labNote}>샘플 사진·기록 · 실제 피드에 영향 없음</Text>
        </View>
      </View>
      <View style={[s.frames, !compare && { justifyContent: "center" }]}>
        {concepts.filter((concept) => compare || concept.id === selected).map((concept) => <View key={concept.id} style={{ width: frameWidth, gap: 10 }}>
          <Text style={s.conceptHeading}>0{concept.id} / {concept.english}</Text>
          <Text style={s.conceptNote}>{concept.note}</Text>
          <FeedConcept concept={concept} />
        </View>)}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function FeedConcept({ concept }: { concept: Concept }) {
  const [grid, setGrid] = useState(false);
  const [query, setQuery] = useState("");
  const [seen, setSeen] = useState<string[]>(["swim"]);
  const [dialog, setDialog] = useState<PreviewDialog>(null);
  const [detail, setDetail] = useState<Sample | null>(null);
  const filtered = samples.filter((post) => !query.trim() || `${post.tags} ${post.user} ${post.label}`.toLowerCase().includes(query.trim().replace(/^#/, "").toLowerCase()));
  function notice(title: string, body: string) { setDialog({ title, body }); }
  return <View style={[s.frame, concept.id === 3 && s.nightFrame]}>
    <View style={s.appHeader}>
      <Wordmark size={28} />
      <View style={s.row}>
        <IconButton label="알림 시안" onPress={() => notice("알림", "seoa.run님이 내 기록을 응원했어요.\n\n시안용 알림입니다.")}><Bell size={21} color={WHITE} /></IconButton>
        <IconButton label={grid ? "카드형 피드 보기" : "4열 목록형 피드 보기"} onPress={() => setGrid(!grid)}><LayoutGrid size={21} strokeWidth={1.65} color={grid ? ORANGE : WHITE} fill="none" /></IconButton>
      </View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.stories, concept.id === 5 && { gap: 18 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="내 스토리 추가 시안" onPress={() => notice("내 스토리", "선택한 피드 디자인 안에서 스토리를 추가하는 자리입니다. 실제 게시하지 않습니다.")} style={s.storyItem}>
        <View style={[s.storyRing, { borderColor: LINE }]}><Plus size={23} color={WHITE} /></View><Text style={s.storyName}>내 스토리</Text>
      </Pressable>
      {samples.map((post) => <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`${post.user} 스토리 미리보기`} style={s.storyItem} onPress={() => { setSeen((value) => [...new Set([...value, post.id])]); setDialog({ title: post.user, story: post }); }}>
        <View style={[s.storyRing, { borderColor: seen.includes(post.id) ? WHITE : ORANGE }]}><Image source={demoAvatarSources[post.person]} style={s.storyAvatar} /></View>
        <Text numberOfLines={1} style={s.storyName}>{post.user}</Text>
      </Pressable>)}
    </ScrollView>
    {concept.id === 2 ? <View style={s.editionHeading}><Text style={s.editionTitle}>THE DAILY MOVE.</Text><Text style={s.meta}>VOL. 09 / 2026</Text></View> : null}
    {concept.id === 4 ? <View style={s.logHeading}><Text style={s.orangeLabel}>09 / 15</Text><Text style={s.meta}>TUESDAY · 운동이 쌓이는 하루</Text></View> : null}
    {grid ? <View style={s.grid}>{filtered.map((post) => <Pressable key={post.id} accessibilityRole="button" accessibilityLabel={`${post.user} ${post.label} 기록 보기`} onPress={() => setDetail(post)} style={s.gridTile}><Image source={post.photo} style={s.fullImage} /><View style={s.gridMark}><Text style={s.gridMarkText}>{post.metric}</Text></View></Pressable>)}</View>
      : filtered.map((post, index) => <PreviewPost key={post.id} post={post} variant={concept.id} index={index} onNotice={notice} />)}
    {filtered.length === 0 ? <Text style={s.empty}>해당 해시태그의 샘플 기록이 없습니다.</Text> : null}
    <View style={s.search}><Search size={17} color={MUTED} /><TextInput accessibilityLabel="샘플 피드 해시태그 검색" value={query} onChangeText={setQuery} placeholder="해시태그 검색" placeholderTextColor={MUTED} style={s.searchInput} /></View>
    <View style={s.bottomNav}>
      {[{ name: "홈", icon: House }, { name: "캘린더", icon: CalendarDays }, { name: "기록", icon: Plus }, { name: "랭크", icon: Trophy }, { name: "MY", icon: UserRound }].map(({ name, icon: Icon }) => <Pressable key={name} accessibilityRole="button" accessibilityLabel={`${name} 메뉴 시안`} style={s.navItem} onPress={() => notice(name, "피드 UI 비교 화면입니다. 기존 앱으로 돌아가려면 맨 위의 뒤로 버튼을 눌러 주세요.")}>
        <View style={name === "기록" ? s.navAdd : s.navIcon}><Icon size={name === "기록" ? 31 : 22} color={name === "기록" ? BLACK : name === "홈" ? ORANGE : WHITE} strokeWidth={1.7} /></View>
        {name !== "기록" ? <Text style={[s.navLabel, name === "홈" && { color: ORANGE }]}>{name}</Text> : null}
      </Pressable>)}
    </View>
    <Modal visible={dialog !== null || detail !== null} transparent animationType="fade" onRequestClose={() => { setDialog(null); setDetail(null); }}>
      <View style={s.backdrop}><View style={s.dialog}>
        <View style={s.dialogHeader}><Text style={s.dialogTitle}>{dialog?.title ?? "피드 상세 시안"}</Text><IconButton label="시안 상세 닫기" onPress={() => { setDialog(null); setDetail(null); }}><X size={23} color={WHITE} /></IconButton></View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {dialog?.story ? <Image source={dialog.story.photo} resizeMode="contain" style={{ width: "100%", aspectRatio: 9 / 14 }} /> : dialog?.body ? <Text style={s.dialogBody}>{dialog.body}</Text> : detail ? <PreviewPost post={detail} variant={concept.id} index={0} onNotice={notice} /> : null}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

function PreviewPost({ post, variant, index, onNotice }: { post: Sample; variant: number; index: number; onNotice: (title: string, body: string) => void }) {
  const [liked, setLiked] = useState(false), [saved, setSaved] = useState(false), [pulse, setPulse] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false), [draft, setDraft] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const dark = variant !== 4;
  const ink = dark ? WHITE : BLACK;
  const share = () => onNotice("탭톡 공유", "크루에게 이 운동 기록을 보내는 공유 화면으로 연결됩니다. 시안에서는 실제 메시지를 전송하지 않습니다.");
  const metrics = <View style={[s.metrics, variant === 3 && s.neonMetrics, variant === 4 && s.paperMetrics]}>
    <View style={s.metricCell}><Text style={[s.metricValue, !dark && s.black]}>{post.metric}<Text style={s.metricUnit}> {post.unit}</Text></Text><Text style={[s.metricLabel, !dark && s.paperMuted]}>{post.label === "근력" ? "완료 세트" : "운동 거리"}</Text></View>
    <View style={s.metricCell}><Text style={[s.metricSmallValue, !dark && s.black]}>{post.duration}</Text><Text style={[s.metricLabel, !dark && s.paperMuted]}>운동 시간</Text></View>
    <View style={s.metricCell}><Text style={[s.metricSmallValue, !dark && s.black]}>{post.detail}</Text><Text style={[s.metricLabel, !dark && s.paperMuted]}>{post.label === "근력" ? "총 볼륨" : post.label === "등산" ? "상승 고도" : "평균 페이스"}</Text></View>
  </View>;
  return <View style={[s.post, variant === 2 && s.editorialPost, variant === 3 && s.neonPost, variant === 4 && s.logPost, variant === 5 && s.socialPost]}>
    {!post.following ? <View style={s.recommendation}><ArrowUpRight size={14} color={ORANGE} /><Text style={s.recommendationText}>관심 운동과 비슷한 기록</Text></View> : null}
    {variant === 4 ? <View style={s.logIndex}><Text style={s.orangeLabel}>{String(index + 1).padStart(2, "0")}</Text><View style={s.logRule} /><Text style={s.meta}>{post.sport}</Text></View> : null}
    <View style={[s.identity, variant === 5 && s.socialIdentity]}>
      <Image source={demoAvatarSources[post.person]} style={[s.avatar, variant === 5 && { width: 44, height: 44 }]} />
      <View style={s.flex}><Text style={s.username}>{post.user}</Text><Text style={s.meta}>{post.time} · {post.location}</Text></View>
      <IconButton label={`${post.user} 게시물 메뉴 시안`} onPress={() => onNotice("게시물 메뉴", `${post.following ? "팔로잉 관리" : "팔로우"}\n\n신고하기\n\n메뉴 구성 시안입니다. 실제 변경되지 않습니다.`)}><Ellipsis size={23} color={WHITE} /></IconButton>
    </View>
    {variant === 2 ? <View style={s.sportTitleRow}><Text adjustsFontSizeToFit numberOfLines={1} style={s.sportTitle}>{post.sport}</Text><Text style={s.issueNumber}>/{String(index + 1).padStart(2, "0")}</Text></View> : null}
    <View style={[variant === 2 && s.editorialPhoto, variant === 3 && s.neonPhoto]}>
      <FeedLikeSurface label={`${post.user} 샘플 피드`} liked={liked} centerPulse={pulse} onLike={() => setLiked(true)}>
        <ImageBackground source={post.photo} resizeMode="cover" style={[s.photo, variant === 2 && { aspectRatio: 1 }, variant === 3 && { aspectRatio: 1 }, variant === 4 && { aspectRatio: 16 / 10 }, variant === 5 && { aspectRatio: 4 / 5 }]}>
          {(variant === 1 || variant === 3 || variant === 5) ? <LinearGradient colors={["transparent", "rgba(0,0,0,0.82)"]} style={s.photoShade} /> : null}
          {variant === 1 ? <View style={s.photoFooter}><Text style={s.photoSport}>{post.sport}</Text><View style={s.row}><Text style={s.photoDistance}>{post.metric}</Text><Text style={s.photoUnit}>{post.unit}</Text></View></View> : null}
          {variant === 3 ? <><View style={s.neonBadge}><Text style={s.orangeLabel}>● {post.sport}</Text></View><View style={s.photoFooter}><Text style={s.neonDistance}>{post.metric}<Text style={s.photoUnit}> {post.unit}</Text></Text><Text style={s.photoSport}>RECORDED / GROOV</Text></View></> : null}
          {variant === 5 ? <View style={s.photoFooter}><Text style={s.socialCaption}>{post.caption}</Text><Text style={s.photoSport}>{post.label} · {post.metric} {post.unit} · {post.duration}</Text></View> : null}
        </ImageBackground>
      </FeedLikeSurface>
    </View>
    <View style={[s.postContent, variant === 4 && s.paperContent]}>
      {variant === 4 ? <View style={s.paperTitle}><Text style={s.paperEyebrow}>WORKOUT RECEIPT</Text><ArrowUpRight size={18} color={BLACK} /></View> : null}
      {metrics}
      <View style={s.actions}>
        <IconButton label={liked ? "샘플 좋아요 취소" : "샘플 좋아요"} onPress={() => { if (!liked) setPulse((value) => value + 1); setLiked(!liked); }}><Heart size={24} color={liked ? ORANGE : ink} fill={liked ? ORANGE : "none"} strokeWidth={1.7} /></IconButton>
        <IconButton label="샘플 댓글 열기" onPress={() => setCommentsOpen(!commentsOpen)}><MessageCircle size={23} color={ink} strokeWidth={1.7} /></IconButton>
        <IconButton label="탭톡 공유 시안" onPress={share}><TapShareIcon size={24} color={ink} /></IconButton>
        <View style={s.flex} />
        <IconButton label={saved ? "샘플 저장 취소" : "샘플 저장"} onPress={() => setSaved(!saved)}><Bookmark size={22} color={saved ? ORANGE : ink} fill={saved ? ORANGE : "none"} strokeWidth={1.7} /></IconButton>
      </View>
      {variant === 5 ? <View style={s.socialProof}><View style={s.avatarStack}>{samples.slice(1, 4).map((sample, i) => <Image key={sample.id} source={demoAvatarSources[sample.person]} style={[s.proofAvatar, { marginLeft: i ? -8 : 0 }]} />)}</View><Text style={s.likeCount}>{post.likes + Number(liked)}명이 응원하고 있어요</Text></View> : <Text style={[s.likeCount, !dark && s.black]}>좋아요 {post.likes + Number(liked)}개</Text>}
      {variant !== 5 ? <Text style={[s.caption, !dark && s.black]}><Text style={s.captionAuthor}>{post.user} </Text>{post.caption}</Text> : null}
      <Text style={[s.tags, !dark && { color: "#AE391F" }]}>{post.tags}</Text>
      <Pressable accessibilityRole="button" onPress={() => setCommentsOpen(!commentsOpen)}><Text style={[s.commentCount, !dark && s.paperMuted]}>댓글 {post.comments + comments.length}개 {commentsOpen ? "접기" : "보기"}</Text></Pressable>
      {variant === 5 && !commentsOpen ? <View style={s.commentPeek}><Text style={s.commentPeekText}><Text style={s.captionAuthor}>minji.trail </Text>다음엔 같이 가자 🔥</Text></View> : null}
      {commentsOpen ? <View style={s.comments}>
        <Text style={[s.commentText, !dark && s.black]}><Text style={s.captionAuthor}>minji.trail </Text>오늘도 멋진 기록! 🔥</Text>
        {comments.map((text, i) => <Text key={i} style={[s.commentText, !dark && s.black]}><Text style={s.captionAuthor}>나 </Text>{text}</Text>)}
        <View style={s.commentComposer}><TextInput accessibilityLabel="시안용 댓글 입력" placeholder="댓글 시안 입력" placeholderTextColor={dark ? MUTED : "#626761"} value={draft} onChangeText={setDraft} maxLength={300} style={[s.commentInput, { color: ink }]} /><Pressable accessibilityRole="button" accessibilityLabel="시안에만 댓글 추가" disabled={!draft.trim()} onPress={() => { setComments((value) => [...value, draft.trim()]); setDraft(""); }} style={s.iconButton}><ArrowUpRight color={draft.trim() ? ORANGE : MUTED} size={22} /></Pressable></View>
        <Text style={[s.meta, !dark && s.paperMuted]}>미리보기 안에서만 표시되는 댓글입니다.</Text>
      </View> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#171C18" }, pageContent: { padding: 12, paddingBottom: 48, gap: 24, alignItems: "center" },
  lab: { width: "100%", maxWidth: 1440, padding: 12, gap: 14, borderWidth: 1, borderColor: "#394039", backgroundColor: "#1B211C" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 }, flex: { flex: 1, minWidth: 0 }, black: { color: BLACK },
  eyebrow: { color: MUTED, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.5 }, labTitle: { fontSize: 21, lineHeight: 29, color: WHITE, fontFamily: fonts.bold },
  badge: { color: ORANGE, fontSize: 12, borderColor: LINE, borderWidth: 1, padding: 7 }, options: { gap: 7 },
  option: { minWidth: 138, padding: 12, borderWidth: 1, borderColor: LINE, gap: 4 }, optionOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  optionNumber: { fontSize: 19, color: ORANGE, fontFamily: fonts.bold }, optionName: { color: WHITE, fontSize: 14, fontFamily: fonts.bold },
  compareButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: "row", gap: 8, alignItems: "center", borderWidth: 1, borderColor: LINE }, buttonText: { fontSize: 13, color: WHITE, fontFamily: fonts.bold },
  labNote: { color: MUTED, fontSize: 12 }, frames: { width: "100%", maxWidth: 1440, flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "flex-start" },
  conceptHeading: { color: ORANGE, fontSize: 14, fontFamily: fonts.bold, letterSpacing: 1 }, conceptNote: { color: "#BEC2BC", fontSize: 13, lineHeight: 21, minHeight: 42 },
  frame: { borderWidth: 1, borderColor: LINE, backgroundColor: BLACK, overflow: "hidden" }, nightFrame: { backgroundColor: "#080B0C", borderColor: "#3D2822" },
  appHeader: { paddingHorizontal: 16, paddingVertical: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: LINE },
  iconButton: { width: 38, minHeight: 40, alignItems: "center", justifyContent: "center" }, stories: { paddingHorizontal: 16, paddingVertical: 18, gap: 13 },
  storyItem: { alignItems: "center", gap: 6, width: 63 }, storyRing: { width: 59, height: 59, padding: 3, borderWidth: 1.5, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  storyAvatar: { width: "100%", height: "100%", borderRadius: 35 }, storyName: { fontSize: 12, color: WHITE, maxWidth: 67 },
  editionHeading: { padding: 16, borderTopWidth: 3, borderColor: WHITE, gap: 4 }, editionTitle: { fontFamily: fonts.displayItalic, fontSize: 25, color: WHITE },
  logHeading: { padding: 16, borderTopWidth: 1, borderColor: LINE, gap: 5 }, orangeLabel: { color: ORANGE, fontSize: 12, letterSpacing: 1.2, fontFamily: fonts.bold },
  post: { borderBottomWidth: 1, borderColor: LINE, marginBottom: 24 }, editorialPost: { marginHorizontal: 16, borderTopWidth: 1, borderTopColor: WHITE },
  neonPost: { marginHorizontal: 12, borderWidth: 1, borderColor: "#563125", backgroundColor: "#101310" }, logPost: { marginHorizontal: 16, borderBottomWidth: 0 }, socialPost: { marginHorizontal: 10, borderWidth: 1, borderColor: LINE, backgroundColor: "#111613" },
  identity: { paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 9 }, socialIdentity: { paddingVertical: 16 },
  avatar: { width: 34, height: 34, borderRadius: 25 }, username: { color: WHITE, fontSize: 14, fontFamily: fonts.bold }, meta: { color: MUTED, fontSize: 12, lineHeight: 18 },
  recommendation: { paddingHorizontal: 14, paddingTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }, recommendationText: { color: MUTED, fontSize: 12 },
  photo: { width: "100%", aspectRatio: 4 / 5, justifyContent: "flex-end" }, photoShade: { position: "absolute", top: "35%", left: 0, right: 0, bottom: 0 },
  photoFooter: { padding: 20, gap: 5 }, photoSport: { color: WHITE, fontSize: 12, fontFamily: fonts.bold, letterSpacing: 1.3 }, photoDistance: { color: WHITE, fontFamily: fonts.displayItalic, fontSize: 62, lineHeight: 70 }, photoUnit: { color: WHITE, fontFamily: fonts.bold, fontSize: 16 },
  metrics: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, borderColor: LINE, gap: 7, alignItems: "center" }, metricCell: { flex: 1, gap: 5, minWidth: 0 },
  metricValue: { color: WHITE, fontFamily: fonts.bold, fontSize: 21 }, metricUnit: { fontSize: 12 }, metricSmallValue: { color: WHITE, fontFamily: fonts.bold, fontSize: 14 }, metricLabel: { color: MUTED, fontSize: 12 },
  postContent: { paddingHorizontal: 14, paddingBottom: 20, gap: 9 }, actions: { flexDirection: "row", alignItems: "center", marginHorizontal: -5, paddingTop: 2, gap: 1 },
  likeCount: { color: WHITE, fontSize: 13, fontFamily: fonts.bold }, caption: { color: WHITE, fontSize: 14, lineHeight: 23 }, captionAuthor: { fontFamily: fonts.bold }, tags: { color: "#DD866B", fontSize: 12, lineHeight: 20 }, commentCount: { color: MUTED, fontSize: 13, paddingVertical: 4 },
  sportTitleRow: { flexDirection: "row", alignItems: "center", paddingBottom: 10, gap: 5 }, sportTitle: { fontSize: 40, fontFamily: fonts.displayItalic, color: WHITE, flex: 1 }, issueNumber: { color: ORANGE, fontSize: 18, fontFamily: fonts.bold }, editorialPhoto: { borderLeftWidth: 4, borderColor: ORANGE, paddingLeft: 7 },
  neonPhoto: { marginHorizontal: 7, borderWidth: 1, borderColor: "#865342" }, neonBadge: { position: "absolute", left: 12, top: 12, padding: 7, borderWidth: 1, borderColor: ORANGE, backgroundColor: "rgba(0,0,0,0.65)" },
  neonDistance: { color: "#FF6943", fontSize: 56, fontFamily: fonts.displayItalic, textShadowColor: "#FF5A36", textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } }, neonMetrics: { borderBottomColor: "#74402E" },
  logIndex: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }, logRule: { height: 1, flex: 1, backgroundColor: LINE },
  paperContent: { backgroundColor: "#E9EBE4", paddingTop: 15 }, paperTitle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, paperEyebrow: { fontSize: 12, fontFamily: fonts.bold, letterSpacing: 2, color: BLACK }, paperMetrics: { borderBottomColor: "#A2A79C" }, paperMuted: { color: "#575E54" },
  socialCaption: { fontSize: 24, lineHeight: 34, fontFamily: fonts.bold, color: WHITE }, socialProof: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }, avatarStack: { flexDirection: "row" }, proofAvatar: { width: 24, height: 24, borderRadius: 20, borderWidth: 2, borderColor: BLACK }, commentPeek: { borderLeftWidth: 2, borderColor: ORANGE, paddingLeft: 10, marginTop: 4 }, commentPeekText: { color: "#CDD0CB", fontSize: 13, lineHeight: 21 },
  comments: { gap: 10, borderTopWidth: 1, borderColor: LINE, paddingTop: 12 }, commentText: { color: WHITE, fontSize: 14, lineHeight: 22 }, commentComposer: { flexDirection: "row", borderBottomWidth: 1, borderColor: MUTED }, commentInput: { flex: 1, minWidth: 0, fontSize: 14, minHeight: 42 },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: 2 }, gridTile: { width: "25%", aspectRatio: 1, borderWidth: 2, borderColor: BLACK }, fullImage: { width: "100%", height: "100%" }, gridMark: { position: "absolute", right: 3, bottom: 3, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 3 }, gridMarkText: { fontSize: 12, color: WHITE, fontFamily: fonts.bold },
  search: { margin: 14, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: LINE }, searchInput: { flex: 1, minWidth: 0, minHeight: 46, fontSize: 14, color: WHITE }, empty: { color: MUTED, padding: 24, fontSize: 14 },
  bottomNav: { flexDirection: "row", borderTopWidth: 1, borderColor: LINE, paddingVertical: 16, alignItems: "center" }, navItem: { flex: 1, alignItems: "center", gap: 5 }, navIcon: { height: 28, justifyContent: "center" }, navAdd: { width: 48, height: 45, backgroundColor: ORANGE, borderRadius: 12, alignItems: "center", justifyContent: "center" }, navLabel: { color: WHITE, fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", padding: 18, justifyContent: "center", alignItems: "center" }, dialog: { maxWidth: 440, width: "100%", maxHeight: "90%", borderWidth: 1, borderColor: LINE, backgroundColor: BLACK }, dialogHeader: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderColor: LINE }, dialogTitle: { flex: 1, color: WHITE, fontSize: 17, fontFamily: fonts.bold }, dialogBody: { color: WHITE, fontSize: 15, lineHeight: 25, padding: 20 },
});
