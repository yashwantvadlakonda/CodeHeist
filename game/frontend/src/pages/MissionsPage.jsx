import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Clock, Sparkles, Coins, Lock, Layers } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

const MODE_TABS = [
  { id: '', label: 'All Adventures' },
  { id: 'mystery_rooms', label: 'Mystery Rooms' },
  { id: 'escape_challenge', label: 'Escape Challenge' },
  { id: 'treasure_hunt', label: 'Treasure Hunt' },
  { id: 'brain_battle', label: 'Brain Battle' },
];

const THEME_BG = {
  manor: 'from-amber-950/50 via-slate-900 to-slate-950 border-amber-500/30',
  observatory: 'from-cyan-950/50 via-slate-900 to-slate-950 border-cyan-500/30',
  temple: 'from-emerald-950/50 via-slate-900 to-slate-950 border-emerald-500/30',
  carnival: 'from-rose-950/50 via-slate-900 to-slate-950 border-rose-500/30',
};

export default function MissionsPage() {
  const { user } = useAuth();
  const { sfx } = useAudio();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode = searchParams.get('mode') || '';

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const query = activeMode ? `?mode=${encodeURIComponent(activeMode)}` : '';
    apiRequest(`/api/missions${query}`)
      .then((d) => setMissions(d.missions))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activeMode]);

  const handleStart = async (mission) => {
    sfx.playClick();
    if (!user) {
      navigate('/login');
      return;
    }
    setError('');
    setStartingId(mission.id);
    try {
      const data = await apiRequest(`/api/missions/${mission.id}/start`, { method: 'POST' });
      sfx.playDoorUnlock();
      navigate(`/arena/${data.match.id}`);
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
      setStartingId(null);
    }
  };

  const playerLevel = user?.profile?.level ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white">Adventure Worlds</h1>
        <p className="text-sm text-slate-300">
          Pick a mysterious room, timed escape challenge, or treasure hunt to play.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id || 'all'}
            onClick={() => {
              sfx.playClick();
              setSearchParams(tab.id ? { mode: tab.id } : {});
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeMode === tab.id
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                : 'border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-amber-500/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {loading && <p className="text-slate-400">Unlocking world map...</p>}

      <div className="grid gap-6 md:grid-cols-2">
        {missions.map((m, idx) => {
          const locked = playerLevel < (m.unlock_level || 1);
          const themeClass = THEME_BG[m.theme] || THEME_BG.manor;
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`flex flex-col justify-between rounded-3xl border bg-gradient-to-br p-6 shadow-xl ${themeClass}`}
            >
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-200">
                    {m.category}
                  </span>
                  <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-bold uppercase text-emerald-300">
                    {m.difficulty}
                  </span>
                </div>
                <h2 className="text-2xl font-extrabold text-white">{m.title}</h2>
                <p className="mt-2 text-sm text-slate-300">{m.description}</p>
                {m.story_intro && (
                  <p className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3 text-xs italic text-amber-100/90">
                    “{m.story_intro}”
                  </p>
                )}
              </div>

              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5 text-cyan-300" /> {m.puzzle_count} Stages
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-amber-300" /> {Math.round(m.time_limit_seconds / 60)} min
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" /> +{m.xp_reward} XP
                  </span>
                  <span className="flex items-center gap-1 font-bold text-amber-300">
                    <Coins className="h-3.5 w-3.5" /> +{m.coins_reward ?? 60} Coins
                  </span>
                </div>

                {locked ? (
                  <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 text-sm font-semibold text-slate-400">
                    <Lock className="h-4 w-4" /> Unlocks at Explorer Level {m.unlock_level}
                  </div>
                ) : (
                  <button
                    onClick={() => handleStart(m)}
                    disabled={startingId === m.id || m.puzzle_count === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-105 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    {startingId === m.id ? 'Entering Room...' : 'Enter Adventure'}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
