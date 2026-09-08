/** A caption, logo, solid color or test route is not a substitute for an attached source. */
export function hasEditorFeedSource(input: {
  background: "solid" | "photo" | "map";
  photo?: string | null | undefined;
  workoutId?: string | undefined;
  sampleWorkoutId: string;
}) {
  return Boolean(
    (input.background === "photo" && input.photo?.trim()) ||
    (input.workoutId?.trim() && input.workoutId !== input.sampleWorkoutId),
  );
}
