import { BoardView } from './board.js';
import { COLORS, avatar, ico, installSprite } from './art.js';
import { sfx, flyIcon, flyBoulder, shake, bubble, burst, confetti, toast, isMuted, setMuted } from './fx.js';
import { connectFirebase, isFirebaseConfigured } from './net-firebase.js';

installSprite();

// ---------- constantes ----------
const RES = ['wood', 'stone', 'cheese', 'pumpkin', 'crystal'];
const RES_NAME = { wood: 'Madeira', stone: 'Pedra', cheese: 'Queijo', pumpkin: 'Abóbora', crystal: 'Cristal' };
const COSTS = {
  road: { wood: 1, stone: 1 },
  village: { wood: 1, stone: 1, cheese: 1, pumpkin: 1 },
  castle: { pumpkin: 2, crystal: 3 },
  card: { cheese: 1, pumpkin: 1, crystal: 1 },
};
const CARDS = {
  knight: { name: 'Catapulteiro', icon: 'c-knight', desc: 'Mire a catapulta em outro terreno e roube uma carta de quem mora ali. Pode usar antes de rolar.' },
  vp: { name: 'Banquete', icon: 'c-vp', desc: 'Vale 1 ponto secreto.' },
  roads: { name: 'Mutirão', icon: 'c-roads', desc: 'Abra 2 trilhas de graça.' },
  plenty: { name: 'Fartura', icon: 'c-plenty', desc: 'Pegue 2 recursos à sua escolha do banco.' },
  monopoly: { name: 'Arrastão', icon: 'c-monopoly', desc: 'Escolha um recurso: todo mundo te entrega tudo o que tem dele.' },
  gale: { name: 'Vendaval', icon: 'c-gale', desc: 'Cada jogador passa 1 carta aleatória para o próximo da roda.' },
};
const EMOTES = ['😂', '😭', '😡', '😎', '🙏', '🎉', '👀', '🧀'];
const BOT_LEVEL_NAMES = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' };

// ---------- utilidades ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const zero = () => ({ wood: 0, stone: 0, cheese: 0, pumpkin: 0, crystal: 0 });
const sum = (o) => RES.reduce((n, r) => n + (o[r] || 0), 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resSet = (o) =>
  `<span class="res-set">${RES.filter((r) => o[r]).map((r) => `<span class="res-pill">${ico(r, 's')}${o[r]}</span>`).join('')}</span>`;
// custo em ícones; com a mão informada, o que falta aparece apagado
const costIcons = (c, hand) =>
  `<span class="cost">${RES.flatMap((r) => Array.from({ length: c[r] || 0 }, (_, k) => ico(r, hand && hand[r] <= k ? 's miss' : 's'))).join('')}</span>`;
const colorOf = (p) => COLORS[G.players[p].color] || COLORS[0];
const hexOf = (p) => colorOf(p).hex;
const avOf = (p) => avatar(G.players[p].color);
const tinted = (name, cls, hex) => ico(name, cls).replace('<svg ', `<svg style="color:${hex}" `);

// ---------- estado ----------
const params = new URLSearchParams(location.search);
const KEY = 'catapulta' + (params.get('p') || '');
// No computador de desenvolvimento o servidor Node responde por WebSocket; publicado, o jogo usa o Firebase.
// Use ?fb=1 para forçar o Firebase em localhost.
const IS_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const USE_FIREBASE = isFirebaseConfigured() && (!IS_LOCAL || params.has('fb'));
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(KEY)) || {};
} catch {}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
};
const getBotLevel = () => (['easy', 'medium', 'hard'].includes(saved.botLevel) ? saved.botLevel : 'medium');

let ws = null;
let retry = null;
let room = null;
let G = null;
let epoch = 0;
const queue = [];
let busy = false;
let prevHand = null;
let prevVp = [];
let lastLogId = 0;
let pendingTimer = null;
const cache = {};
const ui = {
  connecting: null,
  lobbyBusy: null,
  busyAct: null,
  pending: false,
  mode: null,
  modal: null,
  rulesTab: 'rules',
  card: null,
  plenty: [],
  give: zero(),
  get: zero(),
  discard: zero(),
  hideEnd: false,
  lastModal: null,
};

function clearPending() {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  ui.pending = false;
  ui.busyAct = null;
  ui.lobbyBusy = null;
}

function armPendingTimer() {
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    if (ui.pending || ui.lobbyBusy) {
      clearPending();
      renderScreen();
    }
  }, 8000);
}

const boardView = new BoardView($('#board'), onPick, (cam) => {
  const rst = $('#btn-zoom-reset');
  if (rst) rst.classList.toggle('hidden', Math.abs(cam.z - 1) < 0.03 && Math.hypot(cam.x, cam.y + 2) < 8);
});

// ---------- rede ----------
let fbConn = null;

function connect(code) {
  clearTimeout(retry);
  ui.connecting = code ? 'join' : 'create';
  renderHome();
  if (fbConn) {
    fbConn.close();
    fbConn = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  if (USE_FIREBASE) {
    connectFirebase({ name: saved.name, code, key: saved.key, botLevel: getBotLevel() }, onMsg).then((conn) => {
      fbConn = conn;
      if (!conn) {
        ui.connecting = null;
        renderHome();
      }
    });
    return;
  }
  const sock = (ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`));
  sock.onopen = () =>
    sock.send(JSON.stringify({ t: 'hello', name: saved.name, token: saved.token, key: saved.key, code, botLevel: getBotLevel() }));
  sock.onmessage = (e) => onMsg(JSON.parse(e.data));
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (room) {
      toast('Conexão caiu. Reconectando…', 'err');
      retry = setTimeout(() => connect(room.code), 1500);
    } else {
      ui.connecting = null;
      renderHome();
      toast('Não consegui falar com o servidor', 'err');
    }
  };
}
const sendMsg = (m) => {
  if (fbConn) fbConn.send(m);
  else if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
};
const act = (a) => sendMsg({ t: 'act', a });
const sendAct = (a, tag = a.type) => {
  if (ui.pending) return;
  ui.pending = true;
  ui.busyAct = tag;
  armPendingTimer();
  renderScreen();
  act(a);
};

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
  prevHand = null;
  prevVp = [];
  lastLogId = 0;
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
  ui.connecting = null;
  clearPending();
  ui.mode = null;
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
      ui.connecting = null;
      ui.lobbyBusy = null;
      if (!m.inGame) {
        G = null;
        epoch++;
        queue.length = 0;
        prevHand = null;
        prevVp = [];
        lastLogId = 0;
        clearPending();
        ui.mode = null;
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
      ui.connecting = null;
      clearPending();
      if (m.needKey) {
        const box = $('#field-key');
        if (box) box.open = true;
        $('#in-key')?.focus();
      }
      if (m.fatal) goHome();
      else renderScreen();
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
  clearPending();
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
  $('#die-a').dataset.v = d[0];
  $('#die-b').dataset.v = d[1];
}

function showSum(n) {
  const el = $('#sum');
  el.textContent = n;
  el.classList.remove('show');
  el.classList.toggle('seven', n === 7);
  void el.offsetWidth;
  el.classList.add('show');
}

async function animateRoll(e) {
  const el = $('#dice');
  el.classList.remove('can', 'landed');
  void el.offsetWidth;
  el.classList.add('rolling');
  sfx.dice();
  const t0 = performance.now();
  while (performance.now() - t0 < 600) {
    setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    await sleep(90);
  }
  setDice(e.d);
  el.classList.remove('rolling');
  el.classList.add('landed');
  const total = e.d[0] + e.d[1];
  showSum(total);
  sfx.land(total === 7);
  if (total === 7) shake($('#stage'), 0.6);
  else boardView.flash(total, G ? G.catapult : -1);
  await sleep(total === 7 ? 700 : 430);
}

function centerOf(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function animateCatapult(e) {
  sfx.whoosh();
  const from = G && G.catapult != null && G.catapult !== e.tile ? boardView.tileScreen(G.catapult) : centerOf($(`#pl-${e.p} .pl-av`));
  const to = boardView.tileScreen(e.tile);
  await flyBoulder(from, to);
  sfx.boom();
  shake($('#stage'));
  burst(to, '#f6e8c8', 12);
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
      burst(boardView.pieceScreen(e.kind, e.at), hexOf(e.p), e.kind === 'road' ? 6 : 12);
      break;
    case 'steal': {
      bubble($(`#pl-${e.from}`), '😱');
      const catAt = G && G.catapult != null ? boardView.tileScreen(G.catapult) : centerOf($(`#pl-${e.from} .pl-av`));
      flyIcon(e.res || 'trick', catAt, centerOf($(`#pl-${e.to} .pl-av`)));
      sfx.gain(0);
      if (e.res && e.to === G.me) toast(`A catapulta lançou ${ico(e.res)} de ${name(e.from)} para você!`);
      else if (e.res) toast(`A catapulta lançou ${ico(e.res)} de você para ${name(e.to)}`, 'err');
      break;
    }
    case 'card':
      sfx.card();
      toast(`${avOf(e.p)} ${name(e.p)} usou ${ico(CARDS[e.card].icon)} ${CARDS[e.card].name}`, 'big');
      break;
    case 'buy':
      sfx.pop();
      if (e.card) toast(`Você comprou ${ico(CARDS[e.card].icon)} ${CARDS[e.card].name}`);
      break;
    case 'monopoly':
      toast(`${name(e.p)} levou ${e.n} ${ico(e.res)}`);
      break;
    case 'award':
      sfx.card();
      toast(`${ico('crown')} ${name(e.p)}: ${e.award === 'road' ? 'Maior Trilha' : 'Rei da Catapulta'}`, 'big');
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
  if (which === 'home') renderHome();
  if (which === 'lobby') renderLobby();
  if (which === 'game' && G) render();
  else setHtml('modal', $('#modal-root'), ui.modal === 'rules' ? rulesModal() : '');
}

function renderHome() {
  const c = ui.connecting;
  const btnCreate = $('#btn-create');
  const btnJoin = $('#btn-join');
  if (btnCreate) {
    btnCreate.disabled = Boolean(c);
    btnCreate.classList.toggle('loading', c === 'create');
    setHtml('btn-create', btnCreate, c === 'create' ? `${ico('spin', 's spin')}Criando sala…` : 'Criar sala');
  }
  if (btnJoin) {
    btnJoin.disabled = Boolean(c);
    btnJoin.classList.toggle('loading', c === 'join');
    setHtml('btn-join', btnJoin, c === 'join' ? `${ico('spin', 's spin')}Entrando…` : 'Entrar');
  }
  for (const sel of ['#in-name', '#in-code', '#in-key']) {
    const el = $(sel);
    if (el) el.disabled = Boolean(c);
  }
}

function setHtml(key, el, html) {
  if (cache[key] === html) return false;
  cache[key] = html;
  el.innerHTML = html;
  return true;
}

function renderLobby() {
  const me = room.seats[room.you];
  const curLevel = room.botLevel || getBotLevel();
  const lb = ui.lobbyBusy;
  let firstEmpty = true;
  const seats = [0, 1, 2, 3]
    .map((i) => {
      const st = room.seats[i];
      if (!st) {
        if (!room.host) return '<div class="seat empty"><span class="tag">vaga livre</span></div>';
        const isAddingHere = lb === 'add-bot' && firstEmpty;
        firstEmpty = false;
        const btn = isAddingHere
          ? `<button class="btn small loading" data-act="add-bot" disabled>${ico('spin', 's spin')}Adicionando…</button>`
          : `<button class="btn small" data-act="add-bot" ${lb ? 'disabled' : ''}>+ Bot</button>`;
        return `<div class="seat empty">${btn}</div>`;
      }
      const bLv = st.bot ? (BOT_LEVEL_NAMES[st.botLevel || curLevel] || 'Médio').toLowerCase() : '';
      const tag = st.host
        ? `${ico('crown', 's')}anfitrião`
        : st.bot
          ? `${ico('bot', 's')}bot · ${bLv}`
          : i === room.you
            ? 'você'
            : '';
      const kick =
        room.host && i !== room.you
          ? `<button class="x" data-act="kick" data-i="${i}" title="Remover" aria-label="Remover ${esc(st.name)}" ${lb ? 'disabled' : ''}>${ico('close')}</button>`
          : '';
      return `<div class="seat" style="--c:${COLORS[st.color].hex}"><div class="seat-av">${avatar(st.color)}</div><div class="nm">${esc(st.name)}</div><div class="tag">${tag}</div>${kick}</div>`;
    })
    .join('');
  const swatches = COLORS.map((c, i) => {
    const taken = room.seats.some((st, j) => st.color === i && j !== room.you);
    return `<button class="swatch ${me.color === i ? 'sel' : ''}" data-act="color" data-i="${i}" title="${c.name}" aria-label="${c.name}" ${taken || lb === 'start' ? 'disabled' : ''}>${avatar(i)}</button>`;
  }).join('');
  const botCtrl = room.host
    ? `<div class="bot-level-row"><span>${ico('bot', 's')}Nível dos bots</span><div class="seg-group compact" role="radiogroup" aria-label="Nível dos bots">${['easy', 'medium', 'hard']
        .map((lv) => `<button type="button" class="seg-btn ${curLevel === lv ? 'on' : ''}" data-act="bot-level" data-level="${lv}" ${lb === 'start' ? 'disabled' : ''}>${BOT_LEVEL_NAMES[lv]}</button>`)
        .join('')}</div></div>`
    : room.seats.some((s) => s.bot)
      ? `<div class="bot-level-row"><span class="tag">${ico('bot', 's')}Bots no nível <b>${BOT_LEVEL_NAMES[curLevel]}</b></span></div>`
      : '';
  const start = room.host
    ? lb === 'start'
      ? `<button class="btn big yellow loading" data-act="start" disabled>${ico('spin', 's spin')}Começando a partida…</button>`
      : `<button class="btn big yellow" data-act="start" ${room.seats.length < 2 || lb ? 'disabled' : ''}>Começar a partida</button>`
    : `<p>${ico('spin', 's spin')} Aguardando o anfitrião começar…</p>`;
  const need = room.host && room.seats.length < 2 ? '<p>Chame alguém ou adicione um bot para começar.</p>' : '';
  setHtml(
    'lobby',
    $('#lobby'),
    `<h2 class="lobby-title">Sala<span class="code">${room.code}</span></h2>
     <div class="row"><button class="btn small" data-act="copy">${ico('link', 's')}Copiar convite</button><button class="btn small ghost" data-act="rules">${ico('help', 's')}Como joga</button><button class="btn small ghost" data-act="about">${ico('info', 's')}Sobre e créditos</button></div>
     <div class="seats">${seats}</div>
     ${botCtrl}
     <div class="sub-title">Quem você vai ser?</div>
     <div class="swatches">${swatches}</div>
     <p class="who">Você é ${COLORS[me.color].name}</p>
     <div class="row">${start}</div>${need ? `<div class="row">${need}</div>` : ''}
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
  if (!G || G.turn !== G.me || ui.pending) return;
  sfx.click();
  const mode = ui.mode;
  ui.mode = null;
  ui.pending = true; // esconde os alvos até o servidor responder
  ui.busyAct = 'pick';
  armPendingTimer();
  render();
  if (kind === 'vertex') {
    if (G.sub === 'setupVillage') act({ type: 'placeVillage', v: id });
    else if (mode === 'castle') act({ type: 'buildCastle', v: id });
    else act({ type: 'buildVillage', v: id });
  } else if (kind === 'edge') {
    if (G.sub === 'setupRoad') act({ type: 'placeRoad', e: id });
    else act({ type: 'buildRoad', e: id });
  } else if (kind === 'tile') {
    act({ type: 'moveCatapult', tile: id });
  }
}

function render() {
  renderPlayers();
  renderRank();
  renderBanner();
  renderHud();
  renderSide();
  renderDice();
  renderOffer();
  renderModal();
  boardView.update(G, targets(), colorOf);
}

function renderPlayers() {
  const scores = G.players.map((p, idx) => (idx === G.me ? p.vpTotal ?? p.vp : p.vp));
  const maxVp = Math.max(...scores);
  const html = G.players
    .map((p, i) => {
      const vp = scores[i];
      const isLead = maxVp > 0 && vp === maxVp;
      const badges =
        (isLead ? `<span class="badge lead-badge">${ico('crown')}Na frente</span>` : '') +
        (G.awards.road === i ? `<span class="badge">${ico('road')}Maior Trilha</span>` : '') +
        (G.awards.army === i ? `<span class="badge">${ico('aim')}Rei da Catapulta</span>` : '');
      const bump = prevVp[i] !== undefined && vp > prevVp[i] ? ' bump' : '';
      prevVp[i] = vp;
      const cls = ['pl', i === G.turn && G.phase !== 'ended' ? 'active' : '', isLead ? 'leader' : '', p.connected ? '' : 'off'].join(' ');
      const botTag = p.bot ? `<span class="bot-tag" title="Bot (${BOT_LEVEL_NAMES[p.botLevel || 'medium']})">${ico('bot')}</span>` : '';
      const tag = i === G.me ? ' <small>você</small>' : p.bot ? botTag : p.connected ? '' : ico('sleep');
      return `<div class="${cls}" id="pl-${i}" style="--c:${COLORS[p.color].hex}">
        <div class="pl-av">${avatar(p.color)}<span class="pl-lamp"></span></div>
        <div class="pl-info">
          <div class="pl-name">${esc(p.name)}${tag}</div>
          <div class="pl-stats"><span class="st-vp" title="Pontos">${ico(isLead ? 'crown' : 'star')}${vp}</span><span title="Recursos na mão">${ico('hand')}${p.handCount}</span><span title="Cartas de trapaça">${ico('trick')}${p.cardCount}</span><span title="Catapulteiros usados">${ico('aim')}${p.knights}</span><span title="Maior trilha contínua">${ico('road')}${p.roadLen}</span></div>
        </div>
        <div class="pl-vp${bump}" title="Pontos"><b>${vp}</b><i>/10</i></div>
        ${badges ? `<div class="pl-badges">${badges}</div>` : ''}
      </div>`;
    })
    .join('');
  setHtml('players', $('#players'), html);
}

function renderRank() {
  const el = $('#rank');
  if (!el) return;
  const list = G.players
    .map((p, i) => ({ p, i, pts: i === G.me ? (p.vpTotal ?? p.vp) : p.vp }))
    .sort((a, b) => b.pts - a.pts || (b.p.roadLen || 0) - (a.p.roadLen || 0) || (b.p.knights || 0) - (a.p.knights || 0) || a.i - b.i);
  const topPts = list[0]?.pts || 0;
  const html = list
    .map(({ p, i, pts }, idx) => {
      const lead = topPts > 0 && pts === topPts;
      return `<div class="rk-chip${lead ? ' lead' : ''}" style="--c:${hexOf(i)}" title="${idx + 1}º ${esc(p.name)} — ${pts}/10 pts">
        <span class="rk-pos">${idx + 1}º</span>
        <span class="rk-av">${avOf(i)}</span>
      </div>`;
    })
    .join('');
  setHtml('rank', el, html);
}

function bannerText() {
  const mine = G.turn === G.me;
  const name = esc(G.players[G.turn].name);
  if (G.phase === 'ended') return ['Fim de jogo', false];
  if (ui.pending && ui.busyAct) {
    const bMsg = {
      roll: 'Rolando os dados…',
      end: 'Passando a vez…',
      buy: 'Comprando trapaça…',
      pick: 'Confirmando no tabuleiro…',
      card: 'Usando carta…',
      discard: 'Enviando descarte…',
    }[ui.busyAct];
    if (bMsg) return [`${ico('spin', 's spin')} ${bMsg}`, true];
  }
  if (G.discard[G.me]) return [`Descarte ${G.discard[G.me]} cartas`, true];
  if (G.sub === 'discard') return ['Aguardando os descartes…', false];
  if (mine) {
    const t = {
      setupVillage: 'Toque num ponto para fundar sua vila',
      setupRoad: 'Agora abra uma trilha saindo dela',
      roll: 'Sua vez! Role os dados',
      catapult: 'Mire a catapulta num terreno',
      steal: 'Escolha de quem roubar',
    }[G.sub];
    if (t) return [t, true];
    if (G.freeRoads > 0) return [`Mutirão: ${G.freeRoads} trilha${G.freeRoads > 1 ? 's' : ''} grátis`, true];
    if (ui.mode === 'road') return ['Toque onde abrir a trilha', true];
    if (ui.mode === 'village') return ['Toque onde fundar a vila', true];
    if (ui.mode === 'castle') return ['Toque na vila que vira castelo', true];
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
  const changed = setHtml('banner', el, text);
  el.classList.toggle('mine', hot);
  if (changed && hot) {
    el.classList.remove('swing');
    void el.offsetWidth;
    el.classList.add('swing');
  }
}

function playable(type) {
  const me = G.players[G.me];
  if (type === 'vp' || G.turn !== G.me || G.phase !== 'main' || G.cardPlayed) return false;
  if (!me.cards.some((c) => c.type === type && !c.fresh)) return false;
  return type === 'knight' ? G.sub === 'roll' || G.sub === 'action' : G.sub === 'action';
}

function renderHud() {
  const me = G.players[G.me];
  const myTurn = G.turn === G.me && G.phase !== 'ended';
  const acting = myTurn && G.phase === 'main' && G.sub === 'action';
  const myHex = hexOf(G.me);
  const hand = RES.map((r) => {
    const n = me.hand[r];
    const bump = prevHand && n > prevHand[r] ? ' bump' : '';
    return `<div class="card${n ? '' : ' zero'}${bump}" title="${RES_NAME[r]}">${ico(r, 'l')}<span class="n">${n}</span></div>`;
  }).join('');
  prevHand = { ...me.hand };

  const counts = {};
  for (const c of me.cards) counts[c.type] = (counts[c.type] || 0) + 1;
  const tricks = Object.keys(CARDS)
    .filter((t) => counts[t])
    .map((t) => {
      const c = CARDS[t];
      if (t === 'vp') return `<span class="trick vp" title="${c.desc}">${ico(c.icon)}${c.name}<span class="n">${counts[t]}</span></span>`;
      return `<button class="trick" data-act="card" data-card="${t}" title="${c.desc}" ${playable(t) && !ui.pending ? '' : 'disabled'}>${ico(c.icon)}${c.name}<span class="n">${counts[t]}</span></button>`;
    })
    .join('');

  let builds = '';
  let primary;
  if (G.phase === 'ended') {
    primary = `<button class="btn primary yellow" data-act="show-end">${ico('medal')}Resultado</button>`;
  } else {
    const L = G.legal;
    const free = G.freeRoads > 0;
    const canAct = acting && !ui.pending;
    const b = (mode, label, icon, cost, ok) =>
      `<button class="btn act-btn${ui.mode === mode ? ' on' : ''}" data-act="mode" data-mode="${mode}" ${ok ? '' : 'disabled'}>${icon}<span>${label}</span>${costIcons(cost, me.hand)}</button>`;
    const buyBtn =
      ui.busyAct === 'buy'
        ? `<button class="btn act-btn loading" data-act="buy" disabled>${ico('spin', 'l spin')}<span>Comprando…</span>${costIcons(COSTS.card, me.hand)}</button>`
        : `<button class="btn act-btn" data-act="buy" ${canAct && G.can.card ? '' : 'disabled'}>${ico('trick', 'l')}<span>Trapaça</span>${costIcons(COSTS.card, me.hand)}</button>`;
    builds =
      b('road', 'Trilha', ico('road', 'l'), COSTS.road, canAct && !free && G.can.road && L.roads.length) +
      b('village', 'Vila', tinted('village', 'l', myHex), COSTS.village, canAct && !free && G.can.village && L.villages.length) +
      b('castle', 'Castelo', tinted('castle', 'l', myHex), COSTS.castle, canAct && !free && G.can.castle && L.castles.length) +
      buyBtn +
      `<button class="btn act-btn" data-act="trade" ${canAct ? '' : 'disabled'}>${ico('trade', 'l')}<span>Trocar</span><span class="cost"></span></button>`;
    if (ui.busyAct === 'roll') {
      primary = `<button class="btn primary yellow loading" data-act="roll" disabled>${ico('spin', 's spin')}Rolando dados…</button>`;
    } else if (ui.busyAct === 'end') {
      primary = `<button class="btn primary red loading" data-act="end" disabled>${ico('spin', 's spin')}Passando a vez…</button>`;
    } else if (ui.pending) {
      primary = `<button class="btn primary idle loading" disabled>${ico('spin', 's spin')}Enviando…</button>`;
    } else if (myTurn && G.phase === 'main' && G.sub === 'roll') {
      primary = `<button class="btn primary yellow pulse" data-act="roll">${ico('dice')}Rolar dados</button>`;
    } else if (acting) {
      primary = `<button class="btn primary red" data-act="end">Passar a vez${ico('next')}</button>`;
    } else {
      const idle = G.discard[G.me]
        ? 'Descarte para continuar'
        : G.sub === 'discard'
          ? 'Aguardando descartes'
          : myTurn
            ? 'Escolha no tabuleiro'
            : `Vez de ${esc(G.players[G.turn].name)}`;
      primary = `<button class="btn primary idle" disabled>${idle}</button>`;
    }
  }

  $('#hud').classList.toggle('mine', myTurn);
  setHtml(
    'hud',
    $('#hud'),
    `<div class="hand">${hand}</div>
     <div class="tricks${tricks ? ' has-tricks' : ''}"><span class="me-vp" title="Seus pontos (com os secretos)">${ico('star')}${me.vpTotal ?? me.vp}<small>/10</small></span>${tricks}</div>
     <div class="actions">${builds ? `<div class="builds">${builds}</div>` : ''}${primary}</div>`
  );
}

function renderSide() {
  setHtml('chip', $('#room-chip'), room ? `${room.code}${ico('link')}` : '');
  const canTrade = G.turn === G.me && G.phase === 'main' && G.sub === 'action';
  setHtml(
    'bank',
    $('#bank'),
    `<div class="bank-head">
       <span class="bank-title">${ico('stall', 's')}Banco da Quermesse</span>
       ${canTrade ? `<button class="bank-btn" data-act="trade" title="Trocar com o banco ou jogadores">${ico('trade', 's')}Trocar</button>` : `<span class="bank-tag">Estoque</span>`}
     </div>
     <div class="bank-grid">
       ${RES.map((r) => `<div class="bank-item" title="${RES_NAME[r]} disponível no banco">${ico(r)}<b>${G.bank[r]}</b><small>${RES_NAME[r]}</small></div>`).join('')}
       <div class="bank-item trick-slot" title="Cartas de trapaça restantes no banco">${ico('trick')}<b>${G.deckCount}</b><small>trapaças</small></div>
     </div>`
  );
  const last = G.log.length ? G.log[G.log.length - 1].id : 0;
  if (last !== lastLogId) {
    lastLogId = last;
    const el = $('#log');
    el.innerHTML = G.log
      .map((l) => `<div class="log-line" ${l.p !== null && G.players[l.p] ? `style="--c:${hexOf(l.p)}"` : ''}><span>${esc(l.t)}</span></div>`)
      .join('');
    el.scrollTop = el.scrollHeight;
  }
}

function renderDice() {
  const el = $('#dice');
  const can = G.turn === G.me && G.phase === 'main' && G.sub === 'roll';
  el.classList.toggle('can', can && !el.classList.contains('rolling'));
  if (!$('#die-a').dataset.v) setDice(G.dice || [3, 4]);
}

function renderOffer() {
  let html = '';
  const t = G.trade;
  if (t && t.from !== G.me && G.phase === 'main') {
    const mine = G.players[G.me].hand;
    const resp = t.responses[G.me];
    const can = RES.every((r) => mine[r] >= t.get[r]);
    const yesLoad = ui.busyAct === 'trade-yes';
    const noLoad = ui.busyAct === 'trade-no';
    const body = resp
      ? `<div class="offer-note">${resp === 'yes' ? `${ico('check')}Você topou. Aguardando…` : `${ico('nope')}Você recusou.`}</div>`
      : `<div class="row"><button class="btn small green${yesLoad ? ' loading' : ''}" data-act="trade-yes" ${can && !ui.pending ? '' : 'disabled'}>${yesLoad ? `${ico('spin', 's spin')}Aceitando…` : can ? 'Topo!' : 'Não tenho'}</button><button class="btn small red${noLoad ? ' loading' : ''}" data-act="trade-no" ${!ui.pending ? '' : 'disabled'}>${noLoad ? `${ico('spin', 's spin')}Recusando…` : 'Nem pensar'}</button></div>`;
    html = `<div class="offer-card"><div class="offer-who">${avOf(t.from)}${esc(G.players[t.from].name)} propõe</div><div class="offer-line">dá ${resSet(t.give)} e quer ${resSet(t.get)}</div>${body}</div>`;
  }
  setHtml('offer', $('#offer'), html);
}

// ---------- modais ----------
function modal(kind, inner) {
  return `<div class="modal" data-kind="${kind}" role="dialog" aria-modal="true">${inner}</div>`;
}
const art = (name) => `<div class="modal-art">${ico(name)}</div>`;

function stepper(side, r, val, max, sub) {
  return `<div class="stepper ${val ? 'has' : ''}">${ico(r, 'l')}<div class="cnt">${val}</div><div class="sub">${sub}</div>
    <div class="pm"><button data-act="step" data-side="${side}" data-res="${r}" data-d="-1" aria-label="Menos ${RES_NAME[r]}" ${val <= 0 ? 'disabled' : ''}>−</button><button data-act="step" data-side="${side}" data-res="${r}" data-d="1" aria-label="Mais ${RES_NAME[r]}" ${val >= max ? 'disabled' : ''}>+</button></div></div>`;
}

function discardModal() {
  const need = G.discard[G.me];
  const hand = G.players[G.me].hand;
  const n = sum(ui.discard);
  const isLoad = ui.busyAct === 'discard';
  return modal(
    'discard',
    `${art('c-knight')}<h2>Saiu 7! Descarte ${need} cartas</h2>
     <p>Quem tem mais de 7 cartas perde metade.</p>
     <div class="steppers">${RES.map((r) => stepper('discard', r, ui.discard[r], n >= need ? ui.discard[r] : hand[r], `tem ${hand[r]}`)).join('')}</div>
     <div class="row"><button class="btn yellow${isLoad ? ' loading' : ''}" data-act="discard-ok" ${n === need && !ui.pending ? '' : 'disabled'}>${isLoad ? `${ico('spin', 's spin')}Descartando…` : `Descartar ${n} de ${need}`}</button></div>`
  );
}

function stealModal() {
  return modal(
    'steal',
    `<h2>Roubar de quem?</h2>
     <div class="pick-row">${G.stealFrom
       .map((i) => {
         const isLoad = ui.busyAct === `steal:${i}`;
         return `<button class="pick" data-act="steal" data-i="${i}" ${ui.pending ? 'disabled' : ''}>${avOf(i)}<b>${isLoad ? `${ico('spin', 's spin')}Roubando…` : esc(G.players[i].name)}</b><small>${ico('hand', 's')}${G.players[i].handCount}</small></button>`;
       })
       .join('')}</div>`
  );
}

function tradeModal() {
  const me = G.players[G.me];
  const t = G.trade;
  if (t && t.from === G.me) {
    const cancelLoad = ui.busyAct === 'trade-cancel';
    const rows = G.players
      .map((p, i) => {
        if (i === G.me) return '';
        const r = t.responses[i];
        const confLoad = ui.busyAct === `trade-confirm:${i}`;
        const st =
          r === 'yes'
            ? `<button class="btn small green${confLoad ? ' loading' : ''}" data-act="trade-confirm" data-i="${i}" ${ui.pending ? 'disabled' : ''}>${confLoad ? `${ico('spin', 's spin')}Fechando…` : 'Fechar negócio'}</button>`
            : r === 'no'
              ? `<span class="st">${ico('nope', 's')}recusou</span>`
              : `<span class="st">${ico('wait', 's')}pensando…</span>`;
        return `<div class="resp"><span class="who-cell">${avOf(i)}${esc(p.name)}</span>${st}</div>`;
      })
      .join('');
    return modal(
      'offer',
      `<h2>Sua oferta</h2>
       <div class="offer-line">${resSet(t.give)}<span class="arrow">por</span>${resSet(t.get)}</div>
       ${rows}
       <div class="row"><button class="btn small red${cancelLoad ? ' loading' : ''}" data-act="trade-cancel" ${ui.pending ? 'disabled' : ''}>${cancelLoad ? `${ico('spin', 's spin')}Cancelando…` : 'Cancelar oferta'}</button><button class="btn small ghost" data-act="close">Esconder</button></div>`
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
  const nGive = sum(ui.give);
  const bankOk = exact && credits > 0 && credits === nGet && RES.every((r) => G.bank[r] >= ui.get[r]);
  const offerOk = nGive > 0 && nGet > 0 && G.players.length > 1;
  const bankLoad = ui.busyAct === 'trade-bank';
  const offerLoad = ui.busyAct === 'trade-offer';
  const tip = !nGive
    ? 'Escolha o que você dá e o que quer receber.'
    : bankOk
      ? 'O banco aceita essa troca.'
      : !nGet
        ? 'Agora escolha o que quer receber.'
        : 'Para o banco, dê múltiplos da taxa de cada recurso.';
  return modal(
    'trade',
    `<h2>Trocar</h2>
     <div class="trade-label">Você dá</div>
     <div class="steppers">${RES.map((r) => stepper('give', r, ui.give[r], me.hand[r], `tem ${me.hand[r]} · ${G.ratios[r]}:1`)).join('')}</div>
     <div class="trade-label">Você recebe</div>
     <div class="steppers">${RES.map((r) => stepper('get', r, ui.get[r], 9, RES_NAME[r])).join('')}</div>
     <p class="hint">${tip}</p>
     <div class="row">
       <button class="btn green${bankLoad ? ' loading' : ''}" data-act="trade-bank" ${bankOk && !ui.pending ? '' : 'disabled'}>${bankLoad ? `${ico('spin', 's spin')}Trocando…` : `${ico('stall')}Banco`}</button>
       <button class="btn yellow${offerLoad ? ' loading' : ''}" data-act="trade-offer" ${offerOk && !ui.pending ? '' : 'disabled'}>${offerLoad ? `${ico('spin', 's spin')}Enviando…` : `${ico('trade')}Oferecer a todos`}</button>
       <button class="btn ghost small" data-act="close">Fechar</button>
     </div>`
  );
}

function cardModal() {
  const c = CARDS[ui.card];
  if (!c || !playable(ui.card)) {
    ui.modal = null;
    return '';
  }
  const head = `${art(c.icon)}<h2>${c.name}</h2><p>${c.desc}</p>`;
  const cancel = '<button class="btn ghost small" data-act="close">Agora não</button>';
  if (ui.card === 'plenty') {
    const picked = ui.plenty.map((r) => ico(r)).join('') || 'nenhum ainda';
    return modal(
      'card',
      `${head}<p>Escolhidos: ${picked}</p>
       <div class="pick-row">${RES.map((r) => `<button class="pick" data-act="plenty-pick" data-res="${r}" ${G.bank[r] > 0 && !ui.pending ? '' : 'disabled'}>${ico(r, 'l')}${RES_NAME[r]}</button>`).join('')}</div>
       <div class="row">${cancel}</div>`
    );
  }
  if (ui.card === 'monopoly') {
    return modal(
      'card',
      `${head}<div class="pick-row">${RES.map((r) => `<button class="pick" data-act="mono-pick" data-res="${r}" ${!ui.pending ? '' : 'disabled'}>${ico(r, 'l')}${RES_NAME[r]}</button>`).join('')}</div><div class="row">${cancel}</div>`
    );
  }
  const playLoad = ui.busyAct === 'card';
  return modal(
    'card',
    `${head}<div class="row"><button class="btn yellow${playLoad ? ' loading' : ''}" data-act="card-play" ${!ui.pending ? '' : 'disabled'}>${playLoad ? `${ico('spin', 's spin')}Usando…` : 'Usar agora'}</button>${cancel}</div>`
  );
}

function rulesModal() {
  const tab = ui.rulesTab === 'about' ? 'about' : 'rules';
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
             <p>Programador que claramente não sabe ouvir um "duvido" quieto. Em vez de só responder no grupo, preferiu passar o fim de semana fazendo um jogo inteiro do zero.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('bolt', 's')}Por que esse jogo existe?</span>
             <p>Eu fiz esse projeto <b>porque o Iuri duvidou que eu era muito poderoso</b>. Como discutir no gogó dá pouco trabalho, achei mais justo programar o tabuleiro, desenhar as peças, treinar os bots e botar uma catapulta pra tacar pedra nos amigos.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro, sem engine pronta nem biblioteca pesada.</span></div></div>
           <div class="spec-card">${ico('c-knight', 'l')}<div><b>Som e desenho caseiros</b><span>Arte em SVG e efeitos sonoros sintetizados na hora pelo navegador.</span></div></div>
           <div class="spec-card wide">${ico('crown', 'l')}<div><b>Agradecimento especial</b><span>Ao <b>Iuri</b>: se ele tivesse acreditado logo de cara, ninguém estaria tomando pedrada de catapulta agora.</span></div></div>
         </div>
       </div>
       <div class="row"><button class="btn yellow" data-act="close">Fechar</button>${G ? '<button class="btn ghost small" data-act="leave">Sair da partida</button>' : ''}</div>`
    );
  }
  const myHex = G ? hexOf(G.me) : COLORS[0].hex;
  const bCard = (icon, label, pts, cost, desc) =>
    `<div class="build-card"><div class="bc-head">${icon}<div class="bc-title"><b>${label}</b>${pts ? `<span class="bc-pts">${pts}</span>` : ''}</div></div>${costIcons(cost)}<small>${desc}</small></div>`;
  return modal(
    'rules',
    `${tabs}
     <h2>Como joga</h2>
     <div class="rules-guide">
       <div class="rules-goal">
         ${ico('crown', 'l')}
         <div>
           <b>Objetivo: fazer 10 pontos primeiro!</b>
           <span>No começo, cada um funda <b>2 vilas e 2 trilhas</b> de graça. Depois, quem alcançar 10 pontos na própria vez vence na hora.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. O seu turno em 3 passos</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('dice', 'l')}
           <b>Role os dados</b>
           <small>A soma sorteia os terrenos que produzem recursos para todos que têm vila (+1) ou castelo (+2) ali.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('trade', 'l')}
           <b>Negocie</b>
           <small>Troque cartas com os outros jogadores ou direto no banco (4:1 normal, ou 3:1 e 2:1 se tiver porto).</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${tinted('castle', 'l', myHex)}
           <b>Construa</b>
           <small>Use seus recursos para abrir trilhas, erguer vilas, castelos ou comprar e jogar 1 trapaça por turno.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. O que construir e quanto custa</h3>
       <div class="rules-builds">
         ${bCard(ico('road', 'l'), 'Trilha', '', COSTS.road, 'Abre caminho para fundar novas vilas.')}
         ${bCard(tinted('village', 'l', myHex), 'Vila', '+1 pt', COSTS.village, 'Colhe 1 recurso de cada terreno vizinho.')}
         ${bCard(tinted('castle', 'l', myHex), 'Castelo', '+2 pts', COSTS.castle, 'Melhora uma vila sua e colhe 2 recursos.')}
         ${bCard(ico('trick', 'l'), 'Trapaça', 'Surpresa', COSTS.card, 'Compra 1 carta secreta do baralho.')}
       </div>

       <h3 class="rules-sec">3. O número 7 e as medalhas</h3>
       <div class="rules-specials">
         <div class="spec-card">
           ${ico('c-knight', 'l')}
           <div>
             <b>Saiu 7: hora da Catapulta!</b>
             <span>Quem tiver mais de 7 cartas na mão descarta metade. Você move a <b>Catapulta</b> para bloquear um terreno e ela arremessa 1 carta de quem mora lá para você.</span>
           </div>
         </div>
         <div class="spec-card">
           ${ico('crown', 'l')}
           <div>
             <b>Medalhas de +2 pontos</b>
             <span><b>Maior Trilha</b> (5+ trilhas seguidas) e <b>Rei da Catapulta</b> (3+ Catapulteiros usados) valem <b>+2 pontos</b> cada, mas podem mudar de dono!</span>
           </div>
         </div>
       </div>

       <h3 class="rules-sec">4. Cartas de trapaça</h3>
       <div class="rules-tricks">
         ${Object.values(CARDS)
           .map((c) => `<div class="trick-card">${ico(c.icon)}<div><b>${c.name}</b><span>${c.desc}</span></div></div>`)
           .join('')}
       </div>
     </div>
     <div class="row"><button class="btn yellow" data-act="close">Entendi, bora jogar!</button>${G ? '<button class="btn ghost small" data-act="leave">Sair da partida</button>' : ''}</div>`
  );
}

function endModal() {
  const rank = G.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.vp - a.p.vp || (a.i === G.winner ? -1 : 1));
  const w = G.players[G.winner];
  const againLoad = ui.busyAct === 'again';
  return modal(
    'end',
    `<div class="winner-av">${avatar(w.color)}</div>
     <h2>${G.winner === G.me ? 'Você venceu!' : `${esc(w.name)} venceu!`}</h2>
     <div class="podium">${rank
       .map(({ p, i }, k) => `<div class="resp"><span class="who-cell">${k + 1}º ${avOf(i)}${esc(p.name)}</span><b>${p.vp} pts</b></div>`)
       .join('')}</div>
     <div class="row">
       ${
         room && room.host
           ? `<button class="btn big yellow${againLoad ? ' loading' : ''}" data-act="again" ${againLoad ? 'disabled' : ''}>${againLoad ? `${ico('spin', 's spin')}Preparando…` : 'Jogar de novo'}</button>`
           : `<p>${ico('spin', 's spin')} Aguardando o anfitrião…</p>`
       }
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
    if (ui.connecting || !readName()) return;
    connect(null);
  },
  join() {
    if (ui.connecting || !readName()) return;
    const code = $('#in-code').value.trim().toUpperCase();
    if (code.length !== 4) return toast('O código da sala tem 4 letras', 'err');
    connect(code);
  },
  copy() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('sala', room.code);
    if (saved.key) u.searchParams.set('chave', saved.key);
    const done = () => toast('Link copiado. Mande para a galera!');
    if (navigator.clipboard) navigator.clipboard.writeText(u.href).then(done, () => toast(esc(u.href)));
    else toast(esc(u.href));
  },
  color(el) {
    if (ui.lobbyBusy) return;
    sendMsg({ t: 'color', color: Number(el.dataset.i) });
  },
  'bot-level'(el) {
    const lv = el.dataset.level;
    if (!['easy', 'medium', 'hard'].includes(lv)) return;
    saved.botLevel = lv;
    save();
    if (room && room.host && !room.inGame) {
      room.botLevel = lv;
      sendMsg({ t: 'botLevel', level: lv });
      rerender();
    }
  },
  'add-bot'() {
    if (ui.lobbyBusy) return;
    ui.lobbyBusy = 'add-bot';
    armPendingTimer();
    rerender();
    sendMsg({ t: 'addBot', botLevel: room?.botLevel || getBotLevel() });
  },
  kick(el) {
    if (ui.lobbyBusy) return;
    ui.lobbyBusy = 'kick';
    armPendingTimer();
    rerender();
    sendMsg({ t: 'kick', i: Number(el.dataset.i) });
  },
  start() {
    if (ui.lobbyBusy) return;
    ui.lobbyBusy = 'start';
    armPendingTimer();
    rerender();
    sendMsg({ t: 'start' });
  },
  leave() {
    if (G && G.phase !== 'ended') {
      const warn = room && room.host && USE_FIREBASE ? 'Você é o anfitrião: sair encerra a sala para todo mundo. Sair mesmo assim?' : 'Sair da partida? Um bot assume o seu lugar.';
      if (!confirm(warn)) return;
    }
    sendMsg({ t: 'leave' });
    goHome();
  },
  again() {
    if (ui.pending) return;
    ui.pending = true;
    ui.busyAct = 'again';
    armPendingTimer();
    rerender();
    sendMsg({ t: 'again' });
  },
  mute() {
    setMuted(!isMuted());
    $('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
  },
  rules() {
    if (ui.modal === 'rules' && ui.rulesTab === 'rules') ui.modal = null;
    else {
      ui.rulesTab = 'rules';
      ui.modal = 'rules';
    }
    rerender();
  },
  about() {
    if (ui.modal === 'rules' && ui.rulesTab === 'about') ui.modal = null;
    else {
      ui.rulesTab = 'about';
      ui.modal = 'rules';
    }
    rerender();
  },
  'rules-tab'(el) {
    ui.rulesTab = el.dataset.tab === 'about' ? 'about' : 'rules';
    ui.modal = 'rules';
    rerender();
  },
  'toggle-log': () => $('#side').classList.toggle('open'),
  roll() {
    if (ui.pending || busy) return;
    if (G && G.turn === G.me && G.sub === 'roll') {
      sendAct({ type: 'roll' }, 'roll');
    }
  },
  mode(el) {
    if (ui.pending) return;
    ui.mode = ui.mode === el.dataset.mode ? null : el.dataset.mode;
    rerender();
  },
  buy: () => sendAct({ type: 'buyCard' }, 'buy'),
  trade() {
    if (ui.pending) return;
    ui.modal = 'trade';
    ui.mode = null;
    rerender();
  },
  end() {
    if (ui.pending || busy) return;
    ui.mode = null;
    sendAct({ type: 'endTurn' }, 'end');
  },
  card(el) {
    if (ui.pending) return;
    ui.modal = 'card';
    ui.card = el.dataset.card;
    ui.plenty = [];
    rerender();
  },
  'card-play'() {
    if (ui.pending) return;
    ui.modal = null;
    sendAct({ type: 'playCard', card: ui.card }, 'card');
  },
  'plenty-pick'(el) {
    if (ui.pending) return;
    ui.plenty.push(el.dataset.res);
    if (ui.plenty.length >= 2) {
      ui.modal = null;
      sendAct({ type: 'playCard', card: 'plenty', res: ui.plenty }, 'card');
    } else {
      rerender();
    }
  },
  'mono-pick'(el) {
    if (ui.pending) return;
    ui.modal = null;
    sendAct({ type: 'playCard', card: 'monopoly', res: el.dataset.res }, 'card');
  },
  step(el) {
    if (ui.pending) return;
    const { side, res } = el.dataset;
    const d = Number(el.dataset.d);
    ui[side][res] = Math.max(0, ui[side][res] + d);
    if (d > 0 && side === 'give') ui.get[res] = 0;
    if (d > 0 && side === 'get') ui.give[res] = 0;
    rerender();
  },
  'discard-ok': () => sendAct({ type: 'discard', res: ui.discard }, 'discard'),
  steal: (el) => sendAct({ type: 'steal', target: Number(el.dataset.i) }, `steal:${el.dataset.i}`),
  'trade-bank': () => sendAct({ type: 'bankTrade', give: ui.give, get: ui.get }, 'trade-bank'),
  'trade-offer': () => sendAct({ type: 'offerTrade', give: ui.give, get: ui.get }, 'trade-offer'),
  'trade-cancel': () => sendAct({ type: 'cancelTrade' }, 'trade-cancel'),
  'trade-confirm': (el) => sendAct({ type: 'confirmTrade', with: Number(el.dataset.i) }, `trade-confirm:${el.dataset.i}`),
  'trade-yes': () => sendAct({ type: 'respondTrade', accept: true }, 'trade-yes'),
  'trade-no': () => sendAct({ type: 'respondTrade', accept: false }, 'trade-no'),
  close() {
    ui.modal = null;
    rerender();
  },
  emote(el) {
    sendMsg({ t: 'emote', e: el.dataset.e });
    $('#react').classList.remove('open');
  },
  'toggle-react': () => $('#react').classList.toggle('open'),
  'zoom-in': () => boardView.zoomBy(1.22),
  'zoom-out': () => boardView.zoomBy(1 / 1.22),
  'zoom-reset': () => boardView.resetCam(),
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
  if (!e.target.closest('#react')) $('#react').classList.remove('open');
  if (e.target === $('#modal-root') && ui.modal) {
    ui.modal = null;
    rerender();
    return;
  }
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
function buildGarland(el) {
  const colors = ['#f7b733', '#e5482f', '#1fae96', '#f6e8c8', '#3d7be0'];
  const total = Number(el.dataset.bulbs) || 20;
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
      // balãozinho/lanterna de quermesse subindo suave
      svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${cx},${cy}) scale(${s})"><path d="M0-10 L8 0 L0 10 L-8 0 Z" fill="${col}" opacity=".22"/><circle cx="0" cy="0" r="3.2" fill="#fff8ea" opacity=".35"/></g></g>`;
    } else {
      // estrelinha / vagalume de luz quente
      svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${cx},${cy}) scale(${s})"><path d="M0-7 Q0 0 7 0 Q0 0 0 7 Q0 0 -7 0 Q0 0 0-7 Z" fill="${col}" opacity=".28"/></g></g>`;
    }
  });
  svg += '</svg>';
  el.innerHTML = svg;
}
document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);
$('#cast').innerHTML = COLORS.map((c, i) => `<span style="--i:${i}" title="${c.name}"><div class="cast-bob" style="--i:${i}">${avatar(i)}</div></span>`).join('');
$('#emotes').innerHTML = EMOTES.map((e) => `<button data-act="emote" data-e="${e}">${e}</button>`).join('');
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
document.querySelector('#corner [data-act="rules"]').innerHTML = ico('help');
if ($('#btn-home-rules')) $('#btn-home-rules').innerHTML = `${ico('help', 's')}Como joga`;
if ($('#btn-home-about')) $('#btn-home-about').innerHTML = `${ico('info', 's')}Sobre e créditos`;
$('#btn-log').innerHTML = ico('log');
$('#btn-log-close').innerHTML = ico('close');
$('#btn-react').innerHTML = ico('smile');
const urlKey = (params.get('chave') || '').trim();
if (urlKey) {
  saved.key = urlKey;
  save();
}
$('#in-name').value = saved.name || '';
if ($('#in-key')) $('#in-key').value = saved.key || '';
if (saved.key) $('#field-key').open = true;
setDice([3, 4]);
const urlCode = (params.get('sala') || '').toUpperCase();
if (urlCode) $('#in-code').value = urlCode;
if (urlCode && saved.name && saved.token && saved.code === urlCode) connect(urlCode);
