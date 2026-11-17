// Bot de balanceamento autônomo para Arsenal da Quermesse (testa 40/40 fases sem navegador).
import {
  GRID_COLS,
  GRID_ROWS,
  PIECES,
  TRAY_SLOTS,
  MAX_TIER,
  LEVELS,
  getLevel,
  createStageRun,
  startWave,
  stepCombat,
  buyShopToGrid,
  buyShopToTray,
  moveGridPiece,
  moveTrayToGrid,
  moveGridToTray,
  rerollShop,
  findFirstValidPlacement,
  findMergeTarget,
  computeGridSynergies,
  pieceCellsAt,
  isAdjacentToOpen,
  expandGridCell,
  sellPiece,
} from '../public/arsenal-da-quermesse/js/engine.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tryMergeGridWithGrid(run) {
  let mergedAny = false;
  let guard = 0;
  while (guard++ < 20) {
    let did = false;
    for (let i = 0; i < run.grid.pieces.length && !did; i++) {
      for (let j = i + 1; j < run.grid.pieces.length && !did; j++) {
        const a = run.grid.pieces[i];
        const b = run.grid.pieces[j];
        if (a.pieceId === b.pieceId && a.tier === b.tier && a.tier < MAX_TIER) {
          const res = moveGridPiece(run, b.uid, a.col, a.row, a.rot);
          if (res.ok && res.merged) {
            did = true;
            mergedAny = true;
          }
        }
      }
    }
    if (!did) break;
  }
  return mergedAny;
}

function tryMergeTrayIntoGrid(run) {
  let mergedAny = false;
  for (let t = 0; t < TRAY_SLOTS; t++) {
    const tp = run.tray[t];
    if (!tp) continue;
    const match = run.grid.pieces.find((g) => g.pieceId === tp.pieceId && g.tier === tp.tier && g.tier < MAX_TIER);
    if (match) {
      const res = moveTrayToGrid(run, t, match.col, match.row, match.rot);
      if (res.ok) mergedAny = true;
    } else {
      const pos = findFirstValidPlacement(run.grid, tp.pieceId);
      if (pos) {
        const res = moveTrayToGrid(run, t, pos.col, pos.row, pos.rot);
        if (res.ok) mergedAny = true;
      }
    }
  }
  return mergedAny;
}

function expandBestCells(run) {
  while (run.freeExpands > 0) {
    const candidates = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (isAdjacentToOpen(run.grid, c, r)) {
          const score = 12 - (Math.abs(c - 2.5) + Math.abs(r - 2.5));
          candidates.push({ c, r, score });
        }
      }
    }
    if (candidates.length === 0) break;
    candidates.sort((a, b) => b.score - a.score);
    expandGridCell(run, candidates[0].c, candidates[0].r);
  }
}

function scorePlacement(run, pieceId, tier, col, row, rot) {
  // Prefere encostar em Tomos/Lampiões ou manter peças de suporte adjacentes a armas
  const testPiece = { uid: 9999, pieceId, tier, col, row, rot };
  run.grid.pieces.push(testPiece);
  const syn = computeGridSynergies(run.grid);
  let score = 0;
  for (const p of run.grid.pieces) {
    const s = syn.byUid.get(p.uid);
    const w = PIECES[p.pieceId].cost * p.tier;
    score += ((s.dmgMult - 1) * 1.4 + (s.spdMult - 1) * 1.2 + (s.armorMult - 1) * 0.8 + s.critBonus) * w;
  }
  run.grid.pieces.pop();
  return score;
}

function findBestPlacement(run, pieceId, tier) {
  const def = PIECES[pieceId];
  const occSet = new Set();
  for (const p of run.grid.pieces) {
    for (const [pc, pr] of pieceCellsAt(p.pieceId, p.col, p.row, p.rot)) {
      occSet.add(`${pc},${pr}`);
    }
  }
  let best = null;
  for (let rot = 0; rot < def.rotCount; rot++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cells = pieceCellsAt(pieceId, c, r, rot);
        let ok = true;
        for (const [cc, rr] of cells) {
          if (cc < 0 || cc >= GRID_COLS || rr < 0 || rr >= GRID_ROWS || !run.grid.open[rr][cc] || occSet.has(`${cc},${rr}`)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const s = scorePlacement(run, pieceId, tier, c, r, rot) - (Math.abs(c - 2.5) + Math.abs(r - 2.5)) * 0.05;
        if (!best || s > best.s) best = { col: c, row: r, rot, s };
      }
    }
  }
  return best;
}

function smartPrep(run) {
  expandBestCells(run);

  let rerolls = 0;
  for (let round = 0; round < 24; round++) {
    tryMergeGridWithGrid(run);
    tryMergeTrayIntoGrid(run);

    // Avalia ofertas na loja
    const offers = run.shop
      .map((o, idx) => ({ o, idx }))
      .filter((x) => x.o && x.o.cost <= run.gold);

    if (offers.length === 0) {
      if (run.gold >= 6 && rerolls < 3) {
        rerolls++;
        rerollShop(run);
        continue;
      }
      break;
    }

    // Prioriza: 1) Fusão imediata na grade; 2) Sinergias/DPS fortes; 3) Ocupar grade com peças fortes
    let picked = null;
    for (const { o, idx } of offers) {
      const gridMatch = run.grid.pieces.find((p) => p.pieceId === o.pieceId && p.tier === o.tier && p.tier < MAX_TIER);
      if (gridMatch) {
        picked = { idx, kind: 'mergeGrid', target: gridMatch, prio: 100 + o.tier * 30 + PIECES[o.pieceId].cost };
        break;
      }
    }

    if (!picked) {
      const counts = {};
      for (const p of run.grid.pieces) counts[p.pieceId] = (counts[p.pieceId] || 0) + 1;
      let bestScore = -Infinity;
      for (const { o, idx } of offers) {
        const pos = findBestPlacement(run, o.pieceId, o.tier);
        if (!pos) continue;
        let prio = PIECES[o.pieceId].cost * 3 + o.tier * 12 + pos.s * 5;
        if (o.pieceId === 'witch' || o.pieceId === 'sword' || o.pieceId === 'tome' || o.pieceId === 'voodoo') prio += 6;
        if (run.waveIdx === 0 && run.grid.pieces.length < 2 && (o.pieceId === 'lantern' || o.pieceId === 'shield')) prio -= 15;
        if (o.pieceId === 'lantern' && run.waveIdx >= 1 && (counts.lantern || 0) < 1) prio += 4;
        if (o.pieceId === 'shield' && run.grid.pieces.length >= 2 && (counts.shield || 0) < 2) prio += 5;
        if (o.pieceId === 'shield' && (counts.shield || 0) >= 3) prio -= 8;
        if (o.pieceId === 'lantern' && (counts.lantern || 0) >= 2) prio -= 9;
        if (prio > bestScore) {
          bestScore = prio;
          picked = { idx, kind: 'place', pos, prio };
        }
      }
    }

    if (picked) {
      if (picked.kind === 'mergeGrid') {
        buyShopToGrid(run, picked.idx, picked.target.col, picked.target.row, picked.target.rot);
      } else {
        buyShopToGrid(run, picked.idx, picked.pos.col, picked.pos.row, picked.pos.rot);
      }
      continue;
    }

    // Se tem ouro sobrando, atualiza a loja com limite razoável por onda
    if (run.gold >= 6 && rerolls < 5) {
      rerolls++;
      rerollShop(run);
      continue;
    }
    break;
  }

  tryMergeGridWithGrid(run);
}

export function playSmartBot(levelId, seed = 1000 + levelId * 77) {
  const rng = mulberry32(seed);
  const run = createStageRun(levelId, rng);
  let totalSteps = 0;

  while ((run.phase === 'prep' || run.phase === 'combat') && totalSteps < 40000) {
    if (run.phase === 'prep') {
      smartPrep(run);
      startWave(run);
    } else {
      stepCombat(run, 1 / 30);
      totalSteps++;
    }
  }
  return run;
}

export function playEmptyBot(levelId) {
  const rng = mulberry32(42 + levelId);
  const run = createStageRun(levelId, rng);
  let totalSteps = 0;
  while ((run.phase === 'prep' || run.phase === 'combat') && totalSteps < 20000) {
    if (run.phase === 'prep') startWave(run);
    else {
      stepCombat(run, 1 / 30);
      totalSteps++;
    }
  }
  return run;
}

export function playNoMergeBot(levelId, seed = 500 + levelId * 31) {
  // Simula um jogador que compra peças aleatórias Nv.1 e NÃO usa fusões
  const rng = mulberry32(seed);
  const run = createStageRun(levelId, rng);
  let totalSteps = 0;
  while ((run.phase === 'prep' || run.phase === 'combat') && totalSteps < 30000) {
    if (run.phase === 'prep') {
      expandBestCells(run);
      for (let i = 0; i < 3; i++) {
        const offer = run.shop[i];
        if (!offer || offer.cost > run.gold || offer.tier > 1) continue;
        const pos = findFirstValidPlacement(run.grid, offer.pieceId);
        if (pos) buyShopToGrid(run, i, pos.col, pos.row, pos.rot);
      }
      startWave(run);
    } else {
      stepCombat(run, 1 / 30);
      totalSteps++;
    }
  }
  return run;
}

// Se executado diretamente via `node test/arsenal-bot.js`, imprime relatório detalhado de balanceamento
const isCli = process.argv[1] && process.argv[1].endsWith('arsenal-bot.js');
if (isCli) {
  let wins = 0;
  let emptyWins = 0;
  let noMergeWins = 0;
  for (const lv of LEVELS) {
    const empty = playEmptyBot(lv.id);
    if (empty.phase === 'won') emptyWins++;

    const noMerge = playNoMergeBot(lv.id);
    if (noMerge.phase === 'won') noMergeWins++;

    let res = playSmartBot(lv.id, 1000 + lv.id * 77);
    let tries = 1;
    while (res.phase !== 'won' && tries < 3) {
      res = playSmartBot(lv.id, 2000 + lv.id * 77 + tries * 13);
      tries++;
    }
    if (res.phase === 'won') wins++;
    const hpPct = Math.round((res.wallHp / res.wallMaxHp) * 100);
    const maxT = Math.max(0, ...res.grid.pieces.map((p) => p.tier));
    console.log(
      `F${String(lv.id).padStart(2, '0')} ${lv.title.padEnd(24)} | ${res.phase.padEnd(4)} (${tries}t) | HP ${String(hpPct).padStart(3)}% | ★${res.stars} | peças=${res.grid.pieces.length} maxNv=${maxT} fusões=${res.stats.merges} | semFusão=${noMerge.phase} | vazio=${empty.phase}`
    );
  }
  console.log(`\nResumo Arsenal: ${wins}/40 fases vencidas | sem fusão: ${noMergeWins}/40 | vazias: ${emptyWins}/40`);
  if (wins < 40 || emptyWins > 0) process.exitCode = 1;
}
