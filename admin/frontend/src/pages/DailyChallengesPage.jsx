import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Send, Edit3 } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function DailyChallengesPage() {
  const [challenges, setChallenges] = useState([]);
  const [puzzles, setPuzzles] = useState([]);
  const [form, setForm] = useState({
    puzzleId: '',
    challengeDate: new Date().toISOString().slice(0, 10),
    title: '',
    bonusXp: 75,
    publishImmediately: false,
  });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [dcData, pData] = await Promise.all([
        adminApi('/api/admin/daily-challenges'),
        adminApi('/api/admin/puzzles'),
      ]);
      setChallenges(dcData.dailyChallenges);
      setPuzzles(pData.puzzles);
      if (!form.puzzleId && pData.puzzles.length > 0) {
        setForm((prev) => ({ ...prev, puzzleId: pData.puzzles[0].id }));
      }
    } catch (err) {
      setError(err.message);
    }
  }, [form.puzzleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      if (editingId) {
        await adminApi(`/api/admin/daily-challenges/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            puzzleId: form.puzzleId,
            challengeDate: form.challengeDate,
            title: form.title,
            bonusXp: Number(form.bonusXp),
          }),
        });
        setMsg('Scheduled daily challenge updated.');
        setEditingId(null);
      } else {
        await adminApi('/api/admin/daily-challenges', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            bonusXp: Number(form.bonusXp),
          }),
        });
        setMsg('Daily challenge created.');
      }
      setForm((prev) => ({ ...prev, title: '' }));
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePublish = async (id) => {
    setError('');
    try {
      await adminApi(`/api/admin/daily-challenges/${id}/publish`, { method: 'POST' });
      setMsg('Daily challenge published.');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Daily Challenges</h1>
        <p className="text-sm text-zinc-400">
          Schedule unique daily puzzles (enforced unique per calendar date in PostgreSQL).
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {msg && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 h-fit">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <CalendarClock className="h-4 w-4 text-rose-400" />
            {editingId ? 'Edit Scheduled Challenge' : 'Schedule Daily Challenge'}
          </h2>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Daily Breach: Protocol X"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Puzzle</label>
            <select
              value={form.puzzleId}
              onChange={(e) => setForm({ ...form, puzzleId: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              {puzzles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.puzzle_type})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Date</label>
              <input
                type="date"
                required
                value={form.challengeDate}
                onChange={(e) => setForm({ ...form, challengeDate: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Bonus XP</label>
              <input
                type="number"
                min={0}
                value={form.bonusXp}
                onChange={(e) => setForm({ ...form, bonusXp: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {!editingId && (
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={form.publishImmediately}
                onChange={(e) => setForm({ ...form, publishImmediately: e.target.checked })}
              />
              Publish immediately
            </label>
          )}

          <button type="submit" className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-500">
            {editingId ? 'Save Scheduled Changes' : 'Create Challenge'}
          </button>
        </form>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-white">Scheduled & Published Challenges</h2>
          <div className="space-y-3">
            {challenges.map((dc) => (
              <div
                key={dc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-300">{String(dc.challenge_date).slice(0, 10)}</span>
                    <span className="font-semibold text-white">{dc.title}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        dc.status === 'published' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {dc.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Puzzle: {dc.puzzle_title} · Bonus +{dc.bonus_xp} XP · Attempts: {dc.attempts_count} · Completions:{' '}
                    {dc.completions_count}
                  </div>
                </div>
                {dc.status === 'scheduled' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingId(dc.id);
                        setForm({
                          puzzleId: dc.puzzle_id,
                          challengeDate: String(dc.challenge_date).slice(0, 10),
                          title: dc.title,
                          bonusXp: dc.bonus_xp,
                          publishImmediately: false,
                        });
                      }}
                      className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-indigo-500"
                    >
                      <Edit3 className="inline h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handlePublish(dc.id)}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      <Send className="inline h-3.5 w-3.5 mr-1" /> Publish
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
