import { createContext, useContext, useState } from 'react';
import { audioEngine } from '../lib/audioEngine';

const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const [musicEnabled, setMusicState] = useState(false);
  const [sfxEnabled, setSfxState] = useState(true);
  const [volume, setVolumeState] = useState(0.55);

  const toggleMusic = () => {
    const next = !musicEnabled;
    setMusicState(next);
    audioEngine.setMusicEnabled(next);
  };

  const toggleSfx = () => {
    const next = !sfxEnabled;
    setSfxState(next);
    audioEngine.setSfxEnabled(next);
    if (next) audioEngine.playClick();
  };

  const setVolume = (val) => {
    const v = Number(val);
    setVolumeState(v);
    audioEngine.setVolume(v);
  };

  return (
    <AudioContext.Provider
      value={{
        musicEnabled,
        sfxEnabled,
        volume,
        toggleMusic,
        toggleSfx,
        setVolume,
        sfx: audioEngine,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  return useContext(AudioContext);
}
