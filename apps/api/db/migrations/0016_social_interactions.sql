CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('follow', 'comment', 'share', 'moderation', 'system', 'like', 'message', 'mention', 'goal_activity'));
CREATE INDEX IF NOT EXISTS post_shares_sharer_recency_idx ON post_shares(sharer_id, recipient_id, created_at DESC);
