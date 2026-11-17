import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  MAX_CRASHES,
  VEHICLE_COLORS,
  CHAPTERS,
  LEVELS,
  evaluateExit,
  computeStars,
  findNextHint,
  getLevel,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_estacionamento_v1';

const ARENA = 420;
const ROAD = 46;
const LOT_X = ROAD;
const LOT_Y = ROAD;
const LOT_SIZE = ARENA - ROAD * 2; // 328
const GATE_POS = { x: ARENA - 16, y: 23 };

const COLOR_MAP = Object.fromEntries(VEHICLE_COLORS.map((c) => [c.id, c]));

let saved = { level: 1, stars: {} };
try {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (raw && typeof raw === 'object') {
    saved = {
      level: Number(raw.level) >= 1 && Number(raw.level) <= LEVELS.length ? Number(raw.level) : 1,
      stars: raw.stars && typeof raw.stars === 'object' ? raw.stars : {},
    };
  }
} catch {}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {}
}

function getLevelStars(id) {
  return Number(saved.stars[String(id)]) || 0;
}

function totalStars() {
  let sum = 0;
  for (const lv of LEVELS) sum += getLevelStars(lv.id);
  return sum;
}

const state = {
  levelId: saved.level,
  level: getLevel(saved.level),
  vehicles: [],
  crashes: 0,
  phase: 'play', // 'play' | 'won' | 'lost'
  selectedId: null,
  hint: null,
  exiting: [], // { v, waypoints, segIdx, segT, speed, angle }
  crashing: null, // { id, dir, sign, distPx, t, dur, blockerId, hitX, hitY }
  sparks: [], // { x, y, vx, vy, r, life, maxLife, color }
  drag: null, // { id, pointerId, startX, startY, offsetPx, launched }
  arrowHandles: [], // { sign, x, y, r }
  animTime: 0,
  lastTs: 0,
  rafId: 0,
  winTimer: null,
  loseTimer: null,
  modal: null, // null | 'map' | 'rules'
  rulesTab: 'rules',
};

const canvas = $('#pk-canvas');
const ctx = canvas.getContext('2d');
const staticCanvas = document.createElement('canvas');
const staticCtx = staticCanvas.getContext('2d');
let renderDpr = 0;

function ensureCanvasScale() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (renderDpr === dpr) return;
  renderDpr = dpr;
  canvas.width = Math.round(ARENA * dpr);
  canvas.height = Math.round(ARENA * dpr);
  staticCanvas.width = Math.round(ARENA * dpr);
  staticCanvas.height = Math.round(ARENA * dpr);
  buildStaticLayer();
}

function cellSize() {
  return LOT_SIZE / state.level.size;
}

function vehicleBox(v) {
  const cs = cellSize();
  const x = LOT_X + v.c * cs;
  const y = LOT_Y + v.r * cs;
  const w = v.dir === 'H' ? cs * v.len : cs;
  const h = v.dir === 'V' ? cs * v.len : cs;
  return { x, y, w, h, cx: x + w * 0.5, cy: y + h * 0.5 };
}

function roundRect(c, x, y, w, h, r) {
  if (!(w > 0 && h > 0)) return;
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawCurbBarrier(c, x, y, w, h) {
  c.save();
  c.fillStyle = '#f7b733';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  roundRect(c, x, y, w, h, 3);
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = '#14202b';
  const step = 12;
  for (let d = -Math.max(w, h); d < w + h; d += step) {
    c.beginPath();
    c.moveTo(x + d, y);
    c.lineTo(x + d + 6, y);
    c.lineTo(x + d - 6, y + h);
    c.lineTo(x + d - 12, y + h);
    c.closePath();
    c.fill();
  }
  c.restore();
  roundRect(c, x, y, w, h, 3);
  c.stroke();
  c.restore();
}

function drawCone(c, cx, cy, cs) {
  const r = Math.min(13, cs * 0.27);
  c.save();
  c.translate(cx, cy);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath();
  c.ellipse(1, 3, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#e5482f';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  roundRect(c, -r, -r, r * 2, r * 2, 5);
  c.fill();
  c.stroke();

  c.fillStyle = '#ff7b3b';
  c.beginPath();
  c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.fillStyle = '#fff8ea';
  c.beginPath();
  c.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e5482f';
  c.beginPath();
  c.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function buildStaticLayer() {
  const dpr = renderDpr || 1;
  const c = staticCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Anel viário externo (asfalto escuro)
  c.fillStyle = '#1b2632';
  c.fillRect(0, 0, ARENA, ARENA);

  // Linha amarela tracejada da pista externa
  c.save();
  c.strokeStyle = 'rgba(247, 183, 51, 0.48)';
  c.lineWidth = 2.4;
  c.setLineDash([12, 10]);
  c.strokeRect(ROAD * 0.5, ROAD * 0.5, ARENA - ROAD, ARENA - ROAD);
  c.restore();

  // Setas direcionais na pista (sentido horário até a saída!)
  c.fillStyle = 'rgba(246, 232, 200, 0.35)';
  const roadArrow = (x, y, ang) => {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.beginPath();
    c.moveTo(8, 0);
    c.lineTo(-4, -5);
    c.lineTo(-4, 5);
    c.closePath();
    c.fill();
    c.restore();
  };
  roadArrow(130, 23, 0);
  roadArrow(260, 23, 0);
  roadArrow(ARENA - 23, 210, -Math.PI * 0.5);
  roadArrow(ARENA - 23, 340, -Math.PI * 0.5);
  roadArrow(210, ARENA - 23, 0);
  roadArrow(23, 210, -Math.PI * 0.5);

  // Portão SAÍDA no canto superior direito
  c.save();
  c.fillStyle = '#3bab6a';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  roundRect(c, ARENA - 64, 6, 56, 18, 5);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff8ea';
  c.font = '700 10px "Barlow Condensed", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('SAÍDA ▶', ARENA - 36, 15.5);
  c.restore();

  // Pátio interno de estacionamento
  c.fillStyle = '#2d3f51';
  roundRect(c, LOT_X, LOT_Y, LOT_SIZE, LOT_SIZE, 6);
  c.fill();

  const n = state.level.size;
  const cs = LOT_SIZE / n;

  // Grade das vagas
  c.strokeStyle = 'rgba(246, 232, 200, 0.2)';
  c.lineWidth = 1.6;
  for (let i = 1; i < n; i++) {
    const p = LOT_X + i * cs;
    c.beginPath();
    c.moveTo(p, LOT_Y + 4);
    c.lineTo(p, LOT_Y + LOT_SIZE - 4);
    c.moveTo(LOT_X + 4, p);
    c.lineTo(LOT_X + LOT_SIZE - 4, p);
    c.stroke();
  }

  // Contorno tracejado sutil das saídas abertas
  c.strokeStyle = 'rgba(246, 232, 200, 0.36)';
  c.lineWidth = 2.2;
  c.strokeRect(LOT_X, LOT_Y, LOT_SIZE, LOT_SIZE);

  // Muretas amarelas/pretas nos trechos bloqueados das bordas
  const be = state.level.blockedEdges || {};
  const barT = 9;
  for (const idx of be.top || []) {
    drawCurbBarrier(c, LOT_X + idx * cs + 3, LOT_Y - barT * 0.5, cs - 6, barT);
  }
  for (const idx of be.bottom || []) {
    drawCurbBarrier(c, LOT_X + idx * cs + 3, LOT_Y + LOT_SIZE - barT * 0.5, cs - 6, barT);
  }
  for (const idx of be.left || []) {
    drawCurbBarrier(c, LOT_X - barT * 0.5, LOT_Y + idx * cs + 3, barT, cs - 6);
  }
  for (const idx of be.right || []) {
    drawCurbBarrier(c, LOT_X + LOT_SIZE - barT * 0.5, LOT_Y + idx * cs + 3, barT, cs - 6);
  }

  // Cones nos bloqueios internos
  for (const cn of state.level.cones || []) {
    drawCone(c, LOT_X + (cn.c + 0.5) * cs, LOT_Y + (cn.r + 0.5) * cs, cs);
  }
}

function drawVehicleAt(c, v, cx, cy, angle, cs, highlight = false, isHint = false) {
  const pal = COLOR_MAP[v.color] || VEHICLE_COLORS[0];
  const lengthPx = v.type === 'moto' ? cs * 0.78 : cs * v.len - 10;
  const widthPx = v.type === 'moto' ? cs * 0.44 : v.type === 'truck' ? cs * 0.74 : cs * 0.68;
  const hl = lengthPx * 0.5;
  const hw = widthPx * 0.5;

  c.save();
  c.translate(cx, cy);
  c.rotate(angle);

  // Halo de dica ou seleção
  if (isHint || highlight) {
    c.save();
    c.strokeStyle = isHint ? '#f7b733' : '#fff8ea';
    c.lineWidth = 3.2;
    roundRect(c, -hl - 4, -hw - 4, lengthPx + 8, widthPx + 8, 10);
    c.stroke();
    c.restore();
  }

  // Sombra
  c.fillStyle = 'rgba(0, 0, 0, 0.34)';
  roundRect(c, -hl + 2, -hw + 3, lengthPx, widthPx, v.type === 'moto' ? 8 : 9);
  c.fill();

  if (v.type === 'moto') {
    // Pneus dianteiro e traseiro
    c.fillStyle = '#14202b';
    roundRect(c, -hl - 2, -hw * 0.35, lengthPx + 4, widthPx * 0.35, 3);
    c.fill();

    // Escapamento prata
    c.fillStyle = '#9fb0c4';
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.6;
    roundRect(c, -hl + 1, hw * 0.22, hl * 0.85, 4.5, 2);
    c.fill();
    c.stroke();

    // Corpo / tanque colorido
    c.fillStyle = pal.body;
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.2;
    roundRect(c, -hl * 0.72, -hw * 0.68, lengthPx * 0.68, widthPx * 0.68, 7);
    c.fill();
    c.stroke();

    // Guidão largo na frente (+X)
    c.strokeStyle = '#14202b';
    c.lineWidth = 3.6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(hl * 0.44, -hw * 0.92);
    c.lineTo(hl * 0.54, 0);
    c.lineTo(hl * 0.44, hw * 0.92);
    c.stroke();

    // Banco escuro do piloto
    c.fillStyle = '#243546';
    roundRect(c, -hl * 0.48, -hw * 0.44, lengthPx * 0.32, widthPx * 0.44, 4);
    c.fill();

    // Farol dianteiro amarelo e lanterna traseira vermelha
    c.fillStyle = '#ffe57a';
    c.beginPath();
    c.arc(hl * 0.75, 0, 3.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ff4b3a';
    c.beginPath();
    c.arc(-hl * 0.82, 0, 2.3, 0, Math.PI * 2);
    c.fill();
  } else if (v.type === 'truck') {
    // Rodas nas laterais
    c.fillStyle = '#14202b';
    for (const wx of [-hl * 0.66, -hl * 0.12, hl * 0.62]) {
      c.fillRect(wx - 6, -hw - 2.5, 12, 4);
      c.fillRect(wx - 6, hw - 1.5, 12, 4);
    }

    // Caçamba traseira creme com listra da cor
    const cargoW = lengthPx * 0.66;
    c.fillStyle = '#f6e8c8';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.4;
    roundRect(c, -hl, -hw, cargoW, widthPx, 6);
    c.fill();
    c.fillStyle = pal.body;
    c.fillRect(-hl + 5, -hw + 4, cargoW - 10, widthPx - 8);
    c.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let rx = -hl + 12; rx < -hl + cargoW - 10; rx += 12) {
      c.fillRect(rx, -hw + 6, 3, widthPx - 12);
    }
    roundRect(c, -hl, -hw, cargoW, widthPx, 6);
    c.stroke();

    // Cabine dianteira (+X)
    const cabX = -hl + cargoW + 2;
    const cabW = lengthPx - cargoW - 2;
    c.fillStyle = pal.body;
    roundRect(c, cabX, -hw + 1, cabW, widthPx - 2, 7);
    c.fill();
    c.stroke();

    // Para-brisa largo da cabine
    c.fillStyle = '#b9dcff';
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.6;
    roundRect(c, cabX + cabW * 0.38, -hw + 5, cabW * 0.42, widthPx - 10, 3.5);
    c.fill();
    c.stroke();

    // Faróis dianteiros e lanternas traseiras
    c.fillStyle = '#ffe57a';
    c.fillRect(hl - 3, -hw + 4, 3, 5);
    c.fillRect(hl - 3, hw - 9, 3, 5);
    c.fillStyle = '#e5482f';
    c.fillRect(-hl, -hw + 4, 2.5, 5);
    c.fillRect(-hl, hw - 9, 2.5, 5);
  } else {
    // Carro 1x2
    c.fillStyle = '#14202b';
    for (const wx of [-hl * 0.56, hl * 0.52]) {
      c.fillRect(wx - 5.5, -hw - 2, 11, 3.5);
      c.fillRect(wx - 5.5, hw - 1.5, 11, 3.5);
    }

    // Carroceria arredondada
    c.fillStyle = pal.body;
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.4;
    roundRect(c, -hl, -hw, lengthPx, widthPx, 10);
    c.fill();
    c.stroke();

    // Teto mais claro e vidros
    c.fillStyle = '#1c3144';
    roundRect(c, -hl * 0.52, -hw + 5, lengthPx * 0.58, widthPx - 10, 6);
    c.fill();

    c.fillStyle = pal.trim;
    roundRect(c, -hl * 0.28, -hw + 6.5, lengthPx * 0.3, widthPx - 13, 4);
    c.fill();

    // Faróis na frente e lanternas atrás
    c.fillStyle = '#ffe57a';
    c.beginPath();
    c.arc(hl - 3.5, -hw + 6, 3, 0, Math.PI * 2);
    c.arc(hl - 3.5, hw - 6, 3, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#ff4b3a';
    c.fillRect(-hl + 1, -hw + 4.5, 2.6, 5);
    c.fillRect(-hl + 1, hw - 9.5, 2.6, 5);
  }

  // Seta sutil indicando direção da faixa dentro do veículo
  c.fillStyle = 'rgba(20, 32, 43, 0.42)';
  c.beginPath();
  c.moveTo(4, 0);
  c.lineTo(-3, -3.5);
  c.lineTo(-3, 3.5);
  c.closePath();
  c.fill();

  c.restore();
}

function drawArrowBadge(c, x, y, angle, activeColor = '#f7b733') {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = activeColor;
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, 12, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.fillStyle = '#14202b';
  c.beginPath();
  c.moveTo(5, 0);
  c.lineTo(-3.5, -5);
  c.lineTo(-3.5, 5);
  c.closePath();
  c.fill();
  c.restore();
}

function drawFrame() {
  ensureCanvasScale();
  const dpr = renderDpr || 1;
  const c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.drawImage(staticCanvas, 0, 0, ARENA, ARENA);

  const cs = cellSize();
  state.arrowHandles = [];

  // Desenha veículos ainda estacionados
  for (const v of state.vehicles) {
    const box = vehicleBox(v);
    let ox = 0;
    let oy = 0;
    let shakeX = 0;
    let shakeY = 0;

    if (state.drag && state.drag.id === v.id) {
      if (v.dir === 'H') ox = state.drag.offsetPx;
      else oy = state.drag.offsetPx;
    }

    if (state.crashing) {
      const cr = state.crashing;
      if (cr.id === v.id) {
        const half = cr.dur * 0.4;
        const k = cr.t < half ? cr.t / half : Math.max(0, 1 - (cr.t - half) / (cr.dur - half));
        const slide = k * cr.distPx;
        if (cr.dir === 'H') ox += cr.sign * slide;
        else oy += cr.sign * slide;
      } else if (cr.blockerId === v.id && cr.t >= cr.dur * 0.35) {
        const s = Math.sin(cr.t * 85) * 3;
        shakeX = s;
        shakeY = -s * 0.5;
      }
    }

    const frontSign = v.front || 1;
    const baseAngle = v.dir === 'H' ? (frontSign > 0 ? 0 : Math.PI) : frontSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    const isSel = state.selectedId === v.id && state.phase === 'play';
    const isHint = !!(state.hint && state.hint.id === v.id && state.phase === 'play');

    drawVehicleAt(c, v, box.cx + ox + shakeX, box.cy + oy + shakeY, baseAngle, cs, isSel, isHint);

    // Setas clicáveis para usuário de toque/clique no veículo selecionado ou destacado pela Dica
    if (isSel || isHint) {
      const lenPx = (v.type === 'moto' ? cs * 0.78 : cs * v.len - 10) * 0.5 + 15;
      for (const sgn of [-1, 1]) {
        if (isHint && state.hint.sign !== sgn) continue;
        const ax = box.cx + (v.dir === 'H' ? sgn * lenPx : 0);
        const ay = box.cy + (v.dir === 'V' ? sgn * lenPx : 0);
        const ang = v.dir === 'H' ? (sgn > 0 ? 0 : Math.PI) : sgn > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const pulse = isHint ? 1 + Math.sin(state.animTime * 8) * 0.08 : 1;
        c.save();
        c.translate(ax, ay);
        c.scale(pulse, pulse);
        drawArrowBadge(c, 0, 0, ang, isHint ? '#f7b733' : '#fff8ea');
        c.restore();
        if (isSel || isHint) state.arrowHandles.push({ id: v.id, sign: sgn, x: ax, y: ay, r: 16 });
      }
    }
  }

  // Veículos saindo pela pista externa até o portão
  for (const ex of state.exiting) {
    drawVehicleAt(c, ex.v, ex.x, ex.y, ex.angle, cs, false, false);
  }

  // Faíscas e estrelas de batida
  for (const sp of state.sparks) {
    const a = Math.max(0, Math.min(1, sp.life / sp.maxLife));
    c.save();
    c.globalAlpha = a;
    c.fillStyle = sp.color;
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(sp.x, sp.y, sp.r * (0.4 + 0.6 * a), 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  // Estrela cômica "POW!" no ponto exato da batida
  if (state.crashing && state.crashing.t >= state.crashing.dur * 0.35 && state.crashing.t <= state.crashing.dur * 0.92) {
    const cr = state.crashing;
    c.save();
    c.translate(cr.hitX, cr.hitY);
    c.rotate(Math.sin(cr.t * 20) * 0.15);
    c.fillStyle = '#f7b733';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const rad = i % 2 === 0 ? 18 : 9;
      const a = (i / 12) * Math.PI * 2;
      if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#e5482f';
    c.font = '900 10px "Bungee", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('POW!', 0, 1);
    c.restore();
  }
}

function buildExitWaypoints(v, edgeSide, cx, cy) {
  const pts = [{ x: cx, y: cy }];
  const rMid = ROAD * 0.5;
  const ringTop = rMid;
  const ringRight = ARENA - rMid;
  const ringBot = ARENA - rMid;
  const ringLeft = rMid;

  if (edgeSide === 'top') {
    pts.push({ x: cx, y: ringTop });
    pts.push({ x: ringRight, y: ringTop });
  } else if (edgeSide === 'right') {
    pts.push({ x: ringRight, y: cy });
    pts.push({ x: ringRight, y: ringTop });
  } else if (edgeSide === 'bottom') {
    pts.push({ x: cx, y: ringBot });
    pts.push({ x: ringRight, y: ringBot });
    pts.push({ x: ringRight, y: ringTop });
  } else {
    pts.push({ x: ringLeft, y: cy });
    pts.push({ x: ringLeft, y: ringTop });
    pts.push({ x: ringRight, y: ringTop });
  }
  pts.push({ x: ARENA + 44, y: ringTop });
  return pts;
}

function spawnCrashSparks(x, y) {
  for (let i = 0; i < 10 && state.sparks.length < 70; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const spd = 70 + Math.random() * 110;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 3 + Math.random() * 2.5,
      life: 0.34,
      maxLife: 0.34,
      color: i % 2 === 0 ? '#e5482f' : '#f7b733',
    });
  }
}

function launchVehicle(id, sign) {
  if (state.phase !== 'play') return;
  if (state.crashing && state.crashing.id === id) return;
  const v = state.vehicles.find((x) => x.id === id);
  if (!v) return;

  const res = evaluateExit(state.vehicles, id, sign, state.level);
  const box = vehicleBox(v);
  const cs = cellSize();

  if (res.ok) {
    state.vehicles = state.vehicles.filter((x) => x.id !== id);
    if (state.selectedId === id) state.selectedId = null;
    if (state.hint && state.hint.id === id) state.hint = null;

    const waypoints = buildExitWaypoints(v, res.edgeSide, box.cx, box.cy);
    const frontSign = v.front || 1;
    const startAng = v.dir === 'H' ? (frontSign > 0 ? 0 : Math.PI) : frontSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

    state.exiting.push({
      v,
      waypoints,
      wpIdx: 0,
      x: box.cx,
      y: box.cy,
      angle: startAng,
      speed: 440,
    });

    sfx.vroom(v.len === 1 ? 'moto' : v.len === 3 ? 'truck' : 'car');
    updateHUD();
    scheduleAnim();

    if (state.vehicles.length === 0) {
      clearTimeout(state.winTimer);
      state.winTimer = setTimeout(handleWin, 320);
    }
  } else {
    state.crashes++;
    const stepPx = Math.max(10, res.steps * cs + 6);
    const hitX = box.cx + (v.dir === 'H' ? sign * (box.w * 0.5 + res.steps * cs) : 0);
    const hitY = box.cy + (v.dir === 'V' ? sign * (box.h * 0.5 + res.steps * cs) : 0);

    state.crashing = {
      id: v.id,
      dir: v.dir,
      sign,
      distPx: stepPx,
      t: 0,
      dur: 0.34,
      blockerId: res.blockerId || null,
      hitX,
      hitY,
    };

    sfx.crash();
    shake($('#pk-stage'), 0.9);
    spawnCrashSparks(hitX, hitY);
    updateHUD();
    scheduleAnim();

    if (state.crashes >= MAX_CRASHES) {
      state.phase = 'lost';
      clearTimeout(state.loseTimer);
      state.loseTimer = setTimeout(() => {
        sfx.err();
        showOverlay();
      }, 360);
    }
  }
}

function handleWin() {
  if (state.phase !== 'play') return;
  state.phase = 'won';
  const stars = computeStars(state.crashes);
  const key = String(state.level.id);
  const prev = Number(saved.stars[key]) || 0;
  if (stars > prev) saved.stars[key] = stars;
  saveProgress();

  sfx.win();
  confetti(75);
  const rect = canvas.getBoundingClientRect();
  burst({ x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.45 }, '#f7b733', 18);
  updateHUD();
  showOverlay();
}

const hudCache = {
  lvlKey: '',
  starsKey: '',
  crashKey: '',
  remKey: '',
  statusKey: '',
  hintKey: '',
};

function updateHUD() {
  const lv = state.level;
  const lvlKey = `${lv.id}|${lv.title}`;
  if (hudCache.lvlKey !== lvlKey) {
    hudCache.lvlKey = lvlKey;
    $('#pk-level-num').textContent = `FASE ${lv.id} / ${LEVELS.length}`;
    $('#pk-level-name').textContent = lv.title;
    $('#btn-prev').disabled = lv.id <= 1;
    $('#btn-next').disabled = lv.id >= LEVELS.length;
  }

  const starsKey = `${totalStars()}`;
  if (hudCache.starsKey !== starsKey) {
    hudCache.starsKey = starsKey;
    $('#pk-total-stars').textContent = `★ ${starsKey}/${LEVELS.length * 3}`;
  }

  const crashKey = `${state.crashes}`;
  if (hudCache.crashKey !== crashKey) {
    hudCache.crashKey = crashKey;
    $('#pk-crashes-txt').textContent = `${state.crashes}/${MAX_CRASHES}`;
    document.querySelectorAll('#pk-crashes-pips .pk-pip').forEach((pip, idx) => {
      pip.classList.toggle('hit', idx < state.crashes);
    });
  }

  const remKey = `${state.vehicles.length}`;
  if (hudCache.remKey !== remKey) {
    hudCache.remKey = remKey;
    $('#pk-rem-pill').innerHTML = `Veículos: <b>${state.vehicles.length}</b>`;
  }

  let stCls;
  let stHtml;
  if (state.phase === 'won') {
    const st = computeStars(state.crashes);
    stCls = 'pk-status-bar win';
    stHtml = `${ico('crown', 's')} Fase ${lv.id} limpa com <b>${st} estrela${st > 1 ? 's' : ''}</b>!`;
  } else if (state.phase === 'lost') {
    stCls = 'pk-status-bar err';
    stHtml = `${ico('nope', 's')} Limite de 3 batidas atingido! Tente outra ordem.`;
  } else if (state.crashes > 0) {
    const remC = MAX_CRASHES - state.crashes;
    stCls = 'pk-status-bar err';
    stHtml = `${ico('nope', 's')} Cuidado! Restam apenas <b>${remC}</b> batida${remC > 1 ? 's' : ''}.`;
  } else {
    stCls = 'pk-status-bar';
    stHtml = 'Arraste um veículo na direção livre para sair pela borda!';
  }
  const statusKey = `${stCls}|${stHtml}`;
  if (hudCache.statusKey !== statusKey) {
    hudCache.statusKey = statusKey;
    const statusEl = $('#pk-status');
    statusEl.className = stCls;
    statusEl.innerHTML = stHtml;
  }

  const hintKey = `${state.hint ? 1 : 0}|${state.phase !== 'play' || state.vehicles.length === 0 ? 1 : 0}`;
  if (hudCache.hintKey !== hintKey) {
    hudCache.hintKey = hintKey;
    const hintBtn = $('#btn-hint');
    if (hintBtn) {
      hintBtn.classList.toggle('on', !!state.hint);
      hintBtn.disabled = state.phase !== 'play' || state.vehicles.length === 0;
    }
  }
}

function showOverlay() {
  const overlay = $('#pk-overlay');
  const titleEl = $('#pk-res-title');
  const starsEl = $('#pk-res-stars');
  const subEl = $('#pk-res-sub');
  const nextBtn = $('#btn-res-next');
  const retryBtn = $('#btn-res-retry');

  if (state.phase === 'won') {
    const stars = computeStars(state.crashes);
    titleEl.textContent = state.level.id === LEVELS.length ? 'Todas as 40 Fases Limpas!' : 'Pátio Limpo!';
    titleEl.className = 'pk-result-title';
    starsEl.innerHTML = [1, 2, 3]
      .map((n) => `<span class="pk-result-star ${n <= stars ? '' : 'off'}">${ico('star', 'l')}</span>`)
      .join('');
    subEl.textContent =
      state.crashes === 0
        ? `Perfeito! Saiu tudo sem nenhuma batida!`
        : `Passou com ${state.crashes} batida${state.crashes > 1 ? 's' : ''}.`;
    nextBtn.textContent = state.level.id < LEVELS.length ? 'Próxima Fase →' : 'Voltar à Fase 1';
    retryBtn.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else if (state.phase === 'lost') {
    titleEl.textContent = 'Bateu 3 Vezes!';
    titleEl.className = 'pk-result-title fail';
    starsEl.innerHTML = '';
    subEl.textContent = 'Observe quais caminhões, cones e muretas bloqueiam a passagem antes de acelerar.';
    nextBtn.textContent = 'Tentar de Novo';
    retryBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function needsAnimation() {
  return state.exiting.length > 0 || state.crashing !== null || state.sparks.length > 0 || state.hint !== null;
}

function scheduleAnim() {
  if (!needsAnimation()) {
    drawFrame();
    return;
  }
  startLoop();
}

function loadLevel(id) {
  clearTimeout(state.winTimer);
  clearTimeout(state.loseTimer);
  state.levelId = Math.max(1, Math.min(LEVELS.length, Number(id) || 1));
  state.level = getLevel(state.levelId);
  saved.level = state.levelId;
  saveProgress();

  state.vehicles = state.level.vehicles.map((v) => ({ ...v }));
  state.crashes = 0;
  state.phase = 'play';
  state.selectedId = null;
  state.hint = null;
  state.exiting = [];
  state.crashing = null;
  state.sparks = [];
  state.drag = null;

  buildStaticLayer();
  showOverlay();
  updateHUD();
  drawFrame();
}

function startLoop() {
  if (state.rafId) return;
  state.lastTs = 0;
  const tick = (ts) => {
    state.rafId = 0;
    if (document.hidden) {
      state.lastTs = ts;
      if (needsAnimation()) state.rafId = requestAnimationFrame(tick);
      return;
    }
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
    state.lastTs = ts;
    state.animTime += dt;

    // Avança carros saindo pela pista externa
    for (let i = state.exiting.length - 1; i >= 0; i--) {
      const ex = state.exiting[i];
      let move = ex.speed * dt;
      while (move > 0 && ex.wpIdx < ex.waypoints.length - 1) {
        const tgt = ex.waypoints[ex.wpIdx + 1];
        const dx = tgt.x - ex.x;
        const dy = tgt.y - ex.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
          ex.x = tgt.x;
          ex.y = tgt.y;
          move -= d;
          ex.wpIdx++;
        } else {
          ex.x += (dx / d) * move;
          ex.y += (dy / d) * move;
          const targetAng = Math.atan2(dy, dx);
          let diff = targetAng - ex.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ex.angle += diff * Math.min(1, 16 * dt);
          move = 0;
        }
      }
      if (ex.wpIdx >= ex.waypoints.length - 1) {
        state.exiting.splice(i, 1);
      }
    }

    if (state.crashing) {
      state.crashing.t += dt;
      if (state.crashing.t >= state.crashing.dur) {
        state.crashing = null;
      }
    }

    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const sp = state.sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        state.sparks.splice(i, 1);
        continue;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= 0.92;
      sp.vy *= 0.92;
    }

    drawFrame();
    if (needsAnimation()) {
      state.rafId = requestAnimationFrame(tick);
    }
  };
  state.rafId = requestAnimationFrame(tick);
}

function arenaCoords(e) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: ((e.clientX - rect.left) / rect.width) * ARENA,
    y: ((e.clientY - rect.top) / rect.height) * ARENA,
  };
}

function findVehicleAt(x, y) {
  for (const v of state.vehicles) {
    const b = vehicleBox(v);
    if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3) {
      return v;
    }
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.phase !== 'play' || state.modal) return;
  const pt = arenaCoords(e);

  // Primeiro checa se clicou numa das setas de direção visíveis
  for (const ah of state.arrowHandles) {
    if ((pt.x - ah.x) ** 2 + (pt.y - ah.y) ** 2 <= ah.r * ah.r) {
      launchVehicle(ah.id, ah.sign);
      return;
    }
  }

  const hit = findVehicleAt(pt.x, pt.y);
  if (!hit) {
    if (state.selectedId) {
      state.selectedId = null;
      drawFrame();
    }
    return;
  }

  const changedSel = state.selectedId !== hit.id;
  state.selectedId = hit.id;
  if (changedSel) sfx.click();
  state.drag = {
    id: hit.id,
    dir: hit.dir,
    pointerId: e.pointerId,
    startX: pt.x,
    startY: pt.y,
    offsetPx: 0,
    launched: false,
    changedSel,
  };
  canvas.setPointerCapture?.(e.pointerId);
  if (!state.rafId) drawFrame();
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.drag || e.pointerId !== state.drag.pointerId || state.drag.launched || state.phase !== 'play') return;
  const pt = arenaCoords(e);
  const delta = state.drag.dir === 'H' ? pt.x - state.drag.startX : pt.y - state.drag.startY;
  state.drag.offsetPx = Math.max(-14, Math.min(14, delta * 0.6));

  if (Math.abs(delta) >= 16) {
    const id = state.drag.id;
    const sign = delta > 0 ? 1 : -1;
    state.drag.launched = true;
    state.drag = null;
    launchVehicle(id, sign);
  } else if (!state.rafId) {
    drawFrame();
  }
});

function endDrag(e) {
  if (!state.drag) return;
  if (e && e.pointerId !== undefined && e.pointerId !== state.drag.pointerId) return;
  const { id, dir, startX, startY, launched, changedSel } = state.drag;
  state.drag = null;
  if (launched || state.phase !== 'play') return;
  if (e) {
    const pt = arenaCoords(e);
    const delta = dir === 'H' ? pt.x - startX : pt.y - startY;
    if (Math.abs(delta) >= 11) {
      launchVehicle(id, delta > 0 ? 1 : -1);
      return;
    }
  }
  if (!changedSel) sfx.click();
  if (!state.rafId) drawFrame();
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => {
  if (!state.drag) return;
  state.drag = null;
  if (!state.rafId) drawFrame();
});

// ---------- Modais (Mapa de 40 fases + Regras & Créditos) ----------
function modal(kind, body) {
  return `<div class="modal" data-kind="${kind}" role="dialog" aria-modal="true">${body}</div>`;
}

function mapModal() {
  const chaptersHtml = CHAPTERS.map((ch) => {
    const tiles = LEVELS.filter((l) => l.chapter === ch.id)
      .map((l) => {
        const st = getLevelStars(l.id);
        const cur = l.id === state.level.id ? ' current' : '';
        const done = st > 0 ? ' done' : '';
        const starsHtml = [1, 2, 3].map((n) => `<span class="${n <= st ? 'on' : 'off'}">★</span>`).join('');
        return `<button type="button" class="pk-lvl-tile${cur}${done}" data-act="pick-level" data-level="${l.id}" title="${l.title}"><span>${l.id}</span><span class="pk-tile-stars">${starsHtml}</span></button>`;
      })
      .join('');
    return `<div><h3 class="pk-chap-title">${ch.name}</h3><div class="pk-map-grid">${tiles}</div></div>`;
  }).join('');

  return modal(
    'rules',
    `<h2>Fases (${totalStars()} / ${LEVELS.length * 3} ★)</h2>
     <p class="hint">Escolha qualquer uma das 40 fases para jogar ou buscar 3 estrelas (0 batidas).</p>
     <div class="pk-chapters">${chaptersHtml}</div>
     <div class="row"><button type="button" class="btn yellow" data-act="close">Fechar</button></div>`
  );
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — raciocínio e arcade feitos na unha direto no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('bolt', 's')}40 Pátios Verificados</span>
             <p>Todas as 40 fases combinam motos ágeis, carros, caminhões longos, cones e muretas — todas com solução comprovada em <b>0 batidas</b>.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('star', 'l')}<div><b>Ranking por Estrelas</b><span>3★ sem bater, 2★ com 1 batida e 1★ com 2 batidas. Na 3ª batida você perde!</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Dica Inteligente</b><span>Preso no trânsito? O botão Dica aponta um veículo com saída livre neste momento.</span></div></div>
         </div>
       </div>
       <div class="row"><button type="button" class="btn yellow" data-act="close">Fechar</button></div>`
    );
  }

  return modal(
    'rules',
    `${tabs}
     <h2>Como joga</h2>
     <div class="rules-guide">
       <div class="rules-goal">
         ${ico('crown', 'l')}
         <div>
           <b>Objetivo: esvaziar o estacionamento com até 3 batidas!</b>
           <span>Cada moto, carro ou caminhão só anda no sentido da própria vaga (frente ou ré). Encontre a ordem certa para ninguém colidir!</span>
         </div>
       </div>

       <h3 class="rules-sec">1. Controles e obstáculos</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('hand', 'l')}
           <b>Arraste ou Toque</b>
           <small>Deslize o veículo na direção da saída ou toque nele e escolha uma das setas.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('nope', 'l')}
           <b>Cones &amp; Muretas</b>
           <small>Frente fechada com mureta listrada ou cone bloqueia a passagem — saia de ré!</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('star', 'l')}
           <b>Limite de 3 Batidas</b>
           <small>Bater em outro veículo, cone ou mureta conta 1 batida. Na 3ª, a fase reinicia.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Atalhos úteis</h3>
       <div class="rules-specials">
         <div class="spec-card">${ico('bulb', 'l')}<div><b>Dica (H) &amp; Teclado</b><span>Selecione com o clique e use as <b>Setas</b> para acelerar.</span></div></div>
         <div class="spec-card">${ico('reset', 'l')}<div><b>Reiniciar rápido</b><span>Tecla <b>R</b> recomeça a fase e <b>Espaço/Enter</b> avança ao vencer.</span></div></div>
       </div>
     </div>
     <div class="row"><button type="button" class="btn yellow" data-act="close">Fechar</button></div>`
  );
}

function renderModal() {
  const root = $('#modal-root');
  if (!state.modal) {
    root.innerHTML = '';
    return;
  }
  root.innerHTML = state.modal === 'map' ? mapModal() : rulesModal();
}

// ---------- Decoração & eventos globais ----------
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

document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
$('#btn-rules').innerHTML = ico('help');
$('#btn-bottom-rules').innerHTML = `${ico('help', 's')}Como joga`;
$('#btn-bottom-about').innerHTML = `${ico('info', 's')}Sobre e créditos`;
$('#btn-hint').innerHTML = `${ico('bulb', 's')}<span>Dica</span>`;
$('#btn-restart').innerHTML = `${ico('reset', 's')}<span>Reiniciar</span>`;

document.addEventListener('click', (e) => {
  if (e.target === $('#modal-root') && state.modal) {
    state.modal = null;
    sfx.click();
    renderModal();
    return;
  }

  const actBtn = e.target.closest('[data-act]');
  if (!actBtn || actBtn.disabled) return;
  const act = actBtn.dataset.act;

  if (act === 'prev') {
    sfx.click();
    loadLevel(state.levelId - 1);
  } else if (act === 'next') {
    sfx.click();
    loadLevel(state.levelId + 1);
  } else if (act === 'map') {
    sfx.click();
    state.modal = 'map';
    renderModal();
  } else if (act === 'pick-level') {
    sfx.click();
    state.modal = null;
    renderModal();
    loadLevel(Number(actBtn.dataset.level));
  } else if (act === 'retry') {
    sfx.click();
    loadLevel(state.levelId);
  } else if (act === 'advance') {
    sfx.click();
    if (state.phase === 'won') loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    else loadLevel(state.levelId);
  } else if (act === 'hint') {
    const h = findNextHint(state.vehicles, state.level);
    if (h) {
      state.hint = h;
      state.selectedId = h.id;
      sfx.pop();
      updateHUD();
      scheduleAnim();
    } else {
      toast('Sem jogada livre restante.', 'err');
    }
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
  if (state.modal) return;

  if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    sfx.click();
    loadLevel(state.levelId);
  } else if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    const h = findNextHint(state.vehicles, state.level);
    if (h && state.phase === 'play') {
      state.hint = h;
      state.selectedId = h.id;
      sfx.pop();
      updateHUD();
      scheduleAnim();
    }
  } else if ((e.key === 'Enter' || e.key === ' ') && (state.phase === 'won' || state.phase === 'lost')) {
    e.preventDefault();
    sfx.click();
    if (state.phase === 'won') loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    else loadLevel(state.levelId);
  } else if (state.phase === 'play' && state.selectedId) {
    const v = state.vehicles.find((x) => x.id === state.selectedId);
    if (!v) return;
    if (v.dir === 'H' && (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      launchVehicle(v.id, -1);
    } else if (v.dir === 'H' && (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      launchVehicle(v.id, 1);
    } else if (v.dir === 'V' && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      launchVehicle(v.id, -1);
    } else if (v.dir === 'V' && (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      launchVehicle(v.id, 1);
    }
  }
});

loadLevel(state.levelId);
