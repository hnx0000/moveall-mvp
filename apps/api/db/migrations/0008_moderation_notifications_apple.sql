ALTER TABLE oauth_identities
  DROP CONSTRAINT IF EXISTS oauth_identities_provider_check;

ALTER TABLE oauth_identities
  ADD CONSTRAINT oauth_identities_provider_check
  CHECK (provider IN ('google', 'apple'));

CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
  target_id text NOT NULL,
  reason text NOT NULL CHECK (
    reason IN ('spam', 'harassment', 'hate', 'dangerous', 'fraud', 'privacy', 'copyright', 'other')
  ),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON content_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('follow', 'comment', 'share', 'moderation', 'system')),
  title varchar(120) NOT NULL,
  body varchar(500) NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  resource_type text CHECK (resource_type IN ('post', 'comment', 'user', 'report')),
  resource_id text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;
