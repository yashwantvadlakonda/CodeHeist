import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/overview');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">CodeHeist Admin Console</h1>
            <p className="text-xs font-mono uppercase tracking-wider text-rose-400">
              Authorized Security Personnel Only
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 text-xs text-zinc-400">
          Public registration is disabled. Access is enforced server-side via PostgreSQL role verification and audit logging.
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">Administrator Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
          >
            <Lock className="h-4 w-4" />
            {submitting ? 'Verifying Clearance...' : 'Authenticate to Admin Console'}
          </button>
        </form>
      </div>
    </div>
  );
}
