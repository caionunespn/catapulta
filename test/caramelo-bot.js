// Bot jogador autônomo para Salve o Caramelo: resolve as fases 1..40 sem ler `hintStroke`.
import assert from 'node:assert/strict';
import {
  ARENA_W,
  ARENA_H,
  WALL_T,
  LEVELS,
  DOGE_RADIUS,
  MIN_STROKE_LEN,
  buildStroke,
  createSim,
  stepSim,
} from '../public/salve-o-caramelo/js/engine.js';

function simulate(lv, pts) {
  const built = buildStroke(pts, lv);
  if (built.length < MIN_STROKE_LEN) return { won: false, reason: 'short', ink: built.length, stars: 0 };
  const sim = createSim(lv, pts);
  for (let i = 0; i < 400 && sim.status === 'running'; i++) stepSim(sim, 1 / 60);
  return {
    won: sim.status === 'won',
    reason: sim.failReason,
    elapsed: sim.elapsed,
    ink: sim.inkUsed,
    stars: sim.stars,
  };
}

// Interpola um arco suave estilo desenho humano com leve oscilação manual
function smoothArch(x1, yBase1, x2, yBase2, topY, curve = 14, jitter = 0) {
  const mx = (x1 + x2) * 0.5;
  return [
    [x1, yBase1],
    [x1 + jitter, topY + curve],
    [x1 + Math.min(curve, (x2 - x1) * 0.25), topY - jitter],
    [mx, topY - 4 + jitter],
    [x2 - Math.min(curve, (x2 - x1) * 0.25), topY + jitter],
    [x2 - jitter, topY + curve],
    [x2, yBase2],
  ];
}

function generateCandidates(lv) {
  const out = [];
  const push = (name, pts) => out.push({ name, pts });

  const doges = lv.doges;
  const xs = doges.map((d) => d.x);
  const ys = doges.map((d) => d.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // 1) Domos e arcos ao redor do(s) Doge(s) com leve imprecisão humana e larguras variadas
  for (const padX of [40, 48, 56, 68]) {
    for (const topPad of [42, 54, 68, 86]) {
      const lx = Math.max(WALL_T + 8, minX - padX);
      const rx = Math.min(ARENA_W - WALL_T - 8, maxX + padX);
      const topY = Math.max(WALL_T + 8, minY - topPad);
      const yBot = Math.min(ARENA_H - 12, maxY + 34);
      const j = (lv.id % 2 === 0 ? 2.5 : -2.5);
      push(`dome(${padX},${topPad})`, smoothArch(lx, yBot, rx, yBot, topY, 14, j));
    }
  }

  // 2) Cápsula fechada por baixo (berço para plataformas muito finas ou suspensas)
  for (const padX of [42, 52]) {
    for (const topPad of [46, 60]) {
      const lx = Math.max(WALL_T + 8, minX - padX);
      const rx = Math.min(ARENA_W - WALL_T - 8, maxX + padX);
      const topY = Math.max(WALL_T + 8, minY - topPad);
      const botY = Math.min(ARENA_H - 12, maxY + 32);
      push(`cradle(${padX},${topPad})`, [
        [lx + 10, botY],
        [lx - 4, (topY + botY) * 0.5],
        [lx + 10, topY],
        [rx - 10, topY],
        [rx + 4, (topY + botY) * 0.5],
        [rx - 10, botY],
        [lx + 10, botY],
      ]);
    }
  }

  // 3) Ganchos em pinos próximos acima ou nas laterais dos Doges
  const pins = lv.pins || [];
  if (pins.length === 1) {
    const p = pins[0];
    for (const dropY of [maxY + 26, maxY + 36, minY + 28]) {
      for (const span of [36, 46, 56, 76, 92]) {
        const lx = Math.max(WALL_T + 8, Math.min(minX - 36, p.x - span));
        const rx = Math.min(ARENA_W - WALL_T - 8, Math.max(maxX + 36, p.x + span));
        const topY = Math.max(WALL_T + 8, Math.min(p.y - p.r - 12, minY - 46));
        push(`pin-hook(${span})`, smoothArch(lx, dropY, rx, dropY, topY, 10));
      }
    }
    // Gancho lateral saindo da esquerda ou direita de um pino (ex.: prateleira / rampa)
    push('pin-latch-right', [
      [p.x - p.r - 8, p.y + 14],
      [p.x - p.r - 8, p.y - p.r - 10],
      [p.x + p.r + 22, p.y - p.r - 10],
      [p.x + p.r + 22, maxY + 28],
    ]);
    push('pin-latch-left', [
      [p.x + p.r + 8, p.y + 14],
      [p.x + p.r + 8, p.y - p.r - 10],
      [p.x - p.r - 22, p.y - p.r - 10],
      [p.x - p.r - 22, maxY + 28],
    ]);
  } else if (pins.length >= 2) {
    const sorted = [...pins].sort((a, b) => a.x - b.x);
    const pL = sorted[0];
    const pR = sorted[sorted.length - 1];
    const topY = Math.max(WALL_T + 8, Math.min(pL.y - pL.r - 12, pR.y - pR.r - 12, minY - 52));
    const botY = Math.min(ARENA_H - 14, maxY + 34);
    push('2pin-arch', smoothArch(pL.x - pL.r - 14, botY, pR.x + pR.r + 14, botY, topY, 12));
    push('2pin-cradle', [
      [pL.x - 10, maxY + 42],
      [pL.x - pL.r - 16, pL.y],
      [pL.x + 8, topY],
      [pR.x - 8, topY],
      [pR.x + pR.r + 16, pR.y],
      [pR.x + 10, maxY + 42],
      [pL.x - 10, maxY + 42],
    ]);
  }

  // 4) Tampões de frestas entre blocos/muros próximos ou paredes da arena
  const boxes = lv.boxes || [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    if (a.y > ARENA_H - 95 && a.w > 200) continue; // ignora o chão principal
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j];
      if (b.y > ARENA_H - 95 && b.w > 200) continue;
      if (Math.abs(a.y - b.y) <= 28) {
        const leftBox = a.x < b.x ? a : b;
        const rightBox = a.x < b.x ? b : a;
        const gap = rightBox.x - (leftBox.x + leftBox.w);
        if (gap >= 30 && gap <= 150) {
          const yBridge = Math.min(leftBox.y, rightBox.y) - 9;
          push(
            `plug(${Math.round(gap)})`,
            [[leftBox.x + leftBox.w - 14, yBridge], [rightBox.x + 14, yBridge]]
          );
        }
      }
    }
    // Tampão entre parede direita/esquerda da arena e bloco em L
    if (a.x > WALL_T + 70 && a.y < 320 && a.w < 160 && a.x + a.w < ARENA_W - WALL_T - 25) {
      const yTop = a.y - 10;
      push('corridor-L-plug', [
        [a.x, yTop],
        [a.x, yTop - 75],
        [ARENA_W - WALL_T - 8, yTop - 75],
      ]);
    }
    // Bloqueio vertical sob prateleira ligada à parede
    if (a.y < minY && a.y + a.h < maxY && a.w >= 60 && a.w <= 160) {
      const edgeX = a.x + a.w * 0.5 < minX ? a.x + a.w + 10 : a.x - 10;
      push('shelf-latch', [
        [edgeX + (edgeX > minX ? -24 : 24), a.y - 10],
        [edgeX, a.y - 10],
        [edgeX, maxY + 26],
      ]);
    }
  }

  // 5) Selar a própria colmeia se houver apenas 1 colmeia sobre plataforma/pino próximo
  if (lv.hives.length === 1) {
    const h = lv.hives[0];
    push('hive-cage', [
      [Math.max(WALL_T + 8, h.x - 40), Math.min(ARENA_H - 18, h.y + 62)],
      [Math.max(WALL_T + 8, h.x - 40), Math.max(WALL_T + 8, h.y - 38)],
      [Math.min(ARENA_W - WALL_T - 8, h.x + 40), Math.max(WALL_T + 8, h.y - 38)],
      [Math.min(ARENA_W - WALL_T - 8, h.x + 40), Math.min(ARENA_H - 18, h.y + 62)],
    ]);
  }

  // 6) Pontes em dois degraus quando há 2 Doges em alturas diferentes
  if (doges.length === 2) {
    const [d1, d2] = [...doges].sort((a, b) => a.x - b.x);
    if (Math.abs(d1.y - d2.y) > 40) {
      const high = d1.y < d2.y ? d1 : d2;
      const low = d1.y < d2.y ? d2 : d1;
      const leftSide = d1.x < d2.x ? -1 : 1;
      push('stepped-twins', [
        [high.x + leftSide * 44, high.y + 24],
        [high.x + leftSide * 44, high.y - 48],
        [(high.x + low.x) * 0.5 - leftSide * 22, high.y - 48],
        [(high.x + low.x) * 0.5, low.y - 52],
        [low.x - leftSide * 44, low.y - 52],
        [low.x - leftSide * 44, low.y + 24],
      ]);
    }
  }

  return out;
}

const results = [];
const failedStages = [];

for (const lv of LEVELS) {
  const candidates = generateCandidates(lv);
  let solved = null;
  let attempts = 0;

  for (const cand of candidates) {
    attempts++;
    const res = simulate(lv, cand.pts);
    if (res.won) {
      solved = { ...res, strategy: cand.name, attempts };
      break;
    }
  }

  if (!solved) {
    failedStages.push({ id: lv.id, title: lv.title, attempts, inkMax: lv.inkMax });
  } else {
    results.push({ id: lv.id, title: lv.title, ...solved, inkMax: lv.inkMax });
  }
}

for (const r of results) {
  console.log(
    `L${String(r.id).padStart(2, '0')} ${r.title.padEnd(26, ' ')} ` +
      `OK em ${String(r.attempts).padStart(2, ' ')} tent. | ${r.strategy.padEnd(18, ' ')} | ` +
      `${r.stars}★ (${Math.round(r.ink)}/${r.inkMax})`
  );
}

console.log(`\nResumo bot autônomo: ${results.length}/${LEVELS.length} fases vencidas.`);
if (failedStages.length > 0) {
  console.error('FASES NÃO RESOLVIDAS PELO BOT:', failedStages);
  process.exitCode = 1;
}
