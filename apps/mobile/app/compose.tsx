import { useLocalSearchParams, useRouter } from "expo-router";
import { ContentEditor } from "../src/components/content-editor";

export default function ComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    kind?: string;
    direct?: string;
    workoutSessionId?: string;
    draft?: string;
    photo?: string;
  }>();
  return (
    <ContentEditor
      directEditor={params.direct === "1"}
      contentType={params.kind === "story" ? "story" : "post"}
      initialWorkoutId={params.workoutSessionId}
      initialCaption={params.draft}
      initialPhoto={params.photo}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      onPosted={async () => {
        router.replace("/");
      }}
    />
  );
}
