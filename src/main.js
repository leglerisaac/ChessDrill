import { Chess } from 'chess.js';
import { OPENINGS, allLines } from './openings.js';
import { chooseTheoryMove, createDrill, drillTitle, eligibleSelectedLines, parseMove, weightedPick } from './drill.js';
import { filterOpeningLines, openingMatchesSearch } from './opening-search.js';
import { filterFavoriteOpenings } from './favorites.js';
import { buildPositionIndex, coverageByOpening, coverageForLines, dueReviewKeys, linesToPgn, openingInsight, parsePgnCollection, positionKey, positionOptions, updatePositionStat } from './learning.js';
import { analysisView, analysisSummary, cancelAnalysisWork, connectAnalysis, handleAnalysisAction, handleAnalysisInput, handlePuzzleSquare, puzzleView, submitAnalysis } from './analysis.js';
import { dashboardView } from './dashboard.js';
import { practiceView } from './practice.js';
import { OPENING_LESSONS, openingLessonReason } from './opening-lessons.js';
import { lessonCatalogView, lessonDetailView, handleLessonAction } from './opening-lessons-ui.js';
import { cancelReviewEngine, connectReview, dueMistakeCount, exportMistakeDeck, gameReviewView, handleReviewAction, handleReviewInput, handleReviewSquare, mistakeDeckSummary, reviewPracticeView, restoreMistakeDeck, submitReviewPgn } from './review.js';
import { saveTextFile } from './native-export.js';
import { validateBackup } from './backup.js';
import { deleteLocalStudyData } from './privacy.js';
import { clockExpired, remainingSeconds } from './drill-clock.js';
import { explainBestMove } from './movemirror/explain-move.js';
import './styles.css';
import { BEGINNER_FAMILIES as BEGINNER, INTERMEDIATE_FAMILIES as INTERMEDIATE, RECOMMENDATIONS, STUDY_LEVELS, expandedFamilies, levelCatalogFor, openingForLevel as selectLevelOpening } from './study.js';

const PIECE_NAMES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'},MOVE_MS=240,REPLY_PAUSE_MS=380,PIECE_BASE=`${import.meta.env.BASE_URL}pieces/cburnett`;
const STORAGE_KEY='chessdrill-v2';
function loadSaved(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{...JSON.parse(localStorage.getItem('chessdrill-v1')||'{}'),version:2};return validateBackup(raw,new Set(allLines().map(l=>l.id)),OPENINGS.map(o=>o.id),OPENING_LESSONS.map(l=>l.id));}catch{return {};}}
const saved=loadSaved(),state={screen:'dashboard',selected:new Set(saved.selected||[]),expanded:new Set(expandedFamilies(saved.expanded)),searchCollapsed:new Set(),favoriteOpenings:new Set(saved.favoriteOpenings||[]),favoriteLines:new Set(saved.favoriteLines||[]),stats:saved.stats||{},positionStats:saved.positionStats||{},lessonCompleted:saved.lessonCompleted||{},lessonFilter:'all',lesson:null,side:saved.side||'repertoire',focus:saved.focus||'all',sort:saved.sort||'recommended',query:'',level:saved.level||'beginner',showShortLines:saved.showShortLines||false,challengeDifficulty:saved.challengeDifficulty||'common',timerSeconds:saved.timerSeconds||0,lineRoles:saved.lineRoles||{},customLines:saved.customLines||[],orientation:'white',session:null,challenge:null,selectedSquare:null,message:'',hintLevel:0,pendingOutOfBook:null};
let theoryIndex;
const workingLines=()=>[...allLines(),...state.customLines];
const workingOpenings=()=>state.customLines.length?[...OPENINGS,{id:'custom-repertoire',name:'Custom repertoire',eco:'PGN',color:'white',description:'Your imported lines',lines:state.customLines}]:OPENINGS;
function rebuildIndex(){theoryIndex=buildPositionIndex(workingLines());const valid=new Set(workingLines().map(l=>l.id));state.selected=new Set([...state.selected].filter(id=>valid.has(id)));}rebuildIndex();
function backupData(){return {version:2,selected:[...state.selected],expanded:[...state.expanded],favoriteOpenings:[...state.favoriteOpenings],favoriteLines:[...state.favoriteLines],stats:state.stats,positionStats:state.positionStats,lessonCompleted:state.lessonCompleted,side:state.side,focus:state.focus,sort:state.sort,level:state.level,showShortLines:state.showShortLines,challengeDifficulty:state.challengeDifficulty,timerSeconds:state.timerSeconds,lineRoles:state.lineRoles,customLines:state.customLines};}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(backupData()));state.storageNotice='';}catch{state.storageNotice='Device storage is full. Back up your progress to a file before closing Chess Studio.';}}
const esc=v=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const pct=s=>s?.attempts?Math.round(s.correct/s.attempts*100):null;
const lineRole=l=>state.lineRoles[l.id]||'both';
const openingForLevel=opening=>selectLevelOpening(opening,state.level,state.showShortLines);
const levelCatalog=()=>levelCatalogFor(workingOpenings(),state.level,state.showShortLines);
function availableDrillLines(){
  const eligible=new Set(levelCatalog().flatMap(o=>o.lines.map(l=>l.id)));
  return eligibleSelectedLines(workingLines(),state.selected,eligible).filter(l=>{
    const side=state.side==='repertoire'?l.repertoireColor:state.side;
    return lineRole(l)==='both'||lineRole(l)===side;
  });
}
function challengeLines(d=state.challengeDifficulty){const allowed=d==='common'?BEGINNER:d==='varied'?INTERMEDIATE:null,per=d==='common'?10:d==='varied'?28:Infinity;return workingOpenings().filter(o=>o.id==='custom-repertoire'||!allowed||allowed.has(o.name)).flatMap(o=>o.lines.filter(l=>l.moves.length>=8).sort((a,b)=>b.moves.length-a.moves.length).slice(0,per).map(l=>({...l,openingId:o.id,openingName:o.name})));}
function selectedPositionKeys(){if(!state.selected.size)return new Set();return new Set([...theoryIndex].filter(([,n])=>[...n.lineIds].some(id=>state.selected.has(id))).map(([k])=>k));}
function appShell(content){
  const active=state.screen==='dashboard'?'dashboard':
    ['analysis','puzzle','game-review'].includes(state.screen)?'analyze':
    ['library','lessons','lesson'].includes(state.screen)?'home':
    ['practice','drill','review-practice','challenge-setup','challenge-play'].includes(state.screen)?'practice':'progress';
  const links=[['dashboard','Home','⌂'],['analyze','Games','♟'],['home','Openings','▦'],['practice','Practice','↗'],['progress','Progress','◷']];
  return `<header class="topbar"><button class="brand" data-action="dashboard" aria-label="Chess Studio home"><span class="brand-mark"><img src="${import.meta.env.BASE_URL}chess-studio-icon.svg" alt=""></span><span>Chess<span>Studio</span></span></button><nav aria-label="Main navigation">${links.map(([action,label,icon])=>`<button class="nav-link ${active===action?'active':''}" data-action="${action}" ${active===action?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</nav></header>${state.storageNotice?`<p class="storage-warning" role="alert">${esc(state.storageNotice)}</p>`:''}${content}<footer class="site-footer"><span>Chess Studio · Independent chess study</span><span><a href="${import.meta.env.BASE_URL}privacy.html">Privacy policy</a><a href="${import.meta.env.BASE_URL}credits.html">Open-source credits</a></span></footer>`;
}

function recommendationsView(){return `<section class="recommended"><div class="section-heading"><div><p class="eyebrow">RECOMMENDED OPENINGS</p><h2>A strong place to start</h2></div><p>Balanced, practical repertoires</p></div><div class="recommendation-grid">${RECOMMENDATIONS.map(([name,reason])=>{const o=workingOpenings().find(x=>x.name===name),v=o&&(openingForLevel(o)||o);if(!v)return'';const added=v.lines.every(l=>state.selected.has(l.id));return `<article><span class="color-dot ${o.color}">${o.color==='white'?'W':'B'}</span><div><b>${esc(name)}</b><p>${esc(reason)}</p><small>${v.lines.length} foundational lines</small></div><button class="${added?'added':''}" data-action="recommend" data-id="${o.id}">${added?'✓ Added':'+ Add'}</button></article>`;}).join('')}</div></section>`;}
function favoriteButton(kind,id,name,active){const verb=active?'Remove':'Add';return `<button type="button" class="favorite-button ${active?'is-favorite':''}" data-action="favorite-${kind}" data-id="${esc(id)}" aria-pressed="${active}" aria-label="${verb} ${esc(name)} ${active?'from':'to'} favorites" title="${verb} favorite">${active?'★':'☆'}</button>`;}
function openingCard(o){
  const searching=!!state.query.trim(),filtered=searching||state.focus==='favorites',expanded=filtered?!state.searchCollapsed.has(o.id):state.expanded.has(o.id);
  const count=o.lines.filter(l=>state.selected.has(l.id)).length,all=count===o.lines.length,some=count>0&&!all;
  const match=searching&&!openingMatchesSearch(o,state.query)?o.lines[0]:null;
  const guide=OPENING_LESSONS.find(l=>l.openingId===o.id),insight=openingInsight(o.name);
  return `<article class="opening-card ${expanded?'expanded':''}"><div class="opening-summary"><button class="opening-toggle ${all?'checked':''} ${some?'partial':''}" data-action="toggle-opening" data-id="${o.id}" aria-label="${all?'Deselect':'Select'} all ${esc(o.name)} lines" aria-pressed="${some?'mixed':all}"><span>✓</span></button><button class="opening-details" data-action="expand" data-id="${o.id}" aria-expanded="${expanded}"><span class="color-dot ${o.color}">${o.color==='white'?'W':'B'}</span><span class="opening-title"><b>${esc(o.name)}</b><small>${esc(o.eco)} · ${esc(o.description)}</small>${match?`<small class="match-context">Variation match: ${esc(match.name)}</small>`:''}</span><span class="line-count">${count}/${o.lines.length} lines</span><span class="chevron" aria-hidden="true">⌄</span></button>${favoriteButton('opening',o.id,o.name,state.favoriteOpenings.has(o.id))}</div>${expanded?`<div class="opening-plan"><span><b>Plan</b> ${esc(insight.plan)}</span><span><b>Pawn break</b> ${esc(insight.break)}</span><span><b>Watch for</b> ${esc(insight.watch)}</span>${guide?`<button class="text-button" data-action="open-lesson" data-id="${guide.id}">Study guided lesson →</button>`:''}</div><div class="line-list"><div class="line-list-head"><span>VARIATION</span><span>ROLE</span><button data-action="toggle-opening" data-id="${o.id}">${all?'Deselect all':'Select all'}</button></div>${o.lines.map(l=>`<div class="line-row"><label><input type="checkbox" data-line="${l.id}" aria-label="Practice ${esc(l.name)} in ${esc(o.name)}" ${state.selected.has(l.id)?'checked':''}><span class="fake-check">✓</span></label><span><span class="line-name"><b>${esc(l.name)}</b>${favoriteButton('line',l.id,drillTitle(l),state.favoriteLines.has(l.id))}</span><small>${esc(l.moves.join(' '))}</small></span><select data-role="${l.id}" aria-label="Practice side for ${esc(l.name)}"><option value="both" ${lineRole(l)==='both'?'selected':''}>Both</option><option value="white" ${lineRole(l)==='white'?'selected':''}>White</option><option value="black" ${lineRole(l)==='black'?'selected':''}>Black</option></select><span class="accuracy">${pct(state.stats[l.id])===null?'New':pct(state.stats[l.id])+'%'}</span></div>`).join('')}</div>`:''}</article>`;
}
function startSession(review=false,forcedLine=null,reviewKey=null){let line,color,startPly=0;if(review){const key=reviewKey||dueReviewKeys(state.positionStats,selectedPositionKeys())[0];if(!key)return;const node=theoryIndex.get(key);if(!node)return;const id=[...node.lineIds].find(x=>state.selected.has(x));line=forcedLine||workingLines().find(l=>l.id===id);if(!line)return;const chess=new Chess();startPly=line.moves.findIndex(san=>{const match=positionKey(chess.fen())===key;chess.move(san);return match;});if(startPly<0)return;color=node.turn==='w'?'white':'black';}else if(forcedLine){line=forcedLine;color=line.repertoireColor;}else{line=weightedPick(availableDrillLines(),state.stats);if(!line)return;color=state.side==='repertoire'?line.repertoireColor:state.side;}const drill=createDrill(line,color),chess=new Chess();for(let i=0;i<startPly;i++)chess.move(drill.positions[i].san);const turn=color==='white'?'w':'b';state.session={drill,chess,cursor:startPly,userMoves:0,mistakes:0,complete:false,busy:drill.positions[startPly]?.turn!==turn,lastMove:null,review,promptStartedAt:Date.now(),promptTimedOut:false,clockStopped:false,hiddenAt:null,mistakePositions:[],teaching:null,awaitContinue:false};state.orientation=color;state.selectedSquare=null;state.message='';state.hintLevel=0;state.screen='drill';render();if(state.session.busy)setTimeout(advanceOpponent,REPLY_PAUSE_MS);}
async function advanceOpponent(){const s=state.session;if(!s||s.complete)return;const turn=s.drill.color==='white'?'w':'b';while(s.cursor<s.drill.positions.length&&s.drill.positions[s.cursor].turn!==turn){s.busy=true;const p=s.drill.positions[s.cursor];await animateMove(p.from,p.to);if(state.session!==s)return;s.chess.move(p.san);s.lastMove={from:p.from,to:p.to};s.cursor++;s.busy=false;render();if(s.cursor<s.drill.positions.length&&s.drill.positions[s.cursor].turn!==turn)await delay(REPLY_PAUSE_MS);}s.promptStartedAt=Date.now();s.promptTimedOut=false;s.clockStopped=false;if(s.cursor>=s.drill.positions.length)finishLine();render();}
function recordPosition(s,correct,hinted=false){const p=s.drill.positions[s.cursor];if(!p)return;const key=positionKey(p.fen);state.positionStats[key]=updatePositionStat(state.positionStats[key],{correct,hinted,responseMs:Date.now()-s.promptStartedAt});if(!correct&&!s.mistakePositions.includes(key))s.mistakePositions.push(key);save();}
function openingMoveReason(s){const p=s.drill.positions[s.cursor];if(!p)return null;const promotion=p.san.match(/=([QRBN])/i)?.[1].toLowerCase()||'',reason=openingLessonReason(s.drill.line,s.cursor)||explainBestMove({fen:p.fen,bestMove:`${p.from}${p.to}${promotion}`}).why;return {san:p.san,reason};}
function teachingHtml(s){return s.teaching?`<div class="drill-teaching"><b>Why ${esc(s.teaching.san)}?</b><p>${esc(s.teaching.reason)}</p></div>`:'';}
function expireDrillPrompt(s){if(s!==state.session||s.complete||s.busy||s.clockStopped||s.awaitContinue||s.drill.positions[s.cursor]?.turn!==(s.drill.color==='white'?'w':'b')||!clockExpired(state.timerSeconds,s.promptStartedAt))return false;s.promptTimedOut=true;s.clockStopped=true;recordPosition(s,false);s.mistakes++;s.userMoves++;s.teaching=openingMoveReason(s);state.hintLevel=Math.max(1,state.hintLevel);state.message='Time is up. The correct piece is highlighted; finish this move without the clock.';render();return true;}
function updateDrillClock(){const s=state.screen==='drill'?state.session:null;if(!s||s.complete||s.busy||s.clockStopped||s.awaitContinue||document.hidden||s.drill.positions[s.cursor]?.turn!==(s.drill.color==='white'?'w':'b'))return;const label=document.querySelector('#drill-clock');if(label)label.textContent=state.timerSeconds?`${remainingSeconds(state.timerSeconds,s.promptStartedAt)}s`:'Untimed';expireDrillPrompt(s);}
function finishLine(){const s=state.session;if(!s||s.complete)return;s.complete=true;const old=state.stats[s.drill.line.id]||{attempts:0,correct:0,completions:0};state.stats[s.drill.line.id]={attempts:old.attempts+s.userMoves,correct:old.correct+Math.max(0,s.userMoves-s.mistakes),completions:(old.completions||0)+1};save();}

function challengeSetupView(){return appShell(`<main class="challenge-setup page"><button class="back" data-action="practice">← Back to practice</button><section class="challenge-intro"><p class="eyebrow">REAL-GAME PRACTICE</p><h1>Theory Challenge</h1><p>Start as a random color, play any documented theoretical move, and face replies selected from the position—not a rigid move sequence. Transpositions within the catalog are recognized.</p></section><section class="difficulty-grid">${['common','varied','wild'].map(id=>`<button class="${state.challengeDifficulty===id?'active':''}" data-action="challenge-difficulty" data-id="${id}" aria-pressed="${state.challengeDifficulty===id}"><span class="difficulty-icon">${id==='common'?'♙':id==='varied'?'♞':'♛'}</span><b>${id==='wild'?'Unpredictable':id[0].toUpperCase()+id.slice(1)}</b><small>${id==='common'?'Mainstream replies':id==='varied'?'Broader theory':'Full catalog'}</small><p>${id==='common'?'Frequent openings and branches.':id==='varied'?'More families and sidelines.':'Rare responses weighted more evenly.'}</p><em>${challengeLines(id).length.toLocaleString()} eligible lines</em></button>`).join('')}</section><div class="challenge-start"><p><b>Every round randomizes your color.</b><br>If you choose a legal move outside these lines, you can retry or end that round.</p><button class="primary" data-action="start-challenge">Start challenge →</button></div></main>`);}
const challengeOptions=c=>positionOptions(theoryIndex,c.chess.fen(),c.eligibleIds);
function startChallenge(){const lines=challengeLines(),color=Math.random()<.5?'white':'black';state.challenge={chess:new Chess(),eligibleIds:new Set(lines.map(l=>l.id)),color,cursor:0,targetPly:state.challengeDifficulty==='common'?10:state.challengeDifficulty==='varied'?14:18,correct:0,mistakes:0,complete:false,busy:color==='black',lastMove:null,openingName:'Starting position'};state.orientation=color;state.selectedSquare=null;state.message='';state.hintLevel=0;state.pendingOutOfBook=null;state.screen='challenge-play';render();if(color==='black')setTimeout(advanceChallengeOpponent,REPLY_PAUSE_MS);}
function updateChallengeOpening(c){const node=theoryIndex.get(positionKey(c.chess.fen())),names=node?[...node.openings]:[];c.openingName=names.length===1?names[0]:names.length<4&&names.length?names.join(' / '):names.length?`${names.length} possible openings`:'Out of book';}
async function advanceChallengeOpponent(){const c=state.challenge;if(!c||c.complete)return;const choice=chooseTheoryMove(challengeOptions(c),state.challengeDifficulty);if(!choice)return finishChallenge('Theory branch complete');const move=c.chess.moves({verbose:true}).find(m=>m.san===choice.san);if(!move)return finishChallenge('Theory branch complete');c.busy=true;await animateMove(move.from,move.to);if(state.challenge!==c)return;c.chess.move(choice.san);c.cursor++;c.lastMove={from:move.from,to:move.to};c.busy=false;updateChallengeOpening(c);render();if(c.cursor>=c.targetPly)return finishChallenge('Target depth reached');if(!challengeOptions(c).size)return finishChallenge('Theory branch complete');}
function finishChallenge(reason){const c=state.challenge;if(!c||c.complete)return;c.complete=true;c.busy=false;c.reason=reason;render();}

function boardHtml(chess,orientation){const board=chess.board(),ranks=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0],files=orientation==='white'?[0,1,2,3,4,5,6,7]:[7,6,5,4,3,2,1,0],selected=state.screen==='lesson'?null:state.selectedSquare,legal=selected?chess.moves({square:selected,verbose:true}).map(m=>m.to):[],active=state.screen==='lesson'?null:state.screen==='challenge-play'?state.challenge:state.session;let sources=[],targets=[];if(state.hintLevel&&state.screen==='challenge-play'){const sans=new Set(challengeOptions(state.challenge).keys()),moves=chess.moves({verbose:true}).filter(m=>sans.has(m.san));sources=moves.map(m=>m.from);if(state.hintLevel>1)targets=moves.map(m=>m.to);}else if(state.hintLevel&&state.session){const p=state.session.drill.positions[state.session.cursor];sources=[p?.from];if(state.hintLevel>1)targets=[p?.to];}return `<div class="board" role="group" aria-label="Chess position">${ranks.flatMap((r,ri)=>files.map((f,fi)=>{const p=board[r][f],sq='abcdefgh'[f]+(8-r),dark=(r+f)%2===1,code=p?`${p.color}${p.type.toUpperCase()}`:'',piece=p?`${p.color==='w'?'White':'Black'} ${PIECE_NAMES[p.type]}`:'empty';return `<button class="square ${dark?'dark':'light'} ${selected===sq?'selected':''} ${legal.includes(sq)?'legal':''} ${sources.includes(sq)?'hint':''} ${targets.includes(sq)?'hint-target':''} ${active?.lastMove?.from===sq?'last-from':''} ${active?.lastMove?.to===sq?'last-to':''}" aria-label="${sq}, ${piece}${legal.includes(sq)?', legal destination':''}${sources.includes(sq)?', hint':''}" aria-pressed="${selected===sq}" ${state.screen==='lesson'?'disabled':''} data-square="${sq}">${p?`<img class="piece" draggable="false" src="${PIECE_BASE}/${code}.svg" alt="">`:''}${fi===0?`<small class="rank">${8-r}</small>`:''}${ri===7?`<small class="file">${'abcdefgh'[f]}</small>`:''}</button>`;})).join('')}</div>`;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function animateMove(from,to){const source=document.querySelector(`[data-square="${from}"] .piece`),target=document.querySelector(`[data-square="${to}"]`);if(!source||!target)return Promise.resolve();const a=source.getBoundingClientRect(),b=target.getBoundingClientRect(),ghost=source.cloneNode(true);ghost.classList.add('moving-piece');Object.assign(ghost.style,{left:`${a.left}px`,top:`${a.top}px`,width:`${a.width}px`,height:`${a.height}px`});source.style.opacity='0';document.body.appendChild(ghost);return new Promise(resolve=>{requestAnimationFrame(()=>requestAnimationFrame(()=>ghost.style.transform=`translate(${b.left-a.left}px,${b.top-a.top}px)`));setTimeout(()=>{ghost.remove();resolve();},MOVE_MS);});}
function insightHtml(name){const x=openingInsight(name);return `<div class="insight"><b>Plan</b><p>${esc(x.plan)}</p><b>Pawn breaks</b><p>${esc(x.break)}</p><b>Watch for</b><p>${esc(x.watch)}</p></div>`;}
function drillView(){const s=state.session,progress=Math.round(s.cursor/Math.max(1,s.drill.positions.length)*100),timer=s.busy?'Opponent moving…':s.clockStopped?'Take your time':state.timerSeconds?`${remainingSeconds(state.timerSeconds,s.promptStartedAt)}s`:'Untimed';return appShell(`<main class="drill-page"><section class="drill-head"><button class="back" data-action="practice">← Exit drill</button><div class="drill-meta"><span>${s.review?'OPENING REVIEW':'OPENING DRILL'}</span><b>${esc(drillTitle(s.drill.line))}</b></div><div class="progress-track"><i style="width:${progress}%"></i></div><span>${s.cursor}/${s.drill.positions.length} ply</span></section><section class="drill-grid"><div>${boardHtml(s.chess,state.orientation)}</div><aside class="coach ${s.complete?'complete':''}">${s.complete?`<div class="result-icon">✓</div><p class="eyebrow">${s.review?'REVIEW COMPLETE':'LINE COMPLETE'}</p><h2>${s.mistakes?'Nice recovery.':'Clean run.'}</h2><p>${s.userMoves} attempts · ${s.mistakes} ${s.mistakes===1?'miss':'misses'}</p>${insightHtml(s.drill.line.openingName)}${s.mistakePositions.length?'<button class="secondary wide" data-action="review-weak">Retry a missed position</button>':''}<button class="primary wide" data-action="${availableDrillLines().length?'next':'practice'}">${availableDrillLines().length?'Drill another line →':'Back to practice →'}</button>`:s.awaitContinue?`<p class="eyebrow">MOVE REVEALED</p><h2>Study the reason.</h2>${teachingHtml(s)}<button class="primary wide" data-action="continue-drill" ${s.busy?'disabled':''}>${s.cursor>=s.drill.positions.length?'Finish line →':'Continue line →'}</button>`:`<p class="eyebrow">YOUR MOVE · ${s.drill.color.toUpperCase()} · <span id="drill-clock" role="timer" aria-label="Time remaining">${timer}</span></p><h2>Find the repertoire move.</h2><p class="sequence">${s.drill.line.moves.slice(0,s.cursor).map((m,i)=>`<span class="${i===s.cursor-1?'last':''}">${esc(m)}</span>`).join(' ')||'Opening position'}</p><div class="feedback ${state.message?'show':''}" role="status">${esc(state.message||'Select a piece, then its destination.')}</div>${teachingHtml(s)}<button class="secondary wide" data-action="hint" ${s.busy?'disabled':''}>${state.hintLevel===0?'Highlight the piece':state.hintLevel===1?'Show destination':'Hint shown'}</button><button class="text-button" data-action="reveal" ${s.busy?'disabled':''}>Reveal & continue</button>`}</aside></section></main>`);}
function challengeView(){const c=state.challenge,o=challengeOptions(c);return appShell(`<main class="drill-page"><section class="drill-head"><button class="back" data-action="challenge">← Exit challenge</button><div class="drill-meta"><span>THEORY CHALLENGE · ${state.challengeDifficulty.toUpperCase()}</span><b>${esc(c.openingName)}</b></div><div class="progress-track"><i style="width:${Math.round(c.cursor/c.targetPly*100)}%"></i></div><span>${c.cursor}/${c.targetPly} ply</span></section><section class="drill-grid"><div>${boardHtml(c.chess,state.orientation)}</div><aside class="coach ${c.complete?'complete':''}">${c.complete?`<div class="result-icon">✓</div><p class="eyebrow">CHALLENGE COMPLETE</p><h2>${c.mistakes?'A useful detour.':'Theory held.'}</h2><p>${esc(c.reason)}. ${c.correct} documented moves, ${c.mistakes} misses.</p><button class="primary wide" data-action="start-challenge">New random challenge →</button>`:`<p class="eyebrow">YOU ARE ${c.color.toUpperCase()}</p><h2>Stay inside theory.</h2><div class="challenge-badges"><span>${o.size} theory ${o.size===1?'move':'moves'}</span><span>Transpositions on</span></div><div class="feedback ${state.message?'show':''}" role="status">${esc(state.message||'Play any documented move from this position.')}</div>${state.pendingOutOfBook?`<div class="theory-alternatives"><b>Documented here</b><span>${[...o.keys()].slice(0,6).map(esc).join(' · ')}${o.size>6?' · …':''}</span></div><button class="primary wide" data-action="retry-book">Try a documented move</button><button class="secondary wide" data-action="continue-book">End round with ${esc(state.pendingOutOfBook.san)}</button>`:`<button class="secondary wide" data-action="hint">${state.hintLevel===0?'Highlight valid pieces':'Show destinations'}</button>`}`}</aside></section></main>`);}
async function tryMove(square){const s=state.session;if(!s||s.complete||s.busy||s.awaitContinue)return;if(expireDrillPrompt(s))return;const piece=s.chess.get(square),turn=s.chess.turn();if(!state.selectedSquare){if(piece?.color===turn){state.selectedSquare=square;if(!s.promptTimedOut)state.message='';render();}return;}if(piece?.color===turn){state.selectedSquare=square;render();return;}const move=parseMove(s.chess,state.selectedSquare,square);if(!move){state.selectedSquare=null;state.message='That piece cannot move there.';render();return;}const expected=s.drill.positions[s.cursor];if(move.from===expected.from&&move.to===expected.to){if(!s.promptTimedOut)recordPosition(s,true,state.hintLevel>0);s.busy=true;s.teaching=null;state.selectedSquare=null;state.message='Correct — keep going.';state.hintLevel=0;render();await animateMove(move.from,move.to);if(state.session!==s)return;s.chess.move(move.san);s.lastMove={from:move.from,to:move.to};s.cursor++;s.userMoves++;render();if(s.cursor>=s.drill.positions.length){s.busy=false;finishLine();render();return;}await delay(REPLY_PAUSE_MS);if(state.session===s)advanceOpponent();}else{recordPosition(s,false,state.hintLevel>0);s.mistakes++;s.userMoves++;s.clockStopped=true;s.teaching=openingMoveReason(s);state.selectedSquare=null;state.message='Not the repertoire move. The correct piece is highlighted.';state.hintLevel=Math.max(1,state.hintLevel);render();}}
async function tryChallengeMove(square){const c=state.challenge;if(!c||c.complete||c.busy)return;const piece=c.chess.get(square),turn=c.chess.turn();if(!state.selectedSquare){if(piece?.color===turn){state.selectedSquare=square;state.message='';render();}return;}if(piece?.color===turn){state.selectedSquare=square;render();return;}const move=parseMove(c.chess,state.selectedSquare,square);if(!move){state.selectedSquare=null;state.message='That piece cannot move there.';render();return;}if(!challengeOptions(c).get(move.san)){c.mistakes++;state.selectedSquare=null;state.pendingOutOfBook=move;state.message=`${move.san} is legal, but this catalog has no continuation for it. Try a listed move or end this round.`;render();return;}await acceptChallengeMove(c,move);}
async function acceptChallengeMove(c,move,outOfBook=false){c.busy=true;state.selectedSquare=null;state.message=outOfBook?'Leaving the documented line.':'Theory matched.';state.hintLevel=0;state.pendingOutOfBook=null;render();await animateMove(move.from,move.to);if(state.challenge!==c)return;c.chess.move(move);c.cursor++;if(!outOfBook)c.correct++;c.lastMove={from:move.from,to:move.to};updateChallengeOpening(c);render();if(outOfBook)return finishChallenge(`After ${move.san}, this challenge has no documented continuation`);if(c.cursor>=c.targetPly)return finishChallenge('Target depth reached');if(!challengeOptions(c).size)return finishChallenge('Theory branch complete');await delay(REPLY_PAUSE_MS);if(state.challenge===c)advanceChallengeOpponent();}
function download(name,text,type='text/plain'){saveTextFile(name,text,type);}
function handleClick(e){
  const reviewSquare=e.target.closest('[data-review-square]');
  if(reviewSquare)return state.screen==='review-practice'?handleReviewSquare(reviewSquare.dataset.reviewSquare):undefined;
  const square=e.target.closest('[data-square]');
  if(square)return state.screen==='lesson'?undefined:state.screen==='puzzle'?handlePuzzleSquare(square.dataset.square):state.screen==='challenge-play'?tryChallengeMove(square.dataset.square):tryMove(square.dataset.square);
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const {action,id}=el.dataset;
  if(state.screen==='game-review'&&['dashboard','analyze','home','practice','progress','challenge','lessons'].includes(action))cancelReviewEngine();
  if(['analysis','puzzle'].includes(state.screen)&&['dashboard','home','practice','progress','challenge','lessons'].includes(action))cancelAnalysisWork();
  const destinations={dashboard:'dashboard',analyze:'analysis',home:'library',practice:'practice',progress:'progress'};
  if(Object.hasOwn(destinations,action)){
    state.screen=destinations[action];
    state.session=null;state.challenge=null;state.selectedSquare=null;
    render();window.scrollTo(0,0);return;
  }
  if(handleReviewAction(el))return;
  if(handleAnalysisAction(el))return;
  if(handleLessonAction(el,{state,render,save,startSession,openings:workingOpenings}))return;
  if(action==='challenge'){
    state.screen='challenge-setup';state.challenge=null;state.session=null;
    render();window.scrollTo(0,0);return;
  }
  if(action==='challenge-difficulty'){state.challengeDifficulty=id;save();}
  if(action==='start-challenge')return startChallenge();
  if(action==='favorite-opening'||action==='favorite-line'){
    const list=action==='favorite-opening'?state.favoriteOpenings:state.favoriteLines;
    const known=action==='favorite-opening'?workingOpenings().some(o=>o.id===id):workingLines().some(l=>l.id===id);
    if(known){list.has(id)?list.delete(id):list.add(id);save();render();}
    return;
  }
  if(action==='expand'){
    if(state.query.trim()||state.focus==='favorites')state.searchCollapsed.has(id)?state.searchCollapsed.delete(id):state.searchCollapsed.add(id);
    else{state.expanded.has(id)?state.expanded.delete(id):state.expanded.add(id);save();}
  }
  if(action==='select-visible'){(state.query.trim()||state.focus==='favorites'?visibleOpenings():levelCatalog()).forEach(o=>o.lines.forEach(l=>state.selected.add(l.id)));save();}
  if(action==='clear'){state.selected.clear();save();}
  if(action==='toggle-opening'||action==='recommend'){
    const full=workingOpenings().find(o=>o.id===id),shown=action==='toggle-opening'&&(state.query.trim()||state.focus==='favorites')?visibleOpenings().find(o=>o.id===id):null;
    const o=shown||openingForLevel(full)||full,all=o.lines.every(l=>state.selected.has(l.id));
    o.lines.forEach(l=>all?state.selected.delete(l.id):state.selected.add(l.id));save();
  }
  if(action==='level'){state.level=id;state.query='';save();}
  if(action==='toggle-short'){state.showShortLines=!state.showShortLines;save();}
  if(action==='start'||action==='next')return startSession();
  if(action==='review')return startSession(true);
  if(action==='review-weak'){const s=state.session;if(s?.mistakePositions.length)return startSession(true,s.drill.line,s.mistakePositions[0]);}
  if(action==='continue-drill'){const s=state.session;if(!s?.awaitContinue||s.busy)return;s.awaitContinue=false;s.teaching=null;if(s.cursor>=s.drill.positions.length){finishLine();render();}else{s.busy=true;render();setTimeout(()=>{if(state.session===s)advanceOpponent();},REPLY_PAUSE_MS);}return;}
  if(action==='hint')state.hintLevel=Math.min(2,state.hintLevel+1);
  if(action==='reveal'){
    const s=state.session;if(!s||s.busy||s.awaitContinue||s.complete)return;
    const p=s.drill.positions[s.cursor];if(!s.promptTimedOut)recordPosition(s,false,true);
    s.busy=true;s.teaching=openingMoveReason(s);s.awaitContinue=true;state.message='Move revealed.';state.hintLevel=0;render();
    animateMove(p.from,p.to).then(()=>{
      if(state.session!==s)return;
      s.chess.move(p.san);s.lastMove={from:p.from,to:p.to};s.cursor++;s.userMoves++;s.mistakes++;
      s.busy=false;render();
    });return;
  }
  if(action==='retry-book'){state.pendingOutOfBook=null;state.message='Choose a documented continuation.';state.hintLevel=1;}
  if(action==='continue-book'){
    const c=state.challenge,move=state.pendingOutOfBook;state.pendingOutOfBook=null;
    if(move)return acceptChallengeMove(c,move,true);
  }
  if(action==='export-pgn')download('chessdrill-repertoire.pgn',linesToPgn(workingLines().filter(l=>state.selected.has(l.id))),'application/x-chess-pgn');
  if(action==='export-data')download('chessdrill-backup.json',JSON.stringify({...backupData(),reviewCards:exportMistakeDeck()},null,2),'application/json');
  if(action==='reset-stats'&&confirm('Reset all ChessDrill progress?')){state.stats={};state.positionStats={};save();}
  if(action==='delete-local-data'){
    if(!confirm('Delete all Chess Studio study data on this device? This includes openings, progress, account analysis, cached games, reviews, and puzzles. Exports saved elsewhere are unaffected. This cannot be undone.'))return;
    cancelAnalysisWork();cancelReviewEngine();
    try{deleteLocalStudyData(localStorage);location.reload();}
    catch{state.importNotice='Could not delete local data. Try clearing Chess Studio storage in your device or browser settings.';}
    return;
  }
  render();
}
function handleChange(e){
  const t=e.target;
  if(e.type==='input' && t.type==='file')return;
  if(handleReviewInput(t)||handleAnalysisInput(t))return;
  if(t.matches('[data-line]')){t.checked?state.selected.add(t.dataset.line):state.selected.delete(t.dataset.line);save();render();return;}
  if(t.matches('[data-role]')){state.lineRoles[t.dataset.role]=t.value;save();return;}
  if(t.id==='side'){state.side=t.value;save();return;}
  if(t.id==='timer'){state.timerSeconds=Number(t.value);save();return;}
  if(t.id==='focus'){state.focus=t.value;state.searchCollapsed.clear();save();render();return;}
  if(t.id==='sort'){state.sort=t.value;save();render();return;}
  if(t.id==='catalog-search'){state.query=t.value;state.searchCollapsed.clear();updateOpeningResults();return;}
  if(t.id==='import-file' && t.files?.[0]) void importStudyFile(t.files[0]);
}

async function importStudyFile(file){
  state.progressImportOpen=true;
  if(file.size>2_000_000){state.importNotice='Choose a file under 2 MB.';render();return;}
  try{
    const text=await file.text();
    const known=new Set(allLines().map(line=>line.id));
    if(/\.json$/i.test(file.name)){
      const raw=JSON.parse(text);
      const data=validateBackup(raw,known,OPENINGS.map(o=>o.id),OPENING_LESSONS.map(l=>l.id));
      const nextIndex=buildPositionIndex([...allLines(),...data.customLines]);
      if(Object.hasOwn(raw,'reviewCards'))restoreMistakeDeck(raw.reviewCards);
      Object.assign(state,{...data,selected:new Set(data.selected),expanded:new Set(data.expanded),favoriteOpenings:new Set(data.favoriteOpenings),favoriteLines:new Set(data.favoriteLines),searchCollapsed:new Set()});
      theoryIndex=nextIndex;
      state.importNotice='Backup imported. Your openings and practice history are ready.';
    }else{
      const lines=parsePgnCollection(text,new Set(workingLines().map(line=>line.id)));
      if(!lines.length)throw new Error('No playable chess lines were found in that PGN.');
      const validated=validateBackup({...backupData(),customLines:[...state.customLines,...lines]},known,OPENINGS.map(o=>o.id),OPENING_LESSONS.map(l=>l.id));
      const nextIndex=buildPositionIndex([...allLines(),...validated.customLines]);
      state.customLines=validated.customLines;
      for(const line of lines)state.selected.add(line.id);
      state.expanded.add('custom-repertoire');
      theoryIndex=nextIndex;
      state.importNotice=`${lines.length} ${lines.length===1?'opening line':'opening lines'} imported and selected.`;
    }
    save();render();
  }catch(error){state.importNotice=error instanceof Error?error.message:'That file could not be imported.';render();}
}

function studyOpening(name){cancelAnalysisWork();cancelReviewEngine();const normalized=s=>s.toLowerCase().replace(/[’']/g,'').replace(/\b([a-z]{3,})s\b/g,'$1').replace(/[^a-z0-9]/g,'');const target=normalized(name);const opening=workingOpenings().filter(o=>target.includes(normalized(o.name))||normalized(o.name).includes(target)).sort((a,b)=>b.name.length-a.name.length)[0];state.screen='library';state.level='advanced';state.focus='all';state.query=opening?.name||'';if(opening){state.expanded.add(opening.id);const main=opening.lines.find(l=>l.name==='Main line')||opening.lines[0];if(main)state.selected.add(main.id);}save();render();}
function render(){
  const active=document.activeElement;
  const focusKey=active?.id?'id':['line','square','role','action'].find(key=>active?.dataset?.[key]);
  const focusValue=focusKey==='id'?active.id:focusKey?active.dataset[focusKey]:null;
  const focusId=active?.dataset?.id;
  const selected=availableDrillLines();
  const due=dueReviewKeys(state.positionStats,selectedPositionKeys()).length;
  let view;
  switch(state.screen){
    case 'dashboard': view=appShell(dashboardView({summary:analysisSummary(),dueMistakes:dueMistakeCount(),selected:selected.length,due}));break;
    case 'practice': view=practiceView({selected:selected.length,due,mistakes:mistakeDeckSummary()},appShell);break;
    case 'analysis': view=appShell(analysisView());break;
    case 'game-review': view=appShell(gameReviewView());break;
    case 'review-practice': view=appShell(reviewPracticeView());break;
    case 'puzzle': view=appShell(puzzleView());break;
    case 'drill': view=drillView();break;
    case 'challenge-play': view=challengeView();break;
    case 'challenge-setup': view=challengeSetupView();break;
    case 'progress': view=progressView();break;
    case 'lessons': view=lessonCatalogView(state,appShell,esc);break;
    case 'lesson': view=lessonDetailView(state,appShell,boardHtml,esc);break;
    default: view=libraryView();
  }
  const app=document.querySelector('#app');app.innerHTML=view;
  if(focusKey){const candidates=focusKey==='id'?[document.getElementById(focusValue)]:[...app.querySelectorAll(`[data-${focusKey}]`)];const target=candidates.find(el=>el&&(focusKey==='id'||el.dataset[focusKey]===focusValue)&&(focusKey!=='action'||el.dataset.id===focusId));if(target&&!target.disabled)target.focus({preventScroll:true});}
}
connectAnalysis({render,studyOpening,navigate:screen=>{if(screen!=='analysis')cancelAnalysisWork();state.screen=screen;render();}});connectReview({render,studyOpening,navigate:screen=>{cancelAnalysisWork();state.screen=screen;render();}});document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);document.addEventListener('input',handleChange);document.addEventListener('submit',e=>{if(e.target.id==='analysis-form')void submitAnalysis(e);if(e.target.id==='review-pgn-form')submitReviewPgn(e);});document.addEventListener('visibilitychange',()=>{const s=state.session;if(!s||s.complete)return;if(document.hidden)s.hiddenAt=Date.now();else if(s.hiddenAt){s.promptStartedAt+=Date.now()-s.hiddenAt;s.hiddenAt=null;updateDrillClock();}});setInterval(updateDrillClock,250);render();
document.addEventListener('click',e=>{
  const link=e.target.closest('a[target="_blank"]');
  if(link && link.href.startsWith('https://') && window.ChessStudioNative?.postMessage){
    e.preventDefault();
    window.ChessStudioNative.postMessage(JSON.stringify({action:'open',url:link.href}));
  }
},true);
// Called by Android's system Back button. The website's own navigation stays unchanged.
window.chessStudioBack=()=>{
  if(state.screen==='dashboard')return false;
  if(state.screen==='game-review')cancelReviewEngine();
  if(['analysis','puzzle'].includes(state.screen))cancelAnalysisWork();
  const next={lesson:'lessons',drill:'practice','challenge-play':'challenge-setup','challenge-setup':'practice',puzzle:'analysis','review-practice':'practice','game-review':'analysis'};
  state.screen=next[state.screen]||'dashboard';
  state.session=null;state.challenge=null;state.selectedSquare=null;state.pendingOutOfBook=null;
  render();return true;
};

function libraryView(){
  const catalog=levelCatalog(),selected=availableDrillLines();
  const visible=visibleOpenings();
  return appShell(`<main class="page openings-page">
    <header class="openings-intro"><div><p class="eyebrow">YOUR REPERTOIRE</p><h1>Openings</h1><p>Learn a plan, choose your lines, then practice the key moves.</p></div><div class="openings-intro-actions"><button class="secondary" data-action="lessons">Guided lessons →</button><button class="primary" data-action="start" ${selected.length?'':'disabled'}>Drill ${selected.length} ${selected.length===1?'line':'lines'} →</button></div></header>
    <section class="opening-level" aria-label="Library level"><span>Show openings for</span><div class="level-switch">${STUDY_LEVELS.map(x=>`<button class="${state.level===x?'active':''}" data-action="level" data-id="${x}" aria-pressed="${state.level===x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div></section>
    <details class="opening-secondary"><summary>Drill settings</summary><div class="opening-settings"><label>Practice side<select id="side"><option value="repertoire">Line repertoire side</option><option value="white" ${state.side==='white'?'selected':''}>White only</option><option value="black" ${state.side==='black'?'selected':''}>Black only</option></select></label><label>Recall clock<select id="timer"><option value="0">Untimed</option><option value="15" ${state.timerSeconds===15?'selected':''}>15 seconds</option><option value="5" ${state.timerSeconds===5?'selected':''}>5 seconds</option><option value="2" ${state.timerSeconds===2?'selected':''}>2 seconds</option></select></label></div></details>
    <section class="library"><div class="section-heading"><div><p class="eyebrow">${catalog.length} FAMILIES · ${catalog.reduce((n,o)=>n+o.lines.length,0).toLocaleString()} LINES</p><h2>Choose lines to practice</h2></div><div class="selection-actions"><button data-action="select-visible">${selectionLabel()}</button><button data-action="clear">Clear selection</button></div></div>
      ${state.selected.size>selected.length?`<p class="library-selection-note">${state.selected.size} lines saved; ${selected.length} available with this level and drill side. Your other choices remain saved.</p>`:''}
      <div class="catalog-tools"><label class="catalog-search"><span>⌕</span><input id="catalog-search" value="${esc(state.query)}" placeholder="Search openings, variations, or ECO…" aria-label="Search openings"></label><select id="focus" aria-label="Filter openings"><option value="all">All openings</option><option value="white" ${state.focus==='white'?'selected':''}>White repertoire</option><option value="black" ${state.focus==='black'?'selected':''}>Black repertoire</option><option value="selected" ${state.focus==='selected'?'selected':''}>Selected openings</option><option value="favorites" ${state.focus==='favorites'?'selected':''}>★ Favorites</option></select><select id="sort" aria-label="Sort openings"><option value="recommended" ${state.sort==='recommended'?'selected':''}>Suggested first</option><option value="eco" ${state.sort==='eco'?'selected':''}>ECO order</option><option value="name" ${state.sort==='name'?'selected':''}>Name A–Z</option><option value="lines" ${state.sort==='lines'?'selected':''}>Most variations</option></select><button class="short-lines-toggle ${state.showShortLines?'active':''}" data-action="toggle-short" aria-pressed="${state.showShortLines}"><span>${state.showShortLines?'✓':''}</span> Show lines under 4 moves</button></div>
      <p class="catalog-result-count" id="catalog-result-count" role="status">${openingResultCount(visible)}</p>
      <div class="opening-list">${visible.map(openingCard).join('')||noOpeningResults()}</div>
    </section>
    <details id="suggested-openings" class="opening-secondary" ${state.query.trim()?'hidden':''}><summary>Suggested openings</summary>${recommendationsView()}</details>
  </main>`);
}

function visibleOpenings(){
  let visible=levelCatalog();
  if(state.focus==='favorites')visible=filterFavoriteOpenings(visible,state.favoriteOpenings,state.favoriteLines);
  else visible=visible.filter(o=>state.focus==='all'||(state.focus==='selected'?o.lines.some(l=>state.selected.has(l.id)):o.color===state.focus));
  const query=state.query.trim();
  visible=filterOpeningLines(visible,query);
  const recommended=o=>{const index=RECOMMENDATIONS.findIndex(([name])=>name===o.name);return index<0?Infinity:index;};
  const base=(a,b)=>state.sort==='name'?a.name.localeCompare(b.name):state.sort==='lines'?b.lines.length-a.lines.length||a.name.localeCompare(b.name):state.sort==='recommended'?recommended(a)-recommended(b)||a.name.localeCompare(b.name):a.eco.localeCompare(b.eco)||a.name.localeCompare(b.name);
  return visible.sort((a,b)=>query?Number(!openingMatchesSearch(a,query))-Number(!openingMatchesSearch(b,query))||base(a,b):base(a,b));
}

function selectionLabel(){return state.query.trim()?'Select matching lines':state.focus==='favorites'?'Select favorite lines':'Select all in level';}

function openingResultCount(visible){
  const families=`${visible.length} ${visible.length===1?'opening':'openings'}`;
  if(!state.query.trim())return `${families} shown`;
  const count=visible.reduce((total,o)=>total+o.lines.length,0);
  return `${families} · ${count} matching ${count===1?'line':'lines'}`;
}

function noOpeningResults(){return `<div class="no-results">${state.query.trim()?'No lines match this search in the current level and filter.':state.focus==='favorites'?'No favorites in this level yet. Star an opening or line to add one.':'No openings match those filters.'}</div>`;}

function updateOpeningResults(){
  const visible=visibleOpenings();
  const list=document.querySelector('.opening-list');
  const count=document.querySelector('#catalog-result-count');
  if(list)list.innerHTML=visible.map(openingCard).join('')||noOpeningResults();
  if(count)count.textContent=openingResultCount(visible);
  const select=document.querySelector('[data-action="select-visible"]');
  if(select)select.textContent=selectionLabel();
  const suggestions=document.querySelector('#suggested-openings');
  if(suggestions)suggestions.hidden=!!state.query.trim();
}

function progressView(){
  const deck=mistakeDeckSummary();
  const selected=workingLines().filter(l=>state.selected.has(l.id));
  const coverage=coverageForLines(selected,theoryIndex,state.positionStats);
  const due=dueReviewKeys(state.positionStats,selectedPositionKeys()).length;
  const learned=Object.keys(state.lessonCompleted).length;
  const families=coverageByOpening(workingOpenings(),selected,theoryIndex,state.positionStats)
    .sort((a,b)=>a.c.mastery-b.c.mastery);
  return appShell(`<main class="page progress-page"><p class="eyebrow">YOUR STUDY RECORD</p><h1>Progress</h1>
    <section class="stat-grid"><div><span>${coverage.practiced}/${coverage.positions}</span><small>opening positions seen</small></div><div><span>${due}</span><small>opening positions due</small></div><div><span>${coverage.mastery}%</span><small>estimated mastery</small></div></section>
    <div class="progress-summary"><span>${learned}/${OPENING_LESSONS.length} lessons completed</span><span>${deck.total} game positions saved · ${deck.due} due</span><button class="text-button" data-action="practice">Go to practice →</button></div>
    <details class="opening-secondary progress-tools" ${state.progressImportOpen?'open':''}><summary>Import, export, and reset</summary><div class="progress-actions"><button class="secondary" data-action="export-pgn">Export selected PGN</button><button class="secondary" data-action="export-data">Back up progress</button><label class="secondary file-button">Import PGN / backup<input id="import-file" type="file" accept=".pgn,.json,text/plain"></label><button class="secondary" data-action="reset-stats">Reset practice stats</button></div><p>Your backup includes selected lines, lessons, opening reviews, and game puzzles. Cached account reports and full game reviews are not included.</p><div class="data-control"><div><b>Delete local study data</b><p>Removes openings, progress, account reports, cached games, reviews, and puzzles from this device. Save anything you need first.</p></div><button class="secondary" data-action="delete-local-data">Delete all local data</button></div>${state.importNotice?`<p class="import-notice" role="status">${esc(state.importNotice)}</p>`:''}</details>
    <section class="progress-list"><div class="section-heading"><h2>Repertoire coverage</h2><button class="text-button" data-action="home">Choose openings →</button></div>${families.length?families.map(({o,lines,c})=>`<div class="coverage-row"><span><b>${esc(o.name)}</b><small>${lines.length} selected lines · ${c.practiced}/${c.positions} positions seen · ${c.due} due</small></span><div class="mastery"><i style="width:${c.mastery}%"></i></div><strong>${c.mastery}%</strong></div>`).join(''):'<div class="empty"><h3>No repertoire selected yet</h3><p>Choose an opening to start building your coverage map.</p><button class="primary" data-action="home">Choose openings →</button></div>'}</section>
  </main>`);
}
