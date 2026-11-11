import { BoardView } from './board.js';
import { sfx, flyIcon, flyBoulder, shake, bubble, confetti, toast, isMuted, setMuted } from './fx.js';
import { connectFirebase, isFirebaseConfigured } from './net-firebase.js';

// ---------- constantes ----------
const RES = ['wood', 'stone', 'cheese', 'pumpkin', 'crystal'];
const RES_NAME = { wood: 'Madeira', stone: 'Pedra', cheese: 'Queijo', pumpkin: 'Abóbora', crystal: 'Cristal' };
const COLORS = [
  { hex: '#ff4757', av: '🦊' },
  { hex: '#2e9bff', av: '🐳' },
  { hex: '#ffd32a', av: '🐥' },
  { hex: '#ff6bd6', av: '🦩' },
  { hex: '#1dd3b0', av: '🐸' },
  { hex: '#f1f2f6', av: '🐼' },
];
const COSTS = {
  road: { wood: 1, stone: 1 },
  village: { wood: 1, stone: 1, cheese: 1, pumpkin: 1 },
  castle: { pumpkin: 2, crystal: 3 },
  card: { cheese: 1, pumpkin: 1, crystal: 1 },
};
const CARDS = {
  knight: { name: 'Catapulteiro', icon: '🎯', desc: 'Mire a catapulta em outro terreno e roube uma carta de quem mora ali. Pode usar antes de rolar.' },
  vp: { name: 'Banquete', icon: '🍗', desc: 'Vale 1 ponto secreto.' },
  roads: { name: 'Mutirão', icon: '🛤️', desc: 'Abra 2 trilhas de graça.' },
  plenty: { name: 'Fartura', icon: '🧺', desc: 'Pegue 2 recursos à sua escolha do banco.' },
  monopoly: { name: 'Arrastão', icon: '🧲', desc: 'Escolha um recurso: todo mundo te entrega tudo o que tem dele.' },
  gale: { name: 'Vendaval', icon: '🌪️', desc: 'Cada jogador passa 1 carta aleatória para o próximo da roda.' },
};
const EMOTES = ['😂', '😭', '😡', '😎', '🙏', '🎉', '👀', '🧀'];
const FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

// ---------- utilidades ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const zero = () => ({ wood: 0, stone: 0, cheese: 0, pumpkin: 0, crystal: 0 });
const sum = (o) => RES.reduce((n, r) => n + (o[r] || 0), 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ico = (r, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 32 32"><use href="#i-${r}"/></svg>`;
const resSet = (o) =>
  `<span class="res-set">${RES.filter((r) => o[r]).map((r) => `<span class="res-pill">${ico(r, 's')}${o[r]}</span>`).join('')}</span>`;
const costIcons = (c) => `<span class="cost">${RES.flatMap((r) => Array(c[r] || 0).fill(ico(r, 's'))).join('')}</span>`;
const hexOf = (p) => COLORS[G.players[p].color].hex;
const avOf = (p) => COLORS[G.players[p].color].av;

// ---------- estado ----------
const params = new URLSearchParams(location.search);
const KEY = 'catapulta' + (params.get('p') || '');
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(KEY)) || {};
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
};

let ws = null;
let retry = null;
let room = null;
let G = null;
let epoch = 0;
const queue = [];
let busy = false;
let prevHand = null;
let lastLogId = 0;
const cache = {};
const ui = { pending: false, mode: null, modal: null, card: null, plenty: [], give: zero(), get: zero(), discard: zero(), hideEnd: false, lastModal: null };

const boardView = new BoardView($('#board'), onPick);

// ---------- rede ----------
let fbConn = null;

function connect(code) {
  clearTimeout(retry);
  if (fbConn) {
    fbConn.close();
    fbConn = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  if (isFirebaseConfigured()) {
    connectFirebase({ name: saved.name, code, key: saved.key }, onMsg).then((conn) => {
      fbConn = conn;
    });
    return;
  }
  const sock = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`));
  sock.onopen = () => sock.send(JSON.stringify({ t: 'hello', name: saved.name, token: saved.token, key: saved.key, code }));
  sock.onmessage = (e) => onMsg(JSON.parse(e.data));
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (room) {
      toast('Conexão caiu. Reconectando…', 'err');
      retry = setTimeout(() => connect(room.code), 1500);
    } else {
      toast('Não consegui falar com o servidor', 'err');
    }
  };
}
const sendMsg = (m) => {
  if (fbConn) fbConn.send(m);
  else if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
};
const act = (a) => sendMsg({ t: 'act', a });

function setUrl(code) {
  const u = new URL(location.href);
  if (code) u.searchParams.set('sala', code);
  else u.searchParams.delete('sala');
  history.replaceState(null, '', u);
}

function goHome() {
  clearTimeout(retry);
  room = null;
  G = null;
  epoch++;
  queue.length = 0;
  saved.code = null;
  save();
  if (fbConn) {
    fbConn.close();
    fbConn = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  setUrl(null);
  ui.modal = null;
  renderScreen();
}

function onMsg(m) {
  switch (m.t) {
    case 'hello':
      saved.token = m.token;
      saved.code = m.code;
      save();
      setUrl(m.code);
      break;
    case 'room':
      room = m;
      if (!m.inGame) {
        G = null;
        epoch++;
        queue.length = 0;
        ui.modal = null;
      }
      renderScreen();
      break;
    case 'game':
      queue.push(m);
      pump();
      break;
    case 'emote': {
      const el = room && room.inGame ? $(`#pl-${m.p}`) : document.querySelectorAll('#lobby .seat')[m.p];
      bubble(el, m.e);
      sfx.pop();
      break;
    }
    case 'err':
      toast(esc(m.m), 'err');
      sfx.err();
      if (m.needKey) {
        $('#field-key')?.classList.remove('hidden');
        $('#in-key')?.focus();
      }
      if (m.fatal) goHome();
      else if (ui.pending) {
        ui.pending = false;
        renderScreen();
      }
      break;
  }
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    try {
      await applyGame(queue.shift());
    } catch (e) {
      console.error(e);
    }
  }
  busy = false;
}

async function applyGame(m) {
  const myEpoch = epoch;
  if (m.board) boardView.setBoard(m.board);
  const prev = G;
  const evs = m.ev || [];
  if (prev) {
    for (const e of evs) {
      if (e.type === 'roll') await animateRoll(e);
      else if (e.type === 'catapult') await animateCatapult(e);
      if (epoch !== myEpoch) return;
    }
  }
  G = m.s;
  ui.pending = false;
  if (G.turn !== G.me || G.sub !== 'action') ui.mode = null;
  if (!G.discard[G.me]) ui.discard = zero();
  for (const e of evs) {
    if ((e.type === 'deal' || e.type === 'bank') && e.p === G.me) {
      ui.give = zero();
      ui.get = zero();
      if (e.type === 'deal') ui.modal = null;
    }
    if (e.type === 'win') ui.hideEnd = false;
  }
  renderScreen();
  if (!prev) {
    if (G.dice) setDice(G.dice);
    return;
  }
  let gi = 0;
  for (const e of evs) after(e, gi++);
}

// ---------- efeitos por evento ----------
function setDice(d) {
  ['#die-a', '#die-b'].forEach((sel, i) => {
    let h = '';
    for (let k = 0; k < 9; k++) h += `<i class="${FACES[d[i]].includes(k) ? 'on' : ''}"></i>`;
    $(sel).innerHTML = h;
  });
}

async function animateRoll(e) {
  const el = $('#dice');
  el.classList.remove('can');
  el.classList.add('rolling');
  sfx.dice();
  const t0 = performance.now();
  while (performance.now() - t0 < 620) {
    setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    await sleep(70);
  }
  el.classList.remove('rolling');
  setDice(e.d);
  const total = e.d[0] + e.d[1];
  if (total === 7) toast('7! 💥 Hora da catapulta!', 'big');
  else boardView.flash(total, G ? G.catapult : -1);
  await sleep(260);
}

function centerOf(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function animateCatapult(e) {
  sfx.whoosh();
  await flyBoulder(centerOf($(`#pl-${e.p} .pl-av`)), boardView.tileScreen(e.tile));
  sfx.boom();
  shake($('#stage'));
}

function after(e, i) {
  const name = (p) => esc(G.players[p].name);
  switch (e.type) {
    case 'gain': {
      const from = boardView.tileScreen(e.tile);
      const to = centerOf($(`#pl-${e.p} .pl-av`));
      for (let k = 0; k < e.n; k++) flyIcon(e.res, from, to, i * 90 + k * 120);
      if (i < 5) sfx.gain(i);
      break;
    }
    case 'build':
      sfx.build();
      break;
    case 'steal':
      bubble($(`#pl-${e.from}`), '😱');
      if (e.res && e.to === G.me) toast(`Você roubou ${ico(e.res)} de ${name(e.from)}!`);
      else if (e.res) toast(`${name(e.to)} roubou ${ico(e.res)} de você!`, 'err');
      break;
    case 'card':
      sfx.card();
      toast(`${avOf(e.p)} ${name(e.p)} usou ${CARDS[e.card].icon} ${CARDS[e.card].name}!`, 'big');
      break;
    case 'buy':
      sfx.pop();
      if (e.card) toast(`Você comprou: ${CARDS[e.card].icon} ${CARDS[e.card].name}`);
      break;
    case 'monopoly':
      toast(`${name(e.p)} levou ${e.n}× ${ico(e.res)}`);
      break;
    case 'award':
      sfx.card();
      toast(`🏆 ${name(e.p)}: ${e.award === 'road' ? 'Maior Trilha' : 'Rei da Catapulta'}!`, 'big');
      break;
    case 'turn':
      if (e.p === G.me) sfx.turn();
      break;
    case 'offer':
      if (e.p !== G.me) sfx.pop();
      break;
    case 'deal':
    case 'bank':
      sfx.deal();
      break;
    case 'win':
      sfx.win();
      confetti();
      break;
  }
}

// ---------- telas ----------
function renderScreen() {
  const which = !room ? 'home' : room.inGame ? 'game' : 'lobby';
  for (const s of ['home', 'lobby', 'game']) $('#screen-' + s).classList.toggle('hidden', s !== which);
  if (which === 'lobby') renderLobby();
  if (which === 'game' && G) render();
  else setHtml('modal', $('#modal-root'), which === 'lobby' && ui.modal === 'rules' ? rulesModal() : '');
}

function setHtml(key, el, html) {
  if (cache[key] === html) return false;
  cache[key] = html;
  el.innerHTML = html;
  return true;
}

function renderLobby() {
  const me = room.seats[room.you];
  const seats = [0, 1, 2, 3]
    .map((i) => {
      const s = room.seats[i];
      if (!s) {
        return `<div class="seat empty">${room.host ? '<button class="btn small" data-act="add-bot">+ Bot</button>' : '<span class="tag">vaga livre</span>'}</div>`;
      }
      const tag = s.host ? '👑 anfitrião' : s.bot ? '🤖 bot' : i === room.you ? 'você' : '&nbsp;';
      const kick = room.host && i !== room.you ? `<button class="x" data-act="kick" data-i="${i}" title="Remover">✕</button>` : '';
      return `<div class="seat" style="--c:${COLORS[s.color].hex}"><div class="av">${COLORS[s.color].av}</div><div class="nm">${esc(s.name)}</div><div class="tag">${tag}</div>${kick}</div>`;
    })
    .join('');
  const swatches = COLORS.map((c, i) => {
    const taken = room.seats.some((s, j) => s.color === i && j !== room.you);
    return `<button class="swatch ${me.color === i ? 'sel' : ''}" style="--c:${c.hex}" data-act="color" data-i="${i}" ${taken ? 'disabled' : ''}>${c.av}</button>`;
  }).join('');
  const start = room.host
    ? `<button class="btn big green" data-act="start" ${room.seats.length < 2 ? 'disabled' : ''}>Começar!</button>`
    : '<p>Aguardando o anfitrião começar…</p>';
  setHtml(
    'lobby',
    $('#lobby'),
    `<h2 class="lobby-title">Sala <span class="code">${room.code}</span></h2>
     <div class="row"><button class="btn small" data-act="copy">🔗 Copiar link de convite</button><button class="btn small" data-act="rules">❓ Como joga</button></div>
     <div class="seats">${seats}</div>
     <div class="trade-label" style="text-align:center">Escolha seu bicho</div>
     <div class="swatches">${swatches}</div>
     <div class="row">${start}</div>
     <div class="row"><button class="btn ghost small" data-act="leave">Sair da sala</button></div>`
  );
}

// ---------- partida ----------
function targets() {
  const t = { vertices: [], edges: [], tiles: [], kind: null };
  if (!G || G.turn !== G.me || G.phase === 'ended' || ui.pending) return t;
  const L = G.legal;
  if (G.sub === 'setupVillage') t.vertices = L.villages;
  else if (G.sub === 'setupRoad') t.edges = L.roads;
  else if (G.sub === 'catapult') t.tiles = L.tiles;
  else if (G.sub === 'action') {
    if (G.freeRoads > 0 || ui.mode === 'road') t.edges = L.roads;
    else if (ui.mode === 'village') t.vertices = L.villages;
    else if (ui.mode === 'castle') {
      t.vertices = L.castles;
      t.kind = 'castle';
    }
  }
  return t;
}

function onPick(kind, id) {
  if (!G || G.turn !== G.me) return;
  sfx.click();
  if (kind === 'vertex') {
    if (G.sub === 'setupVillage') act({ type: 'placeVillage', v: id });
    else if (ui.mode === 'castle') act({ type: 'buildCastle', v: id });
    else act({ type: 'buildVillage', v: id });
  } else if (kind === 'edge') {
    if (G.sub === 'setupRoad') act({ type: 'placeRoad', e: id });
    else act({ type: 'buildRoad', e: id });
  } else if (kind === 'tile') {
    act({ type: 'moveCatapult', tile: id });
  }
  ui.mode = null;
  ui.pending = true; // esconde os alvos até o servidor responder
  boardView.update(G, targets(), hexOf);
}

function render() {
  renderPlayers();
  renderBanner();
  renderHud();
  renderSide();
  renderDice();
  renderOffer();
  renderModal();
  boardView.update(G, targets(), hexOf);
}

function renderPlayers() {
  const html = G.players
    .map((p, i) => {
      const badges =
        (G.awards.road === i ? '<span class="badge">🛤️ Maior Trilha</span>' : '') +
        (G.awards.army === i ? '<span class="badge">🎯 Rei da Catapulta</span>' : '');
      const cls = ['pl', i === G.turn && G.phase !== 'ended' ? 'active' : '', p.connected ? '' : 'off'].join(' ');
      const tag = i === G.me ? ' <small>(você)</small>' : p.bot ? ' <small>🤖</small>' : p.connected ? '' : ' <small>💤</small>';
      return `<div class="${cls}" id="pl-${i}" style="--c:${COLORS[p.color].hex}">
        <div class="pl-av">${COLORS[p.color].av}</div>
        <div class="pl-info">
          <div class="pl-name">${esc(p.name)}${tag}</div>
          <div class="pl-stats"><span title="Recursos na mão">✋ ${p.handCount}</span><span title="Cartas de trapaça">🃏 ${p.cardCount}</span><span title="Catapulteiros usados">🎯 ${p.knights}</span><span title="Maior trilha contínua">🛤️ ${p.roadLen}</span></div>
        </div>
        <div class="pl-vp" title="Pontos">${p.vpTotal ?? p.vp}</div>
        ${badges ? `<div class="pl-badges">${badges}</div>` : ''}
      </div>`;
    })
    .join('');
  setHtml('players', $('#players'), html);
}

function bannerText() {
  const mine = G.turn === G.me;
  const name = esc(G.players[G.turn].name);
  if (G.phase === 'ended') return ['Fim de jogo!', false];
  if (G.discard[G.me]) return [`Descarte ${G.discard[G.me]} cartas!`, true];
  if (G.sub === 'discard') return ['Aguardando os descartes…', false];
  if (mine) {
    const t = {
      setupVillage: 'Escolha onde fundar sua vila',
      setupRoad: 'Agora abra uma trilha',
      roll: 'Sua vez! Role os dados 🎲',
      catapult: 'Mire a catapulta num terreno!',
      steal: 'Escolha de quem roubar',
    }[G.sub];
    if (t) return [t, true];
    if (G.freeRoads > 0) return [`Mutirão: ${G.freeRoads} trilha${G.freeRoads > 1 ? 's' : ''} grátis`, true];
    if (ui.mode === 'road') return ['Escolha onde abrir a trilha', true];
    if (ui.mode === 'village') return ['Escolha onde fundar a vila', true];
    if (ui.mode === 'castle') return ['Escolha a vila que vira castelo', true];
    return ['Construa, troque ou passe a vez', false];
  }
  const t = {
    setupVillage: `${name} está escolhendo um cantinho…`,
    setupRoad: `${name} está escolhendo um cantinho…`,
    roll: `Vez de ${name}`,
    catapult: `${name} está mirando a catapulta…`,
    steal: `${name} vai roubar alguém…`,
    action: `${name} está aprontando…`,
  }[G.sub];
  return [t || '', false];
}

function renderBanner() {
  const [text, hot] = bannerText();
  const el = $('#banner');
  if (setHtml('banner', el, text)) el.classList.toggle('mine', hot);
  else el.classList.toggle('mine', hot);
}

function playable(type) {
  const me = G.players[G.me];
  if (type === 'vp' || G.turn !== G.me || G.phase !== 'main' || G.cardPlayed) return false;
  if (!me.cards.some((c) => c.type === type && !c.fresh)) return false;
  return type === 'knight' ? G.sub === 'roll' || G.sub === 'action' : G.sub === 'action';
}

function renderHud() {
  const me = G.players[G.me];
  const acting = G.turn === G.me && G.phase === 'main' && G.sub === 'action';
  const hand = RES.map((r) => {
    const n = me.hand[r];
    const bump = prevHand && n > prevHand[r] ? ' bump' : '';
    return `<div class="card ${r}${n ? '' : ' zero'}${bump}" title="${RES_NAME[r]}">${ico(r, 'l')}<span class="n">${n}</span></div>`;
  }).join('');
  prevHand = { ...me.hand };

  const counts = {};
  for (const c of me.cards) counts[c.type] = (counts[c.type] || 0) + 1;
  const tricks = Object.keys(CARDS)
    .filter((t) => counts[t])
    .map((t) => {
      const c = CARDS[t];
      if (t === 'vp') return `<span class="trick vp" title="${c.desc}">${c.icon} ${c.name} <span class="n" style="color:#fff">${counts[t]}</span></span>`;
      return `<button class="trick" data-act="card" data-card="${t}" title="${c.desc}" ${playable(t) ? '' : 'disabled'}>${c.icon} ${c.name} <span class="n">${counts[t]}</span></button>`;
    })
    .join('');

  let actions;
  if (G.phase === 'ended') {
    actions = '<button class="btn yellow" data-act="show-end">🏆 Resultado</button>';
  } else {
    const L = G.legal;
    const free = G.freeRoads > 0;
    const b = (mode, label, cost, ok) =>
      `<button class="btn act-btn${ui.mode === mode ? ' on' : ''}" data-act="mode" data-mode="${mode}" ${ok ? '' : 'disabled'}>${label}${costIcons(cost)}</button>`;
    actions =
      b('road', 'Trilha', COSTS.road, acting && !free && G.can.road && L.roads.length) +
      b('village', 'Vila', COSTS.village, acting && !free && G.can.village && L.villages.length) +
      b('castle', 'Castelo', COSTS.castle, acting && !free && G.can.castle && L.castles.length) +
      `<button class="btn act-btn" data-act="buy" ${acting && G.can.card ? '' : 'disabled'}>Trapaça${costIcons(COSTS.card)}</button>` +
      `<button class="btn act-btn blue" data-act="trade" ${acting ? '' : 'disabled'}>Trocar<span class="cost">🤝</span></button>` +
      `<button class="btn act-btn pink" data-act="end" ${acting ? '' : 'disabled'}>Passar<span class="cost">⏭️</span></button>`;
  }

  setHtml(
    'hud',
    $('#hud'),
    `<div class="hand">${hand}</div>
     <div class="tricks"><span class="me-vp" title="Seus pontos (com os secretos)">⭐ ${me.vpTotal ?? me.vp}/10</span>${tricks}</div>
     <div class="actions">${actions}</div>`
  );
}

function renderSide() {
  $('#room-chip').textContent = room ? room.code : '';
  setHtml(
    'bank',
    $('#bank'),
    RES.map((r) => `<span title="${RES_NAME[r]} no banco">${ico(r)}${G.bank[r]}</span>`).join('') +
      `<span title="Cartas de trapaça restantes"><span style="font-size:18px;line-height:22px">🃏</span>${G.deckCount}</span>`
  );
  const last = G.log.length ? G.log[G.log.length - 1].id : 0;
  if (last !== lastLogId) {
    lastLogId = last;
    const el = $('#log');
    el.innerHTML = G.log
      .map((l) => `<div class="log-line" ${l.p !== null && G.players[l.p] ? `style="--c:${hexOf(l.p)}"` : ''}>${esc(l.t)}</div>`)
      .join('');
    el.scrollTop = el.scrollHeight;
  }
}

function renderDice() {
  const el = $('#dice');
  const can = G.turn === G.me && G.phase === 'main' && G.sub === 'roll';
  el.classList.toggle('can', can && !el.classList.contains('rolling'));
  if (!$('#die-a').children.length) setDice(G.dice || [3, 4]);
}

function renderOffer() {
  let html = '';
  const t = G.trade;
  if (t && t.from !== G.me && G.phase === 'main') {
    const mine = G.players[G.me].hand;
    const resp = t.responses[G.me];
    const can = RES.every((r) => mine[r] >= t.get[r]);
    const body = resp
      ? `<div>${resp === 'yes' ? '✅ Você topou! Aguardando…' : '❌ Você recusou.'}</div>`
      : `<div class="row"><button class="btn small green" data-act="trade-yes" ${can ? '' : 'disabled'}>Topo!</button><button class="btn small pink" data-act="trade-no">Nem pensar</button></div>`;
    html = `<div class="offer-card"><div class="offer-line"><b>${avOf(t.from)} ${esc(G.players[t.from].name)}</b> dá ${resSet(t.give)} por ${resSet(t.get)}</div>${body}</div>`;
  }
  setHtml('offer', $('#offer'), html);
}

// ---------- modais ----------
function modal(kind, inner) {
  return `<div class="modal" data-kind="${kind}">${inner}</div>`;
}

function stepper(side, r, val, max, sub) {
  return `<div class="stepper ${val ? 'has' : ''}">${ico(r, 'l')}<div class="cnt">${val}</div><div class="sub">${sub}</div>
    <div class="pm"><button data-act="step" data-side="${side}" data-res="${r}" data-d="-1" ${val <= 0 ? 'disabled' : ''}>−</button><button data-act="step" data-side="${side}" data-res="${r}" data-d="1" ${val >= max ? 'disabled' : ''}>+</button></div></div>`;
}

function discardModal() {
  const need = G.discard[G.me];
  const hand = G.players[G.me].hand;
  const n = sum(ui.discard);
  return modal(
    'discard',
    `<div class="crown">💥</div><h2>Saiu 7! Descarte ${need} cartas</h2>
     <p>Quem tem mais de 7 cartas perde metade.</p>
     <div class="steppers">${RES.map((r) => stepper('discard', r, ui.discard[r], n >= need ? ui.discard[r] : hand[r], `tem ${hand[r]}`)).join('')}</div>
     <div class="row"><button class="btn yellow" data-act="discard-ok" ${n === need ? '' : 'disabled'}>Descartar (${n}/${need})</button></div>`
  );
}

function stealModal() {
  return modal(
    'steal',
    `<div class="crown">🫳</div><h2>Roubar de quem?</h2>
     <div class="pick-row">${G.stealFrom
       .map((i) => `<button class="pick" data-act="steal" data-i="${i}" style="background:${hexOf(i)}"><span style="font-size:36px">${avOf(i)}</span><b>${esc(G.players[i].name)}</b>✋ ${G.players[i].handCount}</button>`)
       .join('')}</div>`
  );
}

function tradeModal() {
  const me = G.players[G.me];
  const t = G.trade;
  if (t && t.from === G.me) {
    const rows = G.players
      .map((p, i) => {
        if (i === G.me) return '';
        const r = t.responses[i];
        const st =
          r === 'yes'
            ? `<button class="btn small green" data-act="trade-confirm" data-i="${i}">Fechar negócio</button>`
            : r === 'no'
              ? '<span>❌ recusou</span>'
              : '<span>🤔 pensando…</span>';
        return `<div class="resp" style="--c:${hexOf(i)}"><span>${avOf(i)} ${esc(p.name)}</span>${st}</div>`;
      })
      .join('');
    return modal(
      'offer',
      `<h2>Sua oferta</h2>
       <div class="offer-line" style="justify-content:center">${resSet(t.give)} ➜ ${resSet(t.get)}</div>
       ${rows}
       <div class="row"><button class="btn small pink" data-act="trade-cancel">Cancelar oferta</button><button class="btn small ghost" data-act="close">Esconder</button></div>`
    );
  }
  let credits = 0;
  let exact = true;
  for (const r of RES) {
    if (!ui.give[r]) continue;
    if (ui.give[r] % G.ratios[r]) exact = false;
    credits += ui.give[r] / G.ratios[r];
  }
  const nGet = sum(ui.get);
  const bankOk = exact && credits > 0 && credits === nGet && RES.every((r) => G.bank[r] >= ui.get[r]);
  const offerOk = sum(ui.give) > 0 && nGet > 0 && G.players.length > 1;
  return modal(
    'trade',
    `<h2>Trocar</h2>
     <div class="trade-label">Você dá</div>
     <div class="steppers">${RES.map((r) => stepper('give', r, ui.give[r], me.hand[r], `tem ${me.hand[r]} · ${G.ratios[r]}:1`)).join('')}</div>
     <div class="trade-label">Você recebe</div>
     <div class="steppers">${RES.map((r) => stepper('get', r, ui.get[r], 9, RES_NAME[r])).join('')}</div>
     <div class="row">
       <button class="btn green" data-act="trade-bank" ${bankOk ? '' : 'disabled'}>🏦 Banco</button>
       <button class="btn blue" data-act="trade-offer" ${offerOk ? '' : 'disabled'}>📣 Oferecer a todos</button>
       <button class="btn ghost small" data-act="close">Fechar</button>
     </div>
     <p class="hint">Banco: a taxa (4:1, 3:1 ou 2:1) aparece em cada recurso e melhora com portos.</p>`
  );
}

function cardModal() {
  const c = CARDS[ui.card];
  if (!c || !playable(ui.card)) {
    ui.modal = null;
    return '';
  }
  const head = `<div class="crown">${c.icon}</div><h2>${c.name}</h2><p>${c.desc}</p>`;
  const cancel = '<button class="btn ghost small" data-act="close">Agora não</button>';
  if (ui.card === 'plenty') {
    const picked = ui.plenty.map((r) => ico(r)).join('') || '—';
    return modal(
      'card',
      `${head}<p>Escolhidos: ${picked}</p>
       <div class="pick-row">${RES.map((r) => `<button class="pick" data-act="plenty-pick" data-res="${r}" ${G.bank[r] > 0 ? '' : 'disabled'}>${ico(r, 'l')}${RES_NAME[r]}</button>`).join('')}</div>
       <div class="row">${cancel}</div>`
    );
  }
  if (ui.card === 'monopoly') {
    return modal(
      'card',
      `${head}<div class="pick-row">${RES.map((r) => `<button class="pick" data-act="mono-pick" data-res="${r}">${ico(r, 'l')}${RES_NAME[r]}</button>`).join('')}</div><div class="row">${cancel}</div>`
    );
  }
  return modal('card', `${head}<div class="row"><button class="btn yellow" data-act="card-play">Usar agora!</button>${cancel}</div>`);
}

function rulesModal() {
  const line = (label, cost, what) => `<div class="line"><b>${label}</b>${costIcons(cost)}<span>${what}</span></div>`;
  return modal(
    'rules',
    `<h2>Como joga</h2>
     <div class="rules">
       <div>Quem fizer <b>10 pontos</b> primeiro, na própria vez, vence. Role os dados: os terrenos com aquele número rendem recursos para quem mora nas pontas.</div>
       ${line('Trilha', COSTS.road, 'liga suas construções')}
       ${line('Vila', COSTS.village, '1 ponto · rende 1')}
       ${line('Castelo', COSTS.castle, '2 pontos · rende 2')}
       ${line('Trapaça', COSTS.card, 'carta surpresa')}
       <div>💥 <b>Saiu 7:</b> quem tem mais de 7 cartas descarta metade; você mira a <b>catapulta</b> num terreno (ele para de render) e rouba uma carta de um vizinho.</div>
       <div>🛤️ <b>Maior Trilha</b> (5+) e 🎯 <b>Rei da Catapulta</b> (3+ Catapulteiros) valem 2 pontos cada.</div>
       <div>⚓ <b>Portos</b> melhoram a troca com o banco (3:1 ou 2:1).</div>
       ${Object.values(CARDS).map((c) => `<div class="line"><b>${c.icon} ${c.name}</b><span>${c.desc}</span></div>`).join('')}
     </div>
     <div class="row"><button class="btn yellow" data-act="close">Entendi!</button></div>`
  );
}

function endModal() {
  const rank = G.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.vp - a.p.vp || (a.i === G.winner ? -1 : 1));
  const w = G.players[G.winner];
  return modal(
    'end',
    `<div class="crown">${COLORS[w.color].av}</div>
     <h2>${G.winner === G.me ? 'Você venceu! 🎉' : `${esc(w.name)} venceu!`}</h2>
     <div class="podium">${rank
       .map(({ p, i }, k) => `<div class="resp" style="--c:${hexOf(i)}"><span>${['🥇', '🥈', '🥉', '🧀'][k]} ${COLORS[p.color].av} ${esc(p.name)}</span><b>${p.vp} pts</b></div>`)
       .join('')}</div>
     <div class="row">
       ${room && room.host ? '<button class="btn big green" data-act="again">Jogar de novo</button>' : '<p>Aguardando o anfitrião…</p>'}
     </div>
     <div class="row"><button class="btn small" data-act="hide-end">Ver tabuleiro</button><button class="btn small ghost" data-act="leave">Sair</button></div>`
  );
}

function renderModal() {
  let html = '';
  if (G.phase === 'ended') html = ui.hideEnd ? '' : endModal();
  else if (G.discard[G.me]) html = discardModal();
  else if (G.turn === G.me && G.sub === 'steal') html = stealModal();
  else if (ui.modal === 'trade') {
    if (G.turn === G.me && G.sub === 'action') html = tradeModal();
    else ui.modal = null;
  } else if (ui.modal === 'card') html = cardModal();
  else if (ui.modal === 'rules') html = rulesModal();
  const root = $('#modal-root');
  const kind = html ? html.match(/data-kind="(\w+)"/)[1] : null;
  if (setHtml('modal', root, html) && kind && kind === ui.lastModal) {
    root.firstElementChild.style.animation = 'none';
  }
  ui.lastModal = kind;
}

// ---------- cliques ----------
const rerender = () => renderScreen();

const UI = {
  create() {
    if (!readName()) return;
    connect(null);
  },
  join() {
    if (!readName()) return;
    const code = $('#in-code').value.trim().toUpperCase();
    if (code.length !== 4) return toast('O código da sala tem 4 letras', 'err');
    connect(code);
  },
  copy() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('sala', room.code);
    if (saved.key) u.searchParams.set('chave', saved.key);
    const done = () => toast('Link copiado! Mande para a galera 📨');
    if (navigator.clipboard) navigator.clipboard.writeText(u.href).then(done, () => toast(esc(u.href)));
    else toast(esc(u.href));
  },
  color: (el) => sendMsg({ t: 'color', color: Number(el.dataset.i) }),
  'add-bot': () => sendMsg({ t: 'addBot' }),
  kick: (el) => sendMsg({ t: 'kick', i: Number(el.dataset.i) }),
  start: () => sendMsg({ t: 'start' }),
  leave() {
    sendMsg({ t: 'leave' });
    goHome();
  },
  again: () => sendMsg({ t: 'again' }),
  mute() {
    setMuted(!isMuted());
    $('#btn-mute').textContent = isMuted() ? '🔇' : '🔊';
  },
  rules() {
    ui.modal = ui.modal === 'rules' ? null : 'rules';
    rerender();
  },
  'toggle-log': () => $('#side').classList.toggle('open'),
  roll() {
    if (G && G.turn === G.me && G.sub === 'roll') act({ type: 'roll' });
  },
  mode(el) {
    ui.mode = ui.mode === el.dataset.mode ? null : el.dataset.mode;
    rerender();
  },
  buy: () => act({ type: 'buyCard' }),
  trade() {
    ui.modal = 'trade';
    ui.mode = null;
    rerender();
  },
  end() {
    ui.mode = null;
    act({ type: 'endTurn' });
  },
  card(el) {
    ui.modal = 'card';
    ui.card = el.dataset.card;
    ui.plenty = [];
    rerender();
  },
  'card-play'() {
    act({ type: 'playCard', card: ui.card });
    ui.modal = null;
    rerender();
  },
  'plenty-pick'(el) {
    ui.plenty.push(el.dataset.res);
    if (ui.plenty.length >= 2) {
      act({ type: 'playCard', card: 'plenty', res: ui.plenty });
      ui.modal = null;
    }
    rerender();
  },
  'mono-pick'(el) {
    act({ type: 'playCard', card: 'monopoly', res: el.dataset.res });
    ui.modal = null;
    rerender();
  },
  step(el) {
    const { side, res } = el.dataset;
    const d = Number(el.dataset.d);
    ui[side][res] = Math.max(0, ui[side][res] + d);
    if (d > 0 && side === 'give') ui.get[res] = 0;
    if (d > 0 && side === 'get') ui.give[res] = 0;
    rerender();
  },
  'discard-ok': () => act({ type: 'discard', res: ui.discard }),
  steal: (el) => act({ type: 'steal', target: Number(el.dataset.i) }),
  'trade-bank': () => act({ type: 'bankTrade', give: ui.give, get: ui.get }),
  'trade-offer': () => act({ type: 'offerTrade', give: ui.give, get: ui.get }),
  'trade-cancel': () => act({ type: 'cancelTrade' }),
  'trade-confirm': (el) => act({ type: 'confirmTrade', with: Number(el.dataset.i) }),
  'trade-yes': () => act({ type: 'respondTrade', accept: true }),
  'trade-no': () => act({ type: 'respondTrade', accept: false }),
  close() {
    ui.modal = null;
    rerender();
  },
  emote: (el) => sendMsg({ t: 'emote', e: el.dataset.e }),
  'show-end'() {
    ui.hideEnd = false;
    rerender();
  },
  'hide-end'() {
    ui.hideEnd = true;
    rerender();
  },
};

function readName() {
  const name = $('#in-name').value.trim();
  if (!name) {
    toast('Diz seu nome primeiro!', 'err');
    $('#in-name').focus();
    return false;
  }
  const keyEl = $('#in-key');
  if (keyEl) saved.key = keyEl.value.trim();
  saved.name = name;
  save();
  return true;
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const h = UI[el.dataset.act];
  if (!h) return;
  if (el.dataset.act !== 'emote') sfx.click();
  h(el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && (ui.modal || ui.mode)) {
    ui.modal = null;
    ui.mode = null;
    rerender();
  }
  if (e.key === 'Enter' && !room) {
    if (document.activeElement === $('#in-code') || $('#in-code').value.trim()) UI.join();
    else UI.create();
  }
});

$('#room-chip').addEventListener('click', () => UI.copy());

// ---------- início ----------
$('#emotes').innerHTML = EMOTES.map((e) => `<button data-act="emote" data-e="${e}">${e}</button>`).join('');
$('#btn-mute').textContent = isMuted() ? '🔇' : '🔊';
const urlKey = (params.get('chave') || '').trim();
if (urlKey) {
  saved.key = urlKey;
  save();
}
$('#in-name').value = saved.name || '';
if ($('#in-key')) $('#in-key').value = saved.key || '';
setDice([3, 4]);
const urlCode = (params.get('sala') || '').toUpperCase();
if (urlCode) $('#in-code').value = urlCode;
if (urlCode && saved.name && saved.token && saved.code === urlCode) connect(urlCode);
