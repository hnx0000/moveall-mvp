import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bike, ChevronLeft, Dumbbell, Fish, Footprints, Gem, Medal, Mountain, Stamp, Waves } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { medalDrafts, rewardCatalog, RewardCategory, RewardDesign, RewardKind } from "../src/rewards/reward-catalog";
import { uiLayout, fonts } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const ORANGE = "#FF5A36";
const BLACK = "#07090B";
const PANEL = "#0B0F12";
const LINE = "#20272C";
const WHITE = "#F4F1EC";

const CATEGORIES: Array<"전체" | RewardCategory> = ["전체", "시즌", "러닝", "멀티스포츠", "꾸준함", "리그", "기념"];

const TIERS = [
  { name: "BRONZE", ko: "브론즈", note: "기록의 시작", colors: ["#563426", "#D49A70", "#6E402C"] as const },
  { name: "SILVER", ko: "실버", note: "꾸준한 노력", colors: ["#51565A", "#E0E4E5", "#71777B"] as const },
  { name: "GOLD", ko: "골드", note: "목표 달성", colors: ["#6E4B18", "#F2C866", "#8A5D1B"] as const },
  { name: "DIAMOND", ko: "다이아", note: "뛰어난 성과", colors: ["#50616D", "#E8F7FF", "#809CAE"] as const },
  { name: "PLATINUM", ko: "플래티넘", note: "최고의 수준", colors: ["#4A4358", "#DCCAF5", "#75658C"] as const },
  { name: "MASTER", ko: "마스터", note: "전설의 경지", colors: ["#191B1D", "#61656A", "#0C0E10"] as const },
] as const;

const SPORTS = [
  { code: "RUN", ko: "러닝", goal: "5K 첫 완주", accent: ORANGE },
  { code: "HIKE", ko: "등산", goal: "첫 정상 인증", accent: "#A8C96A" },
  { code: "LIFT", ko: "근력", goal: "벤치 100kg", accent: "#C591FF" },
  { code: "RIDE", ko: "사이클", goal: "100km 완주", accent: "#49C6C8" },
  { code: "SWIM", ko: "수영", goal: "1km 완영", accent: "#53A7FF" },
  { code: "DIVE", ko: "다이빙", goal: "20m 성공", accent: "#65D6B0" },
] as const;

// Metro requires literal static require calls to include these bitmap assets.
/* eslint-disable @typescript-eslint/no-require-imports */
const RUNNING_MEDAL_CONCEPTS = [
  { id: 1, code: "GOLD 10 KM", ko: "골드 10KM 기준안", note: "실제 러닝화와 트랙의 깊이감을 살린 골드 기준 메달", accent: "#C49A49", image: require("../assets/images/running-medals/running-medal-gold-10km-real-shoe-v4.png") },
  { id: 2, code: "SILVER 5 KM", ko: "실버 5KM 수정안", note: "속도선과 하단 점을 덜어내고 트랙 3선과 기록을 강조", accent: "#B9BEC1", image: require("../assets/images/running-medals/running-medal-silver-5km-refined-v5.png") },
  { id: 3, code: "NEGATIVE SPLIT", ko: "네거티브 스플릿", note: "후반 기록이 빨라지는 러너의 두 구간을 분할", accent: "#B9BEC1", image: require("../assets/images/running-medals/running-medal-03-negative-split.png") },
  { id: 4, code: "REDLINE", ko: "레드라인", note: "심박 최고 구간의 긴장감과 속도를 날카롭게 강조", accent: "#A8231D", image: require("../assets/images/running-medals/running-medal-04-redline.png") },
  { id: 5, code: "CITY TRACE", ko: "시티 트레이스", note: "도시 안에 남은 실제 러닝 루트와 위치의 기억", accent: "#8C9498", image: require("../assets/images/running-medals/running-medal-05-city-trace.png") },
  { id: 6, code: "NIGHT SHIFT", ko: "나이트 시프트", note: "야간 러닝의 반사광과 어두운 노면을 매트하게 표현", accent: "#C59A73", image: require("../assets/images/running-medals/running-medal-06-night-shift.png") },
  { id: 7, code: "PERSONAL BEST", ko: "퍼스널 베스트", note: "개인 최고 기록을 위한 클래식 챔피언 크레스트", accent: "#C49A49", image: require("../assets/images/running-medals/running-medal-07-personal-best.png") },
  { id: 8, code: "STREAK 30", ko: "스트릭 30", note: "30일 연속 기록의 누적 에너지를 번개로 압축", accent: "#C06C3B", image: require("../assets/images/running-medals/running-medal-08-streak-30.png") },
  { id: 9, code: "RUN CLUB", ko: "런 클럽", note: "함께 달린 발자국과 크루의 소속감을 중심에 배치", accent: "#9A684D", image: require("../assets/images/running-medals/running-medal-09-run-club.png") },
  { id: 10, code: "MARATHON 42", ko: "마라톤 42", note: "완주의 무게감이 느껴지는 정통 피니셔 메달", accent: "#B7B9B8", image: require("../assets/images/running-medals/running-medal-10-marathon-42.png") },
] as const;

export default function RewardCollection() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [kind, setKind] = useState<RewardKind | "medal-concepts">(params.tab === "medal-concepts" ? "medal-concepts" : "stamp");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");
  const designs = useMemo(() => [...rewardCatalog, ...medalDrafts].filter((item) => item.kind === kind && (category === "전체" || item.category === category)), [kind, category]);

  return <View style={[s.page, { backgroundColor: colors.background }]}>
    <View style={[s.header, { borderBottomColor: colors.border }]}>
      <Pressable accessibilityLabel="뒤로가기" onPress={() => router.back()} style={s.back}><ChevronLeft color={colors.ink} size={24} /></Pressable>
      <View style={s.headCopy}><Text style={s.eyebrow}>GROOV DESIGN ARCHIVE</Text><Text style={[s.title, { color: colors.ink }]}>로고·보상 디자인 보관함</Text></View><View style={s.back} />
    </View>
    <ScrollView contentContainerStyle={s.content} stickyHeaderIndices={[1]}>
      <View style={s.intro}><Text style={[s.introTitle, { color: colors.ink }]}>러닝 메달 디자인 10안</Text><Text style={[s.introBody, { color: colors.muted }]}>실제 제작 가능한 금속, 에나멜, 각인과 짧은 직조 고리를 기준으로 비교합니다.</Text></View>
      <View style={[s.controls, { backgroundColor: colors.background }]}>
        <View style={[s.kindTabs, { borderColor: colors.border }]}>
          <KindButton active={kind === "stamp"} icon="stamp" label={`스탬프 ${rewardCatalog.length}`} onPress={() => setKind("stamp")} />
          <KindButton active={kind === "medal"} icon="medal" label={`메달 ${medalDrafts.length}`} onPress={() => setKind("medal")} />
          <KindButton active={kind === "medal-concepts"} icon="concept" label="러닝 메달 10안" onPress={() => setKind("medal-concepts")} />
        </View>
        {kind !== "medal-concepts" ? <ScrollView contentContainerStyle={s.filters} horizontal showsHorizontalScrollIndicator={false}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[s.filter, category === item && s.filterOn]}><Text style={[s.filterText, category === item && s.filterTextOn]}>{item}</Text></Pressable>)}</ScrollView> : null}
      </View>
      {kind === "medal-concepts" ? <RunningMedalGallery /> : <View style={s.grid}>{designs.map((design, index) => <ArchiveRewardTile key={design.id} design={design} index={index} />)}</View>}
      {kind !== "medal-concepts" && designs.length === 0 ? <Text style={[s.empty, { color: colors.muted }]}>이 분류의 디자인은 아직 없습니다.</Text> : null}
    </ScrollView>
  </View>;
}

function KindButton({ active, label, icon, onPress }: { active: boolean; label: string; icon: "stamp" | "medal" | "concept"; onPress: () => void }) {
  const iconColor = active ? BLACK : ORANGE;
  return <Pressable onPress={onPress} style={[s.kindButton, active && s.kindOn]}>{icon === "stamp" ? <Stamp color={iconColor} size={17} /> : icon === "concept" ? <Gem color={iconColor} size={17} /> : <Medal color={iconColor} size={17} />}<Text style={[s.kindText, active && s.kindTextOn]}>{label}</Text></Pressable>;
}

function ArchiveRewardTile({ design, index }: { design: RewardDesign; index: number }) {
  return <View style={s.tile}><View style={s.art}>{design.kind === "medal" ? <GroovMedal size={104} sport={SPORTS[index % SPORTS.length]!} tier={TIERS[index % TIERS.length]!} /> : <StampMark design={design} variant={index % 5} />}</View><View style={s.tileCopy}><View style={s.row}><Text style={s.category}>{design.category}</Text><Text style={s.status}>{design.status === "ready" ? "READY" : "DESIGN"}</Text></View><Text style={s.name}>{design.name}</Text><Text style={s.condition}>{design.condition}</Text><Text style={s.edition}>{design.edition}</Text></View></View>;
}

function StampMark({ design, variant }: { design: RewardDesign; variant: number }) {
  if (variant === 0) return <View style={s.circle}><Text style={s.micro}>GROOV</Text><Text style={s.mark}>{design.mark}</Text><Text style={s.micro}>VERIFIED</Text></View>;
  if (variant === 1) return <View style={s.square}><Text style={s.micro}>{design.category}</Text><Text style={s.mark}>{design.mark}</Text><View style={s.line} /></View>;
  if (variant === 2) return <View style={s.double}><View style={s.doubleInner}><Text style={s.mark}>{design.mark}</Text></View></View>;
  if (variant === 3) return <View style={s.band}><Text style={s.microDark}>GROOV AWARD</Text><Text style={s.markDark}>{design.mark}</Text></View>;
  return <View style={s.target}><View style={s.targetIn}><Text style={s.mark}>{design.mark}</Text></View></View>;
}

function RunningMedalGallery() {
  return <View style={c.gallery}>
    <View style={c.galleryHead}><View><Text style={c.galleryEyebrow}>PHYSICAL MEDAL STUDY</Text><Text style={c.galleryTitle}>RUNNING MEDAL OBJECTS</Text></View><View style={c.countBadge}><Text style={c.countBig}>10</Text><Text style={c.countSmall}>DIRECTIONS</Text></View></View>
    <View style={c.conceptGrid}>{RUNNING_MEDAL_CONCEPTS.map((concept) => <View key={concept.id} style={c.card}>
      <LinearGradient colors={[concept.accent, "transparent"]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={c.cardAccent} />
      <View style={c.cardHead}><Text style={c.conceptNumber}>{String(concept.id).padStart(2, "0")}</Text><View style={c.cardTitleWrap}><Text style={c.conceptCode}>{concept.code}</Text><Text style={c.conceptKo}>{concept.ko}</Text></View><Text style={c.status}>RUNNING</Text></View>
      <View style={c.medalStage}><View style={[c.stageHalo, { borderColor: concept.accent }]} /><Image accessibilityLabel={`${concept.ko} 실사 메달 시안`} resizeMode="contain" source={concept.image} style={c.medalImage} /></View>
      <View style={c.cardFootText}><Text style={c.note}>{concept.note}</Text><View style={c.tags}><Text style={c.tag}>DIE CAST</Text><Text style={c.tag}>HARD ENAMEL</Text><Text style={[c.tag, { color: concept.accent }]}>SHORT LOOP</Text></View></View>
    </View>)}</View>
  </View>;
}

function GroovMedal({ tier, sport, size, compact = false, master = false }: { tier: (typeof TIERS)[number]; sport: (typeof SPORTS)[number]; size: number; compact?: boolean; master?: boolean }) {
  const connectorHeight = compact ? 9 : Math.max(11, Math.round(size * 0.12));
  const inner = size - Math.max(14, Math.round(size * 0.16));
  const iconSize = compact ? 18 : Math.round(size * 0.28);
  const tierIndex = TIERS.findIndex((item) => item.name === tier.name);
  const metal = master ? ["#050607", "#4C5154", "#0A0B0C"] as const : tier.colors;
  return <View style={[m.wrap, { height: size + connectorHeight + 7, width: size + 4 }]}>
    <View style={[m.loop, { borderColor: master ? ORANGE : tier.colors[1], height: connectorHeight + 3, width: compact ? 27 : 38 }]}><View style={[m.loopStripe, { backgroundColor: sport.accent }]} /><View style={[m.loopStripe, { backgroundColor: sport.accent }]} /><View style={[m.loopStripe, { backgroundColor: sport.accent }]} /></View>
    <View style={[m.neck, { borderColor: master ? ORANGE : tier.colors[1], top: connectorHeight - 1, width: compact ? 34 : 48 }]} />
    <LinearGradient colors={[...metal]} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={[m.disc, { borderColor: master ? ORANGE : tier.colors[1], borderRadius: size / 2, height: size, top: connectorHeight + 4, width: size }]}>
      <View style={[m.machineNotch, m.notchTop, { backgroundColor: sport.accent }]} /><View style={[m.machineNotch, m.notchRight, { backgroundColor: sport.accent }]} /><View style={[m.machineNotch, m.notchBottom, { backgroundColor: sport.accent }]} /><View style={[m.machineNotch, m.notchLeft, { backgroundColor: sport.accent }]} />
      <View style={[m.rim, { borderColor: master ? ORANGE : "rgba(255,255,255,.42)", borderRadius: inner / 2, height: inner, width: inner }]}>
        {!compact ? <Text style={[m.tierEtch, { color: master ? ORANGE : tier.colors[1] }]}>{tier.name} · 0{tierIndex + 1}</Text> : null}
        <View style={[m.iconWell, { borderColor: sport.accent, height: compact ? 31 : Math.round(size * .42), width: compact ? 31 : Math.round(size * .42), borderRadius: size }]}>{master ? <Text style={[m.masterM, { fontSize: compact ? 22 : Math.round(size * 0.34) }]}>M</Text> : <SportSymbol color={sport.accent} size={iconSize} sport={sport.code} />}</View>
        {!compact ? <Text style={[m.sportCode, { color: sport.accent }]}>{sport.code}</Text> : null}{!compact ? <Text style={m.groov}>GROOV PERFORMANCE</Text> : null}
        {compact ? <View style={m.compactTicks}>{Array.from({ length: tierIndex + 1 }).map((_, index) => <View key={index} style={[m.compactTick, { backgroundColor: master ? ORANGE : tier.colors[1] }]} />)}</View> : null}
      </View>
    </LinearGradient>
  </View>;
}

function SportSymbol({ sport, color, size }: { sport: string; color: string; size: number }) {
  if (sport === "RUN") return <Footprints color={color} size={size} strokeWidth={2.1} />;
  if (sport === "HIKE") return <Mountain color={color} size={size} strokeWidth={2.1} />;
  if (sport === "LIFT") return <Dumbbell color={color} size={size} strokeWidth={2.1} />;
  if (sport === "RIDE") return <Bike color={color} size={size} strokeWidth={2.1} />;
  if (sport === "SWIM") return <Waves color={color} size={size} strokeWidth={2.1} />;
  return <Fish color={color} size={size} strokeWidth={2.1} />;
}

const s = StyleSheet.create({
  page:{flex:1},header:{minHeight:78,borderBottomWidth:1,flexDirection:"row",alignItems:"center",paddingHorizontal:16},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},headCopy:{flex:1,alignItems:"center"},eyebrow:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:8,letterSpacing:1.4},title:{fontFamily:fonts.bold,fontSize:18,marginTop:2},content:{width:"100%",maxWidth:1180,alignSelf:"center",padding:18,paddingBottom:70},intro:{paddingVertical:18},introTitle:{fontFamily:fonts.bold,fontSize:23},introBody:{fontFamily:fonts.medium,fontSize:10,lineHeight:17,marginTop:7,maxWidth:520},controls:{paddingBottom:12,gap:10},kindTabs:{flexDirection:"row",borderWidth:1,borderRadius:uiLayout.panelRadius,padding:4},kindButton:{flex:1,minHeight:43,borderRadius:uiLayout.controlRadius,flexDirection:"row",gap:7,alignItems:"center",justifyContent:"center"},kindOn:{backgroundColor:ORANGE},kindText:{color:ORANGE,fontFamily:fonts.bold,fontSize:11},kindTextOn:{color:BLACK},filters:{gap:7},filter:{borderWidth:1,borderColor:"#342019",paddingHorizontal:12,paddingVertical:7,borderRadius:uiLayout.controlRadius},filterOn:{backgroundColor:ORANGE,borderColor:ORANGE},filterText:{color:ORANGE,fontFamily:fonts.medium,fontSize:9},filterTextOn:{color:BLACK,fontFamily:fonts.bold},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},tile:{width:"48.5%",backgroundColor:BLACK,borderWidth:1,borderColor:"#291711",borderRadius:uiLayout.panelRadius,overflow:"hidden"},art:{height:190,alignItems:"center",justifyContent:"center",borderBottomWidth:1,borderBottomColor:"#291711"},tileCopy:{padding:13},row:{flexDirection:"row",justifyContent:"space-between"},category:{color:ORANGE,fontFamily:fonts.bold,fontSize:7,letterSpacing:1},status:{color:ORANGE,opacity:.45,fontFamily:fonts.bold,fontSize:7},name:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:13,marginTop:8},condition:{color:ORANGE,opacity:.65,fontFamily:fonts.medium,fontSize:8,marginTop:4},edition:{color:ORANGE,opacity:.32,fontFamily:fonts.medium,fontSize:7,marginTop:10},circle:{width:125,height:125,borderRadius:63,borderWidth:4,borderColor:ORANGE,alignItems:"center",justifyContent:"center"},square:{width:125,height:105,borderWidth:3,borderColor:ORANGE,alignItems:"center",justifyContent:"space-around",padding:10,transform:[{rotate:"-3deg"}]},double:{width:130,height:130,borderRadius:65,borderWidth:2,borderColor:ORANGE,padding:7},doubleInner:{flex:1,borderRadius:60,borderWidth:1,borderColor:ORANGE,alignItems:"center",justifyContent:"center"},band:{width:"90%",height:76,backgroundColor:ORANGE,alignItems:"center",justifyContent:"center",transform:[{rotate:"-8deg"}]},target:{width:130,height:130,borderRadius:65,backgroundColor:ORANGE,padding:20},targetIn:{flex:1,borderRadius:50,backgroundColor:BLACK,alignItems:"center",justifyContent:"center"},micro:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:6,letterSpacing:1.5},microDark:{color:BLACK,fontFamily:fonts.displayExtra,fontSize:6,letterSpacing:1.5},mark:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:30},markDark:{color:BLACK,fontFamily:fonts.displayExtra,fontSize:30},line:{height:2,width:"100%",backgroundColor:ORANGE},empty:{fontFamily:fonts.medium,fontSize:11,textAlign:"center",padding:50}
});

const c = StyleSheet.create({
  gallery:{backgroundColor:BLACK,borderWidth:1,borderColor:"#24292D",borderRadius:uiLayout.panelRadius,padding:14},galleryHead:{minHeight:84,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:18,paddingHorizontal:8,paddingBottom:14},galleryEyebrow:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:11,letterSpacing:1.6},galleryTitle:{color:WHITE,fontFamily:fonts.displayExtra,fontSize:25,letterSpacing:.3,marginTop:5},countBadge:{width:78,height:58,borderWidth:1,borderColor:"#5F2C21",borderRadius:uiLayout.controlRadius,backgroundColor:"#160F0D",alignItems:"center",justifyContent:"center"},countBig:{color:ORANGE,fontFamily:fonts.displayExtra,fontSize:23,lineHeight:25},countSmall:{color:"#9A5748",fontFamily:fonts.bold,fontSize:8,letterSpacing:1},
  conceptGrid:{flexDirection:"row",flexWrap:"wrap",gap:12},card:{flexGrow:1,flexBasis:370,minWidth:300,maxWidth:565,backgroundColor:"#0B0E10",borderWidth:1,borderColor:"#252B2F",borderRadius:uiLayout.panelRadius,overflow:"hidden",padding:15},cardAccent:{position:"absolute",top:0,left:0,right:0,height:2,opacity:.55},cardHead:{minHeight:52,flexDirection:"row",alignItems:"center",gap:11},conceptNumber:{color:"#3F484D",fontFamily:fonts.displayExtra,fontSize:24},cardTitleWrap:{flex:1},conceptCode:{color:WHITE,fontFamily:fonts.displayExtra,fontSize:15,letterSpacing:.5},conceptKo:{color:"#858E93",fontFamily:fonts.medium,fontSize:12,marginTop:3},status:{color:"#AEB4B7",borderWidth:1,borderColor:"#394146",borderRadius:uiLayout.panelRadius,paddingHorizontal:8,paddingVertical:5,fontFamily:fonts.bold,fontSize:9,letterSpacing:.7},
  medalStage:{height:360,backgroundColor:"#050607",borderWidth:1,borderColor:"#171C1F",borderRadius:uiLayout.controlRadius,alignItems:"center",justifyContent:"center",overflow:"hidden",marginTop:10},stageHalo:{position:"absolute",width:280,height:280,borderRadius:140,borderWidth:1,opacity:.07},medalImage:{width:"94%",height:"94%"},medalWrap:{position:"relative",alignItems:"center"},shortLoop:{position:"absolute",top:0,zIndex:1,width:58,height:22,borderWidth:2,borderRadius:7,backgroundColor:"#090B0D",flexDirection:"row",gap:5,justifyContent:"center",overflow:"hidden"},loopThread:{width:4,height:32,transform:[{rotate:"22deg"}]},connector:{position:"absolute",top:18,zIndex:3,width:76,height:19,backgroundColor:"#0A0D0F",borderWidth:2,borderRadius:4,alignItems:"center",justifyContent:"center"},connectorText:{fontFamily:fonts.displayExtra,fontSize:9},shell:{position:"absolute",bottom:0,borderWidth:2,padding:12,alignItems:"center",justifyContent:"center",overflow:"hidden",shadowColor:"#000",shadowOffset:{width:0,height:10},shadowOpacity:.7,shadowRadius:13,elevation:10},innerPlate:{position:"absolute",top:12,bottom:12,left:12,right:12,backgroundColor:"rgba(7,9,10,.88)",borderWidth:2,alignItems:"center",justifyContent:"center",padding:12},engraving:{position:"absolute",top:13,fontFamily:fonts.displayExtra,fontSize:9,letterSpacing:.8},medalMark:{color:WHITE,fontFamily:fonts.displayExtra,fontSize:32,lineHeight:36,marginTop:4,maxWidth:"88%"},medalRule:{flexDirection:"row",alignItems:"center",gap:6,marginTop:6},ruleLine:{width:22,height:1},runCode:{fontFamily:fonts.displayExtra,fontSize:9,letterSpacing:2},performance:{color:"#666F74",fontFamily:fonts.bold,fontSize:7,letterSpacing:.8,marginTop:5},
  orbit:{position:"absolute",borderWidth:1,borderRadius:999,opacity:.32},orbitOuter:{width:154,height:154},orbitInner:{width:132,height:132},lanes:{position:"absolute",left:14,right:14,top:10,bottom:10,flexDirection:"row",justifyContent:"space-around",opacity:.18},lane:{height:"100%",width:1,borderLeftWidth:1},splitBand:{position:"absolute",width:260,height:24,opacity:.16,transform:[{rotate:"-28deg"}]},redline:{position:"absolute",left:13,bottom:16,flexDirection:"row",alignItems:"flex-end",gap:5,opacity:.18},redBar:{width:7},routeDot:{position:"absolute",right:25,top:34,width:8,height:8,borderRadius:4},nightDots:{position:"absolute",width:1,height:1,alignItems:"center",justifyContent:"center"},nightDot:{position:"absolute",width:5,height:5,borderRadius:3,borderWidth:1},crestWing:{position:"absolute",top:52,width:62,height:78,borderTopWidth:2,borderBottomWidth:2,opacity:.22},crestLeft:{left:-10,transform:[{rotate:"48deg"}]},crestRight:{right:-10,transform:[{rotate:"-48deg"}]},boltSlash:{position:"absolute",width:220,height:18,opacity:.16,transform:[{rotate:"-55deg"}]},crewSteps:{position:"absolute",opacity:.7,transform:[{rotate:"-18deg"}]},finishTicks:{position:"absolute",width:1,height:1,alignItems:"center",justifyContent:"center"},finishTick:{position:"absolute",width:3,height:14},
  cardFootText:{minHeight:86,paddingTop:13},note:{color:"#C2C7C9",fontFamily:fonts.medium,fontSize:13,lineHeight:19},tags:{flexDirection:"row",gap:7,marginTop:11,flexWrap:"wrap"},tag:{color:"#717A7F",backgroundColor:"#12171A",borderRadius:uiLayout.controlRadius,paddingHorizontal:8,paddingVertical:5,fontFamily:fonts.bold,fontSize:9,letterSpacing:.6}
});

const _b = StyleSheet.create({
  board:{backgroundColor:BLACK,borderWidth:1,borderColor:"#222A2F",borderRadius:uiLayout.panelRadius,padding:12,gap:10},
  boardHead:{minHeight:76,paddingHorizontal:8,paddingVertical:10,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:14},
  logo:{color:WHITE,fontFamily:fonts.displayExtra,fontSize:24,letterSpacing:.4},logoOrange:{color:ORANGE},
  systemMeta:{flexDirection:"row",alignItems:"center",gap:7,marginTop:8,flexWrap:"wrap"},metaText:{color:"#92999D",fontFamily:fonts.bold,fontSize:11,letterSpacing:.8},metaDot:{width:3,height:3,borderRadius:2,backgroundColor:ORANGE},
  version:{color:ORANGE,backgroundColor:"#17100E",borderWidth:1,borderColor:"#643024",borderRadius:uiLayout.panelRadius,paddingHorizontal:11,paddingVertical:7,fontFamily:fonts.bold,fontSize:11},
  section:{backgroundColor:PANEL,borderWidth:1,borderColor:LINE,borderRadius:uiLayout.panelRadius,padding:14,minWidth:0,overflow:"hidden"},sectionHead:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:15},sectionIndex:{width:36,height:30,borderRadius:uiLayout.panelRadius,backgroundColor:ORANGE,color:BLACK,fontFamily:fonts.displayExtra,fontSize:12,textAlign:"center",textAlignVertical:"center",lineHeight:30},sectionHeading:{flex:1},sectionTitle:{color:WHITE,fontFamily:fonts.bold,fontSize:16},sectionSubtitle:{color:"#858E93",fontFamily:fonts.medium,fontSize:12,lineHeight:17,marginTop:3},orange:{color:ORANGE},
  tierShowcase:{minWidth:"100%",gap:10,paddingHorizontal:2,paddingBottom:2},tierShowcaseItem:{width:150,backgroundColor:"#0D1215",borderWidth:1,borderColor:"#242D32",borderRadius:uiLayout.panelRadius,padding:12,alignItems:"center",overflow:"hidden"},masterCard:{borderColor:"#713426",backgroundColor:"#110D0B"},tierAccent:{position:"absolute",top:0,left:0,right:0,height:3},tierHeading:{width:"100%",flexDirection:"row",alignItems:"center",gap:8,marginBottom:7},tierRank:{color:"#4F5A60",fontFamily:fonts.displayExtra,fontSize:17},tierName:{color:WHITE,fontFamily:fonts.displayExtra,fontSize:11},tierKo:{color:"#A4ABAF",fontFamily:fonts.medium,fontSize:11,marginTop:2},tierNote:{color:"#B6BEC2",fontFamily:fonts.bold,fontSize:12,marginTop:9},progressTicks:{flexDirection:"row",gap:3,marginTop:8},progressTick:{width:13,height:3,borderRadius:2,backgroundColor:"#263036"},
  splitRow:{flexDirection:"row",flexWrap:"wrap",gap:10},splitWide:{flexGrow:2,flexBasis:650,minWidth:0},splitNarrow:{flexGrow:1,flexBasis:310,minWidth:0},
  matrix:{minWidth:980},matrixHeader:{flexDirection:"row",backgroundColor:"#090D0F",borderTopWidth:1,borderBottomWidth:1,borderColor:"#263036"},matrixRow:{flexDirection:"row",borderBottomWidth:1,borderBottomColor:"#22292E"},matrixTierLabel:{width:110,minHeight:94,justifyContent:"center",paddingLeft:10},matrixGuide:{color:"#4F5A60",fontFamily:fonts.displayExtra,fontSize:11,letterSpacing:1},matrixTierName:{color:"#D2D6D8",fontFamily:fonts.bold,fontSize:12},matrixTierKo:{color:"#747E83",fontFamily:fonts.medium,fontSize:11,marginTop:3},sportHeader:{width:145,minHeight:94,alignItems:"center",justifyContent:"center",borderLeftWidth:1,borderLeftColor:LINE},sportIcon:{width:34,height:34,borderRadius:17,borderWidth:1,alignItems:"center",justifyContent:"center"},sportName:{color:WHITE,fontFamily:fonts.bold,fontSize:13,marginTop:6},sportGoal:{color:"#717B80",fontFamily:fonts.medium,fontSize:11,marginTop:3},matrixCell:{width:145,minHeight:94,alignItems:"center",justifyContent:"center",borderLeftWidth:1,borderLeftColor:"#22292E"},
  typeGrid:{flexDirection:"row",flexWrap:"wrap",gap:8},typeItem:{width:"47.5%",minWidth:125,backgroundColor:"#0B1013",borderWidth:1,borderColor:"#20282D",borderRadius:uiLayout.panelRadius,alignItems:"center",paddingVertical:12,paddingHorizontal:6},typeValue:{color:"#E2E5E6",fontFamily:fonts.bold,fontSize:12,marginTop:7,textAlign:"center"},typeLabel:{color:"#737D82",fontFamily:fonts.medium,fontSize:11,marginTop:3,textAlign:"center"},
  masterRow:{gap:10,paddingHorizontal:2,paddingBottom:2},masterItem:{width:156,backgroundColor:"#0C1012",borderWidth:1,borderColor:"#283138",borderRadius:uiLayout.panelRadius,padding:12,alignItems:"center"},masterTop:{width:"100%",flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},masterSport:{color:WHITE,fontFamily:fonts.bold,fontSize:12},masterNumber:{color:"#687277",fontFamily:fonts.displayExtra,fontSize:10},masterCode:{fontFamily:fonts.displayExtra,fontSize:10,letterSpacing:.8,marginTop:9},
  specialRow:{flexDirection:"row",flexWrap:"wrap",gap:10},specialItem:{width:145,minHeight:150,backgroundColor:"#0C1012",borderWidth:1,borderColor:"#2A2421",borderRadius:uiLayout.panelRadius,padding:12,alignItems:"center"},specialEdition:{color:ORANGE,opacity:.55,fontFamily:fonts.displayExtra,fontSize:9,letterSpacing:.6,marginTop:5},materialRow:{flexDirection:"row",flexWrap:"wrap",gap:9},materialItem:{alignItems:"center",width:78,backgroundColor:"#0A0E10",borderRadius:uiLayout.panelRadius,paddingVertical:10},materialSwatch:{width:52,height:52,borderRadius:26,borderWidth:1,borderColor:"rgba(255,255,255,.3)",padding:5},swatchInner:{flex:1,borderRadius:22,borderWidth:1,borderColor:"rgba(0,0,0,.45)"},materialName:{color:"#BAC0C3",fontFamily:fonts.bold,fontSize:11,marginTop:7},materialCode:{color:"#586268",fontFamily:fonts.displayExtra,fontSize:10,marginTop:2}
});

const m = StyleSheet.create({
  wrap:{position:"relative",alignItems:"center"},loop:{position:"absolute",top:0,zIndex:1,backgroundColor:"#0B0E10",borderWidth:2,borderRadius:7,flexDirection:"row",justifyContent:"center",gap:3,paddingHorizontal:5,overflow:"hidden"},loopStripe:{height:"150%",width:3,backgroundColor:ORANGE,transform:[{rotate:"18deg"}]},neck:{position:"absolute",zIndex:2,height:13,backgroundColor:"#111518",borderWidth:1.5,borderRadius:3},
  disc:{position:"absolute",alignItems:"center",justifyContent:"center",padding:5,borderWidth:2,shadowColor:"#000",shadowOffset:{width:0,height:7},shadowOpacity:.55,shadowRadius:9,elevation:7},rim:{backgroundColor:"#0B0E10",borderWidth:2,alignItems:"center",justifyContent:"center",shadowColor:"#FFF",shadowOpacity:.08,shadowRadius:2},machineNotch:{position:"absolute",zIndex:3,width:11,height:3,borderRadius:2},notchTop:{top:3},notchRight:{right:0,transform:[{rotate:"90deg"}]},notchBottom:{bottom:3},notchLeft:{left:0,transform:[{rotate:"90deg"}]},tierEtch:{position:"absolute",top:7,fontFamily:fonts.displayExtra,fontSize:8,letterSpacing:.5},iconWell:{borderWidth:1.5,backgroundColor:"#07090A",alignItems:"center",justifyContent:"center"},masterM:{color:ORANGE,fontFamily:fonts.displayExtra,fontStyle:"italic",lineHeight:30},sportCode:{fontFamily:fonts.displayExtra,fontSize:8,letterSpacing:1.4,marginTop:3},groov:{color:"#7C858A",fontFamily:fonts.bold,fontSize:6,letterSpacing:.8,marginTop:2},compactTicks:{position:"absolute",bottom:6,flexDirection:"row",gap:2},compactTick:{width:4,height:2,borderRadius:1},
  typeWrap:{height:79,width:74,alignItems:"center",justifyContent:"flex-end"},typeLoop:{position:"absolute",top:0,width:26,height:14,borderWidth:2,borderColor:"#9AA0A3",borderRadius:6,backgroundColor:"#0C0F11"},specialLoop:{borderColor:ORANGE},typeDisc:{width:68,height:68,borderRadius:34,padding:4,borderWidth:1,borderColor:"rgba(255,255,255,.28)"},specialDisc:{borderColor:ORANGE},typeInner:{flex:1,borderRadius:30,backgroundColor:"#0B0E10",borderWidth:1,borderColor:"rgba(255,255,255,.3)",alignItems:"center",justifyContent:"center",gap:3},typeMark:{color:"#E7E2DA",fontFamily:fonts.displayExtra,fontSize:10,paddingHorizontal:3},typeMarkSpecial:{color:ORANGE}
});
