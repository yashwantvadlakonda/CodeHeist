import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, Swords, Calendar, Gem, Hourglass, KeyRound, Flame, Coins, Sparkles, Award } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAudio } from '../context/AudioContext';

export default function DashboardPage() {
  const { sfx } = useAudio();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/player/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="mx-auto max-w-6xl p-6 text-rose-300">{error}</div>;
  if (!data) return <div className="mx-auto max-w-6xl p-6 text-slate-400">Preparing your Adventure Hub...</div>;

  const p = data.profile || {};
  const levelProgress = ((p.total_xp ?? 0) % 250) / 250;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-r from-slate-900/95 via-[#131936] to-slate-900/95 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-300">
              {p.rank_title || 'Curious Explorer'} · Level {p.level ?? 1}
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
              Welcome back, {p.display_name}!
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2.5 w-48 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
                  style={{ width: `${Math.max(8, Math.round(levelProgress * 100))}%` }}
                />
              </div>
              <span className="text-xs text-slate-300">{(p.total_xp ?? 0) % 250} / 250 XP to next level</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-amber-200">
                <Coins className="h-3.5 w-3.5" /> Coins
              </div>
              <div className="text-xl font-extrabold text-amber-300">{p.coins ?? 100}</div>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" /> Total XP
              </div>
              <div className="text-xl font-extrabold text-emerald-300">{p.total_xp ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-rose-200">
                <Flame className="h-3.5 w-3.5" /> Daily Streak
              </div>
              <div className="text-xl font-extrabold text-rose-300">{p.daily_streak ?? 0}d</div>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-violet-200">
                <Award className="h-3.5 w-3.5" /> Badges
              </div>
              <div className="text-xl font-extrabold text-violet-300">{data.unlockedAchievements ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Game Mode Portals */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-white">Choose Your Game Mode</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { to: '/missions?mode=mystery_rooms', title: 'Mystery Rooms', sub: 'Find clues & unlock doors', icon: KeyRound, tone: 'border-amber-500/35 hover:border-amber-400 text-amber-300' },
            { to: '/missions?mode=escape_challenge', title: 'Escape Challenge', sub: 'Beat the countdown timer', icon: Hourglass, tone: 'border-cyan-500/35 hover:border-cyan-400 text-cyan-300' },
            { to: '/multiplayer', title: 'Brain Battle', sub: '2–4 player live contest', icon: Swords, tone: 'border-rose-500/35 hover:border-rose-400 text-rose-300' },
            { to: '/missions?mode=treasure_hunt', title: 'Treasure Hunt', sub: 'Crack chests & collect gems', icon: Gem, tone: 'border-emerald-500/35 hover:border-emerald-400 text-emerald-300' },
            { to: '/daily', title: 'Daily Mystery', sub: 'New daily riddle + bonus', icon: Calendar, tone: 'border-violet-500/35 hover:border-violet-400 text-violet-300' },
          ].map((item, idx) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Link
                to={item.to}
                onClick={() => sfx.playClick()}
                className={`block rounded-2xl border bg-slate-900/75 p-5 transition hover:-translate-y-1 ${item.tone}`}
              >
                <item.icon className="mb-3 h-7 w-7" />
                <div className="font-bold text-white">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">{item.sub}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Compass className="h-5 w-5 text-amber-400" /> Recent Adventures
            </h2>
            <Link to="/history" className="text-xs text-amber-300 hover:underline">
              View Journal →
            </Link>
          </div>
          {data.recentMatches.length === 0 ? (
            <p className="text-sm text-slate-400">No rooms explored yet. Enter Mystery Rooms or Escape Challenge to begin!</p>
          ) : (
            <div className="space-y-3">
              {data.recentMatches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold text-white">{m.title}</div>
                    <div className="text-xs text-slate-400">
                      {m.match_type.replace('_', ' ').toUpperCase()} · {m.status}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold text-emerald-400">+{m.xp_earned} XP</div>
                    <div className="text-xs text-slate-400">Score {m.score}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-violet-500/25 bg-slate-900/75 p-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <Calendar className="h-5 w-5 text-violet-400" /> Today&apos;s Daily Mystery
          </h2>
          {data.dailyChallenge ? (
            <div>
              <div className="font-semibold text-white">{data.dailyChallenge.title}</div>
              <div className="mt-1 text-xs text-slate-300">
                Bonus Reward: <span className="font-bold text-amber-300">+{data.dailyChallenge.bonus_xp} XP &amp; +50 Coins</span>
              </div>
              <Link
                to="/daily"
                onClick={() => sfx.playClick()}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-bold text-white hover:brightness-110"
              >
                {data.dailyChallenge.completed ? 'Solved Today ✓' : 'Solve Daily Mystery'}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Check back soon for today&apos;s Daily Mystery!</p>
          )}
        </div>
      </div>
    </div>
  );
}
