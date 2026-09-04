import type { FeedPost, PostAudience, SharingCrew } from "./index.js";

export type AudienceRelation = {
  authorId: string;
  viewerId?: string | undefined;
  viewerFollowsAuthor: boolean;
  authorFollowsViewer: boolean;
};

export function audienceAllows(audience: PostAudience | undefined, relation: AudienceRelation) {
  const scope = audience?.scope ?? "public";
  if (scope === "none") return false;
  if (relation.viewerId === relation.authorId) return true;
  if (scope === "public") return true;
  if (!relation.viewerId) return false;
  if (scope === "followers") return relation.viewerFollowsAuthor;
  if (scope === "mutuals") return relation.viewerFollowsAuthor && relation.authorFollowsViewer;
  if (scope === "users" || scope === "crews")
    return audience?.userIds?.includes(relation.viewerId) ?? false;
  return false;
}

export function storyIsActive(
  post: Pick<FeedPost, "contentType" | "createdAt" | "expiresAt">,
  now = Date.now(),
) {
  if (post.contentType !== "story") return true;
  const expires = post.expiresAt
    ? Date.parse(post.expiresAt)
    : Date.parse(post.createdAt) + 86_400_000;
  return Number.isFinite(expires) && now < expires;
}

/** Crew membership is resolved on the server at publication, never trusted from a client. */
export function resolveCrewAudience(
  audience: PostAudience | undefined,
  crews: SharingCrew[],
): PostAudience {
  const value = audience ?? { scope: "public" };
  if (value.scope !== "crews")
    return {
      scope: value.scope,
      ...(value.scope === "users" ? { userIds: [...new Set(value.userIds ?? [])] } : {}),
    };
  const ids = [...new Set(value.crewIds ?? [])];
  if (!ids.length || ids.some((id) => !crews.some((crew) => crew.id === id)))
    throw new Error("선택한 공유 크루를 확인할 수 없습니다.");
  return {
    scope: "crews",
    crewIds: ids,
    userIds: [
      ...new Set(crews.filter((crew) => ids.includes(crew.id)).flatMap((crew) => crew.memberIds)),
    ],
  };
}

/** Recipient lists remain private to the author. canComment is computed, not accepted as input. */
export function presentPostAccess(post: FeedPost, relation: AudienceRelation): FeedPost {
  const owner = relation.viewerId === post.userId;
  return {
    ...post,
    audience: owner
      ? (post.audience ?? { scope: "public" })
      : { scope: post.audience?.scope ?? "public" },
    commentAudience: owner
      ? (post.commentAudience ?? { scope: "public" })
      : { scope: post.commentAudience?.scope ?? "public" },
    canComment:
      Boolean(relation.viewerId) &&
      storyIsActive(post) &&
      audienceAllows(post.audience, relation) &&
      audienceAllows(post.commentAudience, relation),
    ...(post.contentType === "story"
      ? {
          expiresAt:
            post.expiresAt ?? new Date(Date.parse(post.createdAt) + 86_400_000).toISOString(),
        }
      : {}),
  };
}
