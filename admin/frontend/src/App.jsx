import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLayout from './components/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';
import OverviewPage from './pages/OverviewPage';
import PuzzlesPage from './pages/PuzzlesPage';
import DailyChallengesPage from './pages/DailyChallengesPage';
import PlayersPage from './pages/PlayersPage';
import MatchesPage from './pages/MatchesPage';
import ReportsPage from './pages/ReportsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';

function RequireAdminRoute({ children }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <div className="p-8 text-center text-zinc-400">Verifying administrator clearance...</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />
          <Route
            path="/"
            element={
              <RequireAdminRoute>
                <AdminLayout />
              </RequireAdminRoute>
            }
          >
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="puzzles" element={<PuzzlesPage />} />
            <Route path="daily-challenges" element={<DailyChallengesPage />} />
            <Route path="players" element={<PlayersPage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
