// Motor de regras (autoritativo). Estado mutável + act(state, jogador, ação).
import { RES, TERRAIN_RES, makeBoard, shuffle } from './board.js';

export const WIN_POINTS = 10;

export const COSTS = {
  road: { wood: 1, stone: 1 },
  village: { wood: 1, stone: 1, cheese: 1, pumpkin: 1 },
  castle: { pumpkin: 2, crystal: 3 },
  card: { cheese: 1, pumpkin: 1, crystal: 1 },
};

export const RES_NAMES = { wood: 'madeira', stone: 'pedra', cheese: 'queijo', pumpkin: 'abóbora', crystal: 'cristal' };
export const CARD_NAMES = {
  knight: 'Catapulteiro',
  vp: 'Banquete',
  roads: 'Mutirão',
  plenty: 'Fartura',
  monopoly: 'Arrastão',
  gale: 'Vendaval',
};

const rep = (v, n) => Array(n).fill(v);
const zero = () => ({ wood: 0, stone: 0, cheese: 0, pumpkin: 0, crystal: 0 });
export const handCount = (h) => RES.reduce((n, r) => n + h[r], 0);
const resText = (o) =>
  RES.filter((r) => o[r] > 0)
    .map((r) => `${o[r]} ${RES_NAMES[r]}`)
    .join(', ');

export function createGame(infos, rnd = Math.random) {
  const board = makeBoard(rnd);
  const n = infos.length;
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i >= 0; i--) order.push(i);
  const s = {
    board,
    players: infos.map((p) => ({
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      bot: !!p.bot,
      connected: true,
      hand: zero(),
      cards: [],
      knights: 0,
      roadsLeft: 15,
      villagesLeft: 5,
      castlesLeft: 4,
      roadLen: 0,
      ports: [],
    })),
    buildings: {},
    roads: {},
    catapult: board.tiles.find((t) => t.terrain === 'swamp').id,
    bank: { wood: 19, stone: 19, cheese: 19, pumpkin: 19, crystal: 19 },
    deck: shuffle(
      [...rep('knight', 12), ...rep('vp', 4), ...rep('roads', 2), ...rep('plenty', 2), ...rep('monopoly', 2), ...rep('gale', 2)],
      rnd
    ),
    phase: 'setup',
    sub: 'setupVillage',
    turn: 0,
    setupOrder: order,
    setupStep: 0,
    lastVillage: null,
    turnNumber: 0,
    dice: null,
    discard: {},
    stealFrom: [],
    freeRoads: 0,
    cardPlayed: false,
    afterCatapult: 'action',
    trade: null,
    tradeSeq: 0,
    awards: { road: null, army: null },
    winner: null,
    log: [],
    logSeq: 0,
    events: [],
    rnd,
  };
  log(s, null, 'A partida começou! Cada um coloca 2 vilas e 2 trilhas.');
  return s;
}

function log(s, p, t) {
  s.log.push({ id: ++s.logSeq, p, t });
  if (s.log.length > 60) s.log.shift();
}
const ev = (s, e) => s.events.push(e);
const nm = (s, p) => s.players[p].name;

// ---------- consultas ----------

export function canAfford(pl, cost) {
  return RES.every((r) => pl.hand[r] >= (cost[r] || 0));
}

export function tradeRatio(s, p, res) {
  const ports = s.players[p].ports;
  if (ports.includes(res)) return 2;
  if (ports.includes('any')) return 3;
  return 4;
}

function vertexFree(s, v) {
  if (s.buildings[v]) return false;
  return s.board.vertices[v].adj.every((u) => !s.buildings[u]);
}

export function legalVillages(s, p, setup = false) {
  const out = [];
  for (const v of s.board.vertices) {
    if (!vertexFree(s, v.id)) continue;
    if (setup || v.edges.some((e) => s.roads[e] === p)) out.push(v.id);
  }
  return out;
}

export function legalRoads(s, p) {
  const out = [];
  for (const e of s.board.edges) {
    if (s.roads[e.id] !== undefined) continue;
    const ok = [e.a, e.b].some((v) => {
      const b = s.buildings[v];
      if (b) return b.p === p;
      return s.board.vertices[v].edges.some((x) => s.roads[x] === p);
    });
    if (ok) out.push(e.id);
  }
  return out;
}

export function legalSetupRoads(s) {
  if (s.lastVillage === null) return [];
  return s.board.vertices[s.lastVillage].edges.filter((e) => s.roads[e] === undefined);
}

export function ownVillages(s, p) {
  return Object.keys(s.buildings)
    .map(Number)
    .filter((v) => s.buildings[v].p === p && s.buildings[v].kind === 'village');
}

export function publicVP(s, p) {
  const pl = s.players[p];
  return 5 - pl.villagesLeft + 2 * (4 - pl.castlesLeft) + (s.awards.road === p ? 2 : 0) + (s.awards.army === p ? 2 : 0);
}

export function totalVP(s, p) {
  return publicVP(s, p) + s.players[p].cards.filter((c) => c.type === 'vp').length;
}

export function longestRoad(s, p) {
  const { vertices, edges } = s.board;
  const used = new Set();
  let best = 0;
  const blocked = (v) => s.buildings[v] && s.buildings[v].p !== p;
  const dfs = (v, len, start) => {
    if (len > best) best = len;
    if (!start && blocked(v)) return;
    for (const e of vertices[v].edges) {
      if (s.roads[e] !== p || used.has(e)) continue;
      used.add(e);
      dfs(edges[e].a === v ? edges[e].b : edges[e].a, len + 1, false);
      used.delete(e);
    }
  };
  for (const v of vertices) {
    if (v.edges.some((e) => s.roads[e] === p)) dfs(v.id, 0, true);
  }
  return best;
}

export function pendingActors(s) {
  if (s.phase === 'ended') return [];
  const out = [];
  if (s.trade) {
    s.players.forEach((_, i) => {
      if (i !== s.trade.from && s.trade.responses[i] === undefined) out.push(i);
    });
  }
  if (s.sub === 'discard') out.push(...Object.keys(s.discard).map(Number));
  else out.push(s.turn);
  return out;
}

// ---------- utilidades de mutação ----------

function pay(s, p, cost) {
  for (const r of RES) {
    const n = cost[r] || 0;
    s.players[p].hand[r] -= n;
    s.bank[r] += n;
  }
}

function cleanRes(o) {
  const out = zero();
  if (o && typeof o === 'object') {
    for (const r of RES) {
      const n = Math.floor(Number(o[r]) || 0);
      out[r] = Math.max(0, Math.min(19, n));
    }
  }
  return out;
}

function updateLongest(s) {
  s.players.forEach((pl, i) => (pl.roadLen = longestRoad(s, i)));
  const lens = s.players.map((pl) => pl.roadLen);
  const max = Math.max(...lens);
  const cur = s.awards.road;
  let next;
  if (max < 5) next = null;
  else if (cur !== null && lens[cur] === max) next = cur;
  else {
    const top = lens.map((l, i) => (l === max ? i : -1)).filter((i) => i >= 0);
    next = top.length === 1 ? top[0] : null;
  }
  if (next !== cur) {
    s.awards.road = next;
    if (next !== null) {
      log(s, next, `${nm(s, next)} conquistou a Maior Trilha! (+2 pontos)`);
      ev(s, { type: 'award', award: 'road', p: next });
    }
  }
}

function updateArmy(s, p) {
  const k = s.players[p].knights;
  const cur = s.awards.army;
  if (cur === p || k < 3) return;
  if (cur === null || k > s.players[cur].knights) {
    s.awards.army = p;
    log(s, p, `${nm(s, p)} virou o Rei da Catapulta! (+2 pontos)`);
    ev(s, { type: 'award', award: 'army', p });
  }
}

function produce(s, sum) {
  const gains = s.players.map(zero);
  const drops = [];
  for (const t of s.board.tiles) {
    if (t.number !== sum || t.id === s.catapult) continue;
    const res = TERRAIN_RES[t.terrain];
    for (const v of t.v) {
      const b = s.buildings[v];
      if (!b) continue;
      const n = b.kind === 'castle' ? 2 : 1;
      gains[b.p][res] += n;
      drops.push({ tile: t.id, p: b.p, res, n });
    }
  }
  for (const r of RES) {
    const takers = gains.map((g, i) => (g[r] > 0 ? i : -1)).filter((i) => i >= 0);
    const total = takers.reduce((n, i) => n + gains[i][r], 0);
    if (total > s.bank[r]) {
      if (takers.length === 1) gains[takers[0]][r] = s.bank[r];
      else takers.forEach((i) => (gains[i][r] = 0));
    }
  }
  let any = false;
  gains.forEach((g, i) => {
    if (!handCount(g)) return;
    any = true;
    for (const r of RES) {
      s.players[i].hand[r] += g[r];
      s.bank[r] -= g[r];
    }
    log(s, i, `${nm(s, i)} recebeu ${resText(g)}`);
  });
  for (const d of drops) if (gains[d.p][d.res] > 0) ev(s, { type: 'gain', ...d });
  if (!any) log(s, null, 'Ninguém produziu nada.');
}

function doSteal(s, p, target) {
  const h = s.players[target].hand;
  const pool = [];
  for (const r of RES) for (let i = 0; i < h[r]; i++) pool.push(r);
  if (!pool.length) return;
  const r = pool[Math.floor(s.rnd() * pool.length)];
  h[r]--;
  s.players[p].hand[r]++;
  log(s, p, `${nm(s, p)} roubou uma carta de ${nm(s, target)}`);
  ev(s, { type: 'steal', from: target, to: p, res: r, priv: [p, target] });
}

function place(s, p, kind, at) {
  ev(s, { type: 'build', kind, p, at });
}

// ---------- ações ----------

const mainTurn = (s, p, sub = 'action') => s.phase === 'main' && s.turn === p && s.sub === sub;

const H = {
  placeVillage(s, p, a) {
    if (s.phase !== 'setup' || s.sub !== 'setupVillage' || s.turn !== p) return 'Não é hora de colocar vila';
    if (!Number.isInteger(a.v) || !legalVillages(s, p, true).includes(a.v)) return 'Lugar inválido';
    const pl = s.players[p];
    s.buildings[a.v] = { p, kind: 'village' };
    pl.villagesLeft--;
    s.lastVillage = a.v;
    const port = s.board.vertices[a.v].port;
    if (port && !pl.ports.includes(port)) pl.ports.push(port);
    place(s, p, 'village', a.v);
    if (s.setupStep >= s.players.length) {
      const got = zero();
      for (const tid of s.board.vertices[a.v].tiles) {
        const res = TERRAIN_RES[s.board.tiles[tid].terrain];
        if (!res || s.bank[res] <= 0) continue;
        pl.hand[res]++;
        s.bank[res]--;
        got[res]++;
        ev(s, { type: 'gain', tile: tid, p, res, n: 1 });
      }
      if (handCount(got)) log(s, p, `${nm(s, p)} começou com ${resText(got)}`);
    }
    s.sub = 'setupRoad';
  },

  placeRoad(s, p, a) {
    if (s.phase !== 'setup' || s.sub !== 'setupRoad' || s.turn !== p) return 'Não é hora de colocar trilha';
    if (!Number.isInteger(a.e) || !legalSetupRoads(s).includes(a.e)) return 'Lugar inválido';
    s.roads[a.e] = p;
    s.players[p].roadsLeft--;
    place(s, p, 'road', a.e);
    s.setupStep++;
    s.lastVillage = null;
    if (s.setupStep >= s.setupOrder.length) {
      s.phase = 'main';
      s.turn = 0;
      s.sub = 'roll';
      s.turnNumber = 1;
      updateLongest(s);
      log(s, null, 'Tudo pronto. Que comece a bagunça!');
      ev(s, { type: 'turn', p: 0 });
    } else {
      s.turn = s.setupOrder[s.setupStep];
      s.sub = 'setupVillage';
      ev(s, { type: 'turn', p: s.turn });
    }
  },

  roll(s, p) {
    if (!mainTurn(s, p, 'roll')) return 'Não é hora de rolar';
    const d = [1 + Math.floor(s.rnd() * 6), 1 + Math.floor(s.rnd() * 6)];
    const sum = d[0] + d[1];
    s.dice = d;
    ev(s, { type: 'roll', p, d });
    log(s, p, `${nm(s, p)} rolou ${sum}`);
    if (sum === 7) {
      s.discard = {};
      s.players.forEach((pl, i) => {
        const n = handCount(pl.hand);
        if (n > 7) s.discard[i] = Math.floor(n / 2);
      });
      s.afterCatapult = 'action';
      s.sub = Object.keys(s.discard).length ? 'discard' : 'catapult';
    } else {
      produce(s, sum);
      s.sub = 'action';
    }
  },

  discard(s, p, a) {
    if (s.phase !== 'main' || s.sub !== 'discard' || !s.discard[p]) return 'Você não precisa descartar';
    const res = cleanRes(a.res);
    const pl = s.players[p];
    if (handCount(res) !== s.discard[p]) return `Descarte exatamente ${s.discard[p]} cartas`;
    if (!canAfford(pl, res)) return 'Você não tem essas cartas';
    pay(s, p, res);
    delete s.discard[p];
    log(s, p, `${nm(s, p)} descartou ${handCount(res)} cartas`);
    if (!Object.keys(s.discard).length) s.sub = 'catapult';
  },

  moveCatapult(s, p, a) {
    if (!mainTurn(s, p, 'catapult')) return 'Não é hora de mirar a catapulta';
    if (!Number.isInteger(a.tile) || a.tile < 0 || a.tile >= s.board.tiles.length) return 'Escolha outro terreno';
    const t = s.board.tiles[a.tile];
    if (!t || t.id === s.catapult) return 'Escolha outro terreno';
    s.catapult = t.id;
    ev(s, { type: 'catapult', p, tile: t.id });
    log(s, p, `${nm(s, p)} disparou a catapulta!`);
    const cands = [...new Set(t.v.map((v) => s.buildings[v]?.p).filter((x) => x !== undefined && x !== p))].filter(
      (i) => handCount(s.players[i].hand) > 0
    );
    if (cands.length > 1) {
      s.stealFrom = cands;
      s.sub = 'steal';
    } else {
      if (cands.length === 1) doSteal(s, p, cands[0]);
      s.sub = s.afterCatapult;
    }
  },

  steal(s, p, a) {
    if (!mainTurn(s, p, 'steal')) return 'Não é hora de roubar';
    if (!Number.isInteger(a.target) || !s.stealFrom.includes(a.target)) return 'Alvo inválido';
    doSteal(s, p, a.target);
    s.stealFrom = [];
    s.sub = s.afterCatapult;
  },

  buildRoad(s, p, a) {
    if (!mainTurn(s, p)) return 'Agora não dá para construir';
    const pl = s.players[p];
    if (pl.roadsLeft <= 0) return 'Suas trilhas acabaram';
    if (!Number.isInteger(a.e) || !legalRoads(s, p).includes(a.e)) return 'Lugar inválido';
    if (s.freeRoads > 0) s.freeRoads--;
    else if (!canAfford(pl, COSTS.road)) return 'Faltam recursos';
    else pay(s, p, COSTS.road);
    s.roads[a.e] = p;
    pl.roadsLeft--;
    if (pl.roadsLeft === 0) s.freeRoads = 0;
    place(s, p, 'road', a.e);
    updateLongest(s);
  },

  buildVillage(s, p, a) {
    if (!mainTurn(s, p)) return 'Agora não dá para construir';
    const pl = s.players[p];
    if (pl.villagesLeft <= 0) return 'Suas vilas acabaram';
    if (!Number.isInteger(a.v) || !legalVillages(s, p).includes(a.v)) return 'Lugar inválido';
    if (!canAfford(pl, COSTS.village)) return 'Faltam recursos';
    pay(s, p, COSTS.village);
    s.buildings[a.v] = { p, kind: 'village' };
    pl.villagesLeft--;
    const port = s.board.vertices[a.v].port;
    if (port && !pl.ports.includes(port)) pl.ports.push(port);
    place(s, p, 'village', a.v);
    log(s, p, `${nm(s, p)} fundou uma vila`);
    updateLongest(s);
  },

  buildCastle(s, p, a) {
    if (!mainTurn(s, p)) return 'Agora não dá para construir';
    const pl = s.players[p];
    const b = Number.isInteger(a.v) && Object.hasOwn(s.buildings, a.v) ? s.buildings[a.v] : null;
    if (!b || b.p !== p || b.kind !== 'village') return 'Precisa ser uma vila sua';
    if (pl.castlesLeft <= 0) return 'Seus castelos acabaram';
    if (!canAfford(pl, COSTS.castle)) return 'Faltam recursos';
    pay(s, p, COSTS.castle);
    b.kind = 'castle';
    pl.castlesLeft--;
    pl.villagesLeft++;
    place(s, p, 'castle', a.v);
    log(s, p, `${nm(s, p)} ergueu um castelo`);
  },

  buyCard(s, p) {
    if (!mainTurn(s, p)) return 'Agora não dá para comprar';
    const pl = s.players[p];
    if (!s.deck.length) return 'As cartas acabaram';
    if (!canAfford(pl, COSTS.card)) return 'Faltam recursos';
    pay(s, p, COSTS.card);
    const type = s.deck.pop();
    pl.cards.push({ type, turn: s.turnNumber });
    ev(s, { type: 'buy', p, card: type, priv: [p] });
    log(s, p, `${nm(s, p)} comprou uma carta de trapaça`);
  },

  playCard(s, p, a) {
    if (s.phase !== 'main' || s.turn !== p) return 'Não é a sua vez';
    if (s.cardPlayed) return 'Só uma carta por turno';
    const type = typeof a.card === 'string' ? a.card : '';
    if (!Object.hasOwn(CARD_NAMES, type) || type === 'vp') return 'Carta inválida';
    if (type === 'knight' ? s.sub !== 'roll' && s.sub !== 'action' : s.sub !== 'action') return 'Agora não dá para usar essa carta';
    const pl = s.players[p];
    const idx = pl.cards.findIndex((c) => c.type === type && c.turn < s.turnNumber);
    if (idx < 0) return 'Você não pode usar essa carta agora';

    let picks = null;
    if (type === 'plenty') {
      picks = Array.isArray(a.res) ? a.res.slice(0, 2) : [];
      if (picks.length !== 2 || !picks.every((r) => RES.includes(r))) return 'Escolha 2 recursos';
      const need = zero();
      picks.forEach((r) => need[r]++);
      if (!RES.every((r) => s.bank[r] >= need[r])) return 'O banco não tem esses recursos';
    }
    if (type === 'monopoly' && !RES.includes(a.res)) return 'Escolha um recurso';
    if (type === 'roads' && (pl.roadsLeft <= 0 || !legalRoads(s, p).length)) return 'Não há onde abrir trilhas';

    pl.cards.splice(idx, 1);
    s.cardPlayed = true;
    ev(s, { type: 'card', p, card: type });

    if (type === 'knight') {
      pl.knights++;
      log(s, p, `${nm(s, p)} chamou um Catapulteiro`);
      updateArmy(s, p);
      s.afterCatapult = s.sub;
      s.sub = 'catapult';
    } else if (type === 'roads') {
      s.freeRoads = Math.min(2, pl.roadsLeft);
      log(s, p, `${nm(s, p)} convocou um Mutirão: 2 trilhas grátis`);
    } else if (type === 'plenty') {
      const got = zero();
      for (const r of picks) {
        pl.hand[r]++;
        s.bank[r]--;
        got[r]++;
      }
      log(s, p, `${nm(s, p)} usou Fartura e pegou ${resText(got)}`);
    } else if (type === 'monopoly') {
      let total = 0;
      s.players.forEach((o, i) => {
        if (i === p) return;
        total += o.hand[a.res];
        pl.hand[a.res] += o.hand[a.res];
        o.hand[a.res] = 0;
      });
      log(s, p, `${nm(s, p)} fez um Arrastão e levou ${total} ${RES_NAMES[a.res]}!`);
      ev(s, { type: 'monopoly', p, res: a.res, n: total });
    } else if (type === 'gale') {
      const n = s.players.length;
      const moved = s.players.map((o) => {
        const pool = [];
        for (const r of RES) for (let i = 0; i < o.hand[r]; i++) pool.push(r);
        return pool.length ? pool[Math.floor(s.rnd() * pool.length)] : null;
      });
      moved.forEach((r, i) => {
        if (!r) return;
        s.players[i].hand[r]--;
        s.players[(i + 1) % n].hand[r]++;
      });
      log(s, p, `${nm(s, p)} soltou um Vendaval! Cada um passou uma carta ao vizinho.`);
    }
  },

  bankTrade(s, p, a) {
    if (!mainTurn(s, p)) return 'Agora não dá para trocar';
    const give = cleanRes(a.give);
    const get = cleanRes(a.get);
    const pl = s.players[p];
    let credits = 0;
    for (const r of RES) {
      if (!give[r]) continue;
      if (get[r]) return 'Não troque um recurso por ele mesmo';
      const ratio = tradeRatio(s, p, r);
      if (give[r] % ratio) return `A taxa de ${RES_NAMES[r]} é ${ratio}:1`;
      credits += give[r] / ratio;
    }
    if (!credits || credits !== handCount(get)) return 'Troca desequilibrada';
    if (!canAfford(pl, give)) return 'Faltam recursos';
    if (!RES.every((r) => s.bank[r] >= get[r])) return 'O banco não tem isso';
    pay(s, p, give);
    for (const r of RES) {
      pl.hand[r] += get[r];
      s.bank[r] -= get[r];
    }
    log(s, p, `${nm(s, p)} trocou ${resText(give)} por ${resText(get)} com o banco`);
    ev(s, { type: 'bank', p });
  },

  offerTrade(s, p, a) {
    if (!mainTurn(s, p)) return 'Agora não dá para trocar';
    const give = cleanRes(a.give);
    const get = cleanRes(a.get);
    if (!handCount(give) || !handCount(get)) return 'A oferta precisa dos dois lados';
    if (RES.some((r) => give[r] && get[r])) return 'Não troque um recurso por ele mesmo';
    if (!canAfford(s.players[p], give)) return 'Você não tem isso';
    s.trade = { id: ++s.tradeSeq, from: p, give, get, responses: {} };
    log(s, p, `${nm(s, p)} oferece ${resText(give)} por ${resText(get)}`);
    ev(s, { type: 'offer', p });
  },

  respondTrade(s, p, a) {
    if (!s.trade || s.trade.from === p) return 'Não há oferta para você';
    if (a.accept && !canAfford(s.players[p], s.trade.get)) return 'Você não tem o que foi pedido';
    s.trade.responses[p] = a.accept ? 'yes' : 'no';
  },

  confirmTrade(s, p, a) {
    if (!mainTurn(s, p) || !s.trade || s.trade.from !== p) return 'Não há oferta sua';
    const o = a.with;
    if (!Number.isInteger(o) || o < 0 || o >= s.players.length || o === p) return 'Jogador inválido';
    if (!Object.hasOwn(s.trade.responses, o) || s.trade.responses[o] !== 'yes') return 'Esse jogador não aceitou';
    const { give, get } = s.trade;
    if (!canAfford(s.players[p], give) || !canAfford(s.players[o], get)) {
      s.trade = null;
      return 'Alguém ficou sem as cartas. Oferta cancelada.';
    }
    for (const r of RES) {
      s.players[p].hand[r] += get[r] - give[r];
      s.players[o].hand[r] += give[r] - get[r];
    }
    s.trade = null;
    log(s, p, `${nm(s, p)} e ${nm(s, o)} fecharam negócio`);
    ev(s, { type: 'deal', p, o });
  },

  cancelTrade(s, p) {
    if (!s.trade || s.trade.from !== p) return 'Não há oferta sua';
    s.trade = null;
  },

  endTurn(s, p) {
    if (!mainTurn(s, p)) return 'Você ainda não pode passar a vez';
    s.trade = null;
    s.freeRoads = 0;
    s.cardPlayed = false;
    s.turn = (s.turn + 1) % s.players.length;
    s.turnNumber++;
    s.sub = 'roll';
    ev(s, { type: 'turn', p: s.turn });
  },
};

export function act(s, p, a) {
  if (s.phase === 'ended') return 'O jogo acabou';
  if (!Number.isInteger(p) || p < 0 || p >= s.players.length) return 'Jogador inválido';
  if (!a || typeof a !== 'object' || !Object.hasOwn(H, a.type)) return 'Ação inválida';
  const err = H[a.type](s, p, a) || null;
  if (!err && s.phase === 'main' && totalVP(s, s.turn) >= WIN_POINTS) {
    s.phase = 'ended';
    s.winner = s.turn;
    s.trade = null;
    log(s, s.turn, `${nm(s, s.turn)} venceu a partida!`);
    ev(s, { type: 'win', p: s.turn });
  }
  return err;
}

// ---------- visão por jogador (esconde mãos alheias) ----------

export function view(s, me) {
  const ended = s.phase === 'ended';
  const players = s.players.map((pl, i) => {
    const o = {
      name: pl.name,
      color: pl.color,
      avatar: pl.avatar,
      bot: pl.bot,
      connected: pl.connected,
      handCount: handCount(pl.hand),
      cardCount: pl.cards.length,
      knights: pl.knights,
      roadLen: pl.roadLen,
      roadsLeft: pl.roadsLeft,
      villagesLeft: pl.villagesLeft,
      castlesLeft: pl.castlesLeft,
      vp: ended ? totalVP(s, i) : publicVP(s, i),
    };
    if (i === me || ended) {
      o.hand = { ...pl.hand };
      o.cards = pl.cards.map((c) => ({ type: c.type, fresh: c.turn >= s.turnNumber }));
      o.vpTotal = totalVP(s, i);
    }
    return o;
  });

  const legal = { villages: [], roads: [], castles: [], tiles: [] };
  const can = { road: false, village: false, castle: false, card: false };
  let ratios = null;
  if (me >= 0 && me < s.players.length) {
    const pl = s.players[me];
    ratios = {};
    for (const r of RES) ratios[r] = tradeRatio(s, me, r);
    if (me === s.turn && !ended) {
      if (s.sub === 'setupVillage') legal.villages = legalVillages(s, me, true);
      else if (s.sub === 'setupRoad') legal.roads = legalSetupRoads(s);
      else if (s.sub === 'catapult') legal.tiles = s.board.tiles.filter((t) => t.id !== s.catapult).map((t) => t.id);
      else if (s.sub === 'action') {
        if (pl.roadsLeft > 0) legal.roads = legalRoads(s, me);
        if (pl.villagesLeft > 0) legal.villages = legalVillages(s, me);
        if (pl.castlesLeft > 0) legal.castles = ownVillages(s, me);
        can.road = s.freeRoads > 0 || canAfford(pl, COSTS.road);
        can.village = canAfford(pl, COSTS.village);
        can.castle = canAfford(pl, COSTS.castle);
        can.card = s.deck.length > 0 && canAfford(pl, COSTS.card);
      }
    }
  }

  return {
    me,
    phase: s.phase,
    sub: s.sub,
    turn: s.turn,
    turnNumber: s.turnNumber,
    dice: s.dice,
    catapult: s.catapult,
    buildings: s.buildings,
    roads: s.roads,
    bank: s.bank,
    deckCount: s.deck.length,
    players,
    awards: s.awards,
    trade: s.trade,
    discard: s.discard,
    stealFrom: s.stealFrom,
    freeRoads: s.freeRoads,
    cardPlayed: s.cardPlayed,
    winner: s.winner,
    legal,
    can,
    ratios,
    log: s.log,
  };
}

export function drainEvents(s) {
  const e = s.events;
  s.events = [];
  return e;
}

export function filterEvents(evs, me) {
  return evs.map((e) => {
    if (!e.priv) return e;
    const { priv, ...rest } = e;
    if (priv.includes(me)) return rest;
    delete rest.res;
    delete rest.card;
    return rest;
  });
}
