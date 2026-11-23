import {Canvas} from '@react-three/fiber';
import {Bloom, EffectComposer} from '@react-three/postprocessing';
import React, {Suspense} from 'react';
import * as THREE from 'three';
import {getConfig} from './constants';
import {ChessPiece, DuelContext, PieceColor} from './types';
import {GuestArenaView} from './components/GuestArenaView';
import {DuelInput, DuelSnapshot} from './net/lan';
import {BoardView, ArenaView} from './components/ChessWorld';
import {ValidMove} from './chessEngine';

interface GameProps {
  currentPhase: 'BOARD' | 'DUEL';
  pieces: ChessPiece[];
  selectedPieceId: string | null;
  validMoves: ValidMove[];
  onSelectPiece: (piece: ChessPiece) => void;
  onTileClick: (row: number, col: number) => void;
  isAiThinking: boolean;
  duelContext: DuelContext | null;
  onDuelResolved: (winner: 'attacker' | 'defender') => void;
  playerPerks: string[];
  touchMoveDir: {x: number; y: number};
  isTouchFiring: boolean;
  onPlayerHealthUpdate: (current: number, max: number) => void;
  onEnemyHealthUpdate: (current: number, max: number) => void;
  onAmmoUpdate: (ammo: number, maxAmmo: number, reloading: boolean) => void;
  onTimeRemaining: (secs: number) => void;
  boardMyColor?: PieceColor;
  boardFlipped?: boolean;
  enemyPerks?: string[];
  netRole?: 'host';
  remoteInputRef?: {current: DuelInput};
  onNetSnapshot?: (snap: DuelSnapshot) => void;
  guestDuel?: {
    myPiece: ChessPiece;
    foePiece: ChessPiece;
    snapshotRef: {current: {snap: DuelSnapshot; at: number} | null};
    inputRef: {current: DuelInput};
  } | null;
}

export function Game({
  currentPhase,
  pieces,
  selectedPieceId,
  validMoves,
  onSelectPiece,
  onTileClick,
  isAiThinking,
  duelContext,
  onDuelResolved,
  playerPerks,
  touchMoveDir,
  isTouchFiring,
  onPlayerHealthUpdate,
  onEnemyHealthUpdate,
  onAmmoUpdate,
  onTimeRemaining,
  boardMyColor,
  boardFlipped,
  enemyPerks,
  netRole,
  remoteInputRef,
  onNetSnapshot,
  guestDuel,
}: GameProps) {
  return (
    <div className="w-full h-full canvas-wrapper relative">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          fov: getConfig('fov'),
          near: 0.1,
          far: 200,
          position: [0, 10, 12],
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        scene={{
          background: new THREE.Color(getConfig('backgroundColor')),
        }}>
        <Suspense fallback={null}>
          {/* Ambient + 3-Point Lighting */}
          <ambientLight
            color={getConfig('ambientColor')}
            intensity={getConfig('ambientIntensity')}
          />
          <directionalLight
            position={[10, 20, 15]}
            intensity={getConfig('sunIntensity')}
            color={getConfig('sunColor')}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0005}
          />
          <hemisphereLight
            color={getConfig('hemiSkyColor')}
            groundColor={getConfig('hemiGroundColor')}
            intensity={getConfig('hemiIntensity')}
          />

          {currentPhase === 'BOARD' && (
            <BoardView
              pieces={pieces}
              selectedPieceId={selectedPieceId}
              validMoves={validMoves}
              onSelectPiece={onSelectPiece}
              onTileClick={onTileClick}
              isAiThinking={isAiThinking}
              myColor={boardMyColor}
              flipped={boardFlipped}
            />
          )}

          {currentPhase === 'DUEL' && duelContext && guestDuel && (
            <GuestArenaView
              myPiece={guestDuel.myPiece}
              foePiece={guestDuel.foePiece}
              touchMoveDir={touchMoveDir}
              isTouchFiring={isTouchFiring}
              snapshotRef={guestDuel.snapshotRef}
              inputRef={guestDuel.inputRef}
            />
          )}

          {currentPhase === 'DUEL' && duelContext && !guestDuel && (
            <ArenaView
              duel={duelContext}
              onDuelResolved={onDuelResolved}
              playerPerks={playerPerks}
              touchMoveDir={touchMoveDir}
              isTouchFiring={isTouchFiring}
              onPlayerHealthUpdate={onPlayerHealthUpdate}
              onEnemyHealthUpdate={onEnemyHealthUpdate}
              onAmmoUpdate={onAmmoUpdate}
              onTimeRemaining={onTimeRemaining}
              enemyPerks={enemyPerks}
              netRole={netRole}
              remoteInputRef={remoteInputRef}
              onNetSnapshot={onNetSnapshot}
            />
          )}

          <EffectComposer>
            <Bloom
              luminanceThreshold={0.8}
              luminanceSmoothing={0.7}
              intensity={0.4}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
