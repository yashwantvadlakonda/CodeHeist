import { useEffect, useState, useCallback } from 'react';
import { Plus, Eye, Edit3, Trash2, Globe, EyeOff, Upload } from 'lucide-react';
import { adminApi } from '../lib/api';

const PUZZLE_TYPES = [
  { value: 'logical_reasoning', label: 'Logical Reasoning' },
  { value: 'visual_pattern', label: 'Visual Pattern Recognition' },
  { value: 'number_sequence', label: 'Number Sequence' },
  { value: 'riddle_word', label: 'Riddle & Word Puzzle' },
  { value: 'hidden_object', label: 'Hidden Object Discovery' },
  { value: 'picture_puzzle', label: 'Picture-Based Puzzle' },
  { value: 'memory_challenge', label: 'Memory Challenge' },
  { value: 'shape_rotation', label: 'Shape & Rotation' },
  { value: 'math_teaser', label: 'Mathematical Brain Teaser' },
  { value: 'observation', label: 'Observation Challenge' },
  { value: 'matching', label: 'Matching Puzzle' },
  { value: 'sequence_arrangement', label: 'Sequence Arrangement' },
  { value: 'spot_difference', label: 'Spot the Difference' },
  { value: 'mystery_clue', label: 'Mystery Clue Investigation' },
  { value: 'spatial_reasoning', label: 'Spatial Reasoning' },
];

const emptyForm = {
  missionId: '',
  title: '',
  puzzleType: 'logical_reasoning',
  difficulty: 'medium',
  prompt: '',
  puzzlePayloadText: '{}',
  imageUrl: '',
  correctAnswer: '',
  explanation: '',
  hintsText: '',
  timeLimitSeconds: 120,
  xpReward: 75,
  coinsReward: 20,
  stageOrder: 1,
  isPublished: false,
};

export default function PuzzlesPage() {
  const [puzzles, setPuzzles] = useState([]);
  const [missions, setMissions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [previewPuzzle, setPreviewPuzzle] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [pData, mData] = await Promise.all([
        adminApi('/api/admin/puzzles'),
        adminApi('/api/admin/puzzles/missions'),
      ]);
      setPuzzles(pData.puzzles);
      setMissions(mData.missions);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await adminApi('/api/admin/puzzles/upload-image', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      setForm((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      setStatusMsg(`Image uploaded: ${res.imageUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      let parsedPayload = {};
      if (form.puzzlePayloadText.trim()) {
        parsedPayload = JSON.parse(form.puzzlePayloadText);
      }
      const hints = form.hintsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const body = {
        missionId: form.missionId || null,
        title: form.title,
        puzzleType: form.puzzleType,
        difficulty: form.difficulty,
        prompt: form.prompt,
        puzzlePayload: parsedPayload,
        imageUrl: form.imageUrl.trim() || null,
        correctAnswer: form.correctAnswer,
        explanation: form.explanation,
        hints,
        timeLimitSeconds: Number(form.timeLimitSeconds),
        xpReward: Number(form.xpReward),
        coinsReward: Number(form.coinsReward),
        stageOrder: Number(form.stageOrder),
        isPublished: form.isPublished,
      };

      if (editingId) {
        await adminApi(`/api/admin/puzzles/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        setStatusMsg('Puzzle updated and audited in PostgreSQL.');
      } else {
        await adminApi('/api/admin/puzzles', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setStatusMsg('Puzzle created and audited in PostgreSQL.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setForm({
      missionId: p.mission_id || '',
      title: p.title,
      puzzleType: p.puzzle_type,
      difficulty: p.difficulty,
      prompt: p.prompt,
      puzzlePayloadText: JSON.stringify(p.puzzle_payload || {}, null, 2),
      imageUrl: p.image_url || '',
      correctAnswer: p.correct_answer,
      explanation: p.explanation || '',
      hintsText: (Array.isArray(p.hints) ? p.hints : []).join('\n'),
      timeLimitSeconds: p.time_limit_seconds,
      xpReward: p.xp_reward,
      coinsReward: p.coins_reward ?? 20,
      stageOrder: p.stage_order ?? 1,
      isPublished: p.is_published,
    });
  };

  const togglePublish = async (p) => {
    setError('');
    try {
      await adminApi(`/api/admin/puzzles/${p.id}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: !p.is_published }),
      });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteOrArchive = async (p) => {
    setError('');
    try {
      const res = await adminApi(`/api/admin/puzzles/${p.id}`, { method: 'DELETE' });
      setStatusMsg(`Puzzle ${res.mode}.`);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Puzzle Management</h1>
        <p className="text-sm text-zinc-400">
          Author all 15 adventure puzzle types, upload puzzle images, configure answers/explanations/coins, and publish rooms.
        </p>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {statusMsg && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{statusMsg}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={handleSave} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Plus className="h-4 w-4 text-rose-400" /> {editingId ? 'Edit Puzzle' : 'Create Puzzle'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <input
            type="text"
            required
            placeholder="Puzzle Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.puzzleType}
              onChange={(e) => setForm({ ...form, puzzleType: e.target.value })}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white"
            >
              {PUZZLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-white"
            >
              {['easy', 'medium', 'hard', 'expert'].map((d) => (
                <option key={d} value={d}>{d.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <select
            value={form.missionId}
            onChange={(e) => setForm({ ...form, missionId: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
          >
            <option value="">Daily Mystery Pool (Standalone)</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>{m.title} ({m.game_mode})</option>
            ))}
          </select>

          <textarea
            rows={2}
            required
            placeholder="Puzzle story & instructions..."
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
          />

          {/* Image Upload */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 space-y-2">
            <label className="flex cursor-pointer items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Upload className="h-3.5 w-3.5 text-indigo-400" />
                {uploading ? 'Uploading image...' : 'Upload Puzzle Image (PNG/JPG/WEBP/SVG)'}
              </span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-indigo-300">Choose File</span>
            </label>
            {form.imageUrl && (
              <div className="text-[11px] font-mono text-emerald-300 truncate">Image URL: {form.imageUrl}</div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] text-zinc-400">Interactive Payload JSON</label>
            <textarea
              rows={3}
              value={form.puzzlePayloadText}
              onChange={(e) => setForm({ ...form, puzzlePayloadText: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200"
            />
          </div>

          <input
            type="text"
            required
            placeholder="Official Answer (server-only)"
            value={form.correctAnswer}
            onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
            className="w-full rounded-lg border border-rose-500/40 bg-zinc-900 px-3 py-2 font-mono text-sm text-rose-200"
          />

          <textarea
            rows={2}
            placeholder="Post-completion explanation shown after solving..."
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
          />

          <textarea
            rows={2}
            placeholder="Hints (one per line)"
            value={form.hintsText}
            onChange={(e) => setForm({ ...form, hintsText: e.target.value })}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
          />

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-zinc-400">Time (s)</label>
              <input
                type="number"
                min={15}
                value={form.timeLimitSeconds}
                onChange={(e) => setForm({ ...form, timeLimitSeconds: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400">XP</label>
              <input
                type="number"
                min={10}
                value={form.xpReward}
                onChange={(e) => setForm({ ...form, xpReward: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400">Coins</label>
              <input
                type="number"
                min={0}
                value={form.coinsReward}
                onChange={(e) => setForm({ ...form, coinsReward: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] text-zinc-400">Stage #</label>
              <input
                type="number"
                min={1}
                value={form.stageOrder}
                onChange={(e) => setForm({ ...form, stageOrder: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            Publish immediately
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() =>
                setPreviewPuzzle({
                  title: form.title || 'Preview Puzzle',
                  puzzle_type: form.puzzleType,
                  difficulty: form.difficulty,
                  prompt: form.prompt,
                  payloadText: form.puzzlePayloadText,
                  correctAnswer: form.correctAnswer,
                  explanation: form.explanation,
                })
              }
              className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:bg-rose-500"
            >
              {editingId ? 'Save Changes' : 'Create Puzzle'}
            </button>
          </div>
        </form>

        <div className="space-y-4 xl:col-span-2">
          {previewPuzzle && (
            <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-indigo-300">Pre-Publish Preview</span>
                <button onClick={() => setPreviewPuzzle(null)} className="text-xs text-zinc-400 hover:text-white">
                  Close
                </button>
              </div>
              <h3 className="mt-1 font-bold text-white">{previewPuzzle.title}</h3>
              <p className="mt-1 text-sm text-zinc-300">{previewPuzzle.prompt}</p>
              <pre className="mt-2 rounded bg-zinc-950 p-2 font-mono text-xs text-zinc-300">{previewPuzzle.payloadText}</pre>
              <div className="mt-2 font-mono text-xs text-rose-300">Server Answer: {previewPuzzle.correctAnswer}</div>
              {previewPuzzle.explanation && (
                <div className="mt-1 text-xs text-emerald-300">Explanation: {previewPuzzle.explanation}</div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="mb-4 text-base font-semibold text-white">Puzzle Inventory ({puzzles.length})</h2>
            <div className="space-y-3">
              {puzzles.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3.5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{p.title}</span>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase text-indigo-300">
                        {p.puzzle_type}
                      </span>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                        {p.difficulty}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          p.is_published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {p.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Room: {p.mission_title || 'Daily Pool'} · Stage {p.stage_order ?? 1} · {p.xp_reward} XP · {p.coins_reward ?? 15} Coins · Answer:{' '}
                      <code className="text-rose-300">{p.correct_answer}</code>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => togglePublish(p)}
                      className="rounded border border-zinc-700 p-1.5 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
                      title={p.is_published ? 'Unpublish' : 'Publish'}
                    >
                      {p.is_published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="rounded border border-zinc-700 p-1.5 text-zinc-300 hover:border-indigo-500 hover:text-indigo-300"
                      title="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteOrArchive(p)}
                      className="rounded border border-zinc-700 p-1.5 text-zinc-300 hover:border-rose-500 hover:text-rose-400"
                      title="Delete or Archive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
