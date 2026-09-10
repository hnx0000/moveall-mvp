import {
  sportLabels,
  type PlannerEntry,
  type SharingCrew,
  type WorkoutSession,
} from "@moveall/contracts"; import { uiLayout } from "../theme";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, Text, TextInput, View, Switch } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { Screen, StatePanel } from "../components/ui";
import { useAppTheme } from "../theme-context";
import { ExerciseBibleScreen } from "./exercise-bible-screen";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function PlannerScreen() {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [month, setMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [entries, setEntries] = useState<PlannerEntry[]>([]);
  const [crews, setCrews] = useState<SharingCrew[]>([]);
  const [showCrew, setShowCrew] = useState(true);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<"workout" | "meal">("workout");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!session) return;
    const revision = ++generation.current;
    try {
      const [records, plans, groups] = await Promise.all([
        api.workouts(session.accessToken),
        api.plannerEntries(session.accessToken, month),
        api.sharingCrews(session.accessToken),
      ]);
      if (revision !== generation.current) return;
      setWorkouts(records);
      setEntries(plans);
      setCrews(groups);
      setError("");
    } catch {
      if (revision === generation.current)
        setError("일정을 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  }, [session, month]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 30000);
      return () => {
        clearInterval(timer);
        generation.current++;
      };
    }, [load]),
  );
  const records = useMemo(
    () => workouts.filter((w) => dateKey(new Date(w.startedAt)).startsWith(month)),
    [workouts, month],
  );
  const visible = entries.filter((entry) => showCrew || entry.userId === session?.user.id);
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  const offset = new Date(year, monthNumber - 1, 1).getDay();
  const days = new Date(year, monthNumber, 0).getDate();
  const changeMonth = (delta: number) => {
    const next = dateKey(new Date(year, monthNumber - 1 + delta, 1));
    setMonth(next.slice(0, 7));
    setSelected(next);
    setEntries([]);
  };
  const text = { color: colors.ink, fontSize: 14 };
  const card = {
    backgroundColor: colors.surface,
    borderRadius: uiLayout.panelRadius,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  };
  const save = async () => {
    if (!session || !title.trim() || busy) return;
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setError("시간은 19:30 형식으로 입력해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await api.createPlannerEntry(session.accessToken, {
        date: selected,
        title: title.trim(),
        kind,
        ...(time ? { time } : {}),
        crewIds: shareIds,
      });
      setTitle("");
      setTime("");
      await load();
    } catch {
      setError("일정을 저장하지 못했습니다. 입력한 내용을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="플랜" subtitle="한 달의 운동 · 식단 · 함께하는 일정" onRefresh={load}>
      {error ? <StatePanel state="error" message={error} onRetry={() => void load()} /> : null}
      <View style={card}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Pressable
            accessibilityLabel="이전 달"
            onPress={() => changeMonth(-1)}
            style={{ padding: 12 }}
          >
            <Text style={text}>‹</Text>
          </Pressable>
          <Text style={{ ...text, fontSize: 23, fontWeight: "700" }}>
            {year}.{String(monthNumber).padStart(2, "0")}
          </Text>
          <Pressable
            accessibilityLabel="다음 달"
            onPress={() => changeMonth(1)}
            style={{ padding: 12 }}
          >
            <Text style={text}>›</Text>
          </Pressable>
        </View>
        <Text style={{ ...text, color: colors.primary }}>
          {new Set(records.map((w) => dateKey(new Date(w.startedAt)))).size}일 운동 ·{" "}
          {records.length}개 기록
        </Text>
        <View style={{ flexDirection: "row" }}>
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
            <Text
              key={day}
              style={{ ...text, width: "14.2857%", textAlign: "center", color: colors.muted }}
            >
              {day}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
            const day = i - offset + 1;
            const key = `${month}-${String(day).padStart(2, "0")}`;
            const valid = day > 0 && day <= days;
            const done = records.filter((w) => dateKey(new Date(w.startedAt)) === key).length;
            const planned = visible.filter((entry) => entry.date === key);
            return (
              <Pressable
                key={i}
                disabled={!valid}
                accessibilityLabel={
                  valid ? `${key}, 운동기록 ${done}개, 일정 ${planned.length}개` : undefined
                }
                onPress={() => setSelected(key)}
                style={{
                  width: "14.2857%",
                  minHeight: 58,
                  alignItems: "center",
                  paddingTop: 10,
                  gap: 7,
                  borderRadius: uiLayout.panelRadius,
                  backgroundColor: valid && selected === key ? colors.primarySoft : "transparent",
                  borderWidth: valid && selected === key ? 1 : 0,
                  borderColor: colors.primary,
                }}
              >
                <Text style={text}>{valid ? day : ""}</Text>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {valid && done > 0 ? (
                    <Text style={{ color: colors.primary, fontSize: 10 }}>●</Text>
                  ) : null}
                  {valid && planned.length > 0 ? (
                    <Text style={{ color: "#63a8db", fontSize: 10 }}>●</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ ...text, fontSize: 12, color: colors.muted }}>
          주황 · 완료한 운동 / 파랑 · 운동·식단·크루 일정
        </Text>
      </View>
      <View style={card}>
        <View
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ ...text, fontWeight: "700" }}>크루가 공유한 일정 함께 보기</Text>
          <Switch
            accessibilityLabel="크루 일정 표시"
            value={showCrew}
            onValueChange={setShowCrew}
          />
        </View>
        <Text style={{ ...text, color: colors.muted }}>
          서로 공유하기로 한 일정만 표시됩니다. 새 일정은 기본적으로 나만 볼 수 있어요.
        </Text>
      </View>
      <View style={card}>
        <Text style={{ ...text, fontSize: 18, fontWeight: "700" }}>{selected} 일정</Text>
        {records
          .filter((w) => dateKey(new Date(w.startedAt)) === selected)
          .map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.push("/profile/records")}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}
            >
              <Text style={text}>{sportLabels[w.sport]} · 운동 완료</Text>
              <Text style={{ ...text, color: colors.muted }}>
                {new Date(w.startedAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60000)}분
              </Text>
            </Pressable>
          ))}
        {visible
          .filter((entry) => entry.date === selected)
          .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))
          .map((entry) => (
            <View
              key={entry.id}
              style={{
                gap: 5,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={text}>
                {entry.kind === "meal" ? "식단" : "운동 계획"} · {entry.time ?? "시간 미정"}
              </Text>
              <Text style={{ ...text, fontWeight: "700" }}>{entry.title}</Text>
              <Text style={{ ...text, color: colors.muted }}>
                {entry.userId === session?.user.id ? "나" : entry.displayName}
              </Text>
              {entry.userId === session?.user.id ? (
                <Pressable
                  disabled={busy}
                  onPress={async () => {
                    if (!session) return;
                    setBusy(true);
                    try {
                      await api.deletePlannerEntry(session.accessToken, entry.id);
                      await load();
                    } catch {
                      setError("일정을 삭제하지 못했습니다.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Text style={{ ...text, color: colors.primary }}>일정 삭제</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        {!records.some((w) => dateKey(new Date(w.startedAt)) === selected) &&
        !visible.some((entry) => entry.date === selected) ? (
          <Text style={{ ...text, color: colors.muted }}>아직 기록이나 일정이 없어요.</Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: 16 }}>
          {(["workout", "meal"] as const).map((value) => (
            <Pressable key={value} onPress={() => setKind(value)} style={{ paddingVertical: 10 }}>
              <Text style={{ ...text, color: kind === value ? colors.primary : colors.muted }}>
                {value === "workout" ? "운동 계획" : "식단"}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="일정 내용"
          placeholder={kind === "meal" ? "예: 저녁 · 현미밥과 닭가슴살" : "예: 크루와 한강 5km"}
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          style={{
            ...text,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: uiLayout.panelRadius,
          }}
        />
        <TextInput
          accessibilityLabel="일정 시간"
          placeholder="시간 선택 · 19:30 (선택사항)"
          placeholderTextColor={colors.muted}
          value={time}
          onChangeText={setTime}
          maxLength={5}
          style={{
            ...text,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: uiLayout.panelRadius,
          }}
        />
        {crews.map((crew) => (
          <View
            key={crew.id}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={text}>{crew.name}에 이 일정 공유</Text>
            <Switch
              value={shareIds.includes(crew.id)}
              onValueChange={(on) =>
                setShareIds((ids) => (on ? [...ids, crew.id] : ids.filter((id) => id !== crew.id)))
              }
            />
          </View>
        ))}
        <Pressable
          disabled={!session || !title.trim() || busy}
          onPress={() => void save()}
          style={{
            padding: 14,
            borderRadius: uiLayout.panelRadius,
            backgroundColor: colors.primary,
            opacity: !session || !title.trim() || busy ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
            {busy ? "저장 중…" : "일정 저장"}
          </Text>
        </Pressable>
      </View>
      <ExerciseBibleScreen embedded />
    </Screen>
  );
}
