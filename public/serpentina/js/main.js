import { createPuzzlePool } from '../../js/puzzle-pool.js';
import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  LEVELS,
  LEVEL_INFO,
  canMove,
  generatePuzzle,
  validateBoard,
  findNextDeduction,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_serpentina_v1';
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
  path: [],
  history: [],
  hint: null,
  won: false,
  seconds: 0,
  timerId: null,
  errors: 0,
  errorTimer: null,
  shownBadCells: new Set(),
  shownReason: null,
  modal: null,
  rulesTab: 'rules',
  dragging: false,
  dragSnapshot: null,
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — trazendo desafios de lógica, caminho e estratégia feitos na unha para o navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('road', 's')}Por que Serpentina?</span>
             <p>Um quebra-cabeça de caminho contínuo em que cada partida gera uma trilha inédita com barreiras em cruz, exigindo visão espacial para cobrir 100% do tabuleiro na ordem certa.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro com gerador de caminhos Hamiltonianos em tempo real.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Dicas passo a passo</b><span>Se fechar o próprio caminho sem querer, a dica mostra exatamente de onde retomar.</span></div></div>
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
         ${ico('road', 'l')}
         <div>
           <b>Objetivo: conectar os números em ordem e preencher tudo!</b>
           <span>Partindo do <b>1</b>, desenhe uma linha contínua passando por <b>1 → 2 → 3…</b> até o último número, visitando <b>todas as casas</b> do tabuleiro.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. As 3 regras de ouro</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('check', 'l')}
           <b>Siga a ordem</b>
           <small>Visite os círculos numerados na sequência exata (<b>1, 2, 3…</b>). Você não pode passar por um número maior antes do anterior.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('road', 'l')}
           <b>Preencha cada casa</b>
           <small>A serpentina deve passar por <b>100% das células</b> da grade exatamente uma vez, sem cruzar por cima de si mesma.</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('nope', 'l')}
           <b>Respeite os muros</b>
           <small>As barreiras grossas pretas bloqueiam a passagem entre duas casas vizinhas — contorne pelos lados livres.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Controles e ajuda</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('hand', 'l')}
           <div>
             <b>Arraste, toque ou volte</b>
             <span>Arraste o dedo/mouse para traçar o caminho, toque numa casa vizinha para avançar ou toque em qualquer ponto anterior da linha para rebobinar.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Dica inteligente e erros</b>
             <span>O jogo espera você terminar o movimento antes de apontar erros. Se travar, o botão <b>Dica</b> revela o próximo trecho correto.</span>
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
  const el = $('#sp-timer');
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

  const v = validateBoard(state.path, state.puzzle);
  const hasNewErr = [...v.badCells].some((c) => !state.shownBadCells.has(c));

  state.shownBadCells = v.badCells;
  state.shownReason = v.reason;

  if (hasNewErr) {
    state.errors++;
    sfx.err();
    shake($('#sp-stage'), 0.45);
  }

  if (state.dragging) scheduleRender();
  else render();
}

const puzzlePool = createPuzzlePool('serpentina', generatePuzzle, LEVELS);

function startNewGame(level = state.level) {
  clearPendingErrorCheck();
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();

  state.puzzle = puzzlePool.take(state.level);
  const startCell = state.puzzle.clueCells[0].cell;
  state.path = [startCell];
  state.history = [];
  state.hint = null;
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

  if (state.dragging) scheduleRender();
  else render();
}

function applyNewPath(nextPath, recordHistory = true) {
  if (!state.puzzle || state.won) return;
  const same =
    nextPath.length === state.path.length && nextPath.every((v, idx) => v === state.path[idx]);
  if (same) return;

  clearPendingErrorCheck();
  if (recordHistory) {
    state.history.push([...state.path]);
  }
  state.path = nextPath;
  state.hint = null;

  const v = validateBoard(state.path, state.puzzle);

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
    const stageRect = $('#sp-stage')?.getBoundingClientRect();
    if (stageRect) {
      burst(
        { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 },
        '#1fae96',
        18
      );
    }
    const errTxt =
      state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
    toast(
      `Serpentina ${LEVEL_INFO[state.level].name} fechada em ${fmtTime(state.seconds)} (${errTxt})!`,
      'big'
    );
  } else {
    const tip = state.path[state.path.length - 1];
    if (state.puzzle.clues[tip] > 1) sfx.pop();
    else sfx.click();

    if (v.badCells.size > 0) {
      state.errorTimer = setTimeout(commitErrors, ERROR_DELAY_MS);
    }
  }

  if (state.dragging) scheduleRender();
  else render();
}

/**
 * Tenta estender ou rebobinar o caminho até `targetCell` (por clique ou arrasto).
 */
function stepTowardCell(targetCell, isDrag = false) {
  if (!state.puzzle || state.won) return;
  const { size, wallSet } = state.puzzle;
  const curPath = state.path;
  const tip = curPath[curPath.length - 1];
  if (targetCell === tip) return;

  // Se o jogador clicou no alvo da dica ativa, aplica o trecho da dica
  if (!isDrag && state.hint && state.hint.cell === targetCell && state.hint.targetPath) {
    applyNewPath(state.hint.targetPath, true);
    return;
  }

  // Se a célula já faz parte do caminho:
  const existingIdx = curPath.indexOf(targetCell);
  if (existingIdx !== -1) {
    // No arrasto, permite dar ré voltando para a célula imediatamente anterior (ou rebobinar até ela)
    if (isDrag) {
      if (existingIdx === curPath.length - 2) {
        applyNewPath(curPath.slice(0, existingIdx + 1), false);
      }
      return;
    }
    // No clique simples, rebobina o caminho até a casa clicada
    applyNewPath(curPath.slice(0, existingIdx + 1), true);
    return;
  }

  // Caso 1: Vizinho ortogonal direto da ponta atual
  if (canMove(tip, targetCell, size, wallSet)) {
    applyNewPath([...curPath, targetCell], !isDrag);
    return;
  }

  // Caso 2 (apenas clique): Linha reta na mesma linha ou coluna sem paredes nem casas já visitadas
  if (!isDrag) {
    const r1 = Math.floor(tip / size);
    const c1 = tip % size;
    const r2 = Math.floor(targetCell / size);
    const c2 = targetCell % size;
    if (r1 === r2 || c1 === c2) {
      const dr = Math.sign(r2 - r1);
      const dc = Math.sign(c2 - c1);
      const steps = [];
      let cr = r1;
      let cc = c1;
      let prev = tip;
      let ok = true;
      while (cr !== r2 || cc !== c2) {
        cr += dr;
        cc += dc;
        const next = cr * size + cc;
        if (curPath.includes(next) || !canMove(prev, next, size, wallSet)) {
          ok = false;
          break;
        }
        steps.push(next);
        prev = next;
      }
      if (ok && steps.length > 0) {
        applyNewPath([...curPath, ...steps], true);
      }
    }
  }
}

function doUndo() {
  if (!state.history.length || state.won) return;
  clearPendingErrorCheck();
  state.path = state.history.pop();
  state.hint = null;

  const v = validateBoard(state.path, state.puzzle);
  state.shownBadCells = new Set([...state.shownBadCells].filter((c) => v.badCells.has(c)));
  state.shownReason = state.shownBadCells.size > 0 ? v.reason : null;

  sfx.click();
  if (state.dragging) scheduleRender();
  else render();
}

function doClear() {
  if (!state.puzzle || state.won || state.path.length <= 1) return;
  clearPendingErrorCheck();
  const startCell = state.puzzle.clueCells[0].cell;
  state.path = [startCell];
  state.history = [];
  state.hint = null;
  state.shownBadCells.clear();
  state.shownReason = null;
  sfx.click();
  if (state.dragging) scheduleRender();
  else render();
}

function doHint() {
  if (!state.puzzle || state.won) return;
  clearPendingErrorCheck();

  if (state.hint && state.hint.targetPath) {
    applyNewPath(state.hint.targetPath, true);
    return;
  }

  const move = findNextDeduction(state.path, state.puzzle);
  if (move) {
    state.hint = {
      cell: move.cell,
      targetPath: move.targetPath,
      cells: move.cells || [move.cell],
      reason: `<b>Dica:</b> ${move.reason} <small>(Toque na casa destacada ou em Dica de novo)</small>`,
    };
    sfx.pop();
    render();
  }
}

function cellCenterPct(idx, size) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  return {
    x: ((c + 0.5) / size) * 100,
    y: ((r + 0.5) / size) * 100,
  };
}

function buildPathD(cells, size) {
  if (!cells || cells.length === 0) return '';
  return cells
    .map((idx, i) => {
      const { x, y } = cellCenterPct(idx, size);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

const domCache = {
  puzzle: null,
  cells: [],
  prevCellCls: [],
  nodes: [],
  prevNodeCls: [],
  hintPathEl: null,
  ribbonOutEl: null,
  ribbonInEl: null,
  tipCircleEl: null,
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

function ensureSerpentinaDOM() {
  if (domCache.puzzle === state.puzzle) return;
  domCache.puzzle = state.puzzle;
  const { size, total, clues, clueCells, walls } = state.puzzle;

  const gridEl = $('#sp-grid');
  gridEl.style.setProperty('--n', String(size));
  gridEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  domCache.cells = new Array(total);
  domCache.prevCellCls = new Array(total).fill('');
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / size) + 1;
    const c = (i % size) + 1;
    const num = clues[i];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-cell';
    btn.dataset.cell = String(i);
    btn.setAttribute('aria-label', `Linha ${r}, Coluna ${c}: ${num ? `Número ${num}` : 'casa'}`);
    frag.appendChild(btn);
    domCache.cells[i] = btn;
  }
  gridEl.appendChild(frag);

  const ribbonW = (44 / size).toFixed(2);
  const ribbonInW = (34 / size).toFixed(2);
  const wallW = (14 / size).toFixed(2);

  let wallsSvg = '';
  for (const w of walls) {
    if (w.dir === 'v') {
      const x = (((w.c + 1) / size) * 100).toFixed(2);
      const y1 = ((w.r / size) * 100).toFixed(2);
      const y2 = (((w.r + 1) / size) * 100).toFixed(2);
      wallsSvg += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#14202b" stroke-width="${wallW}" stroke-linecap="square"/>`;
    } else {
      const x1 = ((w.c / size) * 100).toFixed(2);
      const x2 = (((w.c + 1) / size) * 100).toFixed(2);
      const y = (((w.r + 1) / size) * 100).toFixed(2);
      wallsSvg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#14202b" stroke-width="${wallW}" stroke-linecap="square"/>`;
    }
  }

  const svgEl = $('#sp-svg');
  svgEl.innerHTML =
    `<defs>` +
    `<linearGradient id="sp-grad" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="#1fae96"/>` +
    `<stop offset="55%" stop-color="#3d7be0"/>` +
    `<stop offset="100%" stop-color="#f7b733"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<path id="sp-hint-path" fill="none" stroke="#f7b733" stroke-width="${(22 / size).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3" opacity=".85" d=""/>` +
    `<path id="sp-rib-out" fill="none" stroke="#14202b" stroke-width="${ribbonW}" stroke-linecap="round" stroke-linejoin="round" d=""/>` +
    `<path id="sp-rib-in" fill="none" stroke="url(#sp-grad)" stroke-width="${ribbonInW}" stroke-linecap="round" stroke-linejoin="round" d=""/>` +
    `<circle id="sp-tip-dot" cx="0" cy="0" r="${(17 / size).toFixed(2)}" fill="#1fae96" stroke="#14202b" stroke-width="${(3.5 / size).toFixed(2)}"/>` +
    wallsSvg;

  domCache.hintPathEl = svgEl.querySelector('#sp-hint-path');
  domCache.ribbonOutEl = svgEl.querySelector('#sp-rib-out');
  domCache.ribbonInEl = svgEl.querySelector('#sp-rib-in');
  domCache.tipCircleEl = svgEl.querySelector('#sp-tip-dot');

  const nodesEl = $('#sp-nodes');
  const nodeSz = size <= 5 ? '38px' : size === 6 ? '34px' : size === 7 ? '31px' : '28px';
  const nodeFs = size <= 5 ? '16px' : size === 6 ? '15px' : size === 7 ? '14px' : '13px';
  nodesEl.style.setProperty('--node-sz', nodeSz);
  nodesEl.style.setProperty('--node-fs', nodeFs);
  nodesEl.innerHTML = '';

  const nodeFrag = document.createDocumentFragment();
  domCache.nodes = [];
  domCache.prevNodeCls = [];
  for (const { num, cell } of clueCells) {
    const { x, y } = cellCenterPct(cell, size);
    const div = document.createElement('div');
    div.className = 'sp-node';
    div.style.left = `${x.toFixed(2)}%`;
    div.style.top = `${y.toFixed(2)}%`;
    div.textContent = String(num);
    nodeFrag.appendChild(div);
    domCache.nodes.push({ el: div, num, cell });
    domCache.prevNodeCls.push('');
  }
  nodesEl.appendChild(nodeFrag);
}

function render() {
  if (!state.puzzle) return;
  ensureSerpentinaDOM();
  const { size, total } = state.puzzle;

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  const progEl = $('#sp-progress');
  const progKey = `${state.path.length}/${total}`;
  if (progEl && domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    progEl.innerHTML = `${ico('road', 's')}<b>${state.path.length}</b>/${total}`;
  }

  const errEl = $('#sp-errors');
  const errKey = String(state.errors);
  if (errEl && domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  const v = validateBoard(state.path, state.puzzle);

  const stEl = $('#sp-status');
  if (stEl) {
    let stCls = 'sp-status-bar';
    let stHtml;
    if (state.won) {
      const errTxt =
        state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
      stCls += ' win';
      stHtml = `${ico('crown', 's')} Perfeito! Fechado no nível ${LEVEL_INFO[state.level].name} (${size}×${size}) em ${fmtTime(state.seconds)} (${errTxt})!`;
    } else if (state.shownBadCells.size > 0 && state.shownReason) {
      stCls += ' err';
      stHtml = `${ico('nope', 's')} <span>${state.shownReason}</span>`;
    } else if (state.hint) {
      stCls += ' hint';
      stHtml = `${ico('bulb', 's')} <span>${state.hint.reason}</span>`;
    } else {
      stHtml = `Próximo alvo: número <b>${v.nextTargetNum}</b> · Preencha todas as <b>${total}</b> casas em ordem.`;
    }
    const stKey = `${stCls}|${stHtml}`;
    if (domCache.lastStatusKey !== stKey) {
      domCache.lastStatusKey = stKey;
      stEl.className = stCls;
      stEl.innerHTML = stHtml;
    }
  }

  const visitedSet = new Set(state.path);
  const tip = state.path[state.path.length - 1];
  const hintCtx = state.hint?.cells ? new Set(state.hint.cells) : null;

  for (let i = 0; i < total; i++) {
    let cls = 'sp-cell';
    if (visitedSet.has(i)) cls += ' visited';
    if (i === tip) cls += ' tip';
    if (state.shownBadCells.has(i)) cls += ' bad';
    if (state.hint?.cell === i) cls += ' hint-target';
    else if (hintCtx && hintCtx.has(i)) cls += ' hint-ctx';

    if (domCache.prevCellCls[i] !== cls) {
      domCache.prevCellCls[i] = cls;
      domCache.cells[i].className = cls;
    }
  }

  // Atualiza somente os atributos d / cx / cy do SVG sem recriar <defs> ou paredes
  const pathD = state.path.length > 1 ? buildPathD(state.path, size) : '';
  domCache.ribbonOutEl.setAttribute('d', pathD);
  domCache.ribbonInEl.setAttribute('d', pathD);

  const hintD =
    state.hint && state.hint.cells && state.hint.cells.length > 1 ? buildPathD(state.hint.cells, size) : '';
  domCache.hintPathEl.setAttribute('d', hintD);

  const tipCenter = cellCenterPct(tip, size);
  domCache.tipCircleEl.setAttribute('cx', tipCenter.x.toFixed(2));
  domCache.tipCircleEl.setAttribute('cy', tipCenter.y.toFixed(2));

  // Atualiza classes das fichas numeradas
  for (let k = 0; k < domCache.nodes.length; k++) {
    const { el, num, cell } = domCache.nodes[k];
    const isBad = state.shownBadCells.has(cell);
    const isReached = visitedSet.has(cell) && !isBad;
    const isNext = num === v.nextTargetNum && !isReached;

    let cls = 'sp-node';
    if (num === 1) cls += ' start';
    if (isReached) cls += ' reached';
    if (isNext) cls += ' next-target';
    if (isBad) cls += ' bad';

    if (domCache.prevNodeCls[k] !== cls) {
      domCache.prevNodeCls[k] = cls;
      el.className = cls;
    }
  }

  $('#btn-undo').disabled = state.won || state.history.length === 0;
  $('#btn-clear').disabled = state.won || state.path.length <= 1;
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

const stageEl = $('#sp-stage');
let suppressNextClick = false;
let dragMoved = false;
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

stageEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.won || !state.puzzle) return;
  const cellBtn = e.target.closest('[data-cell]');
  if (!cellBtn) return;
  const idx = Number(cellBtn.dataset.cell);

  dragRect = $('#sp-grid').getBoundingClientRect();
  state.dragging = true;
  dragMoved = false;
  state.dragSnapshot = [...state.path];

  // Se começou a arrastar a partir de um ponto anterior da própria linha, já rebobina até lá
  const posInPath = state.path.indexOf(idx);
  if (posInPath !== -1 && posInPath < state.path.length - 1) {
    dragMoved = true;
    applyNewPath(state.path.slice(0, posInPath + 1), false);
  }
});

stageEl.addEventListener('pointermove', (e) => {
  if (!state.dragging || state.won || !state.puzzle) return;
  const idx = cellFromPointer(e);
  if (idx < 0) return;
  const tip = state.path[state.path.length - 1];
  if (idx === tip) return;

  const beforeLen = state.path.length;
  stepTowardCell(idx, true);
  if (state.path.length !== beforeLen) {
    dragMoved = true;
  }
});

window.addEventListener('pointerup', () => {
  dragRect = null;
  if (!state.dragging) return;
  state.dragging = false;
  if (dragMoved && state.dragSnapshot) {
    const changed =
      state.dragSnapshot.length !== state.path.length ||
      state.dragSnapshot.some((v, i) => v !== state.path[i]);
    if (changed) {
      state.history.push(state.dragSnapshot);
      suppressNextClick = true;
      render();
    }
  }
  state.dragSnapshot = null;
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
    stepTowardCell(Number(cellBtn.dataset.cell), false);
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
    return;
  }
  if (state.modal || state.won || !state.puzzle) return;
  const { size } = state.puzzle;
  const tip = state.path[state.path.length - 1];
  const r = Math.floor(tip / size);
  const c = tip % size;
  let target = -1;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
    if (r > 0) target = (r - 1) * size + c;
  } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
    if (r + 1 < size) target = (r + 1) * size + c;
  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    if (c > 0) target = r * size + (c - 1);
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    if (c + 1 < size) target = r * size + (c + 1);
  }
  if (target !== -1) {
    e.preventDefault();
    if (state.path.length >= 2 && target === state.path[state.path.length - 2]) {
      applyNewPath(state.path.slice(0, -1), true);
    } else {
      stepTowardCell(target, false);
    }
  }
});

startNewGame(state.level);
