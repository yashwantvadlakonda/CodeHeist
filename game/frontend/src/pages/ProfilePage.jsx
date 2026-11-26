import { useEffect, useState } from 'react';
import { User, Save, Coins, Flame } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

export default function ProfilePage() {
  const { refreshUser } = useAuth();
  const { sfx } = useAudio();
  const [profile, setProfile] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/player/profile')
      .then((d) => {
        setUserInfo(d.user);
        setProfile(d.profile);
        setDisplayName(d.profile?.display_name || '');
        setBio(d.profile?.bio || '');
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    sfx.playClick();
    setMessage('');
    setError('');
    try {
      const updated = await apiRequest('/api/player/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, bio }),
      });
      setProfile(updated.profile);
      await refreshUser();
      sfx.playCorrect();
      setMessage('Explorer profile updated.');
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    }
  };

  if (!profile) return <div className="mx-auto max-w-3xl p-8 text-slate-400">Loading Explorer Profile...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-3xl border border-amber-500/25 bg-slate-900/85 p-8 shadow-xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">{profile.display_name}</h1>
              <p className="text-xs text-slate-400">
                @{userInfo?.username} · {profile.rank_title} (Lv.{profile.level})
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-amber-300">
              <Coins className="h-3.5 w-3.5" /> {profile.coins ?? 100} Coins
            </span>
            <span className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 py-1.5 text-rose-300">
              <Flame className="h-3.5 w-3.5" /> {profile.daily_streak ?? 0}d Streak
            </span>
          </div>
        </div>

        {message && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</div>}
        {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Display Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Explorer Bio</label>
            <textarea
              rows={3}
              maxLength={300}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
          >
            <Save className="h-4 w-4" /> Save Profile
          </button>
        </form>
      </div>
    </div>
  );
}
