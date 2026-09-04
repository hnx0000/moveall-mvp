-- No backfill/default: existing members must not be classified without their answer.
ALTER TABLE user_onboarding
  ADD COLUMN usage_purpose text CHECK (usage_purpose IN ('record', 'social', 'competition', 'achievement')),
  ADD COLUMN usage_purpose_recorded_at timestamptz,
  ADD COLUMN usage_purpose_question_version smallint,
  ADD CONSTRAINT onboarding_usage_purpose_response_check CHECK (
    (usage_purpose_recorded_at IS NULL AND usage_purpose IS NULL AND usage_purpose_question_version IS NULL)
    OR (usage_purpose_recorded_at IS NOT NULL AND usage_purpose_question_version IS NOT NULL AND usage_purpose_question_version = 1)
  );
-- Existing user_onboarding RLS/revocations and ON DELETE CASCADE remain in effect.
