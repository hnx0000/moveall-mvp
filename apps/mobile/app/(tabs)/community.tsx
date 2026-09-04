import { Redirect, useLocalSearchParams } from "expo-router";
import { ExerciseBibleScreen } from "../../src/screens/exercise-bible-screen";

export default function TodayScreen() {
  const params = useLocalSearchParams<{
    post?: string;
    comments?: string;
    workoutSessionId?: string;
    photo?: string;
    draft?: string;
  }>();
  // Existing notifications and shared post links still open the feed, now on Home.
  if (params.post || params.workoutSessionId || params.photo || params.draft) {
    return <Redirect href={{ pathname: "/", params }} />;
  }
  return <ExerciseBibleScreen />;
}
