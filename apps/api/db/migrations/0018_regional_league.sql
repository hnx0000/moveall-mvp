ALTER TABLE user_onboarding
  ADD COLUMN district varchar(80),
  ADD COLUMN province varchar(80),
  ADD COLUMN region_key varchar(160);

UPDATE user_onboarding
SET district = COALESCE(district, neighborhood),
    region_key = COALESCE(
      region_key,
      lower(trim(COALESCE(district, neighborhood))) || '@' ||
        round(latitude::numeric, 1)::text || ',' || round(longitude::numeric, 1)::text
    )
WHERE neighborhood IS NOT NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

CREATE INDEX user_onboarding_region_key_idx
  ON user_onboarding(region_key)
  WHERE region_key IS NOT NULL;

CREATE TABLE league_workout_points (
  workout_id uuid PRIMARY KEY REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_key varchar(160) NOT NULL,
  region_name varchar(80) NOT NULL,
  region_province varchar(80),
  sport text NOT NULL REFERENCES sports(id),
  started_at timestamptz NOT NULL,
  points integer NOT NULL CHECK (points BETWEEN 0 AND 3000),
  eligibility text NOT NULL CHECK (
    eligibility IN (
      'eligible',
      'verification-expired',
      'verification-after-workout',
      'route-missing',
      'route-outside-region'
    )
  ),
  scored_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_workout_points_region_range_idx
  ON league_workout_points(region_key, started_at DESC, sport);
CREATE INDEX league_workout_points_rank_idx
  ON league_workout_points(started_at DESC, sport, points DESC)
  WHERE eligibility = 'eligible';
CREATE INDEX league_workout_points_user_range_idx
  ON league_workout_points(user_id, started_at DESC, sport);

ALTER TABLE league_workout_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_workout_points FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE league_workout_points FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE league_workout_points FROM authenticated;
  END IF;
END
$$;
