import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MissionsPage from './pages/MissionsPage';
import GameArenaPage from './pages/GameArenaPage';
import MultiplayerLobbyPage from './pages/MultiplayerLobbyPage';
import DailyChallengePage from './pages/DailyChallengePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AchievementsPage from './pages/AchievementsPage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-400">Opening adventure journal...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AudioProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/missions" element={<MissionsPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/arena/:matchId"
                  element={
                    <ProtectedRoute>
                      <GameArenaPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/multiplayer"
                  element={
                    <ProtectedRoute>
                      <MultiplayerLobbyPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/daily"
                  element={
                    <ProtectedRoute>
                      <DailyChallengePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/achievements"
                  element={
                    <ProtectedRoute>
                      <AchievementsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <HistoryPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </AudioProvider>
  );
}
