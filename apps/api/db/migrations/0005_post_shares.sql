CREATE TABLE IF NOT EXISTS post_shares (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  sharer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, sharer_id, recipient_id),
  CHECK (sharer_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS post_shares_recipient_created_idx
  ON post_shares(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_shares_post_idx
  ON post_shares(post_id);
