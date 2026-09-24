import { describe, expect, it } from 'vitest';
import { OPENINGS } from './openings.js';
import { BEGINNER_FAMILIES, DEFAULT_EXPANDED_FAMILY, INTERMEDIATE_FAMILIES, RECOMMENDATIONS, SHORT_LINE_PLY, STUDY_LEVELS, levelCatalogFor, missingFamilyReferences, missingIdReferences, openingForLevel } from './study.js';

describe('study-level catalog references', () => {
  it('references only families the shipped catalog still contains', () => {
    expect(missingFamilyReferences(OPENINGS)).toEqual([]);
  });
  it('flags a family reference the catalog no longer has', () => {
    expect(missingFamilyReferences([{ name:'Italian Game' }])).toContain('Ruy Lopez');
  });
  it('opens a family that exists on a fresh install', () => {
    expect(OPENINGS.some(opening => opening.id === DEFAULT_EXPANDED_FAMILY)).toBe(true);
    expect(missingIdReferences(OPENINGS)).toEqual([]);
  });
  it('flags a stale expanded-family id instead of silently expanding nothing', () => {
    expect(missingIdReferences([{ id:'some-other-family' }])).toEqual([DEFAULT_EXPANDED_FAMILY]);
  });
  it('keeps every beginner family inside the intermediate set', () => {
    for (const name of BEGINNER_FAMILIES) expect(INTERMEDIATE_FAMILIES.has(name)).toBe(true);
  });
  it('only recommends families at levels the app offers', () => {
    for (const item of RECOMMENDATIONS) {
      expect(item.levels.length).toBeGreaterThan(0);
      for (const level of item.levels) expect(STUDY_LEVELS).toContain(level);
      expect(BEGINNER_FAMILIES.has(item.name) || INTERMEDIATE_FAMILIES.has(item.name)).toBe(true);
    }
  });
});

describe('study-level line selection', () => {
  it('limits beginners to eight short lines from beginner families', () => {
    const catalog = levelCatalogFor(OPENINGS, 'beginner', false);
    expect(catalog.length).toBeLessThan(OPENINGS.length);
    expect(catalog.length).toBeGreaterThan(0);
    for (const opening of catalog) {
      expect(BEGINNER_FAMILIES.has(opening.name)).toBe(true);
      expect(opening.lines.length).toBeLessThanOrEqual(8);
      expect(opening.lines.every(line => line.moves.length <= 10)).toBe(true);
      expect(opening.description).toBe(`${opening.lines.length} beginner ${opening.lines.length === 1 ? 'line' : 'lines'}`);
    }
  });
  it('keeps a main line even when it is shorter than a sideline', () => {
    const english = OPENINGS.find(opening => opening.name === 'English Opening');
    const leveled = openingForLevel(english, 'beginner', false);
    expect(leveled.lines.some(line => line.name === 'Main line')).toBe(true);
  });
  it('hides short sidelines at advanced level and keeps every family and main line', () => {
    const withShort = levelCatalogFor(OPENINGS, 'advanced', true);
    const withoutShort = levelCatalogFor(OPENINGS, 'advanced', false);
    expect(withShort).toHaveLength(OPENINGS.length);
    expect(withoutShort).toHaveLength(OPENINGS.length);
    const count = catalog => catalog.reduce((sum, opening) => sum + opening.lines.length, 0);
    expect(count(withoutShort)).toBeLessThan(count(withShort));
    for (const opening of withoutShort) {
      for (const line of opening.lines) {
        expect(line.moves.length >= SHORT_LINE_PLY || line.name === 'Main line').toBe(true);
      }
    }
  });
  it('drops families the chosen level does not cover', () => {
    const grob = OPENINGS.find(opening => opening.name === 'Grob Opening');
    expect(openingForLevel(grob, 'beginner', true)).toBeNull();
    expect(openingForLevel(grob, 'advanced', true).name).toBe('Grob Opening');
  });
});
