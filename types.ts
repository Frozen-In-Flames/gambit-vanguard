/** 3D Vector. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 3D Position as a tuple. */
export type Position3D = [number, number, number];

/** Represents an object in the 3D scene. */
export interface Entity3D {
  id: string | number;
  type?: string;
  position: Vec3 | Position3D;
  rotation?: Vec3 | Position3D;
  scale?: Vec3 | Position3D;
  velocity?: Vec3;
  active?: boolean;
  [key: string]: any;
}

/** Represents a particle in a particle system. */
export interface Particle {
  id: string | number;
  position: Vec3 | Position3D;
  velocity?: Vec3 | Position3D;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
  [key: string]: any;
}

export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';
export type PieceColor = 'white' | 'black';

export interface WeaponDef {
  name: string;
  description: string;
  damage: number;
  fireRate: number; // shots per sec
  spread: number;
  projectileSpeed: number;
  projectileCount: number; // for shotgun/scatter
  color: string;
  ammoMax: number;
  reloadTime: number;
}

export interface ChessPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number; // 0..7
  col: number; // 0..7
  alive: boolean;
  perks: string[];
  maxHp: number;
  currentHp: number;
  kills: number;
}

export interface PerkDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  apply: (piece: ChessPiece) => void;
}

export interface DuelContext {
  attacker: ChessPiece;
  defender: ChessPiece;
  targetRow: number;
  targetCol: number;
  playerIsAttacker: boolean;
}

export interface Bullet {
  id: number;
  pos: Vec3;
  vel: Vec3;
  color: string;
  radius: number;
  fromPlayer: boolean;
  damage: number;
  life: number;
}
