-- Supabase SQL Editor에서 한 번만 실행합니다.
-- GROOV API는 service-role 키를 서버에서만 사용해 2시간짜리 업로드 URL을 발급합니다.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'groov-media',
  'groov-media',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

