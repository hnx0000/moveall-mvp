import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Gem, Medal, Stamp } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  rewardCatalog,
  RewardCategory,
  RewardDesign,
  RewardKind,
} from "../src/rewards/reward-catalog";
import { uiLayout, fonts } from "../src/theme";
import { useAppTheme } from "../src/theme-context";
import { MedalDesignGallery } from "../src/rewards/medal-sculpted-gallery";
import { useDesignArchiveAccess } from "../src/rewards/use-design-archive-access";

const ORANGE = "#FF5A36";
const BLACK = "#07090B";

const CATEGORIES: Array<"전체" | RewardCategory> = [
  "전체",
  "시즌",
  "러닝",
  "멀티스포츠",
  "꾸준함",
  "리그",
  "기념",
];

export default function RewardCollection() {
  const { allowed, loading } = useDesignArchiveAccess();
  const { colors } = useAppTheme();
  const router = useRouter();
  if (!allowed) {
    return (
      <View style={[s.page, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center", gap: 18 }]}>
        {loading ? <ActivityIndicator color={colors.primary} /> : (
          <>
            <Text style={{ color: colors.ink }}>관리자 전용 디자인 보관함입니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/profile")} style={{ padding: 16 }}>
              <Text style={{ color: colors.primary }}>마이페이지로 돌아가기</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }
  return <RewardCollectionContent />;
}

function RewardCollectionContent() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [kind, setKind] = useState<RewardKind>(params.tab === "stamp" ? "stamp" : "medal");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("전체");
  const designs = useMemo(
    () =>
      rewardCatalog.filter(
        (item) => item.kind === kind && (category === "전체" || item.category === category),
      ),
    [kind, category],
  );

  return (
    <View style={[s.page, { backgroundColor: colors.background }]}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="뒤로가기" onPress={() => router.back()} style={s.back}>
          <ChevronLeft color={colors.ink} size={24} />
        </Pressable>
        <View style={s.headCopy}>
          <Text style={s.eyebrow}>GROOV DESIGN ARCHIVE</Text>
          <Text style={[s.title, { color: colors.ink }]}>로고·보상 디자인 보관함</Text>
        </View>
        <View style={s.back} />
      </View>
      <ScrollView contentContainerStyle={s.content} stickyHeaderIndices={[1]}>
        <View style={[s.intro, kind === "medal" && { display: "none" }]}>
          <Text style={[s.introTitle, { color: colors.ink }]}>GROOV 디자인 보관함</Text>
          <Text style={[s.introBody, { color: colors.muted }]}>
            입체 조형과 각인으로 제작한 메달 디자인입니다. 실제 MY·지급 기능에는 적용하지 않습니다.
          </Text>
        </View>
        <View style={[s.controls, { backgroundColor: colors.background }]}>
          <View style={[s.kindTabs, { borderColor: colors.border }]}>
            <KindButton
              active={kind === "stamp"}
              icon="stamp"
              label={`스탬프 ${rewardCatalog.length}`}
              onPress={() => setKind("stamp")}
            />
            <KindButton
              active={kind === "medal"}
              icon="medal"
              label="원형 메달 106"
              onPress={() => setKind("medal")}
            />
          </View>
          {kind === "stamp" ? (
            <ScrollView
              contentContainerStyle={s.filters}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[s.filter, category === item && s.filterOn]}
                >
                  <Text style={[s.filterText, category === item && s.filterTextOn]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
        {kind === "medal" ? (
          <MedalDesignGallery />
        ) : (
          <View style={s.grid}>
            {designs.map((design, index) => (
              <ArchiveRewardTile key={design.id} design={design} index={index} />
            ))}
          </View>
        )}
        {kind === "stamp" && designs.length === 0 ? (
          <Text style={[s.empty, { color: colors.muted }]}>이 분류의 디자인은 아직 없습니다.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function KindButton({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: "stamp" | "medal" | "concept";
  onPress: () => void;
}) {
  const iconColor = active ? BLACK : ORANGE;
  return (
    <Pressable onPress={onPress} style={[s.kindButton, active && s.kindOn]}>
      {icon === "stamp" ? (
        <Stamp color={iconColor} size={17} />
      ) : icon === "concept" ? (
        <Gem color={iconColor} size={17} />
      ) : (
        <Medal color={iconColor} size={17} />
      )}
      <Text style={[s.kindText, active && s.kindTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ArchiveRewardTile({ design, index }: { design: RewardDesign; index: number }) {
  return (
    <View style={s.tile}>
      <View style={s.art}>
        <StampMark design={design} variant={index % 5} />
      </View>
      <View style={s.tileCopy}>
        <View style={s.row}>
          <Text style={s.category}>{design.category}</Text>
          <Text style={s.status}>{design.status === "ready" ? "READY" : "DESIGN"}</Text>
        </View>
        <Text style={s.name}>{design.name}</Text>
        <Text style={s.condition}>{design.condition}</Text>
        <Text style={s.edition}>{design.edition}</Text>
      </View>
    </View>
  );
}

function StampMark({ design, variant }: { design: RewardDesign; variant: number }) {
  if (variant === 0)
    return (
      <View style={s.circle}>
        <Text style={s.micro}>GROOV</Text>
        <Text style={s.mark}>{design.mark}</Text>
        <Text style={s.micro}>VERIFIED</Text>
      </View>
    );
  if (variant === 1)
    return (
      <View style={s.square}>
        <Text style={s.micro}>{design.category}</Text>
        <Text style={s.mark}>{design.mark}</Text>
        <View style={s.line} />
      </View>
    );
  if (variant === 2)
    return (
      <View style={s.double}>
        <View style={s.doubleInner}>
          <Text style={s.mark}>{design.mark}</Text>
        </View>
      </View>
    );
  if (variant === 3)
    return (
      <View style={s.band}>
        <Text style={s.microDark}>GROOV AWARD</Text>
        <Text style={s.markDark}>{design.mark}</Text>
      </View>
    );
  return (
    <View style={s.target}>
      <View style={s.targetIn}>
        <Text style={s.mark}>{design.mark}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  header: {
    minHeight: 78,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headCopy: { flex: 1, alignItems: "center" },
  eyebrow: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 8, letterSpacing: 1.4 },
  title: { fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 18, paddingBottom: 70 },
  intro: { paddingVertical: 18 },
  introTitle: { fontFamily: fonts.bold, fontSize: 23 },
  introBody: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 17,
    marginTop: 7,
    maxWidth: 520,
  },
  controls: { paddingBottom: 12, gap: 10 },
  kindTabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: uiLayout.panelRadius,
    padding: 4,
  },
  kindButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: uiLayout.controlRadius,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  kindOn: { backgroundColor: ORANGE },
  kindText: { color: ORANGE, fontFamily: fonts.bold, fontSize: 11 },
  kindTextOn: { color: BLACK },
  filters: { gap: 7 },
  filter: {
    borderWidth: 1,
    borderColor: "#342019",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: uiLayout.controlRadius,
  },
  filterOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  filterText: { color: ORANGE, fontFamily: fonts.medium, fontSize: 9 },
  filterTextOn: { color: BLACK, fontFamily: fonts.bold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48.5%",
    backgroundColor: BLACK,
    borderWidth: 1,
    borderColor: "#291711",
    borderRadius: uiLayout.panelRadius,
    overflow: "hidden",
  },
  art: {
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#291711",
  },
  tileCopy: { padding: 13 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  category: { color: ORANGE, fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1 },
  status: { color: ORANGE, opacity: 0.45, fontFamily: fonts.bold, fontSize: 7 },
  name: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 13, marginTop: 8 },
  condition: { color: ORANGE, opacity: 0.65, fontFamily: fonts.medium, fontSize: 8, marginTop: 4 },
  edition: { color: ORANGE, opacity: 0.32, fontFamily: fonts.medium, fontSize: 7, marginTop: 10 },
  circle: {
    width: 125,
    height: 125,
    borderRadius: 63,
    borderWidth: 4,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  square: {
    width: 125,
    height: 105,
    borderWidth: 3,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "space-around",
    padding: 10,
    transform: [{ rotate: "-3deg" }],
  },
  double: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: ORANGE,
    padding: 7,
  },
  doubleInner: {
    flex: 1,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  band: {
    width: "90%",
    height: 76,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  target: { width: 130, height: 130, borderRadius: 65, backgroundColor: ORANGE, padding: 20 },
  targetIn: {
    flex: 1,
    borderRadius: 50,
    backgroundColor: BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  micro: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 6, letterSpacing: 1.5 },
  microDark: { color: BLACK, fontFamily: fonts.displayExtra, fontSize: 6, letterSpacing: 1.5 },
  mark: { color: ORANGE, fontFamily: fonts.displayExtra, fontSize: 30 },
  markDark: { color: BLACK, fontFamily: fonts.displayExtra, fontSize: 30 },
  line: { height: 2, width: "100%", backgroundColor: ORANGE },
  empty: { fontFamily: fonts.medium, fontSize: 11, textAlign: "center", padding: 50 },
});
