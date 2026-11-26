-- CodeHeist Seed 002: Interactive Puzzle Adventure Worlds & 15 General-Audience Puzzle Types
-- Archives earlier technical/cybersecurity sample missions & seeds rich Mystery, Escape, Treasure Hunt, Brain Battle, and Daily Mystery content.

UPDATE missions
SET is_published = FALSE, is_archived = TRUE
WHERE slug IN ('operation-caesar-vault', 'binary-gate-breach', 'neural-pattern-override');

UPDATE puzzle_questions
SET is_published = FALSE, is_archived = TRUE
WHERE id IN (
  '22222222-2222-4222-8222-222222222201',
  '22222222-2222-4222-8222-222222222202',
  '22222222-2222-4222-8222-222222222203',
  '22222222-2222-4222-8222-222222222204',
  '22222222-2222-4222-8222-222222222205',
  '22222222-2222-4222-8222-222222222206',
  '22222222-2222-4222-8222-222222222207'
);

-- Adventure Achievements
INSERT INTO achievements (code, title, description, icon, xp_bonus, criteria_type, criteria_threshold)
VALUES
  ('manor_explorer', 'Manor Explorer', 'Complete your first puzzle adventure room.', 'compass', 60, 'games_played', 1),
  ('master_detective', 'Master Detective', 'Complete 5 puzzle adventures across any mode.', 'search', 140, 'games_played', 5),
  ('brain_champion', 'Brain Battle Champion', 'Win a real-time Brain Battle against other players.', 'crown', 120, 'games_won', 1),
  ('daily_seeker', 'Daily Mystery Seeker', 'Solve a Daily Mystery challenge.', 'sparkles', 90, 'daily_solved', 1),
  ('legend_collector', 'Legend Collector', 'Reach 1,500 total XP.', 'gem', 200, 'total_xp', 1500)
ON CONFLICT (code) DO NOTHING;

-- 4 Playable Adventure Chapters across the 4 main modes
INSERT INTO missions (
  id, slug, title, description, category, difficulty, game_mode, theme,
  unlock_level, order_index, time_limit_seconds, xp_reward, coins_reward,
  story_intro, story_outro, is_published, is_archived
)
VALUES
  (
    '44444444-4444-4444-8444-444444444401',
    'clockmakers-manor',
    'The Clockmaker''s Manor',
    'Step inside a candlelit Victorian manor. Inspect hidden objects, test mysterious switches, question suspects, and unlock the secret study door.',
    'Mystery Rooms',
    'easy',
    'mystery_rooms',
    'manor',
    1,
    1,
    420,
    150,
    90,
    'The town clock stopped at midnight. Inside the Clockmaker''s locked manor, four interconnected clues guard the emerald heirloom.',
    'The heavy oak study door swings open, revealing the ticking heart of the manor and a pouch of ancient gold coins!',
    TRUE,
    FALSE
  ),
  (
    '44444444-4444-4444-8444-444444444402',
    'sunken-observatory-escape',
    'Sunken Observatory Escape',
    'Water is rising in the glass dome! Align celestial dials, spot fresco discrepancies, order planetary gears, and escape before time runs out.',
    'Escape Challenge',
    'medium',
    'escape_challenge',
    'observatory',
    1,
    2,
    240,
    220,
    130,
    'The brass hatch sealed behind you beneath the waves. Four mechanical chambers stand between you and the surface lift.',
    'With a roar of steam, the emergency airlock unlatches—you surge back into the starlit night just in time!',
    TRUE,
    FALSE
  ),
  (
    '44444444-4444-4444-8444-444444444403',
    'temple-of-golden-compass',
    'Temple of the Golden Compass',
    'Follow ancient mosaic clues, match sacred relics, weigh enchanted gems, and crack the golden treasure chest.',
    'Treasure Hunt',
    'medium',
    'treasure_hunt',
    'temple',
    1,
    3,
    360,
    260,
    180,
    'Deep in the Emerald Jungle lies an untouched vault. Follow the compass engravings to unlock the Grand Treasure Chest.',
    'Golden light spills across the temple floor as the ornate chest pops open, showering you in treasure!',
    TRUE,
    FALSE
  ),
  (
    '44444444-4444-4444-8444-444444444404',
    'grand-carnival-brain-battle',
    'Grand Carnival Brain Battle',
    'Race 2–4 players live through number patterns, lantern flash memory, and sharp-eyed carnival observations!',
    'Brain Battle',
    'medium',
    'brain_battle',
    'carnival',
    1,
    4,
    240,
    240,
    140,
    'Step right up under the glowing carnival marquee! Speed and accuracy decide who claims the Grand Master Trophy.',
    'Confetti rains over the stage as the Brain Battle scoreboard crowns the sharpest mind in the arena!',
    TRUE,
    FALSE
  )
ON CONFLICT (slug) DO NOTHING;

-- 15 Distinct Interactive Puzzles (covering ALL 15 required puzzle types)
INSERT INTO puzzle_questions (
  id, mission_id, title, puzzle_type, difficulty, prompt, puzzle_payload,
  correct_answer, explanation, hints, time_limit_seconds, xp_reward, coins_reward, stage_order,
  is_published, is_archived
)
VALUES
  -- 1. Logical Reasoning (Mystery Rooms Stage 1)
  (
    '55555555-5555-4555-8555-555555555501',
    '44444444-4444-4444-8444-444444444401',
    'The Three Brass Switches',
    'logical_reasoning',
    'easy',
    'Three switches outside control three bulbs inside a sealed lantern room. You may flip switches first, then enter the bulb room ONLY ONCE. Which non-visual property lets you identify all three bulbs?',
    '{
      "scene": "switches",
      "switches": ["Switch A", "Switch B", "Switch C"],
      "options": [
        {"id": "HEAT", "label": "Turn Switch A ON for 5 minutes, turn it OFF, turn Switch B ON, then enter and feel bulb HEAT"},
        {"id": "SOUND", "label": "Listen carefully to which bulb hums louder when entering"},
        {"id": "COLOR", "label": "Guess based on the color of the brass screws"},
        {"id": "IMPOSSIBLE", "label": "It is impossible in a single visit"}
      ]
    }'::jsonb,
    'HEAT',
    'By leaving Switch A on long enough to warm its bulb, then turning it off and turning Switch B on, the lit bulb is B, the warm unlit bulb is A, and the cold unlit bulb is C!',
    '["A bulb produces something else besides light when left on.", "Touch the unlit bulbs once you step inside!"]'::jsonb,
    120, 60, 20, 1, TRUE, FALSE
  ),

  -- 2. Hidden Object Discovery (Mystery Rooms Stage 2)
  (
    '55555555-5555-4555-8555-555555555502',
    '44444444-4444-4444-8444-444444444401',
    'Study of Forgotten Clues',
    'hidden_object',
    'easy',
    'Search the Clockmaker''s dimly lit study. Click the hidden golden pocket watch tucked among the books and shadows to reveal its engraved chime number, or enter the object name.',
    '{
      "roomTheme": "study",
      "targetName": "POCKET WATCH",
      "clueText": "Find the tarnished Golden Pocket Watch hidden near the bookshelf!",
      "objects": [
        {"id": "candle", "label": "Candle", "x": 18, "y": 32, "icon": "flame", "note": "Flickers softly, nothing hidden underneath."},
        {"id": "globe", "label": "Brass Globe", "x": 74, "y": 28, "icon": "globe", "note": "Spins smoothly, pointing north."},
        {"id": "watch", "label": "Pocket Watch", "x": 42, "y": 68, "icon": "watch", "isTarget": true, "reveal": "POCKET WATCH"},
        {"id": "quill", "label": "Feather Quill", "x": 83, "y": 72, "icon": "feather", "note": "Dry ink on parchment."}
      ]
    }'::jsonb,
    'POCKET WATCH',
    'Clicking the hidden Pocket Watch under the desk lamp revealed the manor''s stopped midnight chime!',
    '["Scan the lower half of the study table.", "Look for a small circular timepiece glowing faintly."]'::jsonb,
    120, 65, 25, 2, TRUE, FALSE
  ),

  -- 3. Riddles & Word Puzzles (Mystery Rooms Stage 3)
  (
    '55555555-5555-4555-8555-555555555503',
    '44444444-4444-4444-8444-444444444401',
    'The Grandfather Clock Riddle',
    'riddle_word',
    'easy',
    'A parchment falls from the clock pendulum: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?"',
    '{
      "parchmentQuote": "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish.",
      "letterCount": 3
    }'::jsonb,
    'MAP',
    'A MAP depicts cities, mountain ranges, and oceans without containing any physical houses, trees, or fish.',
    '["Travelers fold me or unroll me on a table.", "It is a 3-letter word."]'::jsonb,
    90, 55, 20, 3, TRUE, FALSE
  ),

  -- 4. Mystery Clue Investigation (Mystery Rooms Stage 4)
  (
    '55555555-5555-4555-8555-555555555504',
    '44444444-4444-4444-8444-444444444401',
    'Who Took the Emerald Seal?',
    'mystery_clue',
    'medium',
    'Inspect the suspect notes and physical evidence to name the true culprit who unlocked the study.',
    '{
      "evidence": [
        "Muddy garden boots were left beside the hallway rug.",
        "The study door lock had traces of fresh rose petals.",
        "Only one person was outside after 11:30 PM."
      ],
      "suspects": [
        {"id": "ARTHUR", "name": "Arthur (Butler)", "alibi": "Polishing silverware in the dining hall all evening; wears indoor slippers."},
        {"id": "CLARA", "name": "Clara (Botanist)", "alibi": "Claims she stayed upstairs, yet smells faintly of crushed roses from the garden."},
        {"id": "VICTOR", "name": "Victor (Nephew)", "alibi": "Playing chess by the fireplace with two guests since 10:00 PM."}
      ]
    }'::jsonb,
    'CLARA',
    'Clara''s alibi contradicts the rose petals and muddy garden evidence—she slipped in from the conservatory!',
    '["Match the rose petals and muddy boots to the suspects.", "Check who had a reason to be near the garden."]'::jsonb,
    120, 80, 30, 4, TRUE, FALSE
  ),

  -- 5. Shape & Rotation (Escape Challenge Stage 1)
  (
    '55555555-5555-4555-8555-555555555505',
    '44444444-4444-4444-8444-444444444402',
    'Astrological Dial Alignment',
    'shape_rotation',
    'medium',
    'Rotate the celestial compass ring until the Sun marker points directly to 180° (South) to match the brass notch.',
    '{
      "targetDegrees": 180,
      "stepDegrees": 45,
      "initialDegrees": 45,
      "label": "Celestial Ring"
    }'::jsonb,
    '180',
    'Rotating the compass ring clockwise to 180° aligns the solar arrow with the southern lock pin.',
    '["Click Rotate +45° until the gold needle points straight down (180°)."]'::jsonb,
    90, 70, 25, 1, TRUE, FALSE
  ),

  -- 6. Spot-the-Difference (Escape Challenge Stage 2)
  (
    '55555555-5555-4555-8555-555555555506',
    '44444444-4444-4444-8444-444444444402',
    'Twin Fresco Inspection',
    'spot_difference',
    'medium',
    'Compare the Left and Right Observatory murals. Click ALL 3 differences on the Right mural to unlock the next chamber!',
    '{
      "differencesCount": 3,
      "spots": [
        {"id": "moon", "x": 25, "y": 24, "label": "Crescent Moon shifted"},
        {"id": "star", "x": 72, "y": 32, "label": "Extra Golden Star"},
        {"id": "wave", "x": 54, "y": 78, "label": "Missing Sea Wave"}
      ]
    }'::jsonb,
    '3',
    'You spotted all 3 differences: the flipped crescent moon, extra star, and missing wave crest!',
    '["Check the sky corners first, then scan the ocean waves at the bottom."]'::jsonb,
    120, 85, 30, 2, TRUE, FALSE
  ),

  -- 7. Sequence Arrangement (Escape Challenge Stage 3)
  (
    '55555555-5555-4555-8555-555555555507',
    '44444444-4444-4444-8444-444444444402',
    'Planetary Gear Order',
    'sequence_arrangement',
    'medium',
    'Arrange the four observatory weights from LIGHTEST to HEAVIEST by clicking the tiles in order.',
    '{
      "tiles": [
        {"id": "FEATHER", "label": "1. Silver Feather (2g)"},
        {"id": "PEARL", "label": "2. Sea Pearl (12g)"},
        {"id": "COMPASS", "label": "3. Brass Compass (85g)"},
        {"id": "ANCHOR", "label": "4. Iron Anchor (400g)"}
      ],
      "shuffledOrder": ["COMPASS", "FEATHER", "ANCHOR", "PEARL"]
    }'::jsonb,
    'FEATHER-PEARL-COMPASS-ANCHOR',
    'Arranging the weights from 2g → 12g → 85g → 400g balances the hydraulic lift.',
    '["Start with the Silver Feather (2g) and end with the Iron Anchor (400g)."]'::jsonb,
    120, 85, 30, 3, TRUE, FALSE
  ),

  -- 8. Spatial Reasoning (Escape Challenge Stage 4)
  (
    '55555555-5555-4555-8555-555555555508',
    '44444444-4444-4444-8444-444444444402',
    'The Unfolded Cube Lock',
    'spatial_reasoning',
    'hard',
    'Look at the unfolded cross-shaped wooden die: Top is 1, Center is 2, Bottom is 3, Far-Bottom is 4, Left wing is 5, Right wing is 6. When folded into a cube, which number is directly OPPOSITE face 2?',
    '{
      "faces": {"top": 1, "center": 2, "bottom": 3, "farBottom": 4, "left": 5, "right": 6},
      "questionFace": 2,
      "options": ["1", "3", "4", "6"]
    }'::jsonb,
    '4',
    'In a standard cross net, faces separated by one square along the spine fold onto opposite sides—so 2 is opposite 4!',
    '["1 folds up, 3 folds down, and 4 wraps around to face 2."]'::jsonb,
    120, 95, 35, 4, TRUE, FALSE
  ),

  -- 9. Visual Pattern Recognition (Treasure Hunt Stage 1)
  (
    '55555555-5555-4555-8555-555555555509',
    '44444444-4444-4444-8444-444444444403',
    'Jade Mosaic Sequence',
    'visual_pattern',
    'easy',
    'Study the repeating temple stone shapes and select the missing 5th symbol.',
    '{
      "sequence": [
        {"shape": "triangle", "color": "#10b981", "label": "Triangle"},
        {"shape": "square", "color": "#f59e0b", "label": "Square"},
        {"shape": "circle", "color": "#06b6d4", "label": "Circle"},
        {"shape": "triangle", "color": "#10b981", "label": "Triangle"}
      ],
      "choices": [
        {"id": "SQUARE", "shape": "square", "color": "#f59e0b", "label": "Amber Square"},
        {"id": "CIRCLE", "shape": "circle", "color": "#06b6d4", "label": "Cyan Circle"},
        {"id": "TRIANGLE", "shape": "triangle", "color": "#10b981", "label": "Emerald Triangle"},
        {"id": "DIAMOND", "shape": "diamond", "color": "#ec4899", "label": "Ruby Diamond"}
      ]
    }'::jsonb,
    'SQUARE',
    'The pattern cycles Triangle → Square → Circle → Triangle → Square!',
    '["Count in groups of three shapes."]'::jsonb,
    90, 65, 25, 1, TRUE, FALSE
  ),

  -- 10. Matching Puzzle (Treasure Hunt Stage 2)
  (
    '55555555-5555-4555-8555-555555555510',
    '44444444-4444-4444-8444-444444444403',
    'Ancient Relic Matching',
    'matching',
    'medium',
    'Pair each temple symbol with its matching element to align the four stone pillars!',
    '{
      "pairs": [
        {"left": "Sun", "right": "Gold"},
        {"left": "Ocean", "right": "Sapphire"},
        {"left": "Forest", "right": "Emerald"},
        {"left": "Volcano", "right": "Ruby"}
      ]
    }'::jsonb,
    'MATCHED',
    'Every sacred element resonated with its matching gemstone, unlocking the inner shrine!',
    '["Connect Sun to Gold, Ocean to Sapphire, Forest to Emerald, and Volcano to Ruby."]'::jsonb,
    120, 75, 30, 2, TRUE, FALSE
  ),

  -- 11. Picture-Based Puzzle (Treasure Hunt Stage 3)
  (
    '55555555-5555-4555-8555-555555555511',
    '44444444-4444-4444-8444-444444444403',
    'The Balanced Gem Scales',
    'picture_puzzle',
    'medium',
    'Inspect the illustrated scales: Scale 1 balances 2 Rubies with 10 Gold Coins. Scale 2 balances 1 Ruby + 1 Sapphire with 9 Gold Coins. How many Gold Coins equal 1 Sapphire?',
    '{
      "scaleType": "gems",
      "equations": [
        "2 Rubies = 10 Coins",
        "1 Ruby + 1 Sapphire = 9 Coins"
      ]
    }'::jsonb,
    '4',
    'Since 2 Rubies = 10 Coins, 1 Ruby = 5 Coins. Therefore 1 Sapphire = 9 - 5 = 4 Coins!',
    '["Find the weight of one Ruby first.", "Subtract that from 9."]'::jsonb,
    120, 80, 30, 3, TRUE, FALSE
  ),

  -- 12. Mathematical Brain Teaser (Treasure Hunt Stage 4)
  (
    '55555555-5555-4555-8555-555555555512',
    '44444444-4444-4444-8444-444444444403',
    'Golden Chest Combination',
    'math_teaser',
    'medium',
    'A treasure chest holds coins. If you double the coins and add 6, you get 30. How many coins were originally inside?',
    '{
      "chestVisual": true,
      "clue": "2 × (?) + 6 = 30"
    }'::jsonb,
    '12',
    'Subtract 6 from 30 to get 24, then divide by 2 to get 12 coins!',
    '["Work backwards from 30: first subtract 6."]'::jsonb,
    90, 80, 40, 4, TRUE, FALSE
  ),

  -- 13. Number Sequence (Brain Battle Stage 1)
  (
    '55555555-5555-4555-8555-555555555513',
    '44444444-4444-4444-8444-444444444404',
    'The Juggler''s Number Sequence',
    'number_sequence',
    'easy',
    'Each carnival ball rises higher in a growing jump: 2, 5, 10, 17, 26, ?. What number belongs on the final ball?',
    '{
      "sequence": [2, 5, 10, 17, 26]
    }'::jsonb,
    '37',
    'The differences increase by +2 each step (+3, +5, +7, +9, +11), so 26 + 11 = 37!',
    '["Look at the gap between each pair of numbers: 3, 5, 7, 9..."]'::jsonb,
    90, 75, 25, 1, TRUE, FALSE
  ),

  -- 14. Memory Challenge (Brain Battle Stage 2)
  (
    '55555555-5555-4555-8555-555555555514',
    '44444444-4444-4444-8444-444444444404',
    'Lantern Flash Sequence',
    'memory_challenge',
    'medium',
    'Watch the glowing carnival lanterns flash, then enter their color initials separated by hyphens (e.g. R-G-B-Y).',
    '{
      "sequence": ["RUBY", "GOLD", "CYAN", "EMERALD"],
      "initials": "R-G-C-E",
      "displayMs": 4500,
      "separator": "-"
    }'::jsonb,
    'R-G-C-E',
    'The four glowing lanterns flashed Ruby (R), Gold (G), Cyan (C), and Emerald (E)!',
    '["Take the first letter of each glowing lantern in order."]'::jsonb,
    120, 85, 30, 2, TRUE, FALSE
  ),

  -- 15. Observation Challenge (Brain Battle Stage 3 & Daily Mystery)
  (
    '55555555-5555-4555-8555-555555555515',
    '44444444-4444-4444-8444-444444444404',
    'Midnight Market Count',
    'observation',
    'medium',
    'Carefully observe the illustrated lantern market tent below. Count ONLY the GOLD stars hanging from the awning!',
    '{
      "scene": "stars",
      "items": [
        {"kind": "star", "color": "gold", "x": 15, "y": 25},
        {"kind": "moon", "color": "silver", "x": 30, "y": 20},
        {"kind": "star", "color": "gold", "x": 45, "y": 30},
        {"kind": "star", "color": "silver", "x": 60, "y": 22},
        {"kind": "star", "color": "gold", "x": 75, "y": 28},
        {"kind": "star", "color": "gold", "x": 85, "y": 40},
        {"kind": "moon", "color": "gold", "x": 38, "y": 60},
        {"kind": "star", "color": "gold", "x": 66, "y": 64}
      ]
    }'::jsonb,
    '5',
    'There are exactly 5 GOLD stars (ignoring the silver stars and crescent moons)!',
    '["Do not count silver stars or moons—count only yellow/gold 5-point stars."]'::jsonb,
    90, 90, 35, 3, TRUE, FALSE
  )
ON CONFLICT (id) DO NOTHING;

-- Update today's Daily Mystery to use the new general-audience Riddle/Observation puzzle
UPDATE daily_challenges
SET puzzle_id = '55555555-5555-4555-8555-555555555503',
    title = 'Daily Mystery: The Grandfather Clock Riddle',
    bonus_xp = 100
WHERE challenge_date = CURRENT_DATE;

INSERT INTO daily_challenges (id, puzzle_id, challenge_date, title, bonus_xp, status, published_at)
VALUES (
  '33333333-3333-4333-8333-333333333302',
  '55555555-5555-4555-8555-555555555503',
  CURRENT_DATE,
  'Daily Mystery: The Grandfather Clock Riddle',
  100,
  'published',
  NOW()
)
ON CONFLICT (challenge_date) DO NOTHING;
