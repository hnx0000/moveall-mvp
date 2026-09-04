import type { PostAudience, PublicUser, SharingCrew } from "@moveall/contracts";
import { Check, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts } from "../theme";
import { useAppTheme } from "../theme-context";

export const audienceLabels: Record<PostAudience["scope"], string> = {
  public: "전체 공개",
  followers: "팔로워",
  mutuals: "맞팔",
  crews: "특정 크루",
  users: "특정 사용자",
  private: "나만 보기",
  none: "댓글 OFF",
};
export function audienceComplete(value: PostAudience) {
  return value.scope === "users"
    ? Boolean(value.userIds?.length)
    : value.scope === "crews"
      ? Boolean(value.crewIds?.length)
      : true;
}

export function PostAudiencePicker({
  label,
  value,
  onChange,
  people,
  crews,
  comments = false,
  onCreateCrew,
  onError,
}: {
  label: string;
  value: PostAudience;
  onChange: (value: PostAudience) => void;
  people: PublicUser[];
  crews: SharingCrew[];
  comments?: boolean;
  onCreateCrew: (name: string, memberIds: string[]) => Promise<SharingCrew>;
  onError: (message: string) => void;
}) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const row = (title: string, active: boolean, press: () => void, detail?: string) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      onPress={press}
      style={[s.row, { borderColor: colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.text, { color: colors.ink }]}>{title}</Text>
        {detail ? <Text style={[s.hint, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <View
        style={[
          s.check,
          {
            borderColor: active ? colors.primary : colors.border,
            backgroundColor: active ? colors.primary : "transparent",
          },
        ]}
      >
        {active ? <Check size={16} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
  const toggle = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${audienceLabels[value.scope]}`}
        onPress={() => {
          setDraft(value);
          setCreating(false);
          setSearch("");
          setOpen(true);
        }}
        style={[s.field, { borderColor: colors.border }]}
      >
        <Text style={[s.text, { color: colors.ink }]}>{label}</Text>
        <View style={s.inline}>
          <Text style={[s.hint, { color: colors.muted }]}>
            {audienceLabels[value.scope]}
            {value.scope === "users"
              ? ` · ${value.userIds?.length ?? 0}명`
              : value.scope === "crews"
                ? ` · ${value.crewIds?.length ?? 0}개`
                : ""}
          </Text>
          <ChevronRight size={18} color={colors.muted} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setOpen(false);
        }}
      >
        <View style={s.backdrop}>
          <SafeAreaView style={[s.sheet, { backgroundColor: colors.background }]}>
            <View style={s.header}>
              <Text style={[s.title, { color: colors.ink }]}>
                {creating ? "공유 크루 만들기" : label}
              </Text>
              <Pressable
                accessibilityLabel="공개 범위 닫기"
                disabled={busy}
                onPress={() => setOpen(false)}
                hitSlop={12}
              >
                <X color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            >
              {!creating ? (
                (Object.keys(audienceLabels) as PostAudience["scope"][])
                  .filter((scope) => (comments ? scope !== "private" : scope !== "none"))
                  .map((scope) => (
                    <View key={scope}>
                      {row(
                        audienceLabels[scope],
                        draft.scope === scope,
                        () => {
                          setDraft({ scope });
                          setSearch("");
                        },
                        scope === "followers"
                          ? "나를 팔로우하는 사람"
                          : scope === "mutuals"
                            ? "서로 팔로우하는 사람"
                            : undefined,
                      )}
                    </View>
                  ))
              ) : (
                <>
                  <Text style={[s.hint, { color: colors.muted, marginBottom: 12 }]}>
                    내가 관리하는 공개 대상 목록이에요. 상대를 크루에 가입시키거나 초대하지
                    않습니다.
                  </Text>
                  <TextInput
                    accessibilityLabel="공유 크루 이름"
                    value={name}
                    onChangeText={setName}
                    maxLength={30}
                    placeholder="크루 이름"
                    placeholderTextColor={colors.muted}
                    style={[s.input, { color: colors.ink, borderColor: colors.border }]}
                  />
                </>
              )}
              {creating || draft.scope === "users" ? (
                <>
                  <TextInput
                    accessibilityLabel="공개 대상 이름 검색"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="팔로워·팔로잉에서 찾기"
                    placeholderTextColor={colors.muted}
                    style={[
                      s.input,
                      { color: colors.ink, borderColor: colors.border, marginTop: 14 },
                    ]}
                  />
                  {people
                    .filter((person) =>
                      person.displayName.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((person) => (
                      <View key={person.id}>
                        {row(
                          person.displayName,
                          (creating ? members : (draft.userIds ?? [])).includes(person.id),
                          () =>
                            creating
                              ? setMembers(toggle(members, person.id))
                              : setDraft({
                                  ...draft,
                                  userIds: toggle(draft.userIds ?? [], person.id),
                                }),
                        )}
                      </View>
                    ))}
                  {!people.length ? (
                    <Text style={[s.hint, { color: colors.muted, paddingVertical: 20 }]}>
                      선택할 팔로워·팔로잉이 없습니다.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {!creating && draft.scope === "crews" ? (
                <>
                  <Text style={[s.hint, { color: colors.muted, marginVertical: 12 }]}>
                    여러 크루를 선택할 수 있어요. 게시 시점의 멤버에게 공개됩니다.
                  </Text>
                  {crews.map((crew) => (
                    <View key={crew.id}>
                      {row(
                        crew.name,
                        draft.crewIds?.includes(crew.id) ?? false,
                        () => setDraft({ ...draft, crewIds: toggle(draft.crewIds ?? [], crew.id) }),
                        `${crew.memberIds.length}명`,
                      )}
                    </View>
                  ))}
                  <Pressable
                    onPress={() => {
                      setCreating(true);
                      setName("");
                      setMembers([]);
                    }}
                    style={{ paddingVertical: 20 }}
                  >
                    <Text style={[s.text, { color: colors.primary }]}>+ 공유 크루 만들기</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              disabled={
                busy || (creating ? !name.trim() || !members.length : !audienceComplete(draft))
              }
              onPress={() => {
                if (!creating) {
                  onChange(draft);
                  setOpen(false);
                  return;
                }
                setBusy(true);
                void onCreateCrew(name.trim(), members)
                  .then((crew) => {
                    setDraft({
                      scope: "crews",
                      crewIds: [...new Set([...(draft.crewIds ?? []), crew.id])],
                    });
                    setCreating(false);
                  })
                  .catch((error) => {
                    setOpen(false);
                    onError(error instanceof Error ? error.message : "크루를 저장하지 못했습니다.");
                  })
                  .finally(() => setBusy(false));
              }}
              style={[
                s.done,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    busy || (creating ? !name.trim() || !members.length : !audienceComplete(draft))
                      ? 0.4
                      : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[s.text, { color: "#FFFFFF" }]}>
                  {creating ? "크루 저장" : "선택 완료"}
                </Text>
              )}
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}
const s = StyleSheet.create({
  field: {
    paddingVertical: 19,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 7 },
  text: { fontFamily: fonts.semibold, fontSize: 15 },
  hint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
  title: { fontFamily: fonts.bold, fontSize: 19 },
  header: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000099",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: { width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: 24, overflow: "hidden" },
  row: {
    minHeight: 56,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  input: { fontFamily: fonts.regular, fontSize: 15, padding: 14, borderWidth: 1, borderRadius: 12 },
  done: { margin: 18, borderRadius: 16, padding: 16, alignItems: "center" },
});
