-- CodeHeist Migration 002: Puzzle Adventure Transformation
-- Transforms gameplay into 5 general-audience adventure modes, 15 puzzle types, coins, streaks, and image uploads.

-- 1. Extend missions with game modes, themes, unlock levels, story, and coin rewards
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS game_mode VARCHAR(40) NOT NULL DEFAULT 'mystery_rooms',
  ADD COLUMN IF NOT EXISTS theme VARCHAR(40) NOT NULL DEFAULT 'manor',
  ADD COLUMN IF NOT EXISTS unlock_level INTEGER NOT NULL DEFAULT 1 CHECK (unlock_level >= 1),
  ADD COLUMN IF NOT EXISTS coins_reward INTEGER NOT NULL DEFAULT 60 CHECK (coins_reward >= 0),
  ADD COLUMN IF NOT EXISTS story_intro TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS story_outro TEXT NOT NULL DEFAULT '';

ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_game_mode_check;
ALTER TABLE missions
  ADD CONSTRAINT missions_game_mode_check
  CHECK (game_mode IN ('mystery_rooms', 'escape_challenge', 'brain_battle', 'treasure_hunt'));

-- 2. Extend puzzle_questions with 15 adventure puzzle types, image_url, explanation, coins, stage_order
ALTER TABLE puzzle_questions
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coins_reward INTEGER NOT NULL DEFAULT 15 CHECK (coins_reward >= 0),
  ADD COLUMN IF NOT EXISTS stage_order INTEGER NOT NULL DEFAULT 1 CHECK (stage_order >= 1);

ALTER TABLE puzzle_questions DROP CONSTRAINT IF EXISTS puzzle_questions_puzzle_type_check;
ALTER TABLE puzzle_questions
  ADD CONSTRAINT puzzle_questions_puzzle_type_check CHECK (
    puzzle_type IN (
      'logical_reasoning',
      'visual_pattern',
      'number_sequence',
      'riddle_word',
      'hidden_object',
      'picture_puzzle',
      'memory_challenge',
      'shape_rotation',
      'math_teaser',
      'observation',
      'matching',
      'sequence_arrangement',
      'spot_difference',
      'mystery_clue',
      'spatial_reasoning',
      'caesar_cipher',
      'number_pattern',
      'logic_gate',
      'binary_decoder',
      'memory_sequence',
      'pattern_recognition'
    )
  );

-- 3. Extend player_profiles with coins and daily streak tracking, and update default adventure rank
ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 100 CHECK (coins >= 0),
  ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0 CHECK (daily_streak >= 0),
  ADD COLUMN IF NOT EXISTS last_daily_date DATE;

ALTER TABLE player_profiles
  ALTER COLUMN rank_title SET DEFAULT 'Curious Explorer';

UPDATE player_profiles
SET rank_title = 'Curious Explorer'
WHERE rank_title = 'Script Kiddie';

-- 4. Extend matches & match_players with adventure mode tracking and coins
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_match_type_check;
ALTER TABLE matches
  ADD CONSTRAINT matches_match_type_check
  CHECK (match_type IN ('solo', 'multiplayer', 'daily', 'mystery_rooms', 'escape_challenge', 'brain_battle', 'treasure_hunt'));

ALTER TABLE match_players
  ADD COLUMN IF NOT EXISTS coins_earned INTEGER NOT NULL DEFAULT 0 CHECK (coins_earned >= 0);

-- 5. Extend xp_transactions source types
ALTER TABLE xp_transactions DROP CONSTRAINT IF EXISTS xp_transactions_source_type_check;
ALTER TABLE xp_transactions
  ADD CONSTRAINT xp_transactions_source_type_check CHECK (
    source_type IN (
      'solo_mission',
      'multiplayer_match',
      'daily_challenge',
      'achievement_bonus',
      'streak_bonus',
      'mystery_rooms',
      'escape_challenge',
      'brain_battle',
      'treasure_hunt',
      'daily_mystery',
      'treasure_chest'
    )
  );

-- 6. Uploaded puzzle image assets table
CREATE TABLE IF NOT EXISTS uploaded_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_game_mode ON missions (game_mode, is_published, is_archived);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON xp_transactions (created_at DESC);
