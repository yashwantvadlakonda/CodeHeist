import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
  Clock,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Send,
  Users,
  Sparkles,
  Coins,
  DoorOpen,
} from 'lucide-react';
import { apiRequest, getStoredToken, SOCKET_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';
import PuzzleRenderer from '../components/PuzzleRenderer';

export default function GameArenaPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { sfx } = useAudio();

  const [matchState, setMatchState] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealedHints, setRevealedHints] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [lastExplanation, setLastExplanation] = useState('');
  const [unlockedAchievements, setUnlockedAchievements] = useState([]);
  const [levelUpBanner, setLevelUpBanner] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const prevPuzzleIdRef = useRef(null);

  const loadMatch = useCallback(async () => {
    try {
      const data = await apiRequest(`/api/missions/matches/${matchId}`);
      setMatchState(data);
      const firstUnsolved = data.puzzles.findIndex((p) => !data.solvedPuzzleIds.includes(p.id));
      if (firstUnsolved >= 0) setActiveIndex(firstUnsolved);
    } catch (err) {
      setError(err.message);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // Countdown timer with ticking sound in final 15s & Game Over trigger for Escape Challenge
  useEffect(() => {
    const match = matchState?.match;
    if (!match?.started_at || match?.status !== 'active') return;
    const limit = Number(match.mission_time_limit) || 300;
    const startMs = new Date(match.started_at).getTime();

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const left = Math.max(0, limit - elapsed);
      setRemainingSeconds(left);
      if (left > 0 && left <= 15) {
        sfx.playTick();
      }
      if (left === 0 && match.game_mode === 'escape_challenge' && !timedOut) {
        setTimedOut(true);
        sfx.playGameOver();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [matchState?.match?.started_at, matchState?.match?.status, matchState?.match?.mission_time_limit, matchState?.match?.game_mode, timedOut, sfx]);

  // Puzzle entrance sound
  useEffect(() => {
    const cur = matchState?.puzzles?.[activeIndex];
    if (cur && cur.id !== prevPuzzleIdRef.current) {
      prevPuzzleIdRef.current = cur.id;
      sfx.playPuzzleAppear();
    }
  }, [matchState?.puzzles, activeIndex, sfx]);

  // Real-time Socket.IO subscription
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.on('connect', () => {
      socket.emit('match:join', matchId);
    });
    socket.on('match:progress', () => {
      loadMatch();
    });
    socket.on('match:started', () => {
      loadMatch();
    });
    socket.on('match:terminated', (payload) => {
      sfx.playGameOver();
      setFeedback({ type: 'error', message: `Room closed by moderator: ${payload.reason}` });
      loadMatch();
    });
    return () => {
      socket.emit('match:leave', matchId);
      socket.disconnect();
    };
  }, [matchId, loadMatch, sfx]);

  if (error) return <div className="mx-auto max-w-4xl p-8 text-rose-300">{error}</div>;
  if (!matchState) return <div className="mx-auto max-w-4xl p-8 text-slate-400">Entering adventure chamber...</div>;

  const { match, participants, puzzles, solvedPuzzleIds } = matchState;
  const currentPuzzle = puzzles[activeIndex];
  const isCompleted = match.status === 'completed';
  const isTerminated = match.status === 'terminated';
  const isTreasureHunt = match.game_mode === 'treasure_hunt';

  const handleRequestHint = async () => {
    if (!currentPuzzle) return;
    sfx.playClick();
    try {
      const data = await apiRequest(`/api/missions/matches/${matchId}/hint`, {
        method: 'POST',
        body: JSON.stringify({ puzzleId: currentPuzzle.id, hintIndex: revealedHints.length }),
      });
      setRevealedHints((prev) => [...prev, data.hint]);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleSubmitAnswer = async (e) => {
    e.preventDefault();
    if (!currentPuzzle || !answer.trim() || timedOut) return;
    sfx.playClick();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiRequest(`/api/missions/matches/${matchId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          puzzleId: currentPuzzle.id,
          answer: answer.trim(),
          hintsUsed: revealedHints.length,
        }),
      });
      if (res.isCorrect) {
        if (res.matchCompleted) {
          if (isTreasureHunt) sfx.playChestOpen();
          else sfx.playDoorUnlock();
          setTimeout(() => sfx.playVictory(), 280);
        } else {
          sfx.playCorrect();
        }
        if (res.leveledUp) {
          setTimeout(() => sfx.playLevelUp(), 520);
          setLevelUpBanner({ level: res.newLevel, rankTitle: res.newRankTitle });
        }
        setLastExplanation(res.explanation || '');
        setFeedback({
          type: 'success',
          message: `Solved! +${res.scoreAwarded} XP & +${res.coinsAwarded} Coins${
            res.matchCompleted ? ` · Adventure Complete (+${res.totalXpAwarded} Total XP)!` : ''
          }`,
        });
        if (res.unlockedAchievements?.length) {
          setUnlockedAchievements(res.unlockedAchievements);
        }
        setAnswer('');
        setRevealedHints([]);
        await loadMatch();
        await refreshUser();
      } else {
        sfx.playWrong();
        setFeedback({ type: 'error', message: 'Not quite right—check the clues and try again!' });
      }
    } catch (err) {
      sfx.playWrong();
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (secs) => {
    if (secs === null || secs === undefined) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const winner = participants.find((p) => p.is_winner);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Room Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-500/25 bg-gradient-to-r from-slate-900/95 via-[#151c3a] to-slate-900/95 p-5 shadow-xl"
      >
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
            {(match.game_mode || match.match_type).replace('_', ' ')}
            {match.room_code ? ` · Room #${match.room_code}` : ''}
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            {match.mission_title || match.daily_title || 'Puzzle Adventure'}
          </h1>
          {match.story_intro && <p className="mt-1 text-xs italic text-slate-300">{match.story_intro}</p>}
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-bold ${
              remainingSeconds !== null && remainingSeconds <= 15
                ? 'animate-pulse border-rose-500 bg-rose-500/20 text-rose-200'
                : 'border-slate-700 bg-slate-950 text-amber-300'
            }`}
          >
            <Clock className="h-4 w-4" /> {formatDuration(remainingSeconds)}
          </div>
          <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold uppercase text-white">
            {match.status}
          </span>
        </div>
      </motion.div>

      {/* Level Up Banner */}
      <AnimatePresence>
        {levelUpBanner && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 p-4 text-center shadow-lg"
          >
            <div className="text-lg font-extrabold text-amber-300">
              ✨ LEVEL UP! Explorer Level {levelUpBanner.level} — {levelUpBanner.rankTitle} ✨
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timed Out Game Over */}
      {timedOut && !isCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-2xl border border-rose-500/40 bg-rose-950/50 p-6 text-center"
        >
          <h2 className="text-2xl font-extrabold text-rose-200">Time Expired!</h2>
          <p className="mt-1 text-sm text-rose-300">The chamber sealed before you could escape. Try again faster!</p>
          <button
            onClick={() => navigate('/missions')}
            className="mt-4 rounded-xl bg-rose-500 px-5 py-2 text-sm font-bold text-white hover:bg-rose-400"
          >
            Return to Adventures
          </button>
        </motion.div>
      )}

      {isTerminated && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Adventure Closed</div>
            <div className="text-sm">{match.termination_reason || 'Closed by moderator.'}</div>
          </div>
        </div>
      )}

      {/* Completion Screen (Door Unlocked / Treasure Chest Opened / Brain Battle Winner) */}
      {isCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-950/60 via-slate-900 to-amber-950/40 p-6 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-3xl">
                {isTreasureHunt ? '🧰' : <DoorOpen className="h-8 w-8 text-emerald-300" />}
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">
                  {isTreasureHunt ? 'Treasure Chest Unlocked!' : 'Secret Door Unlocked!'}
                </h2>
                <p className="text-sm text-emerald-200">
                  {match.story_outro || 'Every puzzle solved and your rewards have been saved!'}
                </p>
                {winner && participants.length > 1 && (
                  <p className="mt-1 text-sm font-bold text-amber-300">
                    🏆 Brain Battle Winner: {winner.display_name || winner.username}!
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                sfx.playClick();
                navigate('/dashboard');
              }}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:brightness-105"
            >
              Back to Hub
            </button>
          </div>
          {unlockedAchievements.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {unlockedAchievements.map((a) => (
                <span key={a.id} className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-200">
                  🏅 Badge Unlocked: {a.title} (+{a.xpBonus} XP)
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Stage Progress */}
          <div className="flex flex-wrap gap-2">
            {puzzles.map((p, idx) => {
              const solved = solvedPuzzleIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    sfx.playClick();
                    setActiveIndex(idx);
                    setRevealedHints([]);
                    setFeedback(null);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                    idx === activeIndex
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : solved
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {solved && <CheckCircle2 className="h-3.5 w-3.5" />}
                  Stage {idx + 1}
                </button>
              );
            })}
          </div>

          {currentPuzzle && (
            <motion.div
              key={currentPuzzle.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase text-amber-300">
                  {currentPuzzle.puzzleType.replace(/_/g, ' ')}
                </span>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1 text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" /> +{currentPuzzle.xpReward} XP
                  </span>
                  <span className="flex items-center gap-1 text-amber-300">
                    <Coins className="h-3.5 w-3.5" /> +{currentPuzzle.coinsReward ?? 15}
                  </span>
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-white">{currentPuzzle.title}</h2>
              <p className="mt-2 mb-5 text-sm leading-relaxed text-slate-200">{currentPuzzle.prompt}</p>

              <PuzzleRenderer puzzle={currentPuzzle} answer={answer} onChangeAnswer={setAnswer} />

              {revealedHints.length > 0 && (
                <div className="mt-4 space-y-2">
                  {revealedHints.map((h, i) => (
                    <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                      💡 Hint {i + 1}: {h}
                    </div>
                  ))}
                </div>
              )}

              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 rounded-xl border p-3.5 text-sm ${
                    feedback.type === 'success'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                  }`}
                >
                  <div className="font-semibold">{feedback.message}</div>
                  {(lastExplanation || currentPuzzle.explanation) && feedback.type === 'success' && (
                    <div className="mt-1.5 text-xs text-emerald-100/90">
                      Why it works: {currentPuzzle.explanation || lastExplanation}
                    </div>
                  )}
                </motion.div>
              )}

              {!isCompleted && !isTerminated && !timedOut && !solvedPuzzleIds.includes(currentPuzzle.id) && (
                <form onSubmit={handleSubmitAnswer} className="mt-5 flex flex-wrap gap-3">
                  <input
                    type="text"
                    required
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your answer (or interact above)..."
                    className="min-w-[220px] flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleRequestHint}
                    disabled={revealedHints.length >= currentPuzzle.hintsCount}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-200 hover:border-amber-400/50 disabled:opacity-40"
                  >
                    <HelpCircle className="h-4 w-4 text-amber-400" />
                    Hint ({revealedHints.length}/{currentPuzzle.hintsCount})
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-105 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? 'Checking...' : 'Unlock'}
                  </button>
                </form>
              )}
            </motion.div>
          )}
        </div>

        {/* Live Players / Scoreboard */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 h-fit">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-300">
            <Users className="h-4 w-4" /> Explorers in Room
          </h3>
          <div className="space-y-3">
            {participants.map((p) => (
              <div
                key={p.user_id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3"
              >
                <div>
                  <div className="text-sm font-bold text-white">
                    {p.display_name || p.username} {p.is_winner ? '👑' : ''}
                  </div>
                  <div className="text-xs text-slate-400">
                    Stages {p.correct_count}/{puzzles.length} · {p.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-emerald-400">{p.score} pts</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
