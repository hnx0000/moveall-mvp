ALTER TABLE comments ADD COLUMN parent_comment_id uuid;
ALTER TABLE comments ADD CONSTRAINT comments_id_post_unique UNIQUE (id, post_id);
ALTER TABLE comments ADD CONSTRAINT comments_parent_same_post
  FOREIGN KEY (parent_comment_id, post_id) REFERENCES comments (id, post_id) ON DELETE CASCADE;
ALTER TABLE comments ADD CONSTRAINT comments_not_own_parent CHECK (parent_comment_id <> id);
CREATE INDEX comments_parent_created_idx ON comments (parent_comment_id, created_at)
  WHERE parent_comment_id IS NOT NULL;

CREATE TABLE comment_likes (
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX comment_likes_user_idx ON comment_likes (user_id);

-- Only the GROOV server may read/write social data; public Supabase clients cannot bypass it.
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE comment_likes FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE comment_likes FROM authenticated;
  END IF;
END
$$;
