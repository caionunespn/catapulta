// IA dos bots (Fácil, Médio, Difícil): devolve a próxima ação de um jogador controlado pelo servidor.
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

function playerProd(s, p) {
  const prod = { wood: 0, stone: 0, cheese: 0, pumpkin: 0, crystal: 0 };
  for (const [vid, b] of Object.entries(s.buildings)) {
    if (b.p !== p) continue;
    const mult = b.kind === 'castle' ? 2 : 1;
    for (const tid of s.board.vertices[Number(vid)].tiles) {
      const t = s.board.tiles[tid];
      const res = TERRAIN_RES[t.terrain];
      if (res) prod[res] += pips(t.number) * mult;
    }
  }
  return prod;
}

export function vertexScore(s, v, p = null, level = 'medium') {
  const vert = s.board.vertices[v];
  const kinds = new Set();
  let score = 0;
  const prod = level === 'hard' && p !== null ? playerProd(s, p) : null;
  let scarcityBonus = 0;
  for (const tid of vert.tiles) {
    const t = s.board.tiles[tid];
    const res = TERRAIN_RES[t.terrain];
    if (!res) continue;
    const w = pips(t.number);
    score += w;
    kinds.add(res);
    if (prod && prod[res] === 0) scarcityBonus += w * 0.55;
  }
  const base = score + kinds.size * 0.8 + (vert.port ? 0.6 : 0);
  if (level === 'easy') return base * 0.35 + Math.random() * 6.5;
  if (level === 'hard') {
    let portBonus = 0;
    if (vert.port === 'any') portBonus = 0.8;
    else if (vert.port && prod && prod[vert.port] >= 4) portBonus = 1.8;
    return base + scarcityBonus + portBonus;
  }
  return base;
}

const spotFree = (s, v) => !s.buildings[v] && s.board.vertices[v].adj.every((u) => !s.buildings[u]);

function roadScore(s, e, p = null, level = 'medium') {
  const edge = s.board.edges[e];
  let best = 0;
  for (const v of [edge.a, edge.b]) {
    if (spotFree(s, v)) best = Math.max(best, 10 + vertexScore(s, v, p, level));
    for (const u of s.board.vertices[v].adj) {
      if (spotFree(s, u)) best = Math.max(best, vertexScore(s, u, p, level) * 0.5);
    }
  }
  if (level === 'easy') return best * 0.35 + Math.random() * 6;
  if (level === 'hard') {
    const roadBonus = p !== null && s.players[p].roadLen >= 4 && s.awards.road !== p ? 2.5 : 0;
    return best + roadBonus + Math.random() * 0.25;
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

function desiredResources(s, p) {
  const pl = s.players[p];
  const need = { wood: 0, stone: 0, cheese: 0, pumpkin: 0, crystal: 0 };
  const target = ownVillages(s, p).length && pl.castlesLeft > 0 ? COSTS.castle : pl.villagesLeft > 0 ? COSTS.village : COSTS.card;
  for (const r of RES) {
    if (pl.hand[r] < (target[r] || 0)) need[r] = (target[r] || 0) - pl.hand[r];
  }
  return need;
}

function actionPhase(s, p, level) {
  const pl = s.players[p];
  const roads = pl.roadsLeft > 0 ? legalRoads(s, p) : [];
  const spots = pl.villagesLeft > 0 ? legalVillages(s, p) : [];
  const villages = pl.castlesLeft > 0 ? ownVillages(s, p) : [];

  if (s.freeRoads > 0 && roads.length) return { type: 'buildRoad', e: maxBy(roads, (e) => roadScore(s, e, p, level)) };

  // cartas de trapaça
  const useCards = level !== 'easy' || Math.random() < 0.5;
  if (useCards) {
    if (playableCard(s, p, 'knight')) return { type: 'playCard', card: 'knight' };
    if (playableCard(s, p, 'monopoly')) {
      const sum = (r) => s.players.reduce((n, o, i) => n + (i === p ? 0 : o.hand[r]), 0);
      const r = maxBy(RES, sum);
      const minTake = level === 'hard' ? 2 : 3;
      if (sum(r) >= minTake) return { type: 'playCard', card: 'monopoly', res: r };
    }
    if (playableCard(s, p, 'plenty')) {
      const need = desiredResources(s, p);
      const avail = RES.filter((r) => s.bank[r] >= 2).sort(
        (a, b) => (level === 'hard' ? need[b] - need[a] : 0) || pl.hand[a] - pl.hand[b]
      );
      if (avail.length >= 2) return { type: 'playCard', card: 'plenty', res: [avail[0], avail[1]] };
    }
    if (playableCard(s, p, 'roads') && roads.length) return { type: 'playCard', card: 'roads' };
    if (playableCard(s, p, 'gale')) return { type: 'playCard', card: 'gale' };
  }

  // construções
  if (villages.length && canAfford(pl, COSTS.castle)) {
    return { type: 'buildCastle', v: maxBy(villages, (v) => vertexScore(s, v, p, level)) };
  }
  if (spots.length && canAfford(pl, COSTS.village)) {
    return { type: 'buildVillage', v: maxBy(spots, (v) => vertexScore(s, v, p, level)) };
  }
  const wantsRoadForAward = level === 'hard' && pl.roadLen >= 4 && s.awards.road !== p && roads.length;
  if ((!spots.length && roads.length && pl.villagesLeft > 0 && canAfford(pl, COSTS.road)) || (wantsRoadForAward && canAfford(pl, COSTS.road))) {
    return { type: 'buildRoad', e: maxBy(roads, (e) => roadScore(s, e, p, level)) };
  }
  const cardChance = level === 'easy' ? 0.25 : level === 'hard' ? 0.75 : 0.5;
  if (s.deck.length && canAfford(pl, COSTS.card) && (handCount(pl.hand) >= 6 || !villages.length || Math.random() < cardChance)) {
    return { type: 'buyCard' };
  }

  // troca com o banco rumo a um objetivo
  if (level === 'easy' && Math.random() > 0.35) return { type: 'endTurn' };
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
  const level = pl?.botLevel || s.botLevel || 'medium';

  if (s.trade && s.trade.from !== p && s.trade.responses[p] === undefined) {
    const { give, get } = s.trade;
    let ok = false;
    if (canAfford(pl, get)) {
      if (level === 'easy') {
        ok = handCount(give) >= handCount(get) && Math.random() < 0.9;
      } else if (level === 'hard') {
        const need = desiredResources(s, p);
        const gainsNeeded = RES.some((r) => give[r] > 0 && need[r] > 0);
        const losesNeeded = RES.some((r) => get[r] > 0 && need[r] > 0);
        ok =
          publicVP(s, s.trade.from) < 7 &&
          (handCount(give) > handCount(get) || (handCount(give) === handCount(get) && gainsNeeded && !losesNeeded));
      } else {
        ok = handCount(give) >= handCount(get) && publicVP(s, s.trade.from) < 8 && Math.random() < 0.75;
      }
    }
    return { type: 'respondTrade', accept: ok };
  }

  if (s.sub === 'discard') {
    if (!s.discard[p]) return null;
    const res = {};
    const hand = { ...pl.hand };
    const need = level === 'hard' ? desiredResources(s, p) : null;
    for (let i = 0; i < s.discard[p]; i++) {
      const r = maxBy(RES, (x) => hand[x] <= 0 ? -Infinity : hand[x] - (need && need[x] ? 1.5 : 0) + Math.random() * 0.5);
      hand[r]--;
      res[r] = (res[r] || 0) + 1;
    }
    return { type: 'discard', res };
  }

  if (s.turn !== p) return null;

  switch (s.sub) {
    case 'setupVillage': {
      const jitter = level === 'hard' ? 0.2 : level === 'easy' ? 0 : 1.5;
      return {
        type: 'placeVillage',
        v: maxBy(legalVillages(s, p, true), (v) => vertexScore(s, v, p, level) + Math.random() * jitter),
      };
    }
    case 'setupRoad':
      return { type: 'placeRoad', e: maxBy(legalSetupRoads(s), (e) => roadScore(s, e, p, level)) };
    case 'roll': {
      const blocked = s.board.tiles[s.catapult].v.some((v) => s.buildings[v]?.p === p);
      if (playableCard(s, p, 'knight')) {
        if (level === 'easy' && blocked && Math.random() < 0.4) return { type: 'playCard', card: 'knight' };
        if (level === 'medium' && blocked) return { type: 'playCard', card: 'knight' };
        if (
          level === 'hard' &&
          (blocked || (pl.knights >= 2 && s.awards.army !== p) || s.players.some((_, i) => i !== p && publicVP(s, i) >= 6))
        ) {
          return { type: 'playCard', card: 'knight' };
        }
      }
      return { type: 'roll' };
    }
    case 'catapult': {
      const leader = Math.max(...s.players.map((_, i) => (i === p ? 0 : publicVP(s, i))));
      const value = (t) => {
        if (t.id === s.catapult) return -Infinity;
        let sc = 0;
        for (const v of t.v) {
          const b = s.buildings[v];
          if (!b) continue;
          const w = pips(t.number) * (b.kind === 'castle' ? 2 : 1);
          if (b.p === p) sc -= w * (level === 'hard' ? 5 : level === 'easy' ? 2 : 3);
          else if (level === 'easy') sc += w * 0.6;
          else if (level === 'hard') {
            sc += w * (publicVP(s, b.p) === leader ? 2.5 : 1.1) + (handCount(s.players[b.p].hand) > 0 ? 1.5 : 0);
          } else {
            sc += w * (publicVP(s, b.p) === leader ? 1.5 : 1);
          }
        }
        const noise = level === 'easy' ? 6 : level === 'hard' ? 0.2 : 1;
        return sc + Math.random() * noise;
      };
      return { type: 'moveCatapult', tile: maxBy(s.board.tiles, value).id };
    }
    case 'steal':
      if (level === 'easy') {
        return { type: 'steal', target: maxBy(s.stealFrom, () => Math.random()) };
      }
      if (level === 'hard') {
        return {
          type: 'steal',
          target: maxBy(s.stealFrom, (i) => publicVP(s, i) * 2 + handCount(s.players[i].hand) + Math.random() * 0.2),
        };
      }
      return { type: 'steal', target: maxBy(s.stealFrom, (i) => handCount(s.players[i].hand) + Math.random()) };
    case 'action':
      return actionPhase(s, p, level);
  }
  return null;
}
