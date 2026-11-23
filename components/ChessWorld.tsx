import React, {useMemo, useRef, useEffect} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {ChessPiece, DuelContext, Particle, PieceColor} from '../types';
import {DuelInput, DuelSnapshot} from '../net/lan';
import {ChessPieceMesh} from './ChessPieceMesh';
import {ValidMove} from '../chessEngine';
import {PIECE_WEAPONS} from '../chessRules';
import {gameAudio} from '../utils';

interface BoardViewProps {
  pieces: ChessPiece[];
  selectedPieceId: string | null;
  validMoves: ValidMove[];
  onSelectPiece: (piece: ChessPiece) => void;
  onTileClick: (row: number, col: number) => void;
  isAiThinking: boolean;
  /** Color the local player controls (multiplayer guest plays black). */
  myColor?: PieceColor;
  /** View the board from the far side (multiplayer guest). */
  flipped?: boolean;
}

export function BoardView({
  pieces,
  selectedPieceId,
  validMoves,
  onSelectPiece,
  onTileClick,
  isAiThinking,
  myColor = 'white',
  flipped = false,
}: BoardViewProps) {
  const {camera, size, gl} = useThree();

  // Smooth isometric camera angle for board. The distance adapts to
  // the viewport aspect: the fixed framing was tuned on landscape
  // screens, and on a portrait phone the board overflowed the left
  // and right edges, leaving the outer files half off-screen and
  // nearly impossible to tap. Pull back along the same view
  // direction until the full board width fits, with margin.
  useFrame((_, delta) => {
    const dir = new THREE.Vector3(0, 10.5, flipped ? -9.5 : 9.5);
    const baseDist = dir.length();
    let dist = baseDist;
    const pc = camera as THREE.PerspectiveCamera;
    if (pc.isPerspectiveCamera) {
      const aspect = size.width / Math.max(1, size.height);
      const tanHalfHorizontal =
        Math.tan(THREE.MathUtils.degToRad(pc.fov / 2)) * aspect;
      // Board half-width including border is 5.8 units; fit 6.6 so
      // the far rank (narrower in perspective) also clears the edge.
      const fitDist = 6.6 / Math.max(0.05, tanHalfHorizontal);
      dist = Math.min(Math.max(baseDist, fitDist), baseDist * 2.6);
    }
    const targetPos = dir.normalize().multiplyScalar(dist);
    camera.position.lerp(targetPos, Math.min(1, delta * 4));
    camera.lookAt(0, 0, 0);
  });

  // Dev-only playtest hook: project a board square to screen pixels
  // so automated tests can tap pieces exactly where a finger would.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const project = (row: number, col: number) => {
      const v = new THREE.Vector3(
        (col - 3.5) * 1.35,
        0.6,
        (row - 3.5) * 1.35,
      ).project(camera);
      // Page coordinates (the canvas sits below the header), so a
      // test can tap exactly where a finger would land.
      const rect = gl.domElement.getBoundingClientRect();
      return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height,
        behind: v.z > 1,
      };
    };
    (window as any).__GV_PROJECT__ = project;
    return () => {
      // Title backdrop and game board are separate mounts; only
      // remove the hook if it is still this instance's function.
      if ((window as any).__GV_PROJECT__ === project) {
        delete (window as any).__GV_PROJECT__;
      }
    };
  }, [camera, size]);

  const selectedPiece = pieces.find((p) => p.id === selectedPieceId);

  // Pre-generate 8x8 Board Tiles
  const tiles = useMemo(() => {
    const result: {row: number; col: number; x: number; z: number; isDark: boolean}[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Center the 8x8 grid around (0,0) with square width = 1.4 units
        const x = (c - 3.5) * 1.35;
        const z = (r - 3.5) * 1.35;
        const isDark = (r + c) % 2 === 1;
        result.push({row: r, col: c, x, z, isDark});
      }
    }
    return result;
  }, []);

  const moveLookup = useMemo(() => {
    const map = new Map<string, ValidMove>();
    for (const vm of validMoves) {
      map.set(`${vm.row},${vm.col}`, vm);
    }
    return map;
  }, [validMoves]);

  return (
    <group>
      {/* Grand Board Marble Pedestal */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <boxGeometry args={[12.8, 0.8, 12.8]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      {/* Board Gold Bevel Border */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[11.6, 0.08, 11.6]} />
        <meshStandardMaterial
          color="#d97706"
          metalness={0.9}
          roughness={0.2}
          emissive="#b45309"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* 8x8 Chess Tiles */}
      {tiles.map((tile) => {
        const key = `${tile.row},${tile.col}`;
        const move = moveLookup.get(key);
        const isSelectedSquare =
          selectedPiece &&
          selectedPiece.row === tile.row &&
          selectedPiece.col === tile.col;

        let tileColor = tile.isDark ? '#1e293b' : '#e2e8f0';
        let emissive = '#000000';
        let emissiveIntensity = 0;

        if (isSelectedSquare) {
          tileColor = '#0284c7';
          emissive = '#38bdf8';
          emissiveIntensity = 0.6;
        } else if (move) {
          if (move.isCapture) {
            tileColor = '#991b1b';
            emissive = '#ef4444';
            emissiveIntensity = 0.7;
          } else {
            tileColor = '#15803d';
            emissive = '#22c55e';
            emissiveIntensity = 0.5;
          }
        }

        return (
          <mesh
            key={key}
            position={[tile.x, 0.06, tile.z]}
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              onTileClick(tile.row, tile.col);
            }}>
            <boxGeometry args={[1.3, 0.05, 1.3]} />
            <meshStandardMaterial
              color={tileColor}
              roughness={tile.isDark ? 0.35 : 0.25}
              metalness={0.4}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        );
      })}

      {/* Chess Pieces on the Board */}
      {pieces
        .filter((p) => p.alive)
        .map((piece) => {
          const posX = (piece.col - 3.5) * 1.35;
          const posZ = (piece.row - 3.5) * 1.35;
          const isSelected = selectedPieceId === piece.id;
          const moveOnTile = moveLookup.get(`${piece.row},${piece.col}`);
          const isThreat = Boolean(moveOnTile?.isCapture);

          return (
            <group
              key={piece.id}
              position={[posX, 0.08, posZ]}
              onClick={(e) => {
                e.stopPropagation();
                if (moveOnTile) {
                  onTileClick(piece.row, piece.col);
                } else if (piece.color === myColor && !isAiThinking) {
                  onSelectPiece(piece);
                }
              }}>
              {/* Generous invisible tap target: the visible piece
                  meshes are thin, and a fingertip needs close to a
                  full tile of target. The group's onClick receives
                  this mesh's taps like any child mesh. Kept low
                  (1.1 units): a taller proxy on the near rank steals
                  taps aimed at the rank behind it, because its top
                  cap crosses those sight lines. Taller pieces keep
                  their visible mesh as the target above this. */}
              <mesh position={[0, 0.55, 0]}>
                <cylinderGeometry args={[0.62, 0.62, 1.1, 10]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <ChessPieceMesh
                type={piece.type}
                color={piece.color}
                selected={isSelected}
                threat={isThreat}
                scaleMultiplier={1.0}
              />
              {/* Floating Rank / Kill Badge if piece has leveled up */}
              {piece.kills > 0 && (
                <mesh position={[0, 1.9, 0]}>
                  <sphereGeometry args={[0.08, 8, 8]} />
                  <meshBasicMaterial color="#fbbf24" />
                </mesh>
              )}
            </group>
          );
        })}
    </group>
  );
}

// ==============================================================================
// 1V1 FPS ARENA VIEW
// ==============================================================================

interface ArenaViewProps {
  duel: DuelContext;
  onDuelResolved: (winner: 'attacker' | 'defender') => void;
  playerPerks: string[];
  touchMoveDir: {x: number; y: number};
  isTouchFiring: boolean;
  onPlayerHealthUpdate: (current: number, max: number) => void;
  onEnemyHealthUpdate: (current: number, max: number) => void;
  onAmmoUpdate: (ammo: number, maxAmmo: number, reloading: boolean) => void;
  onTimeRemaining: (secs: number) => void;
  /** Enemy-side perk ids (multiplayer: the remote player's perks). */
  enemyPerks?: string[];
  /** 'host' runs the simulation with the enemy driven by remote input. */
  netRole?: 'host';
  remoteInputRef?: {current: DuelInput};
  onNetSnapshot?: (snap: DuelSnapshot) => void;
}

export function ArenaView({
  duel,
  onDuelResolved,
  playerPerks,
  touchMoveDir,
  isTouchFiring,
  onPlayerHealthUpdate,
  onEnemyHealthUpdate,
  onAmmoUpdate,
  onTimeRemaining,
  enemyPerks = [],
  netRole,
  remoteInputRef,
  onNetSnapshot,
}: ArenaViewProps) {
  const {camera, gl} = useThree();

  const playerPiece = duel.playerIsAttacker ? duel.attacker : duel.defender;
  const enemyPiece = duel.playerIsAttacker ? duel.defender : duel.attacker;

  const playerWeapon = PIECE_WEAPONS[playerPiece.type];
  const enemyWeapon = PIECE_WEAPONS[enemyPiece.type];

  // Perks Modifiers
  const hasHyperChamber = playerPerks.includes('hyper_chamber');
  const hasHollowPoint = playerPerks.includes('hollow_point');
  const hasKineticThrusters = playerPerks.includes('kinetic_thrusters');
  const hasVampiricCore = playerPerks.includes('vampiric_core');
  const hasExtendedMag = playerPerks.includes('extended_mag');

  const playerFireInterval =
    1 / (playerWeapon.fireRate * (hasHyperChamber ? 1.3 : 1.0));
  const playerDmgMultiplier = hasHollowPoint ? 1.3 : 1.0;
  const playerSpeedMultiplier = hasKineticThrusters ? 1.25 : 1.0;
  const playerMaxAmmo = Math.round(
    playerWeapon.ammoMax * (hasExtendedMag ? 1.5 : 1.0),
  );
  const playerReloadDuration =
    playerWeapon.reloadTime * (hasExtendedMag ? 0.75 : 1.0);

  // Enemy-side perk modifiers (multiplayer remote player; empty in solo,
  // where the enemy is AI-driven and perkless).
  const hasEnemyHyperChamber = enemyPerks.includes('hyper_chamber');
  const hasEnemyHollowPoint = enemyPerks.includes('hollow_point');
  const hasEnemyKineticThrusters = enemyPerks.includes('kinetic_thrusters');
  const hasEnemyVampiricCore = enemyPerks.includes('vampiric_core');
  const hasEnemyExtendedMag = enemyPerks.includes('extended_mag');
  const enemyFireInterval =
    1 / (enemyWeapon.fireRate * (hasEnemyHyperChamber ? 1.3 : 1.0));
  const enemyDmgMultiplier = hasEnemyHollowPoint ? 1.3 : 1.0;
  const enemySpeedMultiplier = hasEnemyKineticThrusters ? 1.25 : 1.0;
  const enemyMaxAmmo = Math.round(
    enemyWeapon.ammoMax * (hasEnemyExtendedMag ? 1.5 : 1.0),
  );
  const enemyReloadDuration =
    enemyWeapon.reloadTime * (hasEnemyExtendedMag ? 0.75 : 1.0);

  // Combat State Refs
  const playerPos = useRef(new THREE.Vector3(0, 1.1, 10));
  const playerRot = useRef({yaw: 0, pitch: 0});

  // Dev-only playtest hook: lets automated tests read the live camera
  // rotation. import.meta.env.DEV is false in production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__GV_CAM__ = () => ({...playerRot.current, pos: playerPos.current.toArray()});
  }, []);
  const playerHp = useRef(playerPiece.currentHp);
  const enemyHp = useRef(enemyPiece.currentHp);
  const playerMaxHp = useRef(playerPiece.maxHp);
  const enemyMaxHp = useRef(enemyPiece.maxHp);

  const ammo = useRef(playerMaxAmmo);
  const isReloading = useRef(false);
  const reloadTimer = useRef(0);
  const lastPlayerFire = useRef(0);
  const isMouseDown = useRef(false);

  // Enemy AI Combat State
  const enemyPos = useRef(new THREE.Vector3(0, 0, -10));
  const enemyMoveTimer = useRef(0);
  const enemyTargetPos = useRef(new THREE.Vector3(0, 0, -10));
  const enemyLastFire = useRef(0);

  // Remote-controlled enemy state (multiplayer host mode)
  const enemyRot = useRef({yaw: Math.PI, pitch: 0});
  const enemyAmmo = useRef(enemyMaxAmmo);
  const enemyIsReloading = useRef(false);
  const enemyReloadTimer = useRef(0);
  const lastSnapTime = useRef(0);

  // Projectiles & Particles
  const bullets = useRef<
    {
      id: number;
      pos: THREE.Vector3;
      vel: THREE.Vector3;
      color: string;
      radius: number;
      fromPlayer: boolean;
      damage: number;
      life: number;
    }[]
  >([]);
  const nextBulletId = useRef(1);

  const particles = useRef<Particle[]>([]);
  const nextParticleId = useRef(1);

  const arenaTime = useRef(45);
  const duelEnded = useRef(false);

  // Weapon Model Pivot Attached to Player View
  const weaponMeshRef = useRef<THREE.Group>(null);
  const enemyMeshRef = useRef<THREE.Group>(null);
  const muzzleFlash = useRef(0);

  // Mouse Look Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        playerRot.current.yaw -= e.movementX * 0.0022;
        playerRot.current.pitch -= e.movementY * 0.0022;
        playerRot.current.pitch = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, playerRot.current.pitch),
        );
      }
    };

    // Drag look (touch, pen, or mouse without pointer lock): the
    // arena previously had no look input at all off the desktop
    // pointer-lock path. Dragging uses the same convention as the
    // mouse: drag up looks up, drag right looks right.
    let dragLast: {x: number; y: number} | null = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (document.pointerLockElement === gl.domElement) return;
      dragLast = {x: e.clientX, y: e.clientY};
    };
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragLast || document.pointerLockElement === gl.domElement) return;
      const dx = e.clientX - dragLast.x;
      const dy = e.clientY - dragLast.y;
      dragLast = {x: e.clientX, y: e.clientY};
      playerRot.current.yaw -= dx * 0.0042;
      playerRot.current.pitch -= dy * 0.0042;
      playerRot.current.pitch = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, playerRot.current.pitch),
      );
    };
    const handlePointerUp = () => {
      dragLast = null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        if (document.pointerLockElement !== gl.domElement) {
          gl.domElement.requestPointerLock?.();
        }
        isMouseDown.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && ammo.current < playerMaxAmmo && !isReloading.current) {
        isReloading.current = true;
        reloadTimer.current = playerReloadDuration;
        gameAudio.playCrispClick();
      }
    };

    const dom = gl.domElement;
    dom.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      dom.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.();
      }
    };
  }, [gl, playerMaxAmmo, playerReloadDuration]);

  // Keys Map
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  const spawnParticles = (pos: THREE.Vector3, color: string, count = 8) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        id: nextParticleId.current++,
        position: [pos.x, pos.y, pos.z],
        velocity: [
          (Math.random() - 0.5) * 8,
          Math.random() * 6 + 1,
          (Math.random() - 0.5) * 8,
        ],
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        color,
        size: 0.12,
      });
    }
  };

  // Combat Frame Loop
  useFrame((_, delta) => {
    if (duelEnded.current) return;
    const dt = Math.min(delta, 0.1);

    // Countdown Timer
    arenaTime.current -= dt;
    onTimeRemaining(Math.max(0, Math.ceil(arenaTime.current)));
    if (arenaTime.current <= 0) {
      duelEnded.current = true;
      // If time runs out, defender holds the square
      gameAudio.playDefeatMotif();
      onDuelResolved('defender');
      return;
    }

    // Reloading cycle
    if (isReloading.current) {
      reloadTimer.current -= dt;
      if (reloadTimer.current <= 0) {
        isReloading.current = false;
        ammo.current = playerMaxAmmo;
        gameAudio.playCoinPickup();
      }
    }
    onAmmoUpdate(ammo.current, playerMaxAmmo, isReloading.current);

    // 1. WASD + Virtual Touch Movement
    const moveX =
      (keys.current['KeyD'] ? 1 : 0) -
      (keys.current['KeyA'] ? 1 : 0) +
      touchMoveDir.x;
    const moveZ =
      (keys.current['KeyW'] ? 1 : 0) -
      (keys.current['KeyS'] ? 1 : 0) -
      touchMoveDir.y;

    if (moveX !== 0 || moveZ !== 0) {
      const angle = playerRot.current.yaw;
      // Forward in -Z
      const forwardX = -Math.sin(angle);
      const forwardZ = -Math.cos(angle);
      const rightX = Math.cos(angle);
      const rightZ = -Math.sin(angle);

      const speed = 9.0 * playerSpeedMultiplier;
      playerPos.current.x += (rightX * moveX + forwardX * moveZ) * speed * dt;
      playerPos.current.z += (rightZ * moveX + forwardZ * moveZ) * speed * dt;

      // Arena boundary limits (Colosseum radius ~14)
      playerPos.current.x = Math.max(-13, Math.min(13, playerPos.current.x));
      playerPos.current.z = Math.max(-13, Math.min(13, playerPos.current.z));
    }

    // Camera Placement aligned with Player Eye
    camera.position.copy(playerPos.current);
    const forwardVec = new THREE.Vector3(
      -Math.sin(playerRot.current.yaw) * Math.cos(playerRot.current.pitch),
      Math.sin(playerRot.current.pitch),
      -Math.cos(playerRot.current.yaw) * Math.cos(playerRot.current.pitch),
    ).normalize();

    camera.lookAt(playerPos.current.clone().add(forwardVec));

    // Player Shooting
    const wantsToFire = isMouseDown.current || isTouchFiring;
    const now = performance.now() / 1000;
    if (
      wantsToFire &&
      !isReloading.current &&
      now - lastPlayerFire.current >= playerFireInterval
    ) {
      if (ammo.current > 0) {
        ammo.current -= 1;
        lastPlayerFire.current = now;
        muzzleFlash.current = 0.08;

        // Sound based on weapon archetype
        if (playerPiece.type === 'knight') {
          gameAudio.playGunshotBlast();
        } else if (playerPiece.type === 'rook') {
          gameAudio.playChiptuneExplosion();
        } else {
          gameAudio.playArcadeLaser();
        }

        // Spawn Projectile(s)
        const count = playerWeapon.projectileCount;
        for (let i = 0; i < count; i++) {
          const spreadOffset = new THREE.Vector3(
            (Math.random() - 0.5) * playerWeapon.spread * 12,
            (Math.random() - 0.5) * playerWeapon.spread * 12,
            (Math.random() - 0.5) * playerWeapon.spread * 12,
          );
          const dir = forwardVec.clone().add(spreadOffset).normalize();

          bullets.current.push({
            id: nextBulletId.current++,
            pos: playerPos.current.clone().add(dir.clone().multiplyScalar(0.5)),
            vel: dir.multiplyScalar(playerWeapon.projectileSpeed),
            color: playerWeapon.color,
            radius: playerPiece.type === 'rook' ? 0.35 : 0.15,
            fromPlayer: true,
            damage: playerWeapon.damage * playerDmgMultiplier,
            life: 2.5,
          });
        }

        if (ammo.current === 0) {
          isReloading.current = true;
          reloadTimer.current = playerReloadDuration;
        }
      } else {
        isReloading.current = true;
        reloadTimer.current = playerReloadDuration;
        gameAudio.playCrispClick();
      }
    }

    if (netRole === 'host') {
      // 2H. Remote-controlled enemy (multiplayer guest's combatant)
      const input: DuelInput = remoteInputRef?.current ?? {
        moveX: 0,
        moveZ: 0,
        yaw: Math.PI,
        pitch: 0,
        firing: false,
        reload: false,
      };
      enemyRot.current.yaw = input.yaw;
      enemyRot.current.pitch = input.pitch;

      if (enemyIsReloading.current) {
        enemyReloadTimer.current -= dt;
        if (enemyReloadTimer.current <= 0) {
          enemyIsReloading.current = false;
          enemyAmmo.current = enemyMaxAmmo;
        }
      }
      if (
        input.reload &&
        enemyAmmo.current < enemyMaxAmmo &&
        !enemyIsReloading.current
      ) {
        enemyIsReloading.current = true;
        enemyReloadTimer.current = enemyReloadDuration;
      }

      if (input.moveX !== 0 || input.moveZ !== 0) {
        const angle = enemyRot.current.yaw;
        const forwardX = -Math.sin(angle);
        const forwardZ = -Math.cos(angle);
        const rightX = Math.cos(angle);
        const rightZ = -Math.sin(angle);
        const speed = 9.0 * enemySpeedMultiplier;
        enemyPos.current.x +=
          (rightX * input.moveX + forwardX * input.moveZ) * speed * dt;
        enemyPos.current.z +=
          (rightZ * input.moveX + forwardZ * input.moveZ) * speed * dt;
        enemyPos.current.x = Math.max(-13, Math.min(13, enemyPos.current.x));
        enemyPos.current.z = Math.max(-13, Math.min(13, enemyPos.current.z));
      }

      if (enemyMeshRef.current) {
        enemyMeshRef.current.position.copy(enemyPos.current);
        const fwd = new THREE.Vector3(
          -Math.sin(enemyRot.current.yaw),
          0,
          -Math.cos(enemyRot.current.yaw),
        );
        enemyMeshRef.current.lookAt(enemyPos.current.clone().add(fwd));
      }

      if (
        input.firing &&
        !enemyIsReloading.current &&
        now - enemyLastFire.current >= enemyFireInterval
      ) {
        if (enemyAmmo.current > 0) {
          enemyAmmo.current -= 1;
          enemyLastFire.current = now;
          if (enemyPiece.type === 'knight') {
            gameAudio.playGunshotBlast();
          } else if (enemyPiece.type === 'rook') {
            gameAudio.playChiptuneExplosion();
          } else {
            gameAudio.playArcadeLaser();
          }
          const dir = new THREE.Vector3(
            -Math.sin(enemyRot.current.yaw) * Math.cos(enemyRot.current.pitch),
            Math.sin(enemyRot.current.pitch),
            -Math.cos(enemyRot.current.yaw) * Math.cos(enemyRot.current.pitch),
          ).normalize();
          const count = enemyWeapon.projectileCount;
          for (let i = 0; i < count; i++) {
            const spreadOffset = new THREE.Vector3(
              (Math.random() - 0.5) * enemyWeapon.spread * 12,
              (Math.random() - 0.5) * enemyWeapon.spread * 12,
              (Math.random() - 0.5) * enemyWeapon.spread * 12,
            );
            const bulletDir = dir.clone().add(spreadOffset).normalize();
            bullets.current.push({
              id: nextBulletId.current++,
              pos: enemyPos.current
                .clone()
                .add(new THREE.Vector3(0, 1.1, 0))
                .add(bulletDir.clone().multiplyScalar(0.5)),
              vel: bulletDir.multiplyScalar(enemyWeapon.projectileSpeed),
              color: enemyWeapon.color,
              radius: enemyPiece.type === 'rook' ? 0.35 : 0.15,
              fromPlayer: false,
              damage: enemyWeapon.damage * enemyDmgMultiplier,
              life: 2.5,
            });
          }
          if (enemyAmmo.current === 0) {
            enemyIsReloading.current = true;
            enemyReloadTimer.current = enemyReloadDuration;
          }
        } else {
          enemyIsReloading.current = true;
          enemyReloadTimer.current = enemyReloadDuration;
        }
      }
    } else {
    // 2. Enemy AI Movement & Strafe
    enemyMoveTimer.current -= dt;
    if (enemyMoveTimer.current <= 0) {
      enemyMoveTimer.current = 1.0 + Math.random() * 1.5;
      // Strafe around player at distance ~10-15
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 6;
      enemyTargetPos.current.set(
        playerPos.current.x + Math.cos(angle) * dist,
        0,
        playerPos.current.z + Math.sin(angle) * dist,
      );
      enemyTargetPos.current.x = Math.max(-12, Math.min(12, enemyTargetPos.current.x));
      enemyTargetPos.current.z = Math.max(-12, Math.min(12, enemyTargetPos.current.z));
    }
    enemyPos.current.lerp(enemyTargetPos.current, dt * 2.2);

    if (enemyMeshRef.current) {
      enemyMeshRef.current.position.copy(enemyPos.current);
      // Face the player
      enemyMeshRef.current.lookAt(
        playerPos.current.x,
        enemyPos.current.y,
        playerPos.current.z,
      );
    }

    // Enemy Shooting
    const enemyInterval = 1 / (enemyWeapon.fireRate * 0.7); // AI shoots slightly more spaced
    if (now - enemyLastFire.current >= enemyInterval) {
      enemyLastFire.current = now;
      const aimDir = playerPos.current
        .clone()
        .sub(enemyPos.current.clone().setY(1.0))
        .normalize();

      // Small aim jitter
      aimDir.x += (Math.random() - 0.5) * 0.1;
      aimDir.y += (Math.random() - 0.5) * 0.1;
      aimDir.z += (Math.random() - 0.5) * 0.1;
      aimDir.normalize();

      bullets.current.push({
        id: nextBulletId.current++,
        pos: enemyPos.current.clone().add(new THREE.Vector3(0, 1.0, 0)),
        vel: aimDir.multiplyScalar(enemyWeapon.projectileSpeed * 0.8),
        color: '#f43f5e',
        radius: 0.18,
        fromPlayer: false,
        damage: enemyWeapon.damage * 0.65,
        life: 3.0,
      });
      gameAudio.playArcadeLaser();
    }
    }

    // 3. Bullets Physics & Hit Detection
    for (let i = bullets.current.length - 1; i >= 0; i--) {
      const b = bullets.current[i];
      b.life -= dt;
      b.pos.addScaledVector(b.vel, dt);

      // Hit Ground / Outer Walls
      if (b.pos.y <= 0 || b.pos.length() > 18) {
        spawnParticles(b.pos, b.color, 4);
        bullets.current.splice(i, 1);
        continue;
      }

      if (b.fromPlayer) {
        // Check hit on Enemy piece (hitbox radius ~1.0, height ~1.8)
        const distXZ = Math.hypot(b.pos.x - enemyPos.current.x, b.pos.z - enemyPos.current.z);
        if (distXZ < 0.9 && b.pos.y >= 0 && b.pos.y <= 2.2) {
          enemyHp.current -= b.damage;
          spawnParticles(b.pos, '#f43f5e', 10);
          gameAudio.playMeleePunch();

          if (hasVampiricCore) {
            playerHp.current = Math.min(
              playerMaxHp.current,
              playerHp.current + 15,
            );
            onPlayerHealthUpdate(playerHp.current, playerMaxHp.current);
          }

          onEnemyHealthUpdate(
            Math.max(0, enemyHp.current),
            enemyMaxHp.current,
          );
          bullets.current.splice(i, 1);

          if (enemyHp.current <= 0) {
            duelEnded.current = true;
            spawnParticles(enemyPos.current, '#fbbf24', 35);
            gameAudio.playLevelUpStinger();
            const winner = duel.playerIsAttacker ? 'attacker' : 'defender';
            onDuelResolved(winner);
            return;
          }
          continue;
        }
      } else {
        // Check hit on Player (player eye at y=1.1, hitbox radius ~0.6)
        const distToPlayer = b.pos.distanceTo(playerPos.current);
        if (distToPlayer < 0.8) {
          playerHp.current -= b.damage;
          if (hasEnemyVampiricCore) {
            enemyHp.current = Math.min(
              enemyMaxHp.current,
              enemyHp.current + 15,
            );
            onEnemyHealthUpdate(enemyHp.current, enemyMaxHp.current);
          }
          spawnParticles(playerPos.current, '#ef4444', 8);
          gameAudio.playShieldBlock();
          onPlayerHealthUpdate(
            Math.max(0, playerHp.current),
            playerMaxHp.current,
          );
          bullets.current.splice(i, 1);

          if (playerHp.current <= 0) {
            duelEnded.current = true;
            gameAudio.playDefeatMotif();
            const winner = duel.playerIsAttacker ? 'defender' : 'attacker';
            onDuelResolved(winner);
            return;
          }
          continue;
        }
      }

      if (b.life <= 0) {
        bullets.current.splice(i, 1);
      }
    }

    // 4. Update Particles
    for (let pIdx = particles.current.length - 1; pIdx >= 0; pIdx--) {
      const p = particles.current[pIdx];
      p.life -= dt;
      p.position[0] += (p.velocity?.[0] || 0) * dt;
      p.position[1] += (p.velocity?.[1] || 0) * dt;
      p.position[2] += (p.velocity?.[2] || 0) * dt;
      if (p.life <= 0) {
        particles.current.splice(pIdx, 1);
      }
    }

    // Multiplayer: stream the duel state to the guest (~20 Hz)
    if (netRole === 'host' && onNetSnapshot && now - lastSnapTime.current >= 0.05) {
      lastSnapTime.current = now;
      onNetSnapshot({
        t: now,
        hostPos: playerPos.current.toArray() as [number, number, number],
        hostRot: {...playerRot.current},
        hostHp: Math.max(0, playerHp.current),
        guestPos: enemyPos.current.toArray() as [number, number, number],
        guestRot: {...enemyRot.current},
        guestHp: Math.max(0, enemyHp.current),
        guestAmmo: enemyAmmo.current,
        guestMaxAmmo: enemyMaxAmmo,
        guestMaxHp: enemyMaxHp.current,
        guestReloading: enemyIsReloading.current,
        hostAmmo: ammo.current,
        hostMaxAmmo: playerMaxAmmo,
        hostMaxHp: playerMaxHp.current,
        hostReloading: isReloading.current,
        timeLeft: Math.max(0, arenaTime.current),
        bullets: bullets.current.map((b) => ({
          id: b.id,
          pos: b.pos.toArray() as [number, number, number],
          vel: b.vel.toArray() as [number, number, number],
          color: b.color,
          radius: b.radius,
          fromHost: b.fromPlayer,
        })),
      });
    }

    // Weapon Animation & Muzzle Flare
    if (weaponMeshRef.current) {
      weaponMeshRef.current.position.set(0.28, -0.22, -0.55);
      if (muzzleFlash.current > 0) {
        muzzleFlash.current -= dt;
        weaponMeshRef.current.position.z += 0.05; // weapon kickback
      }
    }
  });

  return (
    <group>
      {/* Colosseum Arena Floor */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[16, 17, 0.4, 32]} />
        <meshStandardMaterial
          color="#1e1b4b"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      {/* Perimeter Colosseum Pillars */}
      {Array.from({length: 16}).map((_, i) => {
        const rad = (i / 16) * Math.PI * 2;
        const x = Math.cos(rad) * 15.5;
        const z = Math.sin(rad) * 15.5;
        return (
          <group key={i} position={[x, 2.5, z]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.6, 0.7, 5.5, 12]} />
              <meshStandardMaterial color="#312e81" roughness={0.7} />
            </mesh>
            <mesh position={[0, 2.8, 0]} castShadow>
              <boxGeometry args={[1.6, 0.4, 1.6]} />
              <meshStandardMaterial color="#4f46e5" metalness={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* Arena Cover Blocks */}
      {[-5, 5].map((x) =>
        [-4, 4].map((z) => (
          <mesh
            key={`${x}_${z}`}
            position={[x, 1.0, z]}
            castShadow
            receiveShadow>
            <boxGeometry args={[1.8, 2.0, 1.8]} />
            <meshStandardMaterial color="#4338ca" roughness={0.6} />
          </mesh>
        )),
      )}

      {/* Enemy 3D Chess Piece Model in Arena */}
      <group ref={enemyMeshRef} position={[0, 0, -10]}>
        <ChessPieceMesh
          type={enemyPiece.type}
          color={enemyPiece.color}
          scaleMultiplier={1.4}
        />
      </group>

      {/* First-Person Weapon Model attached to Camera */}
      <group position={camera.position} rotation={camera.rotation}>
        <group ref={weaponMeshRef}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.1, 0.45]} />
            <meshStandardMaterial
              color={playerWeapon.color}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          {/* Barrel & Energy Core */}
          <mesh position={[0, 0.02, -0.28]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 0.22, 12]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive={playerWeapon.color}
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      </group>

      {/* Active Bullets */}
      {bullets.current.map((b) => (
        <mesh key={b.id} position={[b.pos.x, b.pos.y, b.pos.z]}>
          <sphereGeometry args={[b.radius, 8, 8]} />
          <meshBasicMaterial color={b.color} />
        </mesh>
      ))}

      {/* Spark Particle Splatters */}
      {particles.current.map((p) => (
        <mesh
          key={p.id}
          position={[p.position[0], p.position[1], p.position[2]]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshBasicMaterial color={p.color || '#fbbf24'} />
        </mesh>
      ))}
    </group>
  );
}
