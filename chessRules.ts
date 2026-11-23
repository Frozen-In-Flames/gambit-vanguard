import {PieceType, WeaponDef, PerkDef, ChessPiece} from './types';

export const PIECE_WEAPONS: Record<PieceType, WeaponDef> = {
  pawn: {
    name: 'Pulse Carbine',
    description: 'Rapid-firing tactical energy rifle with high accuracy.',
    damage: 24,
    fireRate: 4.5,
    spread: 0.02,
    projectileSpeed: 38,
    projectileCount: 1,
    color: '#38bdf8',
    ammoMax: 20,
    reloadTime: 1.2,
  },
  knight: {
    name: 'Volt Scattergun',
    description: 'High-impact 5-pellet shotgun devastating at close range.',
    damage: 15, // 15 x 5 = 75 if all hit
    fireRate: 1.6,
    spread: 0.08,
    projectileSpeed: 32,
    projectileCount: 5,
    color: '#a855f7',
    ammoMax: 6,
    reloadTime: 1.6,
  },
  bishop: {
    name: 'Chrono Beam Railgun',
    description: 'Long-range precision beam that pierces with high critical punch.',
    damage: 68,
    fireRate: 1.0,
    spread: 0.005,
    projectileSpeed: 55,
    projectileCount: 1,
    color: '#eab308',
    ammoMax: 4,
    reloadTime: 1.8,
  },
  rook: {
    name: 'Heavy Fortress Mortar',
    description: 'Explosive projectile weapon with heavy splash damage and sturdy armor.',
    damage: 85,
    fireRate: 0.8,
    spread: 0.03,
    projectileSpeed: 28,
    projectileCount: 1,
    color: '#f97316',
    ammoMax: 3,
    reloadTime: 2.0,
  },
  queen: {
    name: 'Twin Plasma Repeaters',
    description: 'Ultra-fast dual plasma cannons raining suppressive fire.',
    damage: 20,
    fireRate: 6.5,
    spread: 0.035,
    projectileSpeed: 42,
    projectileCount: 2,
    color: '#ec4899',
    ammoMax: 30,
    reloadTime: 1.4,
  },
  king: {
    name: 'Imperial Gilded Hand-Cannon',
    description: 'Royal magnum dealing devastating single-shot impact.',
    damage: 75,
    fireRate: 1.4,
    spread: 0.015,
    projectileSpeed: 45,
    projectileCount: 1,
    color: '#facc15',
    ammoMax: 7,
    reloadTime: 1.5,
  },
};

export const AVAILABLE_PERKS: PerkDef[] = [
  {
    id: 'nanite_plating',
    name: 'Nanite Plating',
    icon: 'Shield',
    description: '+30 Max HP and restores all health instantly.',
    apply: (p: ChessPiece) => {
      p.maxHp += 30;
      p.currentHp = p.maxHp;
    },
  },
  {
    id: 'hyper_chamber',
    name: 'Hyper-Chamber',
    icon: 'Zap',
    description: '+25% Weapon Fire Rate & faster cycling.',
    apply: (p: ChessPiece) => {
      // tracked in perks list
    },
  },
  {
    id: 'hollow_point',
    name: 'Hollow-Point Rounds',
    icon: 'Flame',
    description: '+25% Projectile Damage on all hits.',
    apply: (p: ChessPiece) => {
      // tracked in perks list
    },
  },
  {
    id: 'kinetic_thrusters',
    name: 'Kinetic Thrusters',
    icon: 'Wind',
    description: '+20% Arena Movement and strafe speed.',
    apply: (p: ChessPiece) => {
      // tracked in perks list
    },
  },
  {
    id: 'vampiric_core',
    name: 'Vampiric Core',
    icon: 'Activity',
    description: 'Restore +15 HP whenever your shot strikes an enemy.',
    apply: (p: ChessPiece) => {
      // tracked in perks list
    },
  },
  {
    id: 'extended_mag',
    name: 'Extended Capacitor',
    icon: 'BatteryCharging',
    description: '+50% Ammo Magazine capacity & 30% faster reload.',
    apply: (p: ChessPiece) => {
      // tracked in perks list
    },
  },
];
