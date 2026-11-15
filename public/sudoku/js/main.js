import { createPuzzlePool } from '../../js/puzzle-pool.js';
import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  SIZE,
  TOTAL,
  LEVELS,
  LEVEL_INFO,
  boxOf,
  peersOf,
  generatePuzzle,
  validateBoard,
  findNextDeduction,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_sudoku_v1';
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
  notes: [],
  selected: null,
  notesMode: false,
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — clássicos de lógica e tabuleiro feitos do zero no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('dice', 's')}Sudoku na Quermesse</span>
             <p>Todo novo jogo gera uma grade 9×9 inédita e verifica com um solver lógico humano que nenhuma casa exige chute — do nível Fácil ao Mestre.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro, sem bibliotecas externas.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Notas e Dica lógica</b><span>Use o modo Notas para rascunhar candidatos e o botão Dica para aprender o próximo passo.</span></div></div>
         </div>
       </div>
       <div class="row"><button class="btn yellow" data-act="close">Fechar</button></div>`
    );
  }

  return modal(
    'rules',
    `${tabs}
     <h2>Como joga</h2>
     <div class="rules-guide">
       <div class="rules-goal">
         ${ico('dice', 'l')}
         <div>
           <b>Objetivo: completar a grade 9×9 com os números de 1 a 9!</b>
           <span>Cada linha, cada coluna e cada bloco 3×3 (delimitado por bordas grossas) deve conter todos os números de <b>1 a 9</b> sem repetição.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. As 3 regras de ouro</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('check', 'l')}
           <b>1 a 9 por Linha</b>
           <small>Nenhuma linha horizontal pode ter dois números iguais.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('check', 'l')}
           <b>1 a 9 por Coluna</b>
           <small>Nenhuma coluna vertical pode repetir o mesmo número.</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('dice', 'l')}
           <b>1 a 9 por Bloco 3×3</b>
           <small>Cada um dos 9 quadrados 3×3 precisa ter exatamente os números de 1 a 9.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Controles, Notas e Dicas</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('hand', 'l')}
           <div>
             <b>Modo Notas (Rascunho)</b>
             <span>Ative o botão <b>Notas</b> (ou segure Shift no teclado) para anotar números pequenos de rascunho dentro da célula.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Dica explicada e Erros</b>
             <span>O jogo espera você parar de digitar antes de apontar conflitos, e o botão <b>Dica</b> explica a lógica da próxima casa.</span>
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
  const el = $('#sk-timer');
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

  const v = validateBoard(state.grid);
  const hasNewErr = [...v.badCells].some((c) => !state.shownBadCells.has(c));

  state.shownBadCells = v.badCells;
  state.shownReason = v.reason;

  if (hasNewErr) {
    state.errors++;
    sfx.err();
    shake($('#sk-stage'), 0.45);
  }

  render();
}

const puzzlePool = createPuzzlePool('sudoku', generatePuzzle, LEVELS);

function startNewGame(level = state.level) {
  clearPendingErrorCheck();
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();

  state.puzzle = puzzlePool.take(state.level);
  state.grid = [...state.puzzle.givens];
  state.notes = Array.from({ length: TOTAL }, () => 0);
  state.selected = state.grid.findIndex((v) => v === 0);
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

function inputNumber(num, forceNotes = false) {
  if (!state.puzzle || state.won || state.selected === null) return;
  const idx = state.selected;
  if (state.puzzle.givens[idx] !== 0) return;

  clearPendingErrorCheck();

  const useNotes = (state.notesMode || forceNotes) && num >= 1 && num <= 9;
  if (useNotes) {
    state.history.push({
      idx,
      prevVal: state.grid[idx],
      prevNotes: [...state.notes],
    });
    if (state.grid[idx] !== 0) state.grid[idx] = 0;
    state.notes[idx] ^= 1 << num;
    state.hint = null;
    sfx.click();
    render();
    return;
  }

  const nextVal = state.grid[idx] === num ? 0 : num;
  if (state.grid[idx] === nextVal && state.notes[idx] === 0) return;

  state.history.push({
    idx,
    prevVal: state.grid[idx],
    prevNotes: [...state.notes],
  });

  state.grid[idx] = nextVal;
  state.notes[idx] = 0;
  state.hint = null;
  state.lastPop = nextVal > 0 ? idx : -1;

  // Limpa automaticamente esse número das notas da mesma linha, coluna e bloco 3x3
  if (nextVal > 0) {
    const bit = 1 << nextVal;
    for (const p of peersOf(idx)) {
      state.notes[p] &= ~bit;
    }
  }

  const v = validateBoard(state.grid);

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
    const stageRect = $('#sk-stage')?.getBoundingClientRect();
    if (stageRect) {
      burst(
        { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 },
        '#f7b733',
        18
      );
    }
    const errTxt =
      state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
    toast(
      `Sudoku ${LEVEL_INFO[state.level].name} fechado em ${fmtTime(state.seconds)} (${errTxt})!`,
      'big'
    );
  } else {
    if (nextVal > 0) sfx.pop();
    else sfx.click();

    if (v.badCells.size > 0) {
      state.errorTimer = setTimeout(commitErrors, ERROR_DELAY_MS);
    }
  }

  render();
}

function doUndo() {
  if (!state.history.length || state.won) return;
  clearPendingErrorCheck();
  const last = state.history.pop();
  state.grid[last.idx] = last.prevVal;
  state.notes = last.prevNotes;
  state.selected = last.idx;
  state.hint = null;
  state.lastPop = -1;

  const v = validateBoard(state.grid);
  state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
  state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;

  sfx.click();
  render();
}

function doHint() {
  if (!state.puzzle || state.won) return;
  clearPendingErrorCheck();

  if (state.hint && state.grid[state.hint.cell] !== state.hint.val) {
    state.selected = state.hint.cell;
    inputNumber(state.hint.val, false);
    return;
  }

  // 1. Verifica se o jogador colocou algum número diferente da solução única
  for (let i = 0; i < TOTAL; i++) {
    if (state.puzzle.givens[i] === 0 && state.grid[i] !== 0 && state.grid[i] !== state.puzzle.solution[i]) {
      const correctVal = state.puzzle.solution[i];
      state.selected = i;
      state.hint = {
        cell: i,
        val: correctVal,
        cells: [i],
        reason: `Esta casa está com o número incorreto. O valor correto aqui é <b>${correctVal}</b> (toque em Dica de novo para corrigir).`,
      };
      sfx.pop();
      render();
      return;
    }
  }

  // 2. Busca o próximo passo lógico
  const move = findNextDeduction(state.grid, 3);
  if (move) {
    state.selected = move.cell;
    state.hint = {
      cell: move.cell,
      val: move.val,
      cells: move.cells || [move.cell],
      reason: `<b>Dica:</b> ${move.reason} <small>(Toque em Dica de novo para preencher)</small>`,
    };
    sfx.pop();
    render();
    return;
  }

  // 3. Fallback pela solução única
  const emptyIdx = state.grid.findIndex((v) => v === 0);
  if (emptyIdx >= 0) {
    const val = state.puzzle.solution[emptyIdx];
    state.selected = emptyIdx;
    state.hint = {
      cell: emptyIdx,
      val,
      cells: [emptyIdx],
      reason: `<b>Dica:</b> Esta casa leva o número <b>${val}</b>.`,
    };
    sfx.pop();
    render();
  }
}

const domCache = {
  built: false,
  cells: [],
  prevCls: new Array(TOTAL).fill(''),
  prevInner: new Array(TOTAL).fill(''),
  numBtns: new Array(10).fill(null),
  numSmalls: new Array(10).fill(null),
  lastLevel: null,
  lastProgress: '',
  lastErrKey: '',
  lastStatusKey: '',
};

function ensureSudokuDOM() {
  if (domCache.built) return;
  domCache.built = true;

  const gridEl = $('#sk-grid');
  gridEl.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sk-cell';
    btn.dataset.cell = String(i);
    btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: vazia`);
    gridEl.appendChild(btn);
    domCache.cells.push(btn);
  }

  const padEl = $('#sk-numpad');
  padEl.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sk-num-btn';
    btn.dataset.act = 'num';
    btn.dataset.num = String(n);
    const b = document.createElement('b');
    b.textContent = String(n);
    const small = document.createElement('small');
    small.textContent = '9';
    btn.append(b, small);
    padEl.appendChild(btn);
    domCache.numBtns[n] = btn;
    domCache.numSmalls[n] = small;
  }
}

function render() {
  if (!state.puzzle) return;
  ensureSudokuDOM();
  const { givens } = state.puzzle;

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  let filled = 0;
  const counts = new Int8Array(10);
  for (let i = 0; i < TOTAL; i++) {
    const val = state.grid[i];
    if (val > 0) {
      filled++;
      if (val <= 9) counts[val]++;
    }
  }

  const progEl = $('#sk-progress');
  const progKey = String(filled);
  if (progEl && domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    progEl.innerHTML = `${ico('dice', 's')}<b>${filled}</b>/${TOTAL}`;
  }

  const errEl = $('#sk-errors');
  const errKey = String(state.errors);
  if (errEl && domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  const stEl = $('#sk-status');
  if (stEl) {
    let stCls = 'sk-status-bar';
    let stHtml;
    if (state.won) {
      const errTxt =
        state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
      stCls += ' win';
      stHtml = `${ico('crown', 's')} Perfeito! Fechado no nível ${LEVEL_INFO[state.level].name} em ${fmtTime(state.seconds)} (${errTxt})!`;
    } else if (state.shownBadCells.size > 0 && state.shownReason) {
      stCls += ' err';
      stHtml = `${ico('nope', 's')} <span>${state.shownReason}</span>`;
    } else if (state.hint) {
      stCls += ' hint';
      stHtml = `${ico('bulb', 's')} <span>${state.hint.reason}</span>`;
    } else {
      stHtml = state.notesMode
        ? `Modo <b>Notas ativo</b>: escolha números para anotar rascunhos na célula.`
        : `Selecione uma casa e escolha um número de <b>1 a 9</b>.`;
    }
    const stKey = `${stCls}|${stHtml}`;
    if (domCache.lastStatusKey !== stKey) {
      domCache.lastStatusKey = stKey;
      stEl.className = stCls;
      stEl.innerHTML = stHtml;
    }
  }

  const sel = state.selected;
  const selPeers = sel !== null ? new Set(peersOf(sel)) : null;
  const selVal = sel !== null ? state.grid[sel] : 0;
  const hintCtx = state.hint?.cells ? new Set(state.hint.cells) : null;

  for (let i = 0; i < TOTAL; i++) {
    const r = Math.floor(i / 9);
    const c = i % 9;
    const isGiven = givens[i] !== 0;
    const val = state.grid[i];

    const isSelected = i === sel;
    const isPeer = !isSelected && selPeers && selPeers.has(i);
    const isSameNum = !isSelected && selVal > 0 && val === selVal;
    const isBad = state.shownBadCells.has(i);
    const isTarget = state.hint?.cell === i;
    const isCtx = !isTarget && hintCtx && hintCtx.has(i);

    let cls = 'sk-cell';
    if (c === 2 || c === 5) cls += ' b-right';
    if (r === 2 || r === 5) cls += ' b-bottom';
    if (isGiven) cls += ' given';
    if (isPeer) cls += ' peer';
    if (isSameNum) cls += ' same-num';
    if (isSelected) cls += ' selected';
    if (isBad) cls += ' bad';
    if (isTarget) cls += ' hint-target';
    if (isCtx) cls += ' hint-ctx';

    const btn = domCache.cells[i];
    if (domCache.prevCls[i] !== cls) {
      domCache.prevCls[i] = cls;
      btn.className = cls;
    }

    let innerKey = '';
    if (val > 0) {
      const pop = state.lastPop === i ? 1 : 0;
      innerKey = `v:${val}:${pop}`;
      if (domCache.prevInner[i] !== innerKey) {
        domCache.prevInner[i] = innerKey;
        btn.innerHTML = `<span class="sk-val${pop ? ' pop' : ''}">${val}</span>`;
        btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: ${val}`);
      }
    } else if (isTarget && state.hint) {
      innerKey = `h:${state.hint.val}`;
      if (domCache.prevInner[i] !== innerKey) {
        domCache.prevInner[i] = innerKey;
        btn.innerHTML = `<span class="sk-val ghost-hint">${state.hint.val}</span>`;
        btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: vazia`);
      }
    } else if (state.notes[i]) {
      const mask = state.notes[i];
      innerKey = `n:${mask}`;
      if (domCache.prevInner[i] !== innerKey) {
        domCache.prevInner[i] = innerKey;
        let notesHtml = '';
        for (let n = 1; n <= 9; n++) {
          notesHtml += `<i>${mask & (1 << n) ? n : ''}</i>`;
        }
        btn.innerHTML = `<span class="sk-notes">${notesHtml}</span>`;
        btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: vazia`);
      }
    } else if (domCache.prevInner[i] !== '') {
      domCache.prevInner[i] = '';
      btn.textContent = '';
      btn.setAttribute('aria-label', `Linha ${r + 1}, Coluna ${c + 1}: vazia`);
    }
  }
  state.lastPop = -1;

  // Atualiza o teclado numérico (1..9) sem recriar botões
  for (let n = 1; n <= 9; n++) {
    const rem = Math.max(0, 9 - counts[n]);
    const btn = domCache.numBtns[n];
    btn.classList.toggle('done', rem === 0);
    btn.disabled = state.won;
    domCache.numSmalls[n].textContent = String(rem);
  }

  const notesBtn = $('#btn-notes');
  if (notesBtn) {
    notesBtn.classList.toggle('notes-on', state.notesMode);
    notesBtn.innerHTML = `Notas: ${state.notesMode ? 'ON' : 'OFF'}`;
  }

  const canErase =
    !state.won &&
    sel !== null &&
    givens[sel] === 0 &&
    (state.grid[sel] !== 0 || state.notes[sel] !== 0);
  $('#btn-undo').disabled = state.won || state.history.length === 0;
  $('#btn-erase').disabled = !canErase;
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
    const idx = Number(cellBtn.dataset.cell);
    if (state.hint && state.hint.cell === idx && state.grid[idx] !== state.hint.val) {
      state.selected = idx;
      inputNumber(state.hint.val, false);
      return;
    }
    state.selected = idx;
    sfx.click();
    render();
    return;
  }
  const actBtn = e.target.closest('[data-act]');
  if (!actBtn || actBtn.disabled) return;
  const act = actBtn.dataset.act;
  if (act === 'num') {
    inputNumber(Number(actBtn.dataset.num), false);
  } else if (act === 'erase') {
    inputNumber(0, false);
  } else if (act === 'notes') {
    state.notesMode = !state.notesMode;
    sfx.click();
    render();
  } else if (act === 'level') {
    sfx.click();
    startNewGame(actBtn.dataset.level);
  } else if (act === 'new-game') {
    sfx.click();
    startNewGame(state.level);
  } else if (act === 'undo') {
    doUndo();
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
    return;
  }
  if (state.modal || state.won || !state.puzzle) return;

  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    inputNumber(Number(e.key), e.shiftKey);
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    e.preventDefault();
    inputNumber(0, false);
    return;
  }
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    state.notesMode = !state.notesMode;
    sfx.click();
    render();
    return;
  }

  const sel = state.selected ?? 0;
  const r = Math.floor(sel / 9);
  const c = sel % 9;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    state.selected = ((r + 8) % 9) * 9 + c;
    render();
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    e.preventDefault();
    state.selected = ((r + 1) % 9) * 9 + c;
    render();
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    state.selected = r * 9 + ((c + 8) % 9);
    render();
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    state.selected = r * 9 + ((c + 1) % 9);
    render();
  }
});

startNewGame(state.level);
