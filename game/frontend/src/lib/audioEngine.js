// Original procedural Web Audio API synthesizer for CodeHeist Puzzle Adventure
// Produces atmospheric background music and crisp game SFX without external audio dependencies.

class AdventureAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.musicPlaying = false;
    this.musicEnabled = false;
    this.sfxEnabled = true;
    this.volume = 0.55;
    this.stepIndex = 0;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.volume;
      this.musicGain.gain.value = this.musicEnabled ? 0.22 : 0;
      this.sfxGain.gain.value = this.sfxEnabled ? 0.7 : 0;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number(val)));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setSfxEnabled(enabled) {
    this.sfxEnabled = Boolean(enabled);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? 0.7 : 0, this.ctx.currentTime, 0.03);
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.22 : 0, ctx.currentTime, 0.15);
    }
    if (this.musicEnabled && !this.musicPlaying) {
      this.startAmbientLoop();
    } else if (!this.musicEnabled && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
      this.musicPlaying = false;
    }
  }

  playTone(freq, duration = 0.2, type = 'sine', gainVal = 0.25, delay = 0, target = 'sfx') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (target === 'sfx' && !this.sfxEnabled) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainVal), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(target === 'music' ? this.musicGain : this.sfxGain);

    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  startAmbientLoop() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    // Mysterious D-minor pentatonic arpeggio + warm pad
    const melody = [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63];
    const bass = [146.83, 146.83, 174.61, 174.61, 130.81, 130.81, 164.81, 146.83];

    const tickMusic = () => {
      if (!this.musicEnabled) return;
      const i = this.stepIndex % melody.length;
      this.playTone(melody[i], 0.9, 'triangle', 0.18, 0, 'music');
      if (i % 2 === 0) {
        this.playTone(bass[i], 1.6, 'sine', 0.22, 0, 'music');
      }
      this.stepIndex += 1;
    };

    tickMusic();
    this.musicTimer = setInterval(tickMusic, 850);
  }

  playClick() {
    this.playTone(680, 0.045, 'triangle', 0.16);
    this.playTone(980, 0.03, 'sine', 0.08, 0.01);
  }

  playPuzzleAppear() {
    [392, 493.88, 587.33, 783.99].forEach((f, idx) => {
      this.playTone(f, 0.22, 'sine', 0.16, idx * 0.06);
    });
  }

  playCorrect() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this.playTone(f, 0.24, 'triangle', 0.24, idx * 0.07);
    });
  }

  playWrong() {
    this.playTone(196, 0.18, 'sawtooth', 0.14, 0);
    this.playTone(155.56, 0.26, 'triangle', 0.18, 0.09);
  }

  playTick() {
    this.playTone(1150, 0.035, 'square', 0.07);
  }

  playDoorUnlock() {
    this.playTone(220, 0.08, 'square', 0.14, 0);
    this.playTone(330, 0.1, 'triangle', 0.18, 0.08);
    this.playTone(440, 0.35, 'sine', 0.24, 0.16);
    this.playTone(659.25, 0.4, 'sine', 0.2, 0.2);
  }

  playChestOpen() {
    [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, idx) => {
      this.playTone(f, 0.28, 'sine', 0.22, idx * 0.055);
    });
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 1046.5];
    const times = [0, 0.1, 0.2, 0.32, 0.46, 0.6];
    notes.forEach((n, idx) => this.playTone(n, 0.35, 'triangle', 0.25, times[idx]));
  }

  playGameOver() {
    [392, 349.23, 311.13, 261.63].forEach((f, idx) => {
      this.playTone(f, 0.34, 'triangle', 0.2, idx * 0.16);
    });
  }

  playLevelUp() {
    [440, 554.37, 659.25, 880, 1108.73, 1318.51].forEach((f, idx) => {
      this.playTone(f, 0.32, 'sine', 0.24, idx * 0.07);
    });
  }
}

export const audioEngine = new AdventureAudioEngine();
