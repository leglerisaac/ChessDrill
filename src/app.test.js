import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_EXPANDED_FAMILY, STUDY_LEVELS } from './study.js';

// main.js is the only module that touches the DOM, so it needs a stub environment before it can be
// imported. These tests render the real screens through the real click handlers, which is the only
// guard that the app layer still wires its catalog references up correctly.
let app;
const handlers = {};

// main.js registers more than one click listener (the action router and the native link bridge), so
// dispatch to each of them the way a real click would, and only claim the selector we simulate.
const click = dataset => handlers.click.forEach(handler => handler({ target: { closest:selector => (selector.includes('[data-action]') ? { dataset } : null) } }));
const expandedFamilies = () => app.innerHTML.split('<article class="opening-card ').slice(1).filter(part => part.startsWith('expanded')).map(part => (part.match(/data-action="expand" data-id="([^"]+)"/) || [])[1]);

beforeAll(async () => {
  const store = new Map();
  globalThis.localStorage = { getItem:key => (store.has(key) ? store.get(key) : null), setItem:(key, value) => store.set(key, String(value)), removeItem:key => store.delete(key) };
  globalThis.window = { setTimeout:() => 0, scrollTo:() => {}, addEventListener:() => {}, removeEventListener:() => {} };
  globalThis.requestAnimationFrame = () => 0;
  app = { innerHTML:'' };
  globalThis.document = {
    addEventListener:(type, handler) => { handlers[type] = [...(handlers[type] || []), handler]; },
    querySelector:selector => (selector === '#app' ? app : null),
    createElement:() => ({ click:() => {}, style:{}, classList:{ add:() => {} } }),
    body:{ appendChild:() => {} },
  };
  globalThis.URL = { createObjectURL:() => 'blob:stub', revokeObjectURL:() => {} };
  await import('./main.js');
});

describe('application screens', () => {
  it('opens the library with the documented default family expanded', () => {
    click({ action:'home' });
    expect(app.innerHTML).toContain('<h1>Openings</h1>');
    expect(expandedFamilies()).toEqual([DEFAULT_EXPANDED_FAMILY]);
    expect((app.innerHTML.match(/data-line="/g) || []).length).toBeGreaterThan(0);
  });
  it('renders a switch for every study level with the default family still open', () => {
    expect((app.innerHTML.match(/data-action="level"/g) || [])).toHaveLength(STUDY_LEVELS.length);
    for (const level of STUDY_LEVELS) {
      click({ action:'level', id:level });
      expect(app.innerHTML).toContain('<h1>Openings</h1>');
      expect(expandedFamilies()).toEqual([DEFAULT_EXPANDED_FAMILY]);
    }
  });
  it('renders the dashboard and progress screens', () => {
    click({ action:'dashboard' });
    expect(app.innerHTML).toContain('Chess Studio');
    click({ action:'progress' });
    expect(app.innerHTML).toContain('<h1>Progress</h1>');
  });
});
