CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_sports text[] NOT NULL,
  activity_level text NOT NULL
    CHECK (activity_level IN ('starter', 'steady', 'advanced')),
  goals text[] NOT NULL,
  neighborhood varchar(80),
  latitude double precision,
  longitude double precision,
  neighborhood_verified_at timestamptz,
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(primary_sports) BETWEEN 1 AND 3),
  CHECK (
    primary_sports <@ ARRAY['strength', 'running', 'hiking', 'diving', 'cycling', 'swimming']::text[]
  ),
  CHECK (cardinality(goals) BETWEEN 1 AND 2),
  CHECK (
    goals <@ ARRAY['consistency', 'fitness', 'strength', 'performance', 'community']::text[]
  ),
  CHECK (
    (neighborhood IS NULL AND latitude IS NULL AND longitude IS NULL AND neighborhood_verified_at IS NULL)
    OR
    (neighborhood IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180 AND neighborhood_verified_at IS NOT NULL)
  )
);

ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE user_onboarding FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE user_onboarding FROM authenticated;
  END IF;
END
$$;
