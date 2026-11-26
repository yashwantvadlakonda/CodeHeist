import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  LayoutDashboard,
  Puzzle,
  CalendarClock,
  Users,
  Activity,
  BarChart3,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/puzzles', label: 'Puzzle Management', icon: Puzzle },
  { to: '/daily-challenges', label: 'Daily Challenges', icon: CalendarClock },
  { to: '/players', label: 'Player Management', icon: Users },
  { to: '/matches', label: 'Match Monitoring', icon: Activity },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/audit-logs', label: 'Audit Logs', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/90">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wide text-white">CODEHEIST</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
              SEC-OPS ADMIN
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="mb-3 truncate text-xs text-zinc-400">
            Signed in: <span className="font-mono text-zinc-200">{admin?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 py-2 text-xs font-semibold text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Terminate Session
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
