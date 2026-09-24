// Study-level policy and the catalog references it depends on.
//
// Everything here points at the generated catalog by family name or family id, so it is the part of
// the app most likely to rot when `src/openings.js` is regenerated. It lives in its own module so
// the test suite can assert that every one of these references still resolves against the shipped
// catalog instead of silently hiding a study level or a recommendation.

export const BEGINNER_FAMILIES = new Set(['Italian Game','Scotch Game','Four Knights Game','Ruy Lopez','Vienna Game',"Queen's Gambit",'London System','English Opening',"King's Indian Attack",'Sicilian Defense','French Defense','Caro-Kann Defense','Scandinavian Defense','Pirc Defense',"King's Indian Defense",'Slav Defense','Dutch Defense']);

export const INTERMEDIATE_FAMILIES = new Set([...BEGINNER_FAMILIES,'Alekhine Defense','Benoni Defense','Benko Gambit',"Bishop's Opening",'Catalan Opening','English Defense','Grünfeld Defense','Modern Defense','Nimzo-Indian Defense','Nimzo-Larsen Attack',"Queen's Indian Defense",'Réti Opening','Semi-Slav Defense','Three Knights Opening','Trompowsky Attack','Bird Opening','Danish Gambit',"King's Gambit","Petrov's Defense",'Philidor Defense']);

export const RECOMMENDATIONS = [
  { name:'Italian Game', reason:'Natural development and clear attacking plans.', levels:['beginner','intermediate','advanced'] },
  { name:"Queen's Gambit", reason:'A principled introduction to positional chess.', levels:['beginner','intermediate','advanced'] },
  { name:'London System', reason:'A dependable setup that is easy to revisit.', levels:['beginner','intermediate'] },
  { name:'Caro-Kann Defense', reason:'A sound, structured answer to 1.e4.', levels:['beginner','intermediate','advanced'] },
  { name:'French Defense', reason:'Teaches pawn chains and counterplay.', levels:['beginner','intermediate','advanced'] },
  { name:'Sicilian Defense', reason:'Dynamic winning chances against 1.e4.', levels:['intermediate','advanced'] },
  { name:'Ruy Lopez', reason:'Classic strategic themes at every level.', levels:['intermediate','advanced'] },
  { name:"King's Indian Defense", reason:'Active kingside play against 1.d4.', levels:['intermediate','advanced'] },
  { name:'Nimzo-Indian Defense', reason:'Rich positional play without a passive setup.', levels:['advanced'] },
];

export const STUDY_LEVELS = ['beginner','intermediate','advanced'];

// The family opened on a fresh install so the first line list is visible without a click.
export const DEFAULT_EXPANDED_FAMILY = 'italian-game';

// Lines shorter than this many plies are treated as short sidelines, except main lines.
export const SHORT_LINE_PLY = 8;
export const BEGINNER_MAX_PLY = 10;

const LINE_LIMIT = { beginner:8, intermediate:14 };

export function openingForLevel(opening, level, showShortLines) {
  const keepLine = line => showShortLines || line.moves.length >= SHORT_LINE_PLY || line.name === 'Main line';
  if (level === 'advanced') {
    const lines = opening.lines.filter(keepLine);
    return lines.length ? { ...opening, lines } : null;
  }
  const allowed = level === 'beginner' ? BEGINNER_FAMILIES : INTERMEDIATE_FAMILIES;
  if (!allowed.has(opening.name)) return null;
  const limit = level === 'beginner' ? LINE_LIMIT.beginner : LINE_LIMIT.intermediate;
  const candidates = level === 'beginner'
    ? opening.lines.filter(line => line.moves.length <= BEGINNER_MAX_PLY)
    : opening.lines;
  const lines = candidates.filter(keepLine).sort((a,b) => a.moves.length-b.moves.length || a.name.localeCompare(b.name)).slice(0,limit);
  if (!lines.length) return null;
  return { ...opening, lines, description:`${lines.length} ${level} ${lines.length===1?'line':'lines'}` };
}

export function levelCatalogFor(openings, level, showShortLines) {
  return openings.map(opening => openingForLevel(opening, level, showShortLines)).filter(Boolean);
}

// Family names this module references but that the shipped catalog no longer contains.
export function missingFamilyReferences(openings) {
  const names = new Set(openings.map(opening => opening.name));
  const referenced = [...BEGINNER_FAMILIES, ...INTERMEDIATE_FAMILIES, ...RECOMMENDATIONS.map(item => item.name)];
  return [...new Set(referenced)].filter(name => !names.has(name)).sort();
}

export function missingIdReferences(openings) {
  const ids = new Set(openings.map(opening => opening.id));
  return ids.has(DEFAULT_EXPANDED_FAMILY) ? [] : [DEFAULT_EXPANDED_FAMILY];
}
