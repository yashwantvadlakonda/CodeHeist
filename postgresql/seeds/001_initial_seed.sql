-- CodeHeist PostgreSQL Seed 001: Roles, Achievements, Missions, Puzzles, Daily Challenge, System Settings
-- NOTE: No hardcoded admin user or password is created here.
-- Use the protected one-time backend bootstrap command (`npm run bootstrap-admin`) with ADMIN_EMAIL.

INSERT INTO roles (name, description)
VALUES
  ('player', 'Standard CodeHeist player account with public game access only'),
  ('admin', 'Authorized CodeHeist security administrator with full admin control panel access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO system_settings (key, value, description)
VALUES
  ('registration_enabled', 'true'::jsonb, 'Allow new player registrations on the public Game app'),
  ('multiplayer_enabled', 'true'::jsonb, 'Allow creating and joining multiplayer rooms'),
  ('maintenance_mode', 'false'::jsonb, 'Temporarily pause new match starts during maintenance'),
  ('suspicious_speed_threshold_ms', '1500'::jsonb, 'Flag answer submissions faster than this duration (ms) for admin inspection'),
  ('hint_xp_penalty_percent', '20'::jsonb, 'Percentage XP penalty applied per hint used')
ON CONFLICT (key) DO NOTHING;

INSERT INTO achievements (code, title, description, icon, xp_bonus, criteria_type, criteria_threshold)
VALUES
  ('first_breach', 'First Breach', 'Complete your first solo or multiplayer heist match.', 'terminal', 50, 'games_played', 1),
  ('cipher_veteran', 'Cipher Veteran', 'Complete 5 CodeHeist matches.', 'shield', 120, 'games_played', 5),
  ('arena_victor', 'Arena Victor', 'Win a multiplayer CodeHeist match.', 'trophy', 100, 'games_won', 1),
  ('daily_operative', 'Daily Operative', 'Solve a scheduled Daily Challenge.', 'calendar', 75, 'daily_solved', 1),
  ('xp_hunter', 'XP Hunter', 'Reach 1,000 total XP.', 'zap', 150, 'total_xp', 1000)
ON CONFLICT (code) DO NOTHING;

-- Missions
INSERT INTO missions (id, slug, title, description, category, difficulty, order_index, time_limit_seconds, xp_reward, is_published, is_archived)
VALUES
  (
    '11111111-1111-4111-8111-111111111101',
    'operation-caesar-vault',
    'Operation Caesar Vault',
    'Intercept legacy shift-encrypted transmissions guarding the perimeter firewall and decode the access keys.',
    'Cryptography',
    'easy',
    1,
    300,
    120,
    TRUE,
    FALSE
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    'binary-gate-breach',
    'Binary Gate Breach',
    'Bypass hardware logic circuits and raw binary packet headers inside the core substation.',
    'Hardware & Logic',
    'medium',
    2,
    360,
    180,
    TRUE,
    FALSE
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    'neural-pattern-override',
    'Neural Pattern Override',
    'Outsmart adaptive intrusion detection using sequence recall, number progressions, and anomaly matrices.',
    'Pattern Analysis',
    'hard',
    3,
    420,
    260,
    TRUE,
    FALSE
  )
ON CONFLICT (slug) DO NOTHING;

-- Puzzles across all 6 required puzzle types
INSERT INTO puzzle_questions (
  id, mission_id, title, puzzle_type, difficulty, prompt, puzzle_payload, correct_answer, hints, time_limit_seconds, xp_reward, is_published, is_archived
)
VALUES
  (
    '22222222-2222-4222-8222-222222222201',
    '11111111-1111-4111-8111-111111111101',
    'Perimeter Shift +3',
    'caesar_cipher',
    'easy',
    'Decrypt the intercepted vault passphrase shifted forward by 3 letters in the English alphabet.',
    '{"ciphertext":"FRGHKHLVW","shift":3,"direction":"forward"}'::jsonb,
    'CODEHEIST',
    '["Each letter was shifted +3 (A -> D). Shift backwards by 3.", "The first four letters decode to CODE."]'::jsonb,
    120,
    60,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222202',
    '11111111-1111-4111-8111-111111111101',
    'Fibonacci Firewall Key',
    'number_pattern',
    'easy',
    'Determine the next integer in the telemetry sequence to unlock port 443.',
    '{"sequence":[3,5,8,13,21,34],"format":"integer"}'::jsonb,
    '55',
    '["Add the previous two numbers together.", "21 + 34 = ?"]'::jsonb,
    90,
    60,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222203',
    '11111111-1111-4111-8111-111111111102',
    'Relay Circuit Evaluation',
    'logic_gate',
    'medium',
    'Evaluate the boolean circuit output (0 or 1): ((A AND B) XOR (NOT C)) where A=1, B=1, C=0.',
    '{"expression":"((A AND B) XOR (NOT C))","inputs":{"A":1,"B":1,"C":0}}'::jsonb,
    '0',
    '["First compute A AND B = 1, and NOT C = 1.", "1 XOR 1 evaluates to 0."]'::jsonb,
    120,
    90,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222204',
    '11111111-1111-4111-8111-111111111102',
    'ASCII Packet Payload',
    'binary_decoder',
    'medium',
    'Decode the 8-bit ASCII binary stream into the uppercase token.',
    '{"binary":"01001000 01000101 01011000","encoding":"ASCII"}'::jsonb,
    'HEX',
    '["01001000 in decimal is 72 (H).", "All three bytes form a 3-letter base-16 term."]'::jsonb,
    120,
    90,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222205',
    '11111111-1111-4111-8111-111111111103',
    'Ephemeral Node Flash',
    'memory_sequence',
    'hard',
    'Memorize the security beacon sequence during the flash window and enter the exact dash-separated code.',
    '{"sequence":["K9","B4","Z7","M2","X8"],"displayMs":4500,"separator":"-"}'::jsonb,
    'K9-B4-Z7-M2-X8',
    '["Group them in pairs: K9 B4, then Z7 M2, ending in X8.", "Use uppercase letters separated by hyphens."]'::jsonb,
    150,
    130,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222206',
    '11111111-1111-4111-8111-111111111103',
    'Matrix Checksum Anomaly',
    'pattern_recognition',
    'hard',
    'Every row in the 3x3 security matrix sums to 30. Find the missing value X in row 3.',
    '{"grid":[[12,7,11],[9,14,7],[16,5,"X"]],"rule":"Row sums equal 30"}'::jsonb,
    '9',
    '["Row 3 has 16 + 5 + X = 30.", "Subtract 21 from 30."]'::jsonb,
    150,
    130,
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-4222-8222-222222222207',
    NULL,
    'Daily Cipher: Zero-Day Pulse',
    'caesar_cipher',
    'medium',
    'Decrypt the daily darknet beacon shifted forward by 5 letters.',
    '{"ciphertext":"UWNXR","shift":5,"direction":"forward"}'::jsonb,
    'PRISM',
    '["Shift each letter backward by 5.", "U - 5 = P, W - 5 = R."]'::jsonb,
    150,
    110,
    TRUE,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;

-- Publish today's Daily Challenge
INSERT INTO daily_challenges (id, puzzle_id, challenge_date, title, bonus_xp, status, published_at)
VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    '22222222-2222-4222-8222-222222222207',
    CURRENT_DATE,
    'Daily Breach: Zero-Day Pulse',
    75,
    'published',
    NOW()
  )
ON CONFLICT (challenge_date) DO NOTHING;
