/** Policy mirrors contracts/post-permissions.ts. Filter before LIMIT; joins are unique PKs. */
export const visiblePostsSql = `
SELECT p.*, u.display_name, u.avatar_data_uri, mo.object_path AS media_object_path,
(vf.follower_id IS NOT NULL) AS viewer_follows_author,
(af.follower_id IS NOT NULL) AS author_follows_viewer,
(pl.user_id IS NOT NULL) AS liked_by_me,
(SELECT count(DISTINCT ps.sharer_id)::int FROM post_shares ps WHERE ps.post_id=p.id) AS share_count,
w.started_at AS workout_started_at, w.ended_at AS workout_ended_at, w.metrics AS workout_metrics
FROM posts p JOIN users u ON u.id=p.user_id
LEFT JOIN media_objects mo ON mo.id=p.media_id
LEFT JOIN follows vf ON vf.follower_id=$1::uuid AND vf.following_id=p.user_id
LEFT JOIN follows af ON af.follower_id=p.user_id AND af.following_id=$1::uuid
LEFT JOIN post_likes pl ON pl.post_id=p.id AND pl.user_id=$1::uuid
LEFT JOIN workout_sessions w ON w.id=p.workout_session_id AND w.user_id=p.user_id
WHERE ($2::uuid IS NULL OR p.id=$2::uuid) AND ($3::uuid IS NULL OR p.user_id=$3::uuid)
AND p.moderation_status='visible' AND p.archived_at IS NULL
AND (p.content_type<>'story' OR p.created_at>$4::timestamptz-interval '24 hours')
AND (p.user_id=$1::uuid OR (
 NOT EXISTS (SELECT 1 FROM user_restrictions r WHERE r.owner_id=p.user_id AND ($1::uuid IS NULL OR r.restricted_id=$1::uuid))
 AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id=$1::uuid AND b.blocked_id=p.user_id) OR (b.blocker_id=p.user_id AND b.blocked_id=$1::uuid))
))
AND COALESCE(p.audience->>'scope','public')<>'none'
AND (p.user_id=$1::uuid OR COALESCE(p.audience->>'scope','public')='public' OR (
 $1::uuid IS NOT NULL AND CASE p.audience->>'scope'
 WHEN 'followers' THEN vf.follower_id IS NOT NULL
 WHEN 'mutuals' THEN vf.follower_id IS NOT NULL AND af.follower_id IS NOT NULL
 WHEN 'users' THEN COALESCE((p.audience->'userIds') @> jsonb_build_array($1::text),false)
 WHEN 'crews' THEN COALESCE((p.audience->'userIds') @> jsonb_build_array($1::text),false)
 ELSE false END
))
AND ($5::uuid[] IS NULL OR p.id=ANY($5::uuid[]))
ORDER BY p.created_at DESC,p.id DESC LIMIT CASE WHEN $5::uuid[] IS NULL THEN 100 ELSE 200 END
`;
