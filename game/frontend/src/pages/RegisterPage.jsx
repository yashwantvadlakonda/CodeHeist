import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const { sfx } = useAudio();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', displayName: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    sfx.playClick();
    setError('');
    setSubmitting(true);
    try {
      await register({
        username: form.username,
        email: form.email,
        displayName: form.displayName || undefined,
        password: form.password,
      });
      sfx.playVictory();
      navigate('/dashboard');
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="rounded-2xl border border-amber-500/25 bg-slate-900/85 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Join the Adventure</h1>
            <p className="text-xs text-slate-400">Create your Explorer profile to save rooms, coins & streaks</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Explorer Handle</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={30}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="starlight_seeker"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Display Name (optional)</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="Luna Explorer"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="explorer@example.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? 'Preparing Compass...' : 'Begin Journey'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Already have an Explorer Pass?{' '}
          <Link to="/login" className="text-amber-300 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
