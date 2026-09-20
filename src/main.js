import { Chess } from 'chess.js';
import { OPENINGS, allLines } from './openings.js';
import { createDrill, parseMove, weightedPick } from './drill.js';
import './styles.css';

const PIECE_NAMES = { p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king' };
const MOVE_MS = 240;
const REPLY_PAUSE_MS = 380;
const STORAGE_KEY = 'chessdrill-v1';
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
const state = {
  screen: 'library',
  selected: new Set(saved.selected || ['italian-main', 'italian-quiet', 'qg-qgd']),
  expanded: new Set(saved.expanded || ['italian']),
  stats: saved.stats || {},
  side: saved.side || 'repertoire',
  maxPly: saved.maxPly || 14,
  orientation: 'white',
  session: null,
  selectedSquare: null,
  message: '',
  hint: false,
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ selected:[...state.selected], expanded:[...state.expanded], stats:state.stats, side:state.side, maxPly:state.maxPly }));
}

function esc(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function pct(stat) { return stat?.attempts ? Math.round(stat.correct / stat.attempts * 100) : null; }

function appShell(content) {
  const total = Object.values(state.stats).reduce((sum, s) => sum + s.attempts, 0);
  const correct = Object.values(state.stats).reduce((sum, s) => sum + s.correct, 0);
  return `<header class="topbar"><button class="brand" data-action="home"><span class="brand-mark">♞</span><span>Chess<span>Drill</span></span></button><nav><button class="nav-link ${state.screen==='library'?'active':''}" data-action="home">Repertoire</button><button class="nav-link ${state.screen==='progress'?'active':''}" data-action="progress">Progress</button></nav><div class="streak"><span>◆</span> ${correct}/${total || 0} moves</div></header>${content}`;
}

function libraryView() {
  const selectedLines = allLines().filter(line => state.selected.has(line.id));
  return appShell(`<main class="page"><section class="hero"><div><p class="eyebrow">OPENING TRAINER</p><h1>Know your <em>next move.</em></h1><p>Build a focused repertoire, choose the exact variations you care about, and drill them until the right move feels automatic.</p></div><div class="hero-card"><span>${state.selected.size}</span><small>active lines</small><button class="primary" data-action="start" ${state.selected.size?'':'disabled'}>Start drill <b>→</b></button></div></section><section class="workspace"><aside class="filters"><p class="label">TRAINING SETTINGS</p><label>Practice side<select id="side"><option value="repertoire" ${state.side==='repertoire'?'selected':''}>Opening repertoire side</option><option value="white" ${state.side==='white'?'selected':''}>White only</option><option value="black" ${state.side==='black'?'selected':''}>Black only</option></select></label><label>Maximum depth <span id="depthLabel">${state.maxPly} ply</span><input id="depth" type="range" min="4" max="18" step="2" value="${state.maxPly}"></label><div class="tip"><b>Smart rotation</b><p>Lines you miss appear more often. New lines get priority until they stick.</p></div></aside><section class="library"><div class="section-heading"><div><p class="eyebrow">YOUR REPERTOIRE</p><h2>Choose what to drill</h2></div><div class="selection-actions"><button data-action="select-all">Select all</button><button data-action="clear">Clear</button></div></div><div class="opening-list">${OPENINGS.map(openingCard).join('')}</div></section></section>${selectedLines.length?`<div class="mobile-start"><span>${selectedLines.length} lines selected</span><button class="primary" data-action="start">Start drill →</button></div>`:''}</main>`);
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
  state.session = { drill, chess:new Chess(), cursor:0, userMoves:0, mistakes:0, complete:false, busy:drill.positions[0]?.turn !== userTurn };
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
  return `<div class="board" role="grid" aria-label="Chess board">${ranks.flatMap((r,ri)=>files.map((f,fi)=>{ const piece=board[r][f]; const square='abcdefgh'[f]+(8-r); const dark=(r+f)%2===1; const hint=state.hint && state.session?.drill.positions[state.session.cursor]?.from===square; const pieceCode=piece?`${piece.color}${piece.type.toUpperCase()}`:''; return `<button class="square ${dark?'dark':'light'} ${selected===square?'selected':''} ${legal.includes(square)?'legal':''} ${hint?'hint':''}" data-square="${square}" aria-label="${square}${piece?' '+(piece.color==='w'?'white ':'black ')+PIECE_NAMES[piece.type]:''}">${piece?`<img class="piece" draggable="false" src="https://lichess1.org/assets/piece/cburnett/${pieceCode}.svg" alt="${piece.color==='w'?'White':'Black'} ${PIECE_NAMES[piece.type]}">`:''}${fi===0?`<small class="rank">${8-r}</small>`:''}${ri===7?`<small class="file">${'abcdefgh'[f]}</small>`:''}</button>`;})).join('')}</div>`;
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
  const s=state.session; const p=s.drill.positions[s.cursor];
  const progress=Math.round(s.cursor/Math.max(1,s.drill.positions.length)*100);
  return appShell(`<main class="drill-page"><section class="drill-head"><button class="back" data-action="home">← Exit drill</button><div class="drill-meta"><span>${esc(s.drill.line.openingName)}</span><b>${esc(s.drill.line.name)}</b></div><div class="progress-track"><i style="width:${progress}%"></i></div><span>${s.cursor}/${s.drill.positions.length} ply</span></section><section class="drill-grid"><div class="board-wrap">${boardHtml(s.chess,state.orientation)}</div><aside class="coach ${s.complete?'complete':''}">${s.complete?`<div class="result-icon">✓</div><p class="eyebrow">LINE COMPLETE</p><h2>${s.mistakes?'Nice recovery.':'Clean run.'}</h2><p>You played ${s.userMoves} move${s.userMoves===1?'':'s'} with ${s.mistakes} mistake${s.mistakes===1?'':'s'}.</p><button class="primary wide" data-action="next">Drill another line →</button><button class="secondary wide" data-action="home">Back to repertoire</button>`:`<p class="eyebrow">YOUR MOVE · ${s.drill.color.toUpperCase()}</p><h2>Find the repertoire move.</h2><p class="sequence">${s.drill.line.moves.slice(0,s.cursor).map((m,i)=>`<span class="${i===s.cursor-1?'last':''}">${m}</span>`).join(' ') || 'Opening position'}</p><div class="feedback ${state.message?'show':''}">${state.message||'Select a piece, then its destination square.'}</div><button class="secondary wide" data-action="hint">${state.hint?'Hint: '+p?.san:'Show hint'}</button><button class="text-button" data-action="reveal">Reveal & continue</button>`}</aside></section></main>`);
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
    s.chess.move(move.san); s.cursor+=1; s.userMoves+=1; render();
    if (s.cursor >= s.drill.positions.length) { s.busy=false; finishLine(); render(); return; }
    await delay(REPLY_PAUSE_MS);
    if (state.session === s) advanceOpponent();
  } else {
    s.mistakes+=1; s.userMoves+=1; state.selectedSquare=null; state.message=`Not in this line. Look for ${expected.san}.`; state.hint=true; render();
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
  if(action==='clear'){state.selected.clear();save();}
  if(action==='toggle-opening'){const o=OPENINGS.find(x=>x.id===id);const all=o.lines.every(l=>state.selected.has(l.id));o.lines.forEach(l=>all?state.selected.delete(l.id):state.selected.add(l.id));save();}
  if(action==='start'||action==='next') return startSession();
  if(action==='hint') state.hint=true;
  if(action==='reveal'){const s=state.session;if(s.busy)return;const p=s.drill.positions[s.cursor];s.busy=true;state.message='Move revealed.';state.hint=false;render();animateMove(p.from,p.to).then(async()=>{if(state.session!==s)return;s.chess.move(p.san);s.cursor++;s.userMoves++;s.mistakes++;render();await delay(REPLY_PAUSE_MS);if(state.session===s)advanceOpponent();});return;}
  if(action==='reset-stats'&&confirm('Reset all ChessDrill progress?')){state.stats={};save();}
  render();
}

function handleChange(event) {
  if(event.target.matches('[data-line]')){event.target.checked?state.selected.add(event.target.dataset.line):state.selected.delete(event.target.dataset.line);save();render();}
  if(event.target.id==='side'){state.side=event.target.value;save();}
  if(event.target.id==='depth'){state.maxPly=Number(event.target.value);save();document.querySelector('#depthLabel').textContent=`${state.maxPly} ply`;}
}

function render(){document.querySelector('#app').innerHTML=state.screen==='drill'?drillView():state.screen==='progress'?progressView():libraryView();}
document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleChange);render();
