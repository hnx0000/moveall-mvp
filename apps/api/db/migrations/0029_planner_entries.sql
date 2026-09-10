CREATE TABLE IF NOT EXISTS planner_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  shared_with jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_entries_owner ON planner_entries(user_id);
CREATE INDEX IF NOT EXISTS planner_entries_month ON planner_entries((left(payload->>'date',7)));
CREATE INDEX IF NOT EXISTS planner_entries_shared ON planner_entries USING gin(shared_with);
ALTER TABLE planner_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_entries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON planner_entries FROM PUBLIC;
CREATE TABLE IF NOT EXISTS saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  coordinate jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_places_owner ON saved_places(user_id);
ALTER TABLE saved_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_places FORCE ROW LEVEL SECURITY;
REVOKE ALL ON saved_places FROM PUBLIC;
