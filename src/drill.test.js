import { describe, expect, it } from 'vitest';
import { OPENINGS, allLines } from './openings.js';
import { chooseTheoryMove, createDrill, drillableLines, eligibleSelectedLines, isLinePlayable, linePositions, lineWeight, overdueRatio, playableLines, practicedLines, restDays, sanitizeStat, theoryOptions, weightedPick } from './drill.js';

describe('opening data', () => {
  it('contains only legal move sequences', () => {
    for (const line of allLines()) expect(() => linePositions(line)).not.toThrow();
  });
  it('creates prompts for the selected repertoire color', () => {
    const white = allLines().find(line => line.repertoireColor === 'white');
    expect(createDrill(white, 'white').prompts.every(p => p.turn === 'w')).toBe(true);
  });
  it('prioritizes an unpracticed line with deterministic randomness', () => {
    const items = [{ id:'mastered' }, { id:'new' }];
    const picked = weightedPick(items, { mastered:{attempts:10,correct:10} }, () => .99);
    expect(picked.id).toBe('new');
  });
  it('does not schedule selected lines that were purged or hidden', () => {
    const lines = [{ id:'active' }, { id:'hidden' }];
    const selected = new Set(['active', 'hidden', 'purged']);
    const eligible = new Set(['active']);
    expect(eligibleSelectedLines(lines, selected, eligible)).toEqual([{ id:'active' }]);
  });
  it('has exactly one main line per organized opening family', () => {
    for (const opening of OPENINGS) expect(opening.lines.filter(line => line.name === 'Main line')).toHaveLength(1);
  });
  it('has globally unique line IDs and no duplicate move sequences within a family', () => {
    const ids = allLines().map(line => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const opening of OPENINGS) {
      const sequences = opening.lines.map(line => line.moves.join(' '));
      expect(new Set(sequences).size).toBe(sequences.length);
    }
  });
  it("organizes Queen's Gambit accepted and declined theory under Queen's Gambit", () => {
    const queensGambit = OPENINGS.find(opening => opening.name === "Queen's Gambit");
    expect(queensGambit.lines.some(line => line.name.startsWith('Accepted'))).toBe(true);
    expect(queensGambit.lines.some(line => line.name.startsWith('Declined'))).toBe(true);
    expect(OPENINGS.some(opening => opening.name === "Queen's Gambit Accepted")).toBe(false);
    expect(OPENINGS.some(opening => opening.name === "Queen's Gambit Declined")).toBe(false);
  });
  it('keeps every documented branch matching the moves played in a theory challenge', () => {
    const candidates = [
      { id:'a', moves:['e4','e5','Nf3'] },
      { id:'b', moves:['e4','c5','Nf3'] },
      { id:'c', moves:['d4','d5','c4'] },
    ];
    const firstMoves = theoryOptions(candidates, 0);
    expect(firstMoves.get('e4').map(line=>line.id)).toEqual(['a','b']);
    const replies = theoryOptions(firstMoves.get('e4'), 1);
    expect([...replies.keys()]).toEqual(['e5','c5']);
  });
  it('uses broader opponent reply weighting at higher theory difficulty', () => {
    const common = Array.from({length:9},(_,i)=>({id:`c${i}`}));
    const rare = [{id:'rare'}];
    const options = new Map([['e5',common],['c5',rare]]);
    expect(chooseTheoryMove(options,'common',()=>0.5).san).toBe('e5');
    expect(chooseTheoryMove(options,'wild',()=>0.75).san).toBe('c5');
  });
});

describe('drill side eligibility', () => {
  it('only schedules lines the practising side actually gets a move in', () => {
    const sample = allLines().filter(line => line.moves.length <= 6);
    expect(sample.length).toBeGreaterThan(100);
    for (const side of ['white', 'black', 'repertoire']) {
      for (const maxPly of [2, 6]) {
        const expected = sample
          .filter(line => createDrill(line, side === 'repertoire' ? line.repertoireColor : side, maxPly).prompts.length > 0)
          .map(line => line.id);
        expect(playableLines(sample, side, maxPly).map(line => line.id)).toEqual(expected);
      }
    }
  });
  it('never offers a one-move main line to the other side', () => {
    const english = allLines().find(line => line.openingName === 'English Opening' && line.name === 'Main line');
    expect(english.moves).toEqual(['c4']);
    expect(playableLines([english], 'black', 14)).toEqual([]);
    expect(playableLines([english], 'white', 14)).toEqual([english]);
    expect(playableLines([english], 'repertoire', 14)).toEqual([english]);
  });
  it('needs at least two plies before black can be to move', () => {
    const line = { id:'t', name:'T', repertoireColor:'white', moves:['e4','e5','Nf3'] };
    expect(isLinePlayable(line, 'black', 1)).toBe(false);
    expect(isLinePlayable(line, 'black', 2)).toBe(true);
    expect(isLinePlayable(line, 'white', 1)).toBe(true);
    expect(isLinePlayable(line, 'black', 'abc')).toBe(false);
    expect(isLinePlayable({ id:'t', name:'T', repertoireColor:'black', moves:['e4'] }, 'repertoire', 14)).toBe(false);
  });
  it('keeps a selected, eligible line with no move for the side out of the drill pool', () => {
    const english = allLines().find(line => line.openingName === 'English Opening' && line.name === 'Main line');
    const ids = new Set([english.id]);
    expect(drillableLines(allLines(), ids, ids, 'white', 14).map(line => line.id)).toEqual([english.id]);
    expect(drillableLines(allLines(), ids, ids, 'repertoire', 14).map(line => line.id)).toEqual([english.id]);
    expect(drillableLines(allLines(), ids, ids, 'black', 14)).toEqual([]);
  });
  it('matches createDrill for every depth value the app could ever persist', () => {
    const sample = allLines().filter((line, index) => index % 125 === 0);
    const depths = [undefined, null, 0, 1, 2, 3, 4, 14, 30, 1e9, Infinity, -Infinity, -0, -1, -5, -100, NaN, 'abc', '3', 2.5, true, false, ''];
    for (const side of ['white', 'black', 'repertoire']) {
      for (const maxPly of depths) {
        const expected = sample
          .filter(line => createDrill(line, side === 'repertoire' ? line.repertoireColor : side, maxPly).prompts.length > 0)
          .map(line => line.id);
        expect(playableLines(sample, side, maxPly).map(line => line.id)).toEqual(expected);
      }
    }
  });
  it('never leaves an unplayable line in the pool for a full selection', () => {
    const lines = allLines();
    const ids = new Set(lines.map(line => line.id));
    const pool = drillableLines(lines, ids, ids, 'black', 14);
    expect(pool.length).toBe(lines.filter(line => line.moves.length > 1).length);
    expect(pool.length).toBeLessThan(lines.length);
  });
  it('leaves every line drillable for its own repertoire color', () => {
    const lines = allLines();
    expect(playableLines(lines, 'repertoire', 14)).toHaveLength(lines.length);
  });
});

describe('spaced review scheduling', () => {
  const DAY = 86400000;
  const now = 1700000000000;
  const mastered = { attempts:6, correct:6, completions:3, streak:3, lastSeenAt:now };

  it('rests a line that was just answered cleanly and revives it once overdue', () => {
    expect(lineWeight(mastered, now)).toBe(1);
    expect(lineWeight({ ...mastered, lastSeenAt: now - 32 * DAY }, now)).toBeGreaterThan(1);
  });
  it('rests a line for longer after a longer clean streak', () => {
    expect(restDays(0)).toBe(1);
    expect(restDays(2)).toBe(4);
    expect(restDays(4)).toBe(16);
    expect(restDays(99)).toBe(16);
    const stat = { attempts:5, correct:5, lastSeenAt: now - 3 * DAY };
    expect(lineWeight({ ...stat, streak:4 }, now)).toBeLessThan(lineWeight({ ...stat, streak:0 }, now));
  });
  it('keeps a repeatedly missed line heavier than a mastered one seen the same day', () => {
    expect(lineWeight({ attempts:6, correct:1, streak:0, lastSeenAt:now }, now)).toBeGreaterThan(lineWeight(mastered, now));
  });
  it('still gives a brand new line priority over one that is merely overdue', () => {
    const overdue = { attempts:5, correct:5, streak:2, lastSeenAt: now - 200 * DAY };
    expect(lineWeight(undefined, now)).toBeGreaterThan(lineWeight(overdue, now));
    expect(weightedPick([{ id:'overdue' }, { id:'fresh' }], { overdue }, () => .99, now).id).toBe('fresh');
  });
  it('puts a line you keep failing and have not seen for days ahead of a line you have never tried', () => {
    const leech = { attempts:1, correct:0, streak:0, lastSeenAt: now - 4 * DAY };
    expect(lineWeight(leech, now)).toBeGreaterThan(lineWeight(undefined, now));
    expect(weightedPick([{ id:'leech' }, { id:'never' }], { leech }, () => .5, now).id).toBe('leech');
  });
  it('keeps a chronically missed line heavy enough to outrank a merely patchy one', () => {
    const borderline = { attempts:3, correct:2, streak:0, lastSeenAt: now };
    const leech = { attempts:3, correct:1, streak:0, lastSeenAt: now };
    expect(lineWeight(leech, now)).toBeGreaterThan(lineWeight(borderline, now));
    expect(weightedPick([{ id:'borderline' }, { id:'leech' }], { borderline, leech }, () => .2, now).id).toBe('borderline');
    expect(weightedPick([{ id:'borderline' }, { id:'leech' }], { borderline, leech }, () => .35, now).id).toBe('leech');
  });
  it('ranks overdue work with a deterministic pick that the old accuracy-only weight got wrong', () => {
    const overdue = { attempts:3, correct:0, streak:0, lastSeenAt: now - 100 * DAY };
    const rested = { attempts:3, correct:3, streak:2, lastSeenAt: now };
    const stats = { overdue, rested };
    expect(lineWeight(overdue, now)).toBeGreaterThan(lineWeight(rested, now));
    expect(weightedPick([{ id:'overdue' }, { id:'rested' }], stats, () => .5, now).id).toBe('overdue');
    expect(weightedPick([{ id:'overdue' }, { id:'rested' }], stats, () => .999999, now).id).toBe('rested');
  });
  it('survives corrupt persisted stats instead of poisoning the pick', () => {
    const corrupt = [{}, { attempts:'x', correct:1 }, { attempts:-3 }, { attempts:2, correct:9 }, { attempts:0, correct:0, completions:1 }, { attempts:1e308, correct:1e308 }, { lastSeenAt:'nope' }, { attempts:5, correct:5, streak:1e9 }, { attempts:5, correct:5, lastSeenAt:NaN }, { attempts:5, correct:5, lastSeenAt:-1e15 }, null];
    for (const stat of corrupt) {
      expect(Number.isFinite(lineWeight(stat, now))).toBe(true);
      expect(lineWeight(stat, now)).toBeGreaterThan(0);
    }
    const items = [{ id:'a' }, { id:'b' }, { id:'c' }];
    const stats = { a:{}, b:{ attempts:'x' }, c:{ attempts:2, correct:9 } };
    // a and b sanitize to the same new-line weight; c is a finished 2/2 line, so it ranks last.
    expect(weightedPick(items, stats, () => 0, now).id).toBe('a');
    expect(weightedPick(items, stats, () => .1, now).id).toBe('a');
    expect(weightedPick(items, stats, () => .5, now).id).toBe('b');
    expect(weightedPick(items, stats, () => .8, now).id).toBe('b');
    expect(weightedPick(items, stats, () => .99, now).id).toBe('c');
  });
  it('clamps an impossible accuracy instead of crediting more correct moves than attempts', () => {
    expect(sanitizeStat({ attempts:2, correct:9 }).correct).toBe(2);
    expect(sanitizeStat({ attempts:'-4', correct:3 })).toMatchObject({ attempts:0, correct:0 });
    expect(sanitizeStat(null)).toMatchObject({ attempts:0, correct:0, streak:0, completions:0, lastSeenAt:0 });
  });
  it('does not count a line as practised when the drill recorded no moves', () => {
    const lines = [{ id:'played' }, { id:'never' }, { id:'bogus' }];
    const stats = { played:{ attempts:4, correct:3 }, bogus:{ attempts:0, correct:0, completions:1 } };
    expect(practicedLines(lines, stats).map(line => line.id)).toEqual(['played']);
  });
  it('never reports a line as overdue before it has been practised', () => {
    expect(overdueRatio(undefined, now)).toBe(1);
    expect(overdueRatio({ lastSeenAt: now + DAY }, now)).toBe(0);
  });
});
