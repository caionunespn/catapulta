// IA simples: devolve a próxima ação de um jogador controlado pelo servidor.
import { RES, TERRAIN_RES, pips } from './board.js';
import {
  COSTS,
  canAfford,
  handCount,
  legalRoads,
  legalSetupRoads,
  legalVillages,
  ownVillages,
  publicVP,
  tradeRatio,
} from './game.js';

function vertexScore(s, v) {
  const vert = s.board.vertices[v];
  const kinds = new Set();
  let score = 0;
  for (const tid of vert.tiles) {
    const t = s.board.tiles[tid];
    const res = TERRAIN_RES[t.terrain];
    if (!res) continue;
    score += pips(t.number);
    kinds.add(res);
  }
  return score + kinds.size * 0.8 + (vert.port ? 0.6 : 0);
}

const spotFree = (s, v) => !s.buildings[v] && s.board.vertices[v].adj.every((u) => !s.buildings[u]);

function roadScore(s, e) {
  const edge = s.board.edges[e];
  let best = 0;
  for (const v of [edge.a, edge.b]) {
    if (spotFree(s, v)) best = Math.max(best, 10 + vertexScore(s, v));
    for (const u of s.board.vertices[v].adj) {
      if (spotFree(s, u)) best = Math.max(best, vertexScore(s, u) * 0.5);
    }
  }
  return best + Math.random();
}

const maxBy = (arr, f) => {
  let best = null;
  let bs = -Infinity;
  for (const x of arr) {
    const sc = f(x);
    if (sc > bs) {
      bs = sc;
      best = x;
    }
  }
  return best;
};

function bankTradeFor(s, p, cost) {
  const pl = s.players[p];
  const missing = RES.filter((r) => pl.hand[r] < (cost[r] || 0));
  if (!missing.length) return null;
  const need = missing.reduce((n, r) => n + (cost[r] || 0) - pl.hand[r], 0);
  let credits = 0;
  let src = null;
  let srcExtra = 0;
  for (const r of RES) {
    const extra = pl.hand[r] - (cost[r] || 0);
    const ratio = tradeRatio(s, p, r);
    if (extra >= ratio) {
      credits += Math.floor(extra / ratio);
      if (extra - ratio > srcExtra - (src ? tradeRatio(s, p, src) : 0) || !src) {
        src = r;
        srcExtra = extra;
      }
    }
  }
  if (!src || credits < need) return null;
  const want = missing.find((r) => s.bank[r] > 0);
  if (!want) return null;
  return { type: 'bankTrade', give: { [src]: tradeRatio(s, p, src) }, get: { [want]: 1 } };
}

function playableCard(s, p, type) {
  return !s.cardPlayed && s.players[p].cards.some((c) => c.type === type && c.turn < s.turnNumber);
}

function actionPhase(s, p) {
  const pl = s.players[p];
  const roads = pl.roadsLeft > 0 ? legalRoads(s, p) : [];
  const spots = pl.villagesLeft > 0 ? legalVillages(s, p) : [];
  const villages = pl.castlesLeft > 0 ? ownVillages(s, p) : [];

  if (s.freeRoads > 0 && roads.length) return { type: 'buildRoad', e: maxBy(roads, (e) => roadScore(s, e)) };

  // cartas de trapaça
  if (playableCard(s, p, 'knight')) return { type: 'playCard', card: 'knight' };
  if (playableCard(s, p, 'monopoly')) {
    const sum = (r) => s.players.reduce((n, o, i) => n + (i === p ? 0 : o.hand[r]), 0);
    const r = maxBy(RES, sum);
    if (sum(r) >= 3) return { type: 'playCard', card: 'monopoly', res: r };
  }
  if (playableCard(s, p, 'plenty')) {
    const avail = RES.filter((r) => s.bank[r] >= 2).sort((a, b) => pl.hand[a] - pl.hand[b]);
    if (avail.length >= 2) return { type: 'playCard', card: 'plenty', res: [avail[0], avail[1]] };
  }
  if (playableCard(s, p, 'roads') && roads.length) return { type: 'playCard', card: 'roads' };
  if (playableCard(s, p, 'gale')) return { type: 'playCard', card: 'gale' };

  // construções
  if (villages.length && canAfford(pl, COSTS.castle)) {
    return { type: 'buildCastle', v: maxBy(villages, (v) => vertexScore(s, v)) };
  }
  if (spots.length && canAfford(pl, COSTS.village)) {
    return { type: 'buildVillage', v: maxBy(spots, (v) => vertexScore(s, v)) };
  }
  if (!spots.length && roads.length && pl.villagesLeft > 0 && canAfford(pl, COSTS.road)) {
    return { type: 'buildRoad', e: maxBy(roads, (e) => roadScore(s, e)) };
  }
  if (s.deck.length && canAfford(pl, COSTS.card) && (handCount(pl.hand) >= 6 || !villages.length || Math.random() < 0.5)) {
    return { type: 'buyCard' };
  }

  // troca com o banco rumo a um objetivo
  const goals = [];
  if (villages.length) goals.push(COSTS.castle);
  if (spots.length) goals.push(COSTS.village);
  else if (roads.length && pl.villagesLeft > 0) goals.push(COSTS.road);
  if (s.deck.length) goals.push(COSTS.card);
  for (const g of goals) {
    const t = bankTradeFor(s, p, g);
    if (t) return t;
  }
  return { type: 'endTurn' };
}

export function botAction(s, p) {
  if (s.phase === 'ended') return null;
  const pl = s.players[p];

  if (s.trade && s.trade.from !== p && s.trade.responses[p] === undefined) {
    const { give, get } = s.trade;
    const ok =
      canAfford(pl, get) && handCount(give) >= handCount(get) && publicVP(s, s.trade.from) < 8 && Math.random() < 0.75;
    return { type: 'respondTrade', accept: ok };
  }

  if (s.sub === 'discard') {
    if (!s.discard[p]) return null;
    const res = {};
    const hand = { ...pl.hand };
    for (let i = 0; i < s.discard[p]; i++) {
      const r = maxBy(RES, (x) => hand[x] + Math.random() * 0.5);
      hand[r]--;
      res[r] = (res[r] || 0) + 1;
    }
    return { type: 'discard', res };
  }

  if (s.turn !== p) return null;

  switch (s.sub) {
    case 'setupVillage':
      return { type: 'placeVillage', v: maxBy(legalVillages(s, p, true), (v) => vertexScore(s, v) + Math.random() * 1.5) };
    case 'setupRoad':
      return { type: 'placeRoad', e: maxBy(legalSetupRoads(s), (e) => roadScore(s, e)) };
    case 'roll': {
      const blocked = s.board.tiles[s.catapult].v.some((v) => s.buildings[v]?.p === p);
      if (blocked && playableCard(s, p, 'knight')) return { type: 'playCard', card: 'knight' };
      return { type: 'roll' };
    }
    case 'catapult': {
      const leader = Math.max(...s.players.map((_, i) => publicVP(s, i)));
      const value = (t) => {
        if (t.id === s.catapult) return -Infinity;
        let sc = 0;
        for (const v of t.v) {
          const b = s.buildings[v];
          if (!b) continue;
          const w = pips(t.number) * (b.kind === 'castle' ? 2 : 1);
          if (b.p === p) sc -= w * 3;
          else sc += w * (publicVP(s, b.p) === leader ? 1.5 : 1);
        }
        return sc + Math.random();
      };
      return { type: 'moveCatapult', tile: maxBy(s.board.tiles, value).id };
    }
    case 'steal':
      return { type: 'steal', target: maxBy(s.stealFrom, (i) => handCount(s.players[i].hand) + Math.random()) };
    case 'action':
      return actionPhase(s, p);
  }
  return null;
}
