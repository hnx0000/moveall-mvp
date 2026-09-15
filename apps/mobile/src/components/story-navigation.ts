export type StoryPosition = { ownerId: string; index: number };
type Owner = { id: string; stories: readonly unknown[] };

/** Skip empty owners. A swipe changes people; a tap changes a single slide. */
export function moveStory(owners: readonly Owner[], current: StoryPosition, direction: -1 | 1, unit: "owner" | "slide"): StoryPosition | null {
  const available = owners.filter((owner) => owner.stories.length > 0);
  const ownerIndex = available.findIndex((owner) => owner.id === current.ownerId);
  const owner = available[ownerIndex];
  if (!owner) return null;
  const nextIndex = current.index + direction;
  if (unit === "slide" && nextIndex >= 0 && nextIndex < owner.stories.length)
    return { ownerId: owner.id, index: nextIndex };
  const next = available[ownerIndex + direction];
  if (!next) return direction === 1 ? null : { ownerId: owner.id, index: 0 };
  return { ownerId: next.id, index: unit === "slide" && direction === -1 ? next.stories.length - 1 : 0 };
}

export const STORY_DOUBLE_TAP_MS = 300;
export function isStoryDoubleTap(previous: { time: number; x: number; y: number } | null, current: { time: number; x: number; y: number }) {
  return !!previous && current.time >= previous.time && current.time - previous.time < STORY_DOUBLE_TAP_MS && Math.hypot(current.x - previous.x, current.y - previous.y) < 44;
}
export function storyGesture(dx: number, dy: number, duration: number): "previous-owner" | "next-owner" | "tap" | "none" {
  if (![dx, dy, duration].every(Number.isFinite) || duration < 0) return "none";
  if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.35)
    return dx < 0 ? "next-owner" : "previous-owner";
  return Math.hypot(dx, dy) <= 12 && duration <= 450 ? "tap" : "none";
}

export function storyReplyContent(context: string, reply: string) {
  const body = reply.trim();
  if (!body || body.length > 800) throw new Error("댓글은 1~800자로 입력해 주세요.");
  return `스토리 답장 · ${context.replace(/\s+/g, " ").trim().slice(0, 150)}\n\n${body}`;
}
