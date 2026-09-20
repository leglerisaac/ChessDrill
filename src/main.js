import { Chess } from 'chess.js';
import { OPENINGS, allLines } from './openings.js';
import { createDrill, parseMove, weightedPick } from './drill.js';
import './styles.css';

const PIECE_NAMES = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };
const MOVE_MS = 240;
const REPLY_PAUSE_MS = 380;
const BEGINNER_FAMILIES = new Set(['Italian Game','Scotch Game','Four Knights Game','Ruy Lopez','Vienna Game',"Queen's Gambit",'London System','English Opening',"King's Indian Attack",'Sicilian Defense','French Defense','Caro-Kann Defense','Scandinavian Defense','Pirc Defense',"King's Indian Defense",'Slav Defense','Dutch Defense']);
const INTERMEDIATE_FAMILIES = new Set([...BEGINNER_FAMILIES,'Alekhine Defense','Benoni Defense','Benko Gambit','Bishop\'s Opening','Catalan Opening','English Defense','Grünfeld Defense','Modern Defense','Nimzo-Indian Defense','Nimzo-Larsen Attack',"Queen's Gambit Accepted","Queen's Gambit Declined","Queen's Indian Defense",'Réti Opening','Semi-Slav Defense','Three Knights Opening','Trompowsky Attack','Bird Opening','Danish Gambit','King\'s Gambit','Petrov\'s Defense','Philidor Defense']);
const RECOMMENDATIONS = [
  { name:'Italian Game', reason:'Natural development and clear attacking plans.', levels:['beginner','intermediate','advanced'] },
  { name:"Queen's Gambit", reason:'A principled introduction to positional chess.', levels:['beginner','intermediate','advanced'] },
  { name:'London System', reason:'A dependable setup that is easy to revisit.', levels:['beginner','intermediate'] },
  { name:'Caro-Kann Defense', reason:'A sound, structured answer to 1.e4.', levels:['beginner','intermediate','advanced'] },
  { name:'French Defense', reason:'Teaches pawn chains and counterplay.', levels:['beginner','intermediate','advanced'] },
  { name:'Sicilian Defense', reason:'Dynamic winning chances against 1.e4.', levels:['intermediate','advanced'] },
  { name:'Ruy Lopez', reason:'Classic strategic themes at every level.', levels:['intermediate','advanced'] },
  { name:"King's Indian Defense", reason:'Active kingside play against 1.d4.', levels:['intermediate','advanced'] },
  { name:'Nimzo-Indian Defense', reason:'Rich positional play without a passive setup.', levels:['advanced'] },
];
const STORAGE_KEY = 'chessdrill-v1';
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const validLineIds = new Set(allLines().map(line => line.id));
const state = {
  screen: 'library',
  selected: new Set((saved.selected || []).filter(id => validLineIds.has(id))),
  expanded: new Set(saved.expanded || ['italian']),
  stats: saved.stats || {},
  side: saved.side || 'repertoire',
  maxPly: saved.maxPly || 14,
  focus: saved.focus || 'all',
  sort: saved.sort || 'eco',
  query: '',
  level: saved.level || 'beginner',
  showShortLines: saved.showShortLines || false,
  orientation: 'white',
  session: null,
  selectedSquare: null,
  message: '',
  hint: false,
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected:[...state.selected], expanded:[...state.expanded], stats:state.stats, side:state.side, maxPly:state.maxPly, focus:state.focus, sort:state.sort, level:state.level, showShortLines:state.showShortLines }));
}

function esc(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function pct(stat) { return stat?.attempts ? Math.round(stat.correct / stat.attempts * 100) : null; }

function openingForLevel(opening) {
  const keepLine = line => state.showShortLines || line.moves.length >= 8 || line.name === 'Main line';
  if (state.level === 'advanced') {
    const lines = opening.lines.filter(keepLine);
    return lines.length ? { ...opening, lines } : null;
  }
  const allowed = state.level === 'beginner' ? BEGINNER_FAMILIES : INTERMEDIATE_FAMILIES;
  if (!allowed.has(opening.name)) return null;
  const limit = state.level === 'beginner' ? 8 : 14;
  const candidates = state.level === 'beginner'
    ? opening.lines.filter(line => line.moves.length <= 10)
    : opening.lines;
  const lines = candidates.filter(keepLine).sort((a,b) => a.moves.length-b.moves.length || a.name.localeCompare(b.name)).slice(0,limit);
  if (!lines.length) return null;
  return { ...opening, lines, description:`${lines.length} ${state.level} ${lines.length===1?'line':'lines'}` };
}

function levelCatalog() { return OPENINGS.map(openingForLevel).filter(Boolean); }

function appShell(content) {
  const total = Object.values(state.stats).reduce((sum, s) => sum + s.attempts, 0);
  const correct = Object.values(state.stats).reduce((sum, s) => sum + s.correct, 0);
  return `<header class="topbar"><button class="brand" data-action="home"><span class="brand-mark">♞</span><span>Chess<span>Drill</span></span></button><nav><button class="nav-link ${state.screen==='library'?'active':''}" data-action="home">Repertoire</button><button class="nav-link ${state.screen==='progress'?'active':''}" data-action="progress">Progress</button></nav><div class="streak"><span>◆</span> ${correct}/${total || 0} moves</div></header>${content}`;
}

function libraryView() {
  const selectedLines = allLines().filter(line => state.selected.has(line.id));
  const catalog = levelCatalog();
  const catalogLineCount = catalog.reduce((sum,opening)=>sum+opening.lines.length,0);
  let visible = catalog.filter(opening => state.focus === 'all' || opening.color === state.focus);
  const query = state.query.trim().toLowerCase();
  if (query) visible = visible.filter(opening => opening.name.toLowerCase().includes(query) || opening.eco.toLowerCase().includes(query) || opening.lines.some(line => line.name.toLowerCase().includes(query)));
  visible = [...visible].sort((a,b) => state.sort === 'name' ? a.name.localeCompare(b.name) : state.sort === 'lines' ? b.lines.length-a.lines.length || a.name.localeCompare(b.name) : a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name));
  return appShell(`<main class="page"><section class="hero"><div><p class="eyebrow">OPENING TRAINER</p><h1>Know your <em>next move.</em></h1><p>Build a focused repertoire, choose the exact variations you care about, and drill them until the right move feels automatic.</p></div><div class="hero-card"><span>${state.selected.size}</span><small>active lines</small><button class="primary" data-action="start" ${state.selected.size?'':'disabled'}>Start drill <b>→</b></button></div></section><section class="level-panel"><div><p class="eyebrow">STUDY LEVEL</p><h2>How much theory do you want?</h2><p>Lower levels hide rare opening families and deep sidelines. Your existing selections are always preserved.</p></div><div class="level-switch" role="group" aria-label="Study level">${['beginner','intermediate','advanced'].map(level=>`<button class="${state.level===level?'active':''}" data-action="level" data-id="${level}"><b>${level[0].toUpperCase()+level.slice(1)}</b><small>${level==='beginner'?'Core plans':level==='intermediate'?'Broader theory':'Complete catalog'}</small></button>`).join('')}</div></section>${recommendationsView()}<section class="workspace"><aside class="filters"><p class="label">TRAINING SETTINGS</p><label>Practice side<select id="side"><option value="repertoire" ${state.side==='repertoire'?'selected':''}>Opening repertoire side</option><option value="white" ${state.side==='white'?'selected':''}>White only</option><option value="black" ${state.side==='black'?'selected':''}>Black only</option></select></label><label>Maximum depth <span id="depthLabel">${state.maxPly} ply</span><input id="depth" type="range" min="4" max="30" step="2" value="${state.maxPly}"></label><div class="tip"><b>Smart rotation</b><p>Lines you miss appear more often. New lines get priority until they stick.</p></div></aside><section class="library"><div class="section-heading"><div><p class="eyebrow">${catalog.length} OPENING FAMILIES · ${catalogLineCount.toLocaleString()} LINES</p><h2>Choose what to drill</h2></div><div class="selection-actions"><button data-action="select-visible">Select level</button><button data-action="clear">Clear</button></div></div><div class="catalog-tools"><label class="catalog-search"><span>⌕</span><input id="catalog-search" type="search" value="${esc(state.query)}" placeholder="Search openings, variations, or ECO…"></label><select id="focus" aria-label="Filter by side"><option value="all" ${state.focus==='all'?'selected':''}>All openings</option><option value="white" ${state.focus==='white'?'selected':''}>White to play</option><option value="black" ${state.focus==='black'?'selected':''}>Black to play</option></select><select id="sort" aria-label="Sort openings"><option value="eco" ${state.sort==='eco'?'selected':''}>ECO order</option><option value="name" ${state.sort==='name'?'selected':''}>Name A–Z</option><option value="lines" ${state.sort==='lines'?'selected':''}>Most variations</option></select><button class="short-lines-toggle ${state.showShortLines?'active':''}" data-action="toggle-short" aria-pressed="${state.showShortLines}"><span>${state.showShortLines?'✓':''}</span> Show lines under 4 moves</button></div><p class="result-count">Showing ${visible.length} opening ${visible.length===1?'family':'families'} · ${state.showShortLines?'Short sidelines included':'Short sidelines hidden; main lines retained'}</p><div class="opening-list">${visible.length?visible.map(openingCard).join(''):'<div class="no-results">No openings match those filters.</div>'}</div></section></section>${selectedLines.length?`<div class="mobile-start"><span>${selectedLines.length} lines selected</span><button class="primary" data-action="start">Start drill →</button></div>`:''}</main>`);
}

function recommendationsView() {
  const recommendations = RECOMMENDATIONS.filter(item=>item.levels.includes(state.level)).map(item=>({ ...item, opening:OPENINGS.find(opening=>opening.name===item.name) })).filter(item=>item.opening);
  return `<section class="recommended"><div class="section-heading"><div><p class="eyebrow">RECOMMENDED OPENINGS</p><h2>A strong place to start</h2></div><p>Balanced choices for ${state.level} study</p></div><div class="recommendation-grid">${recommendations.slice(0,6).map(({opening,reason})=>{const leveled=openingForLevel(opening)||opening;const ids=leveled.lines.map(line=>line.id);const added=ids.every(id=>state.selected.has(id));return `<article><span class="color-dot ${opening.color}">${opening.color==='white'?'W':'B'}</span><div><b>${esc(opening.name)}</b><p>${esc(reason)}</p><small>${leveled.lines.length} foundational ${leveled.lines.length===1?'line':'lines'}</small></div><button class="${added?'added':''}" data-action="recommend" data-id="${opening.id}">${added?'✓ Added':'+ Add'}</button></article>`}).join('')}</div></section>`;
}

function openingCard(opening) {
  const expanded = state.expanded.has(opening.id);
  const selectedCount = opening.lines.filter(l => state.selected.has(l.id)).length;
  const allSelected = selectedCount === opening.lines.length;
  const someSelected = selectedCount > 0 && !allSelected;
  return `<article class="opening-card ${expanded?'expanded':''}"><div class="opening-summary"><button class="opening-toggle ${allSelected?'checked':''} ${someSelected?'partial':''}" data-action="toggle-opening" data-id="${opening.id}" aria-label="${allSelected?'Deselect':'Select'} all ${esc(opening.name)} lines" aria-pressed="${allSelected}"><span>✓</span></button><button class="opening-details" data-action="expand" data-id="${opening.id}"><span class="color-dot ${opening.color}">${opening.color==='white'?'W':'B'}</span><span class="opening-title"><b>${esc(opening.name)}</b><small>${opening.eco} · ${esc(opening.description)}</small></span><span class="line-count">${selectedCount}/${opening.lines.length} lines</span><span class="chevron">⌄</span></button></div>${expanded?`<div class="line-list"><div class="line-list-head"><span>VARIATION</span><span>MOVES</span><button data-action="toggle-opening" data-id="${opening.id}">${allSelected?'Deselect all':'Select all'}</button></div>${opening.lines.map(line => { const stat=state.stats[line.id]; return `<label class="line-row"><input type="checkbox" data-line="${line.id}" ${state.selected.has(line.id)?'checked':''}><span class="fake-check">✓</span><span><b>${esc(line.name)}</b><small>${line.moves.join(' ')}</small></span><span class="moves-count">${line.moves.length} ply</span><span class="accuracy">${pct(stat)===null?'New':pct(stat)+'%'}</span></label>`;}).join('')}</div>`:''}</article>`;
}

function startSession() {
  const available = allLines().filter(line => state.selected.has(line.id));
  const line = weightedPick(available, state.stats);
  if (!line) return;
  const color = state.side === 'repertoire' ? line.repertoireColor : state.side;
  const drill = createDrill(line, color, state.maxPly);
  const userTurn = color === 'white' ? 'w' : 'b';
  state.session = { drill, chess:new Chess(), cursor:0, userMoves:0, mistakes:0, complete:false, busy:drill.positions[0]?.turn !== userTurn, lastMove:null };
  state.orientation = color;
  state.selectedSquare = null;
  state.message = '';
  state.hint = false;
  state.screen = 'drill';
  render();
  window.setTimeout(advanceOpponent, REPLY_PAUSE_MS);
}

async function advanceOpponent() {
  const s = state.session;
  if (!s || s.complete) return;
  while (s.cursor < s.drill.positions.length && s.drill.positions[s.cursor].turn !== (s.drill.color === 'white' ? 'w' : 'b')) {
    s.busy = true;
    const position = s.drill.positions[s.cursor];
    await animateMove(position.from, position.to);
    if (state.session !== s) return;
    s.chess.move(position.san);
    s.lastMove = { from:position.from, to:position.to };
    s.cursor += 1;
    s.busy = false;
    render();
    if (s.cursor < s.drill.positions.length && s.drill.positions[s.cursor].turn !== (s.drill.color === 'white' ? 'w' : 'b')) await delay(REPLY_PAUSE_MS);
  }
  if (s.cursor >= s.drill.positions.length) finishLine();
  render();
}

function finishLine() {
  const s=state.session; if (!s || s.complete) return;
  s.complete=true;
  const old=state.stats[s.drill.line.id] || { attempts:0, correct:0, completions:0 };
  state.stats[s.drill.line.id]={ attempts:old.attempts+s.userMoves, correct:old.correct+Math.max(0,s.userMoves-s.mistakes), completions:(old.completions||0)+1 };
  save();
}

function boardHtml(chess, orientation) {
  const board=chess.board();
  const ranks=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  const files=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0];
  const selected=state.selectedSquare;
  const legal=selected ? chess.moves({square:selected,verbose:true}).map(m=>m.to) : [];
  return `<div class="board" role="grid" aria-label="Chess board">${ranks.flatMap((r,ri)=>files.map((f,fi)=>{ const piece=board[r][f]; const square='abcdefgh'[f]+(8-r); const dark=(r+f)%2===1; const hint=state.hint && state.session?.drill.positions[state.session.cursor]?.from===square; const lastFrom=state.session?.lastMove?.from===square; const lastTo=state.session?.lastMove?.to===square; const pieceCode=piece?`${piece.color}${piece.type.toUpperCase()}`:''; return `<button class="square ${dark?'dark':'light'} ${selected===square?'selected':''} ${legal.includes(square)?'legal':''} ${hint?'hint':''} ${lastFrom?'last-from':''} ${lastTo?'last-to':''}" data-square="${square}" aria-label="${square}${piece?' '+(piece.color==='w'?'white ':'black ')+PIECE_NAMES[piece.type]:''}">${piece?`<img class="piece" draggable="false" src="https://lichess1.org/assets/piece/cburnett/${pieceCode}.svg" alt="${piece.color==='w'?'White':'Black'} ${PIECE_NAMES[piece.type]}">`:''}${fi===0?`<small class="rank">${8-r}</small>`:''}${ri===7?`<small class="file">${'abcdefgh'[f]}</small>`:''}</button>`;})).join('')}</div>`;
}

function delay(ms) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

function animateMove(from, to) {
  const source = document.querySelector(`[data-square="${from}"] .piece`);
  const target = document.querySelector(`[data-square="${to}"]`);
  if (!source || !target) return Promise.resolve();
  const start = source.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const ghost = source.cloneNode(true);
  ghost.classList.add('moving-piece');
  Object.assign(ghost.style, { left:`${start.left}px`, top:`${start.top}px`, width:`${start.width}px`, height:`${start.height}px` });
  source.style.opacity = '0';
  document.body.appendChild(ghost);
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => { ghost.style.transform = `translate(${end.left-start.left}px, ${end.top-start.top}px)`; }));
    window.setTimeout(() => { ghost.remove(); resolve(); }, MOVE_MS);
  });
}

function drillView() {
  const s=state.session;
  const progress=Math.round(s.cursor/Math.max(1,s.drill.positions.length)*100);
  return appShell(`<main class="drill-page"><section class="drill-head"><button class="back" data-action="home">← Exit drill</button><div class="drill-meta"><span>${esc(s.drill.line.openingName)}</span><b>${esc(s.drill.line.name)}</b></div><div class="progress-track"><i style="width:${progress}%"></i></div><span>${s.cursor}/${s.drill.positions.length} ply</span></section><section class="drill-grid"><div class="board-wrap">${boardHtml(s.chess,state.orientation)}</div><aside class="coach ${s.complete?'complete':''}">${s.complete?`<div class="result-icon">✓</div><p class="eyebrow">LINE COMPLETE</p><h2>${s.mistakes?'Nice recovery.':'Clean run.'}</h2><p>You played ${s.userMoves} move${s.userMoves===1?'':'s'} with ${s.mistakes} mistake${s.mistakes===1?'':'s'}.</p><button class="primary wide" data-action="next">Drill another line →</button><button class="secondary wide" data-action="home">Back to repertoire</button>`:`<p class="eyebrow">YOUR MOVE · ${s.drill.color.toUpperCase()}</p><h2>Find the repertoire move.</h2><p class="sequence">${s.drill.line.moves.slice(0,s.cursor).map((m,i)=>`<span class="${i===s.cursor-1?'last':''}">${m}</span>`).join(' ') || 'Opening position'}</p><div class="feedback ${state.message?'show':''}">${state.message||'Select a piece, then its destination square.'}</div><button class="secondary wide" data-action="hint">${state.hint?'Hint active — piece highlighted':'Show hint'}</button><button class="text-button" data-action="reveal">Reveal & continue</button>`}</aside></section></main>`);
}

function progressView() {
  const lines=allLines().filter(l=>state.stats[l.id]);
  const attempts=lines.reduce((n,l)=>n+state.stats[l.id].attempts,0), correct=lines.reduce((n,l)=>n+state.stats[l.id].correct,0);
  return appShell(`<main class="page progress-page"><p class="eyebrow">TRAINING HISTORY</p><h1>Your progress</h1><section class="stat-grid"><div><span>${lines.length}</span><small>lines practiced</small></div><div><span>${attempts}</span><small>moves attempted</small></div><div><span>${attempts?Math.round(correct/attempts*100):'—'}${attempts?'%':''}</span><small>overall accuracy</small></div></section><section class="progress-list"><div class="section-heading"><h2>Line mastery</h2><button class="secondary" data-action="reset-stats">Reset progress</button></div>${lines.length?lines.sort((a,b)=>pct(state.stats[a.id])-pct(state.stats[b.id])).map(line=>{const n=pct(state.stats[line.id]); return `<div class="progress-row"><span><b>${esc(line.name)}</b><small>${esc(line.openingName)}</small></span><div class="mastery"><i style="width:${n}%"></i></div><strong>${n}%</strong></div>`}).join(''):'<div class="empty"><span>♙</span><h3>No drills completed yet</h3><p>Select some lines and play your first session.</p><button class="primary" data-action="home">Choose openings</button></div>'}</section></main>`);
}

async function tryMove(square) {
  const s=state.session; if (!s || s.complete || s.busy) return;
  const piece=s.chess.get(square); const turn=s.chess.turn();
  if (!state.selectedSquare) {
    if (piece?.color===turn) { state.selectedSquare=square; state.message=''; render(); }
    return;
  }
  if (piece?.color===turn) { state.selectedSquare=square; render(); return; }
  const move=parseMove(s.chess,state.selectedSquare,square);
  if (!move) { state.selectedSquare=null; state.message='That piece cannot move there.'; render(); return; }
  const expected=s.drill.positions[s.cursor];
  if (move.from===expected.from && move.to===expected.to) {
    s.busy=true; state.selectedSquare=null; state.message='Correct — keep going.'; state.hint=false; render();
    await animateMove(move.from, move.to);
    if (state.session !== s) return;
    s.chess.move(move.san); s.lastMove={from:move.from,to:move.to}; s.cursor+=1; s.userMoves+=1; render();
    if (s.cursor >= s.drill.positions.length) { s.busy=false; finishLine(); render(); return; }
    await delay(REPLY_PAUSE_MS);
    if (state.session === s) advanceOpponent();
  } else {
    s.mistakes+=1; s.userMoves+=1; state.selectedSquare=null; state.message='Not the repertoire move. The correct piece is highlighted.'; state.hint=true; render();
  }
}

function handleClick(event) {
  const square=event.target.closest('[data-square]'); if (square) return tryMove(square.dataset.square);
  const el=event.target.closest('[data-action]'); if (!el) return;
  const action=el.dataset.action, id=el.dataset.id;
  if(action==='home'){state.screen='library';state.session=null;}
  if(action==='progress') state.screen='progress';
  if(action==='expand'){state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);save();}
  if(action==='select-all'){allLines().forEach(l=>state.selected.add(l.id));save();}
  if(action==='select-visible'){levelCatalog().forEach(opening=>opening.lines.forEach(line=>state.selected.add(line.id)));save();}
  if(action==='clear'){state.selected.clear();save();}
  if(action==='toggle-opening'){const full=OPENINGS.find(x=>x.id===id);const o=openingForLevel(full)||full;const all=o.lines.every(l=>state.selected.has(l.id));o.lines.forEach(l=>all?state.selected.delete(l.id):state.selected.add(l.id));save();}
  if(action==='level'){state.level=id;state.query='';save();}
  if(action==='toggle-short'){state.showShortLines=!state.showShortLines;save();}
  if(action==='recommend'){const full=OPENINGS.find(x=>x.id===id);const o=openingForLevel(full)||full;const all=o.lines.every(l=>state.selected.has(l.id));o.lines.forEach(l=>all?state.selected.delete(l.id):state.selected.add(l.id));save();}
  if(action==='start'||action==='next') return startSession();
  if(action==='hint') state.hint=true;
  if(action==='reveal'){const s=state.session;if(s.busy)return;const p=s.drill.positions[s.cursor];s.busy=true;state.message='Move revealed.';state.hint=false;render();animateMove(p.from,p.to).then(async()=>{if(state.session!==s)return;s.chess.move(p.san);s.lastMove={from:p.from,to:p.to};s.cursor++;s.userMoves++;s.mistakes++;render();await delay(REPLY_PAUSE_MS);if(state.session===s)advanceOpponent();});return;}
  if(action==='reset-stats'&&confirm('Reset all ChessDrill progress?')){state.stats={};save();}
  render();
}

function handleChange(event) {
  if(event.target.matches('[data-line]')){event.target.checked?state.selected.add(event.target.dataset.line):state.selected.delete(event.target.dataset.line);save();render();}
  if(event.target.id==='side'){state.side=event.target.value;save();}
  if(event.target.id==='depth'){state.maxPly=Number(event.target.value);save();document.querySelector('#depthLabel').textContent=`${state.maxPly} ply`;}
  if(event.target.id==='focus'){state.focus=event.target.value;save();render();}
  if(event.target.id==='sort'){state.sort=event.target.value;save();render();}
  if(event.target.id==='catalog-search'){
    state.query=event.target.value;
    const caret=event.target.selectionStart;
    render();
    requestAnimationFrame(()=>{const input=document.querySelector('#catalog-search');if(input){input.focus();input.setSelectionRange(caret,caret);}});
  }
}

function render(){document.querySelector('#app').innerHTML=state.screen==='drill'?drillView():state.screen==='progress'?progressView():libraryView();}
document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleChange);render();
