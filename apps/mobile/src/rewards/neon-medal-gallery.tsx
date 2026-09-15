import type { SportType } from "@moveall/contracts";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useMemo, useState } from "react";
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
import { fonts } from "../theme";
import {
  neonMedalDesigns,
  neonMedalSources,
  neonMedalSports,
  type NeonMedalDesign,
} from "./neon-medal-catalog";

export function NeonMedalGallery() {
  const { width } = useWindowDimensions();
  const [sport, setSport] = useState<SportType>("running");
  const [selected, setSelected] = useState<NeonMedalDesign | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const designs = useMemo(() => neonMedalDesigns.filter((item) => item.sport === sport), [sport]);
  const selectedIndex = selected ? designs.findIndex((item) => item.id === selected.id) : -1;
  const columns = gridWidth > 700 ? 3 : 2;
  const tileWidth = Math.max(1, ((gridWidth || width - 64) - (columns - 1) * 12) / columns);

  return (
    <View style={s.gallery}>
      <View style={s.heading}>
        <Text style={s.title}>종목별 네온 메달</Text>
        <Text style={s.count}>{neonMedalDesigns.length}종</Text>
      </View>
      <Text style={s.note}>
        6종목 · 각 10개 시안. 기록 수치는 디자인 예시이며 실제 지급 조건이 아닙니다.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
      >
        {neonMedalSports.map((item) => (
          <Pressable
            key={item.key}
            testID={"neon-medal-sport-" + item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label + " 네온 메달 10종"}
            accessibilityState={{ selected: sport === item.key }}
            onPress={() => {
              setSport(item.key);
              setSelected(null);
            }}
            style={[s.filter, sport === item.key && s.filterActive]}
          >
            <Text style={[s.filterText, sport === item.key && s.filterTextActive]}>
              {item.label} 10
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={s.grid} onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
        {designs.map((design) => (
          <Pressable
            key={design.id}
            testID={"neon-medal-" + design.id}
            accessibilityRole="button"
            accessibilityLabel={design.id + " " + design.title + " 확대 보기"}
            onPress={() => setSelected(design)}
            style={({ pressed }) => [s.tile, { width: tileWidth, opacity: pressed ? 0.75 : 1 }]}
          >
            <Image
              source={neonMedalSources[design.id]}
              resizeMode="contain"
              style={{ width: tileWidth - 2, height: tileWidth - 2 }}
              accessibilityLabel={design.title + ", " + design.metric + " 디자인 예시"}
            />
            <View style={s.tileCopy}>
              <Text style={s.id}>{design.id}</Text>
              <Text style={s.name}>{design.title}</Text>
              <Text style={s.metric}>{design.metric}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.scrim}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="네온 메달 상세 배경 닫기"
            onPress={() => setSelected(null)}
          />
          <View style={s.dialog} accessibilityViewIsModal>
            <View style={s.dialogHeader}>
              <Text style={s.id}>{selected?.id} · 디자인 시안</Text>
              <Pressable
                style={s.iconButton}
                accessibilityRole="button"
                accessibilityLabel="네온 메달 상세 닫기"
                onPress={() => setSelected(null)}
              >
                <X size={24} color="#F4F2EF" />
              </Pressable>
            </View>
            {selected && (
              <ScrollView contentContainerStyle={s.detail}>
                <Image
                  source={neonMedalSources[selected.id]}
                  resizeMode="contain"
                  style={{ width: Math.max(1, Math.min(width - 64, 430)), aspectRatio: 1 }}
                  accessibilityLabel={selected.title}
                />
                <Text style={s.detailTitle}>{selected.title}</Text>
                <Text style={s.english}>{selected.name}</Text>
                <Text style={s.metric}>기록 예시 · {selected.metric}</Text>
                <Text style={s.note}>디자인 비교용 · 실제 메달 지급 미연결</Text>
              </ScrollView>
            )}
            <View style={s.pager}>
              <Pressable
                style={[s.iconButton, selectedIndex <= 0 && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel="이전 네온 메달"
                disabled={selectedIndex <= 0}
                onPress={() => setSelected(designs[selectedIndex - 1] ?? null)}
              >
                <ChevronLeft size={24} color="#F4F2EF" />
              </Pressable>
              <Text style={s.note}>
                {selectedIndex + 1} / {designs.length}
              </Text>
              <Pressable
                style={[s.iconButton, selectedIndex >= designs.length - 1 && s.disabled]}
                accessibilityRole="button"
                accessibilityLabel="다음 네온 메달"
                disabled={selectedIndex >= designs.length - 1}
                onPress={() => setSelected(designs[selectedIndex + 1] ?? null)}
              >
                <ChevronRight size={24} color="#F4F2EF" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  gallery: { backgroundColor: "#090B0D", padding: 12, gap: 16, borderRadius: 16 },
  heading: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, color: "#F4F2EF", flex: 1 },
  count: { fontFamily: fonts.bold, fontSize: 20, color: "#FF5A36" },
  note: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: "#A7A5A2" },
  filters: { gap: 8 },
  filter: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#343434",
  },
  filterActive: { backgroundColor: "#FF5A36", borderColor: "#FF5A36" },
  filterText: { color: "#CCC9C4", fontFamily: fonts.bold, fontSize: 14 },
  filterTextActive: { color: "#130C09" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#2A2420",
    borderRadius: 12,
    overflow: "hidden",
  },
  tileCopy: { padding: 12, gap: 5 },
  id: { color: "#FF7A59", fontFamily: fonts.bold, fontSize: 13 },
  name: { color: "#F4F2EF", fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  metric: { color: "#BAB5AF", fontFamily: fonts.medium, fontSize: 14, lineHeight: 22 },
  scrim: {
    flex: 1,
    backgroundColor: "#000D",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  dialog: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "94%",
    backgroundColor: "#090B0D",
    borderWidth: 1,
    borderColor: "#3A302A",
    borderRadius: 16,
    overflow: "hidden",
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 4,
  },
  iconButton: { width: 48, height: 48, justifyContent: "center", alignItems: "center" },
  detail: { paddingHorizontal: 12, paddingBottom: 20, alignItems: "center", gap: 10 },
  detailTitle: { color: "#F4F2EF", fontFamily: fonts.bold, fontSize: 24, textAlign: "center" },
  english: { color: "#D2CBC4", fontFamily: fonts.medium, fontSize: 14, textAlign: "center" },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#2A2420",
    paddingHorizontal: 8,
  },
  disabled: { opacity: 0.25 },
});
