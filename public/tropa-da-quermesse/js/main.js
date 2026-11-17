import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  PLAYER_MAX_X,
  STYLES,
  CHAPTERS,
  LEVELS,
  clamp,
  fmtNum,
  crowdRadius,
  eventXAt,
  gateSnapshot,
  createRun,
  stepRun,
  getLevel,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_tropa_v1';

const ARENA_W = 400;
const ARENA_H = 500;
const Y_HORIZON = 86;
const Y_PLAYER = 410;
const DRAW_DIST = 64;
const FOCAL = 8.4;

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
  run: null,
  phase: 'ready', // 'ready' | 'run' | 'duel' | 'won' | 'lost'
  targetX: 0,
  keys: { left: false, right: false },
  drag: null,
  duel: null,
  popups: [],
  particles: [],
  animTime: 0,
  lastTs: 0,
  rafId: 0,
  lastChargeSfxAt: 0,
  lastClashSfxAt: 0,
  lastChipSfxAt: 0,
  modal: null,
  rulesTab: 'rules',
};

const canvas = $('#trp-canvas');
const ctx = canvas.getContext('2d');
const staticCanvas = document.createElement('canvas');
const staticCtx = staticCanvas.getContext('2d');
let renderDpr = 0;

function ensureCanvasScale() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (renderDpr === dpr) return;
  renderDpr = dpr;
  canvas.width = Math.round(ARENA_W * dpr);
  canvas.height = Math.round(ARENA_H * dpr);
  staticCanvas.width = Math.round(ARENA_W * dpr);
  staticCanvas.height = Math.round(ARENA_H * dpr);
  buildStaticLayer();
}

function projScale(relZ) {
  return FOCAL / Math.max(0.8, relZ + FOCAL);
}

function projY(sc) {
  return Y_HORIZON + (Y_PLAYER - Y_HORIZON) * sc;
}

function halfRoadAt(sc) {
  return 24 + (176 - 24) * sc;
}

function projX(xNorm, sc) {
  return ARENA_W * 0.5 + xNorm * halfRoadAt(sc);
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

function buildStaticLayer() {
  const dpr = renderDpr || 1;
  const c = staticCtx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sky = c.createLinearGradient(0, 0, 0, Y_HORIZON + 20);
  sky.addColorStop(0, '#091522');
  sky.addColorStop(1, '#1a2f46');
  c.fillStyle = sky;
  c.fillRect(0, 0, ARENA_W, Y_HORIZON + 24);

  c.fillStyle = 'rgba(255, 243, 204, 0.55)';
  const starPts = [
    [32, 22], [74, 48], [116, 18], [156, 36], [244, 30], [292, 19], [344, 44], [374, 24],
    [54, 70], [358, 66], [202, 16],
  ];
  for (const [sx, sy] of starPts) {
    c.beginPath();
    c.arc(sx, sy, 1.3, 0, Math.PI * 2);
    c.fill();
  }

  for (const [bx, ang, col] of [
    [164, -0.32, 'rgba(247, 183, 51, 0.14)'],
    [236, 0.32, 'rgba(247, 183, 51, 0.14)'],
    [200, -0.1, 'rgba(31, 174, 150, 0.12)'],
    [200, 0.1, 'rgba(229, 72, 47, 0.1)'],
  ]) {
    c.save();
    c.translate(bx, Y_HORIZON);
    c.rotate(ang);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-6, 0);
    c.lineTo(-42, -100);
    c.lineTo(42, -100);
    c.lineTo(6, 0);
    c.closePath();
    c.fill();
    c.restore();
  }

  // Coreto no horizonte
  c.fillStyle = '#122234';
  c.fillRect(156, Y_HORIZON - 24, 88, 26);
  c.fillStyle = '#e5482f';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(148, Y_HORIZON - 22);
  c.lineTo(200, Y_HORIZON - 44);
  c.lineTo(252, Y_HORIZON - 22);
  c.closePath();
  c.fill();
  c.stroke();

  const grass = c.createLinearGradient(0, Y_HORIZON, 0, ARENA_H);
  grass.addColorStop(0, '#132637');
  grass.addColorStop(1, '#0c1824');
  c.fillStyle = grass;
  c.fillRect(0, Y_HORIZON, ARENA_W, ARENA_H - Y_HORIZON);

  const drawBoothSide = (side) => {
    const rows = [
      { y: 112, w: 30, h: 24 },
      { y: 180, w: 44, h: 36 },
      { y: 274, w: 58, h: 48 },
      { y: 394, w: 68, h: 62 },
    ];
    rows.forEach((b, idx) => {
      const bx = side < 0 ? 4 : ARENA_W - b.w - 4;
      c.fillStyle = idx % 2 === 0 ? '#243a50' : '#1d3247';
      c.strokeStyle = '#0c1622';
      c.lineWidth = 1.6;
      c.fillRect(bx, b.y, b.w, b.h);
      c.strokeRect(bx, b.y, b.w, b.h);
      c.fillStyle = (idx + (side > 0 ? 1 : 0)) % 2 === 0 ? '#e5482f' : '#f7b733';
      c.fillRect(bx - 2, b.y - 6, b.w + 4, 8);
      c.strokeRect(bx - 2, b.y - 6, b.w + 4, 8);
    });
  };
  drawBoothSide(-1);
  drawBoothSide(1);

  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 10);
  c.quadraticCurveTo(ARENA_W * 0.5, 30, ARENA_W, 10);
  c.stroke();
  const bulbs = ['#f7b733', '#e5482f', '#1fae96', '#ffd166', '#3d7be0'];
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11;
    const x = t * ARENA_W;
    const y = 10 + 4 * t * (1 - t) * 16;
    c.fillStyle = bulbs[i % bulbs.length];
    c.beginPath();
    c.arc(x, y + 3, 4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function drawRunwaySurface(c, run) {
  const topHW = halfRoadAt(projScale(DRAW_DIST));
  const botHW = halfRoadAt(projScale(-3));
  const cx = ARENA_W * 0.5;
  const yTop = Y_HORIZON;
  const yBot = ARENA_H;

  const roadGrad = c.createLinearGradient(0, yTop, 0, yBot);
  roadGrad.addColorStop(0, '#273a4f');
  roadGrad.addColorStop(0.55, '#38506a');
  roadGrad.addColorStop(1, '#47617d');
  c.fillStyle = roadGrad;
  c.beginPath();
  c.moveTo(cx - topHW, yTop);
  c.lineTo(cx + topHW, yTop);
  c.lineTo(cx + botHW, yBot);
  c.lineTo(cx - botHW, yBot);
  c.closePath();
  c.fill();

  c.strokeStyle = '#f7b733';
  c.lineWidth = 3.2;
  c.beginPath();
  c.moveTo(cx - topHW, yTop);
  c.lineTo(cx - botHW, yBot);
  c.moveTo(cx + topHW, yTop);
  c.lineTo(cx + botHW, yBot);
  c.stroke();

  const stripeSpacing = 6;
  const firstStripeZ = Math.floor(run.z / stripeSpacing) * stripeSpacing;
  for (let wz = firstStripeZ; wz < run.z + DRAW_DIST; wz += stripeSpacing) {
    const rz = wz - run.z;
    if (rz < -2.2) continue;
    const sc = projScale(rz);
    const sy = projY(sc);
    const hw = halfRoadAt(sc);
    const alt = Math.round(wz / stripeSpacing) % 2 === 0;
    c.strokeStyle = alt ? 'rgba(247, 183, 51, 0.22)' : 'rgba(255, 250, 240, 0.12)';
    c.lineWidth = Math.max(1, 2.2 * sc);
    c.beginPath();
    c.moveTo(cx - hw * 0.94, sy);
    c.lineTo(cx + hw * 0.94, sy);
    c.stroke();
  }

  c.strokeStyle = 'rgba(255, 248, 234, 0.16)';
  c.lineWidth = 2;
  c.setLineDash([10, 10]);
  c.beginPath();
  c.moveTo(cx, yTop);
  c.lineTo(cx, yBot);
  c.stroke();
  c.setLineDash([]);

  for (const ev of run.events) {
    if (ev.type !== 'belt') continue;
    const rz0 = Math.max(-2, ev.zStart - run.z);
    const rz1 = Math.min(DRAW_DIST, ev.zEnd - run.z);
    if (rz1 <= -2 || rz0 >= DRAW_DIST) continue;
    const sc0 = projScale(rz0);
    const sc1 = projScale(rz1);
    const y0 = projY(sc0);
    const y1 = projY(sc1);
    const hw0 = halfRoadAt(sc0) * 0.92;
    const hw1 = halfRoadAt(sc1) * 0.92;
    c.fillStyle = 'rgba(247, 183, 51, 0.24)';
    c.beginPath();
    c.moveTo(cx - hw1, y1);
    c.lineTo(cx + hw1, y1);
    c.lineTo(cx + hw0, y0);
    c.lineTo(cx - hw0, y0);
    c.closePath();
    c.fill();

    const dir = ev.pushX > 0 ? 1 : -1;
    const midRz = (rz0 + rz1) * 0.5;
    if (midRz > 0 && midRz < DRAW_DIST) {
      const msc = projScale(midRz);
      const my = projY(msc);
      const shift = ((state.animTime * 48 * dir) % 28 + 28) % 28 - 14;
      c.fillStyle = '#ffd166';
      c.font = `700 ${Math.max(10, Math.round(16 * msc))}px "Barlow Condensed", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(dir > 0 ? '>>>' : '<<<', cx + shift * msc, my);
    }
  }

  // Palco do Coreto na linha de chegada
  const finRel = run.level.length - run.z;
  if (finRel < DRAW_DIST && finRel > -4) {
    const sc = projScale(Math.max(0, finRel));
    const sy = projY(sc);
    const hw = halfRoadAt(sc);
    const stageH = Math.max(18, 66 * sc);

    c.fillStyle = '#f7b733';
    c.fillRect(cx - hw, sy - 6 * sc, hw * 2, 12 * sc);
    c.fillStyle = '#e5482f';
    for (let k = 0; k < 8; k += 2) {
      const x0 = cx - hw + (k / 8) * hw * 2;
      c.fillRect(x0, sy - 6 * sc, (hw * 2) / 8, 12 * sc);
    }

    c.fillStyle = '#241734';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2;
    roundRect(c, cx - hw * 0.86, sy - stageH - 12 * sc, hw * 1.72, stageH, 6);
    c.fill();
    c.stroke();

    if (sc > 0.2) {
      c.fillStyle = '#f7b733';
      c.font = `700 ${Math.round(13 * sc + 5)}px "Bungee", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`RIVAL · ${fmtNum(run.level.rivalPower)}`, cx, sy - stageH * 0.55 - 10 * sc);
    }
  }
}

function drawGateBox(c, gx, gy, gw, gh, snap, sc, level, isAimed = false) {
  const x = gx - gw * 0.5;
  const y = gy - gh;

  let fillTop = '#29c76f';
  let fillBot = 'rgba(32, 168, 92, 0.36)';
  let frame = '#6df0a4';
  let label = '';
  let subLabel = '';

  if (snap.kind === 'style') {
    const st = STYLES[snap.style] || STYLES.junino;
    const isTarget = snap.style === level.targetStyle;
    const isAvoid = snap.style === level.avoidStyle;
    frame = isTarget ? '#ffd75e' : isAvoid ? '#ff6a55' : st.body;
    fillTop = isTarget ? '#f7b733' : isAvoid ? '#d93d2b' : '#3d7be0';
    fillBot = isTarget ? 'rgba(247, 183, 51, 0.4)' : isAvoid ? 'rgba(229, 72, 47, 0.36)' : 'rgba(61, 123, 224, 0.36)';
    label = st.tag;
    subLabel = snap.val ? `+${fmtNum(snap.val)}` : isTarget ? '×1.6 TEMA' : '';
  } else if (snap.kind === 'clean') {
    frame = '#7ceeff';
    fillTop = '#1fae96';
    fillBot = 'rgba(31, 174, 150, 0.38)';
    label = 'BRILHO';
    subLabel = snap.val ? `LIMPO +${fmtNum(snap.val)}` : 'LIMPA LAMA';
  } else {
    const pos = snap.positive;
    frame = pos ? '#6df0a4' : '#ff7b66';
    fillTop = pos ? '#27b868' : '#d93d2b';
    fillBot = pos ? 'rgba(39, 184, 104, 0.38)' : 'rgba(217, 61, 43, 0.38)';
    const numTxt = snap.op === '×' || snap.op === '÷' ? String(snap.val) : fmtNum(snap.val);
    label = `${snap.op}${numTxt}`;
    if (snap.isCharge) subLabel = 'ATIRE!';
    else if (snap.oscillating) subLabel = 'PISCA!';
  }

  c.save();
  const grad = c.createLinearGradient(0, y, 0, gy);
  grad.addColorStop(0, fillTop);
  grad.addColorStop(1, fillBot);
  c.fillStyle = grad;
  roundRect(c, x, y, gw, gh, 8 * sc + 2);
  c.fill();

  c.fillStyle = 'rgba(255, 255, 255, 0.32)';
  const seed = Math.round(gx + gh);
  for (let b = 0; b < 4; b++) {
    const bx = x + gw * (0.2 + ((b * 0.22 + (seed % 7) * 0.05) % 0.66));
    const phase = (state.animTime * 1.4 + b * 0.25) % 1;
    const by = gy - phase * (gh * 0.86);
    c.beginPath();
    c.arc(bx, by, Math.max(1.2, 2.5 * sc), 0, Math.PI * 2);
    c.fill();
  }

  c.strokeStyle = '#14202b';
  c.lineWidth = Math.max(2, 4.2 * sc);
  roundRect(c, x, y, gw, gh, 8 * sc + 2);
  c.stroke();

  c.strokeStyle = isAimed ? '#fff8ea' : frame;
  c.lineWidth = Math.max(1.2, (isAimed ? 3.5 : 2.1) * sc);
  roundRect(c, x + 2, y + 2, gw - 4, gh - 4, 6 * sc + 2);
  c.stroke();

  const postW = Math.max(3, 5.5 * sc);
  c.fillStyle = frame;
  c.strokeStyle = '#14202b';
  c.lineWidth = 1.5;
  c.fillRect(x - postW * 0.4, y + 4, postW, gh - 4);
  c.strokeRect(x - postW * 0.4, y + 4, postW, gh - 4);
  c.fillRect(x + gw - postW * 0.6, y + 4, postW, gh - 4);
  c.strokeRect(x + gw - postW * 0.6, y + 4, postW, gh - 4);

  if (sc > 0.14) {
    const scaleTxt = label.length >= 6 ? 0.21 : label.length > 4 ? 0.25 : 0.33;
    const fontSz = Math.max(9.5, Math.round(gh * scaleTxt));
    c.font = `700 ${fontSz}px "Bungee", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = Math.max(2, 3.2 * sc);
    c.strokeStyle = '#14202b';
    const textY = subLabel ? y + gh * 0.42 : y + gh * 0.52;
    c.strokeText(label, gx, textY);
    c.fillStyle = '#fffaf0';
    c.fillText(label, gx, textY);

    if (subLabel && sc > 0.22) {
      c.font = `700 ${Math.max(8, Math.round(fontSz * 0.48))}px "Barlow Condensed", sans-serif`;
      c.strokeText(subLabel, gx, y + gh * 0.75);
      c.fillStyle = '#ffe596';
      c.fillText(subLabel, gx, y + gh * 0.75);
    }
  }
  c.restore();
}

const RIVAL_SLOTS = [
  [0, 0],
  [-0.5, -0.35],
  [0.5, -0.35],
  [-0.85, 0.25],
  [0.85, 0.25],
  [-0.3, 0.45],
  [0.3, 0.45],
  [0, -0.75],
  [-0.75, -0.7],
  [0.75, -0.7],
];

function drawEnemyWave(c, ev, sc, gy, run) {
  const ox = projX(eventXAt(ev, run.t), sc);
  const halfPx = ev.hw * halfRoadAt(sc);
  const visRivals = ev.hw >= 0.8 ? 9 : 5;

  for (let i = 0; i < visRivals; i++) {
    const sl = RIVAL_SLOTS[i];
    const rx = ox + sl[0] * halfPx * 0.78;
    const ry = gy + sl[1] * 18 * sc;
    drawRunnerSprite(c, rx, ry, 0.74 * sc, 'basico', false, i * 0.8 + ev.z, true);
  }

  if (sc > 0.16) {
    const pct = clamp(ev.hp / Math.max(1, ev.maxHp), 0, 1);
    const barW = clamp(halfPx * 1.1, 48, 128);
    const barH = Math.max(14, Math.round(22 * sc));
    const bx = ox - barW * 0.5;
    const by = gy - 44 * sc - barH;

    c.save();
    c.fillStyle = '#14202b';
    roundRect(c, bx, by, barW, barH, 8);
    c.fill();
    c.fillStyle = '#e5482f';
    roundRect(c, bx + 2, by + 2, Math.max(4, (barW - 4) * pct), barH - 4, 6);
    c.fill();
    c.strokeStyle = '#ff8e78';
    c.lineWidth = 1.6;
    roundRect(c, bx, by, barW, barH, 8);
    c.stroke();

    c.fillStyle = '#fffaf0';
    c.font = `700 ${Math.max(10, Math.round(barH * 0.58))}px "Bungee", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.6;
    const hpTxt = fmtNum(Math.ceil(ev.hp));
    c.strokeText(hpTxt, ox, by + barH * 0.54);
    c.fillText(hpTxt, ox, by + barH * 0.54);
    c.restore();
  }
}

function drawCrate(c, ev, sc, gy, run) {
  const ox = projX(eventXAt(ev, run.t), sc);
  const bw = Math.max(20, ev.hw * 1.45 * halfRoadAt(sc));
  const bh = bw * 0.88;

  c.save();
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath();
  c.ellipse(ox, gy + 2, bw * 0.55, 5 * sc, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#c57a34';
  c.strokeStyle = '#14202b';
  c.lineWidth = Math.max(1.5, 2.6 * sc);
  roundRect(c, ox - bw * 0.5, gy - bh, bw, bh, 5 * sc + 2);
  c.fill();
  c.stroke();

  c.strokeStyle = '#f7b733';
  c.lineWidth = Math.max(1.2, 2.2 * sc);
  c.strokeRect(ox - bw * 0.38, gy - bh * 0.85, bw * 0.76, bh * 0.7);

  if (sc > 0.18) {
    const rewardLabel = ev.rewardOp === '×' ? `×${ev.rewardVal}` : `+${fmtNum(ev.rewardVal)}`;
    c.fillStyle = '#ffd75e';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.5;
    c.font = `700 ${Math.max(9.5, Math.round(bh * 0.34))}px "Bungee", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.strokeText(rewardLabel, ox, gy - bh * 0.5);
    c.fillText(rewardLabel, ox, gy - bh * 0.5);

    // Barrinha de HP em cima do baú (sempre positiva mesmo longe no horizonte)
    const pct = clamp(ev.hp / Math.max(1, ev.maxHp), 0, 1);
    const hpw = Math.max(36, bw * 0.9);
    const hph = Math.max(8, 12 * sc);
    const hpy = gy - bh - hph - 4 * sc;
    c.fillStyle = '#14202b';
    roundRect(c, ox - hpw * 0.5, hpy, hpw, hph, 4);
    c.fill();
    c.fillStyle = '#3bab6a';
    roundRect(c, ox - hpw * 0.5 + 1.5, hpy + 1.5, Math.max(3, (hpw - 3) * pct), hph - 3, 3);
    c.fill();
    c.fillStyle = '#fffaf0';
    c.font = `700 ${Math.max(8.5, Math.round(hph * 0.72))}px "Barlow Condensed", sans-serif`;
    c.fillText(fmtNum(Math.ceil(ev.hp)), ox, hpy + hph * 0.54);
  }
  c.restore();
}

function drawObstacle(c, ev, sc, gy, run) {
  const ox = projX(eventXAt(ev, run.t), sc);
  const r = Math.max(4, ev.hw * halfRoadAt(sc));

  c.save();
  if (ev.variant === 'mud') {
    c.fillStyle = '#5c3c22';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2.2 * sc);
    c.beginPath();
    c.ellipse(ox, gy, r * 1.05, Math.max(3, 14 * sc), 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#7d5230';
    c.beginPath();
    c.ellipse(ox - r * 0.25, gy - 2 * sc, r * 0.45, Math.max(1.5, 5 * sc), 0, 0, Math.PI * 2);
    c.fill();
  } else if (ev.variant === 'barrel') {
    const bw = r * 1.25;
    const bh = bw * 1.1;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse(ox, gy + 2, bw * 0.54, 5 * sc, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#b9442a';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2.4 * sc);
    roundRect(c, ox - bw * 0.5, gy - bh, bw, bh, 5 * sc + 2);
    c.fill();
    c.stroke();

    c.fillStyle = '#33465a';
    c.fillRect(ox - bw * 0.5, gy - bh * 0.72, bw, Math.max(2, bh * 0.14));
    c.fillRect(ox - bw * 0.5, gy - bh * 0.28, bw, Math.max(2, bh * 0.14));
    if (sc > 0.28) {
      c.fillStyle = '#ffd166';
      c.font = `700 ${Math.round(bw * 0.46)}px "Bungee", sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('!', ox, gy - bh * 0.5);
    }
  } else if (ev.variant === 'saw') {
    const rad = r * 0.92;
    const cy = gy - rad * 0.65;
    c.translate(ox, cy);
    c.rotate(state.animTime * 8.5);
    const teeth = 10;
    c.fillStyle = '#cfdbe6';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2 * sc);
    c.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? rad : rad * 0.68;
      if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#e5482f';
    c.beginPath();
    c.arc(0, 0, rad * 0.28, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else {
    const cw = r * 1.1;
    const ch = cw * 1.3;
    c.fillStyle = '#ff6b2c';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2.2 * sc);
    c.beginPath();
    c.moveTo(ox, gy - ch);
    c.lineTo(ox + cw * 0.5, gy);
    c.lineTo(ox - cw * 0.5, gy);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#fff8ea';
    c.fillRect(ox - cw * 0.24, gy - ch * 0.52, cw * 0.48, Math.max(2, ch * 0.16));
  }
  c.restore();
}

function drawPickup(c, ev, sc, gy, run) {
  const px = projX(eventXAt(ev, run.t), sc);
  const bob = Math.sin(state.animTime * 5 + ev.z) * 4 * sc;
  const r = Math.max(5, 16 * sc);

  c.save();
  if (ev.kind === 'star') {
    c.translate(px, gy - r * 1.2 + bob);
    c.rotate(Math.sin(state.animTime * 2.5 + ev.z) * 0.22);
    c.fillStyle = '#f7b733';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2.2 * sc);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI * 0.5;
      const rr = i % 2 === 0 ? r : r * 0.46;
      if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.stroke();
  } else if (ev.kind === 'clean') {
    c.fillStyle = '#5ee6ff';
    c.strokeStyle = '#14202b';
    c.lineWidth = Math.max(1.2, 2 * sc);
    c.beginPath();
    c.arc(px, gy - r + bob, r * 0.9, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.beginPath();
    c.arc(px - r * 0.3, gy - r * 1.25 + bob, r * 0.25, 0, Math.PI * 2);
    c.fill();
  } else {
    drawRunnerSprite(c, px, gy - 2 + bob, 0.78 * sc, 'basico', false, ev.z);
    if (sc > 0.28) {
      c.fillStyle = '#6df0a4';
      c.strokeStyle = '#14202b';
      c.lineWidth = 2;
      c.font = `700 ${Math.round(11 * sc)}px "Bungee", sans-serif`;
      c.textAlign = 'center';
      c.strokeText(`+${fmtNum(ev.val)}`, px, gy - 28 * sc + bob);
      c.fillText(`+${fmtNum(ev.val)}`, px, gy - 28 * sc + bob);
    }
  }
  c.restore();
}

function drawRunnerSprite(c, x, y, sc, styleId, muddy, phase = 0, isRival = false) {
  const st = isRival ? { body: '#6e3482', trim: '#ff5277', dark: '#3e1a4a' } : STYLES[styleId] || STYLES.basico;
  const s = Math.max(0.28, sc);
  const bounce = Math.abs(Math.sin(state.animTime * 13 + phase)) * 4 * s;

  c.save();
  c.translate(x, y - bounce);
  c.scale(s, s);

  c.fillStyle = 'rgba(0, 0, 0, 0.32)';
  c.beginPath();
  c.ellipse(0, bounce + 1, 8.5, 3.2, 0, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = st.body;
  c.strokeStyle = '#14202b';
  c.lineWidth = 2.1;
  roundRect(c, -7.2, -19, 14.4, 15.5, 5.5);
  c.fill();
  c.stroke();

  c.fillStyle = st.trim;
  c.fillRect(-4.8, -12.5, 9.6, 4.2);

  c.fillStyle = '#ffe0be';
  c.beginPath();
  c.arc(0, -24, 6.5, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.fillStyle = '#14202b';
  c.beginPath();
  c.arc(-2.3, -24.2, 1.05, 0, Math.PI * 2);
  c.arc(2.3, -24.2, 1.05, 0, Math.PI * 2);
  c.fill();

  if (isRival) {
    c.fillStyle = '#ff4f7a';
    c.beginPath();
    c.moveTo(-5.8, -29);
    c.lineTo(-2.8, -35);
    c.lineTo(0, -31);
    c.lineTo(2.8, -35);
    c.lineTo(5.8, -29);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (styleId === 'junino') {
    c.fillStyle = '#ffd166';
    c.beginPath();
    c.ellipse(0, -29, 10.5, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillRect(-4.8, -34.5, 9.6, 5.5);
    c.strokeRect(-4.8, -34.5, 9.6, 5.5);
  } else if (styleId === 'gala') {
    c.fillStyle = '#ffd75e';
    c.beginPath();
    c.moveTo(-5.8, -29);
    c.lineTo(-4.2, -36);
    c.lineTo(0, -32);
    c.lineTo(4.2, -36);
    c.lineTo(5.8, -29);
    c.closePath();
    c.fill();
    c.stroke();
  } else if (styleId === 'rock') {
    c.fillStyle = '#e5482f';
    c.beginPath();
    c.moveTo(-2.4, -29);
    c.lineTo(0, -38);
    c.lineTo(2.4, -29);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#14202b';
    c.fillRect(-5.2, -25.8, 4.2, 2.6);
    c.fillRect(1, -25.8, 4.2, 2.6);
  } else if (styleId === 'neon') {
    c.fillStyle = '#5ee6ff';
    c.fillRect(-5.5, -26.2, 11, 3.2);
    c.strokeRect(-5.5, -26.2, 11, 3.2);
    c.fillStyle = '#ff4fa3';
    c.beginPath();
    c.arc(0, -32, 2.4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else {
    c.fillStyle = '#5d8ec7';
    c.beginPath();
    c.arc(0, -27.5, 6, Math.PI, 0);
    c.fill();
    c.stroke();
  }

  if (muddy) {
    c.fillStyle = '#5c3c22';
    c.beginPath();
    c.arc(-3.2, -9, 2.2, 0, Math.PI * 2);
    c.arc(2.8, -14, 2, 0, Math.PI * 2);
    c.fill();
  }

  c.restore();
}

// Formação aberta espaçada (cada bonequinho visível sem amontoar)
const CROWD_SLOTS = (() => {
  const pts = [[0, 0]];
  const rows = [
    { dy: -0.42, n: 4 },
    { dy: 0.42, n: 4 },
    { dy: -0.82, n: 6 },
    { dy: 0.0, n: 6 },
    { dy: 0.82, n: 6 },
  ];
  for (const row of rows) {
    for (let k = 0; k < row.n; k++) {
      const dx = row.n === 1 ? 0 : ((k / (row.n - 1)) * 2 - 1) * (row.dy === 0 ? 0.95 : 0.88);
      if (dx === 0 && row.dy === 0) continue;
      pts.push([dx, row.dy]);
    }
  }
  return pts;
})();

function drawCrowd(c, run, overrideCount = null, overrideY = Y_PLAYER, overrideX = run.x) {
  const shownCount = overrideCount !== null ? overrideCount : run.count;
  if (shownCount <= 0) return;

  const visCount = Math.min(26, shownCount);
  const spreadX = clamp(34 + Math.sqrt(visCount) * 12, 38, 102);
  const spreadY = clamp(22 + Math.sqrt(visCount) * 6.5, 22, 54);
  const cx = projX(overrideX, 1.0);

  const members = [];
  for (let i = 0; i < visCount; i++) {
    const slot = CROWD_SLOTS[i];
    const mx = clamp(cx + slot[0] * spreadX, 24, ARENA_W - 24);
    const my = overrideY + slot[1] * spreadY;
    members.push({ mx, my, i });
  }
  members.sort((a, b) => a.my - b.my);

  for (const m of members) {
    drawRunnerSprite(c, m.mx, m.my, 0.72, run.style, run.muddy, m.i * 0.7);
  }

  // Plaqueta posicionada ABAIXO da tropa para não tampar a visão da passarela
  const st = STYLES[run.style] || STYLES.basico;
  const tagText = `${fmtNum(shownCount)} · ${st.tag}`;
  const isMatch = run.style === run.level.targetStyle;
  const badgeW = Math.max(92, tagText.length * 8.2 + 20);
  const bx = clamp(cx - badgeW * 0.5, 8, ARENA_W - badgeW - 8);
  const by = Math.min(ARENA_H - 30, overrideY + spreadY * 0.78 + 10);

  c.save();
  c.fillStyle = isMatch ? '#228b4f' : run.muddy ? '#6a4424' : '#182838';
  c.strokeStyle = isMatch ? '#ffd75e' : '#14202b';
  c.lineWidth = 2.4;
  roundRect(c, bx, by, badgeW, 24, 12);
  c.fill();
  c.stroke();

  c.fillStyle = '#fffaf0';
  c.font = '700 12.5px "Bungee", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(tagText, bx + badgeW * 0.5, by + 13);
  c.restore();
}

function drawActiveShots(c, run) {
  if (state.phase !== 'run' || run.activeTargetZ === null || run.activeTargetX === null) return;
  const relZ = run.activeTargetZ - run.z;
  if (relZ <= 0.4 || relZ > 24) return;

  const scTarget = projScale(relZ);
  const tx = projX(run.activeTargetX, scTarget);
  const ty = projY(scTarget) - 18 * scTarget;
  const sx = projX(run.x, 1.0);
  const sy = Y_PLAYER - 14;

  c.save();
  const bolts = Math.min(10, 4 + Math.floor(Math.log10(Math.max(1, run.count)) * 2));
  for (let k = 0; k < bolts; k++) {
    const laneJitter = ((k % 3) - 1) * 14;
    const p = ((state.animTime * 5.2 + k / bolts) % 1);
    const px = sx + laneJitter * (1 - p) + (tx - sx) * p;
    const py = sy + (ty - sy) * p;
    c.fillStyle = k % 2 === 0 ? '#ffd166' : '#ff7b5c';
    c.beginPath();
    c.arc(px, py, Math.max(2, 4.4 * (1 - p * 0.5)), 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawFrame() {
  ensureCanvasScale();
  const dpr = renderDpr || 1;
  const c = ctx;
  const run = state.run;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  c.drawImage(staticCanvas, 0, 0, ARENA_W, ARENA_H);
  if (!run) return;

  drawRunwaySurface(c, run);

  if (state.phase === 'duel' && state.duel) {
    const p = clamp(state.duel.t / state.duel.dur, 0, 1);
    const playerShown = Math.max(0, Math.round(state.duel.startPower * (1 - p) + state.duel.endPlayer * p));
    const rivalShown = Math.max(0, Math.round(state.duel.rivalPower * (1 - p) + state.duel.endRival * p));

    const rivVis = Math.min(20, Math.max(1, Math.ceil((rivalShown / Math.max(1, state.duel.rivalPower)) * 18)));
    for (let i = 0; i < rivVis; i++) {
      const slot = CROWD_SLOTS[i % CROWD_SLOTS.length];
      drawRunnerSprite(c, ARENA_W * 0.5 + slot[0] * 78, 214 + slot[1] * 26, 0.74, 'basico', false, i * 0.5, true);
    }

    c.save();
    c.fillStyle = '#14202b';
    roundRect(c, 58, 126, 284, 38, 14);
    c.fill();
    c.strokeStyle = '#f7b733';
    c.lineWidth = 2.2;
    roundRect(c, 58, 126, 284, 38, 14);
    c.stroke();

    c.fillStyle = '#ffd166';
    c.font = '700 14px "Bungee", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`VOCÊ ${fmtNum(playerShown)}  ×  ${fmtNum(rivalShown)} RIVAL`, ARENA_W * 0.5, 146);
    c.restore();

    drawCrowd(c, run, Math.max(1, Math.round(playerShown / Math.max(1, run.finalEval.styleMult))), 350, 0);
  } else {
    const visible = [];
    for (let i = run.nextEventIdx; i < run.events.length; i++) {
      const ev = run.events[i];
      if (ev.type === 'belt' || ev.triggered) continue;
      const relZ = ev.z - run.z;
      if (relZ > DRAW_DIST) break;
      if (relZ < -1.5) continue;
      visible.push({ ev, relZ });
    }
    visible.sort((a, b) => b.relZ - a.relZ);

    for (const item of visible) {
      const { ev, relZ } = item;
      const sc = projScale(relZ);
      const gy = projY(sc);
      const hwRoad = halfRoadAt(sc);

      if (ev.type === 'gatePair') {
        const splitX = ev.splitX ?? 0;
        const leftCenter = (-1 + splitX) * 0.5;
        const rightCenter = (splitX + 1) * 0.5;
        const gwL = (splitX - -0.96) * hwRoad;
        const gwR = (0.96 - splitX) * hwRoad;
        const gh = Math.max(24, 90 * sc);

        const inLeft = run.x < splitX;
        const snapL = gateSnapshot(ev.left, run.t);
        const snapR = gateSnapshot(ev.right, run.t);
        if (snapL) drawGateBox(c, projX(leftCenter, sc), gy, gwL, gh, snapL, sc, run.level, inLeft && relZ < 24);
        if (snapR) drawGateBox(c, projX(rightCenter, sc), gy, gwR, gh, snapR, sc, run.level, !inLeft && relZ < 24);
      } else if (ev.type === 'singleGate') {
        const gxNorm = eventXAt(ev, run.t);
        const gw = (ev.hw ?? 0.32) * 2 * hwRoad;
        const gh = Math.max(24, 90 * sc);
        const snap = gateSnapshot(ev.gate, run.t);
        const aimed = Math.abs(run.x - gxNorm) <= (ev.hw ?? 0.34) + 0.16 && relZ < 24;
        if (snap) drawGateBox(c, projX(gxNorm, sc), gy, gw, gh, snap, sc, run.level, aimed);
      } else if (ev.type === 'enemy') {
        drawEnemyWave(c, ev, sc, gy, run);
      } else if (ev.type === 'crate') {
        drawCrate(c, ev, sc, gy, run);
      } else if (ev.type === 'obstacle') {
        drawObstacle(c, ev, sc, gy, run);
      } else if (ev.type === 'pickup') {
        drawPickup(c, ev, sc, gy, run);
      }
    }

    drawActiveShots(c, run);
    drawCrowd(c, run);
  }

  // Barra discreta de progresso (~1 min de percurso)
  const prog = clamp(run.z / Math.max(1, run.level.length), 0, 1);
  c.save();
  c.fillStyle = 'rgba(14, 26, 36, 0.72)';
  roundRect(c, 58, 34, ARENA_W - 116, 12, 6);
  c.fill();
  c.fillStyle = '#f7b733';
  roundRect(c, 60, 36, Math.max(8, (ARENA_W - 120) * prog), 8, 4);
  c.fill();
  c.strokeStyle = '#14202b';
  c.lineWidth = 1.6;
  roundRect(c, 58, 34, ARENA_W - 116, 12, 6);
  c.stroke();
  c.restore();

  for (const pop of state.popups) {
    const a = clamp(pop.life / pop.maxLife, 0, 1);
    c.save();
    c.globalAlpha = a;
    c.font = '700 15px "Bungee", sans-serif';
    c.textAlign = 'center';
    c.strokeStyle = '#14202b';
    c.lineWidth = 3.2;
    c.strokeText(pop.text, pop.x, pop.y);
    c.fillStyle = pop.color;
    c.fillText(pop.text, pop.x, pop.y);
    c.restore();
  }

  for (const pt of state.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    c.save();
    c.globalAlpha = a;
    c.fillStyle = pt.color;
    c.beginPath();
    c.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  if (state.phase === 'ready') {
    c.save();
    c.fillStyle = 'rgba(14, 26, 36, 0.72)';
    roundRect(c, 56, 204, ARENA_W - 112, 68, 14);
    c.fill();
    c.strokeStyle = '#f7b733';
    c.lineWidth = 2.4;
    roundRect(c, 56, 204, ARENA_W - 112, 68, 14);
    c.stroke();

    c.fillStyle = '#f7b733';
    c.font = '700 14.5px "Bungee", sans-serif';
    c.textAlign = 'center';
    c.fillText('ARRASTE OU APERTE CORRER!', ARENA_W * 0.5, 228);
    c.fillStyle = '#fff8ea';
    c.font = '600 12.5px "Barlow", sans-serif';
    const tgt = STYLES[run.level.targetStyle];
    c.fillText(`Júri: ${tgt.name} (×1.6) · Rival: ${fmtNum(run.level.rivalPower)}`, ARENA_W * 0.5, 252);
    c.restore();
  }
}

function spawnBurst(x, y, color, count = 10) {
  for (let i = 0; i < count && state.particles.length < 64; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 65 + Math.random() * 120;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 45,
      r: 2.4 + Math.random() * 2.4,
      life: 0.35 + Math.random() * 0.22,
      maxLife: 0.55,
      color,
    });
  }
}

function pushPopup(text, color = '#fff8ea', x = projX(state.run?.x || 0, 1.0), y = Y_PLAYER - 62) {
  if (state.popups.length >= 10) state.popups.shift();
  state.popups.push({ text, color, x, y, life: 0.85, maxLife: 0.85 });
}

const hudCache = {
  lvlKey: '',
  starsKey: '',
  briefKey: '',
  statusKey: '',
  btnKey: '',
};

function updateHUD() {
  const lv = state.level;
  const run = state.run;

  const lvlKey = `${lv.id}|${lv.title}`;
  if (hudCache.lvlKey !== lvlKey) {
    hudCache.lvlKey = lvlKey;
    $('#trp-level-num').textContent = `FASE ${lv.id} / ${LEVELS.length}`;
    $('#trp-level-name').textContent = lv.title;
    $('#btn-prev').disabled = lv.id <= 1;
    $('#btn-next').disabled = lv.id >= LEVELS.length;
  }

  const starsKey = `${totalStars()}`;
  if (hudCache.starsKey !== starsKey) {
    hudCache.starsKey = starsKey;
    $('#trp-total-stars').textContent = `★ ${totalStars()}/${LEVELS.length * 3}`;
  }

  const tgt = STYLES[lv.targetStyle];
  const avd = lv.avoidStyle ? STYLES[lv.avoidStyle] : null;
  const matched = run && run.style === lv.targetStyle;
  const est = run
    ? Math.round(
        run.count *
          (run.style === lv.targetStyle ? 1.6 : run.style === lv.avoidStyle ? 0.72 : run.style === 'basico' ? 1.0 : 1.08) *
          (run.muddy ? 0.78 : 1)
      ) + run.bonusPts
    : lv.startCount;
  const briefKey = `${tgt.id}|${avd?.id || ''}|${lv.rivalPower}|${est}|${matched ? 1 : 0}`;
  if (hudCache.briefKey !== briefKey) {
    hudCache.briefKey = briefKey;
    const thEl = $('#trp-theme-pill');
    thEl.className = `trp-pill${matched ? ' match' : ''}`;
    thEl.innerHTML = `Tema: <b>${tgt.name}</b>`;

    const avEl = $('#trp-avoid-pill');
    if (avd) {
      avEl.classList.remove('hidden');
      avEl.innerHTML = `Evite: <b>${avd.tag}</b>`;
    } else {
      avEl.classList.add('hidden');
    }

    $('#trp-rival-pill').innerHTML = `Poder: <b>${fmtNum(est)}</b> / ${fmtNum(lv.rivalPower)}`;
  }

  let stCls = 'trp-status-bar';
  let stHtml = lv.subtitle;
  if (state.phase === 'won') {
    const stars = run.finalEval?.stars || 1;
    stCls = 'trp-status-bar win';
    stHtml = `${ico('crown', 's')} Coreto conquistado! <b>${stars} estrela${stars > 1 ? 's' : ''}</b>!`;
  } else if (state.phase === 'lost') {
    stCls = 'trp-status-bar err';
    stHtml = `${ico('nope', 's')} A Rival venceu no Coreto! Ajuste a rota e tente de novo.`;
  } else if (state.phase === 'duel') {
    stHtml = `Duelo final no Coreto acontecendo agora!`;
  }

  const statusKey = `${stCls}|${stHtml}`;
  if (hudCache.statusKey !== statusKey) {
    hudCache.statusKey = statusKey;
    const el = $('#trp-status');
    el.className = stCls;
    el.innerHTML = stHtml;
  }

  const priLabel = state.phase === 'ready' ? 'Correr!' : 'Reiniciar';
  const priIco = state.phase === 'ready' ? 'bolt' : 'reset';
  const btnKey = `${priLabel}|${state.phase === 'won' ? 1 : 0}`;
  if (hudCache.btnKey !== btnKey) {
    hudCache.btnKey = btnKey;
    $('#btn-primary').innerHTML = `${ico(priIco, 's')}<span>${priLabel}</span>`;
    $('#btn-hint').disabled = state.phase === 'duel';
  }
}

function showOverlay() {
  const overlay = $('#trp-overlay');
  const titleEl = $('#trp-res-title');
  const starsEl = $('#trp-res-stars');
  const subEl = $('#trp-res-sub');
  const nextBtn = $('#btn-res-next');
  const retryBtn = $('#btn-res-retry');

  if (state.phase === 'won') {
    const ev = state.run.finalEval;
    const st = ev.stars;
    titleEl.textContent = state.level.id === LEVELS.length ? 'Rainha Suprema das 40!' : 'Coreto Conquistado!';
    titleEl.className = 'trp-result-title';
    starsEl.innerHTML = [1, 2, 3].map((n) => `<span class="trp-result-star ${n <= st ? '' : 'off'}">${ico('star', 'l')}</span>`).join('');
    subEl.textContent = `Poder ${fmtNum(ev.totalPower)} (meta ${fmtNum(state.level.rivalPower)}) · Bonde ${fmtNum(state.run.count)} × Tema ${ev.styleMult}×${ev.bonusPts ? ` + ${fmtNum(ev.bonusPts)}★` : ''}.`;
    nextBtn.textContent = state.level.id < LEVELS.length ? 'Próxima Fase →' : 'Voltar à Fase 1';
    retryBtn.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else if (state.phase === 'lost') {
    const reason = state.run.failReason;
    titleEl.textContent = reason === 'wiped' ? 'Tropa Zerada!' : 'Derrota no Coreto!';
    titleEl.className = 'trp-result-title fail';
    starsEl.innerHTML = '';
    const tot = fmtNum(state.run.finalEval?.totalPower || 0);
    const meta = fmtNum(state.level.rivalPower);
    if (reason === 'wiped') {
      subEl.textContent = 'As ondas rivais e armadilhas zeraram seu bonde antes do Coreto.';
    } else if (reason === 'muddy') {
      subEl.textContent = `A lama derrubou sua nota em 22%! Poder ${tot} < ${meta}.`;
    } else if (reason === 'wrong-style') {
      const tgt = STYLES[state.level.targetStyle].name;
      subEl.textContent = `Faltou vestir "${tgt}" (×1.6)! Poder ${tot} < ${meta}.`;
    } else {
      subEl.textContent = `Poder ${tot} não alcançou ${meta}. Atire nos baús e pegue os × certos!`;
    }
    nextBtn.textContent = 'Tentar de Novo';
    retryBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function finishDuelOrRun() {
  const ev = state.run.finalEval;
  if (ev.won) {
    state.phase = 'won';
    const key = String(state.level.id);
    const prev = Number(saved.stars[key]) || 0;
    if (ev.stars > prev) saved.stars[key] = ev.stars;
    saveProgress();
    sfx.win();
    confetti(75);
    const rect = canvas.getBoundingClientRect();
    burst({ x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.4 }, '#f7b733', 18);
  } else {
    state.phase = 'lost';
    sfx.err();
    shake($('#trp-stage'));
  }
  updateHUD();
  showOverlay();
}

function loadLevel(id) {
  if (state.rafId) {
    cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }
  state.levelId = Math.max(1, Math.min(LEVELS.length, Number(id) || 1));
  state.level = getLevel(state.levelId);
  saved.level = state.levelId;
  saveProgress();

  state.run = createRun(state.level);
  state.phase = 'ready';
  state.targetX = 0;
  state.drag = null;
  state.duel = null;
  state.popups = [];
  state.particles = [];

  showOverlay();
  updateHUD();
  drawFrame();
}

function startRun() {
  if (state.phase !== 'ready') return;
  state.phase = 'run';
  sfx.pop();
  updateHUD();
  startLoop();
}

function startLoop() {
  if (state.rafId) return;
  state.lastTs = 0;
  const tick = (ts) => {
    state.rafId = 0;
    if (document.hidden || state.modal) {
      state.lastTs = ts;
      if (state.phase === 'run' || state.phase === 'duel' || state.particles.length > 0 || state.popups.length > 0) {
        state.rafId = requestAnimationFrame(tick);
      }
      return;
    }
    if (!state.lastTs) state.lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
    state.lastTs = ts;
    state.animTime += dt;

    if (state.phase === 'run' && state.run) {
      if (state.keys.left && !state.keys.right) state.targetX = clamp(state.targetX - 2.75 * dt, -PLAYER_MAX_X, PLAYER_MAX_X);
      else if (state.keys.right && !state.keys.left) state.targetX = clamp(state.targetX + 2.75 * dt, -PLAYER_MAX_X, PLAYER_MAX_X);

      stepRun(state.run, dt, state.targetX);

      const nowMs = performance.now();
      while (state.run.recentEvents.length > 0) {
        const ev = state.run.recentEvents.shift();
        const px = projX(ev.x, 1.0);
        if (ev.type === 'charge') {
          spawnBurst(px, 240, '#ffd166', 3);
          if (nowMs - state.lastChargeSfxAt > 95) {
            state.lastChargeSfxAt = nowMs;
            sfx.chargeTick();
          }
        } else if (ev.type === 'chip') {
          const rz = Math.max(1, ev.z - state.run.z);
          const sc = projScale(rz);
          pushPopup(`-${fmtNum(ev.dmg)}`, '#ffd166', projX(ev.x, sc), projY(sc) - 34 * sc);
          if (nowMs - state.lastChipSfxAt > 120) {
            state.lastChipSfxAt = nowMs;
            sfx.chargeTick();
          }
        } else if (ev.type === 'break') {
          const txt =
            ev.kind === 'crate'
              ? ev.rewardOp === '×'
                ? `BAÚ ×${ev.rewardVal}!`
                : `BAÚ +${fmtNum(ev.rewardVal)}!`
              : ev.bonus
                ? `+${fmtNum(ev.bonus)}`
                : 'ELIMINADO!';
          pushPopup(txt, '#6df0a4', px, Y_PLAYER - 76);
          sfx.gateGood();
          spawnBurst(px, Y_PLAYER - 45, '#ffd166', 12);
        } else if (ev.type === 'clash') {
          pushPopup(`-${fmtNum(ev.loss)}`, '#ff7b66', px, Y_PLAYER - 68);
          sfx.clash();
          shake($('#trp-stage'), 0.5);
          spawnBurst(px, Y_PLAYER - 26, '#ff6a55', 14);
        } else if (ev.type === 'gate') {
          if (ev.cleaned) pushPopup('BRILHO LIMPO!', '#7ceeff');
          else if (ev.styleChanged) {
            const st = STYLES[state.run.style];
            pushPopup(st.tag, state.run.style === state.level.targetStyle ? '#ffd75e' : '#fff8ea');
          } else if (ev.delta !== 0) {
            pushPopup(ev.delta > 0 ? `+${fmtNum(ev.delta)}` : `-${fmtNum(Math.abs(ev.delta))}`, ev.good ? '#6df0a4' : '#ff7b66');
          }
          if (ev.good) {
            sfx.gateGood();
            spawnBurst(px, Y_PLAYER - 40, '#6df0a4', 10);
          } else {
            sfx.gateBad();
            spawnBurst(px, Y_PLAYER - 40, '#ff6a55', 10);
          }
        } else if (ev.type === 'hit') {
          pushPopup(`-${fmtNum(ev.loss)}`, '#ff7b66');
          sfx.gateBad();
          shake($('#trp-stage'), 0.45);
          spawnBurst(px, Y_PLAYER - 20, ev.variant === 'mud' ? '#6d4728' : '#e5482f', 12);
        } else if (ev.type === 'pickup') {
          if (ev.kind === 'star') {
            pushPopup(`+${fmtNum(ev.val)}★`, '#ffd166');
            sfx.gain(0);
            spawnBurst(px, Y_PLAYER - 30, '#ffd166', 8);
          } else if (ev.kind === 'clean') {
            pushPopup('LIMPO!', '#7ceeff');
            sfx.pop();
            spawnBurst(px, Y_PLAYER - 30, '#7ceeff', 8);
          } else {
            pushPopup(`+${fmtNum(ev.val)}`, '#6df0a4');
            sfx.pop();
            spawnBurst(px, Y_PLAYER - 30, '#6df0a4', 8);
          }
        }
      }

      if (state.run.status === 'lost' && state.run.failReason === 'wiped') {
        finishDuelOrRun();
      } else if (state.run.status !== 'running') {
        const totalP = state.run.finalEval.totalPower;
        const rivP = state.level.rivalPower;
        state.phase = 'duel';
        state.duel = {
          t: 0,
          dur: 1.55,
          startPower: totalP,
          rivalPower: rivP,
          endPlayer: Math.max(0, totalP - rivP),
          endRival: Math.max(0, rivP - totalP),
        };
        updateHUD();
      } else {
        updateHUD();
      }
    } else if (state.phase === 'duel' && state.duel) {
      state.duel.t += dt;
      const nowMs = performance.now();
      if (nowMs - state.lastClashSfxAt >= 100) {
        state.lastClashSfxAt = nowMs;
        sfx.clash();
        spawnBurst(ARENA_W * 0.5 + (Math.random() - 0.5) * 76, 278, '#ffd166', 5);
      }
      if (state.duel.t >= state.duel.dur) {
        state.duel = null;
        finishDuelOrRun();
      }
    }

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const p = state.popups[i];
      p.life -= dt;
      p.y -= 34 * dt;
      if (p.life <= 0) state.popups.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 220 * dt;
    }

    drawFrame();

    const active =
      state.phase === 'run' || state.phase === 'duel' || state.particles.length > 0 || state.popups.length > 0;
    if (active) state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

// ---------- Controles fluídos no canvas & teclado ----------
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.modal) return;
  if (state.phase === 'ready') startRun();
  if (state.phase !== 'run') return;
  state.drag = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startPlayerX: state.targetX,
  };
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.drag || e.pointerId !== state.drag.pointerId || state.phase !== 'run') return;
  const rect = canvas.getBoundingClientRect();
  const dx = e.clientX - state.drag.startClientX;
  const span = Math.max(120, rect.width * 0.54);
  state.targetX = clamp(state.drag.startPlayerX + (dx / span) * (PLAYER_MAX_X * 2), -PLAYER_MAX_X, PLAYER_MAX_X);
});

const clearDrag = (e) => {
  if (state.drag && (!e || e.pointerId === undefined || e.pointerId === state.drag.pointerId)) {
    state.drag = null;
  }
};
canvas.addEventListener('pointerup', clearDrag);
canvas.addEventListener('pointercancel', clearDrag);

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
        return `<button type="button" class="trp-lvl-tile${cur}${done}" data-act="pick-level" data-level="${l.id}" title="${l.title}"><span>${l.id}</span><span class="trp-tile-stars">${starsHtml}</span></button>`;
      })
      .join('');
    return `<div><h3 class="trp-chap-title">${ch.name}</h3><div class="trp-map-grid">${tiles}</div></div>`;
  }).join('');

  return modal(
    'rules',
    `<h2>Fases (${totalStars()} / ${LEVELS.length * 3} ★)</h2>
     <p class="hint">Cada fase dura ~1 minuto: atire nos baús e ondas rivais, combine o traje e vença no Coreto.</p>
     <div class="trp-chapters">${chaptersHtml}</div>
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — corredores, lógica e estratégia direto no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(3)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('crown', 's')}40 Maratonas (~1 min cada)</span>
             <p>Todas as 40 passarelas escalam de dezenas até milhões, com ondas de combate, baús e validação determinística até <b>3★</b>.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('star', 'l')}<div><b>Bônus Temático ×1.6</b><span>Vestir o traje pedido pelo júri multiplica o poder de todo o bonde na batalha do Coreto!</span></div></div>
           <div class="spec-card">${ico('bolt', 'l')}<div><b>Combate &amp; Baús</b><span>Seu bonde atira continuamente para derreter pelotões rivais, abrir baús e carregar portais negativos!</span></div></div>
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
           <b>Objetivo: sobreviver à corrida de 1 minuto e vencer a Rival no Coreto!</b>
           <span>Atire em ondas inimigas e baús, desvie de armadilhas, escolha os melhores portais + / × e vista o <b>Traje do Tema</b>!</span>
         </div>
       </div>

       <h3 class="rules-sec">1. Combate, Portais e Multiplicadores</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('hand', 'l')}
           <b>Mire &amp; Desvie</b>
           <small>Arraste ou use <b>← / →</b> para focar tiros nos baús/ondas inimigas e desviar de serras, barris e lama.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('crown', 'l')}
           <b>Traje &amp; Limpeza</b>
           <small>Traje certo dá <b>×1.6</b>, traje evitado cai para <b>×0.72</b>, e lama reduz <b>22%</b> se não limpar.</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('bolt', 'l')}
           <b>Carga &amp; Baús</b>
           <small>Portais de recarga e baús sobem/abrem com os tiros da tropa alinhada à frente deles.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Dicas e Atalhos</h3>
       <div class="rules-specials">
         <div class="spec-card">${ico('bulb', 'l')}<div><b>Dica (H)</b><span>Mostra a melhor estratégia de rota e traje para a fase atual.</span></div></div>
         <div class="spec-card">${ico('reset', 'l')}<div><b>Atalhos</b><span><b>Espaço/Enter</b> inicia ou avança, e <b>R</b> reinicia na hora.</span></div></div>
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

// ---------- Decoração & Eventos ----------
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
$('#btn-primary').innerHTML = `${ico('bolt', 's')}<span>Correr!</span>`;

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
  } else if (act === 'start-or-retry') {
    if (state.phase === 'ready') startRun();
    else {
      sfx.click();
      loadLevel(state.levelId);
    }
  } else if (act === 'advance') {
    sfx.click();
    if (state.phase === 'won') loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    else loadLevel(state.levelId);
  } else if (act === 'hint') {
    sfx.pop();
    toast(state.level.hint || state.level.subtitle);
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

  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    state.keys.left = true;
    if (state.phase === 'ready') startRun();
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    state.keys.right = true;
    if (state.phase === 'ready') startRun();
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    sfx.click();
    loadLevel(state.levelId);
  } else if (e.key === 'h' || e.key === 'H') {
    e.preventDefault();
    sfx.pop();
    toast(state.level.hint || state.level.subtitle);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (state.phase === 'ready') startRun();
    else if (state.phase === 'won') {
      sfx.click();
      loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    } else if (state.phase === 'lost') {
      sfx.click();
      loadLevel(state.levelId);
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') state.keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') state.keys.right = false;
});

loadLevel(state.levelId);
