import { useEffect, useState, useCallback } from 'react';
import { Activity, XCircle, AlertTriangle } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadMatches = useCallback(async () => {
    try {
      const data = await adminApi(`/api/admin/matches${statusFilter ? `?status=${statusFilter}` : ''}`);
      setMatches(data.matches);
    } catch (err) {
      setError(err.message);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const inspectMatch = async (id) => {
    setError('');
    try {
      const data = await adminApi(`/api/admin/matches/${id}`);
      setSelected(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTerminate = async (id) => {
    if (!reason.trim()) {
      setError('A termination reason is required.');
      return;
    }
    setError('');
    setMsg('');
    try {
      await adminApi(`/api/admin/matches/${id}/terminate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setReason('');
      setMsg('Match terminated and recorded in audit logs.');
      await loadMatches();
      await inspectMatch(id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Match Monitoring</h1>
          <p className="text-sm text-zinc-400">
            Inspect active/completed matches, participants, suspicious score submissions, or terminate broken rooms.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
        >
          <option value="">All Statuses</option>
          <option value="waiting">Waiting</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {msg && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
            <Activity className="h-4 w-4 text-rose-400" /> Matches ({matches.length})
          </h2>
          {matches.length === 0 ? (
            <p className="text-sm text-zinc-500">No matches found.</p>
          ) : (
            <div className="space-y-2.5">
              {matches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => inspectMatch(m.id)}
                  className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5 hover:border-rose-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      {m.title} {m.room_code ? `(#${m.room_code})` : ''}
                    </span>
                    <span className="font-mono text-xs uppercase text-indigo-300">{m.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                      {m.match_type.toUpperCase()} · {m.player_count} players
                    </span>
                    {m.suspicious_count > 0 && (
                      <span className="flex items-center gap-1 font-semibold text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> {m.suspicious_count} suspicious
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          {!selected ? (
            <p className="text-sm text-zinc-500">Select a match on the left to inspect participants and submissions.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="font-bold text-white">{selected.match.title}</h3>
                  <p className="font-mono text-xs text-zinc-400">ID: {selected.match.id}</p>
                </div>
                <span className="rounded bg-zinc-800 px-2.5 py-1 font-mono text-xs uppercase text-white">
                  {selected.match.status}
                </span>
              </div>

              {['waiting', 'active'].includes(selected.match.status) && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
                  <div className="text-xs font-semibold text-rose-300">Terminate Broken / Compromised Match</div>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Required reason for termination..."
                    className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={() => handleTerminate(selected.match.id)}
                    className="flex items-center gap-1.5 rounded bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Terminate Match
                  </button>
                </div>
              )}

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Participants (Read-only Scores)</h4>
                <div className="space-y-2 text-xs">
                  {selected.participants.map((p) => (
                    <div key={p.id} className="flex justify-between rounded bg-zinc-900 p-2.5">
                      <span>{p.username} ({p.status})</span>
                      <span className="font-mono text-emerald-400">Score: {p.score} · XP: {p.xp_earned}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Answer Submissions</h4>
                {selected.submissions.length === 0 ? (
                  <p className="text-xs text-zinc-500">No submissions recorded.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {selected.submissions.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded border p-2.5 ${
                          s.is_flagged_suspicious
                            ? 'border-amber-500/50 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-900/60'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-semibold text-white">{s.username} · {s.puzzle_title}</span>
                          <span className={s.is_correct ? 'text-emerald-400' : 'text-rose-400'}>
                            {s.is_correct ? 'CORRECT' : 'WRONG'} ({s.response_time_ms}ms)
                          </span>
                        </div>
                        {s.is_flagged_suspicious && (
                          <div className="mt-1 text-amber-300">Flagged: {s.suspicious_reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
