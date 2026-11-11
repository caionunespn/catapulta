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
  if (USE_FIREBASE) {
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
        const box = $('#field-key');
        if (box) box.open = true;
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
  const to = boardView.tileScreen(e.tile);
  await flyBoulder(centerOf($(`#pl-${e.p} .pl-av`)), to);
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
    case 'steal':
      bubble($(`#pl-${e.from}`), '😱');
      if (e.res && e.to === G.me) toast(`Você roubou ${ico(e.res)} de ${name(e.from)}`);
      else if (e.res) toast(`${name(e.to)} roubou ${ico(e.res)} de você`, 'err');
      break;
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
      const st = room.seats[i];
      if (!st) {
        return `<div class="seat empty">${room.host ? '<button class="btn small" data-act="add-bot">+ Bot</button>' : '<span class="tag">vaga livre</span>'}</div>`;
      }
      const tag = st.host ? `${ico('crown', 's')}anfitrião` : st.bot ? `${ico('bot', 's')}bot` : i === room.you ? 'você' : '';
      const kick = room.host && i !== room.you ? `<button class="x" data-act="kick" data-i="${i}" title="Remover" aria-label="Remover ${esc(st.name)}">${ico('close')}</button>` : '';
      return `<div class="seat" style="--c:${COLORS[st.color].hex}"><div class="seat-av">${avatar(st.color)}</div><div class="nm">${esc(st.name)}</div><div class="tag">${tag}</div>${kick}</div>`;
    })
    .join('');
  const swatches = COLORS.map((c, i) => {
    const taken = room.seats.some((st, j) => st.color === i && j !== room.you);
    return `<button class="swatch ${me.color === i ? 'sel' : ''}" data-act="color" data-i="${i}" title="${c.name}" aria-label="${c.name}" ${taken ? 'disabled' : ''}>${avatar(i)}</button>`;
  }).join('');
  const start = room.host
    ? `<button class="btn big yellow" data-act="start" ${room.seats.length < 2 ? 'disabled' : ''}>Começar a partida</button>`
    : '<p>Aguardando o anfitrião começar…</p>';
  const need = room.host && room.seats.length < 2 ? '<p>Chame alguém ou adicione um bot para começar.</p>' : '';
  setHtml(
    'lobby',
    $('#lobby'),
    `<h2 class="lobby-title">Sala<span class="code">${room.code}</span></h2>
     <div class="row"><button class="btn small" data-act="copy">${ico('link', 's')}Copiar convite</button><button class="btn small ghost" data-act="rules">Como joga</button></div>
     <div class="seats">${seats}</div>
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
  boardView.update(G, targets(), colorOf);
}

function render() {
  renderPlayers();
  renderBanner();
  renderHud();
  renderSide();
  renderDice();
  renderOffer();
  renderModal();
  boardView.update(G, targets(), colorOf);
}

function renderPlayers() {
  const html = G.players
    .map((p, i) => {
      const badges =
        (G.awards.road === i ? `<span class="badge">${ico('road')}Maior Trilha</span>` : '') +
        (G.awards.army === i ? `<span class="badge">${ico('aim')}Rei da Catapulta</span>` : '');
      const vp = p.vpTotal ?? p.vp;
      const bump = prevVp[i] !== undefined && vp > prevVp[i] ? ' bump' : '';
      prevVp[i] = vp;
      const cls = ['pl', i === G.turn && G.phase !== 'ended' ? 'active' : '', p.connected ? '' : 'off'].join(' ');
      const tag = i === G.me ? ' <small>você</small>' : p.bot ? ico('bot') : p.connected ? '' : ico('sleep');
      return `<div class="${cls}" id="pl-${i}" style="--c:${COLORS[p.color].hex}">
        <div class="pl-av">${avatar(p.color)}<span class="pl-lamp"></span></div>
        <div class="pl-info">
          <div class="pl-name">${esc(p.name)}${tag}</div>
          <div class="pl-stats"><span class="st-vp" title="Pontos">${ico('star')}${vp}</span><span title="Recursos na mão">${ico('hand')}${p.handCount}</span><span title="Cartas de trapaça">${ico('trick')}${p.cardCount}</span><span title="Catapulteiros usados">${ico('aim')}${p.knights}</span><span title="Maior trilha contínua">${ico('road')}${p.roadLen}</span></div>
        </div>
        <div class="pl-vp${bump}" title="Pontos"><b>${vp}</b><i>/10</i></div>
        ${badges ? `<div class="pl-badges">${badges}</div>` : ''}
      </div>`;
    })
    .join('');
  setHtml('players', $('#players'), html);
}

function bannerText() {
  const mine = G.turn === G.me;
  const name = esc(G.players[G.turn].name);
  if (G.phase === 'ended') return ['Fim de jogo', false];
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
      return `<button class="trick" data-act="card" data-card="${t}" title="${c.desc}" ${playable(t) ? '' : 'disabled'}>${ico(c.icon)}${c.name}<span class="n">${counts[t]}</span></button>`;
    })
    .join('');

  let builds = '';
  let primary;
  if (G.phase === 'ended') {
    primary = `<button class="btn primary yellow" data-act="show-end">${ico('medal')}Resultado</button>`;
  } else {
    const L = G.legal;
    const free = G.freeRoads > 0;
    const b = (mode, label, icon, cost, ok) =>
      `<button class="btn act-btn${ui.mode === mode ? ' on' : ''}" data-act="mode" data-mode="${mode}" ${ok ? '' : 'disabled'}>${icon}<span>${label}</span>${costIcons(cost, me.hand)}</button>`;
    builds =
      b('road', 'Trilha', ico('road', 'l'), COSTS.road, acting && !free && G.can.road && L.roads.length) +
      b('village', 'Vila', tinted('village', 'l', myHex), COSTS.village, acting && !free && G.can.village && L.villages.length) +
      b('castle', 'Castelo', tinted('castle', 'l', myHex), COSTS.castle, acting && !free && G.can.castle && L.castles.length) +
      `<button class="btn act-btn" data-act="buy" ${acting && G.can.card ? '' : 'disabled'}>${ico('trick', 'l')}<span>Trapaça</span>${costIcons(COSTS.card, me.hand)}</button>` +
      `<button class="btn act-btn" data-act="trade" ${acting ? '' : 'disabled'}>${ico('trade', 'l')}<span>Trocar</span><span class="cost"></span></button>`;
    if (myTurn && G.phase === 'main' && G.sub === 'roll') {
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
     <div class="tricks"><span class="me-vp" title="Seus pontos (com os secretos)">${ico('star')}${me.vpTotal ?? me.vp}<small>/10</small></span>${tricks}</div>
     <div class="actions">${builds ? `<div class="builds">${builds}</div>` : ''}${primary}</div>`
  );
}

function renderSide() {
  setHtml('chip', $('#room-chip'), room ? `${room.code}${ico('link')}` : '');
  setHtml(
    'bank',
    $('#bank'),
    RES.map((r) => `<span title="${RES_NAME[r]} no banco">${ico(r)}${G.bank[r]}</span>`).join('') +
      `<span title="Cartas de trapaça restantes">${ico('trick')}${G.deckCount}</span>`
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
    const body = resp
      ? `<div class="offer-note">${resp === 'yes' ? `${ico('check')}Você topou. Aguardando…` : `${ico('nope')}Você recusou.`}</div>`
      : `<div class="row"><button class="btn small green" data-act="trade-yes" ${can ? '' : 'disabled'}>${can ? 'Topo!' : 'Não tenho'}</button><button class="btn small red" data-act="trade-no">Nem pensar</button></div>`;
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
  return modal(
    'discard',
    `${art('c-knight')}<h2>Saiu 7! Descarte ${need} cartas</h2>
     <p>Quem tem mais de 7 cartas perde metade.</p>
     <div class="steppers">${RES.map((r) => stepper('discard', r, ui.discard[r], n >= need ? ui.discard[r] : hand[r], `tem ${hand[r]}`)).join('')}</div>
     <div class="row"><button class="btn yellow" data-act="discard-ok" ${n === need ? '' : 'disabled'}>Descartar ${n} de ${need}</button></div>`
  );
}

function stealModal() {
  return modal(
    'steal',
    `<h2>Roubar de quem?</h2>
     <div class="pick-row">${G.stealFrom
       .map((i) => `<button class="pick" data-act="steal" data-i="${i}">${avOf(i)}<b>${esc(G.players[i].name)}</b><small>${ico('hand', 's')}${G.players[i].handCount}</small></button>`)
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
       <div class="row"><button class="btn small red" data-act="trade-cancel">Cancelar oferta</button><button class="btn small ghost" data-act="close">Esconder</button></div>`
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
       <button class="btn green" data-act="trade-bank" ${bankOk ? '' : 'disabled'}>${ico('stall')}Banco</button>
       <button class="btn yellow" data-act="trade-offer" ${offerOk ? '' : 'disabled'}>${ico('trade')}Oferecer a todos</button>
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
  return modal('card', `${head}<div class="row"><button class="btn yellow" data-act="card-play">Usar agora</button>${cancel}</div>`);
}

function rulesModal() {
  const myHex = G ? hexOf(G.me) : COLORS[0].hex;
  const line = (icon, label, cost, what) => `<div class="line">${icon}<b>${label}</b>${costIcons(cost)}<span>${what}</span></div>`;
  const note = (icon, text) => `<div class="note">${ico(icon)}<span>${text}</span></div>`;
  return modal(
    'rules',
    `<h2>Como joga</h2>
     <div class="rules">
       <div>Vence quem fizer <b>10 pontos</b> primeiro, na própria vez. A cada rolada, os terrenos com aquele número rendem recursos para quem mora nas pontas.</div>
       ${line(ico('road'), 'Trilha', COSTS.road, 'liga suas construções')}
       ${line(tinted('village', '', myHex), 'Vila', COSTS.village, '1 ponto, rende 1')}
       ${line(tinted('castle', '', myHex), 'Castelo', COSTS.castle, '2 pontos, rende 2')}
       ${line(ico('trick'), 'Trapaça', COSTS.card, 'carta surpresa')}
       ${note('c-knight', '<b>Saiu 7:</b> quem tem mais de 7 cartas descarta metade. Você mira a <b>catapulta</b> num terreno, que para de render, e rouba uma carta de um vizinho.')}
       ${note('crown', '<b>Maior Trilha</b> (5 ou mais) e <b>Rei da Catapulta</b> (3 ou mais Catapulteiros) valem 2 pontos cada.')}
       ${note('stall', '<b>Portos</b> melhoram a troca com o banco: 3:1 ou 2:1 em vez de 4:1.')}
       ${Object.values(CARDS).map((c) => `<div class="line wide">${ico(c.icon)}<b>${c.name}</b><span>${c.desc}</span></div>`).join('')}
     </div>
     <div class="row"><button class="btn yellow" data-act="close">Entendi</button>${G ? '<button class="btn ghost small" data-act="leave">Sair da partida</button>' : ''}</div>`
  );
}

function endModal() {
  const rank = G.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.vp - a.p.vp || (a.i === G.winner ? -1 : 1));
  const w = G.players[G.winner];
  return modal(
    'end',
    `<div class="winner-av">${avatar(w.color)}</div>
     <h2>${G.winner === G.me ? 'Você venceu!' : `${esc(w.name)} venceu!`}</h2>
     <div class="podium">${rank
       .map(({ p, i }, k) => `<div class="resp"><span class="who-cell">${k + 1}º ${avOf(i)}${esc(p.name)}</span><b>${p.vp} pts</b></div>`)
       .join('')}</div>
     <div class="row">
       ${room && room.host ? '<button class="btn big yellow" data-act="again">Jogar de novo</button>' : '<p>Aguardando o anfitrião…</p>'}
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
    const done = () => toast('Link copiado. Mande para a galera!');
    if (navigator.clipboard) navigator.clipboard.writeText(u.href).then(done, () => toast(esc(u.href)));
    else toast(esc(u.href));
  },
  color: (el) => sendMsg({ t: 'color', color: Number(el.dataset.i) }),
  'add-bot': () => sendMsg({ t: 'addBot' }),
  kick: (el) => sendMsg({ t: 'kick', i: Number(el.dataset.i) }),
  start: () => sendMsg({ t: 'start' }),
  leave() {
    if (G && G.phase !== 'ended') {
      const warn = room && room.host && USE_FIREBASE ? 'Você é o anfitrião: sair encerra a sala para todo mundo. Sair mesmo assim?' : 'Sair da partida? Um bot assume o seu lugar.';
      if (!confirm(warn)) return;
    }
    sendMsg({ t: 'leave' });
    goHome();
  },
  again: () => sendMsg({ t: 'again' }),
  mute() {
    setMuted(!isMuted());
    $('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
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
  emote(el) {
    sendMsg({ t: 'emote', e: el.dataset.e });
    $('#react').classList.remove('open');
  },
  'toggle-react': () => $('#react').classList.toggle('open'),
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
document.querySelectorAll('.garland').forEach(buildGarland);
$('#cast').innerHTML = COLORS.map((c, i) => `<span style="--i:${i}" title="${c.name}">${avatar(i)}</span>`).join('');
$('#emotes').innerHTML = EMOTES.map((e) => `<button data-act="emote" data-e="${e}">${e}</button>`).join('');
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
document.querySelector('#corner [data-act="rules"]').innerHTML = ico('help');
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
