import { createPuzzlePool } from '../../js/puzzle-pool.js';
import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import { SIZE, TOTAL, LEVELS, LEVEL_INFO, generatePuzzle, validateBoard, findNextDeduction } from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_sol_lua_v1';
const ERROR_DELAY_MS = 1000;

let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {}
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {}
};

const state = {
  level: LEVELS.includes(saved.level) ? saved.level : 'medium',
  puzzle: null,
  grid: [],
  history: [],
  hint: null,
  lastPop: -1,
  won: false,
  seconds: 0,
  timerId: null,
  errors: 0,
  errorTimer: null,
  shownBadCells: new Set(),
  shownBadSigns: new Set(),
  shownReason: null,
  modal: null,
  rulesTab: 'rules',
};

function buildGarland(el) {
  const colors = ['#f7b733', '#e5482f', '#1fae96', '#f6e8c8', '#3d7be0'];
  const total = Number(el.dataset.bulbs) || 26;
  let html = '';
  for (let seg = 0, n = 0; seg < Math.ceil(total / 5); seg++) {
    let bulbs = '';
    for (let k = 0; k < 5; k++, n++) {
      const t = (k + 0.5) / 5;
      const top = 24 * Math.sqrt(1 - (2 * t - 1) ** 2) - 1;
      bulbs += `<i style="left:${(t * 100).toFixed(1)}%;top:${top.toFixed(1)}px;--b:${colors[n % colors.length]};--i:${n}"></i>`;
    }
    html += `<div class="gl-seg">${bulbs}</div>`;
  }
  el.innerHTML = html;
}

function buildAmbient(el) {
  const colors = ['#f7b733', '#e5482f', '#1fae96', '#f6e8c8', '#3d7be0'];
  const pts = [
    [8, 78, 1.1, 0],
    [16, 44, 0.85, 1],
    [24, 84, 1.25, 2],
    [35, 28, 0.75, 3],
    [48, 88, 1.0, 4],
    [62, 32, 0.9, 0],
    [74, 82, 1.2, 1],
    [84, 52, 0.8, 2],
    [92, 76, 1.15, 3],
    [12, 22, 0.7, 4],
    [88, 24, 0.95, 0],
    [54, 18, 0.8, 2],
  ];
  let svg = '<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">';
  pts.forEach(([x, y, s, ci], idx) => {
    const cx = x * 10;
    const cy = y * 7;
    const col = colors[ci];
    const dur = (7 + (idx % 5) * 1.6).toFixed(1);
    const delay = (-idx * 1.3).toFixed(1);
    if (idx % 3 === 0) {
      svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${cx},${cy}) scale(${s})"><path d="M0-10 L8 0 L0 10 L-8 0 Z" fill="${col}" opacity=".22"/><circle cx="0" cy="0" r="3.2" fill="#fff8ea" opacity=".35"/></g></g>`;
    } else {
      svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${cx},${cy}) scale(${s})"><path d="M0-7 Q0 0 7 0 Q0 0 0 7 Q0 0 -7 0 Q0 0 0-7 Z" fill="${col}" opacity=".28"/></g></g>`;
    }
  });
  svg += '</svg>';
  el.innerHTML = svg;
}

function modal(kind, inner) {
  return `<div class="modal" data-kind="${kind}" role="dialog" aria-modal="true">${inner}</div>`;
}

function rulesModal() {
  const tab = state.rulesTab === 'about' ? 'about' : 'rules';
  const tabs = `<div class="modal-tabs" role="tablist">
    <button class="tab-btn ${tab === 'rules' ? 'on' : ''}" data-act="rules-tab" data-tab="rules" role="tab" aria-selected="${tab === 'rules'}">${ico('help', 's')}Como joga</button>
    <button class="tab-btn ${tab === 'about' ? 'on' : ''}" data-act="rules-tab" data-tab="about" role="tab" aria-selected="${tab === 'about'}">${ico('info', 's')}Sobre e créditos</button>
  </div>`;
  if (tab === 'about') {
    return modal(
      'rules',
      `${tabs}
       <h2>Sobre e créditos</h2>
       <div class="about-box">
         <div class="about-card">
           <div class="about-av">${avatar(0)}</div>
           <div class="about-copy">
             <b>Caio Nunes <small>@caionunespn</small></b>
             <p>Criador da barraca de mini-jogos do <b>Catapulta Online</b> — transformando clássicos de tabuleiro e lógica em desafios rápidos com estética de quermesse noturna.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('sun', 's')}Por que Sol &amp; Lua?</span>
             <p>Depois da pancadaria multiplayer da Catapulta, faltava um desafio solo de queimar neurônio em 2 minutos. Cada partida gera um tabuleiro inédito garantido de fechar na pura lógica.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro, com gerador e solucionador lógico próprios no navegador.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Zero chute</b><span>Todo tabuleiro é validado passo a passo por um solver humano antes de ir para a mesa.</span></div></div>
         </div>
       </div>
       <div class="row"><button class="btn yellow" data-act="close">Fechar</button></div>`
    );
  }
  const sun = ico('sun', 's');
  const moon = ico('moon', 's');
  const ok = ico('check', 's');
  const no = ico('nope', 's');
  return modal(
    'rules',
    `${tabs}
     <h2>Como joga</h2>
     <div class="rules-guide">
       <div class="rules-goal">
         ${ico('sun', 'l')}
         <div>
           <b>Objetivo: equilibrar Sol e Lua na grade 6×6!</b>
           <span>Preencha todas as casas com <b>Sol</b> ${sun} ou <b>Lua</b> ${moon} usando apenas dedução lógica. Há uma única resposta certa e você nunca precisa adivinhar.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. As 3 regras de ouro</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('sun', 'l')}
           <b>3 de cada por fila</b>
           <small>Cada linha e cada coluna deve ter exatamente <b>3 Sóis</b> ${sun} e <b>3 Luas</b> ${moon}.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('moon', 'l')}
           <b>Máximo 2 seguidos</b>
           <small>Não mais do que 2 iguais lado a lado na horizontal ou vertical (${sun}${sun} ${ok} · ${sun}${sun}${sun} ${no}).</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('bulb', 'l')}
           <b>Sinais = e ×</b>
           <small>Casas separadas por <span class="sl-inline-sign">=</span> têm o <b>mesmo tipo</b>; separadas por <span class="sl-inline-sign">×</span> têm <b>tipos opostos</b>.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Controles e ajuda</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('sun', 'l')}
           <div>
             <b>Como preencher</b>
             <span>1º toque coloca <b>Sol</b>, 2º coloca <b>Lua</b> e o 3º limpa a casa (no computador, o clique direito inverte a ordem).</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Dica lógica e contagem de erros</b>
             <span>Você pode clicar rápido para alternar o símbolo — o jogo aguarda você parar antes de apontar erros. Se travar, o botão <b>Dica</b> explica a próxima dedução.</span>
           </div>
         </div>
       </div>
     </div>
     <div class="row"><button class="btn yellow" data-act="close">Entendi, bora jogar!</button></div>`
  );
}

function renderModal() {
  const root = $('#modal-root');
  if (!root) return;
  root.innerHTML = state.modal === 'rules' ? rulesModal() : '';
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerDom() {
  const el = $('#sl-timer');
  if (el) el.textContent = fmtTime(state.seconds);
}

function clearPendingErrorCheck() {
  if (state.errorTimer) {
    clearTimeout(state.errorTimer);
    state.errorTimer = null;
  }
}

function commitErrors() {
  state.errorTimer = null;
  if (!state.puzzle || state.won) return;

  const v = validateBoard(state.grid, state.puzzle.signs);
  const hasNewCellErr = [...v.badCells].some((c) => !state.shownBadCells.has(c));
  const hasNewSignErr = [...v.badSigns].some((s) => !state.shownBadSigns.has(s));

  state.shownBadCells = v.badCells;
  state.shownBadSigns = v.badSigns;
  state.shownReason = v.reason;

  if (hasNewCellErr || hasNewSignErr) {
    state.errors++;
    sfx.err();
    shake($('.sl-stage'), 0.45);
  }

  render();
}

const puzzlePool = createPuzzlePool('sol-e-lua', generatePuzzle, LEVELS);

function startNewGame(level = state.level) {
  clearPendingErrorCheck();
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();

  state.puzzle = puzzlePool.take(state.level);
  state.grid = [...state.puzzle.givens];
  state.history = [];
  state.hint = null;
  state.lastPop = -1;
  state.won = false;
  state.seconds = 0;
  state.errors = 0;
  state.shownBadCells = new Set();
  state.shownBadSigns = new Set();
  state.shownReason = null;

  clearInterval(state.timerId);
  updateTimerDom();
  state.timerId = setInterval(() => {
    if (!state.won) {
      state.seconds++;
      updateTimerDom();
    }
  }, 1000);

  render();
}

function setCell(idx, val) {
  if (!state.puzzle || state.won || state.puzzle.givens[idx] !== null) return;
  const prev = state.grid[idx];
  if (prev === val) return;

  clearPendingErrorCheck();
  state.history.push({ idx, prev, next: val });
  state.grid[idx] = val;
  state.hint = null;
  state.lastPop = val !== null ? idx : -1;

  const v = validateBoard(state.grid, state.puzzle.signs);

  // Se alguma célula que já estava marcada como erro foi corrigida pelo clique, limpa o destaque dela na hora
  if (state.shownBadCells.size > 0 || state.shownBadSigns.size > 0) {
    state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
    state.shownBadSigns = new Set([...state.shownBadSigns].filter((s) => v.badSigns.has(s)));
    state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;
  }

  if (v.isSolved) {
    state.won = true;
    state.shownBadCells.clear();
    state.shownBadSigns.clear();
    state.shownReason = null;
    clearInterval(state.timerId);
    sfx.win();
    confetti(95);
    const stageRect = $('#sl-grid')?.getBoundingClientRect();
    if (stageRect) {
      burst({ x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 }, '#f7b733', 16);
    }
    const errTxt = state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
    toast(`Tabuleiro ${LEVEL_INFO[state.level].name} fechado em ${fmtTime(state.seconds)} (${errTxt})!`, 'big');
  } else {
    if (val !== null) sfx.pop();
    else sfx.click();

    // Aguarda o jogador parar de clicar antes de acusar e contabilizar novos erros
    if (v.badCells.size > 0) {
      state.errorTimer = setTimeout(commitErrors, ERROR_DELAY_MS);
    }
  }

  render();
}

function onCellClick(idx, reverse = false) {
  if (!state.puzzle || state.won || state.puzzle.givens[idx] !== null) return;
  if (state.hint && state.hint.cell === idx && state.grid[idx] !== state.hint.val) {
    setCell(idx, state.hint.val);
    return;
  }
  const cur = state.grid[idx];
  let next;
  if (!reverse) {
    next = cur === null ? 0 : cur === 0 ? 1 : null;
  } else {
    next = cur === null ? 1 : cur === 1 ? 0 : null;
  }
  setCell(idx, next);
}

function doUndo() {
  if (!state.history.length || state.won) return;
  clearPendingErrorCheck();
  const last = state.history.pop();
  state.grid[last.idx] = last.prev;
  state.hint = null;
  state.lastPop = -1;

  const v = validateBoard(state.grid, state.puzzle.signs);
  state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
  state.shownBadSigns = new Set([...state.shownBadSigns].filter((s) => v.badSigns.has(s)));
  state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;

  sfx.click();
  render();
}

function doClear() {
  if (!state.puzzle || state.won) return;
  const hasPlayerMoves = state.grid.some((v, i) => state.puzzle.givens[i] === null && v !== null);
  if (!hasPlayerMoves) return;
  clearPendingErrorCheck();
  state.grid = [...state.puzzle.givens];
  state.history = [];
  state.hint = null;
  state.lastPop = -1;
  state.shownBadCells.clear();
  state.shownBadSigns.clear();
  state.shownReason = null;
  sfx.click();
  render();
}

function doHint() {
  if (!state.puzzle || state.won) return;
  clearPendingErrorCheck();

  if (state.hint && state.grid[state.hint.cell] !== state.hint.val) {
    setCell(state.hint.cell, state.hint.val);
    return;
  }

  for (let i = 0; i < TOTAL; i++) {
    if (state.puzzle.givens[i] === null && state.grid[i] !== null && state.grid[i] !== state.puzzle.solution[i]) {
      const correctVal = state.puzzle.solution[i];
      state.hint = {
        cell: i,
        val: correctVal,
        cells: [i],
        reason: `Esta casa está com o símbolo trocado. Toque nela (ou em Dica de novo) para mudar para <b>${correctVal === 0 ? 'Sol' : 'Lua'}</b>.`,
      };
      sfx.pop();
      render();
      return;
    }
  }

  const move = findNextDeduction(state.grid, state.puzzle.signs, 4);
  if (move) {
    const symName = move.val === 0 ? 'Sol' : 'Lua';
    state.hint = {
      cell: move.cell,
      val: move.val,
      cells: move.cells || [move.cell],
      reason: `<b>Dica (${symName}):</b> ${move.reason} <small>(Toque na casa destacada)</small>`,
    };
    sfx.pop();
    render();
    return;
  }

  const emptyIdx = state.grid.findIndex((v) => v === null);
  if (emptyIdx >= 0) {
    const val = state.puzzle.solution[emptyIdx];
    state.hint = {
      cell: emptyIdx,
      val,
      cells: [emptyIdx],
      reason: `<b>Dica:</b> Esta casa leva <b>${val === 0 ? 'Sol' : 'Lua'}</b>.`,
    };
    sfx.pop();
    render();
  }
}

const domCache = {
  puzzle: null,
  cells: [],
  prevCls: new Array(TOTAL).fill(''),
  prevInner: new Array(TOTAL).fill(''),
  signs: [],
  prevSignBad: [],
  lastLevel: null,
  lastProgress: '',
  lastErrKey: '',
  lastStatusKey: '',
};

function ensureSolLuaDOM() {
  if (domCache.puzzle === state.puzzle) return;
  domCache.puzzle = state.puzzle;
  const { givens, signs } = state.puzzle;

  const gridEl = $('#sl-grid');
  gridEl.innerHTML = '';
  const gridFrag = document.createDocumentFragment();
  domCache.cells = new Array(TOTAL);
  domCache.prevCls = new Array(TOTAL).fill('');
  domCache.prevInner = new Array(TOTAL).fill('');

  for (let i = 0; i < TOTAL; i++) {
    const r = Math.floor(i / SIZE) + 1;
    const c = (i % SIZE) + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sl-cell';
    btn.dataset.cell = String(i);
    btn.disabled = givens[i] !== null;
    btn.setAttribute('aria-label', `Linha ${r}, Coluna ${c}: vazia`);
    gridFrag.appendChild(btn);
    domCache.cells[i] = btn;
  }
  gridEl.appendChild(gridFrag);

  const signsEl = $('#sl-signs');
  signsEl.innerHTML = '';
  const signsFrag = document.createDocumentFragment();
  domCache.signs = new Array(signs.length);
  domCache.prevSignBad = new Array(signs.length).fill(false);
  signs.forEach((s, idx) => {
    const leftPct = s.dir === 'h' ? ((s.c + 1) / SIZE) * 100 : ((s.c + 0.5) / SIZE) * 100;
    const topPct = s.dir === 'h' ? ((s.r + 0.5) / SIZE) * 100 : ((s.r + 1) / SIZE) * 100;
    const span = document.createElement('span');
    span.className = 'sl-sign';
    span.style.left = `${leftPct.toFixed(2)}%`;
    span.style.top = `${topPct.toFixed(2)}%`;
    span.textContent = s.type === '=' ? '=' : '×';
    signsFrag.appendChild(span);
    domCache.signs[idx] = span;
  });
  signsEl.appendChild(signsFrag);
}

function render() {
  if (!state.puzzle) return;
  ensureSolLuaDOM();
  const { givens, signs } = state.puzzle;

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  let filled = 0;
  for (let i = 0; i < TOTAL; i++) if (state.grid[i] !== null) filled++;
  const progEl = $('#sl-progress');
  const progKey = String(filled);
  if (progEl && domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    progEl.innerHTML = `${ico('sun', 's')}<b>${filled}</b>/${TOTAL}`;
  }

  const errEl = $('#sl-errors');
  const errKey = String(state.errors);
  if (errEl && domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  const stEl = $('#sl-status');
  if (stEl) {
    let stCls = 'sl-status-bar';
    let stHtml;
    if (state.won) {
      const errTxt = state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
      stCls += ' win';
      stHtml = `${ico('crown', 's')} Perfeito! Fechado no nível ${LEVEL_INFO[state.level].name} em ${fmtTime(state.seconds)} (${errTxt})!`;
    } else if (state.shownBadCells.size > 0 && state.shownReason) {
      stCls += ' err';
      stHtml = `${ico('nope', 's')} <span>${state.shownReason}</span>`;
    } else if (state.hint) {
      stCls += ' hint';
      stHtml = `${ico('bulb', 's')} <span>${state.hint.reason}</span>`;
    } else {
      stHtml = `Toque numa casa: 1x ${ico('sun', 's')} <b>Sol</b> · 2x ${ico('moon', 's')} <b>Lua</b> · 3x limpa.`;
    }
    const stKey = `${stCls}|${stHtml}`;
    if (domCache.lastStatusKey !== stKey) {
      domCache.lastStatusKey = stKey;
      stEl.className = stCls;
      stEl.innerHTML = stHtml;
    }
  }

  const hintCtx = state.hint?.cells ? new Set(state.hint.cells) : null;
  for (let i = 0; i < TOTAL; i++) {
    const isGiven = givens[i] !== null;
    const val = state.grid[i];
    const isBad = state.shownBadCells.has(i);
    const isTarget = state.hint?.cell === i;
    const isCtx = !isTarget && hintCtx && hintCtx.has(i);

    let cls = 'sl-cell';
    if (isGiven) cls += ' given';
    if (isBad) cls += ' bad';
    if (isTarget) cls += ' hint-target';
    if (isCtx) cls += ' hint-ctx';

    const btn = domCache.cells[i];
    if (domCache.prevCls[i] !== cls) {
      domCache.prevCls[i] = cls;
      btn.className = cls;
    }

    let innerKey = '';
    if (val === 0 || val === 1) {
      innerKey = `${val}:${state.lastPop === i ? 1 : 0}`;
    } else if (isTarget && state.hint) {
      innerKey = `h:${state.hint.val}`;
    }

    if (domCache.prevInner[i] !== innerKey) {
      domCache.prevInner[i] = innerKey;
      const r = Math.floor(i / SIZE) + 1;
      const c = (i % SIZE) + 1;
      const labelVal = val === 0 ? 'Sol' : val === 1 ? 'Lua' : 'vazia';
      btn.setAttribute('aria-label', `Linha ${r}, Coluna ${c}: ${labelVal}`);
      if (val === 0 || val === 1) {
        const pop = state.lastPop === i ? ' pop' : '';
        btn.innerHTML = `<span class="sl-piece${pop}">${ico(val === 0 ? 'sun' : 'moon')}</span>`;
      } else if (isTarget && state.hint) {
        btn.innerHTML = `<span class="sl-piece ghost-hint">${ico(state.hint.val === 0 ? 'sun' : 'moon')}</span>`;
      } else {
        btn.textContent = '';
      }
    }
  }
  state.lastPop = -1;

  for (let idx = 0; idx < signs.length; idx++) {
    const isBad = state.shownBadSigns.has(idx);
    if (domCache.prevSignBad[idx] !== isBad) {
      domCache.prevSignBad[idx] = isBad;
      domCache.signs[idx].classList.toggle('bad', isBad);
    }
  }

  const hasPlayerMoves = state.grid.some((val, i) => givens[i] === null && val !== null);
  $('#btn-undo').disabled = state.won || state.history.length === 0;
  $('#btn-clear').disabled = state.won || !hasPlayerMoves;
  $('#btn-hint').disabled = state.won;
}

document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
if ($('#btn-rules')) $('#btn-rules').innerHTML = ico('help');
if ($('#btn-bottom-rules')) $('#btn-bottom-rules').innerHTML = `${ico('help', 's')}Como joga`;
if ($('#btn-bottom-about')) $('#btn-bottom-about').innerHTML = `${ico('info', 's')}Sobre e créditos`;
$('#btn-new-game').innerHTML = `${ico('reset', 's')}<span>Novo tabuleiro</span>`;
$('#btn-undo').innerHTML = `${ico('undo', 's')}<span>Desfazer</span>`;
$('#btn-hint').innerHTML = `${ico('bulb', 's')}<span>Dica</span>`;

document.addEventListener('click', (e) => {
  if (e.target === $('#modal-root') && state.modal) {
    state.modal = null;
    sfx.click();
    renderModal();
    return;
  }
  const cellBtn = e.target.closest('[data-cell]');
  if (cellBtn && !cellBtn.disabled) {
    onCellClick(Number(cellBtn.dataset.cell), false);
    return;
  }
  const actBtn = e.target.closest('[data-act]');
  if (!actBtn || actBtn.disabled) return;
  const act = actBtn.dataset.act;
  if (act === 'level') {
    sfx.click();
    startNewGame(actBtn.dataset.level);
  } else if (act === 'new-game') {
    sfx.click();
    startNewGame(state.level);
  } else if (act === 'undo') {
    doUndo();
  } else if (act === 'clear') {
    doClear();
  } else if (act === 'hint') {
    doHint();
  } else if (act === 'mute') {
    setMuted(!isMuted());
    $('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
    sfx.click();
  } else if (act === 'rules') {
    sfx.click();
    if (state.modal === 'rules' && state.rulesTab === 'rules') state.modal = null;
    else {
      state.rulesTab = 'rules';
      state.modal = 'rules';
    }
    renderModal();
  } else if (act === 'about') {
    sfx.click();
    if (state.modal === 'rules' && state.rulesTab === 'about') state.modal = null;
    else {
      state.rulesTab = 'about';
      state.modal = 'rules';
    }
    renderModal();
  } else if (act === 'rules-tab') {
    sfx.click();
    state.rulesTab = actBtn.dataset.tab === 'about' ? 'about' : 'rules';
    state.modal = 'rules';
    renderModal();
  } else if (act === 'close') {
    sfx.click();
    state.modal = null;
    renderModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.modal) {
    state.modal = null;
    renderModal();
  }
});

$('#sl-grid').addEventListener('contextmenu', (e) => {
  const cellBtn = e.target.closest('[data-cell]');
  if (!cellBtn || cellBtn.disabled) return;
  e.preventDefault();
  onCellClick(Number(cellBtn.dataset.cell), true);
});

startNewGame(state.level);
