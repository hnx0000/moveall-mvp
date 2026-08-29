ALTER TABLE routines
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) - 1 AS next_order
  FROM routines
)
UPDATE routines
SET sort_order = ranked.next_order
FROM ranked
WHERE routines.id = ranked.id;

CREATE INDEX IF NOT EXISTS routines_user_sort_idx
  ON routines(user_id, sort_order ASC);
