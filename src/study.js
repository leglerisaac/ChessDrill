// Study-level policy and the catalog references it depends on.
//
// Every family name and id here points into the generated catalog, so this is the part of the app
// most likely to rot when `src/openings.js` is regenerated. It lives in its own module so the test
// suite can assert that each reference still resolves instead of silently hiding a study level or a
// recommendation.

export const BEGINNER_FAMILIES = new Set(['Italian Game','Scotch Game','Four Knights Game','Ruy Lopez','Vienna Game',"Queen's Gambit",'London System','English Opening',"King's Indian Attack",'Sicilian Defense','French Defense','Caro-Kann Defense','Scandinavian Defense','Pirc Defense',"King's Indian Defense",'Slav Defense','Dutch Defense']);

export const INTERMEDIATE_FAMILIES = new Set([...BEGINNER_FAMILIES,'Alekhine Defense','Benoni Defense','Benko Gambit',"Bishop's Opening",'Catalan Opening','English Defense','Grünfeld Defense','Modern Defense','Nimzo-Indian Defense','Nimzo-Larsen Attack',"Queen's Indian Defense",'Réti Opening','Semi-Slav Defense','Three Knights Opening','Trompowsky Attack','Bird Opening','Danish Gambit',"King's Gambit","Petrov's Defense",'Philidor Defense']);

// [family name, reason] pairs shown in the library's recommendation grid.
export const RECOMMENDATIONS = [['Italian Game','Natural development and clear attacking plans.'],["Queen's Gambit",'A principled introduction to positional chess.'],['London System','A dependable setup that is easy to revisit.'],['Caro-Kann Defense','A sound, structured answer to 1.e4.'],['French Defense','Teaches pawn chains and counterplay.'],['Sicilian Defense','Dynamic winning chances against 1.e4.'],['Ruy Lopez','Classic strategic themes at every level.'],["King's Indian Defense",'Active kingside play against 1.d4.']];

export const STUDY_LEVELS = ['beginner','intermediate','advanced'];

// The family opened when nothing is saved yet, so the first line list is visible without a click.
export const DEFAULT_EXPANDED_FAMILY = 'italian-game';

// Which families start expanded. Persisted ids are already validated against the catalog, but the
// store normalizes a missing selection to an empty array, so the fallback has to cover that case
// too or the intended first-run default never applies.
export function expandedFamilies(savedExpanded) {
  return savedExpanded?.length ? savedExpanded : [DEFAULT_EXPANDED_FAMILY];
}

// Synthetic family for imported PGN lines. It is not part of the generated catalog, so the reference
// guards must ignore it. Its lines bypass the family-set check at every level, but the level's own
// length limits still apply to them.
const CUSTOM_FAMILY = 'custom-repertoire';

// Lines shorter than this many plies count as short sidelines, except family main lines.
export const SHORT_LINE_PLY = 8;
export const BEGINNER_MAX_PLY = 10;
export const LINE_LIMIT = { beginner:8, intermediate:14 };

export function openingForLevel(opening, level, showShortLines) {
  const custom = opening.id === CUSTOM_FAMILY;
  const keep = line => showShortLines || line.moves.length >= SHORT_LINE_PLY || line.name === 'Main line' || custom;
  if (level === 'advanced') return { ...opening, lines:opening.lines.filter(keep) };
  const allowed = level === 'beginner' ? BEGINNER_FAMILIES : INTERMEDIATE_FAMILIES;
  if (!custom && !allowed.has(opening.name)) return null;
  let lines = opening.lines.filter(keep);
  if (level === 'beginner') lines = lines.filter(line => line.moves.length <= BEGINNER_MAX_PLY || line.name === 'Main line');
  lines.sort((a, b) => a.moves.length - b.moves.length || a.name.localeCompare(b.name));
  lines = lines.slice(0, level === 'beginner' ? LINE_LIMIT.beginner : LINE_LIMIT.intermediate);
  return lines.length ? { ...opening, lines, description:LINE_DESCRIPTION(lines.length, level) } : null;
}

// Kept as a function so the level wording lives in one place.
export function LINE_DESCRIPTION(count, level) { return count + ' ' + level + ' lines'; }

export function levelCatalogFor(openings, level, showShortLines) {
  return openings.map(opening => openingForLevel(opening, level, showShortLines)).filter(opening => opening?.lines.length);
}

// Family names this module references that the shipped catalog no longer contains.
export function missingFamilyReferences(openings) {
  const names = new Set(openings.map(opening => opening.name));
  const referenced = [...BEGINNER_FAMILIES, ...INTERMEDIATE_FAMILIES, ...RECOMMENDATIONS.map(([name]) => name)];
  return [...new Set(referenced)].filter(name => !names.has(name)).sort();
}

// Catalog ids this module references that the shipped catalog no longer contains.
export function missingIdReferences(openings) {
  return openings.some(opening => opening.id === DEFAULT_EXPANDED_FAMILY) ? [] : [DEFAULT_EXPANDED_FAMILY];
}
