import { useEffect, useState } from 'react';
import { Users, ShieldCheck, CalendarCheck, Swords, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi('/api/admin/overview')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="text-rose-400">{error}</div>;
  if (!data) return <div className="text-zinc-400">Querying PostgreSQL telemetry...</div>;

  const s = data.stats;
  const cards = [
    { label: 'Total Registered Players', value: s.totalPlayers, icon: Users, accent: 'text-indigo-400' },
    { label: 'Active Players', value: s.activePlayers, icon: ShieldCheck, accent: 'text-emerald-400' },
    { label: 'Total Missions', value: s.totalMissions, icon: CheckCircle2, accent: 'text-cyan-400' },
    { label: 'Published Daily Challenges', value: s.publishedChallenges, icon: CalendarCheck, accent: 'text-amber-400' },
    { label: 'Completed Matches', value: s.completedMatches, icon: CheckCircle2, accent: 'text-emerald-400' },
    { label: 'Multiplayer Matches', value: s.multiplayerMatches, icon: Swords, accent: 'text-violet-400' },
    { label: 'Open Player Reports', value: s.openReports, icon: AlertTriangle, accent: 'text-rose-400' },
    { label: 'Flagged Submissions', value: s.suspiciousSubmissions, icon: AlertTriangle, accent: 'text-amber-400' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Security Operations Overview</h1>
        <p className="text-sm text-zinc-400">Live PostgreSQL metrics across Game & Auth subsystems</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
              {c.label}
              <c.icon className={`h-4 w-4 ${c.accent}`} />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-4 text-base font-semibold text-white">Recent Game Activity</h2>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches have been played yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Operation</th>
                  <th className="py-2 pr-4">Mode</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Players</th>
                  <th className="py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {data.recentActivity.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 pr-4 font-medium text-white">{m.title}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs uppercase text-indigo-300">{m.match_type}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs uppercase text-zinc-300">{m.status}</td>
                    <td className="py-2.5 pr-4 font-mono text-zinc-300">{m.player_count}</td>
                    <td className="py-2.5 text-xs text-zinc-400">{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
