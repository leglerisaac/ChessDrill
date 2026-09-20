import { describe, expect, it } from 'vitest';
import { allLines } from './openings.js';
import { createDrill, eligibleSelectedLines, linePositions, weightedPick } from './drill.js';

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
});
