import React, {useMemo} from 'react';
import * as THREE from 'three';
import {PieceType, PieceColor} from '../types';

interface PieceMeshProps {
  type: PieceType;
  color: PieceColor;
  highlighted?: boolean;
  selected?: boolean;
  threat?: boolean;
  scaleMultiplier?: number;
}

export const ChessPieceMesh = React.memo(function ChessPieceMesh({
  type,
  color,
  highlighted = false,
  selected = false,
  threat = false,
  scaleMultiplier = 1.0,
}: PieceMeshProps) {
  const isWhite = color === 'white';
  const baseColor = isWhite ? '#f8fafc' : '#0f172a';
  const trimColor = isWhite ? '#38bdf8' : '#e11d48';

  const bodyMat = useMemo(() => {
    let emissive = '#000000';
    let emissiveInt = 0;
    if (selected) {
      emissive = '#38bdf8';
      emissiveInt = 0.6;
    } else if (threat) {
      emissive = '#ef4444';
      emissiveInt = 0.5;
    } else if (highlighted) {
      emissive = '#22c55e';
      emissiveInt = 0.4;
    }
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.25,
      metalness: 0.6,
      emissive,
      emissiveIntensity: emissiveInt,
    });
  }, [baseColor, selected, threat, highlighted]);

  const trimMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: trimColor,
      roughness: 0.3,
      metalness: 0.8,
      emissive: trimColor,
      emissiveIntensity: 0.3,
    });
  }, [trimColor]);

  const goldMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.3,
      metalness: 0.9,
    });
  }, []);

  return (
    <group scale={[scaleMultiplier, scaleMultiplier, scaleMultiplier]}>
      {/* Base Pedestal (Common to all pieces) */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow material={bodyMat}>
        <cylinderGeometry args={[0.38, 0.45, 0.24, 20]} />
      </mesh>
      <mesh position={[0, 0.26, 0]} castShadow material={trimMat}>
        <torusGeometry args={[0.36, 0.04, 12, 24]} />
      </mesh>

      {/* Piece Specific Anatomy */}
      {type === 'pawn' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.18, 0.3, 0.5, 16]} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow material={trimMat}>
            <cylinderGeometry args={[0.26, 0.22, 0.08, 16]} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow material={bodyMat}>
            <sphereGeometry args={[0.22, 16, 16]} />
          </mesh>
        </group>
      )}

      {type === 'rook' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.28, 0.34, 0.9, 16]} />
          </mesh>
          <mesh position={[0, 0.92, 0]} castShadow material={trimMat}>
            <cylinderGeometry args={[0.34, 0.28, 0.1, 16]} />
          </mesh>
          {/* Battlements / Turret cuts */}
          <group position={[0, 1.05, 0]}>
            <mesh position={[0.22, 0, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[0.14, 0.2, 0.14]} />
            </mesh>
            <mesh position={[-0.22, 0, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[0.14, 0.2, 0.14]} />
            </mesh>
            <mesh position={[0, 0, 0.22]} castShadow material={bodyMat}>
              <boxGeometry args={[0.14, 0.2, 0.14]} />
            </mesh>
            <mesh position={[0, 0, -0.22]} castShadow material={bodyMat}>
              <boxGeometry args={[0.14, 0.2, 0.14]} />
            </mesh>
          </group>
        </group>
      )}

      {type === 'knight' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.3, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.24, 0.34, 0.6, 16]} />
          </mesh>
          {/* Stylized Horse Mane and Snout */}
          <group position={[0, 0.75, 0]}>
            <mesh position={[0, 0.1, -0.1]} rotation={[0.4, 0, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[0.28, 0.48, 0.32]} />
            </mesh>
            {/* Snout pointing forward (-Z) */}
            <mesh position={[0, -0.05, -0.28]} rotation={[-0.2, 0, 0]} castShadow material={trimMat}>
              <boxGeometry args={[0.22, 0.24, 0.32]} />
            </mesh>
            {/* Ears */}
            <mesh position={[0.09, 0.38, -0.05]} castShadow material={goldMat}>
              <coneGeometry args={[0.06, 0.16, 6]} />
            </mesh>
            <mesh position={[-0.09, 0.38, -0.05]} castShadow material={goldMat}>
              <coneGeometry args={[0.06, 0.16, 6]} />
            </mesh>
          </group>
        </group>
      )}

      {type === 'bishop' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.18, 0.32, 1.0, 16]} />
          </mesh>
          <mesh position={[0, 1.05, 0]} castShadow material={trimMat}>
            <cylinderGeometry args={[0.26, 0.2, 0.1, 16]} />
          </mesh>
          {/* Mitre head */}
          <mesh position={[0, 1.25, 0]} castShadow material={bodyMat}>
            <sphereGeometry args={[0.22, 16, 16]} />
          </mesh>
          <mesh position={[0, 1.48, 0]} castShadow material={goldMat}>
            <sphereGeometry args={[0.08, 12, 12]} />
          </mesh>
        </group>
      )}

      {type === 'queen' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.6, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.2, 0.34, 1.2, 16]} />
          </mesh>
          <mesh position={[0, 1.22, 0]} castShadow material={trimMat}>
            <torusGeometry args={[0.26, 0.05, 8, 16]} />
          </mesh>
          {/* Crown */}
          <mesh position={[0, 1.38, 0]} castShadow material={goldMat}>
            <cylinderGeometry args={[0.28, 0.18, 0.25, 16]} />
          </mesh>
          <mesh position={[0, 1.55, 0]} castShadow material={goldMat}>
            <sphereGeometry args={[0.09, 12, 12]} />
          </mesh>
        </group>
      )}

      {type === 'king' && (
        <group position={[0, 0.28, 0]}>
          <mesh position={[0, 0.65, 0]} castShadow material={bodyMat}>
            <cylinderGeometry args={[0.24, 0.36, 1.3, 16]} />
          </mesh>
          <mesh position={[0, 1.32, 0]} castShadow material={trimMat}>
            <cylinderGeometry args={[0.3, 0.22, 0.15, 16]} />
          </mesh>
          {/* Royal Cross Crown */}
          <group position={[0, 1.55, 0]}>
            <mesh position={[0, 0.12, 0]} castShadow material={goldMat}>
              <boxGeometry args={[0.08, 0.32, 0.08]} />
            </mesh>
            <mesh position={[0, 0.16, 0]} castShadow material={goldMat}>
              <boxGeometry args={[0.26, 0.08, 0.08]} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
});
