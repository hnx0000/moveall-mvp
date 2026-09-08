import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Maximize2 } from "lucide-react-native";
import { useAuth } from "../auth/auth-context";
import {
  changeCourseLibrary,
  loadCourseLibrary,
  watchCourses,
} from "../features/maps/course-storage";
import { type MapCourse } from "../features/maps/map-state";
import { GroovMapSurface } from "./groov-map-surface";

type Props = {
  kind: "course" | "ranking";
  compact?: boolean;
  state?: Record<string, unknown>;
  onRegionSelect?: (area: { code: string; name: string; province: string }) => void;
};
export function GroovMapFrame({ kind, compact = false, state = {}, onRegionSelect }: Props) {
  const { session, onboarding } = useAuth();
  const userId = session?.user.id;
  const [course, setCourse] = useState<MapCourse | null>(null);
  const [destination, setDestination] = useState<Props["kind"] | null>(null);
  useEffect(() => {
    setCourse(null);
    let cancelled = false,
      changed = false;
    if (userId)
      void loadCourseLibrary(userId)
        .then((l) => {
          if (!cancelled && !changed) setCourse(l.selected);
        })
        .catch(() => {});
    const stop = watchCourses((id, library) => {
      if (id === userId) {
        changed = true;
        setCourse(library.selected);
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId]);
  const area = onboarding?.neighborhood;
  const age = area ? Date.now() - Date.parse(area.verifiedAt) : Infinity;
  const neighborhood =
    session && area && age >= 0 && age <= 30 * 86400000
      ? {
          neighborhood: area.neighborhood,
          district: area.district,
          province: area.province,
          regionCode: area.regionCode,
          latitude: area.latitude,
          longitude: area.longitude,
          verifiedAt: area.verifiedAt,
        }
      : null;
  const mapState = { ...state, course, neighborhood, compact };
  const onMessage = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      if (
        type === "region-select" &&
        typeof payload.code === "string" &&
        typeof payload.name === "string" &&
        typeof payload.province === "string"
      )
        onRegionSelect?.({ code: payload.code, name: payload.name, province: payload.province });
      if (type === "navigate" && (payload.kind === "course" || payload.kind === "ranking"))
        setDestination(payload.kind);
      if (type.startsWith("course-")) {
        if (!userId) throw new Error("코스를 저장하거나 적용하려면 로그인해주세요.");
        if (type === "course-list") return loadCourseLibrary(userId);
        if (["course-save", "course-remove", "course-use"].includes(type))
          return changeCourseLibrary(
            userId,
            type,
            type === "course-remove" ? payload.courseId : payload.course,
          );
      }
      return null;
    },
    [userId, onRegionSelect],
  );
  return (
    <View style={{ flex: 1 }}>
      <GroovMapSurface
        key={`${userId ?? "guest"}:${kind}`}
        kind={kind}
        compact={compact}
        state={mapState}
        onMessage={onMessage}
      />
      {destination ? (
        <MapModal kind={destination} onClose={() => setDestination(null)} state={state} />
      ) : null}
    </View>
  );
}
export function MapModal({
  kind,
  onClose,
  state = {},
}: {
  kind: Props["kind"];
  onClose: () => void;
  state?: Record<string, unknown>;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#101113" }}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="지도를 닫고 돌아가기"
            onPress={onClose}
            style={styles.back}
          >
            <ChevronLeft color="#ff5733" size={24} />
          </Pressable>
          <Text style={styles.title}>{kind === "course" ? "코스지도" : "랭킹지도"}</Text>
        </View>
        <GroovMapFrame kind={kind} state={state} />
      </SafeAreaView>
    </Modal>
  );
}
export function GroovRankingMap({
  state,
  onRegionSelect,
}: {
  state: Record<string, unknown>;
  onRegionSelect: NonNullable<Props["onRegionSelect"]>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ height: 520, overflow: "hidden", borderRadius: 22, backgroundColor: "#101113" }}>
      <GroovMapFrame kind="ranking" state={state} onRegionSelect={onRegionSelect} />
      <Pressable
        accessibilityLabel="랭킹지도 전체화면"
        onPress={() => setExpanded(true)}
        style={styles.expand}
      >
        <Maximize2 color="#ff5733" size={18} />
      </Pressable>
      {expanded ? (
        <Modal visible animationType="slide" onRequestClose={() => setExpanded(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#101113" }}>
            <View style={styles.header}>
              <Pressable
                accessibilityLabel="랭킹지도 닫기"
                onPress={() => setExpanded(false)}
                style={styles.back}
              >
                <ChevronLeft color="#ff5733" size={24} />
              </Pressable>
              <Text style={styles.title}>랭킹지도</Text>
            </View>
            <GroovMapFrame kind="ranking" state={state} onRegionSelect={onRegionSelect} />
          </SafeAreaView>
        </Modal>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#282828",
  },
  back: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { color: "#f4f4f4", fontWeight: "700", fontSize: 16 },
  expand: {
    position: "absolute",
    bottom: 24,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
});
