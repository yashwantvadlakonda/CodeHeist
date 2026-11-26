import { useEffect, useState } from 'react';
import { History, Sparkles } from 'lucide-react';
import { apiRequest } from '../lib/api';

export default function HistoryPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/player/history')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="mx-auto max-w-6xl p-8 text-rose-300">{error}</div>;
  if (!data) return <div className="mx-auto max-w-6xl p-8 text-slate-400">Opening adventure journal...</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
          <History className="h-6 w-6 text-amber-400" /> Adventure Journal &amp; Rewards
        </h1>
        <p className="text-sm text-slate-400">Your completed rooms, escapes, treasure hunts, and XP history</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6">
          <h2 className="mb-4 text-lg font-bold text-white">Completed Adventures</h2>
          {data.matches.length === 0 ? (
            <p className="text-sm text-slate-400">No adventures logged yet.</p>
          ) : (
            <div className="space-y-3">
              {data.matches.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{m.title}</span>
                    <span className="text-xs font-bold uppercase text-amber-300">{m.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {m.match_type.replace('_', ' ').toUpperCase()} · Stages {m.correct_count} · Score {m.score}
                    </span>
                    <span className="font-bold text-emerald-400">+{m.xp_earned} XP</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <Sparkles className="h-4 w-4 text-emerald-400" /> XP Rewards Ledger
          </h2>
          {data.xpTransactions.length === 0 ? (
            <p className="text-sm text-slate-400">No XP earned yet.</p>
          ) : (
            <div className="space-y-3">
              {data.xpTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                  <div>
                    <div className="text-sm font-medium text-white">{tx.description}</div>
                    <div className="text-xs text-slate-400">
                      {tx.source_type} · {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">+{tx.amount} XP</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
