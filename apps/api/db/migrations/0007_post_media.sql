ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES media_objects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_media_id_idx
  ON posts(media_id)
  WHERE media_id IS NOT NULL;
