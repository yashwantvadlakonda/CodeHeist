-- CodeHeist PostgreSQL Schema Migration 001
-- Authoritative relational schema for Game, Admin, Backend API, and Audit Logging

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roles (authoritative role catalog)
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE CHECK (name IN ('player', 'admin')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (never expose password_hash in any API response)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version >= 1),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- User role assignments (authoritative source of permissions)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);

-- Player profiles (1:1 with users)
CREATE TABLE IF NOT EXISTS player_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(80) NOT NULL,
  avatar_seed VARCHAR(80) NOT NULL DEFAULT 'cipher-agent',
  bio TEXT NOT NULL DEFAULT '',
  total_xp INTEGER NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  rank_title VARCHAR(60) NOT NULL DEFAULT 'Script Kiddie',
  games_played INTEGER NOT NULL DEFAULT 0 CHECK (games_played >= 0),
  games_won INTEGER NOT NULL DEFAULT 0 CHECK (games_won >= 0),
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_profiles_total_xp ON player_profiles (total_xp DESC);

-- Missions (groups of puzzles for solo & multiplayer operations)
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  order_index INTEGER NOT NULL DEFAULT 0,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300 CHECK (time_limit_seconds > 0),
  xp_reward INTEGER NOT NULL DEFAULT 100 CHECK (xp_reward >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missions_published ON missions (is_published, is_archived, order_index);

-- Puzzle questions (official correct_answer must never be exposed in public game APIs)
CREATE TABLE IF NOT EXISTS puzzle_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  title VARCHAR(150) NOT NULL,
  puzzle_type VARCHAR(40) NOT NULL CHECK (
    puzzle_type IN (
      'caesar_cipher',
      'number_pattern',
      'logic_gate',
      'binary_decoder',
      'memory_sequence',
      'pattern_recognition'
    )
  ),
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
  prompt TEXT NOT NULL,
  puzzle_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  correct_answer TEXT NOT NULL,
  hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  time_limit_seconds INTEGER NOT NULL DEFAULT 120 CHECK (time_limit_seconds > 0),
  xp_reward INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_puzzles_mission ON puzzle_questions (mission_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_type_pub ON puzzle_questions (puzzle_type, is_published, is_archived);

-- Daily challenges (unique per calendar date)
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id UUID NOT NULL REFERENCES puzzle_questions(id) ON DELETE RESTRICT,
  challenge_date DATE NOT NULL UNIQUE,
  title VARCHAR(150) NOT NULL,
  bonus_xp INTEGER NOT NULL DEFAULT 50 CHECK (bonus_xp >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_status_date ON daily_challenges (status, challenge_date DESC);

-- Matches (solo missions, multiplayer rooms, daily challenges)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('solo', 'multiplayer', 'daily')),
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  daily_challenge_id UUID REFERENCES daily_challenges(id) ON DELETE SET NULL,
  room_code VARCHAR(16) UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'terminated')),
  max_players INTEGER NOT NULL DEFAULT 1 CHECK (max_players BETWEEN 1 AND 8),
  puzzle_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  terminated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  termination_reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_status_created ON matches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_type ON matches (match_type);
CREATE INDEX IF NOT EXISTS idx_matches_room_code ON matches (room_code) WHERE room_code IS NOT NULL;

-- Match participants
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  xp_earned INTEGER NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  completion_time_ms INTEGER CHECK (completion_time_ms >= 0),
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  is_ready BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'playing', 'finished', 'disconnected')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players (match_id);

-- Answer submissions (tracks every attempt + anti-cheat suspicious flagging)
CREATE TABLE IF NOT EXISTS answer_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id UUID NOT NULL REFERENCES puzzle_questions(id) ON DELETE RESTRICT,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
  score_awarded INTEGER NOT NULL DEFAULT 0 CHECK (score_awarded >= 0),
  is_flagged_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_match_user ON answer_submissions (match_id, user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_suspicious ON answer_submissions (is_flagged_suspicious) WHERE is_flagged_suspicious = TRUE;

-- Achievements catalog
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(40) NOT NULL DEFAULT 'shield',
  xp_bonus INTEGER NOT NULL DEFAULT 25 CHECK (xp_bonus >= 0),
  criteria_type VARCHAR(40) NOT NULL,
  criteria_threshold INTEGER NOT NULL DEFAULT 1 CHECK (criteria_threshold >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unlocked player achievements
CREATE TABLE IF NOT EXISTS player_achievements (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- XP transaction ledger
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  source_type VARCHAR(40) NOT NULL CHECK (
    source_type IN ('solo_mission', 'multiplayer_match', 'daily_challenge', 'achievement_bonus', 'streak_bonus')
  ),
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions (user_id, created_at DESC);

-- Admin audit logs (append-only style tracking for sensitive operations)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(60) NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON admin_audit_logs (admin_id, created_at DESC);

-- Player reports
CREATE TABLE IF NOT EXISTS player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  reason VARCHAR(100) NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reported_user_id <> reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_player_reports_reported ON player_reports (reported_user_id, status);

-- System settings (configurable from Admin Settings)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
