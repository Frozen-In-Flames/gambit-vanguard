// tslint:disable
/* eslint-disable */
import {
  Play,
  RotateCw,
  Zap,
  Shield,
  Crosshair,
  Volume2,
  VolumeX,
  Flame,
  Activity,
  BatteryCharging,
  Wind,
  Trophy,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {getConfig} from './constants';
import {Game} from './Game';
import BackgroundMusic from './utils/BackgroundMusic';
import {LanPeer, DuelInput, DuelSnapshot, LanMessage} from './net/lan';
import QRCode from 'qrcode';
import {GameState, MenuOverlay, Overlay, gameAudio, useIsMobile} from './utils';
import {
  useHost,
  useHostGameLifecycle,
  useHostResume,
  useRpc,
} from './utils/host';
import {ChessPiece, DuelContext, PerkDef} from './types';
import {createInitialBoard, getPieceAt, getValidMoves, getAiMove, ValidMove} from './chessEngine';
import {AVAILABLE_PERKS, PIECE_WEAPONS} from './chessRules';
import {CAMPAIGN_LEVELS, LevelConfig} from './levels';

interface CustomWindow extends Window {
  canHandleBackKey?: boolean;
}

const TOTAL_LEVELS = 3;

export default function App() {
  const isMobile = useIsMobile();

  // --- HOST INTERFACE ---
  const {sdk, isReady} = useHost();
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // Host save/resume wiring
  const {initialLevel, initialScore, persistenceEnabled, autoStartPending} =
    useHostResume({
      isReady,
      onAutoStart: () => {
        if (gameStateRef.current.status === 'START') {
          initGame();
        }
      },
    });

  const startLevel = Math.min(Math.max(1, initialLevel), TOTAL_LEVELS);
  const startScore = initialScore;

  const levelStartScoreRef = useRef(startScore);
  const prevLevelRef = useRef(startLevel);
  const runWonRef = useRef(false);

  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: startScore,
    level: startLevel,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Key to remount canvas cleanly between runs/levels
  const [gameKey, setGameKey] = useState(1);

  // Chess and Combat State
  const [pieces, setPieces] = useState<ChessPiece[]>(() => createInitialBoard(startLevel));
  // Always-current mirror of the board. executeMove must read the
  // board through this ref, never through the render closure: the AI
  // turn fires from a timer whose closure predates the player's last
  // move, and a stale read makes a capture look like a move onto an
  // empty square (the duel is skipped and the pieces stack).
  const piecesRef = useRef(pieces);
  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<ValidMove[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'BOARD' | 'DUEL'>('BOARD');
  const [duelContext, setDuelContext] = useState<DuelContext | null>(null);

  // Perks Modal State
  const [showPerkChoice, setShowPerkChoice] = useState(false);
  const [perkOptions, setPerkOptions] = useState<PerkDef[]>([]);
  const [activePerks, setActivePerks] = useState<string[]>([]);
  const pendingVictoriousPieceId = useRef<string | null>(null);

  // --- LAN Multiplayer (optional 2-player mode over local Wi-Fi) ---
  const [mpMode, setMpMode] = useState<'solo' | 'host' | 'guest'>('solo');
  const mpModeRef = useRef(mpMode);
  mpModeRef.current = mpMode;
  const peerRef = useRef<LanPeer | null>(null);
  const [mpConnected, setMpConnected] = useState(false);
  const [mpTurn, setMpTurn] = useState<'white' | 'black'>('white');
  const mpTurnRef = useRef(mpTurn);
  mpTurnRef.current = mpTurn;
  const [mpBlackScore, setMpBlackScore] = useState(0);
  const [blackPerks, setBlackPerks] = useState<string[]>([]);
  const [mpResult, setMpResult] = useState<'white' | 'black' | null>(null);
  const [mpStatus, setMpStatus] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [pairInput, setPairInput] = useState('');
  const [pairStep, setPairStep] = useState<'idle' | 'offer' | 'answer'>('idle');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteInputRef = useRef<DuelInput>({
    moveX: 0, moveZ: 0, yaw: Math.PI, pitch: 0, firing: false, reload: false,
  });
  const guestInputRef = useRef<DuelInput>({
    moveX: 0, moveZ: 0, yaw: Math.PI, pitch: 0, firing: false, reload: false,
  });
  const duelSnapRef = useRef<{snap: DuelSnapshot; at: number} | null>(null);
  const pendingGuestPerkPieceId = useRef<string | null>(null);
  const guestPerkOfferRef = useRef(false);

  // In-Game Menu / Overlays / Audio Toggles
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isArmoryOpen, setIsArmoryOpen] = useState(false);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Duel Combat HUD telemetry
  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [enemyHp, setEnemyHp] = useState(100);
  const [enemyMaxHp, setEnemyMaxHp] = useState(100);
  const [ammo, setAmmo] = useState(20);
  const [maxAmmo, setMaxAmmo] = useState(20);
  const [isReloading, setIsReloading] = useState(false);
  const [arenaTime, setArenaTime] = useState(45);

  // Mobile Touch Controls State
  const [touchMoveDir, setTouchMoveDir] = useState({x: 0, y: 0});
  const [isTouchFiring, setIsTouchFiring] = useState(false);

  useEffect(() => {
    if (gameState.level !== prevLevelRef.current) {
      prevLevelRef.current = gameState.level;
      levelStartScoreRef.current = gameStateRef.current.score;
    }
  }, [gameState.level]);

  useEffect(() => {
    if (gameState.status === 'VICTORY') {
      runWonRef.current = true;
      gameAudio.playVictoryFanfare();
    } else if (gameState.status === 'GAME_OVER') {
      gameAudio.playDefeatMotif();
    }
  }, [gameState.status]);

  useEffect(() => {
    const canHandleBackKey = ['PLAYING', 'PAUSED'].includes(gameState.status);
    (window as CustomWindow).canHandleBackKey = canHandleBackKey;
  }, [gameState.status]);

  // Keyboard shortcut for Game Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
        } else if (isArmoryOpen) {
          setIsArmoryOpen(false);
        } else if (isLevelSelectOpen) {
          setIsLevelSelectOpen(false);
        } else if (gameState.status === 'PLAYING') {
          setIsGameMenuOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, isHowToPlayOpen, isArmoryOpen, isLevelSelectOpen]);

  // Start / Reset Run
  const startRun = useCallback(
    (level: number, score: number) => {
      const clampedLevel = Math.min(Math.max(1, level), TOTAL_LEVELS);
      levelStartScoreRef.current = score;
      prevLevelRef.current = clampedLevel;
      runWonRef.current = false;
      setPieces(createInitialBoard(clampedLevel));
      setSelectedPieceId(null);
      setValidMoves([]);
      setCurrentPhase('BOARD');
      setDuelContext(null);
      setShowPerkChoice(false);
      setActivePerks([]);
      setIsGameMenuOpen(false);
      setIsLevelSelectOpen(false);
      setGameKey((prev) => prev + 1);
      setGameState((prev) => ({
        ...prev,
        status: 'PLAYING',
        level: clampedLevel,
        score,
      }));
      if (sdk) {
        sdk.startGame();
      }
    },
    [sdk],
  );

  const initGame = useCallback(() => {
    if (persistenceEnabled && !runWonRef.current) {
      startRun(gameStateRef.current.level, levelStartScoreRef.current);
    } else {
      startRun(1, 0);
    }
  }, [startRun, persistenceEnabled]);

  const resetGame = useCallback(() => {
    startRun(1, 0);
  }, [startRun]);

  useHostGameLifecycle(gameState, sdk);

  // Auto-start for preview
  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame();
    }
  }, [initGame]);

  // Current Level Details
  const currentLevelConfig: LevelConfig =
    CAMPAIGN_LEVELS.find((l) => l.level === gameState.level) || CAMPAIGN_LEVELS[0];

  // --- Chess Interactions ---
  const handleSelectPiece = (piece: ChessPiece) => {
    if (currentPhase !== 'BOARD' || isAiThinking) return;
    if (mpModeRef.current === 'host' && mpTurnRef.current !== 'white') return;
    if (piece.color !== 'white') return;

    if (selectedPieceId === piece.id) {
      setSelectedPieceId(null);
      setValidMoves([]);
    } else {
      setSelectedPieceId(piece.id);
      const moves = getValidMoves(piece, pieces);
      setValidMoves(moves);
      gameAudio.playCrispClick();
    }
  };

  const executeMove = (
    movingPiece: ChessPiece,
    targetRow: number,
    targetCol: number,
    isAiTurn = false,
  ) => {
    const targetPiece = getPieceAt(piecesRef.current, targetRow, targetCol);

    if (targetPiece && targetPiece.color !== movingPiece.color) {
      // BATTLE DUEL TRIGGERED!
      gameAudio.playGunshotBlast();
      setDuelContext({
        attacker: {...movingPiece},
        defender: {...targetPiece},
        targetRow,
        targetCol,
        playerIsAttacker: movingPiece.color === 'white',
      });
      setPlayerHp(
        movingPiece.color === 'white'
          ? movingPiece.currentHp
          : targetPiece.currentHp,
      );
      setPlayerMaxHp(
        movingPiece.color === 'white'
          ? movingPiece.maxHp
          : targetPiece.maxHp,
      );
      setEnemyHp(
        movingPiece.color === 'black'
          ? movingPiece.currentHp
          : targetPiece.currentHp,
      );
      setEnemyMaxHp(
        movingPiece.color === 'black'
          ? movingPiece.maxHp
          : targetPiece.maxHp,
      );
      setCurrentPhase('DUEL');
      return;
    }

    // Peaceful move without duel
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === movingPiece.id) {
          return {...p, row: targetRow, col: targetCol};
        }
        return p;
      }),
    );
    setSelectedPieceId(null);
    setValidMoves([]);
    gameAudio.playCrispClick();

    if (mpModeRef.current === 'solo') {
      if (!isAiTurn) {
        triggerAiTurn();
      }
    } else {
      setMpTurn(movingPiece.color === 'white' ? 'black' : 'white');
    }
  };

  const handleTileClick = (row: number, col: number) => {
    if (currentPhase !== 'BOARD' || isAiThinking || !selectedPieceId) return;
    if (mpModeRef.current === 'host' && mpTurnRef.current !== 'white') return;
    const isMoveValid = validMoves.some((m) => m.row === row && m.col === col);
    if (!isMoveValid) {
      setSelectedPieceId(null);
      setValidMoves([]);
      return;
    }
    const piece = piecesRef.current.find((p) => p.id === selectedPieceId);
    if (piece) {
      executeMove(piece, row, col, false);
    }
  };

  const triggerAiTurn = () => {
    setIsAiThinking(true);
    setTimeout(() => {
      // Read the board from the ref and run the move as a plain side
      // effect. (This used to run inside a setPieces updater, where
      // executeMove's own board lookup read a stale closure and AI
      // captures of the just-moved piece silently skipped the duel.)
      const aiDecision = getAiMove(piecesRef.current);
      if (aiDecision) {
        executeMove(
          aiDecision.piece,
          aiDecision.target.row,
          aiDecision.target.col,
          true,
        );
      }
      setIsAiThinking(false);
    }, 600);
  };

  // Advance to Next Level Campaign
  const advanceToNextLevel = useCallback(() => {
    if (gameState.level < TOTAL_LEVELS) {
      const nextLvl = gameState.level + 1;
      startRun(nextLvl, gameState.score + 500);
    } else {
      setGameState((prev) => ({...prev, status: 'VICTORY'}));
    }
  }, [gameState.level, gameState.score, startRun]);

  // Duel Combat Resolution Callback
  const handleDuelResolved = (winner: 'attacker' | 'defender') => {
    if (!duelContext) return;
    if (mpModeRef.current !== 'solo') {
      handleMpDuelResolved(winner);
      return;
    }
    const {attacker, defender, targetRow, targetCol, playerIsAttacker} =
      duelContext;

    const playerWon =
      (playerIsAttacker && winner === 'attacker') ||
      (!playerIsAttacker && winner === 'defender');

    const winningPiece = winner === 'attacker' ? attacker : defender;
    const losingPiece = winner === 'attacker' ? defender : attacker;

    if (playerWon) {
      const points = losingPiece.type === 'king' ? 1200 : 200;
      setGameState((prev) => ({...prev, score: prev.score + points}));
    }

    // Update board state first: the loser dies and a winning
    // attacker takes the square, on every resolution path including
    // a king's death (this used to run after the king check, whose
    // early return left the dead king standing on the board).
    setPieces((prev) => {
      return prev.map((p) => {
        if (p.id === losingPiece.id) {
          return {...p, alive: false};
        }
        if (p.id === attacker.id && winner === 'attacker') {
          return {
            ...p,
            row: targetRow,
            col: targetCol,
            kills: p.kills + 1,
          };
        }
        if (p.id === defender.id && winner === 'defender') {
          return {
            ...p,
            kills: p.kills + 1,
          };
        }
        return p;
      });
    });

    // Check Win/Loss by King death
    if (losingPiece.type === 'king') {
      if (losingPiece.color === 'white') {
        setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
        setCurrentPhase('BOARD');
        setDuelContext(null);
        return;
      } else {
        // Enemy King was eliminated!
        if (gameState.level < TOTAL_LEVELS) {
          setGameState((prev) => ({...prev, status: 'LEVEL_COMPLETE'}));
          gameAudio.playVictoryFanfare();
        } else {
          setGameState((prev) => ({...prev, status: 'VICTORY'}));
        }
        setCurrentPhase('BOARD');
        setDuelContext(null);
        return;
      }
    }

    setCurrentPhase('BOARD');
    setDuelContext(null);

    // If player won, prompt Perk Selection Modal
    if (playerWon) {
      pendingVictoriousPieceId.current = winningPiece.id;
      const shuffled = [...AVAILABLE_PERKS].sort(() => 0.5 - Math.random());
      setPerkOptions(shuffled.slice(0, 3));
      setShowPerkChoice(true);
      gameAudio.playPowerupChime();
    } else {
      setSelectedPieceId(null);
      setValidMoves([]);
    }
  };

  const handleSelectPerk = (perk: PerkDef) => {
    if (mpModeRef.current === 'guest' && guestPerkOfferRef.current) {
      peerRef.current?.send({type: 'perk-pick', perkId: perk.id});
      guestPerkOfferRef.current = false;
      setShowPerkChoice(false);
      gameAudio.playLevelUpStinger();
      return;
    }
    setActivePerks((prev) => [...prev, perk.id]);
    if (pendingVictoriousPieceId.current) {
      setPieces((prev) =>
        prev.map((p) => {
          if (p.id === pendingVictoriousPieceId.current) {
            const updated = {...p, perks: [...p.perks, perk.id]};
            perk.apply(updated);
            return updated;
          }
          return p;
        }),
      );
    }
    setShowPerkChoice(false);
    pendingVictoriousPieceId.current = null;
    gameAudio.playLevelUpStinger();
  };

  // --- LAN multiplayer machinery ---
  const handleMpDuelResolved = (winner: 'attacker' | 'defender') => {
    if (!duelContext) return;
    const {attacker, defender, targetRow, targetCol} = duelContext;
    const winningPiece = winner === 'attacker' ? attacker : defender;
    const losingPiece = winner === 'attacker' ? defender : attacker;
    const points = losingPiece.type === 'king' ? 1200 : 200;
    if (winningPiece.color === 'white') {
      setGameState((prev) => ({...prev, score: prev.score + points}));
    } else {
      setMpBlackScore((prev) => prev + points);
    }
    setPieces((prev) =>
      prev.map((p) => {
        if (p.id === losingPiece.id) {
          return {...p, alive: false};
        }
        if (p.id === attacker.id && winner === 'attacker') {
          return {...p, row: targetRow, col: targetCol, kills: p.kills + 1};
        }
        if (p.id === defender.id && winner === 'defender') {
          return {...p, kills: p.kills + 1};
        }
        return p;
      }),
    );
    setCurrentPhase('BOARD');
    setDuelContext(null);
    setMpTurn(defender.color);
    if (losingPiece.type === 'king') {
      setMpResult(winningPiece.color);
      gameAudio.playVictoryFanfare();
      return;
    }
    // The winning side earns a perk: the host picks on its own screen,
    // the guest picks on theirs and the choice is relayed back.
    const shuffled = [...AVAILABLE_PERKS].sort(() => 0.5 - Math.random());
    const options = shuffled.slice(0, 3);
    if (winningPiece.color === 'white') {
      pendingVictoriousPieceId.current = winningPiece.id;
      setPerkOptions(options);
      setShowPerkChoice(true);
      gameAudio.playPowerupChime();
    } else {
      pendingGuestPerkPieceId.current = winningPiece.id;
      peerRef.current?.send({
        type: 'perk-offer',
        pieceId: winningPiece.id,
        options: options.map((o) => o.id),
      });
    }
  };

  const applyRemotePerk = (perkId: string) => {
    const perk = AVAILABLE_PERKS.find((p) => p.id === perkId);
    if (!perk) return;
    setBlackPerks((prev) => [...prev, perk.id]);
    const pieceId = pendingGuestPerkPieceId.current;
    if (pieceId) {
      setPieces((prev) =>
        prev.map((p) => {
          if (p.id === pieceId) {
            const updated = {...p, perks: [...p.perks, perk.id]};
            perk.apply(updated);
            return updated;
          }
          return p;
        }),
      );
    }
    pendingGuestPerkPieceId.current = null;
  };

  const guestSelectPiece = (piece: ChessPiece) => {
    if (currentPhase !== 'BOARD' || mpTurn !== 'black') return;
    if (piece.color !== 'black') return;
    if (selectedPieceId === piece.id) {
      setSelectedPieceId(null);
      setValidMoves([]);
    } else {
      setSelectedPieceId(piece.id);
      setValidMoves(getValidMoves(piece, pieces));
      gameAudio.playCrispClick();
    }
  };

  const guestTileClick = (row: number, col: number) => {
    if (currentPhase !== 'BOARD' || !selectedPieceId) return;
    const ok = validMoves.some((m) => m.row === row && m.col === col);
    if (!ok) {
      setSelectedPieceId(null);
      setValidMoves([]);
      return;
    }
    peerRef.current?.send({
      type: 'move-intent',
      pieceId: selectedPieceId,
      row,
      col,
    });
    setSelectedPieceId(null);
    setValidMoves([]);
  };

  // Latest match snapshot, broadcast to the guest on every change.
  const mpSnapRef = useRef<unknown>(null);
  mpSnapRef.current = {
    pieces,
    gameState,
    currentPhase,
    duelContext,
    mpTurn,
    mpResult,
    mpBlackScore,
    activePerks,
    blackPerks,
  };
  const broadcastState = useCallback(() => {
    if (mpModeRef.current === 'host' && peerRef.current?.connected) {
      peerRef.current.send({type: 'state', snap: mpSnapRef.current});
    }
  }, []);
  useEffect(() => {
    broadcastState();
  }, [
    pieces,
    gameState,
    currentPhase,
    duelContext,
    mpTurn,
    mpResult,
    mpBlackScore,
    activePerks,
    blackPerks,
    mpConnected,
    broadcastState,
  ]);

  // Incoming peer messages (closure refreshed every render via ref).
  const mpMsgRef = useRef<(msg: LanMessage) => void>(() => {});
  mpMsgRef.current = (msg: LanMessage) => {
    if (mpModeRef.current === 'host') {
      if (msg.type === 'hello') {
        broadcastState();
      } else if (msg.type === 'move-intent') {
        if (mpTurnRef.current !== 'black' || currentPhase !== 'BOARD') return;
        const piece = pieces.find((p) => p.id === msg.pieceId);
        if (!piece || !piece.alive || piece.color !== 'black') return;
        const ok = getValidMoves(piece, pieces).some(
          (m) => m.row === msg.row && m.col === msg.col,
        );
        if (ok) executeMove(piece, msg.row, msg.col, true);
      } else if (msg.type === 'duel-input') {
        remoteInputRef.current = msg.input;
      } else if (msg.type === 'perk-pick') {
        applyRemotePerk(msg.perkId);
      }
    } else if (mpModeRef.current === 'guest') {
      if (msg.type === 'state') {
        const snap = msg.snap as {
          pieces: ChessPiece[];
          gameState: GameState;
          currentPhase: 'BOARD' | 'DUEL';
          duelContext: DuelContext | null;
          mpTurn: 'white' | 'black';
          mpResult: 'white' | 'black' | null;
          mpBlackScore: number;
          activePerks: string[];
          blackPerks: string[];
        };
        setPieces(snap.pieces);
        setGameState(snap.gameState);
        setCurrentPhase(snap.currentPhase);
        setDuelContext(
          snap.duelContext
            ? {
                ...snap.duelContext,
                playerIsAttacker: snap.duelContext.attacker.color === 'black',
              }
            : null,
        );
        setMpTurn(snap.mpTurn);
        setMpResult(snap.mpResult);
        setMpBlackScore(snap.mpBlackScore);
        setActivePerks(snap.activePerks);
        setBlackPerks(snap.blackPerks);
        if (snap.duelContext) {
          const mine =
            snap.duelContext.attacker.color === 'black'
              ? snap.duelContext.attacker
              : snap.duelContext.defender;
          const foe =
            snap.duelContext.attacker.color === 'black'
              ? snap.duelContext.defender
              : snap.duelContext.attacker;
          setPlayerHp(mine.currentHp);
          setPlayerMaxHp(mine.maxHp);
          setEnemyHp(foe.currentHp);
          setEnemyMaxHp(foe.maxHp);
        }
      } else if (msg.type === 'duel-snap') {
        duelSnapRef.current = {snap: msg.snap, at: performance.now()};
        setPlayerHp(msg.snap.guestHp);
        setPlayerMaxHp(msg.snap.guestMaxHp);
        setEnemyHp(msg.snap.hostHp);
        setEnemyMaxHp(msg.snap.hostMaxHp);
        setAmmo(msg.snap.guestAmmo);
        setMaxAmmo(msg.snap.guestMaxAmmo);
        setIsReloading(msg.snap.guestReloading);
        setArenaTime(Math.max(0, Math.ceil(msg.snap.timeLeft)));
      } else if (msg.type === 'perk-offer') {
        guestPerkOfferRef.current = true;
        setPerkOptions(
          msg.options
            .map((id) => AVAILABLE_PERKS.find((p) => p.id === id))
            .filter((p): p is PerkDef => Boolean(p)),
        );
        setShowPerkChoice(true);
        gameAudio.playPowerupChime();
      }
    }
  };

  const wirePeer = (peer: LanPeer) => {
    peer.onMessage = (msg) => mpMsgRef.current(msg);
    peer.onOpen = () => {
      setMpConnected(true);
      if (peer.role === 'guest') {
        peer.send({type: 'hello'});
        setMpStatus('Connected. You are Black.');
      } else {
        setMpStatus('Connected. You are White.');
      }
    };
    peer.onClose = () => {
      setMpConnected(false);
      setMpStatus('Opponent disconnected.');
      setCurrentPhase('BOARD');
      setDuelContext(null);
      setMpResult(null);
      setGameState((prev) => ({...prev, status: 'START'}));
    };
  };

  const leaveMultiplayer = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    setMpMode('solo');
    setMpConnected(false);
    setPairCode('');
    setPairInput('');
    setPairStep('idle');
    setMpStatus('');
    setMpResult(null);
  }, []);

  const hostGame = async () => {
    leaveMultiplayer();
    const peer = ((window as any).__GV_PEER_FACTORY__
      ? (window as any).__GV_PEER_FACTORY__('host')
      : new LanPeer('host')) as LanPeer;
    peerRef.current = peer;
    wirePeer(peer);
    setMpMode('host');
    const code = await peer.createOfferCode();
    setPairCode(code);
    setPairStep('offer');
    setMpStatus(
      'Step 1: send your host code to the other player. Step 2: paste their reply code below and press Connect.',
    );
  };

  const hostConnect = async () => {
    if (!peerRef.current || !pairInput.trim()) return;
    try {
      await peerRef.current.acceptAnswerCode(pairInput);
      setMpStatus('Connecting...');
    } catch {
      setMpStatus('That reply code did not work. Check it and try again.');
    }
  };

  const joinGame = () => {
    leaveMultiplayer();
    const peer = ((window as any).__GV_PEER_FACTORY__
      ? (window as any).__GV_PEER_FACTORY__('guest')
      : new LanPeer('guest')) as LanPeer;
    peerRef.current = peer;
    wirePeer(peer);
    setMpMode('guest');
    setPairStep('answer');
    setMpStatus('Paste the host code, press Make Reply Code, then send your reply code to the host.');
  };

  const guestMakeReply = async () => {
    if (!peerRef.current || !pairInput.trim()) return;
    try {
      const code = await peerRef.current.acceptOfferCode(pairInput);
      setPairCode(code);
      setMpStatus('Send your reply code to the host. Connecting...');
    } catch {
      setMpStatus('That host code did not work. Check it and try again.');
    }
  };

  const commenceClick = () => {
    if (mpModeRef.current === 'host') {
      startRun(1, 0);
      setMpTurn('white');
      setMpBlackScore(0);
      setBlackPerks([]);
      setMpResult(null);
    } else {
      initGame();
    }
  };

  const sendDuelSnap = useCallback((snap: DuelSnapshot) => {
    peerRef.current?.send({type: 'duel-snap', snap});
  }, []);

  // Guest: stream duel input to the host at 20 Hz during a duel.
  useEffect(() => {
    if (mpMode !== 'guest') return;
    const id = window.setInterval(() => {
      if (currentPhase === 'DUEL' && peerRef.current?.connected) {
        peerRef.current.send({
          type: 'duel-input',
          input: {...guestInputRef.current},
        });
        guestInputRef.current.reload = false;
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [mpMode, currentPhase]);

  // Render the pairing QR code when one is on screen.
  useEffect(() => {
    if (pairCode && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, pairCode, {
        errorCorrectionLevel: 'L',
        width: 164,
        margin: 1,
      }).catch(() => {});
    }
  }, [pairCode, pairStep]);

  // Dev-only playtest bridge: exposes state snapshots and the same
  // handlers the UI calls, so automated playtests drive real gameplay.
  // import.meta.env.DEV is false in production builds and this is
  // eliminated there; it exists for local verification only.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__GV__ = {
      snapshot: () => ({
        gameState,
        pieces,
        selectedPieceId,
        validMoves,
        isAiThinking,
        currentPhase,
        duelContext,
        playerHp,
        enemyHp,
        showPerkChoice,
        perkOptions,
        mpMode,
        mpConnected,
        mpTurn,
        mpResult,
        mpBlackScore,
        blackPerks,
      }),
      selectPiece: (piece: ChessPiece) =>
        mpMode === 'guest' ? guestSelectPiece(piece) : handleSelectPiece(piece),
      tileClick: (row: number, col: number) =>
        mpMode === 'guest' ? guestTileClick(row, col) : handleTileClick(row, col),
      duelResolved: handleDuelResolved,
      selectPerk: handleSelectPerk,
    };
  });

  const selectedPiece = pieces.find((p) => p.id === selectedPieceId);

  const getPerkIcon = (iconName: string) => {
    switch (iconName) {
      case 'Shield':
        return <Shield className="w-5 h-5 text-emerald-400" />;
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-rose-400" />;
      case 'Wind':
        return <Wind className="w-5 h-5 text-cyan-400" />;
      case 'Activity':
        return <Activity className="w-5 h-5 text-red-400" />;
      case 'BatteryCharging':
        return <BatteryCharging className="w-5 h-5 text-purple-400" />;
      default:
        return <Zap className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col bg-zinc-950 text-white font-sans select-none">
      <BackgroundMusic
        url={getConfig('backgroundMusicUrl')}
        isPlaying={gameState.status === 'PLAYING' || gameState.status === 'START'}
        isMuted={isMusicMuted}
      />

      {/* Top Header HUD Bar */}
      <div className="w-full h-14 bg-zinc-900/95 border-b border-zinc-800 px-4 flex items-center justify-between z-20 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-black text-amber-400 text-sm tracking-widest uppercase">
            <Crosshair className="w-4 h-4 text-amber-400 animate-spin-slow" />
            GAMBIT VANGUARD
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs bg-zinc-800/80 px-3 py-1 rounded-full border border-zinc-700">
            <span className="text-zinc-400">Level {gameState.level}:</span>
            <span className="font-bold text-sky-400 uppercase">
              {currentLevelConfig.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs bg-zinc-800/90 px-3 py-1 rounded-lg border border-zinc-700 font-mono font-bold text-amber-300">
            {mpMode === 'solo'
              ? `SCORE: ${gameState.score}`
              : `WHITE ${gameState.score} · BLACK ${mpBlackScore}`}
          </div>
          {/* Menu Button */}
          <button
            onClick={() => setIsGameMenuOpen(true)}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-600 rounded-lg text-xs font-bold text-zinc-200 transition-colors shadow">
            Menu
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center bg-slate-950">
        <Game
          key={gameKey}
          currentPhase={currentPhase}
          pieces={pieces}
          selectedPieceId={selectedPieceId}
          validMoves={validMoves}
          onSelectPiece={mpMode === 'guest' ? guestSelectPiece : handleSelectPiece}
          onTileClick={mpMode === 'guest' ? guestTileClick : handleTileClick}
          isAiThinking={
            mpMode === 'solo'
              ? isAiThinking
              : mpTurn !== (mpMode === 'guest' ? 'black' : 'white')
          }
          boardMyColor={mpMode === 'guest' ? 'black' : 'white'}
          boardFlipped={mpMode === 'guest'}
          enemyPerks={blackPerks}
          netRole={mpMode === 'host' ? 'host' : undefined}
          remoteInputRef={remoteInputRef}
          onNetSnapshot={mpMode === 'host' ? sendDuelSnap : undefined}
          guestDuel={
            mpMode === 'guest' && duelContext
              ? {
                  myPiece:
                    duelContext.attacker.color === 'black'
                      ? duelContext.attacker
                      : duelContext.defender,
                  foePiece:
                    duelContext.attacker.color === 'black'
                      ? duelContext.defender
                      : duelContext.attacker,
                  snapshotRef: duelSnapRef,
                  inputRef: guestInputRef,
                }
              : null
          }
          duelContext={duelContext}
          onDuelResolved={handleDuelResolved}
          playerPerks={activePerks}
          touchMoveDir={touchMoveDir}
          isTouchFiring={isTouchFiring}
          onPlayerHealthUpdate={(cur, max) => {
            setPlayerHp(cur);
            setPlayerMaxHp(max);
          }}
          onEnemyHealthUpdate={(cur, max) => {
            setEnemyHp(cur);
            setEnemyMaxHp(max);
          }}
          onAmmoUpdate={(cur, max, rel) => {
            setAmmo(cur);
            setMaxAmmo(max);
            setIsReloading(rel);
          }}
          onTimeRemaining={(secs) => setArenaTime(secs)}
        />

        {/* Tactical Board HUD Info Overlay */}
        {currentPhase === 'BOARD' && gameState.status === 'PLAYING' && (
          <div className="absolute top-3 left-4 pointer-events-none z-10 flex flex-col gap-2">
            {mpMode !== 'solo' && (
              <div
                className={`px-3.5 py-2 rounded-xl border text-xs font-black tracking-widest shadow-xl ${
                  mpTurn === (mpMode === 'guest' ? 'black' : 'white')
                    ? 'bg-emerald-950/85 border-emerald-600 text-emerald-300'
                    : 'bg-zinc-900/85 border-zinc-700 text-zinc-400'
                }`}>
                {mpTurn === (mpMode === 'guest' ? 'black' : 'white')
                  ? 'YOUR TURN'
                  : "OPPONENT'S TURN"}
              </div>
            )}
            <div className="bg-black/75 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-zinc-700/80 max-w-sm text-xs shadow-xl">
              {selectedPiece ? (
                <div>
                  <div className="font-bold text-sky-400 capitalize flex items-center justify-between">
                    <span>{selectedPiece.type} ({selectedPiece.color})</span>
                    <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded">
                      {PIECE_WEAPONS[selectedPiece.type].name}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 mt-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Move: {validMoves.filter((m) => !m.isCapture).length}
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block ml-2" />
                    1v1 Duel: {validMoves.filter((m) => m.isCapture).length}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-300 flex items-center gap-2">
                  {isAiThinking ? (
                    <span className="text-amber-400 font-semibold animate-pulse">
                      Grandmaster Calculating Countermove...
                    </span>
                  ) : (
                    <span>Select any White piece to maneuver or initiate duel.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1v1 Arena Combat HUD */}
        {currentPhase === 'DUEL' && duelContext && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
            {/* Top Arena Bar: Duelists & Countdown */}
            <div className="flex justify-between items-start">
              {/* Player Status */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-500/50 p-3 rounded-xl w-48 shadow-xl">
                <div className="text-xs font-black text-cyan-400 uppercase tracking-wider flex justify-between">
                  <span>YOU ({duelContext.playerIsAttacker ? duelContext.attacker.type : duelContext.defender.type})</span>
                </div>
                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden mt-2 border border-zinc-700">
                  <div
                    className="bg-cyan-400 h-full transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, (playerHp / playerMaxHp) * 100))}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-zinc-300 mt-1.5 flex justify-between font-mono">
                  <span>HP: {Math.round(playerHp)}/{playerMaxHp}</span>
                  <span className="text-amber-400 font-semibold truncate ml-2">
                    {PIECE_WEAPONS[duelContext.playerIsAttacker ? duelContext.attacker.type : duelContext.defender.type].name}
                  </span>
                </div>
              </div>

              {/* Arena Timer */}
              <div className="bg-black/80 px-4 py-2 rounded-2xl border border-zinc-700 font-mono text-center shadow-lg">
                <div className="text-xl font-black text-amber-400 leading-none">
                  {arenaTime}s
                </div>
                <div className="text-[8px] text-zinc-400 uppercase tracking-widest mt-0.5">
                  TIME LIMIT
                </div>
              </div>

              {/* Enemy Status */}
              <div className="bg-slate-900/85 backdrop-blur-md border border-rose-500/50 p-3 rounded-xl w-48 shadow-xl">
                <div className="text-xs font-black text-rose-400 uppercase tracking-wider flex justify-between">
                  <span>ENEMY ({duelContext.playerIsAttacker ? duelContext.defender.type : duelContext.attacker.type})</span>
                </div>
                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden mt-2 border border-zinc-700">
                  <div
                    className="bg-rose-500 h-full transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, (enemyHp / enemyMaxHp) * 100))}%`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-zinc-300 mt-1.5 flex justify-between font-mono">
                  <span>HP: {Math.round(enemyHp)}/{enemyMaxHp}</span>
                  <span className="text-rose-300 font-semibold truncate ml-2">
                    {PIECE_WEAPONS[duelContext.playerIsAttacker ? duelContext.defender.type : duelContext.attacker.type].name}
                  </span>
                </div>
              </div>
            </div>

            {/* Center FPS Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shadow-lg" />
                <div className="absolute -top-3 w-0.5 h-2 bg-amber-400/80" />
                <div className="absolute -bottom-3 w-0.5 h-2 bg-amber-400/80" />
                <div className="absolute -left-3 h-0.5 w-2 bg-amber-400/80" />
                <div className="absolute -right-3 h-0.5 w-2 bg-amber-400/80" />
              </div>
            </div>

            {/* Bottom Ammo & Tactical Readout */}
            <div className="flex justify-between items-end mb-2">
              <div className="bg-black/75 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300">
                <span className="font-semibold text-sky-400">Controls: </span>
                Click to Shoot · R to Reload · WASD to Strafe
              </div>

              {/* Ammo Display */}
              <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/40 px-4 py-2 rounded-xl flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-amber-400 leading-none">
                    {isReloading ? (
                      <span className="text-sm text-yellow-300 animate-pulse">RELOADING...</span>
                    ) : (
                      `${ammo} / ${maxAmmo}`
                    )}
                  </div>
                  <div className="text-[9px] text-zinc-400 uppercase tracking-wider">
                    MAGAZINE
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile On-Screen Touch Controls */}
        {isMobile && currentPhase === 'DUEL' && (
          <div className="absolute inset-0 pointer-events-none z-30">
            <div className="absolute bottom-6 left-8 pointer-events-auto flex flex-col items-center gap-1.5">
              <button
                className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-800/80 active:bg-zinc-700 border border-zinc-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg touch-none"
                onPointerDown={() => setTouchMoveDir((prev) => ({...prev, y: -1}))}
                onPointerUp={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}
                onPointerLeave={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}
                onPointerCancel={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}>
                ▲
              </button>
              <div className="flex gap-2">
                <button
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-800/80 active:bg-zinc-700 border border-zinc-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg touch-none"
                  onPointerDown={() => setTouchMoveDir((prev) => ({...prev, x: -1}))}
                  onPointerUp={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}
                  onPointerLeave={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}
                  onPointerCancel={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}>
                  ◀
                </button>
                <button
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-800/80 active:bg-zinc-700 border border-zinc-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg touch-none"
                  onPointerDown={() => setTouchMoveDir((prev) => ({...prev, y: 1}))}
                  onPointerUp={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}
                  onPointerLeave={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}
                  onPointerCancel={() => setTouchMoveDir((prev) => ({...prev, y: 0}))}>
                  ▼
                </button>
                <button
                  className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-800/80 active:bg-zinc-700 border border-zinc-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg touch-none"
                  onPointerDown={() => setTouchMoveDir((prev) => ({...prev, x: 1}))}
                  onPointerUp={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}
                  onPointerLeave={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}
                  onPointerCancel={() => setTouchMoveDir((prev) => ({...prev, x: 0}))}>
                  ▶
                </button>
              </div>
            </div>

            <div className="absolute bottom-8 right-8 pointer-events-auto flex items-center gap-3">
              <button
                className="w-12 h-12 min-w-[48px] min-h-[48px] bg-zinc-800/80 active:bg-zinc-700 border border-zinc-600 rounded-2xl flex items-center justify-center font-bold text-xs text-amber-300 shadow-xl touch-none"
                onClick={() => {
                  if (mpModeRef.current === 'guest') {
                    guestInputRef.current.reload = true;
                  }
                  if (ammo < maxAmmo && !isReloading) {
                    setIsReloading(true);
                    gameAudio.playCrispClick();
                  }
                }}>
                RELOAD
              </button>
              <button
                className="w-16 h-16 min-w-[48px] min-h-[48px] bg-red-600 active:bg-red-500 border-2 border-red-400 rounded-full flex items-center justify-center font-black text-sm text-white shadow-2xl touch-none"
                onPointerDown={() => setIsTouchFiring(true)}
                onPointerUp={() => setIsTouchFiring(false)}
                onPointerLeave={() => setIsTouchFiring(false)}
                onPointerCancel={() => setIsTouchFiring(false)}>
                FIRE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Roguelite Perk Selection Overlay */}
      {showPerkChoice && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-amber-400 tracking-wide text-center uppercase">
              PERK LEVEL UP!
            </h2>
            <p className="text-xs text-zinc-300 text-center mb-5">
              Rival eliminated in duel! Choose a combat upgrade to empower your champion piece:
            </p>

            <div className="w-full flex flex-col gap-3">
              {perkOptions.map((perk) => (
                <button
                  key={perk.id}
                  onClick={() => handleSelectPerk(perk)}
                  className="w-full p-3.5 bg-slate-800/90 hover:bg-slate-700/90 border border-zinc-700 hover:border-amber-400 rounded-xl flex items-start gap-3 transition-all text-left">
                  <div className="p-2 bg-slate-950 rounded-lg shrink-0">
                    {getPerkIcon(perk.icon)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">
                      {perk.name}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {perk.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* Level Complete / Campaign Milestone Overlay */}
      {gameState.status === 'LEVEL_COMPLETE' && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-sky-400 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-400 flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-sky-400" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
              CHAPTER CLEARED!
            </h2>
            <p className="text-amber-400 font-bold text-sm mt-1">
              {currentLevelConfig.name} Completed
            </p>
            <p className="text-xs text-zinc-300 mt-3 leading-relaxed">
              The opposing legion has fallen! Prepare for the next chapter against reinforced enemy divisions with deadlier firepower.
            </p>

            <div className="my-5 w-full bg-slate-950 p-3 rounded-xl border border-zinc-800 text-xs font-mono flex justify-between">
              <span className="text-zinc-400">Total Score:</span>
              <span className="text-amber-300 font-bold">{gameState.score}</span>
            </div>

            <button
              onClick={advanceToNextLevel}
              className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3.5 rounded-full flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
              <span>PROCEED TO CHAPTER {gameState.level + 1}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Indie-Style Start Screen */}
      {gameState.status === 'START' && !autoStartPending && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="bg-slate-900/95 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl flex flex-col items-center w-full max-w-lg border-2 border-amber-500/60 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4 border border-amber-300">
              <Crosshair className="w-8 h-8 text-slate-950 stroke-[2.5]" />
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-400 text-center tracking-tight leading-none mb-1">
              GAMBIT VANGUARD
            </h1>
            <div className="flex items-center gap-2 mb-5">
              <span className="h-[1px] w-8 bg-amber-400/40" />
              <p className="text-amber-300 text-xs font-bold uppercase tracking-widest">
                Chess Strategy · 1v1 FPS Arena · Perks
              </p>
              <span className="h-[1px] w-8 bg-amber-400/40" />
            </div>

            {/* Campaign Chapter Tagline */}
            <div className="w-full bg-slate-950/70 border border-zinc-800 rounded-xl p-3.5 mb-6 text-center">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                Current Campaign Chapter
              </div>
              <div className="text-sm font-black text-amber-400 mt-0.5">
                {currentLevelConfig.name}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                {currentLevelConfig.description}
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="w-full flex flex-col gap-3">
              {mpMode === 'guest' ? (
                <div className="w-full bg-zinc-800/80 border border-zinc-700 text-zinc-300 px-6 py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-2">
                  MULTIPLAYER: YOU ARE BLACK
                </div>
              ) : (
                <button
                  onClick={commenceClick}
                  autoFocus
                  className="w-full bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 px-6 py-4 rounded-2xl font-black text-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-amber-400/25 flex items-center justify-center gap-2">
                  <Play className="w-5 h-5 fill-current" />
                  {mpMode === 'host' ? 'START MULTIPLAYER MATCH' : 'COMMENCE CAMPAIGN'}
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setIsLevelSelectOpen(true)}
                  className="py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors">
                  Chapters
                </button>
                <button
                  onClick={() => setIsArmoryOpen(true)}
                  className="py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors">
                  Armory
                </button>
                <button
                  onClick={() => setIsHowToPlayOpen(true)}
                  className="py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200 transition-colors">
                  Manual
                </button>
              </div>
            </div>

            {/* LAN Multiplayer: optional 2-player mode on local Wi-Fi */}
            <div className="w-full mt-5 border border-zinc-700 rounded-2xl p-4 bg-zinc-900/70">
              <div className="text-xs font-black tracking-widest text-zinc-300 uppercase flex items-center justify-between">
                <span>Multiplayer · Local Wi-Fi · 2 Players</span>
                {mpMode !== 'solo' && (
                  <button
                    onClick={leaveMultiplayer}
                    className="text-rose-400 font-bold normal-case tracking-normal">
                    Leave
                  </button>
                )}
              </div>
              {mpMode === 'solo' && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={hostGame}
                    className="py-2.5 bg-sky-800/80 hover:bg-sky-700/80 border border-sky-600 rounded-xl text-xs font-bold text-sky-100 transition-colors">
                    Host a Game
                  </button>
                  <button
                    onClick={joinGame}
                    className="py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-600 rounded-xl text-xs font-bold text-zinc-100 transition-colors">
                    Join a Game
                  </button>
                </div>
              )}
              {mpMode !== 'solo' && !mpConnected && pairCode && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <canvas ref={qrCanvasRef} className="rounded-lg" width={164} height={164} />
                  <textarea
                    readOnly
                    value={pairCode}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="w-full h-16 text-[10px] bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-300"
                  />
                  <span className="text-[10px] text-zinc-500">
                    {mpMode === 'host' ? 'Your host code' : 'Your reply code'}: send it to the other player, or let them scan the QR code.
                  </span>
                </div>
              )}
              {mpMode === 'host' && !mpConnected && (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    value={pairInput}
                    onChange={(e) => setPairInput(e.target.value)}
                    placeholder="Paste the reply code from the other player"
                    className="w-full h-16 text-[10px] bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-200 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={hostConnect}
                    className="py-2.5 bg-emerald-700/80 hover:bg-emerald-600/80 border border-emerald-500 rounded-xl text-xs font-bold text-emerald-100 transition-colors">
                    Connect
                  </button>
                </div>
              )}
              {mpMode === 'guest' && !mpConnected && !pairCode && (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    value={pairInput}
                    onChange={(e) => setPairInput(e.target.value)}
                    placeholder="Paste the host code"
                    className="w-full h-16 text-[10px] bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-zinc-200 placeholder:text-zinc-600"
                  />
                  <button
                    onClick={guestMakeReply}
                    className="py-2.5 bg-emerald-700/80 hover:bg-emerald-600/80 border border-emerald-500 rounded-xl text-xs font-bold text-emerald-100 transition-colors">
                    Make Reply Code
                  </button>
                </div>
              )}
              {mpStatus && (
                <p className="text-[11px] text-zinc-400 mt-2">{mpStatus}</p>
              )}
              {mpConnected && (
                <p className="text-[11px] text-emerald-400 mt-2 font-bold">
                  Connected. You are {mpMode === 'host' ? 'White' : 'Black'}.
                  {mpMode === 'host'
                    ? ' Press Start Multiplayer Match above.'
                    : ' Waiting for the host to start the match.'}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center gap-4 text-xs text-zinc-400">
              <button
                onClick={() => setIsMusicMuted((prev) => !prev)}
                className="flex items-center gap-1.5 hover:text-white transition-colors">
                {isMusicMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Music</span>
              </button>
              <span>·</span>
              <button
                onClick={() => setIsSfxMuted(gameAudio.toggleMute())}
                className="flex items-center gap-1.5 hover:text-white transition-colors">
                {isSfxMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>SFX</span>
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* Multiplayer Match Result */}
      {mpResult && mpMode !== 'solo' && (
        <MenuOverlay tone="neutral" zIndex={95}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-8 text-center shadow-2xl">
            <h2 className="text-3xl font-black text-amber-400 uppercase tracking-wide">
              {mpResult === (mpMode === 'guest' ? 'black' : 'white')
                ? 'Victory'
                : 'Defeat'}
            </h2>
            <p className="text-sm text-zinc-300 mt-3">
              {mpResult === 'white' ? 'White' : 'Black'} captured the king and
              wins the match.
            </p>
            <p className="text-xs font-mono text-zinc-400 mt-2">
              WHITE {gameState.score} · BLACK {mpBlackScore}
            </p>
            <button
              onClick={() => {
                setMpResult(null);
                setPieces(createInitialBoard(1));
                setCurrentPhase('BOARD');
                setDuelContext(null);
                setGameState((prev) => ({...prev, status: 'START', score: 0}));
              }}
              className="mt-6 w-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-amber-400/25">
              BACK TO TITLE
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Campaign Chapters Modal */}
      {isLevelSelectOpen && (
        <MenuOverlay tone="neutral" zIndex={90}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide mb-4">
              Select Campaign Chapter
            </h2>
            <div className="space-y-3">
              {CAMPAIGN_LEVELS.map((lvl) => (
                <button
                  key={lvl.level}
                  onClick={() => {
                    startRun(lvl.level, (lvl.level - 1) * 500);
                  }}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    gameState.level === lvl.level
                      ? 'bg-amber-950/40 border-amber-400 shadow-md'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-600'
                  }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-sm text-white">
                      {lvl.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      {lvl.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {lvl.description}
                  </p>
                  <div className="text-[10px] text-zinc-500 mt-2 font-mono">
                    Enemy Multiplier: HP x{lvl.enemyHpMultiplier} · Speed x{lvl.enemySpeedMultiplier}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsLevelSelectOpen(false)}
              className="mt-5 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-xl text-zinc-200">
              Back
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Armory & Weapons Codex Modal */}
      {isArmoryOpen && (
        <MenuOverlay tone="neutral" zIndex={90}>
          <div className="w-full max-w-xl bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-amber-400 uppercase">
                Chess Armory & Weapons Codex
              </h2>
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Every chess rank commands a dedicated primary firearm tailored to tactical duel dominance:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(PIECE_WEAPONS) as (keyof typeof PIECE_WEAPONS)[]).map((type) => {
                const w = PIECE_WEAPONS[type];
                return (
                  <div
                    key={type}
                    className="p-3.5 bg-slate-950 rounded-xl border border-zinc-800 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-white capitalize">
                          {type}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{backgroundColor: `${w.color}25`, color: w.color}}>
                          {w.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1.5 leading-snug">
                        {w.description}
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-900 grid grid-cols-3 gap-1 text-[10px] font-mono text-zinc-400">
                      <div>Dmg: <span className="text-white font-bold">{w.damage}</span></div>
                      <div>RoF: <span className="text-white font-bold">{w.fireRate}/s</span></div>
                      <div>Mag: <span className="text-white font-bold">{w.ammoMax}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsArmoryOpen(false)}
              className="mt-5 w-full py-2.5 bg-amber-400 text-slate-950 font-bold rounded-xl hover:bg-amber-300 text-xs">
              Close Armory
            </button>
          </div>
        </MenuOverlay>
      )}

      {/* Victory Screen */}
      {gameState.status === 'VICTORY' && (
        <Overlay
          title="CAMPAIGN CONQUERED"
          description={`Grandmaster fallen! You have cleared all 3 Chapters. Final Score: ${gameState.score}`}
          actionLabel="PLAY AGAIN"
          onAction={resetGame}
          icon={<RotateCw size={24} />}
          tone="victory"
        />
      )}

      {/* Game Over Screen */}
      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="ROYAL DEFEAT"
          description={`Your King was eliminated in battle. Score: ${gameState.score}`}
          actionLabel="TRY AGAIN"
          onAction={initGame}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}

      {/* Pause / In-Game Menu Overlay */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={80}>
          <div className="w-full max-w-md bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center">
            <h2 className="text-2xl font-black text-amber-400 mb-6 uppercase tracking-wider">
              TACTICAL MENU
            </h2>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => setIsGameMenuOpen(false)}
                className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-yellow-400 transition-colors">
                Resume Battle
              </button>

              <div className="grid grid-cols-2 gap-2 my-2">
                <button
                  onClick={() => setIsMusicMuted((prev) => !prev)}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                  {isMusicMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  Music: {isMusicMuted ? 'Off' : 'On'}
                </button>
                <button
                  onClick={() => {
                    const newMuted = gameAudio.toggleMute();
                    setIsSfxMuted(newMuted);
                  }}
                  className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                  {isSfxMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                  SFX: {isSfxMuted ? 'Off' : 'On'}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  startRun(gameStateRef.current.level, levelStartScoreRef.current);
                }}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200">
                Try Level Again
              </button>

              <button
                onClick={() => setIsHowToPlayOpen(true)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-200">
                How to Play
              </button>

              <button
                onClick={() => {
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full py-2.5 bg-rose-900/60 hover:bg-rose-900 border border-rose-800 rounded-xl text-xs font-bold text-rose-200 mt-2">
                Quit to Title Screen
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* How To Play Overlay */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={100}>
          <div className="w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-black text-amber-400 mb-4 uppercase">
              Field Manual · Gambit Vanguard
            </h2>
            <div className="text-xs text-zinc-300 space-y-3 leading-relaxed">
              <p>
                <strong className="text-white">1. Chess Positioning:</strong> Move your pieces across standard chess lines. White moves first; enemy grandmaster counters.
              </p>
              <p>
                <strong className="text-white">2. 1v1 FPS Arena Duel:</strong> Stepping onto an opponent square immediately drops you both into the colosseum arena for a real-time gun duel.
              </p>
              <p>
                <strong className="text-white">3. Roguelite Perks:</strong> Eliminating a rival piece unlocks a choice of 3 permanent upgrades (HP, damage, fire rate, ammo capacity, speed) that carry over across the match.
              </p>
              <p>
                <strong className="text-white">4. Three Campaign Chapters:</strong> Fight through the Ivory Bastion, Crimson Citadel, and Void Grandmaster to achieve total victory!
              </p>
            </div>
            <button
              onClick={() => setIsHowToPlayOpen(false)}
              className="mt-6 w-full py-2.5 bg-amber-400 text-slate-950 font-bold rounded-xl hover:bg-amber-300 text-xs">
              Close Manual
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
