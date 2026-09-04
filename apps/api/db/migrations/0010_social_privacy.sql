CREATE TABLE IF NOT EXISTS user_restrictions (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restricted_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (owner_id, restricted_id),
  CHECK (owner_id <> restricted_id)
);
CREATE TABLE IF NOT EXISTS social_privacy (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hide_followers boolean NOT NULL DEFAULT false,
  hide_following boolean NOT NULL DEFAULT false
);
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_privacy ENABLE ROW LEVEL SECURITY;
