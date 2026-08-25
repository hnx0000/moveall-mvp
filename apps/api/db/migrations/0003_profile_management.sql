ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_data_uri text;

CREATE INDEX IF NOT EXISTS users_display_name_lookup_idx
  ON users (lower(display_name));

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'post'
    CHECK (content_type IN ('post', 'story')),
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0
    CHECK (like_count >= 0),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS posts_user_archive_idx
  ON posts(user_id, archived_at, created_at DESC);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content varchar(1000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_pair_created_idx
  ON direct_messages(sender_id, recipient_id, created_at);
