ALTER TABLE posts ADD COLUMN audience jsonb NOT NULL DEFAULT '{"scope":"public"}'::jsonb;
ALTER TABLE posts ADD COLUMN comment_audience jsonb NOT NULL DEFAULT '{"scope":"public"}'::jsonb;

-- Private, author-managed recipient groups. Membership is snapshotted on publication.
CREATE TABLE sharing_crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  member_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sharing_crews_owner_idx ON sharing_crews(user_id);

-- Remove deleted accounts from saved recipient lists; owned lists cascade with the owner.
CREATE FUNCTION remove_deleted_sharing_crew_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sharing_crews SET member_ids = array_remove(member_ids, OLD.id)
    WHERE OLD.id = ANY(member_ids);
  RETURN OLD;
END;
$$;
CREATE TRIGGER sharing_crews_remove_deleted_member BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION remove_deleted_sharing_crew_member();
