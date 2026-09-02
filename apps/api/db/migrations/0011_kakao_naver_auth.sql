ALTER TABLE oauth_identities
  DROP CONSTRAINT IF EXISTS oauth_identities_provider_check;

ALTER TABLE oauth_identities
  ADD CONSTRAINT oauth_identities_provider_check
  CHECK (provider IN ('google', 'apple', 'kakao', 'naver'));
