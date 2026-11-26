import { useEffect, useState } from 'react';
import { Trophy, Coins } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAudio } from '../context/AudioContext';

export default function LeaderboardPage() {
  const { sfx } = useAudio();
  const [period, setPeriod] = useState('all');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest(`/api/leaderboard?limit=50&period=${period}`)
      .then((d) => setRows(d.leaderboard))
      .catch((err) => setError(err.message));
  }, [period]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">Explorer Rankings</h1>
            <p className="text-sm text-slate-400">Compare scores across the Global and Weekly leaderboards</p>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1">
          {[
            { id: 'all', label: 'Global All-Time' },
            { id: 'weekly', label: 'Weekly Leaders' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                sfx.playClick();
                setPeriod(tab.id);
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                period === tab.id ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Explorer</th>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Coins</th>
              <th className="px-4 py-3">Wins</th>
              <th className="px-4 py-3 text-right">{period === 'weekly' ? 'Weekly XP' : 'Total XP'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No ranked explorers yet.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-bold text-amber-300">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {r.display_name} <span className="text-xs font-normal text-slate-400">@{r.username}</span>
                  </td>
                  <td className="px-4 py-3 text-cyan-300">
                    Lv.{r.level} · {r.rank_title}
                  </td>
                  <td className="px-4 py-3 font-semibold text-amber-300">
                    <Coins className="inline h-3.5 w-3.5 mr-1" />{r.coins ?? 100}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {r.games_won} / {r.games_played}
                  </td>
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-400">
                    {period === 'weekly' ? r.weekly_xp ?? 0 : r.total_xp}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
