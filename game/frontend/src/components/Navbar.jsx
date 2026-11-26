import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  Trophy,
  Calendar,
  Swords,
  History,
  Award,
  User,
  LogOut,
  Volume2,
  VolumeX,
  Music,
  Coins,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { musicEnabled, sfxEnabled, volume, toggleMusic, toggleSfx, setVolume, sfx } = useAudio();
  const navigate = useNavigate();

  const handleLogout = () => {
    sfx.playClick();
    logout();
    navigate('/');
  };

  const navClass = ({ isActive }) =>
    `flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#090d1e]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link
          to={user ? '/dashboard' : '/'}
          onClick={() => sfx.playClick()}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-emerald-500 text-slate-950 shadow-lg shadow-amber-500/25">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-white">CodeHeist</span>
            <span className="ml-2 hidden rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 sm:inline">
              Puzzle Adventure
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {user ? (
            <>
              <NavLink to="/dashboard" onClick={() => sfx.playClick()} className={navClass}>
                <Sparkles className="h-4 w-4" /> Hub
              </NavLink>
              <NavLink to="/missions" onClick={() => sfx.playClick()} className={navClass}>
                <Compass className="h-4 w-4" /> Adventures
              </NavLink>
              <NavLink to="/multiplayer" onClick={() => sfx.playClick()} className={navClass}>
                <Swords className="h-4 w-4" /> Brain Battle
              </NavLink>
              <NavLink to="/daily" onClick={() => sfx.playClick()} className={navClass}>
                <Calendar className="h-4 w-4" /> Daily Mystery
              </NavLink>
              <NavLink to="/leaderboard" onClick={() => sfx.playClick()} className={navClass}>
                <Trophy className="h-4 w-4" /> Rankings
              </NavLink>
              <NavLink to="/achievements" onClick={() => sfx.playClick()} className={navClass}>
                <Award className="h-4 w-4" /> Badges
              </NavLink>
              <NavLink to="/history" onClick={() => sfx.playClick()} className={navClass}>
                <History className="h-4 w-4" /> Journal
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/missions" onClick={() => sfx.playClick()} className={navClass}>
                Adventures
              </NavLink>
              <NavLink to="/leaderboard" onClick={() => sfx.playClick()} className={navClass}>
                Rankings
              </NavLink>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* Audio controls */}
          <div className="hidden items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1 sm:flex">
            <button
              type="button"
              onClick={toggleMusic}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                musicEnabled
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={musicEnabled ? 'Mute Background Music' : 'Play Atmospheric Music'}
            >
              <Music className="inline h-3.5 w-3.5 mr-1" />
              {musicEnabled ? 'Music ON' : 'Music OFF'}
            </button>
            <button
              type="button"
              onClick={toggleSfx}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                sfxEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
              title={sfxEnabled ? 'Mute Sound Effects' : 'Enable Sound Effects'}
            >
              {sfxEnabled ? <Volume2 className="inline h-3.5 w-3.5" /> : <VolumeX className="inline h-3.5 w-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              aria-label="Audio volume"
              className="w-14 accent-amber-400"
            />
          </div>

          {user ? (
            <>
              <Link
                to="/profile"
                onClick={() => sfx.playClick()}
                className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-slate-900/90 px-3 py-1.5 text-sm hover:border-amber-400/50"
              >
                <User className="h-4 w-4 text-amber-400" />
                <span className="hidden font-semibold text-white md:inline">
                  {user.profile?.displayName || user.username}
                </span>
                <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-1.5 py-0.5 text-xs font-bold text-amber-300">
                  <Coins className="h-3 w-3" /> {user.profile?.coins ?? 100}
                </span>
                <span className="rounded-lg bg-emerald-500/15 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
                  Lv.{user.profile?.level ?? 1}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-800 p-2 text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => sfx.playClick()}
                className="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => sfx.playClick()}
                className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/20 hover:brightness-105"
              >
                Play Now
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
