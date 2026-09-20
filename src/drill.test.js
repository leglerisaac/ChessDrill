import { describe, expect, it } from 'vitest';
import { allLines } from './openings.js';
import { createDrill, linePositions, weightedPick } from './drill.js';

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

  it('does not create prompts for the opposite side of a one-ply line', () => {
    const line = allLines().find(candidate => candidate.moves.length === 1);
    expect(line).toBeDefined();
    expect(createDrill(line, line.repertoireColor === 'white' ? 'black' : 'white').prompts).toHaveLength(0);
  });

  it('reuses the memoized flattened line catalog', () => {
    expect(allLines()).toBe(allLines());
  });
});
