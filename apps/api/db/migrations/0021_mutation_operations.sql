-- Keep only a hash and opaque resource ID after resource deletion, never its content or GPS data.
-- No resource FK: retaining its ID prevents a retry from recreating a deleted resource.
CREATE TABLE mutation_operations (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_kind text NOT NULL CHECK (operation_kind IN ('post.create','workout.create','health.import:apple-health','health.import:health-connect')),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
  request_hash text NOT NULL CHECK (length(request_hash)=64),
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (user_id, operation_kind, operation_key)
);
ALTER TABLE mutation_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutation_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE mutation_operations FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON TABLE mutation_operations FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON TABLE mutation_operations FROM authenticated; END IF;
END $$;
