ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended'));

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
  ON auth_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_consents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  terms_version varchar(10) NOT NULL,
  privacy_version varchar(10) NOT NULL,
  terms_accepted boolean NOT NULL,
  privacy_accepted boolean NOT NULL,
  health_data_accepted boolean NOT NULL DEFAULT false,
  location_accepted boolean NOT NULL DEFAULT false,
  media_accepted boolean NOT NULL DEFAULT false,
  marketing_accepted boolean NOT NULL DEFAULT false,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (terms_accepted AND privacy_accepted)
);

CREATE TABLE IF NOT EXISTS media_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('supabase', 'r2')),
  bucket varchar(100) NOT NULL,
  object_path varchar(500) NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('avatar', 'post-image', 'story-image', 'story-video')),
  content_type varchar(100) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'deleting', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS media_objects_user_created_idx
  ON media_objects(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS health_integrations (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('health-connect', 'apple-health')),
  permission_scopes text[] NOT NULL DEFAULT '{}',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

