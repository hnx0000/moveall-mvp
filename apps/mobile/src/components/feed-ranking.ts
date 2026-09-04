import type { FeedPost, SportType } from "@moveall/contracts";

export type RankedFeedItem = {
  post: FeedPost;
  source: "following" | "recommended";
  reason?: "급상승" | "인기 기록" | "관심 운동" | "관심 기록";
};

type FeedRankingOptions = {
  followingIds: string[];
  viewerId?: string;
  now?: number;
  recommendationInterval?: number;
};

export function isRecordedFeedPost(post: FeedPost) {
  return typeof post.workoutSessionId === "string" && post.workoutSessionId.length > 0;
}

export function hasFeedVisual(post: FeedPost) {
  return Boolean(post.mediaUrl || post.mediaObjectPath || post.mediaId || post.workoutSummary);
}

export function feedPostHref(postId: string) {
  return { pathname: "/" as const, params: { post: postId } };
}

export function rankHomeFeed(posts: FeedPost[], options: FeedRankingOptions): RankedFeedItem[] {
  const now = options.now ?? Date.now();
  const interval = Math.max(1, options.recommendationInterval ?? 3);
  const following = new Set(options.followingIds);
  const visible = posts.filter(
    (post) => post.contentType !== "story" && isRecordedFeedPost(post) && hasFeedVisual(post),
  );
  const affinity = sportAffinity(visible, options.viewerId);
  const chronological = (a: FeedPost, b: FeedPost) =>
    Date.parse(b.createdAt) - Date.parse(a.createdAt);
  const primary = visible
    .filter((post) => post.userId === options.viewerId || following.has(post.userId))
    .sort(chronological);
  const recommended = visible
    .filter((post) => post.userId !== options.viewerId && !following.has(post.userId))
    .map((post) => scoreRecommendation(post, affinity, now))
    .sort((a, b) => b.score - a.score || chronological(a.post, b.post));

  // A brand-new account still gets a useful feed, without pretending every post is a recommendation.
  if (!primary.length) {
    return visible.sort(chronological).map((post) => ({ post, source: "following" }));
  }

  const result: RankedFeedItem[] = [];
  let recommendationIndex = 0;
  primary.forEach((post, index) => {
    result.push({ post, source: "following" });
    const item = recommended[recommendationIndex];
    if ((index + 1) % interval === 0 && item) {
      recommendationIndex += 1;
      result.push({ post: item.post, source: "recommended", reason: item.reason });
    }
  });
  while (recommendationIndex < recommended.length) {
    const item = recommended[recommendationIndex];
    if (!item) break;
    recommendationIndex += 1;
    result.push({ post: item.post, source: "recommended", reason: item.reason });
  }
  return result;
}

function sportAffinity(posts: FeedPost[], viewerId?: string) {
  const scores = new Map<SportType, number>();
  for (const post of posts) {
    let signal = 0;
    if (post.userId === viewerId) signal += 5;
    if (post.likedByMe) signal += 3;
    if (viewerId && post.comments.some((comment) => comment.userId === viewerId)) signal += 4;
    if (signal) scores.set(post.sport, (scores.get(post.sport) ?? 0) + signal);
  }
  return scores;
}

function scoreRecommendation(post: FeedPost, affinity: Map<SportType, number>, now: number) {
  const hours = Math.max(0.5, (now - Date.parse(post.createdAt)) / 3_600_000);
  const engagement = post.likeCount + post.comments.length * 3 + (post.shareCount ?? 0) * 4;
  const velocity = engagement / Math.pow(hours + 2, 0.72);
  const interest = affinity.get(post.sport) ?? 0;
  const score = velocity * 5 + Math.log2(engagement + 1) * 7 + interest * 2;
  const reason =
    velocity >= 7
      ? "급상승"
      : engagement >= 45
        ? "인기 기록"
        : interest > 0
          ? "관심 운동"
          : "관심 기록";
  return { post, score, reason } as const;
}
