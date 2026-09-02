-- Extend the allowed goals without rewriting already-applied onboarding migrations.
-- Existing profiles and the limit of two selected goals are preserved.
DO $$
DECLARE
  allowed_goals_constraint text;
BEGIN
  FOR allowed_goals_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'user_onboarding'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%goals <@%'
  LOOP
    EXECUTE format(
      'ALTER TABLE user_onboarding DROP CONSTRAINT %I',
      allowed_goals_constraint
    );
  END LOOP;
END
$$;

ALTER TABLE user_onboarding
  ADD CONSTRAINT user_onboarding_goals_allowed
  CHECK (
    goals <@ ARRAY[
      'consistency', 'fitness', 'strength', 'performance', 'community', 'weight_management'
    ]::text[]
  );
