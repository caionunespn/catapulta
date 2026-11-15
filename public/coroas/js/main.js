import { createPuzzlePool } from '../../js/puzzle-pool.js';
import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  EMPTY,
  CROSS,
  QUEEN,
  LEVELS,
  LEVEL_INFO,
  REGION_COLORS,
  generatePuzzle,
  validateBoard,
  findNextDeduction,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_coroas_v1';
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
  shownReason: null,
  modal: null,
  rulesTab: 'rules',
  drag: null,
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

function buildMiniExample(cells) {
  // cells: array de 16 itens [bgHex, 'crown'|'x'|'', bTop, bRight, bBottom, bLeft]
  let html = '<div class="cr-mini-grid" aria-hidden="true">';
  for (const [bg, sym, bt, br, bb, bl] of cells) {
    const style =
      `background:${bg};` +
      (bt ? 'border-top:2px solid #14202b;' : '') +
      (br ? 'border-right:2px solid #14202b;' : '') +
      (bb ? 'border-bottom:2px solid #14202b;' : '') +
      (bl ? 'border-left:2px solid #14202b;' : '');
    const inner = sym === 'crown' ? ico('crown', 's') : sym === 'x' ? '×' : '';
    html += `<div class="cr-mini-cell" style="${style}">${inner}</div>`;
  }
  html += '</div>';
  return html;
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — trazendo desafios clássicos de lógica e estratégia feitos do zero para o navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('crown', 's')}Por que Coroas?</span>
             <p>Cada partida gera regiões coloridas inéditas de 6×6 a 9×9 e garante, com um solucionador lógico próprio, que você consiga cravar todas as coroas sem precisar chutar nenhuma vez.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro, sem dependências externas.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>100% dedutível</b><span>Gerador de regiões conexas validado passo a passo por regras humanas.</span></div></div>
         </div>
       </div>
       <div class="row"><button class="btn yellow" data-act="close">Fechar</button></div>`
    );
  }

  const cr = ico('crown', 's');
  const ex1 = buildMiniExample([
    ['#b8a4e3', 'crown', 0, 1, 1, 0],
    ['#f9c793', 'x', 0, 0, 1, 1],
    ['#f9c793', 'x', 0, 0, 0, 0],
    ['#f9c793', 'x', 0, 0, 1, 0],
    ['#9dc3f2', 'x', 1, 1, 0, 0],
    ['#b8e0a8', '', 1, 1, 0, 1],
    ['#f9c793', '', 0, 1, 1, 1],
    ['#9dc3f2', '', 1, 0, 0, 1],
    ['#9dc3f2', 'x', 0, 1, 0, 0],
    ['#b8e0a8', '', 0, 1, 1, 1],
    ['#9dc3f2', '', 1, 0, 0, 1],
    ['#9dc3f2', '', 0, 0, 0, 0],
    ['#9dc3f2', 'x', 0, 0, 0, 0],
    ['#9dc3f2', '', 1, 0, 0, 0],
    ['#9dc3f2', '', 0, 0, 0, 0],
    ['#9dc3f2', '', 0, 0, 0, 0],
  ]);

  const ex2 = buildMiniExample([
    ['#9dc3f2', '', 0, 0, 0, 0],
    ['#9dc3f2', 'x', 0, 0, 0, 0],
    ['#b8e0a8', 'x', 0, 1, 0, 1],
    ['#f9c793', 'x', 0, 0, 0, 1],
    ['#9dc3f2', '', 0, 1, 0, 0],
    ['#b8e0a8', 'x', 0, 0, 0, 1],
    ['#b8e0a8', 'crown', 0, 1, 1, 0],
    ['#f9c793', 'x', 0, 0, 0, 1],
    ['#9dc3f2', '', 0, 1, 0, 0],
    ['#b8e0a8', 'x', 0, 1, 1, 1],
    ['#f9c793', 'x', 1, 0, 0, 1],
    ['#f9c793', 'x', 0, 0, 1, 0],
    ['#9dc3f2', '', 0, 0, 0, 0],
    ['#9dc3f2', '', 1, 0, 0, 0],
    ['#f9c793', '', 0, 1, 0, 1],
    ['#b8a4e3', '', 1, 0, 0, 1],
  ]);

  return modal(
    'rules',
    `${tabs}
     <h2>Como joga</h2>
     <div class="rules-guide">
       <div class="rules-goal">
         ${ico('crown', 'l')}
         <div>
           <b>Objetivo: exatamente 1 Coroa por linha, coluna e cor!</b>
           <span>Posicione uma ${cr} em cada <b>linha</b>, <b>coluna</b> e <b>região de cor</b> sem que duas coroas se encostem.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. As 3 regras de ouro</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('crown', 'l')}
           <b>1 por fila e região</b>
           <small>Cada linha, cada coluna e cada região colorida deve ter <b>exatamente uma</b> ${cr}.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('nope', 'l')}
           <b>Sem toque algum</b>
           <small>Duas ${cr} <b>não podem se tocar</b>, nem mesmo na diagonal (as 8 casas vizinhas ficam bloqueadas).</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('bulb', 'l')}
           <b>Use o × para anotar</b>
           <small>Toque 1x para marcar <b>×</b> onde a ${cr} não pode ir e 2x para colocar a ${cr} (ou arraste para marcar vários <b>×</b>).</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Exemplos na prática</h3>
       <div class="cr-examples">
         <div class="cr-ex-card">
           ${ex1}
           <small>Uma ${cr} bloqueia toda a sua <b>linha</b>, <b>coluna</b> e <b>região de cor</b>.</small>
         </div>
         <div class="cr-ex-card">
           ${ex2}
           <small>Duas ${cr} não podem se tocar <b>nem na diagonal</b> (8 vizinhos bloqueados).</small>
         </div>
       </div>

       <h3 class="rules-sec">3. Dica lógica e erros</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('check', 'l')}
           <div>
             <b>Alternância sem susto</b>
             <span>Você pode clicar rápido para trocar entre <b>×</b> e ${cr}: o jogo aguarda você parar antes de validar erros.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Dica explicada</b>
             <span>Travou? O botão <b>Dica</b> destaca e explica a lógica da próxima ${cr} sem precisar adivinhar.</span>
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
  const el = $('#cr-timer');
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

  const { regions, size } = state.puzzle;
  const v = validateBoard(state.grid, regions, size);
  const hasNewErr = [...v.badCells].some((c) => !state.shownBadCells.has(c));

  state.shownBadCells = v.badCells;
  state.shownReason = v.reason;

  if (hasNewErr) {
    state.errors++;
    sfx.err();
    shake($('.cr-stage'), 0.45);
  }

  render();
}

const puzzlePool = createPuzzlePool('coroas', generatePuzzle, LEVELS);

function startNewGame(level = state.level) {
  clearPendingErrorCheck();
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();

  state.puzzle = puzzlePool.take(state.level);
  state.grid = new Array(state.puzzle.size * state.puzzle.size).fill(EMPTY);
  state.history = [];
  state.hint = null;
  state.lastPop = -1;
  state.won = false;
  state.seconds = 0;
  state.errors = 0;
  state.shownBadCells = new Set();
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

function setCell(idx, val, recordHistory = true) {
  if (!state.puzzle || state.won) return;
  const prev = state.grid[idx];
  if (prev === val) return;

  clearPendingErrorCheck();
  if (recordHistory) {
    state.history.push([{ idx, prev, next: val }]);
  }
  state.grid[idx] = val;
  state.hint = null;
  state.lastPop = val === QUEEN ? idx : -1;

  const { regions, size } = state.puzzle;
  const v = validateBoard(state.grid, regions, size);

  if (state.shownBadCells.size > 0) {
    state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
    state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;
  }

  if (v.isSolved) {
    state.won = true;
    state.shownBadCells.clear();
    state.shownReason = null;
    clearInterval(state.timerId);
    sfx.win();
    confetti(95);
    const stageRect = $('#cr-grid')?.getBoundingClientRect();
    if (stageRect) {
      burst({ x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 }, '#f7b733', 16);
    }
    const errTxt = state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
    toast(`Tabuleiro ${LEVEL_INFO[state.level].name} fechado em ${fmtTime(state.seconds)} (${errTxt})!`, 'big');
  } else {
    if (val === QUEEN) sfx.pop();
    else sfx.click();

    if (v.badCells.size > 0) {
      state.errorTimer = setTimeout(commitErrors, ERROR_DELAY_MS);
    }
  }

  render();
}

function onCellClick(idx, reverse = false) {
  if (!state.puzzle || state.won) return;
  if (state.hint && state.hint.cell === idx && state.grid[idx] !== state.hint.val) {
    setCell(idx, state.hint.val);
    return;
  }
  const cur = state.grid[idx];
  let next;
  if (!reverse) {
    // 1x -> X, 2x -> Coroa, 3x -> vazio
    next = cur === EMPTY ? CROSS : cur === CROSS ? QUEEN : EMPTY;
  } else {
    // Botão direito: 1x -> Coroa, 2x -> X, 3x -> vazio
    next = cur === EMPTY ? QUEEN : cur === QUEEN ? CROSS : EMPTY;
  }
  setCell(idx, next);
}

function doUndo() {
  if (!state.history.length || state.won) return;
  clearPendingErrorCheck();
  const batch = state.history.pop();
  for (let i = batch.length - 1; i >= 0; i--) {
    state.grid[batch[i].idx] = batch[i].prev;
  }
  state.hint = null;
  state.lastPop = -1;

  const { regions, size } = state.puzzle;
  const v = validateBoard(state.grid, regions, size);
  state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
  state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;

  sfx.click();
  render();
}

function doClear() {
  if (!state.puzzle || state.won) return;
  const hasMoves = state.grid.some((v) => v !== EMPTY);
  if (!hasMoves) return;
  clearPendingErrorCheck();
  state.grid.fill(EMPTY);
  state.history = [];
  state.hint = null;
  state.lastPop = -1;
  state.shownBadCells.clear();
  state.shownReason = null;
  sfx.click();
  render();
}

function doHint() {
  if (!state.puzzle || state.won) return;
  clearPendingErrorCheck();

  const { regions, size, solution } = state.puzzle;

  if (state.hint && state.grid[state.hint.cell] !== state.hint.val) {
    setCell(state.hint.cell, state.hint.val);
    return;
  }

  // 1. Verifica se o jogador colocou uma Coroa numa casa onde não há Coroa na solução
  for (let i = 0; i < size * size; i++) {
    if (state.grid[i] === QUEEN && solution[i] !== 1) {
      state.hint = {
        cell: i,
        val: CROSS,
        cells: [i],
        reason: 'Esta coroa está numa posição incorreta. Toque nela (ou em Dica de novo) para trocar por <b>×</b>.',
      };
      sfx.pop();
      render();
      return;
    }
  }

  // 2. Verifica se o jogador bloqueou com X uma casa que precisa ter Coroa
  for (let i = 0; i < size * size; i++) {
    if (state.grid[i] === CROSS && solution[i] === 1) {
      state.hint = {
        cell: i,
        val: QUEEN,
        cells: [i],
        reason: 'Esta casa foi marcada com <b>×</b>, mas é aqui que entra a <b>Coroa</b> desta região!',
      };
      sfx.pop();
      render();
      return;
    }
  }

  // 3. Busca a próxima dedução lógica a partir do estado atual
  const move = findNextDeduction(state.grid, regions, size, 4);
  if (move) {
    state.hint = {
      cell: move.cell,
      val: QUEEN,
      cells: move.cells || [move.cell],
      reason: `<b>Dica:</b> ${move.reason} <small>(Toque na casa destacada)</small>`,
    };
    sfx.pop();
    render();
    return;
  }

  // 4. Fallback seguro pela solução única
  const nextQ = solution.findIndex((isQ, idx) => isQ === 1 && state.grid[idx] !== QUEEN);
  if (nextQ >= 0) {
    const regName = REGION_COLORS[regions[nextQ]]?.name || `#${regions[nextQ] + 1}`;
    state.hint = {
      cell: nextQ,
      val: QUEEN,
      cells: [nextQ],
      reason: `<b>Dica:</b> A coroa da região <b>${regName}</b> fica nesta casa.`,
    };
    sfx.pop();
    render();
  }
}

const domCache = {
  puzzle: null,
  cells: [],
  prevCls: [],
  prevInner: [],
  lastLevel: null,
  lastProgress: '',
  lastErrKey: '',
  lastStatusKey: '',
  rafId: 0,
};

function scheduleRender() {
  if (domCache.rafId) return;
  domCache.rafId = requestAnimationFrame(() => {
    domCache.rafId = 0;
    render();
  });
}

function ensureCoroasGrid() {
  if (domCache.puzzle === state.puzzle) return;
  domCache.puzzle = state.puzzle;
  const { regions, size } = state.puzzle;
  const total = size * size;
  const gridEl = $('#cr-grid');
  gridEl.style.setProperty('--n', String(size));
  gridEl.innerHTML = '';

  const frag = document.createDocumentFragment();
  const thick = '2.5px solid #14202b';
  domCache.cells = new Array(total);
  domCache.prevCls = new Array(total).fill('');
  domCache.prevInner = new Array(total).fill('');

  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const reg = regions[i];
    const bg = REGION_COLORS[reg]?.hex || '#e4e4de';
    const regName = REGION_COLORS[reg]?.name || `#${reg + 1}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cr-cell';
    btn.dataset.cell = String(i);
    btn.style.setProperty('--reg-bg', bg);
    if (r > 0 && regions[(r - 1) * size + c] !== reg) btn.style.setProperty('--bt', thick);
    if (r + 1 < size && regions[(r + 1) * size + c] !== reg) btn.style.setProperty('--bb', thick);
    if (c > 0 && regions[r * size + (c - 1)] !== reg) btn.style.setProperty('--bl', thick);
    if (c + 1 < size && regions[r * size + (c + 1)] !== reg) btn.style.setProperty('--br', thick);
    btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}, Região ${regName}: vazia`);
    frag.appendChild(btn);
    domCache.cells[i] = btn;
  }
  gridEl.appendChild(frag);
}

function render() {
  if (!state.puzzle) return;
  ensureCoroasGrid();
  const { regions, size } = state.puzzle;
  const total = size * size;

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  let queensPlaced = 0;
  for (let i = 0; i < total; i++) if (state.grid[i] === QUEEN) queensPlaced++;
  const progEl = $('#cr-progress');
  const progKey = `${queensPlaced}/${size}`;
  if (progEl && domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    progEl.innerHTML = `${ico('crown', 's')}<b>${queensPlaced}</b>/${size}`;
  }

  const errEl = $('#cr-errors');
  const errKey = String(state.errors);
  if (errEl && domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  const stEl = $('#cr-status');
  if (stEl) {
    let stCls = 'cr-status-bar';
    let stHtml;
    if (state.won) {
      const errTxt = state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
      stCls += ' win';
      stHtml = `${ico('crown', 's')} Perfeito! Fechado no nível ${LEVEL_INFO[state.level].name} (${size}×${size}) em ${fmtTime(state.seconds)} (${errTxt})!`;
    } else if (state.shownBadCells.size > 0 && state.shownReason) {
      stCls += ' err';
      stHtml = `${ico('nope', 's')} <span>${state.shownReason}</span>`;
    } else if (state.hint) {
      stCls += ' hint';
      stHtml = `${ico('bulb', 's')} <span>${state.hint.reason}</span>`;
    } else {
      stHtml = `Toque numa casa: 1x <b>×</b> · 2x ${ico('crown', 's')} <b>Coroa</b> · 3x limpa (arraste p/ vários <b>×</b>).`;
    }
    const stKey = `${stCls}|${stHtml}`;
    if (domCache.lastStatusKey !== stKey) {
      domCache.lastStatusKey = stKey;
      stEl.className = stCls;
      stEl.innerHTML = stHtml;
    }
  }

  const hintCtx = state.hint?.cells ? new Set(state.hint.cells) : null;

  for (let i = 0; i < total; i++) {
    const val = state.grid[i];
    const isBad = state.shownBadCells.has(i);
    const isTarget = state.hint?.cell === i;
    const isCtx = !isTarget && hintCtx && hintCtx.has(i);

    let cls = 'cr-cell';
    if (isBad) cls += ' bad';
    if (isTarget) cls += ' hint-target';
    if (isCtx) cls += ' hint-ctx';

    const btn = domCache.cells[i];
    if (domCache.prevCls[i] !== cls) {
      domCache.prevCls[i] = cls;
      btn.className = cls;
    }

    let innerKey = '';
    if (val === QUEEN) innerKey = state.lastPop === i ? 'qp' : 'q';
    else if (isTarget && state.hint && state.hint.val === QUEEN) innerKey = 'qh';
    else if (val === CROSS) innerKey = 'x';

    if (domCache.prevInner[i] !== innerKey) {
      domCache.prevInner[i] = innerKey;
      const r = Math.floor(i / size);
      const c = i % size;
      const regName = REGION_COLORS[regions[i]]?.name || `#${regions[i] + 1}`;
      const labelVal = val === QUEEN ? 'Coroa' : val === CROSS ? 'X' : 'vazia';
      btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}, Região ${regName}: ${labelVal}`);
      if (innerKey === 'qp' || innerKey === 'q') {
        btn.innerHTML = `<span class="cr-piece${innerKey === 'qp' ? ' pop' : ''}">${ico('crown')}</span>`;
      } else if (innerKey === 'qh') {
        btn.innerHTML = `<span class="cr-piece ghost-hint">${ico('crown')}</span>`;
      } else if (innerKey === 'x') {
        btn.innerHTML = '<span class="cr-cross">×</span>';
      } else {
        btn.textContent = '';
      }
    }
  }

  state.lastPop = -1;

  const hasMoves = state.grid.some((v) => v !== EMPTY);
  $('#btn-undo').disabled = state.won || state.history.length === 0;
  $('#btn-clear').disabled = state.won || !hasMoves;
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

// Suporte a arrastar (pointerdown + pointermove) para marcar vários X de uma vez
const gridEl = $('#cr-grid');
let suppressNextClick = false;
let dragRect = null;

function cellFromPointer(e) {
  if (!dragRect || !state.puzzle) return -1;
  const { left, top, width, height } = dragRect;
  const x = e.clientX - left;
  const y = e.clientY - top;
  if (x < 0 || x >= width || y < 0 || y >= height) return -1;
  const size = state.puzzle.size;
  const c = Math.min(size - 1, Math.max(0, Math.floor((x / width) * size)));
  const r = Math.min(size - 1, Math.max(0, Math.floor((y / height) * size)));
  return r * size + c;
}

gridEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.won || !state.puzzle) return;
  const cellBtn = e.target.closest('[data-cell]');
  if (!cellBtn) return;
  const idx = Number(cellBtn.dataset.cell);
  const cur = state.grid[idx];
  // Só inicia arrasto de X se a casa inicial estiver vazia ou com X
  if (cur === QUEEN) return;
  dragRect = gridEl.getBoundingClientRect();
  state.drag = {
    startIdx: idx,
    targetVal: cur === EMPTY ? CROSS : EMPTY,
    moved: false,
    batch: [],
  };
});

gridEl.addEventListener('pointermove', (e) => {
  if (!state.drag || state.won) return;
  const idx = cellFromPointer(e);
  if (idx < 0) return;
  if (idx === state.drag.startIdx && !state.drag.moved) return;

  if (!state.drag.moved) {
    state.drag.moved = true;
    const firstIdx = state.drag.startIdx;
    const prevFirst = state.grid[firstIdx];
    if (prevFirst !== state.drag.targetVal && prevFirst !== QUEEN) {
      state.grid[firstIdx] = state.drag.targetVal;
      state.drag.batch.push({ idx: firstIdx, prev: prevFirst, next: state.drag.targetVal });
    }
  }

  const prev = state.grid[idx];
  if (prev !== QUEEN && prev !== state.drag.targetVal) {
    state.grid[idx] = state.drag.targetVal;
    state.drag.batch.push({ idx, prev, next: state.drag.targetVal });
    sfx.click();
    scheduleRender();
  }
});

window.addEventListener('pointerup', () => {
  dragRect = null;
  if (!state.drag) return;
  if (state.drag.moved && state.drag.batch.length > 0) {
    state.history.push(state.drag.batch);
    suppressNextClick = true;
    render();
  }
  state.drag = null;
});

document.addEventListener('click', (e) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
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

gridEl.addEventListener('contextmenu', (e) => {
  const cellBtn = e.target.closest('[data-cell]');
  if (!cellBtn || cellBtn.disabled) return;
  e.preventDefault();
  onCellClick(Number(cellBtn.dataset.cell), true);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.modal) {
    state.modal = null;
    renderModal();
  }
});

startNewGame(state.level);
