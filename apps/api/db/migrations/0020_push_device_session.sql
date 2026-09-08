-- Legacy registrations remain unassigned and are excluded from delivery until registered again.
ALTER TABLE push_devices ADD COLUMN auth_session_id uuid REFERENCES auth_sessions(id) ON DELETE CASCADE;
ALTER TABLE push_devices ADD COLUMN enabled boolean NOT NULL DEFAULT false;
CREATE INDEX push_devices_auth_session_idx ON push_devices(auth_session_id);
