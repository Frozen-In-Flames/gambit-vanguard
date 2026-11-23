import {useEffect, useRef} from 'react';
import {
  THEME_BASS,
  THEME_BEATS,
  THEME_BPM,
  THEME_CHORDS,
  THEME_DRUMS,
  THEME_LEAD,
} from '../music/theme';

/**
 * Background music for Gambit Vanguard.
 *
 * The score is the Gambit Vanguard theme composed by VariTheory
 * (see music/theme.ts and music/gambit-vanguard-theme.mid): a
 * 16-bar loop in D natural minor at 100 BPM with lead, chords,
 * bass and cadence-driven drums. Playback is synthesized live
 * with the Web Audio API on the player's device; there is no
 * audio file and no network fetch.
 */

export interface BackgroundMusicProps {
  /** Legacy prop kept for interface compatibility; the score is
   *  generated locally and no URL is ever fetched. */
  readonly url?: string;
  /** Whether playback is currently active. */
  readonly isPlaying: boolean;
  /** Whether the audio output is muted. Defaults to false. */
  readonly isMuted?: boolean;
  /** Master volume level between 0.0 (silent) and 1.0 (full). Defaults to 0.15. */
  readonly volume?: number;
}

type StemKind = 'bass' | 'chords' | 'lead' | 'drums';

interface Engine {
  ctx: AudioContext;
  master: GainNode;
  timer: number;
  loopStart: number;
  idx: Record<StemKind, number>;
  noiseBuffer: AudioBuffer;
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function kick(engine: Engine, time: number, vel: number) {
  const {ctx, master} = engine;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  gain.gain.setValueAtTime(0.55 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
  osc.connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + 0.18);
}

function snare(engine: Engine, time: number, vel: number) {
  const {ctx, master} = engine;
  const src = ctx.createBufferSource();
  src.buffer = engine.noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
  src.connect(filter).connect(gain).connect(master);
  src.start(time);
  src.stop(time + 0.13);
}

function hat(engine: Engine, time: number, vel: number) {
  const {ctx, master} = engine;
  const src = ctx.createBufferSource();
  src.buffer = engine.noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(filter).connect(gain).connect(master);
  src.start(time);
  src.stop(time + 0.05);
}

function clave(engine: Engine, time: number, vel: number) {
  const {ctx, master} = engine;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1750;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.32 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
  osc.connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + 0.08);
}

function bassNote(engine: Engine, time: number, midi: number, durSec: number, vel: number) {
  const {ctx, master} = engine;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = midiToFreq(midi);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.34 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.12, durSec));
  osc.connect(filter).connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + Math.max(0.12, durSec) + 0.02);
}

function chordNote(engine: Engine, time: number, midi: number, durSec: number, vel: number) {
  const {ctx, master} = engine;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiToFreq(midi);
  const gain = ctx.createGain();
  const peak = 0.14 * vel;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.08);
  gain.gain.setValueAtTime(peak, time + Math.max(0.09, durSec - 0.08));
  gain.gain.linearRampToValueAtTime(0, time + durSec);
  osc.connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + durSec + 0.02);
}

function leadNote(engine: Engine, time: number, midi: number, durSec: number, vel: number) {
  const {ctx, master} = engine;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = midiToFreq(midi);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;
  const gain = ctx.createGain();
  const len = Math.min(Math.max(0.1, durSec), 0.42);
  gain.gain.setValueAtTime(0.2 * vel, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + len);
  osc.connect(filter).connect(gain).connect(master);
  osc.start(time);
  osc.stop(time + len + 0.02);
}

function playNote(
  engine: Engine,
  kind: StemKind,
  note: number[],
  time: number,
  spb: number,
) {
  if (kind === 'drums') {
    const [, drum, vel] = note;
    if (drum === 36) kick(engine, time, vel);
    else if (drum === 38) snare(engine, time, vel);
    else if (drum === 42) hat(engine, time, vel);
    else if (drum === 75) clave(engine, time, vel);
    return;
  }
  const [, midi, durBeats, vel] = note;
  const durSec = durBeats * spb;
  if (kind === 'bass') bassNote(engine, time, midi, durSec, vel);
  else if (kind === 'chords') chordNote(engine, time, midi, durSec, vel);
  else leadNote(engine, time, midi, durSec, vel);
}

const STEMS: {kind: StemKind; notes: number[][]}[] = [
  {kind: 'bass', notes: THEME_BASS},
  {kind: 'chords', notes: THEME_CHORDS},
  {kind: 'lead', notes: THEME_LEAD},
  {kind: 'drums', notes: THEME_DRUMS},
];

function scheduleWindow(engine: Engine) {
  const spb = 60 / THEME_BPM;
  const loopSec = THEME_BEATS * spb;
  const horizon = engine.ctx.currentTime + 0.22;
  for (;;) {
    const loopEnd = engine.loopStart + loopSec;
    const upto = Math.min(horizon, loopEnd);
    for (const {kind, notes} of STEMS) {
      let i = engine.idx[kind];
      while (i < notes.length) {
        const t = engine.loopStart + notes[i][0] * spb;
        if (t > upto) break;
        if (t >= engine.ctx.currentTime - 0.05) {
          playNote(engine, kind, notes[i], t, spb);
        }
        i++;
      }
      engine.idx[kind] = i;
    }
    if (horizon <= loopEnd) break;
    engine.loopStart = loopEnd;
    engine.idx = {bass: 0, chords: 0, lead: 0, drums: 0};
  }
}

function startEngine(volume: number): Engine {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  const engine: Engine = {
    ctx,
    master,
    timer: 0,
    loopStart: ctx.currentTime + 0.06,
    idx: {bass: 0, chords: 0, lead: 0, drums: 0},
    noiseBuffer: createNoiseBuffer(ctx),
  };
  engine.timer = window.setInterval(() => scheduleWindow(engine), 90);
  return engine;
}

export function BackgroundMusic({
  isPlaying,
  isMuted = false,
  volume = 0.15,
}: BackgroundMusicProps) {
  const engineRef = useRef<Engine | null>(null);
  const stateRef = useRef({isPlaying, isMuted, volume});
  stateRef.current = {isPlaying, isMuted, volume};

  useEffect(() => {
    const ensureEngine = () => {
      const {isPlaying: playing, isMuted: muted, volume: vol} = stateRef.current;
      if (!playing) return;
      if (!engineRef.current) {
        engineRef.current = startEngine(vol);
      }
      const engine = engineRef.current;
      void engine.ctx.resume();
      engine.master.gain.setTargetAtTime(
        muted ? 0 : vol,
        engine.ctx.currentTime,
        0.1,
      );
    };
    ensureEngine();
    // Browsers gate audio behind a user gesture; arm the engine on
    // the first interaction so the title screen music can start.
    const onGesture = () => ensureEngine();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, [isPlaying, isMuted, volume]);

  useEffect(() => {
    return () => {
      const engine = engineRef.current;
      if (engine) {
        window.clearInterval(engine.timer);
        void engine.ctx.close();
        engineRef.current = null;
      }
    };
  }, []);

  return null;
}

export default BackgroundMusic;
