import { describe, expect, it } from 'vitest';
import { OPENINGS, allLines } from './openings.js';
import { chooseTheoryMove, createDrill, eligibleSelectedLines, linePositions, theoryOptions, weightedPick } from './drill.js';

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
    expect(items).toContain(picked);
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
