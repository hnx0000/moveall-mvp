INSERT INTO sports (id, label, safety_level)
VALUES
  ('strength', '근력 운동', 'standard'),
  ('running', '러닝', 'standard'),
  ('hiking', '등산', 'heightened'),
  ('diving', '다이빙', 'heightened'),
  ('cycling', '사이클', 'standard'),
  ('swimming', '수영', 'heightened')
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label, safety_level = EXCLUDED.safety_level;
