import type { FeedComment } from "@moveall/contracts";

export function commentThreads(comments: FeedComment[]) {
  const replies = new Map<string, FeedComment[]>();
  for (const comment of comments) {
    if (!comment.parentCommentId) continue;
    const group = replies.get(comment.parentCommentId) ?? [];
    group.push(comment);
    replies.set(comment.parentCommentId, group);
  }
  return comments
    .filter((comment) => !comment.parentCommentId)
    .map((comment) => ({
      comment,
      replies: replies.get(comment.id) ?? [],
    }));
}
