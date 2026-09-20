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

// How many leading plies `linePositions(line).slice(0, maxPly)` keeps - i.e. exactly what
// createDrill would see. Mirrors Array.prototype.slice's relative-end and Infinity rules.
function pliesWithin(line, maxPly) {
  const end = Number(maxPly);
  if (end === Infinity) return line.moves.length;
  if (!Number.isFinite(end)) return 0;
  const limit = Math.trunc(end);
  return limit < 0 ? Math.max(0, line.moves.length + limit) : Math.min(line.moves.length, limit);
}

// Plies alternate White, Black, White, ... from the opening position, so a side only gets a prompt
// once the line reaches its own first ply. Kept free of chess.js because the library filters
// thousands of candidate lines on every render; the test suite pins it to createDrill.
export function isLinePlayable(line, side = 'repertoire', maxPly = line.moves.length) {
  const color = side === 'repertoire' ? line.repertoireColor : side;
  const plies = pliesWithin(line, maxPly);
  return color === 'white' ? plies >= 1 : plies >= 2;
}

export function playableLines(lines, side = 'repertoire', maxPly) {
  return lines.filter(line => isLinePlayable(line, side, maxPly));
}

// The exact pool a drill can be started from: selected, allowed at the current study level, and
// playable by the side being practised.
export function drillableLines(lines, selectedIds, eligibleIds, side = 'repertoire', maxPly) {
  return playableLines(eligibleSelectedLines(lines, selectedIds, eligibleIds), side, maxPly);
}

const DAY_MS = 86400000;

function whole(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function sanitizeStat(stat) {
  const attempts = whole(stat?.attempts);
  const lastSeenAt = Number(stat?.lastSeenAt);
  return {
    attempts,
    correct: Math.min(attempts, whole(stat?.correct)),
    completions: whole(stat?.completions),
    streak: whole(stat?.streak),
    lastSeenAt: Number.isFinite(lastSeenAt) && lastSeenAt > 0 ? lastSeenAt : 0,
  };
}

export function practicedLines(lines, stats = {}) {
  return lines.filter(line => sanitizeStat(stats[line.id]).attempts > 0);
}

// Days a line rests after a clean completion. Every consecutive clean run doubles the gap, so a
// line you keep getting right stops interrupting the ones you keep missing.
export function restDays(streak = 0) {
  return Math.min(16, 2 ** Math.min(whole(streak), 4));
}

// How overdue a line is, measured in its own rest intervals. Never-practiced lines count as due.
export function overdueRatio(stat, now = Date.now()) {
  const { lastSeenAt, streak } = sanitizeStat(stat);
  if (!lastSeenAt) return 1;
  const days = (Number(now) - lastSeenAt) / DAY_MS;
  if (!Number.isFinite(days) || days <= 0) return 0;
  return days / restDays(streak);
}

export function lineWeight(stat, now = Date.now()) {
  const { attempts, correct } = sanitizeStat(stat);
  const accuracy = attempts ? correct / attempts : 0;
  const newBoost = Math.max(0, 3 - attempts);
  const missBoost = (1 - accuracy) * 3;
  const leechBoost = attempts >= 3 && accuracy < 0.5 ? 2 : 0;
  const dueBoost = Math.min(4, overdueRatio(stat, now)) * 0.5;
  return 1 + newBoost + missBoost + leechBoost + dueBoost;
}

export function weightedPick(items, stats = {}, random = Math.random, now = Date.now()) {
  if (!items.length) return null;
  const weights = items.map(item => lineWeight(stats[item.id], now));
  let cursor = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return items[i];
  }
  return items.at(-1);
}

export function eligibleSelectedLines(lines, selectedIds, eligibleIds) {
  return lines.filter(line => selectedIds.has(line.id) && eligibleIds.has(line.id));
}

export function theoryOptions(candidates, cursor) {
  const options = new Map();
  for (const line of candidates) {
    const san = line.moves[cursor];
    if (!san) continue;
    if (!options.has(san)) options.set(san, []);
    options.get(san).push(line);
  }
  return options;
}

export function chooseTheoryMove(options, difficulty = 'common', random = Math.random) {
  const entries = [...options.entries()];
  if (!entries.length) return null;
  const weights = entries.map(([, lines]) => difficulty === 'wild' ? 1 : difficulty === 'varied' ? Math.sqrt(lines.length) : lines.length);
  let cursor = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return { san:entries[index][0], candidates:entries[index][1] };
  }
  return { san:entries.at(-1)[0], candidates:entries.at(-1)[1] };
}

export function parseMove(chess, from, to) {
  const moves = chess.moves({ square: from, verbose: true });
  return moves.find(move => move.to === to && (!move.promotion || move.promotion === 'q')) || null;
}
