import { useEffect, useState } from 'react';
import { Award, Lock, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/player/achievements')
      .then((d) => setAchievements(d.achievements))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Award className="h-7 w-7 text-amber-400" />
        <div>
          <h1 className="text-2xl font-extrabold text-white">Explorer Badges</h1>
          <p className="text-sm text-slate-400">Milestones unlocked by solving mysteries, escaping rooms & winning Brain Battles</p>
        </div>
      </div>

      {error && <div className="mb-4 text-rose-300">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`rounded-2xl border p-5 ${
              a.unlocked
                ? 'border-amber-400/45 bg-gradient-to-br from-amber-500/15 to-emerald-500/10'
                : 'border-slate-800 bg-slate-900/60 opacity-75'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">{a.title}</h3>
                <p className="mt-1 text-sm text-slate-300">{a.description}</p>
              </div>
              {a.unlocked ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              ) : (
                <Lock className="h-5 w-5 shrink-0 text-slate-500" />
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-300">Bonus: +{a.xp_bonus} XP</span>
              <span className="text-slate-400">
                {a.unlocked ? `Unlocked ${new Date(a.unlocked_at).toLocaleDateString()}` : 'Locked'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
