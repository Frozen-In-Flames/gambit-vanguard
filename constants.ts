import {MusicTrack} from './utils/helper';

/** Game configuration schema. */
export const CONFIG = {
  // --- Game ---
  title: {
    value: 'Gambit Vanguard',
    type: 'string',
    label: 'Game Title',
    group: 'Game',
  },

  // --- Camera ---
  fov: {
    value: 65,
    type: 'number',
    label: 'Field of View',
    group: 'Camera',
    min: 40,
    max: 100,
    step: 5,
  },
  cameraX: {
    value: 0,
    type: 'number',
    label: 'Camera X',
    group: 'Camera',
  },
  cameraY: {
    value: 12,
    type: 'number',
    label: 'Camera Y',
    group: 'Camera',
  },
  cameraZ: {
    value: 14,
    type: 'number',
    label: 'Camera Z',
    group: 'Camera',
  },

  // --- Visuals & Theme ---
  backgroundColor: {
    value: '#080812',
    type: 'color',
    label: 'Background Color',
    group: 'Visuals',
  },
  ambientColor: {
    value: '#3a4055',
    type: 'color',
    label: 'Ambient Light Color',
    group: 'Visuals',
  },
  ambientIntensity: {
    value: 1.6,
    type: 'number',
    label: 'Ambient Intensity',
    group: 'Visuals',
    min: 0.5,
    max: 5,
    step: 0.1,
  },
  sunColor: {
    value: '#fff6e5',
    type: 'color',
    label: 'Sun Color',
    group: 'Visuals',
  },
  sunIntensity: {
    value: 3.2,
    type: 'number',
    label: 'Sun Intensity',
    group: 'Visuals',
    min: 1.0,
    max: 8,
    step: 0.2,
  },
  hemiSkyColor: {
    value: '#38bdf8',
    type: 'color',
    label: 'Hemisphere Sky Color',
    group: 'Visuals',
  },
  hemiGroundColor: {
    value: '#1e1b4b',
    type: 'color',
    label: 'Hemisphere Ground Color',
    group: 'Visuals',
  },
  hemiIntensity: {
    value: 0.8,
    type: 'number',
    label: 'Hemisphere Intensity',
    group: 'Visuals',
    min: 0,
    max: 2,
    step: 0.1,
  },

  // --- Rules & Gameplay Balancing ---
  playerBaseHp: {
    value: 100,
    type: 'number',
    label: 'Player Base HP',
    group: 'Rules',
    min: 50,
    max: 200,
    step: 10,
  },
  enemyBaseHp: {
    value: 90,
    type: 'number',
    label: 'Enemy Base HP',
    group: 'Rules',
    min: 40,
    max: 180,
    step: 10,
  },
  playerSpeed: {
    value: 8.5,
    type: 'number',
    label: 'Player Speed',
    group: 'Physics',
    min: 5.0,
    max: 14.0,
    step: 0.5,
  },
  mouseSensitivity: {
    value: 1.8,
    type: 'number',
    label: 'Mouse Look Sensitivity',
    group: 'Camera',
    min: 0.5,
    max: 4.0,
    step: 0.1,
  },
  arenaRoundSeconds: {
    value: 45,
    type: 'number',
    label: 'Duel Arena Time Limit',
    group: 'Rules',
    min: 20,
    max: 90,
    step: 5,
  },

  // --- Physics ---
  gravity: {
    value: -18,
    type: 'number',
    label: 'Gravity',
    group: 'Physics',
    min: -30,
    max: -5,
    step: 1,
  },

  // --- System ---
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'System',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'System',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'System',
  },

  // --- Audio ---
  backgroundMusicUrl: {
    value: '', // Score is synthesized in-engine (utils/BackgroundMusic.tsx); no external file.
    type: 'string',
    label: 'Background Music URL',
    group: 'Audio',
  },
};

// Merge customized config values if present (injected by host)
const {hostConfig} = globalThis as {
  hostConfig?: Record<string, unknown>;
};
if (hostConfig) {
  for (const [key, value] of Object.entries(hostConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

/** Optional presets for the game. */
export const PRESETS = {};

/** Background music tracks available for the game to use. */
export const AVAILABLE_MUSIC_TRACKS: readonly MusicTrack[] = [
  {
    name: 'gambit_vanguard_theme',
    url: '',
    description:
      'The Gambit Vanguard theme, composed with VariTheory (D natural minor, 100 BPM) and synthesized live in-engine. Source: music/gambit-vanguard-theme.mid.',
  },
];
