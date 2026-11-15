import { createPuzzlePool } from '../../js/puzzle-pool.js';
import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  LEVELS,
  LEVEL_INFO,
  SHAPE_NAMES,
  rectArea,
  rectsOverlap,
  cellInRect,
  sameRect,
  generatePuzzle,
  validateBoard,
  findNextDeduction,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_retalhos_v1';
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
  rects: [],
  selectedClue: null,
  history: [],
  hint: null,
  won: false,
  seconds: 0,
  timerId: null,
  errors: 0,
  errorTimer: null,
  shownBadClues: new Set(),
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — trazendo desafios de lógica, caminho e estratégia feitos do zero para o navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('star', 's')}Por que Retalhos?</span>
             <p>Um quebra-cabeça geométrico em que cada pista revela o formato (quadrado, retângulo em pé, deitado ou livre) e/ou a área da sua peça. Todo tabuleiro é validado para fechar 100% na dedução.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro com gerador de partições e solver dedutivo próprios.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Dica com "Mostre-me"</b><span>A dica primeiro destaca qual pista só tem uma posição possível e, se quiser, preenche para você.</span></div></div>
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
         ${ico('star', 'l')}
         <div>
           <b>Objetivo: completar cada forma para cobrir 100% da grade!</b>
           <span>Expanda cada pista em um quadrado ou retângulo sem sobrepor outros retalhos até preencher todas as casas do tabuleiro.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. Os 4 formatos de pista</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           <i class="glyph-sq"></i>
           <b>Quadrado</b>
           <small>A região final deve ter largura e altura exatamente iguais (2×2, 3×3…).</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           <i class="glyph-hz"></i>
           <b>Horizontal ou Vertical</b>
           <small>Selo deitado pede largura maior que altura; selo em pé pede altura maior que largura.</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           <i class="glyph-any"></i>
           <b>Qualquer formato + Número</b>
           <small>Selo tracejado aceita qualquer retângulo ou quadrado. Se houver número, ele indica a quantidade exata de casas.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Como desenhar e usar dicas</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('hand', 'l')}
           <div>
             <b>Arraste ou toque nos cantos</b>
             <span>Arraste a partir de uma pista até o canto desejado (ou toque na pista para selecioná-la e depois toque na casa final). Toque numa pista já pronta para limpá-la.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Dica com "Mostre-me" e Erros</b>
             <span>O jogo espera você parar de mexer antes de apontar erros. O botão <b>Dica</b> demarca a pista que só tem 1 posição válida e oferece o botão <b>Mostre-me</b>.</span>
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
  const el = $('#rt-timer');
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

  const v = validateBoard(state.rects, state.puzzle);
  const hasNewErr = [...v.badClues].some((c) => !state.shownBadClues.has(c));

  state.shownBadClues = v.badClues;
  state.shownReason = v.reason;

  if (hasNewErr) {
    state.errors++;
    sfx.err();
    shake($('#rt-stage'), 0.45);
  }

  render();
}

const stageEl = $('#rt-stage');
const gridEl = $('#rt-grid');
let suppressNextClick = false;
let dragRect = null;
let dragRafId = 0;

function resetDragState() {
  if (dragRafId) {
    cancelAnimationFrame(dragRafId);
    dragRafId = 0;
  }
  dragRect = null;
  state.drag = null;
  stageEl?.classList.remove('dragging');
}

const puzzlePool = createPuzzlePool('retalhos', generatePuzzle, LEVELS);

function startNewGame(level = state.level) {
  clearPendingErrorCheck();
  resetDragState();
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();

  state.puzzle = puzzlePool.take(state.level);
  state.rects = new Array(state.puzzle.clues.length).fill(null);
  state.selectedClue = null;
  state.history = [];
  state.hint = null;
  state.won = false;
  state.seconds = 0;
  state.errors = 0;
  state.shownBadClues = new Set();
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

function findClueAtCell(r, c) {
  if (!state.puzzle) return -1;
  return state.puzzle.clues.findIndex((cl) => cl.r === r && cl.c === c);
}

function findRectOwnerAtCell(r, c) {
  if (!state.puzzle) return -1;
  for (let i = 0; i < state.rects.length; i++) {
    const rect = state.rects[i];
    if (rect && cellInRect(r, c, rect)) return i;
  }
  return -1;
}

/**
 * Aplica um novo retângulo `rect` (ou `null` para limpar) na pista `clueIdx`,
 * limpando automaticamente qualquer outro retângulo que fique sobreposto.
 */
function setClueRect(clueIdx, rect, recordHistory = true) {
  if (!state.puzzle || state.won || clueIdx < 0) return;

  // Se o retângulo tem área 1 (apenas a própria célula da pista), trata como limpo (null)
  const normalized = rect && rectArea(rect) >= 2 ? rect : null;
  const prev = state.rects[clueIdx];
  if (sameRect(prev, normalized) && prev === normalized) return;

  // Não permite soltar um retângulo que cubra a célula-semente de OUTRA pista
  if (normalized) {
    for (let j = 0; j < state.puzzle.clues.length; j++) {
      if (j === clueIdx) continue;
      if (cellInRect(state.puzzle.clues[j].r, state.puzzle.clues[j].c, normalized)) {
        sfx.err();
        toast('Um retalho não pode cobrir outra pista!', 'err');
        return;
      }
    }
  }

  clearPendingErrorCheck();
  if (recordHistory) {
    state.history.push(state.rects.map((r) => (r ? { ...r } : null)));
  }

  state.rects[clueIdx] = normalized;
  if (normalized) {
    for (let j = 0; j < state.rects.length; j++) {
      if (j !== clueIdx && state.rects[j] && rectsOverlap(normalized, state.rects[j])) {
        state.rects[j] = null;
      }
    }
  }
  state.hint = null;

  const v = validateBoard(state.rects, state.puzzle);

  if (state.shownBadClues.size > 0) {
    state.shownBadClues = new Set([...state.shownBadClues].filter((c) => v.badClues.has(c)));
    state.shownReason = state.shownBadClues.size > 0 ? v.reason : null;
  }

  if (v.isSolved) {
    state.won = true;
    state.selectedClue = null;
    state.shownBadClues.clear();
    state.shownReason = null;
    clearInterval(state.timerId);
    sfx.win();
    confetti(95);
    const stageRect = $('#rt-stage')?.getBoundingClientRect();
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
      `Tapete ${LEVEL_INFO[state.level].name} completo em ${fmtTime(state.seconds)} (${errTxt})!`,
      'big'
    );
  } else {
    if (normalized) sfx.pop();
    else sfx.click();

    if (v.badClues.size > 0) {
      state.errorTimer = setTimeout(commitErrors, ERROR_DELAY_MS);
    }
  }

  render(v);
}

function doUndo() {
  if (!state.history.length || state.won) return;
  clearPendingErrorCheck();
  state.rects = state.history.pop();
  state.hint = null;

  const v = validateBoard(state.rects, state.puzzle);
  state.shownBadClues = new Set([...state.shownBadClues].filter((c) => v.badClues.has(c)));
  state.shownReason = state.shownBadClues.size > 0 ? v.reason : null;

  sfx.click();
  render();
}

function doClear() {
  if (!state.puzzle || state.won) return;
  if (!state.rects.some((r) => r !== null)) return;
  clearPendingErrorCheck();
  state.history.push(state.rects.map((r) => (r ? { ...r } : null)));
  state.rects.fill(null);
  state.selectedClue = null;
  state.hint = null;
  state.shownBadClues.clear();
  state.shownReason = null;
  sfx.click();
  render();
}

function doHint(applyImmediately = false) {
  if (!state.puzzle || state.won) return;
  clearPendingErrorCheck();

  if (state.hint && (applyImmediately || state.hint.shownOnce)) {
    const { clueIdx, rect } = state.hint;
    state.selectedClue = clueIdx;
    setClueRect(clueIdx, rect, true);
    return;
  }

  // 1. Verifica se algum retângulo desenhado está incorreto em relação à solução
  for (let i = 0; i < state.rects.length; i++) {
    if (state.rects[i] && !sameRect(state.rects[i], state.puzzle.solution[i])) {
      state.selectedClue = i;
      state.hint = {
        clueIdx: i,
        rect: state.puzzle.solution[i],
        shownOnce: true,
        reason:
          'Este retalho está num formato ou posição que bloqueia outra pista. Veja o contorno branco correto!',
      };
      sfx.pop();
      render();
      return;
    }
  }

  // 2. Busca a próxima pista dedutível
  const move = findNextDeduction(state.rects, state.puzzle);
  if (move) {
    state.selectedClue = move.clueIdx;
    state.hint = {
      clueIdx: move.clueIdx,
      rect: move.rect,
      shownOnce: true,
      reason: move.reason,
    };
    sfx.pop();
    render();
  }
}

const domCache = {
  puzzle: null,
  rectEls: [],
  prevRectKey: [],
  hintRectEl: null,
  prevHintKey: '',
  clueWraps: [],
  prevClueSel: [],
  lastLevel: null,
  lastProgress: '',
  lastErrKey: '',
  lastStatusKey: '',
};

function ensureRetalhosDOM() {
  if (domCache.puzzle === state.puzzle) return;
  domCache.puzzle = state.puzzle;
  const { size, total, clues } = state.puzzle;

  const gridEl = $('#rt-grid');
  gridEl.style.setProperty('--n', String(size));
  gridEl.innerHTML = '';
  const gridFrag = document.createDocumentFragment();
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / size) + 1;
    const c = (i % size) + 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rt-cell';
    btn.dataset.cell = String(i);
    btn.setAttribute('aria-label', `Linha ${r}, Coluna ${c}`);
    gridFrag.appendChild(btn);
  }
  gridEl.appendChild(gridFrag);

  const rectsEl = $('#rt-rects');
  rectsEl.innerHTML = '';
  const rectsFrag = document.createDocumentFragment();
  domCache.rectEls = new Array(clues.length);
  domCache.prevRectKey = new Array(clues.length).fill('');
  for (let i = 0; i < clues.length; i++) {
    const div = document.createElement('div');
    div.className = 'rt-rect';
    div.style.display = 'none';
    div.style.setProperty('--r-fill', clues[i].color.fill);
    rectsFrag.appendChild(div);
    domCache.rectEls[i] = div;
  }
  const hintDiv = document.createElement('div');
  hintDiv.className = 'rt-rect hint-preview';
  hintDiv.style.display = 'none';
  rectsFrag.appendChild(hintDiv);
  domCache.hintRectEl = hintDiv;
  domCache.prevHintKey = '';
  rectsEl.appendChild(rectsFrag);

  const cluesEl = $('#rt-clues');
  const scale = size <= 5 ? 1.08 : size === 6 ? 1 : size === 7 ? 0.9 : 0.82;
  cluesEl.style.setProperty('--b-sq', `${Math.round(30 * scale)}px`);
  cluesEl.style.setProperty('--b-lg', `${Math.round(36 * scale)}px`);
  cluesEl.style.setProperty('--b-sm', `${Math.round(22 * scale)}px`);
  cluesEl.style.setProperty('--b-any', `${Math.round(34 * scale)}px`);
  cluesEl.style.setProperty('--clue-fs', `${Math.round(14 * scale)}px`);
  cluesEl.innerHTML = '';

  const cluesFrag = document.createDocumentFragment();
  domCache.clueWraps = new Array(clues.length);
  domCache.prevClueSel = new Array(clues.length).fill(false);
  clues.forEach((cl, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'rt-clue-wrap';
    wrap.style.left = `${(((cl.c + 0.5) / size) * 100).toFixed(2)}%`;
    wrap.style.top = `${(((cl.r + 0.5) / size) * 100).toFixed(2)}%`;
    const badge = document.createElement('div');
    badge.className = `rt-clue-badge sh-${cl.shape}`;
    badge.style.setProperty('--c-hex', cl.color.hex);
    badge.style.setProperty('--c-dark', cl.color.dark);
    if (cl.area !== null) {
      const sp = document.createElement('span');
      sp.textContent = String(cl.area);
      badge.appendChild(sp);
    }
    wrap.appendChild(badge);
    cluesFrag.appendChild(wrap);
    domCache.clueWraps[idx] = wrap;
  });
  cluesEl.appendChild(cluesFrag);
}

function applyRectBox(el, rect, size) {
  el.style.top = `${((rect.r1 / size) * 100).toFixed(2)}%`;
  el.style.left = `${((rect.c1 / size) * 100).toFixed(2)}%`;
  el.style.width = `${(((rect.c2 - rect.c1 + 1) / size) * 100).toFixed(2)}%`;
  el.style.height = `${(((rect.r2 - rect.r1 + 1) / size) * 100).toFixed(2)}%`;
}

function syncRectsAndCluesDOM() {
  const { size, clues } = state.puzzle;

  // Atualiza somente os nós retangulares que mudaram
  for (let i = 0; i < clues.length; i++) {
    const isDraggingThis = !!(state.drag && state.drag.activeClueIdx === i && state.drag.previewRect);
    const rect = isDraggingThis ? state.drag.previewRect : state.rects[i];
    const isBad = !isDraggingThis && state.shownBadClues.has(i);
    const key = rect ? `${rect.r1},${rect.c1},${rect.r2},${rect.c2},${isDraggingThis ? 1 : 0},${isBad ? 1 : 0}` : '';
    if (domCache.prevRectKey[i] !== key) {
      domCache.prevRectKey[i] = key;
      const el = domCache.rectEls[i];
      if (!rect) {
        el.style.display = 'none';
      } else {
        el.style.display = '';
        let cls = 'rt-rect';
        if (isDraggingThis) cls += ' active-drag';
        if (isBad) cls += ' bad';
        el.className = cls;
        applyRectBox(el, rect, size);
      }
    }
  }

  // Atualiza apenas classe selected dos selos
  for (let i = 0; i < clues.length; i++) {
    const isSel = state.selectedClue === i;
    if (domCache.prevClueSel[i] !== isSel) {
      domCache.prevClueSel[i] = isSel;
      domCache.clueWraps[i].classList.toggle('selected', isSel);
    }
  }
}

function renderDragFrame() {
  if (!state.puzzle || !state.drag) return;
  ensureRetalhosDOM();
  stageEl?.classList.toggle('dragging', !!state.drag.moved);
  syncRectsAndCluesDOM();
}

function scheduleDragRender() {
  if (dragRafId) return;
  dragRafId = requestAnimationFrame(() => {
    dragRafId = 0;
    renderDragFrame();
  });
}

function render(validation = null) {
  if (!state.puzzle) return;
  ensureRetalhosDOM();
  const { size, total, clues } = state.puzzle;

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  const v = validation || validateBoard(state.rects, state.puzzle);

  const progEl = $('#rt-progress');
  const progKey = `${v.coveredCount}/${total}`;
  if (progEl && domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    progEl.innerHTML = `${ico('star', 's')}<b>${v.coveredCount}</b>/${total}`;
  }

  const errEl = $('#rt-errors');
  const errKey = String(state.errors);
  if (errEl && domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  const stEl = $('#rt-status');
  if (stEl) {
    let stCls = 'rt-status-bar';
    let stHtml;
    if (state.won) {
      const errTxt =
        state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
      stCls += ' win';
      stHtml = `${ico('crown', 's')} Perfeito! Fechado no nível ${LEVEL_INFO[state.level].name} (${size}×${size}) em ${fmtTime(state.seconds)} (${errTxt})!`;
    } else if (state.shownBadClues.size > 0 && state.shownReason) {
      stCls += ' err';
      stHtml = `${ico('nope', 's')} <span>${state.shownReason}</span>`;
    } else if (state.hint) {
      stCls += ' hint';
      stHtml = `${ico('bulb', 's')} <span><b>Dica:</b> ${state.hint.reason}</span> <button type="button" class="btn small yellow rt-show-me" data-act="show-hint">Mostre-me</button>`;
    } else if (state.selectedClue !== null) {
      const cl = clues[state.selectedClue];
      const shLabel = SHAPE_NAMES[cl.shape];
      const areaLabel = cl.area ? ` de tamanho <b>${cl.area}</b>` : '';
      stHtml = `Pista selecionada: <b>${shLabel}</b>${areaLabel} · Toque na casa final ou arraste.`;
    } else {
      stHtml = `Arraste a partir de uma pista (ou toque nela e depois no canto) para formar o retalho.`;
    }
    const stKey = `${stCls}|${stHtml}`;
    if (domCache.lastStatusKey !== stKey) {
      domCache.lastStatusKey = stKey;
      stEl.className = stCls;
      stEl.innerHTML = stHtml;
    }
  }

  stageEl?.classList.toggle('dragging', !!(state.drag && state.drag.moved));
  syncRectsAndCluesDOM();

  const hRect = state.hint?.rect || null;
  const hintKey = hRect ? `${hRect.r1},${hRect.c1},${hRect.r2},${hRect.c2}` : '';
  if (domCache.prevHintKey !== hintKey) {
    domCache.prevHintKey = hintKey;
    if (!hRect) {
      domCache.hintRectEl.style.display = 'none';
    } else {
      domCache.hintRectEl.style.display = '';
      applyRectBox(domCache.hintRectEl, hRect, size);
    }
  }

  const hasRects = state.rects.some((r) => r !== null);
  $('#btn-undo').disabled = state.won || state.history.length === 0;
  $('#btn-clear').disabled = state.won || !hasRects;
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

function rcFromPointer(e) {
  if (!dragRect || !state.puzzle) return null;
  const { left, top, width, height } = dragRect;
  if (width <= 0 || height <= 0) return null;
  const x = Math.min(width - 1e-3, Math.max(0, e.clientX - left));
  const y = Math.min(height - 1e-3, Math.max(0, e.clientY - top));
  const size = state.puzzle.size;
  const c = Math.min(size - 1, Math.max(0, Math.floor((x / width) * size)));
  const r = Math.min(size - 1, Math.max(0, Math.floor((y / height) * size)));
  return { r, c };
}

function hasOtherClueInRect(rect, clueIdx, clues) {
  for (let j = 0; j < clues.length; j++) {
    if (j === clueIdx) continue;
    if (cellInRect(clues[j].r, clues[j].c, rect)) return true;
  }
  return false;
}

stageEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.won || !state.puzzle || state.drag) return;
  const cellBtn = e.target.closest('[data-cell]');
  if (!cellBtn) return;
  dragRect = gridEl.getBoundingClientRect();
  const { size } = state.puzzle;
  const idx = Number(cellBtn.dataset.cell);
  const r = Math.floor(idx / size);
  const c = idx % size;

  const clickedClue = findClueAtCell(r, c);
  const ownerClue = findRectOwnerAtCell(r, c);

  let mode = 'free'; // 'from-clue' | 'resize-rect' | 'free'
  let clueIdx = -1;
  let baseRect = null;
  let anchorR = r;
  let anchorC = c;

  if (clickedClue !== -1) {
    mode = 'from-clue';
    clueIdx = clickedClue;
    state.selectedClue = clickedClue;
    baseRect = state.rects[clickedClue] ? { ...state.rects[clickedClue] } : null;
  } else if (ownerClue !== -1) {
    mode = 'resize-rect';
    clueIdx = ownerClue;
    state.selectedClue = ownerClue;
    baseRect = { ...state.rects[ownerClue] };
    // Ancora no canto oposto ao lado/canto que o jogador pegou para permitir puxar qualquer borda
    anchorR = Math.abs(r - baseRect.r1) <= Math.abs(r - baseRect.r2) ? baseRect.r2 : baseRect.r1;
    anchorC = Math.abs(c - baseRect.c1) <= Math.abs(c - baseRect.c2) ? baseRect.c2 : baseRect.c1;
  } else {
    mode = 'free';
    clueIdx = state.selectedClue !== null ? state.selectedClue : -1;
  }

  state.drag = {
    pointerId: e.pointerId,
    mode,
    clueIdx,
    activeClueIdx: clueIdx,
    baseRect,
    anchorR,
    anchorC,
    startR: r,
    startC: c,
    moved: false,
    previewRect: null,
  };

  if (mode !== 'free') syncRectsAndCluesDOM();
});

window.addEventListener(
  'pointermove',
  (e) => {
    if (!state.drag || e.pointerId !== state.drag.pointerId || state.won || !state.puzzle) return;
    const pos = rcFromPointer(e);
    if (!pos) return;
    const { clues } = state.puzzle;
    const { r, c } = pos;

    if (r === state.drag.startR && c === state.drag.startC && !state.drag.moved) return;

    let candidate = null;
    let targetClue = state.drag.clueIdx;

    if (state.drag.mode === 'from-clue') {
      const cl = clues[targetClue];
      const base = state.drag.baseRect;
      const fresh = {
        r1: Math.min(cl.r, r),
        c1: Math.min(cl.c, c),
        r2: Math.max(cl.r, r),
        c2: Math.max(cl.c, c),
      };
      if (base && !cellInRect(r, c, base)) {
        // Se a pista já tinha um retângulo e o jogador puxou para o outro lado, expande o retângulo existente!
        const expanded = {
          r1: Math.min(base.r1, r),
          c1: Math.min(base.c1, c),
          r2: Math.max(base.r2, r),
          c2: Math.max(base.c2, c),
        };
        candidate = !hasOtherClueInRect(expanded, targetClue, clues) ? expanded : fresh;
      } else {
        candidate = fresh;
      }
    } else if (state.drag.mode === 'resize-rect') {
      const cl = clues[targetClue];
      const base = state.drag.baseRect;
      // Se arrastou para fora do retângulo existente, expande a borda correspondente mantendo a pista dentro
      const resized = {
        r1: Math.min(state.drag.anchorR, r, cl.r),
        c1: Math.min(state.drag.anchorC, c, cl.c),
        r2: Math.max(state.drag.anchorR, r, cl.r),
        c2: Math.max(state.drag.anchorC, c, cl.c),
      };
      const expanded = {
        r1: Math.min(base.r1, r),
        c1: Math.min(base.c1, c),
        r2: Math.max(base.r2, r),
        c2: Math.max(base.c2, c),
      };
      candidate = !cellInRect(r, c, base) && !hasOtherClueInRect(expanded, targetClue, clues)
        ? expanded
        : resized;
    } else {
      // Modo livre: arrastou a partir de uma casa vazia (canto a canto!)
      const box = {
        r1: Math.min(state.drag.startR, r),
        c1: Math.min(state.drag.startC, c),
        r2: Math.max(state.drag.startR, r),
        c2: Math.max(state.drag.startC, c),
      };
      // Descobre quais pistas estão dentro da caixa desenhada
      const insideClues = [];
      for (let j = 0; j < clues.length; j++) {
        if (cellInRect(clues[j].r, clues[j].c, box)) insideClues.push(j);
      }
      if (insideClues.length === 1) {
        targetClue = insideClues[0];
        state.selectedClue = targetClue;
        candidate = box;
      } else if (insideClues.length === 0 && targetClue !== -1) {
        const cl = clues[targetClue];
        candidate = {
          r1: Math.min(box.r1, cl.r),
          c1: Math.min(box.c1, cl.c),
          r2: Math.max(box.r2, cl.r),
          c2: Math.max(box.c2, cl.c),
        };
      }
    }

    if (!candidate || targetClue === -1) return;
    if (hasOtherClueInRect(candidate, targetClue, clues)) return;

    // Só redesenha quando o retângulo de prévia realmente muda (evita re-render a cada pixel do mouse)
    const prevRect = state.drag.previewRect;
    if (
      state.drag.moved &&
      state.drag.activeClueIdx === targetClue &&
      prevRect &&
      prevRect.r1 === candidate.r1 &&
      prevRect.c1 === candidate.c1 &&
      prevRect.r2 === candidate.r2 &&
      prevRect.c2 === candidate.c2
    ) {
      return;
    }

    state.drag.moved = true;
    state.drag.activeClueIdx = targetClue;
    state.drag.previewRect = candidate;
    scheduleDragRender();
  },
  { passive: true }
);

function finishPointerDrag(e, commit) {
  if (!state.drag) {
    dragRect = null;
    return;
  }
  if (e && e.pointerId !== undefined && e.pointerId !== state.drag.pointerId) return;
  const { activeClueIdx, moved, previewRect } = state.drag;
  resetDragState();
  if (commit && moved && previewRect && activeClueIdx !== -1) {
    suppressNextClick = true;
    setTimeout(() => {
      suppressNextClick = false;
    }, 0);
    setClueRect(activeClueIdx, previewRect, true);
  } else {
    render();
  }
}

window.addEventListener('pointerup', (e) => finishPointerDrag(e, true));
window.addEventListener('pointercancel', (e) => finishPointerDrag(e, false));
window.addEventListener('blur', () => finishPointerDrag(null, false));

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
  if (cellBtn && !cellBtn.disabled && state.puzzle && !state.won) {
    const { size, clues } = state.puzzle;
    const idx = Number(cellBtn.dataset.cell);
    const r = Math.floor(idx / size);
    const c = idx % size;
    const clickedClue = findClueAtCell(r, c);

    if (clickedClue !== -1) {
      // Se clicou na pista que tem retângulo, limpa o retângulo para recomeçar fácil
      if (state.rects[clickedClue]) {
        state.selectedClue = clickedClue;
        setClueRect(clickedClue, null, true);
      } else {
        state.selectedClue = clickedClue;
        sfx.click();
        render();
      }
      return;
    }

    if (state.selectedClue !== null) {
      const cl = clues[state.selectedClue];
      const existing = state.rects[state.selectedClue];
      const fresh = {
        r1: Math.min(cl.r, r),
        c1: Math.min(cl.c, c),
        r2: Math.max(cl.r, r),
        c2: Math.max(cl.c, c),
      };
      let nextRect = fresh;
      // Se já havia um retângulo na pista selecionada e o jogador clicou fora dele, expande para incluir o novo lado!
      if (existing && !cellInRect(r, c, existing)) {
        const expanded = {
          r1: Math.min(existing.r1, r),
          c1: Math.min(existing.c1, c),
          r2: Math.max(existing.r2, r),
          c2: Math.max(existing.c2, c),
        };
        if (!hasOtherClueInRect(expanded, state.selectedClue, clues)) {
          nextRect = expanded;
        }
      }
      setClueRect(state.selectedClue, nextRect, true);
      return;
    }

    const owner = findRectOwnerAtCell(r, c);
    if (owner !== -1) {
      state.selectedClue = owner;
      sfx.click();
      render();
    }
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
    doHint(false);
  } else if (act === 'show-hint') {
    doHint(true);
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

startNewGame(state.level);
