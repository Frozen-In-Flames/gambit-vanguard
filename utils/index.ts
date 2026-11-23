/**
 * @fileoverview Canonical barrel export for shared host utilities.
 *
 * Re-exports all shared helpers, components, and types from `./BackgroundMusic`,
 * `./helper`, and `./host` so imports from `./utils` or `../utils`
 * resolve cleanly when `utils/` is a directory.
 */

export {
  BackgroundMusic,
  type BackgroundMusicProps,
} from './BackgroundMusic';
export {
  MenuOverlay,
  Overlay,
  clamp,
  createFixedStepper,
  drawAsset,
  drawBackground,
  formatTime,
  gameAudio,
  prepareCanvas,
  shuffle,
  useAssets,
  useAutoFocus,
  useInput,
  useIsMobile,
  type Entity,
  type GamePhase,
  type GameState,
  type InputAction,
  type InputSnapshot,
  type MenuOverlayProps,
  type MusicTrack,
  type PointerState,
  type Position,
  type SpriteConfig,
} from './helper';
export {
  getHostBootState,
  useHost,
  useHostGameLifecycle,
  useHostResume,
  useRpc,
  type BaseGameState,
  type BooleanConfigEntry,
  type ColorConfigEntry,
  type ConfigEntry,
  type ConfigValues,
  type GameConfig,
  type HostBootState,
  type NumberConfigEntry,
  type HostBootState,
  type HostResumeState,
  type SelectConfigEntry,
  type UseHostResumeOptions,
  type Vector2ConfigEntry,
} from './host';
