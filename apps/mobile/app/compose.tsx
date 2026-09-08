import { useLocalSearchParams, useRouter } from "expo-router";
import { ContentEditor } from "../src/components/content-editor";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { PostCreateInputSchema, type PostCreateInput } from "@moveall/contracts";
import { pendingSaves } from "../src/api/pending-save-runtime";
import { useAuth } from "../src/auth/auth-context";
import { useAppTheme } from "../src/theme-context";

export default function ComposeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const [recovered, setRecovered] = useState<{
    owner: string;
    key: string;
    input: PostCreateInput | null;
  } | null>(null);
  const params = useLocalSearchParams<{
    kind?: string;
    direct?: string;
    workoutSessionId?: string;
    draft?: string;
    photo?: string;
    rejectedDraftKey?: string;
  }>();
  useEffect(() => {
    let active = true;
    setRecovered(null);
    if (session && params.rejectedDraftKey) {
      const owner = session.user.id,
        key = params.rejectedDraftKey;
      void pendingSaves
        .rejectedDrafts(owner)
        .then((items) => {
          const item = items.find(
            (item) => item.owner === owner && item.key === key && item.kind === "post.create",
          );
          const parsed = PostCreateInputSchema.safeParse(item?.input);
          if (active) setRecovered({ owner, key, input: parsed.success ? parsed.data : null });
        })
        .catch(() => {
          if (active) setRecovered({ owner, key, input: null });
        });
    }
    return () => {
      active = false;
    };
  }, [session?.user.id, params.rejectedDraftKey]);
  const requestedRecovery = !!params.rejectedDraftKey;
  const currentRecovery =
    recovered?.owner === session?.user.id && recovered?.key === params.rejectedDraftKey
      ? recovered
      : null;
  if (requestedRecovery && !currentRecovery?.input)
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ color: colors.ink }}>
          {currentRecovery
            ? "현재 계정에서 이 초안을 찾을 수 없습니다."
            : "현재 계정의 초안을 확인하고 있습니다."}
        </Text>
      </View>
    );
  const draft = requestedRecovery ? currentRecovery!.input : null;
  return (
    <ContentEditor
      key={`${session?.user.id ?? "signed-out"}:${params.rejectedDraftKey ?? "new"}`}
      directEditor={params.direct === "1"}
      contentType={draft ? (draft.contentType ?? "post") : params.kind === "story" ? "story" : "post"}
      initialWorkoutId={draft ? draft.workoutSessionId : params.workoutSessionId}
      initialCaption={draft ? draft.content : params.draft}
      initialPhoto={requestedRecovery ? undefined : params.photo}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      onPosted={async () => {
        router.replace("/");
      }}
    />
  );
}
