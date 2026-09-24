import { beforeAll, describe, expect, it } from 'vitest';

// main.js is the only module that touches the DOM, so it needs a minimal stub environment before it
// can be imported. These tests render the real screens through the real event handlers: they are the
// only guard that the app layer still wires its catalog references up correctly.
let app;
const handlers = {};

const click = dataset => handlers.click({ target: { closest: selector => (selector === '[data-square]' ? null : { dataset }) } });

beforeAll(async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  };
  globalThis.window = { setTimeout: () => 0 };
  globalThis.requestAnimationFrame = () => 0;
  app = { innerHTML: '' };
  globalThis.document = {
    addEventListener: (type, handler) => { handlers[type] = handler; },
    querySelector: selector => (selector === '#app' ? app : null),
  };
  await import('./main.js');
});

describe('application screens', () => {
  it('renders the repertoire library on startup', () => {
    expect(app.innerHTML).toContain('Start drill');
    expect(app.innerHTML).toContain('OPENING FAMILIES');
    expect(app.innerHTML).toContain('STUDY LEVEL');
  });
  it('renders a theory challenge setup with a non-empty pool for every difficulty', () => {
    click({ action: 'challenge' });
    expect(app.innerHTML).toContain('Theory Challenge');
    expect(app.innerHTML.match(/eligible theory lines/g)).toHaveLength(3);
    expect(app.innerHTML).not.toContain('0 eligible theory lines');
  });
  it('renders the progress screen and every study level switch', () => {
    click({ action: 'progress' });
    expect(app.innerHTML).toContain('Your progress');
    click({ action: 'home' });
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      click({ action: 'level', id: level });
      expect(app.innerHTML).toContain('Start drill');
      expect(app.innerHTML).toContain('OPENING FAMILIES');
    }
  });
});
