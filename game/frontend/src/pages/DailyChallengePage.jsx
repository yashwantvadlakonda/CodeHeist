import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Sparkles, Flame, CheckCircle2, Play, Coins } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAudio } from '../context/AudioContext';

export default function DailyChallengePage() {
  const navigate = useNavigate();
  const { sfx } = useAudio();
  const [daily, setDaily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/missions/daily/today')
      .then((d) => setDaily(d.dailyChallenge))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
    sfx.playClick();
    setError('');
    try {
      const data = await apiRequest('/api/missions/daily/start', { method: 'POST' });
      sfx.playDoorUnlock();
      navigate(`/arena/${data.match.id}`);
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    }
  };

  if (loading) return <div className="mx-auto max-w-3xl p-8 text-slate-400">Opening Daily Mystery...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
            <Calendar className="h-4 w-4" /> Daily Mystery
          </span>
          {daily && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300">
              <Flame className="h-3.5 w-3.5" /> Streak: {daily.dailyStreak ?? 0} days
            </span>
          )}
        </div>

        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        {!daily ? (
          <p className="text-slate-400">No Daily Mystery has been published for today yet.</p>
        ) : (
          <div>
            <h1 className="text-2xl font-extrabold text-white">{daily.title}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Type: <span className="font-semibold text-amber-300">{daily.puzzle.puzzleType.replace(/_/g, ' ')}</span> · Difficulty:{' '}
              <span className="uppercase text-emerald-300">{daily.puzzle.difficulty}</span>
            </p>

            <div className="mt-6 grid grid-cols-3 gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm">
              <div>
                <div className="text-xs text-slate-400">Bonus XP</div>
                <div className="mt-1 flex items-center gap-1 text-lg font-extrabold text-emerald-400">
                  <Sparkles className="h-4 w-4" /> +{daily.bonusXp + daily.puzzle.xpReward}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Coins</div>
                <div className="mt-1 flex items-center gap-1 text-lg font-extrabold text-amber-300">
                  <Coins className="h-4 w-4" /> +{(daily.puzzle.coinsReward ?? 15) + 50}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Solved Today</div>
                <div className="mt-1 text-lg font-extrabold text-white">{daily.completions}</div>
              </div>
            </div>

            <div className="mt-6">
              {daily.completedByUser ? (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 p-4 text-emerald-200">
                  <CheckCircle2 className="h-5 w-5" /> You solved today&apos;s Daily Mystery! Come back tomorrow to grow your streak.
                </div>
              ) : (
                <button
                  onClick={handleStart}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-amber-400 py-3.5 text-sm font-bold text-slate-950 hover:brightness-105"
                >
                  <Play className="h-4 w-4" /> Play Daily Mystery
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
