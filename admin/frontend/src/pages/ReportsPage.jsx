import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi('/api/admin/reports')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="text-rose-400">{error}</div>;
  if (!data) return <div className="text-zinc-400">Aggregating PostgreSQL analytics...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BarChart3 className="h-6 w-6 text-rose-400" /> Analytical Reports
        </h1>
        <p className="text-sm text-zinc-400">Live PostgreSQL aggregates across registrations, missions, and puzzle telemetry</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Total Matches</div>
          <div className="mt-1 font-mono text-2xl font-bold text-white">{data.summary.totalMatches}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Completed Matches</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">{data.summary.completedMatches}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Match Completion Rate</div>
          <div className="mt-1 font-mono text-2xl font-bold text-indigo-400">{data.summary.overallCompletionRatePct}%</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-400">Avg Completion Time</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400">
            {(data.summary.avgCompletionMs / 1000).toFixed(1)}s
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-base font-semibold text-white">Mission Completion Rates</h2>
          <div className="space-y-2.5 text-sm">
            {data.missionCompletionRates.map((m) => (
              <div key={m.id} className="rounded-lg bg-zinc-900 p-3">
                <div className="flex justify-between font-medium text-white">
                  <span>{m.title}</span>
                  <span className="font-mono text-emerald-400">{m.completion_rate_pct}%</span>
                </div>
                <div className="mt-1 text-xs text-zinc-400">
                  Started: {m.total_started} · Completed: {m.total_completed}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-base font-semibold text-white">Popular Puzzle Types</h2>
          <div className="space-y-2.5 text-sm">
            {data.popularPuzzleTypes.map((p) => (
              <div key={p.puzzle_type} className="flex items-center justify-between rounded-lg bg-zinc-900 p-3">
                <div>
                  <div className="font-mono text-xs uppercase text-indigo-300">{p.puzzle_type}</div>
                  <div className="text-xs text-zinc-400">
                    Submissions: {p.submission_count} · Correct: {p.correct_count}
                  </div>
                </div>
                <div className="font-mono text-xs text-zinc-300">{p.avg_response_ms || 0}ms avg</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-base font-semibold text-white">Multiplayer vs Solo Participation</h2>
          {data.multiplayerParticipation.length === 0 ? (
            <p className="text-xs text-zinc-500">No match participation data yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.multiplayerParticipation.map((row) => (
                <div key={row.match_type} className="flex justify-between rounded-lg bg-zinc-900 p-3">
                  <span className="font-mono uppercase text-white">{row.match_type}</span>
                  <span className="text-xs text-zinc-300">
                    {row.completed_matches} / {row.total_matches} completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-3 text-base font-semibold text-white">Player Registration Trends (Last 30 Days)</h2>
          {data.registrationTrends.length === 0 ? (
            <p className="text-xs text-zinc-500">No player registrations in the last 30 days.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.registrationTrends.map((r) => (
                <div key={r.day} className="flex justify-between rounded-lg bg-zinc-900 p-2.5 font-mono text-xs">
                  <span className="text-zinc-300">{r.day}</span>
                  <span className="text-emerald-400">+{r.registrations} players</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
