import { describe, expect, it } from 'vitest';
import { OPENINGS } from './openings.js';
import { BEGINNER_FAMILIES, DEFAULT_EXPANDED_FAMILY, INTERMEDIATE_FAMILIES, RECOMMENDATIONS, SHORT_LINE_PLY, STUDY_LEVELS, expandedFamilies, levelCatalogFor, missingFamilyReferences, missingIdReferences, openingForLevel } from './study.js';

// The study levels are a documented promise, so the tests pin the promised numbers themselves
// instead of reading them back out of the module under test.
const BEGINNER_LINES = 8;
const INTERMEDIATE_LINES = 14;

// Mirrors what main.js builds for imported PGN lines: a synthetic family outside the catalog.
const custom = {
  id:'custom-repertoire', name:'Custom repertoire', eco:'PGN', color:'white', description:'Your imported lines',
  lines:[{ id:'custom-imported', name:'Imported line', moves:['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O','Be7','Re1','b5'] }],
};

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
  it('falls back to a family the catalog actually has when nothing is saved', () => {
    for (const saved of [undefined, null, []]) {
      expect(expandedFamilies(saved)).toEqual([DEFAULT_EXPANDED_FAMILY]);
      expect(OPENINGS.some(opening => opening.id === expandedFamilies(saved)[0])).toBe(true);
    }
  });
  it('leaves a saved expanded selection alone', () => {
    expect(expandedFamilies(['ruy-lopez', 'sicilian-defense'])).toEqual(['ruy-lopez', 'sicilian-defense']);
  });
  it('keeps every beginner family inside the intermediate set', () => {
    for (const name of BEGINNER_FAMILIES) expect(INTERMEDIATE_FAMILIES.has(name)).toBe(true);
  });
  it('recommends only families the app can open at a known level', () => {
    for (const [name] of RECOMMENDATIONS) {
      expect(OPENINGS.some(opening => opening.name === name)).toBe(true);
      expect(BEGINNER_FAMILIES.has(name) || INTERMEDIATE_FAMILIES.has(name)).toBe(true);
    }
    expect(STUDY_LEVELS).toEqual(['beginner','intermediate','advanced']);
  });
});

describe('study-level line selection', () => {
  it('limits beginners to the configured number of short lines from beginner families', () => {
    const catalog = levelCatalogFor(OPENINGS, 'beginner', false);
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.length).toBeLessThan(OPENINGS.length);
    for (const opening of catalog) {
      expect(BEGINNER_FAMILIES.has(opening.name)).toBe(true);
      expect(opening.lines.length).toBeLessThanOrEqual(BEGINNER_LINES);
      expect(opening.lines.every(line => line.moves.length <= 10 || line.name === 'Main line')).toBe(true);
      expect(opening.description).toContain(String(opening.lines.length));
      expect(opening.description).toContain('beginner');
    }
  });
  it('caps intermediate families at the configured limit', () => {
    const catalog = levelCatalogFor(OPENINGS, 'intermediate', true);
    expect(catalog.length).toBeGreaterThan(0);
    for (const opening of catalog) expect(opening.lines.length).toBeLessThanOrEqual(INTERMEDIATE_LINES);
  });
  it('keeps a long main line at beginner level when the family is small enough to keep it', () => {
    const opening = { id:'italian-game', name:'Italian Game', lines:[
      { id:'line-main', name:'Main line', moves:Array.from({ length:12 }, (_, i) => 'move' + i) },
      { id:'line-sideline', name:'Long sideline', moves:Array.from({ length:8 }, (_, i) => 'move' + i) },
    ] };
    const names = openingForLevel(opening, 'beginner', false).lines.map(line => line.name);
    expect(names).toEqual(['Long sideline', 'Main line']);
  });
  it('keeps a main line even when the level would hide short sidelines', () => {
    const english = OPENINGS.find(opening => opening.name === 'English Opening');
    expect(openingForLevel(english, 'beginner', false).lines.some(line => line.name === 'Main line')).toBe(true);
  });
  it('keeps every family at advanced level and hides only short sidelines', () => {
    const withShort = levelCatalogFor(OPENINGS, 'advanced', true);
    const withoutShort = levelCatalogFor(OPENINGS, 'advanced', false);
    expect(withShort).toHaveLength(OPENINGS.length);
    expect(withoutShort).toHaveLength(OPENINGS.length);
    const count = catalog => catalog.reduce((sum, opening) => sum + opening.lines.length, 0);
    expect(count(withoutShort)).toBeLessThan(count(withShort));
    for (const opening of withoutShort) for (const line of opening.lines) expect(line.moves.length >= SHORT_LINE_PLY || line.name === 'Main line').toBe(true);
  });
  it('drops families the chosen level does not cover', () => {
    const grob = OPENINGS.find(opening => opening.name === 'Grob Opening');
    expect(openingForLevel(grob, 'beginner', true)).toBeNull();
    expect(openingForLevel(grob, 'advanced', true).name).toBe('Grob Opening');
  });
  it('keeps the imported custom repertoire past the family-set check at every level', () => {
    const short = { ...custom, lines:[{ id:'custom-short', name:'Imported line', moves:['e4','e5','Nf3','Nc6','Bc4'] }] };
    for (const level of STUDY_LEVELS) expect(openingForLevel(short, level, false)?.id).toBe('custom-repertoire');
    // The bypass is keyed on the synthetic id, not on the family name.
    expect(openingForLevel({ ...short, id:'not-imported' }, 'beginner', false)).toBeNull();
    expect(openingForLevel({ ...short, id:'not-imported' }, 'intermediate', false)).toBeNull();
    // A long import is still hidden by the beginner length limit, exactly as before the extraction.
    expect(openingForLevel(custom, 'beginner', false)).toBeNull();
    for (const level of ['intermediate','advanced']) expect(openingForLevel(custom, level, false).lines).toHaveLength(1);
  });
});
