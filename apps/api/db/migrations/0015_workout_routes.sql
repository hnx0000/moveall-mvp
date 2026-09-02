-- Owner-only raw GPS. Public profiles must omit this column's value.
ALTER TABLE workout_sessions
  ADD COLUMN route_points jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(route_points) = 'array' AND jsonb_array_length(route_points) <= 30000);
