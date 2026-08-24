CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name varchar(30) NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'expert', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sports (
  id text PRIMARY KEY CHECK (id IN ('strength', 'running', 'hiking', 'diving', 'cycling', 'swimming')),
  label text NOT NULL,
  safety_level text NOT NULL CHECK (safety_level IN ('standard', 'heightened'))
);

CREATE TABLE IF NOT EXISTS routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(80) NOT NULL,
  sport text NOT NULL REFERENCES sports(id),
  days_of_week integer[] NOT NULL,
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(days_of_week) BETWEEN 1 AND 7),
  CHECK (days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]),
  CHECK (jsonb_typeof(items) = 'array')
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport text NOT NULL REFERENCES sports(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  perceived_exertion smallint NOT NULL CHECK (perceived_exertion BETWEEN 1 AND 10),
  notes varchar(1000),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL CHECK (source IN ('manual', 'wearable')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at > started_at)
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport text NOT NULL REFERENCES sports(id),
  content varchar(2000) NOT NULL,
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE SET NULL,
  moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'review', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content varchar(500) NOT NULL,
  moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'review', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL REFERENCES sports(id),
  title varchar(160) NOT NULL,
  body text NOT NULL,
  review_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (review_status IN ('DRAFT', 'EXPERT_REVIEWED', 'RETIRED')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    review_status <> 'EXPERT_REVIEWED'
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id varchar(100) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content varchar(500) NOT NULL,
  context varchar(120),
  moderation_status text NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'review', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routines_user_created_idx
  ON routines(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workout_sessions_user_started_idx
  ON workout_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS posts_created_idx
  ON posts(created_at DESC) WHERE moderation_status = 'visible';
CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON comments(post_id, created_at) WHERE moderation_status = 'visible';
CREATE INDEX IF NOT EXISTS knowledge_sport_status_idx
  ON knowledge_articles(sport, review_status);
CREATE INDEX IF NOT EXISTS knowledge_feedback_article_created_idx
  ON knowledge_feedback(article_id, created_at DESC)
  WHERE moderation_status = 'visible';
