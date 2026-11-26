import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  RotateCw,
  Eye,
  Flame,
  Globe,
  Watch,
  Feather,
  Scale,
  Lightbulb,
  Check,
  RefreshCw,
} from 'lucide-react';
import { API_URL } from '../lib/api';
import { useAudio } from '../context/AudioContext';

function ShapeIcon({ shape, color, size = 44 }) {
  if (shape === 'circle') {
    return <circle cx="24" cy="24" r="16" fill={color} stroke="#ffffff33" strokeWidth="2" />;
  }
  if (shape === 'square') {
    return <rect x="8" y="8" width="32" height="32" rx="6" fill={color} stroke="#ffffff33" strokeWidth="2" />;
  }
  if (shape === 'diamond') {
    return <polygon points="24,4 44,24 24,44 4,24" fill={color} stroke="#ffffff33" strokeWidth="2" />;
  }
  return <polygon points="24,5 43,41 5,41" fill={color} stroke="#ffffff33" strokeWidth="2" />;
}

export default function PuzzleRenderer({ puzzle, answer, onChangeAnswer }) {
  const { sfx } = useAudio();
  const payload = puzzle?.puzzlePayload || {};

  // Interactive states per puzzle mechanic
  const [switches, setSwitches] = useState([false, false, false]);
  const [foundNote, setFoundNote] = useState('');
  const [rotation, setRotation] = useState(Number(payload.initialDegrees) || 45);
  const [foundSpots, setFoundSpots] = useState([]);
  const [orderedTiles, setOrderedTiles] = useState([]);
  const [selectedLeft, setSelectedLeft] = useState(null);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [memoryVisible, setMemoryVisible] = useState(true);

  useEffect(() => {
    setSwitches([false, false, false]);
    setFoundNote('');
    setRotation(Number(payload.initialDegrees) || 45);
    setFoundSpots([]);
    setOrderedTiles([]);
    setSelectedLeft(null);
    setMatchedPairs([]);
    setMemoryVisible(true);

    if (puzzle?.puzzleType === 'memory_challenge' || puzzle?.puzzleType === 'memory_sequence') {
      const ms = Number(payload.displayMs) || 4500;
      const timer = setTimeout(() => setMemoryVisible(false), ms);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [puzzle?.id, puzzle?.puzzleType, payload.initialDegrees, payload.displayMs]);

  if (!puzzle) return null;

  const resolvedImageUrl = puzzle.imageUrl
    ? puzzle.imageUrl.startsWith('http')
      ? puzzle.imageUrl
      : `${API_URL}${puzzle.imageUrl}`
    : null;

  const renderCustomImage = () =>
    resolvedImageUrl ? (
      <div className="mb-4 overflow-hidden rounded-xl border border-amber-500/30 bg-slate-950 p-2">
        <img
          src={resolvedImageUrl}
          alt={puzzle.title}
          className="mx-auto max-h-72 rounded-lg object-contain"
        />
      </div>
    ) : null;

  switch (puzzle.puzzleType) {
    case 'logical_reasoning':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-300">
              Interactive Switch Simulator (Experiment freely!)
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {(payload.switches || ['Switch A', 'Switch B', 'Switch C']).map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setSwitches((prev) => prev.map((v, i) => (i === idx ? !v : v)));
                  }}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                    switches[idx]
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-lg shadow-amber-500/15'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  <Lightbulb className={`h-6 w-6 ${switches[idx] ? 'text-amber-300' : 'text-slate-600'}`} />
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[10px] uppercase">{switches[idx] ? 'ON' : 'OFF'}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {(payload.options || []).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    onChangeAnswer?.(opt.id);
                  }}
                  className={`w-full rounded-xl border p-3.5 text-left text-sm transition ${
                    answer === opt.id
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-100'
                      : 'border-slate-800 bg-slate-900/70 text-slate-200 hover:border-amber-500/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'hidden_object':
      return (
        <div className="space-y-3">
          {renderCustomImage()}
          <div className="relative h-64 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#17122b] via-[#13192f] to-[#0b0e1c] p-4">
            <div className="mb-2 text-xs font-semibold text-amber-300">
              {payload.clueText || 'Click objects in the room to inspect them!'}
            </div>
            {/* Decorative window & bookshelf SVG */}
            <svg viewBox="0 0 400 180" className="pointer-events-none absolute inset-0 h-full w-full opacity-25">
              <rect x="20" y="30" width="90" height="120" rx="6" fill="#334155" />
              <rect x="145" y="25" width="110" height="75" rx="50" fill="#1e293b" stroke="#f59e0b" strokeWidth="2" />
              <rect x="280" y="105" width="100" height="55" rx="6" fill="#3f2e21" />
            </svg>

            {(payload.objects || []).map((obj) => {
              const Icon =
                obj.icon === 'flame'
                  ? Flame
                  : obj.icon === 'globe'
                  ? Globe
                  : obj.icon === 'watch'
                  ? Watch
                  : Feather;
              return (
                <motion.button
                  key={obj.id}
                  type="button"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    sfx.playClick();
                    if (obj.isTarget) {
                      sfx.playChestOpen();
                      setFoundNote(`Found ${obj.label}! Ready to submit.`);
                      onChangeAnswer?.(obj.reveal || obj.label.toUpperCase());
                    } else {
                      setFoundNote(`${obj.label}: ${obj.note}`);
                    }
                  }}
                  style={{ left: `${obj.x}%`, top: `${obj.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 rounded-xl border border-amber-400/30 bg-slate-900/80 px-3 py-2 text-amber-200 shadow-lg hover:border-amber-300 hover:bg-amber-500/20"
                >
                  <Icon className="h-5 w-5 text-amber-300" />
                  <span className="text-[11px] font-medium">{obj.label}</span>
                </motion.button>
              );
            })}
          </div>
          {foundNote && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              {foundNote}
            </div>
          )}
        </div>
      );

    case 'riddle_word':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/35 via-slate-900 to-slate-950 p-6 text-center shadow-inner">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-400" />
            <p className="font-serif text-lg italic leading-relaxed text-amber-100">
              “{payload.parchmentQuote || puzzle.prompt}”
            </p>
            {payload.letterCount && (
              <div className="mt-4 flex justify-center gap-2">
                {Array.from({ length: payload.letterCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-slate-950 text-lg font-bold uppercase text-amber-300"
                  >
                    {(answer || '')[idx] || ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );

    case 'mystery_clue':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-xl border border-amber-500/30 bg-slate-950/80 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              Evidence Found at the Scene
            </div>
            <ul className="space-y-1.5 text-sm text-slate-200">
              {(payload.evidence || []).map((ev, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(payload.suspects || []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  sfx.playClick();
                  onChangeAnswer?.(s.id);
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  answer === s.id
                    ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-900/70 hover:border-amber-500/40'
                }`}
              >
                <div className="font-bold text-white">{s.name}</div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{s.alibi}</p>
              </button>
            ))}
          </div>
        </div>
      );

    case 'shape_rotation':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="flex flex-col items-center rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              Target Alignment: {payload.targetDegrees ?? 180}° (Current: {rotation}°)
            </div>
            <div className="relative my-3 flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed border-amber-400/40 bg-slate-900">
              <motion.div
                animate={{ rotate: rotation }}
                transition={{ type: 'spring', stiffness: 180, damping: 16 }}
                className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-500/10"
              >
                <div className="flex flex-col items-center">
                  <div className="h-0 w-0 border-x-8 border-b-[18px] border-x-transparent border-b-amber-400" />
                  <div className="h-8 w-1.5 rounded bg-amber-300" />
                </div>
              </motion.div>
              <span className="absolute bottom-1 text-[10px] font-bold text-emerald-400">SOUTH PIN (180°)</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  const next = (rotation - (payload.stepDegrees || 45) + 360) % 360;
                  setRotation(next);
                  onChangeAnswer?.(String(next));
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:border-amber-400"
              >
                Rotate -{payload.stepDegrees || 45}°
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  const next = (rotation + (payload.stepDegrees || 45)) % 360;
                  setRotation(next);
                  onChangeAnswer?.(String(next));
                }}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                <RotateCw className="h-3.5 w-3.5" /> Rotate +{payload.stepDegrees || 45}°
              </button>
            </div>
          </div>
        </div>
      );

    case 'spot_difference': {
      const spots = payload.spots || [];
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-700 bg-gradient-to-b from-indigo-950 to-slate-950 p-4">
              <div className="mb-2 text-center text-xs font-semibold text-slate-300">Original Mural (Left)</div>
              <svg viewBox="0 0 200 130" className="w-full rounded-xl bg-slate-900/80">
                <circle cx="50" cy="30" r="12" fill="#cbd5e1" />
                <circle cx="140" cy="40" r="3" fill="#fde047" />
                <path d="M10 102 Q 55 88 100 102 T 190 102" fill="none" stroke="#38bdf8" strokeWidth="4" />
                <polygon points="100,45 130,90 70,90" fill="#334155" />
              </svg>
            </div>
            <div className="relative rounded-2xl border border-amber-500/40 bg-gradient-to-b from-indigo-950 to-slate-950 p-4">
              <div className="mb-2 text-center text-xs font-semibold text-amber-300">
                Inspect & Click 3 Differences ({foundSpots.length}/{spots.length})
              </div>
              <div className="relative">
                <svg viewBox="0 0 200 130" className="w-full rounded-xl bg-slate-900/80">
                  <path d="M44 20 A 12 12 0 1 0 58 38 A 9 9 0 1 1 44 20" fill="#fde047" />
                  <polygon points="145,32 148,40 156,40 150,45 152,53 145,48 138,53 140,45 134,40 142,40" fill="#f59e0b" />
                  <path d="M10 102 Q 55 88 95 102" fill="none" stroke="#38bdf8" strokeWidth="4" />
                  <polygon points="100,45 130,90 70,90" fill="#334155" />
                </svg>
                {spots.map((sp) => {
                  const found = foundSpots.includes(sp.id);
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        if (!found) {
                          const next = [...foundSpots, sp.id];
                          setFoundSpots(next);
                          if (next.length === spots.length) {
                            sfx.playCorrect();
                          }
                          onChangeAnswer?.(String(next.length));
                        }
                      }}
                      style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
                      className={`absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition ${
                        found
                          ? 'border-emerald-400 bg-emerald-500/30 shadow-lg shadow-emerald-500/30'
                          : 'border-transparent hover:border-amber-400/60'
                      }`}
                      title={found ? sp.label : 'Inspect area'}
                    >
                      {found && <Check className="mx-auto h-4 w-4 text-emerald-300" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'sequence_arrangement': {
      const tiles = payload.tiles || [];
      const order = payload.shuffledOrder || tiles.map((t) => t.id);
      const tileMap = new Map(tiles.map((t) => [t.id, t]));
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Click tiles in order (lightest → heaviest):</span>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setOrderedTiles([]);
                  onChangeAnswer?.('');
                }}
                className="flex items-center gap-1 text-amber-300 hover:underline"
              >
                <RefreshCw className="h-3 w-3" /> Reset Order
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {order.map((id) => {
                const tile = tileMap.get(id);
                const chosenIdx = orderedTiles.indexOf(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={chosenIdx >= 0}
                    onClick={() => {
                      sfx.playClick();
                      const next = [...orderedTiles, id];
                      setOrderedTiles(next);
                      onChangeAnswer?.(next.join('-'));
                    }}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left text-sm transition ${
                      chosenIdx >= 0
                        ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                        : 'border-slate-800 bg-slate-900 text-white hover:border-amber-400/50'
                    }`}
                  >
                    <span>{tile?.label || id}</span>
                    {chosenIdx >= 0 && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                        #{chosenIdx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    case 'spatial_reasoning': {
      const f = payload.faces || { top: 1, center: 2, bottom: 3, farBottom: 4, left: 5, right: 6 };
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="flex flex-col items-center rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-6">
            <div className="mb-4 grid grid-cols-3 gap-1.5">
              <div />
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 font-bold text-white">{f.top}</div>
              <div />
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 font-bold text-white">{f.left}</div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-amber-400 bg-amber-500/20 font-bold text-amber-200">{f.center}</div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 font-bold text-white">{f.right}</div>
              <div />
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 font-bold text-white">{f.bottom}</div>
              <div />
              <div />
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 font-bold text-white">{f.farBottom}</div>
              <div />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {(payload.options || ['1', '3', '4', '6']).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    onChangeAnswer?.(opt);
                  }}
                  className={`rounded-xl border px-5 py-2 text-sm font-bold transition ${
                    answer === opt
                      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-white hover:border-amber-400'
                  }`}
                >
                  Face {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case 'visual_pattern':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
              {(payload.sequence || []).map((item, idx) => (
                <div key={idx} className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900">
                  <svg viewBox="0 0 48 48" className="h-11 w-11">
                    <ShapeIcon shape={item.shape} color={item.color} />
                  </svg>
                </div>
              ))}
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-500/10 text-xl font-bold text-amber-300">
                ?
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(payload.choices || []).map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    onChangeAnswer?.(ch.id);
                  }}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${
                    answer === ch.id
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : 'border-slate-800 bg-slate-900 hover:border-amber-400/50'
                  }`}
                >
                  <svg viewBox="0 0 48 48" className="h-10 w-10">
                    <ShapeIcon shape={ch.shape} color={ch.color} />
                  </svg>
                  <span className="text-xs font-medium text-slate-200">{ch.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );

    case 'matching': {
      const pairs = payload.pairs || [];
      const rights = [...pairs].reverse();
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5">
            <div className="mb-3 text-xs text-slate-300">
              Select a symbol on the left, then click its matching gemstone on the right ({matchedPairs.length}/{pairs.length} paired).
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {pairs.map((p) => {
                  const done = matchedPairs.includes(p.left);
                  return (
                    <button
                      key={p.left}
                      type="button"
                      disabled={done}
                      onClick={() => {
                        sfx.playClick();
                        setSelectedLeft(p.left);
                      }}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        done
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : selectedLeft === p.left
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-800 bg-slate-900 text-white'
                      }`}
                    >
                      {p.left} {done ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {rights.map((p) => {
                  const done = matchedPairs.includes(p.left);
                  return (
                    <button
                      key={p.right}
                      type="button"
                      disabled={done || !selectedLeft}
                      onClick={() => {
                        const target = pairs.find((pair) => pair.left === selectedLeft);
                        if (target && target.right === p.right) {
                          sfx.playCorrect();
                          const next = [...matchedPairs, target.left];
                          setMatchedPairs(next);
                          setSelectedLeft(null);
                          if (next.length === pairs.length) {
                            onChangeAnswer?.('MATCHED');
                          }
                        } else {
                          sfx.playWrong();
                          setSelectedLeft(null);
                        }
                      }}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        done
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-800 bg-slate-900 text-amber-200 hover:border-amber-400/50 disabled:opacity-60'
                      }`}
                    >
                      {p.right}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case 'picture_puzzle':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/30 bg-slate-950/90 p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Scale className="h-4 w-4" /> Illustrated Gem Balance Scales
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(payload.equations || []).map((eq, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
                  <svg viewBox="0 0 180 70" className="mx-auto mb-2 h-16">
                    <line x1="25" y1="25" x2="155" y2="25" stroke="#f59e0b" strokeWidth="3" />
                    <polygon points="90,25 80,55 100,55" fill="#94a3b8" />
                    <circle cx="40" cy="38" r="11" fill="#f43f5e" />
                    <circle cx="140" cy="38" r="11" fill="#eab308" />
                  </svg>
                  <div className="text-sm font-bold text-white">{eq}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case 'math_teaser':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/30 to-slate-950 p-6 text-center">
            <div className="mx-auto mb-2 text-4xl">🧰</div>
            <div className="text-lg font-extrabold tracking-wide text-amber-200">
              {payload.clue || puzzle.prompt}
            </div>
          </div>
        </div>
      );

    case 'number_sequence':
    case 'number_pattern':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-6">
            {(payload.sequence || []).map((n, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.06 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-400/50 bg-gradient-to-b from-cyan-500/20 to-slate-900 text-lg font-extrabold text-cyan-200 shadow-lg"
              >
                {n}
              </motion.div>
            ))}
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-amber-400 bg-amber-500/15 text-xl font-extrabold text-amber-300">
              ?
            </div>
          </div>
        </div>
      );

    case 'memory_challenge':
    case 'memory_sequence':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="rounded-2xl border border-rose-500/30 bg-slate-950/90 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-300">
                <Eye className="h-4 w-4" /> Lantern Memory Flash
              </span>
              <button
                type="button"
                onClick={() => {
                  sfx.playClick();
                  setMemoryVisible(true);
                  setTimeout(() => setMemoryVisible(false), Number(payload.displayMs) || 3500);
                }}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:border-rose-400"
              >
                Re-flash Lanterns
              </button>
            </div>
            {memoryVisible ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                {(payload.sequence || []).map((token, idx) => (
                  <motion.div
                    key={idx}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ repeat: Infinity, duration: 1.8, delay: idx * 0.2 }}
                    className="rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-rose-500/20 px-4 py-3 text-base font-extrabold text-amber-100 shadow-lg"
                  >
                    🏮 {token}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center text-sm text-slate-300">
                Lanterns dimmed! Enter the sequence initials separated by{' '}
                <strong className="text-amber-300">{payload.separator || '-'}</strong>.
              </div>
            )}
          </div>
        </div>
      );

    case 'observation':
      return (
        <div className="space-y-4">
          {renderCustomImage()}
          <div className="relative h-56 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a1338] to-[#0a0f21] p-4">
            {(payload.items || []).map((item, idx) => (
              <div
                key={idx}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-2xl select-none"
              >
                {item.kind === 'star' ? (item.color === 'gold' ? '⭐' : '✩') : '🌙'}
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return renderCustomImage();
  }
}
