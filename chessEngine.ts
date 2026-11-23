import {ChessPiece, PieceColor, PieceType} from './types';

export function createInitialBoard(level = 1): ChessPiece[] {
  const pieces: ChessPiece[] = [];
  const backRank: PieceType[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
    'king',
    'bishop',
    'knight',
    'rook',
  ];

  // White pieces (Rows 6 and 7; Row 7 is back rank)
  for (let c = 0; c < 8; c++) {
    pieces.push({
      id: `w_pawn_${c}`,
      type: 'pawn',
      color: 'white',
      row: 6,
      col: c,
      alive: true,
      perks: [],
      maxHp: 100,
      currentHp: 100,
      kills: 0,
    });
    pieces.push({
      id: `w_${backRank[c]}_${c}`,
      type: backRank[c],
      color: 'white',
      row: 7,
      col: c,
      alive: true,
      perks: [],
      maxHp: 120,
      currentHp: 120,
      kills: 0,
    });
  }

  // Black pieces (Scales with level)
  const enemyHpMultiplier = level === 1 ? 1.0 : level === 2 ? 1.3 : 1.65;
  for (let c = 0; c < 8; c++) {
    const baseBackHp = Math.round(110 * enemyHpMultiplier);
    const basePawnHp = Math.round(90 * enemyHpMultiplier);

    pieces.push({
      id: `b_${backRank[c]}_${c}`,
      type: backRank[c],
      color: 'black',
      row: 0,
      col: c,
      alive: true,
      perks: [],
      maxHp: baseBackHp,
      currentHp: baseBackHp,
      kills: 0,
    });
    pieces.push({
      id: `b_pawn_${c}`,
      type: 'pawn',
      color: 'black',
      row: 1,
      col: c,
      alive: true,
      perks: [],
      maxHp: basePawnHp,
      currentHp: basePawnHp,
      kills: 0,
    });
  }

  return pieces;
}

export function getPieceAt(
  pieces: ChessPiece[],
  row: number,
  col: number,
): ChessPiece | undefined {
  return pieces.find((p) => p.alive && p.row === row && p.col === col);
}

export interface ValidMove {
  row: number;
  col: number;
  isCapture: boolean;
}

export function getValidMoves(
  piece: ChessPiece,
  allPieces: ChessPiece[],
): ValidMove[] {
  if (!piece.alive) return [];
  const moves: ValidMove[] = [];
  const isWhite = piece.color === 'white';
  const forwardDir = isWhite ? -1 : 1;

  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

  switch (piece.type) {
    case 'pawn': {
      // 1 square forward
      const oneStepR = piece.row + forwardDir;
      if (inBounds(oneStepR, piece.col) && !getPieceAt(allPieces, oneStepR, piece.col)) {
        moves.push({row: oneStepR, col: piece.col, isCapture: false});

        // 2 squares forward from start rank
        const startRank = isWhite ? 6 : 1;
        const twoStepR = piece.row + forwardDir * 2;
        if (
          piece.row === startRank &&
          inBounds(twoStepR, piece.col) &&
          !getPieceAt(allPieces, twoStepR, piece.col)
        ) {
          moves.push({row: twoStepR, col: piece.col, isCapture: false});
        }
      }

      // Diagonal attacks
      const attackCols = [piece.col - 1, piece.col + 1];
      for (const ac of attackCols) {
        if (inBounds(oneStepR, ac)) {
          const target = getPieceAt(allPieces, oneStepR, ac);
          if (target && target.color !== piece.color) {
            moves.push({row: oneStepR, col: ac, isCapture: true});
          }
        }
      }
      break;
    }

    case 'knight': {
      const jumps = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of jumps) {
        const nr = piece.row + dr;
        const nc = piece.col + dc;
        if (inBounds(nr, nc)) {
          const occ = getPieceAt(allPieces, nr, nc);
          if (!occ) {
            moves.push({row: nr, col: nc, isCapture: false});
          } else if (occ.color !== piece.color) {
            moves.push({row: nr, col: nc, isCapture: true});
          }
        }
      }
      break;
    }

    case 'bishop': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      raycastMoves(piece, dirs, allPieces, moves);
      break;
    }

    case 'rook': {
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      raycastMoves(piece, dirs, allPieces, moves);
      break;
    }

    case 'queen': {
      const dirs = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      raycastMoves(piece, dirs, allPieces, moves);
      break;
    }

    case 'king': {
      const kingDirs = [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ];
      for (const [dr, dc] of kingDirs) {
        const nr = piece.row + dr;
        const nc = piece.col + dc;
        if (inBounds(nr, nc)) {
          const occ = getPieceAt(allPieces, nr, nc);
          if (!occ) {
            moves.push({row: nr, col: nc, isCapture: false});
          } else if (occ.color !== piece.color) {
            moves.push({row: nr, col: nc, isCapture: true});
          }
        }
      }
      break;
    }
  }

  return moves;
}

function raycastMoves(
  piece: ChessPiece,
  dirs: number[][],
  allPieces: ChessPiece[],
  moves: ValidMove[],
) {
  for (const [dr, dc] of dirs) {
    let r = piece.row + dr;
    let c = piece.col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const occ = getPieceAt(allPieces, r, c);
      if (!occ) {
        moves.push({row: r, col: c, isCapture: false});
      } else {
        if (occ.color !== piece.color) {
          moves.push({row: r, col: c, isCapture: true});
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

/** Pick a heuristic AI move for Black pieces. Prefers captures or advancing. */
export function getAiMove(allPieces: ChessPiece[]): {
  piece: ChessPiece;
  target: ValidMove;
} | null {
  const blackPieces = allPieces.filter((p) => p.alive && p.color === 'black');
  const allPossible: {piece: ChessPiece; target: ValidMove; score: number}[] = [];

  for (const p of blackPieces) {
    const valid = getValidMoves(p, allPieces);
    for (const v of valid) {
      let score = 0;
      if (v.isCapture) {
        const targetPiece = getPieceAt(allPieces, v.row, v.col);
        if (targetPiece) {
          const valMap: Record<PieceType, number> = {
            king: 100,
            queen: 9,
            rook: 5,
            bishop: 3.5,
            knight: 3,
            pawn: 1,
          };
          score = (valMap[targetPiece.type] || 1) * 10;
        }
      } else {
        // Advance pawns and knights
        score = v.row * 0.5 + Math.random() * 0.8;
      }
      allPossible.push({piece: p, target: v, score});
    }
  }

  if (allPossible.length === 0) return null;
  allPossible.sort((a, b) => b.score - a.score);

  // Pick from top best candidates to add slight variety
  const topCandidates = allPossible.filter(
    (c) => c.score >= allPossible[0].score - 1.5,
  );
  const choice =
    topCandidates[Math.floor(Math.random() * topCandidates.length)];
  return {piece: choice.piece, target: choice.target};
}
