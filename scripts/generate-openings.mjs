import fs from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) throw new Error('Pass one or more lichess chess-openings TSV files.');

const rows = files.flatMap(file => fs.readFileSync(file, 'utf8').trim().split('\n').slice(1)).map(row => {
  const [eco, name, pgn] = row.split('\t');
  return { eco, name, pgn };
});

const blackFocus = /defen[cs]e|countergambit|benoni|benko gambit|indian game|bogo-indian|nimzo-indian|gr[üu]nfeld|modern defense|pirc|philidor|petrov|slav|scandinavian|sicilian|caro-kann|french defense|dutch defense|alekhine|owen's defense|st\. george/i;
const slug = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const groups = new Map();

for (const row of rows) {
  const [family, ...detail] = row.name.split(': ');
  if (!groups.has(family)) groups.set(family, []);
  const moves = row.pgn.split(/\s+/).filter(token => !/^\d+\.{1,3}$/.test(token) && !/^\d+\.\.\.$/.test(token));
  groups.get(family).push({ eco: row.eco, name: detail.join(': ') || 'Main line', moves });
}

const openings = [...groups.entries()].map(([name, lines]) => {
  const color = blackFocus.test(name) ? 'black' : 'white';
  const used = new Map();
  const normalized = lines.map((line, index) => {
    const base = `${slug(name)}-${slug(line.name) || 'main'}`;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return { id: count ? `${base}-${count + 1}` : base, ...line };
  });
  const ecos = normalized.map(line => line.eco).sort();
  return {
    id: slug(name), name, eco: ecos[0] === ecos.at(-1) ? ecos[0] : `${ecos[0]}–${ecos.at(-1)}`,
    color, description: `${normalized.length} named ${normalized.length === 1 ? 'line' : 'lines'}`,
    lines: normalized,
  };
}).sort((a, b) => a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name));

const output = `// Generated from lichess-org/chess-openings (CC0). Do not edit by hand.\nexport const OPENINGS = ${JSON.stringify(openings)};\n\nconst LINES = OPENINGS.flatMap(opening => opening.lines.map(line => ({ ...line, openingId: opening.id, openingName: opening.name, repertoireColor: opening.color })));\nexport const allLines = () => LINES;\n`;
fs.writeFileSync(new URL('../src/openings.js', import.meta.url), output);
console.log(`Generated ${openings.length} opening families and ${rows.length} lines.`);
