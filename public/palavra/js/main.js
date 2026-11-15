import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, confetti, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  LEVELS,
  LEVEL_INFO,
  generatePuzzle,
  evaluateGuess,
  isValidGuessWord,
  findClueViolations,
  findNextDeduction,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_palavra_v1';
const KBD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

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
  guesses: [],
  row: [],
  cursor: 0,
  history: [],
  revealed: new Set(),
  hint: null,
  message: null, // { kind: 'err' | 'hint', html }
  won: false,
  lost: false,
  seconds: 0,
  timerId: null,
  errors: 0,
  revealRow: -1,
  shakeRow: false,
  modal: null,
  rulesTab: 'rules',
};

// ---------- cenário (cordão de lâmpadas e brilhos) ----------
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
    [8, 78, 1.1, 0], [16, 44, 0.85, 1], [24, 84, 1.25, 2], [35, 28, 0.75, 3],
    [48, 88, 1.0, 4], [62, 32, 0.9, 0], [74, 82, 1.2, 1], [84, 52, 0.8, 2],
    [92, 76, 1.15, 3], [12, 22, 0.7, 4], [88, 24, 0.95, 0], [54, 18, 0.8, 2],
  ];
  let svg = '<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice">';
  pts.forEach(([x, y, s, ci], idx) => {
    const dur = (7 + (idx % 5) * 1.6).toFixed(1);
    const delay = (-idx * 1.3).toFixed(1);
    const shape =
      idx % 3 === 0
        ? `<path d="M0-10 L8 0 L0 10 L-8 0 Z" fill="${colors[ci]}" opacity=".22"/><circle r="3.2" fill="#fff8ea" opacity=".35"/>`
        : `<path d="M0-7 Q0 0 7 0 Q0 0 0 7 Q0 0 -7 0 Q0 0 0-7 Z" fill="${colors[ci]}" opacity=".28"/>`;
    svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${x * 10},${y * 7}) scale(${s})">${shape}</g></g>`;
  });
  el.innerHTML = svg + '</svg>';
}

// ---------- modal padronizado ----------
function modal(kind, inner) {
  return `<div class="modal" data-kind="${kind}" role="dialog" aria-modal="true">${inner}</div>`;
}

const mini = (word, states) =>
  `<div class="pl-mini-words">${word
    .split('')
    .map((ch, i) => `<span class="pl-mini-tile ${states[i] || ''}">${ch}</span>`)
    .join('')}</div>`;

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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — clássicos de lógica e palavras feitos do zero no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('star', 's')}Palavra na Quermesse</span>
             <p>Inspirado em <i>Wordle</i> e <i>Termo</i>: cada partida sorteia uma palavra nova em português, de 4 a 7 letras conforme o nível.</p>
           </div>
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
           <b>Objetivo: descobrir a palavra secreta em até 6 tentativas!</b>
           <span>Digite uma palavra com o número certo de letras e aperte <b>Enter</b>. As cores mostram o quão perto você chegou. Acentos e cedilha são ignorados.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. O que as cores dizem</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${mini('FESTA', ['correct'])}
           <b>Verde</b>
           <small>A letra está na palavra e na posição certa.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${mini('FAROL', ['', 'present'])}
           <b>Amarelo</b>
           <small>A letra existe, mas em outra posição.</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${mini('TEMPO', ['', '', '', 'absent'])}
           <b>Escuro</b>
           <small>A letra não aparece na palavra.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Controles, Erros e Dicas</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('check', 'l')}
           <div>
             <b>Edite qualquer casa</b>
             <span>Toque numa casa da linha atual para trocar só aquela letra. Use o teclado físico ou o da tela.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('bulb', 'l')}
           <div>
             <b>Erros e Dica</b>
             <span>Digite e apague à vontade antes de confirmar. Ao enviar uma palavra (<b>Enter</b>) que ignore uma pista já revelada (letra descartada, verde fora do lugar...), conta um <b>erro</b>. A <b>Dica</b> revela uma letra.</span>
           </div>
         </div>
       </div>
     </div>
     <div class="row"><button class="btn yellow" data-act="close">Entendi, bora jogar!</button></div>`
  );
}

function renderModal() {
  const root = $('#modal-root');
  if (root) root.innerHTML = state.modal === 'rules' ? rulesModal() : '';
}

// ---------- tempo ----------
function fmtTime(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function startTimer() {
  clearInterval(state.timerId);
  state.seconds = 0;
  $('#pl-timer').textContent = '00:00';
  state.timerId = setInterval(() => {
    if (state.won || state.lost || document.hidden) return;
    state.seconds++;
    $('#pl-timer').textContent = fmtTime(state.seconds);
  }, 1000);
}

// ---------- partida ----------
const emptyRow = () => new Array(state.puzzle.cols).fill('');

function startNewGame(level = state.level) {
  state.level = LEVELS.includes(level) ? level : 'medium';
  saved.level = state.level;
  save();
  state.puzzle = generatePuzzle(state.level, state.puzzle?.word);
  state.guesses = [];
  state.row = emptyRow();
  state.cursor = 0;
  state.history = [];
  state.revealed = new Set();
  state.hint = null;
  state.message = null;
  state.won = false;
  state.lost = false;
  state.errors = 0;
  state.revealRow = -1;
  startTimer();
  render();
}

function snapshot() {
  state.history.push({ row: state.row.slice(), cursor: state.cursor });
  if (state.history.length > 80) state.history.shift();
}

function typeLetter(ch) {
  if (state.won || state.lost) return;
  snapshot();
  state.row[state.cursor] = ch;
  const cols = state.puzzle.cols;
  // avança para a próxima casa vazia à direita (ou a seguinte)
  let next = state.cursor + 1;
  while (next < cols && state.row[next]) next++;
  state.cursor = next < cols ? next : Math.min(state.cursor + 1, cols - 1);
  state.message = null;
  state.revealRow = -1;
  sfx.click();
  render();
}

function backspace() {
  if (state.won || state.lost) return;
  if (!state.row.some(Boolean)) return;
  snapshot();
  if (!state.row[state.cursor] && state.cursor > 0) state.cursor--;
  state.row[state.cursor] = '';
  state.message = null;
  state.revealRow = -1;
  sfx.click();
  render();
}

function undo() {
  if (!state.history.length || state.won || state.lost) return;
  const last = state.history.pop();
  state.row = last.row;
  state.cursor = last.cursor;
  state.message = null;
  state.revealRow = -1;
  sfx.click();
  render();
}

function clearRow() {
  if (state.won || state.lost || !state.row.some(Boolean)) return;
  snapshot();
  state.row = emptyRow();
  state.cursor = 0;
  state.message = null;
  state.revealRow = -1;
  sfx.click();
  render();
}

function showHint() {
  if (state.won || state.lost) return;
  const d = findNextDeduction(state.guesses, state.revealed, state.puzzle.word);
  if (!d) {
    state.message = { kind: 'hint', html: 'Todas as letras já foram reveladas — é só montar a palavra!' };
    render();
    return;
  }
  snapshot();
  state.revealed.add(d.col);
  state.row[d.col] = d.letter;
  state.cursor = d.col;
  state.message = { kind: 'hint', html: d.reason };
  state.revealRow = -1;
  sfx.pop();
  render();
}

function shake(html) {
  state.message = { kind: 'err', html };
  state.shakeRow = true;
  sfx.err();
  render();
  state.shakeRow = false;
}

function submit() {
  if (state.won || state.lost) return;
  const { cols, rows, word } = state.puzzle;
  if (state.row.some((c) => !c)) {
    shake(`Preencha as <b>${cols} letras</b> antes de confirmar.`);
    return;
  }
  const guess = state.row.join('');
  const check = isValidGuessWord(guess, cols);
  if (!check.ok) {
    shake(check.reason);
    return;
  }
  const violation = state.guesses.length > 0 ? findClueViolations(guess, state.guesses, word) : null;
  state.guesses.push(guess);
  state.revealRow = state.guesses.length - 1;
  state.row = emptyRow();
  state.cursor = 0;
  state.history = [];
  state.message = null;

  let ignoredClue = false;
  if (guess !== word && violation?.reason) {
    ignoredClue = true;
    state.errors++;
    state.message = { kind: 'err', html: violation.reason };
    const errEl = $('#pl-errors');
    errEl?.classList.remove('bump');
    void errEl?.offsetWidth;
    errEl?.classList.add('bump');
  }

  if (guess === word) {
    state.won = true;
    clearInterval(state.timerId);
    sfx.win();
    setTimeout(() => confetti(95), cols * 90 + 300);
    const errTxt = state.errors === 0 ? 'sem erros' : state.errors === 1 ? '1 erro' : `${state.errors} erros`;
    toast(`Palavra descoberta em ${state.guesses.length}/${rows} tentativas (${errTxt})!`, 'big');
  } else if (state.guesses.length >= rows) {
    state.lost = true;
    clearInterval(state.timerId);
    sfx.err();
  } else if (ignoredClue) {
    sfx.err();
  } else {
    sfx.deal();
  }
  render();
}

// ---------- desenho ----------
function keyboardStates() {
  const rank = { absent: 1, present: 2, correct: 3 };
  const map = {};
  for (const g of state.guesses) {
    const ev = evaluateGuess(g, state.puzzle.word);
    for (let i = 0; i < g.length; i++) {
      if (!map[g[i]] || rank[ev[i]] > rank[map[g[i]]]) map[g[i]] = ev[i];
    }
  }
  return map;
}

const domCache = {
  gridKey: '',
  rowEls: [],
  tileEls: [],
  kbdBuilt: false,
  kbdKeys: new Map(),
  lastLevel: null,
  lastProgress: '',
  lastErrKey: '',
  lastStatusKey: '',
};

function ensurePalavraDOM(cols, rows) {
  const grid = $('#pl-grid');
  const key = `${cols}x${rows}`;
  if (domCache.gridKey !== key) {
    domCache.gridKey = key;
    grid.style.setProperty('--cols', cols);
    grid.innerHTML = '';
    domCache.rowEls = [];
    domCache.tileEls = [];
    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'pl-row';
      const tiles = [];
      for (let c = 0; c < cols; c++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pl-tile';
        btn.dataset.row = String(r);
        btn.dataset.col = String(c);
        btn.style.setProperty('--i', String(c));
        btn.setAttribute('aria-label', `Letra ${c + 1}`);
        rowEl.appendChild(btn);
        tiles.push(btn);
      }
      grid.appendChild(rowEl);
      domCache.rowEls.push(rowEl);
      domCache.tileEls.push(tiles);
    }
  }

  if (!domCache.kbdBuilt) {
    domCache.kbdBuilt = true;
    const kbd = $('#pl-kbd');
    kbd.innerHTML = '';
    domCache.kbdKeys.clear();
    for (const row of KBD_ROWS) {
      const rowEl = document.createElement('div');
      rowEl.className = 'pl-kbd-row';
      for (const k of row) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.key = k;
        if (k === 'ENTER') {
          btn.className = 'pl-key wide';
          btn.textContent = 'ENTER';
        } else if (k === 'BACK') {
          btn.className = 'pl-key wide';
          btn.setAttribute('aria-label', 'Apagar letra');
          btn.textContent = '⌫';
        } else {
          btn.className = 'pl-key';
          btn.textContent = k;
          domCache.kbdKeys.set(k, btn);
        }
        rowEl.appendChild(btn);
      }
      kbd.appendChild(rowEl);
    }
  }
}

function render() {
  if (!state.puzzle) return;
  const { cols, rows, word } = state.puzzle;
  ensurePalavraDOM(cols, rows);

  if (domCache.lastLevel !== state.level) {
    domCache.lastLevel = state.level;
    document.querySelectorAll('#level-bar [data-level]').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.level === state.level);
    });
  }

  const progKey = `${state.guesses.length}/${rows}`;
  if (domCache.lastProgress !== progKey) {
    domCache.lastProgress = progKey;
    $('#pl-progress').innerHTML = `${ico('star', 's')}<b>${state.guesses.length}</b>/${rows}`;
  }

  const errKey = `${state.errors}`;
  if (domCache.lastErrKey !== errKey) {
    domCache.lastErrKey = errKey;
    const errEl = $('#pl-errors');
    errEl.classList.toggle('has-err', state.errors > 0);
    errEl.innerHTML = `${ico(state.errors > 0 ? 'nope' : 'check', 's')}Erros: <b>${state.errors}</b>`;
  }

  // status
  let stCls = 'pl-status-bar';
  let stHtml = `Digite uma palavra de <b>${cols} letras</b> e aperte <b>Enter</b>.`;
  if (state.won) {
    stCls += ' win';
    stHtml = `${ico('crown', 's')} Acertou <b>${word}</b> em ${fmtTime(state.seconds)}!`;
  } else if (state.lost) {
    stCls += ' lose';
    stHtml = `${ico('nope', 's')} Acabaram as tentativas. A palavra era <b>${word}</b>.`;
  } else if (state.message) {
    stCls += ` ${state.message.kind}`;
    stHtml = `${ico(state.message.kind === 'err' ? 'nope' : 'bulb', 's')} <span>${state.message.html}</span>`;
  }
  const stKey = `${stCls}|${stHtml}`;
  if (domCache.lastStatusKey !== stKey) {
    domCache.lastStatusKey = stKey;
    const st = $('#pl-status');
    st.className = stCls;
    st.innerHTML = stHtml;
  }

  // grade (atualização incremental sem reconstruir os nós DOM)
  const activeIdx = state.won || state.lost ? -1 : state.guesses.length;
  for (let r = 0; r < rows; r++) {
    const rowEl = domCache.rowEls[r];
    const rowTiles = domCache.tileEls[r];
    if (r < state.guesses.length) {
      rowEl.className = 'pl-row';
      const g = state.guesses[r];
      const ev = evaluateGuess(g, word);
      const reveal = r === state.revealRow ? ' reveal' : '';
      for (let c = 0; c < cols; c++) {
        const tile = rowTiles[c];
        tile.tabIndex = -1;
        const nextCls = `pl-tile ${ev[c]}${reveal}`;
        if (tile.className !== nextCls) tile.className = nextCls;
        if (tile.textContent !== g[c] || tile.firstElementChild) tile.textContent = g[c];
      }
    } else if (r === activeIdx) {
      const nextRowCls = state.shakeRow ? 'pl-row active shake' : 'pl-row active';
      if (rowEl.className !== nextRowCls) rowEl.className = nextRowCls;
      for (let c = 0; c < cols; c++) {
        const tile = rowTiles[c];
        tile.tabIndex = 0;
        const ch = state.row[c];
        let nextCls = 'pl-tile';
        if (ch) nextCls += ' filled';
        if (c === state.cursor) nextCls += ' cursor';
        if (tile.className !== nextCls) tile.className = nextCls;

        if (ch) {
          if (tile.firstElementChild || tile.textContent !== ch) tile.textContent = ch;
        } else if (state.revealed.has(c)) {
          const ghost = word[c];
          if (!tile.firstElementChild || tile.firstElementChild.textContent !== ghost) {
            tile.innerHTML = `<span class="ghost">${ghost}</span>`;
          }
        } else if (tile.textContent !== '' || tile.firstElementChild) {
          tile.textContent = '';
        }
      }
    } else {
      if (rowEl.className !== 'pl-row') rowEl.className = 'pl-row';
      for (let c = 0; c < cols; c++) {
        const tile = rowTiles[c];
        tile.tabIndex = -1;
        if (tile.className !== 'pl-tile') tile.className = 'pl-tile';
        if (tile.textContent !== '' || tile.firstElementChild) tile.textContent = '';
      }
    }
  }
  if (state.revealRow !== -1) state.revealRow = -2; // anima só uma vez

  // teclado (só muda classes)
  const ks = keyboardStates();
  for (const [k, btn] of domCache.kbdKeys) {
    const nextCls = ks[k] ? `pl-key ${ks[k]}` : 'pl-key';
    if (btn.className !== nextCls) btn.className = nextCls;
  }

  const over = state.won || state.lost;
  $('#btn-undo').disabled = over || state.history.length === 0;
  $('#btn-clear').disabled = over || !state.row.some(Boolean);
  $('#btn-hint').disabled = over;
}

// ---------- eventos ----------
document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
$('#btn-rules').innerHTML = ico('help');
$('#btn-bottom-rules').innerHTML = `${ico('help', 's')}Como joga`;
$('#btn-bottom-about').innerHTML = `${ico('info', 's')}Sobre e créditos`;
$('#btn-new-game').innerHTML = `${ico('reset', 's')}<span>Nova palavra</span>`;
$('#btn-undo').innerHTML = `${ico('undo', 's')}<span>Desfazer</span>`;
$('#btn-clear').innerHTML = `${ico('nope', 's')}<span>Limpar</span>`;
$('#btn-hint').innerHTML = `${ico('bulb', 's')}<span>Dica</span>`;

function pressKey(k) {
  if (k === 'ENTER') submit();
  else if (k === 'BACK') backspace();
  else if (/^[A-Z]$/.test(k)) typeLetter(k);
}

document.addEventListener('click', (e) => {
  if (e.target === $('#modal-root') && state.modal) {
    state.modal = null;
    sfx.click();
    renderModal();
    return;
  }
  const key = e.target.closest('[data-key]');
  if (key) {
    pressKey(key.dataset.key);
    return;
  }
  const tile = e.target.closest('[data-col]');
  if (tile && !state.won && !state.lost) {
    if (Number(tile.dataset.row) !== state.guesses.length) return;
    state.cursor = Number(tile.dataset.col);
    sfx.click();
    render();
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act;
  if (act === 'level') {
    sfx.click();
    startNewGame(btn.dataset.level);
  } else if (act === 'new-game') {
    sfx.click();
    startNewGame(state.level);
  } else if (act === 'undo') undo();
  else if (act === 'clear') clearRow();
  else if (act === 'hint') showHint();
  else if (act === 'mute') {
    setMuted(!isMuted());
    $('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
    sfx.click();
  } else if (act === 'rules' || act === 'about') {
    sfx.click();
    const tab = act === 'about' ? 'about' : 'rules';
    if (state.modal === 'rules' && state.rulesTab === tab) state.modal = null;
    else {
      state.rulesTab = tab;
      state.modal = 'rules';
    }
    renderModal();
  } else if (act === 'rules-tab') {
    sfx.click();
    state.rulesTab = btn.dataset.tab === 'about' ? 'about' : 'rules';
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
  if (state.modal || e.ctrlKey || e.metaKey || e.altKey || !state.puzzle) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    // evita "clicar" de novo o botão focado ao apertar Enter
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    submit();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    backspace();
  } else if (e.key === 'Delete') {
    e.preventDefault();
    if (state.row[state.cursor]) {
      snapshot();
      state.row[state.cursor] = '';
      state.message = null;
      render();
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    state.cursor = Math.max(0, state.cursor - 1);
    render();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    state.cursor = Math.min(state.puzzle.cols - 1, state.cursor + 1);
    render();
  } else if (e.key.length === 1) {
    const ch = e.key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace('Ç', 'C');
    if (/^[A-Z]$/.test(ch)) {
      e.preventDefault();
      typeLetter(ch);
    }
  }
});

startNewGame(state.level);
