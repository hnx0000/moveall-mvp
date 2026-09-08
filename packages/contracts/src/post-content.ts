export const POST_CONTENT_REQUIRED_MESSAGE =
  "사진 또는 저장된 운동 기록(지도 포함)을 추가해 주세요. 글만으로는 피드에 게시할 수 없습니다.";

/** Attachment presence only. The store must also verify ownership and media availability. */
export function hasPostContentSource(input: {
  mediaId?: string | undefined;
  workoutSessionId?: string | undefined;
}) {
  return Boolean(input.mediaId?.trim() || input.workoutSessionId?.trim());
}
