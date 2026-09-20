import { Chess } from 'chess.js';

export function linePositions(line) {
  const chess = new Chess();
  return line.moves.map((san, index) => {
    const fen = chess.fen();
    const turn = chess.turn();
    const move = chess.move(san);
    if (!move) throw new Error(`Invalid move ${san} in ${line.name}`);
    return { index, fen, turn, san, from: move.from, to: move.to, afterFen: chess.fen() };
  });
}

export function createDrill(line, color = line.repertoireColor, maxPly = line.moves.length) {
  const positions = linePositions(line).slice(0, maxPly);
  const userTurn = color === 'white' ? 'w' : 'b';
  const prompts = positions.filter(position => position.turn === userTurn);
  return { line, color, positions, prompts };
}

export function playableLines(lines, side = 'repertoire', maxPly) {
  return lines.filter(line => {
    const color = side === 'repertoire' ? line.repertoireColor : side;
    return createDrill(line, color, maxPly).prompts.length > 0;
  });
}

export function weightedPick(items, stats = {}, random = Math.random) {
  if (!items.length) return null;
  const weights = items.map(item => {
    const stat = stats[item.id] || { attempts: 0, correct: 0 };
    const accuracy = stat.attempts ? stat.correct / stat.attempts : 0;
    return 1 + (1 - accuracy) * 3 + Math.max(0, 3 - stat.attempts);
  });
  let cursor = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return items[i];
  }
  return items.at(-1);
}

export function parseMove(chess, from, to) {
  const moves = chess.moves({ square: from, verbose: true });
  return moves.find(move => move.to === to && (!move.promotion || move.promotion === 'q')) || null;
}
