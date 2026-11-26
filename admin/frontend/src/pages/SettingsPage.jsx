import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { adminApi } from '../lib/api';

export default function SettingsPage() {
  const [settingsMap, setSettingsMap] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi('/api/admin/settings')
      .then((d) => {
        const map = {};
        for (const item of d.settings) {
          map[item.key] = item.value;
        }
        setSettingsMap(map);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await adminApi('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          registration_enabled: Boolean(settingsMap.registration_enabled),
          multiplayer_enabled: Boolean(settingsMap.multiplayer_enabled),
          maintenance_mode: Boolean(settingsMap.maintenance_mode),
          suspicious_speed_threshold_ms: Number(settingsMap.suspicious_speed_threshold_ms),
          hint_xp_penalty_percent: Number(settingsMap.hint_xp_penalty_percent),
        }),
      });
      setMsg('System settings persisted to PostgreSQL and logged in audit trail.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!settingsMap) return <div className="text-zinc-400">Loading settings...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Settings className="h-6 w-6 text-rose-400" /> Administrative Settings
        </h1>
        <p className="text-sm text-zinc-400">Global platform security & gameplay controls stored in PostgreSQL</p>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {msg && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">{msg}</div>}

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <label className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="font-medium text-white">Public Player Registration</div>
            <div className="text-xs text-zinc-400">Allow new players to register on the Game frontend</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settingsMap.registration_enabled)}
            onChange={(e) => setSettingsMap({ ...settingsMap, registration_enabled: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="font-medium text-white">Multiplayer Rooms</div>
            <div className="text-xs text-zinc-400">Allow creating and joining multiplayer matches</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settingsMap.multiplayer_enabled)}
            onChange={(e) => setSettingsMap({ ...settingsMap, multiplayer_enabled: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="font-medium text-white">Maintenance Mode</div>
            <div className="text-xs text-zinc-400">Pause starting new solo and daily matches</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(settingsMap.maintenance_mode)}
            onChange={(e) => setSettingsMap({ ...settingsMap, maintenance_mode: e.target.checked })}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-300">Suspicious Speed Threshold (ms)</label>
            <input
              type="number"
              min={100}
              max={60000}
              value={settingsMap.suspicious_speed_threshold_ms}
              onChange={(e) =>
                setSettingsMap({ ...settingsMap, suspicious_speed_threshold_ms: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-300">Hint XP Penalty (%)</label>
            <input
              type="number"
              min={0}
              max={90}
              value={settingsMap.hint_xp_penalty_percent}
              onChange={(e) =>
                setSettingsMap({ ...settingsMap, hint_xp_penalty_percent: Number(e.target.value) })
              }
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
        >
          <Save className="h-4 w-4" /> Save Settings
        </button>
      </form>
    </div>
  );
}
