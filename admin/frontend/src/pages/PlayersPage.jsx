import { useEffect, useState, useCallback } from 'react';
import { Search, ShieldOff, ShieldCheck, Flag } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const loadPlayers = useCallback(async () => {
    try {
      const [pData, rData] = await Promise.all([
        adminApi(`/api/admin/players?search=${encodeURIComponent(search)}`),
        adminApi('/api/admin/players/reports/list'),
      ]);
      setPlayers(pData.players);
      setReports(rData.reports);
    } catch (err) {
      setError(err.message);
    }
  }, [search]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const inspectPlayer = async (id) => {
    setError('');
    try {
      const data = await adminApi(`/api/admin/players/${id}`);
      setSelected(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleStatus = async (player) => {
    const nextStatus = player.status === 'active' ? 'suspended' : 'active';
    setError('');
    try {
      await adminApi(`/api/admin/players/${player.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reason: `Admin action: set ${nextStatus}` }),
      });
      await loadPlayers();
      if (selected?.player?.id === player.id) {
        await inspectPlayer(player.id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Player Management</h1>
          <p className="text-sm text-zinc-400">
            Search operatives, inspect match/XP history, review reports, and suspend or reactivate accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or email..."
            className="bg-transparent text-sm text-white focus:outline-none"
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">Registered Accounts ({players.length})</h2>
          <div className="space-y-2.5">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3.5"
              >
                <div className="cursor-pointer" onClick={() => inspectPlayer(p.id)}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{p.username}</span>
                    <span className="text-xs text-zinc-400">{p.email}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        p.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {p.status}
                    </span>
                    {p.roles?.includes('admin') && (
                      <span className="rounded bg-rose-600/20 px-2 py-0.5 text-[10px] font-mono uppercase text-rose-300">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    XP: {p.total_xp ?? 0} · Matches: {p.games_played ?? 0} · Reports: {p.reports_count}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => inspectPlayer(p.id)}
                    className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:border-indigo-500"
                  >
                    Inspect
                  </button>
                  <button
                    onClick={() => toggleStatus(p)}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${
                      p.status === 'active'
                        ? 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                        : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    {p.status === 'active' ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {p.status === 'active' ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {selected && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">{selected.player.display_name || selected.player.username}</h3>
                <p className="text-xs text-zinc-400">{selected.player.email}</p>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">Recent Matches</h4>
                {selected.matches.length === 0 ? (
                  <p className="text-xs text-zinc-500">No matches</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {selected.matches.slice(0, 5).map((m) => (
                      <div key={m.id} className="flex justify-between rounded bg-zinc-900 p-2">
                        <span>{m.title}</span>
                        <span className="font-mono text-emerald-400">+{m.xp_earned} XP</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-zinc-400">XP History</h4>
                {selected.xpHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500">No XP entries</p>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    {selected.xpHistory.slice(0, 5).map((x) => (
                      <div key={x.id} className="flex justify-between rounded bg-zinc-900 p-2">
                        <span>{x.source_type}</span>
                        <span className="font-mono text-cyan-300">+{x.amount}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
              <Flag className="h-4 w-4 text-rose-400" /> Reported Players ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <p className="text-xs text-zinc-500">No player reports filed.</p>
            ) : (
              <div className="space-y-2.5 text-xs">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="font-semibold text-white">
                      {r.reported_username} <span className="text-zinc-400">reported by {r.reporter_username}</span>
                    </div>
                    <div className="mt-1 text-rose-300">{r.reason}</div>
                    <div className="mt-1 text-zinc-400">Status: {r.status}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
