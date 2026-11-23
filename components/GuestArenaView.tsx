import React, {useEffect, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {ChessPiece} from '../types';
import {ChessPieceMesh} from './ChessPieceMesh';
import {PIECE_WEAPONS} from '../chessRules';
import {DuelInput, DuelSnapshot} from '../net/lan';

interface GuestArenaViewProps {
  myPiece: ChessPiece;
  foePiece: ChessPiece;
  touchMoveDir: {x: number; y: number};
  isTouchFiring: boolean;
  /** Latest duel snapshot from the host, with local receive time (ms). */
  snapshotRef: {current: {snap: DuelSnapshot; at: number} | null};
  /** The guest's live input, streamed to the host by the App. */
  inputRef: {current: DuelInput};
}

const BULLET_POOL = 72;

/**
 * The multiplayer guest's arena. The host runs the duel simulation;
 * this view renders the host's snapshots (combatant positions are
 * smoothed, projectiles are extrapolated along their velocity, which
 * is exact for straight-line fire) and captures the guest's own
 * look/move/fire input for streaming back to the host. The guest's
 * camera is first-person from their own piece.
 */
export function GuestArenaView({
  myPiece,
  foePiece,
  touchMoveDir,
  isTouchFiring,
  snapshotRef,
  inputRef,
}: GuestArenaViewProps) {
  const {camera, gl} = useThree();
  const myWeapon = PIECE_WEAPONS[myPiece.type];

  const myRot = useRef({yaw: Math.PI, pitch: 0});
  const myPos = useRef(new THREE.Vector3(0, 0, -10));
  const foePos = useRef(new THREE.Vector3(0, 0, 10));
  const foeYaw = useRef(0);
  const isMouseDown = useRef(false);
  const keys = useRef<Record<string, boolean>>({});

  const foeMeshRef = useRef<THREE.Group>(null);
  const weaponMeshRef = useRef<THREE.Group>(null);
  const bulletRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Dev-only playtest hook (stripped from production builds).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__GV_CAM__ = () => ({
      ...myRot.current,
      pos: myPos.current.toArray(),
    });
  }, []);

  // Input listeners: pointer-lock mouse look, drag look, keys.
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        myRot.current.yaw -= e.movementX * 0.0022;
        myRot.current.pitch -= e.movementY * 0.0022;
        myRot.current.pitch = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, myRot.current.pitch),
        );
      }
    };
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
      myRot.current.yaw -= dx * 0.0042;
      myRot.current.pitch -= dy * 0.0042;
      myRot.current.pitch = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, myRot.current.pitch),
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
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === 'KeyR') inputRef.current.reload = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const dom = gl.domElement;
    dom.addEventListener('mousemove', handleMouseMove);
    dom.addEventListener('pointerdown', handlePointerDown);
    dom.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      dom.removeEventListener('mousemove', handleMouseMove);
      dom.removeEventListener('pointerdown', handlePointerDown);
      dom.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (document.pointerLockElement === dom) {
        document.exitPointerLock?.();
      }
    };
  }, [gl, inputRef]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Publish this frame's input for the App to stream to the host.
    const moveX =
      (keys.current['KeyD'] ? 1 : 0) -
      (keys.current['KeyA'] ? 1 : 0) +
      touchMoveDir.x;
    const moveZ =
      (keys.current['KeyW'] ? 1 : 0) -
      (keys.current['KeyS'] ? 1 : 0) -
      touchMoveDir.y;
    inputRef.current.moveX = moveX;
    inputRef.current.moveZ = moveZ;
    inputRef.current.yaw = myRot.current.yaw;
    inputRef.current.pitch = myRot.current.pitch;
    inputRef.current.firing = isMouseDown.current || isTouchFiring;

    // Apply the latest host snapshot with smoothing.
    const entry = snapshotRef.current;
    if (entry) {
      const {snap} = entry;
      const k = 1 - Math.exp(-dt * 14);
      myPos.current.x += (snap.guestPos[0] - myPos.current.x) * k;
      myPos.current.z += (snap.guestPos[2] - myPos.current.z) * k;
      foePos.current.x += (snap.hostPos[0] - foePos.current.x) * k;
      foePos.current.z += (snap.hostPos[2] - foePos.current.z) * k;
      foeYaw.current = snap.hostRot.yaw;

      // Projectiles: extrapolate along velocity from snapshot time.
      const elapsed = Math.min((performance.now() - entry.at) / 1000, 0.3);
      for (let i = 0; i < BULLET_POOL; i++) {
        const mesh = bulletRefs.current[i];
        if (!mesh) continue;
        const b = snap.bullets[i];
        if (!b) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(
          b.pos[0] + b.vel[0] * elapsed,
          b.pos[1] + b.vel[1] * elapsed,
          b.pos[2] + b.vel[2] * elapsed,
        );
        mesh.scale.setScalar(b.radius / 0.15);
        (mesh.material as THREE.MeshBasicMaterial).color.set(b.color);
      }
    }

    // Camera at my piece's eye, looking along my own aim.
    const eye = new THREE.Vector3(
      myPos.current.x,
      myPos.current.y + 1.1,
      myPos.current.z,
    );
    camera.position.copy(eye);
    const forwardVec = new THREE.Vector3(
      -Math.sin(myRot.current.yaw) * Math.cos(myRot.current.pitch),
      Math.sin(myRot.current.pitch),
      -Math.cos(myRot.current.yaw) * Math.cos(myRot.current.pitch),
    ).normalize();
    camera.lookAt(eye.clone().add(forwardVec));

    if (foeMeshRef.current) {
      foeMeshRef.current.position.copy(foePos.current);
      const fwd = new THREE.Vector3(
        -Math.sin(foeYaw.current),
        0,
        -Math.cos(foeYaw.current),
      );
      foeMeshRef.current.lookAt(foePos.current.clone().add(fwd));
    }
  });

  return (
    <group>
      {/* Colosseum Arena Floor */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[16, 17, 0.4, 32]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.8} metalness={0.2} />
      </mesh>
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
      {[-5, 5].map((x) =>
        [-4, 4].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, 1.0, z]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 2.0, 1.8]} />
            <meshStandardMaterial color="#4338ca" roughness={0.6} />
          </mesh>
        )),
      )}

      {/* Opponent's piece, positioned by host snapshots */}
      <group ref={foeMeshRef} position={[0, 0, 10]}>
        <ChessPieceMesh type={foePiece.type} color={foePiece.color} scaleMultiplier={1.4} />
      </group>

      {/* First-Person Weapon Model attached to Camera */}
      <group position={camera.position} rotation={camera.rotation}>
        <group ref={weaponMeshRef} position={[0.28, -0.22, -0.55]}>
          <mesh castShadow>
            <boxGeometry args={[0.08, 0.1, 0.45]} />
            <meshStandardMaterial color={myWeapon.color} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, -0.28]} castShadow>
            <cylinderGeometry args={[0.03, 0.04, 0.22, 12]} />
            <meshStandardMaterial
              color="#fbbf24"
              emissive={myWeapon.color}
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      </group>

      {/* Projectiles (pooled meshes, positioned per frame) */}
      {Array.from({length: BULLET_POOL}).map((_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(m) => {
            bulletRefs.current[i] = m;
          }}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}
