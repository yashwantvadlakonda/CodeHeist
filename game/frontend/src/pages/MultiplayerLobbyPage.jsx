import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Swords, Plus, LogIn, Play, Copy, Check } from 'lucide-react';
import { apiRequest, getStoredToken, SOCKET_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

export default function MultiplayerLobbyPage() {
  const { user } = useAuth();
  const { sfx } = useAudio();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [missions, setMissions] = useState([]);
  const [missionId, setMissionId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const loadLobby = useCallback(async () => {
    try {
      const [roomsData, missionsData] = await Promise.all([
        apiRequest('/api/missions/multiplayer/rooms'),
        apiRequest('/api/missions'),
      ]);
      setRooms(roomsData.rooms);
      setMissions(missionsData.missions);
      if (!missionId && missionsData.missions.length > 0) {
        const preferred =
          missionsData.missions.find((m) => m.game_mode === 'brain_battle') ||
          missionsData.missions[0];
        setMissionId(preferred.id);
      }
    } catch (err) {
      setError(err.message);
    }
  }, [missionId]);

  useEffect(() => {
    loadLobby();
    const token = getStoredToken();
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('lobby:updated', loadLobby);
    socket.on('match:players', (list) => setPlayers(list));
    socket.on('match:started', ({ matchId }) => {
      sfx.playDoorUnlock();
      navigate(`/arena/${matchId}`);
    });
    if (activeRoom) {
      socket.emit('match:join', activeRoom.id);
    }
    return () => socket.disconnect();
  }, [loadLobby, activeRoom, navigate, sfx]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    sfx.playClick();
    setError('');
    try {
      const res = await apiRequest('/api/missions/multiplayer/rooms', {
        method: 'POST',
        body: JSON.stringify({ missionId, maxPlayers: Number(maxPlayers) }),
      });
      setActiveRoom(res.match);
      setPlayers([{ user_id: user.id, username: user.username, display_name: user.profile?.displayName }]);
      await loadLobby();
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    }
  };

  const handleJoinRoom = async (code) => {
    sfx.playClick();
    setError('');
    try {
      const res = await apiRequest(`/api/missions/multiplayer/rooms/${code.trim().toUpperCase()}/join`, {
        method: 'POST',
      });
      setActiveRoom(res.match);
      setPlayers(res.players);
      if (res.match.status === 'active') {
        navigate(`/arena/${res.match.id}`);
      }
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    }
  };

  const handleStartRoom = async () => {
    if (!activeRoom) return;
    sfx.playClick();
    setError('');
    try {
      await apiRequest(`/api/missions/multiplayer/rooms/${activeRoom.room_code}/start`, {
        method: 'POST',
      });
      sfx.playDoorUnlock();
      navigate(`/arena/${activeRoom.id}`);
    } catch (err) {
      sfx.playWrong();
      setError(err.message);
    }
  };

  const copyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.room_code);
    setCopied(true);
    sfx.playClick();
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-white">
          <Swords className="h-7 w-7 text-rose-400" /> Brain Battle Arena
        </h1>
        <p className="text-sm text-slate-300">
          Compete with 2–4 players in real time! Fast and accurate answers earn higher scores.
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      {activeRoom && (
        <div className="mb-8 rounded-3xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-slate-900 to-rose-500/15 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Private Battle Room Ready</div>
              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-2xl font-extrabold text-white">Room Code: {activeRoom.room_code}</h2>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-slate-950 px-2.5 py-1 text-xs text-amber-200"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Invite'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-300">Share this room code with friends to compete together.</p>
            </div>
            {activeRoom.created_by === user?.id ? (
              <button
                onClick={handleStartRoom}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:brightness-105"
              >
                <Play className="h-4 w-4" /> Start Brain Battle
              </button>
            ) : (
              <span className="rounded-xl bg-slate-900 px-4 py-2 text-xs text-amber-300">
                Waiting for host to launch...
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {players.map((p) => (
              <span key={p.user_id} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white">
                🧭 {p.display_name || p.username}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <form onSubmit={handleCreateRoom} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <Plus className="h-4 w-4 text-amber-400" /> Create Private Room
            </h2>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Adventure Set</label>
              <select
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.difficulty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Players (2–4)</label>
              <input
                type="number"
                min={2}
                max={4}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-sm font-bold text-slate-950 hover:brightness-105"
            >
              Create Battle Room
            </button>
          </form>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              <LogIn className="h-4 w-4 text-cyan-400" /> Join by Room Code
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold uppercase text-white"
              />
              <button
                onClick={() => handleJoinRoom(joinCode)}
                disabled={!joinCode.trim()}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <Swords className="h-4 w-4 text-rose-400" /> Open Brain Battle Rooms
          </h2>
          {rooms.length === 0 ? (
            <p className="text-sm text-slate-400">No active battle rooms right now. Create one and invite friends!</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/75 p-4"
                >
                  <div>
                    <div className="font-bold text-white">
                      {r.mission_title} <span className="ml-2 text-xs text-amber-300">#{r.room_code}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      Host: {r.host_username} · Players: {r.player_count}/{r.max_players} · {r.status}
                    </div>
                  </div>
                  {r.status === 'waiting' && (
                    <button
                      onClick={() => handleJoinRoom(r.room_code)}
                      className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
                    >
                      Join Battle
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
