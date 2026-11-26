import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, KeyRound, Hourglass, Swords, Gem, Calendar, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudio } from '../context/AudioContext';

const modes = [
  {
    icon: KeyRound,
    title: 'Mystery Rooms',
    desc: 'Inspect candlelit rooms, discover hidden objects, question suspects, and unlock secret doors.',
    color: 'from-amber-500/20 to-amber-900/10 border-amber-500/30 text-amber-300',
  },
  {
    icon: Hourglass,
    title: 'Escape Challenge',
    desc: 'Beat the ticking clock across rising difficulty stages using observation, rotation, and spatial logic.',
    color: 'from-cyan-500/20 to-cyan-900/10 border-cyan-500/30 text-cyan-300',
  },
  {
    icon: Swords,
    title: 'Brain Battle (2–4 Players)',
    desc: 'Invite friends with a private room code, race through shared puzzles live, and claim the trophy!',
    color: 'from-rose-500/20 to-rose-900/10 border-rose-500/30 text-rose-300',
  },
  {
    icon: Gem,
    title: 'Treasure Hunt',
    desc: 'Follow mosaic clues, balance enchanted gem scales, and pop open the golden treasure chest.',
    color: 'from-emerald-500/20 to-emerald-900/10 border-emerald-500/30 text-emerald-300',
  },
  {
    icon: Calendar,
    title: 'Daily Mystery',
    desc: 'One brand-new riddle or observation challenge every day—keep your daily streak burning!',
    color: 'from-violet-500/20 to-violet-900/10 border-violet-500/30 text-violet-300',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const { sfx } = useAudio();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 lg:py-16">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-4xl text-center"
      >
        <div className="animate-float-slow mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-400/25 via-amber-500/15 to-emerald-500/20 shadow-2xl shadow-amber-500/20">
          <Compass className="h-10 w-10 text-amber-300" />
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
          <Sparkles className="h-3.5 w-3.5" /> Interactive Mystery & Brain Adventure
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          Unlock Every Secret.{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
            Claim the Treasure.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          Explore mysterious manors, escape sunken observatories before time runs out, solve visual riddles, and challenge friends in live Brain Battles!
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {user ? (
            <Link
              to="/dashboard"
              onClick={() => sfx.playClick()}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-amber-500/25 transition hover:scale-[1.02]"
            >
              Continue Adventure <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                onClick={() => sfx.playClick()}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-3.5 text-base font-bold text-slate-950 shadow-xl shadow-amber-500/25 transition hover:scale-[1.02]"
              >
                Start Your Adventure <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                onClick={() => sfx.playClick()}
                className="rounded-2xl border border-slate-700 bg-slate-900/80 px-7 py-3.5 text-base font-semibold text-slate-100 transition hover:border-amber-400/50"
              >
                Explorer Sign In
              </Link>
            </>
          )}
        </div>
      </motion.section>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {modes.map((m, i) => (
          <motion.div
            key={m.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * (i + 1) }}
            whileHover={{ y: -4 }}
            className={`rounded-2xl border bg-gradient-to-b p-5 backdrop-blur ${m.color}`}
          >
            <m.icon className="mb-3 h-7 w-7" />
            <h3 className="text-base font-bold text-white">{m.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{m.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
