import assert from "node:assert/strict";
import test from "node:test";
import {
  feedPostHref,
  hasFeedVisual,
  isRecordedFeedPost,
  rankHomeFeed,
} from "../src/components/feed-ranking.ts";

const now = Date.parse("2026-09-04T10:00:00.000Z");
const post = (id, userId, sport, hoursAgo, likeCount = 0, extra = {}) => ({
  id,
  userId,
  authorDisplayName: userId,
  sport,
  content: `${sport} workout record #${sport}`,
  contentType: "post",
  likeCount,
  createdAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
  comments: [],
  workoutSessionId: `workout-${id}`,
  workoutSummary: {
    startedAt: new Date(now - (hoursAgo + 1) * 3_600_000).toISOString(),
    endedAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
    metrics: { durationMinutes: 60, distanceKm: 5 },
  },
  ...extra,
});

test("posts without an attached workout never enter the home feed", () => {
  const recorded = post("recorded", "friend", "running", 1);
  const unrecorded = post("unrecorded", "friend", "running", 2, 0, {
    workoutSessionId: undefined,
  });
  assert.equal(isRecordedFeedPost(recorded), true);
  assert.equal(isRecordedFeedPost(unrecorded), false);
  assert.deepEqual(
    rankHomeFeed([unrecorded, recorded], { followingIds: ["friend"], viewerId: "me", now }).map(
      ({ post: item }) => item.id,
    ),
    ["recorded"],
  );
});

test("a list feed opens an address containing only that post", () => {
  assert.deepEqual(feedPostHref("post-42"), { pathname: "/", params: { post: "post-42" } });
});

test("text alone can never become a feed item", () => {
  const textOnly = post("text-only", "friend", "strength", 1, 0, {
    workoutSummary: undefined,
  });
  assert.equal(hasFeedVisual(textOnly), false);
  assert.deepEqual(
    rankHomeFeed([textOnly], { followingIds: ["friend"], viewerId: "me", now }),
    [],
  );
});

test("following records stay primary and one recommendation is inserted after every three", () => {
  const ranked = rankHomeFeed(
    [
      post("f1", "friend", "running", 1),
      post("f2", "friend", "running", 2),
      post("f3", "friend", "running", 3),
      post("f4", "friend", "running", 4),
      post("r1", "stranger", "cycling", 1, 80),
    ],
    { followingIds: ["friend"], viewerId: "me", now },
  );
  assert.deepEqual(
    ranked.map(({ post: item }) => item.id),
    ["f1", "f2", "f3", "r1", "f4"],
  );
  assert.equal(ranked[3].source, "recommended");
});

test("fast engagement and personal sport affinity affect discovery order", () => {
  const ranked = rankHomeFeed(
    [
      post("mine", "me", "running", 1),
      post("liked", "friend", "running", 2, 3, { likedByMe: true }),
      post("f3", "friend", "cycling", 3),
      post("fresh", "stranger-a", "cycling", 1, 60),
      post("interest", "stranger-b", "running", 4, 30),
    ],
    { followingIds: ["friend"], viewerId: "me", now },
  );
  assert.equal(ranked[3].post.id, "fresh");
  assert.equal(ranked[3].reason, "급상승");
  assert.equal(ranked[4].post.id, "interest");
});

test("an empty follow graph falls back to a chronological starter feed", () => {
  const ranked = rankHomeFeed([post("old", "a", "running", 2), post("new", "b", "strength", 1)], {
    followingIds: [],
    viewerId: "me",
    now,
  });
  assert.deepEqual(
    ranked.map(({ post: item }) => item.id),
    ["new", "old"],
  );
  assert.ok(ranked.every((item) => item.source === "following"));
});
