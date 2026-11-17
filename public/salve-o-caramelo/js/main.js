import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  ARENA_W,
  ARENA_H,
  WALL_T,
  STROKE_RADIUS,
  MIN_STROKE_LEN,
  SURVIVE_TIME,
  CHAPTERS,
  LEVELS,
  getLevel,
  starThresholds,
  computeStars,
  buildStroke,
  createSim,
  stepSim,
} from './engine.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_caramelo_v1';

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

const FAIL_COPY = {
  stung: ['Picado pelas abelhas!', 'Elas encontraram uma brecha. Feche melhor o contorno ao redor do Caramelo!'],
  lava: ['Caiu na lava!', 'Faça uma base firme ou prenda o traço em um pino/beiral.'],
  water: ['Splash na água!', 'O Caramelo não sabe nadar! Evite desequilibrar a plataforma para o lado.'],
  spikes: ['Espetos no caminho!', 'Trave a descida ou evite que o escudo empurre o Caramelo até as pontas.'],
  crushed: ['Bola de espinhos!', 'Reforce a cobertura acima do Caramelo para desviar a bola pesada.'],
  fell: ['Caiu do palco!', 'Desenhe um berço ou barreira apoiada antes que ele caia.'],
};

const state = {
  levelId: saved.level,
  level: getLevel(saved.level),
  phase: 'draw', // 'draw' | 'sim' | 'won' | 'lost'
  rawPoints: [],
  previewStroke: { points: [], length: 0 },
  pointerDown: false,
  pointerId: null,
  pointerPos: null,
  showHint: false,
  cachedHintStroke: null,
  sim: null,
  rafId: 0,
  lastTs: 0,
  accum: 0,
  animTime: 0,
  particles: [],
  lastDrawSfxLen: 0,
  lastDrawSfxAt: 0,
  lastHiveSfxAt: 0,
  lastHitSfxAt: 0,
  modal: null, // null | 'map' | 'rules'
  rulesTab: 'rules',
};

const canvas = $('#sd-canvas');
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

function drawRoundedRectPath(c, x, y, w, h, r) {
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

  // Céu creme claro de cartaz quermesse
  const sky = c.createLinearGradient(0, 0, 0, ARENA_H);
  sky.addColorStop(0, '#fffaf0');
  sky.addColorStop(1, '#f4e6c7');
  c.fillStyle = sky;
  c.fillRect(0, 0, ARENA_W, ARENA_H);

  // Grade suave discreta no fundo para ajudar percepção espacial
  c.strokeStyle = 'rgba(20, 32, 43, 0.045)';
  c.lineWidth = 1;
  for (let x = WALL_T + 30; x < ARENA_W - WALL_T; x += 30) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, ARENA_H);
    c.stroke();
  }
  for (let y = 30; y < ARENA_H; y += 30) {
    c.beginPath();
    c.moveTo(WALL_T, y);
    c.lineTo(ARENA_W - WALL_T, y);
    c.stroke();
  }

  // Caixas e plataformas (tijolos e grama verde ou parede de tijolo)
  for (const bx of state.level.boxes || []) {
    c.save();
    const cx = bx.x + bx.w * 0.5;
    const cy = bx.y + bx.h * 0.5;
    c.translate(cx, cy);
    if (bx.angle) c.rotate(bx.angle);
    const x0 = -bx.w * 0.5;
    const y0 = -bx.h * 0.5;

    c.fillStyle = bx.kind === 'ground' ? '#cf7e4b' : '#c46f45';
    c.fillRect(x0, y0, bx.w, bx.h);

    // Padrão de tijolos recortado dentro da caixa
    c.save();
    c.beginPath();
    c.rect(x0, y0, bx.w, bx.h);
    c.clip();
    const bw = 24;
    const bh = 14;
    c.strokeStyle = 'rgba(72, 34, 14, 0.28)';
    c.lineWidth = 1.4;
    for (let row = 0, yy = y0 + (bx.kind === 'ground' ? 9 : 0); yy < y0 + bx.h + bh; row++, yy += bh) {
      c.beginPath();
      c.moveTo(x0, yy);
      c.lineTo(x0 + bx.w, yy);
      c.stroke();
      const offset = (row % 2) * (bw * 0.5);
      for (let xx = x0 + offset; xx < x0 + bx.w; xx += bw) {
        c.beginPath();
        c.moveTo(xx, yy);
        c.lineTo(xx, yy + bh);
        c.stroke();
      }
    }

    if (bx.kind === 'ground') {
      c.fillStyle = '#70c93a';
      c.fillRect(x0, y0, bx.w, Math.min(10, bx.h));
      c.fillStyle = '#9be862';
      c.fillRect(x0, y0, bx.w, Math.min(3.5, bx.h));
      c.strokeStyle = '#14202b';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(x0, y0 + Math.min(10, bx.h));
      c.lineTo(x0 + bx.w, y0 + Math.min(10, bx.h));
      c.stroke();
    }
    c.restore();

    c.strokeStyle = '#14202b';
    c.lineWidth = 2.4;
    c.strokeRect(x0, y0, bx.w, bx.h);
    c.restore();
  }

  // Moldura lateral de madeira (fiel ao print!)
  const drawWall = (x) => {
    const grad = c.createLinearGradient(x, 0, x + WALL_T, 0);
    grad.addColorStop(0, '#c69053');
    grad.addColorStop(0.5, '#dfb073');
    grad.addColorStop(1, '#a9743b');
    c.fillStyle = grad;
    c.fillRect(x, 0, WALL_T, ARENA_H);
    c.strokeStyle = '#14202b';
    c.lineWidth = 2;
    c.strokeRect(x, 0, WALL_T, ARENA_H);
  };
  drawWall(0);
  drawWall(ARENA_W - WALL_T);

  // Barra discreta no topo interno
  c.fillStyle = '#b47d43';
  c.fillRect(0, 0, ARENA_W, WALL_T);
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.strokeRect(0, 0, ARENA_W, WALL_T);
}

function drawHazards(c, t) {
  for (const hz of state.level.hazards || []) {
    if (hz.type === 'lava') {
      c.save();
      c.beginPath();
      c.rect(hz.x, hz.y, hz.w, hz.h);
      c.clip();
      let grad = hz._grad;
      if (!grad) {
        grad = c.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
        grad.addColorStop(0, '#ff8826');
        grad.addColorStop(0.35, '#e5482f');
        grad.addColorStop(1, '#9d1d12');
        hz._grad = grad;
      }
      c.fillStyle = grad;
      c.fillRect(hz.x, hz.y, hz.w, hz.h);

      // Crista ondulada brilhante
      c.fillStyle = '#ffd147';
      c.beginPath();
      c.moveTo(hz.x, hz.y + 8);
      for (let x = hz.x; x <= hz.x + hz.w; x += 6) {
        const y = hz.y + 4 + Math.sin(x * 0.14 + t * 5) * 2.5;
        c.lineTo(x, y);
      }
      c.lineTo(hz.x + hz.w, hz.y + 11);
      c.lineTo(hz.x, hz.y + 11);
      c.closePath();
      c.fill();

      // Bolhas de lava
      for (let i = 0; i < 4; i++) {
        const bx = hz.x + ((i + 0.5) / 4) * hz.w;
        const phase = (t * 0.9 + i * 0.37) % 1;
        const by = hz.y + hz.h - phase * (hz.h - 10);
        const br = 2.5 + Math.sin(phase * Math.PI) * 3;
        c.fillStyle = '#ffd147';
        c.beginPath();
        c.arc(bx, by, br, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
      c.strokeStyle = '#14202b';
      c.lineWidth = 2;
      c.strokeRect(hz.x, hz.y, hz.w, hz.h);
    } else if (hz.type === 'water') {
      c.save();
      c.beginPath();
      c.rect(hz.x, hz.y, hz.w, hz.h);
      c.clip();
      let grad = hz._grad;
      if (!grad) {
        grad = c.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
        grad.addColorStop(0, '#59a6ff');
        grad.addColorStop(0.5, '#3d7be0');
        grad.addColorStop(1, '#1e4fa3');
        hz._grad = grad;
      }
      c.fillStyle = grad;
      c.fillRect(hz.x, hz.y, hz.w, hz.h);

      c.fillStyle = '#b4e0ff';
      c.beginPath();
      c.moveTo(hz.x, hz.y + 8);
      for (let x = hz.x; x <= hz.x + hz.w; x += 6) {
        const y = hz.y + 4 + Math.sin(x * 0.12 - t * 4.2) * 2.5;
        c.lineTo(x, y);
      }
      c.lineTo(hz.x + hz.w, hz.y + 10);
      c.lineTo(hz.x, hz.y + 10);
      c.closePath();
      c.fill();
      c.restore();
      c.strokeStyle = '#14202b';
      c.lineWidth = 2;
      c.strokeRect(hz.x, hz.y, hz.w, hz.h);
    } else if (hz.type === 'spikes') {
      const count = Math.max(2, Math.floor(hz.w / 14));
      const sw = hz.w / count;
      const down = hz.dir === 'down';
      c.fillStyle = '#b8c7d8';
      c.strokeStyle = '#14202b';
      c.lineWidth = 2;
      for (let i = 0; i < count; i++) {
        const sx = hz.x + i * sw;
        c.beginPath();
        if (down) {
          c.moveTo(sx, hz.y);
          c.lineTo(sx + sw * 0.5, hz.y + hz.h);
          c.lineTo(sx + sw, hz.y);
        } else {
          c.moveTo(sx, hz.y + hz.h);
          c.lineTo(sx + sw * 0.5, hz.y);
          c.lineTo(sx + sw, hz.y + hz.h);
        }
        c.closePath();
        c.fill();
        c.stroke();
      }
    }
  }
}

function drawPin(c, pin) {
  c.save();
  c.translate(pin.x, pin.y);
  c.fillStyle = 'rgba(20, 32, 43, 0.25)';
  c.beginPath();
  c.arc(1.5, 2.5, pin.r, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#6c7e91';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2.4;
  c.beginPath();
  c.arc(0, 0, pin.r, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  c.fillStyle = '#f7b733';
  c.beginPath();
  c.arc(0, 0, pin.r * 0.48, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawHive(c, h, shakeAmt = 0, t = 0) {
  c.save();
  const jx = shakeAmt > 0 ? Math.sin(t * 58 + h.x) * shakeAmt * 2.5 : 0;
  const jy = shakeAmt > 0 ? Math.cos(t * 48 + h.y) * shakeAmt * 1.5 : 0;
  c.translate(h.x + jx, h.y + jy);
  if (shakeAmt > 0) {
    c.scale(1 + shakeAmt * 0.14, 1 - shakeAmt * 0.09);
  }

  const layers = [
    { rx: 14, ry: 6, y: -15, fill: '#f7c843' },
    { rx: 19, ry: 7, y: -7, fill: '#f0b12b' },
    { rx: 22, ry: 8, y: 2, fill: '#f7c843' },
    { rx: 19, ry: 7, y: 11, fill: '#e09a1e' },
    { rx: 13, ry: 5, y: 19, fill: '#f0b12b' },
  ];
  for (const ly of layers) {
    c.fillStyle = ly.fill;
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(0, ly.y, ly.rx, ly.ry, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // Entrada escura da colmeia
  c.fillStyle = '#2d1608';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(2, 4, 7.5, 9.5, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawSpikeball(c, b) {
  c.save();
  c.translate(b.x, b.y);
  c.rotate(b.angle || 0);

  const spikes = 10;
  c.fillStyle = '#7e90a4';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(b.r - 5, -4.5);
    c.lineTo(b.r + 5.5, 0);
    c.lineTo(b.r - 5, 4.5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  const grad = c.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 3, 0, 0, b.r);
  grad.addColorStop(0, '#9eb2c7');
  grad.addColorStop(0.65, '#4c5f73');
  grad.addColorStop(1, '#2d3b49');
  c.fillStyle = grad;
  c.strokeStyle = '#14202b';
  c.lineWidth = 2.6;
  c.beginPath();
  c.arc(0, 0, b.r - 2, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawCaramelo(c, d, lookTarget, bees, t) {
  c.save();
  c.translate(d.x, d.y);
  c.rotate(d.angle || 0);
  const r = d.r || 22;

  // Orelhas caídas e macias do vira-lata Caramelo (balançam levemente)
  const earFlop = bees.length > 0 && d.mood === 'scared' ? Math.sin(t * 22) * 0.14 : Math.sin(t * 3.5) * 0.04;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * r * 0.88, -r * 0.36);
    c.rotate(side * (0.28 + earFlop));
    c.fillStyle = '#a3551c';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.4;
    c.beginPath();
    c.ellipse(0, r * 0.36, r * 0.34, r * 0.56, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  // Cabeça caramelo dourado com brilho suave
  const furGrad = c.createRadialGradient(-r * 0.25, -r * 0.3, 4, 0, 0, r);
  furGrad.addColorStop(0, '#eba14c');
  furGrad.addColorStop(1, '#d17b2a');
  c.fillStyle = furGrad;
  c.strokeStyle = '#14202b';
  c.lineWidth = 2.6;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Focinho e bochechas bege-claro típicas do Caramelo
  c.fillStyle = '#f7da9f';
  c.beginPath();
  c.ellipse(0, r * 0.34, r * 0.72, r * 0.52, 0, 0, Math.PI * 2);
  c.fill();

  // Coleira vermelha de quermesse com pingente dourado
  c.fillStyle = '#e5482f';
  c.strokeStyle = '#14202b';
  c.lineWidth = 1.8;
  drawRoundedRectPath(c, -r * 0.52, r * 0.74, r * 1.04, 5.5, 3);
  c.fill();
  c.stroke();
  c.fillStyle = '#f7b733';
  c.beginPath();
  c.arc(0, r * 0.9, 3.2, 0, Math.PI * 2);
  c.fill();
  c.stroke();

  // Pintinhas bege acima dos olhos
  c.fillStyle = '#f7da9f';
  c.beginPath();
  c.ellipse(-r * 0.34, -r * 0.42, 3.6, 2.2, -0.2, 0, Math.PI * 2);
  c.ellipse(r * 0.34, -r * 0.42, 3.6, 2.2, 0.2, 0, Math.PI * 2);
  c.fill();

  // Expressão conforme o humor
  if (d.mood === 'stung' || d.mood === 'lava' || d.mood === 'water' || d.mood === 'spikes') {
    c.strokeStyle = '#14202b';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    for (const ex of [-r * 0.34, r * 0.34]) {
      const ey = -r * 0.14;
      c.beginPath();
      c.moveTo(ex - 3.5, ey - 3.5);
      c.lineTo(ex + 3.5, ey + 3.5);
      c.moveTo(ex + 3.5, ey - 3.5);
      c.lineTo(ex - 3.5, ey + 3.5);
      c.stroke();
    }
    // Calo vermelho
    c.fillStyle = '#e5482f';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(r * 0.44, -r * 0.62, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } else if (d.mood === 'cool') {
    // Óculos escuros de vitória!
    c.fillStyle = '#14202b';
    drawRoundedRectPath(c, -r * 0.72, -r * 0.35, r * 0.64, r * 0.42, 4);
    c.fill();
    drawRoundedRectPath(c, r * 0.08, -r * 0.35, r * 0.64, r * 0.42, 4);
    c.fill();
    c.fillRect(-r * 0.12, -r * 0.25, r * 0.24, 3.5);
    c.strokeStyle = 'rgba(255,255,255,0.75)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.56, -r * 0.26);
    c.lineTo(-r * 0.38, -r * 0.06);
    c.moveTo(r * 0.24, -r * 0.26);
    c.lineTo(r * 0.42, -r * 0.06);
    c.stroke();
  } else {
    let tx = 0;
    let ty = 0;
    let look = lookTarget;
    if (bees.length > 0) {
      let best = Infinity;
      for (const b of bees) {
        const dd = (b.x - d.x) ** 2 + (b.y - d.y) ** 2;
        if (dd < best) {
          best = dd;
          look = b;
        }
      }
    }
    if (look) {
      const ang = Math.atan2(look.y - d.y, look.x - d.x);
      tx = Math.cos(ang) * 2.1;
      ty = Math.sin(ang) * 2.1;
    }

    for (const side of [-1, 1]) {
      const ex = side * r * 0.34;
      const ey = -r * 0.14;
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#14202b';
      c.lineWidth = 1.9;
      c.beginPath();
      c.ellipse(ex, ey, 4.9, d.mood === 'scared' ? 5.4 : 4.4, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#14202b';
      c.beginPath();
      c.arc(ex + tx * 0.65, ey + ty * 0.65, 2.4, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(ex + tx * 0.4 - 1, ey + ty * 0.4 - 1.1, 0.9, 0, Math.PI * 2);
      c.fill();
    }

    if (d.mood === 'scared' && bees.length > 0) {
      const bob = Math.sin(t * 10) * 1.5;
      c.fillStyle = '#8fd3ff';
      c.strokeStyle = '#14202b';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(r * 0.7, -r * 0.56 + bob);
      c.quadraticCurveTo(r * 0.9, -r * 0.26 + bob, r * 0.7, -r * 0.2 + bob);
      c.quadraticCurveTo(r * 0.52, -r * 0.26 + bob, r * 0.7, -r * 0.56 + bob);
      c.fill();
      c.stroke();
    }
  }

  // Focinho escuro e língua rosada feliz quando tranquilo/vencedor
  c.fillStyle = '#14202b';
  c.beginPath();
  c.ellipse(0, r * 0.14, 4.5, 3.2, 0, 0, Math.PI * 2);
  c.fill();

  if (d.mood === 'chill' || d.mood === 'cool') {
    c.fillStyle = '#ff7b94';
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(0, r * 0.48, 3.6, 4.2, 0, 0, Math.PI);
    c.fill();
    c.stroke();
  }

  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  if (d.mood === 'cool') {
    c.moveTo(-6, r * 0.34);
    c.quadraticCurveTo(0, r * 0.56, 6, r * 0.34);
  } else if (d.mood === 'stung' || d.mood === 'lava' || d.mood === 'water' || d.mood === 'spikes') {
    c.arc(0, r * 0.44, 3.4, 0, Math.PI * 2);
  } else {
    c.moveTo(-5, r * 0.32);
    c.quadraticCurveTo(-2.5, r * 0.45, 0, r * 0.32);
    c.quadraticCurveTo(2.5, r * 0.45, 5, r * 0.32);
  }
  c.stroke();
  c.restore();
}

function drawBee(c, bee, t) {
  c.save();
  const bob = Math.sin(t * 24 + bee.phase) * 1.2;
  const vibX = bee.windupTimer > 0 ? Math.sin(t * 95 + bee.phase) * 1.8 : 0;
  const vibY = bee.windupTimer > 0 ? Math.cos(t * 85 + bee.phase) * 1.8 : 0;
  c.translate(bee.x + vibX, bee.y + bob + vibY);

  // Halo de aviso quando preparando investida ("windup")
  if (bee.windupTimer > 0) {
    c.save();
    c.strokeStyle = bee.heavy ? 'rgba(229, 72, 47, 0.72)' : 'rgba(247, 183, 51, 0.72)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, bee.r + 4 + Math.sin(t * 50) * 1.5, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  const flip = bee.vx < -4 ? -1 : 1;
  c.scale(flip, 1);

  const pitch = Math.max(-0.52, Math.min(0.52, Math.atan2(bee.vy, Math.abs(bee.vx) + 40) * 0.55));
  c.rotate(pitch);

  const baseScale = bee.heavy ? 1.24 : 1;
  const stretch = bee.dashTimer > 0 ? 1.18 : bee.bounceCool > 0.08 ? 0.88 : 1;
  c.scale(baseScale * stretch, baseScale / stretch);

  // Rastro de velocidade durante o dash
  if (bee.dashTimer > 0) {
    c.save();
    c.strokeStyle = bee.heavy ? 'rgba(229, 72, 47, 0.75)' : 'rgba(247, 183, 51, 0.8)';
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-12, -4);
    c.lineTo(-22, -4);
    c.moveTo(-14, 2);
    c.lineTo(-25, 2);
    c.stroke();
    c.restore();
  }

  const wingFreq = bee.dashTimer > 0 || bee.windupTimer > 0 ? 78 : 54;
  const flap1 = Math.sin(t * wingFreq + bee.phase) * 0.55;
  const flap2 = Math.sin(t * wingFreq + bee.phase + 0.9) * 0.45;

  // Asa traseira
  c.fillStyle = 'rgba(225, 244, 255, 0.72)';
  c.strokeStyle = '#14202b';
  c.lineWidth = 1.2;
  c.save();
  c.rotate(-0.65 + flap2);
  c.beginPath();
  c.ellipse(-3.5, -7.5, 3.6, 5.6, -0.35, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();

  // Ferrão atrás
  c.fillStyle = '#14202b';
  c.beginPath();
  c.moveTo(-8, 0);
  c.lineTo(bee.heavy ? -14.5 : -12.5, -2);
  c.lineTo(bee.heavy ? -14.5 : -12.5, 2);
  c.closePath();
  c.fill();

  // Corpo amarelo/âmbar com listras (zangão tem tom laranja-avermelhado mais feroz)
  c.fillStyle = bee.heavy ? '#f08c2b' : '#f7c843';
  c.strokeStyle = '#14202b';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, 0, 8.8, 6.6, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.clip();
  c.fillStyle = '#14202b';
  c.fillRect(-5.8, -7, 2.9, 14);
  c.fillRect(-0.8, -7, 2.9, 14);
  c.restore();
  c.stroke();

  // Asa frontal
  c.fillStyle = 'rgba(255, 255, 255, 0.88)';
  c.strokeStyle = '#14202b';
  c.lineWidth = 1.4;
  c.save();
  c.rotate(-0.3 + flap1);
  c.beginPath();
  c.ellipse(-1, -8, 4.1, 6.4, -0.25, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();

  // Topete/chifre pequeno no zangão pesado
  if (bee.heavy) {
    c.fillStyle = '#e5482f';
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(2, -5.5);
    c.lineTo(5.5, -9.5);
    c.lineTo(7, -4.5);
    c.closePath();
    c.fill();
    c.stroke();
  }

  // Olho bravo + sobrancelha
  c.fillStyle = bee.heavy || bee.dashTimer > 0 ? '#ffe0d9' : '#ffffff';
  c.beginPath();
  c.arc(4.8, -0.8, 2.4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = bee.heavy ? '#b81d13' : '#14202b';
  c.beginPath();
  c.arc(5.4, -0.8, 1.3, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = '#14202b';
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(2.4, -4);
  c.lineTo(7.2, -2.5);
  c.stroke();
  c.restore();
}

function drawPolylineStroke(c, pts, isDrawing) {
  if (!pts || pts.length < 2) return;
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Contorno externo forte em piche
  c.strokeStyle = '#14202b';
  c.lineWidth = STROKE_RADIUS * 2;
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();

  // Miolo estilizado (azul-ardósia no desenho, grafite firme na simulação)
  c.strokeStyle = isDrawing ? '#3d7be0' : '#2d4558';
  c.lineWidth = STROKE_RADIUS * 1.15;
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
  c.restore();
}

function drawHintAndTutorial(c, t) {
  const lv = state.level;
  if (state.phase === 'draw' && lv.tutorialRect && state.rawPoints.length === 0 && !state.showHint) {
    const tr = lv.tutorialRect;
    c.save();
    c.strokeStyle = 'rgba(229, 72, 47, 0.52)';
    c.lineWidth = 3;
    c.setLineDash([8, 6]);
    c.strokeRect(tr.x, tr.y, tr.w, tr.h);

    // Mãozinha guiando o traço na Fase 1
    const u = (t * 0.55) % 1;
    let hx = tr.x;
    let hy = tr.y + tr.h;
    if (u < 0.25) {
      hy = tr.y + tr.h * (1 - u / 0.25);
    } else if (u < 0.75) {
      hx = tr.x + tr.w * ((u - 0.25) / 0.5);
      hy = tr.y;
    } else {
      hx = tr.x + tr.w;
      hy = tr.y + tr.h * ((u - 0.75) / 0.25);
    }
    c.setLineDash([]);
    c.fillStyle = '#fff8ea';
    c.strokeStyle = '#14202b';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(hx, hy, 7, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }

  if (state.showHint && state.cachedHintStroke && state.cachedHintStroke.length >= 2) {
    const pts = state.cachedHintStroke;
    c.save();
    c.strokeStyle = 'rgba(61, 123, 224, 0.42)';
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.setLineDash([12, 10]);
    c.lineDashOffset = -t * 36;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
    c.restore();
  }
}

function spawnImpactSparks(x, y, nx, ny, heavy = false) {
  const count = heavy ? 6 : 4;
  for (let i = 0; i < count && state.particles.length < 90; i++) {
    const spread = (Math.random() - 0.5) * 1.9;
    const baseAng = Math.atan2(ny, nx) + spread;
    const spd = (heavy ? 115 : 80) + Math.random() * 75;
    state.particles.push({
      x,
      y,
      vx: Math.cos(baseAng) * spd,
      vy: Math.sin(baseAng) * spd,
      r: (heavy ? 3.4 : 2.5) + Math.random() * 1.4,
      life: 0.22 + Math.random() * 0.14,
      maxLife: 0.34,
      color: heavy ? '#e5482f' : '#f7b733',
    });
  }
}

function spawnHivePuff(x, y) {
  for (let i = 0; i < 4 && state.particles.length < 90; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 35 + Math.random() * 55;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      r: 3 + Math.random() * 2,
      life: 0.25 + Math.random() * 0.12,
      maxLife: 0.35,
      color: '#fff8ea',
    });
  }
}

function stepParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
  }
}

function drawParticles(c) {
  for (const p of state.particles) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = p.color;
    c.strokeStyle = '#14202b';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(p.x, p.y, p.r * (0.4 + 0.6 * alpha), 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  }
}

function drawFrame() {
  ensureCanvasScale();
  const dpr = renderDpr || 1;
  const c = ctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Fundo estático em cache
  c.drawImage(staticCanvas, 0, 0, ARENA_W, ARENA_H);

  // Perigos animados (lava, água, espinhos)
  drawHazards(c, state.animTime);

  // Guia de dica/tutorial
  drawHintAndTutorial(c, state.animTime);

  // Pinos de âncora
  for (const p of state.level.pins || []) drawPin(c, p);

  // Traço desenhado (em desenho ou corpo rígido simulado)
  if (state.phase === 'draw') {
    drawPolylineStroke(c, state.previewStroke.points, true);
    const pts = state.previewStroke.points;
    if (state.pointerDown && pts.length > 0) {
      const tip = pts[pts.length - 1];
      c.save();
      c.fillStyle = '#f7b733';
      c.strokeStyle = '#14202b';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(tip.x, tip.y, 4.5, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
    }
  } else if (state.sim?.stroke) {
    drawPolylineStroke(c, state.sim.stroke.worldPts, false);
  }

  // Entidades dinâmicas ou iniciais
  const doges = state.sim ? state.sim.doges : state.level.doges.map((d) => ({ ...d, mood: 'chill', angle: 0 }));
  const boulders = state.sim ? state.sim.boulders : state.level.boulders || [];
  const hives = state.sim ? state.sim.hives : state.level.hives || [];
  const bees = state.sim ? state.sim.bees : [];

  for (const b of boulders) drawSpikeball(c, b);
  for (const d of doges) drawCaramelo(c, d, state.pointerPos, bees, state.animTime);
  for (const h of hives) drawHive(c, h, h.shake || 0, state.animTime);
  for (const bee of bees) drawBee(c, bee, state.animTime);
  drawParticles(c);

  // Marca de impacto ao perder
  if (state.phase === 'lost' && state.sim?.failPos) {
    const fp = state.sim.failPos;
    c.save();
    c.translate(fp.x, fp.y);
    c.strokeStyle = '#e5482f';
    c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      c.beginPath();
      c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      c.lineTo(Math.cos(a) * 26, Math.sin(a) * 26);
      c.stroke();
    }
    c.restore();
  }
}

const hudCache = {
  lvlKey: '',
  starsKey: '',
  inkPct: '',
  inkCls: '',
  curStars: -1,
  timerTxt: '',
  timerCls: '',
  statusKey: '',
  locked: null,
  hintKey: '',
};

function updateHUD() {
  const lv = state.level;
  const { inkMax } = starThresholds(lv);
  const inkUsed = state.phase === 'draw' ? state.previewStroke.length : state.sim ? state.sim.inkUsed : 0;
  const remRatio = Math.max(0, Math.min(1, 1 - inkUsed / inkMax));
  const curStars = computeStars(inkUsed, lv);

  const lvlKey = `${lv.id}|${lv.title}`;
  if (hudCache.lvlKey !== lvlKey) {
    hudCache.lvlKey = lvlKey;
    $('#sd-level-num').textContent = `FASE ${lv.id} / ${LEVELS.length}`;
    $('#sd-level-name').textContent = lv.title;
    $('#btn-prev').disabled = lv.id <= 1;
    $('#btn-next').disabled = lv.id >= LEVELS.length;
  }

  const starsKey = `${totalStars()}`;
  if (hudCache.starsKey !== starsKey) {
    hudCache.starsKey = starsKey;
    $('#sd-total-stars').textContent = `★ ${starsKey}/${LEVELS.length * 3}`;
  }

  const inkPct = `${(remRatio * 100).toFixed(1)}%`;
  const inkCls = remRatio < 0.34 ? 'sd-ink-fill low' : remRatio < 0.67 ? 'sd-ink-fill warn' : 'sd-ink-fill';
  if (hudCache.inkPct !== inkPct || hudCache.inkCls !== inkCls) {
    const fill = $('#sd-ink-fill');
    if (hudCache.inkPct !== inkPct) {
      hudCache.inkPct = inkPct;
      fill.style.width = inkPct;
    }
    if (hudCache.inkCls !== inkCls) {
      hudCache.inkCls = inkCls;
      fill.className = inkCls;
    }
  }

  if (hudCache.curStars !== curStars) {
    hudCache.curStars = curStars;
    document.querySelectorAll('#sd-ink-stars .sd-star-mark').forEach((el) => {
      const tier = Number(el.dataset.tier);
      el.classList.toggle('dim', curStars < tier);
    });
  }

  let timerTxt;
  let timerCls;
  let stCls;
  let stHtml;
  if (state.phase === 'draw') {
    timerTxt = `${SURVIVE_TIME.toFixed(1)}s`;
    timerCls = 'sd-timer-pill';
    stCls = 'sd-status-bar';
    stHtml = lv.subtitle;
  } else if (state.phase === 'sim') {
    const rem = Math.max(0, SURVIVE_TIME - (state.sim?.elapsed || 0));
    timerTxt = `${rem.toFixed(1)}s`;
    timerCls = 'sd-timer-pill live';
    stCls = 'sd-status-bar';
    stHtml = `Segure firme! Faltam <b>${timerTxt}</b> para salvar o Caramelo.`;
  } else if (state.phase === 'won') {
    timerTxt = '0.0s';
    timerCls = 'sd-timer-pill won';
    stCls = 'sd-status-bar win';
    stHtml = `${ico('crown', 's')} Fase ${lv.id} salva com <b>${state.sim.stars} estrela${state.sim.stars > 1 ? 's' : ''}</b>!`;
  } else {
    const rem = Math.max(0, SURVIVE_TIME - (state.sim?.elapsed || 0));
    timerTxt = `${rem.toFixed(1)}s`;
    timerCls = 'sd-timer-pill lost';
    stCls = 'sd-status-bar err';
    const [head] = FAIL_COPY[state.sim?.failReason] || FAIL_COPY.stung;
    stHtml = `${ico('nope', 's')} ${head}`;
  }

  if (hudCache.timerTxt !== timerTxt) {
    hudCache.timerTxt = timerTxt;
    $('#sd-timer').textContent = timerTxt;
  }
  if (hudCache.timerCls !== timerCls) {
    hudCache.timerCls = timerCls;
    $('#sd-timer').className = timerCls;
  }
  const statusKey = `${stCls}|${stHtml}`;
  if (hudCache.statusKey !== statusKey) {
    hudCache.statusKey = statusKey;
    const statusEl = $('#sd-status');
    statusEl.className = stCls;
    statusEl.innerHTML = stHtml;
  }

  const locked = state.phase !== 'draw';
  if (hudCache.locked !== locked) {
    hudCache.locked = locked;
    canvas.classList.toggle('locked', locked);
  }
  const hintKey = `${state.showHint ? 1 : 0}|${state.phase === 'won' ? 1 : 0}`;
  if (hudCache.hintKey !== hintKey) {
    hudCache.hintKey = hintKey;
    const hintBtn = $('#btn-hint');
    if (hintBtn) {
      hintBtn.classList.toggle('on', state.showHint);
      hintBtn.disabled = state.phase === 'won';
    }
  }
}

function showOverlay() {
  const overlay = $('#sd-overlay');
  const titleEl = $('#sd-res-title');
  const starsEl = $('#sd-res-stars');
  const subEl = $('#sd-res-sub');
  const nextBtn = $('#btn-res-next');
  const retryBtn = $('#btn-res-retry');

  if (state.phase === 'won') {
    const stars = state.sim.stars;
    titleEl.textContent = state.level.id === LEVELS.length ? 'Todas as 40 Salvas!' : 'Caramelo Salvo!';
    titleEl.className = 'sd-result-title';
    starsEl.innerHTML = [1, 2, 3]
      .map((n) => `<span class="sd-result-star ${n <= stars ? '' : 'off'}">${ico('star', 'l')}</span>`)
      .join('');
    const effPct = Math.max(1, Math.round(100 - (state.sim.inkUsed / starThresholds(state.level).inkMax) * 100));
    subEl.textContent = `Sobrou ${effPct}% de tinta · Fase ${state.level.id}/40 concluída!`;
    nextBtn.textContent = state.level.id < LEVELS.length ? 'Próxima Fase →' : 'Voltar à Fase 1';
    nextBtn.className = 'btn yellow';
    retryBtn.classList.remove('hidden');
    overlay.classList.remove('hidden');
  } else if (state.phase === 'lost') {
    const [title, desc] = FAIL_COPY[state.sim?.failReason] || FAIL_COPY.stung;
    titleEl.textContent = title;
    titleEl.className = 'sd-result-title fail';
    starsEl.innerHTML = '';
    subEl.textContent = desc;
    nextBtn.textContent = 'Tentar de Novo';
    nextBtn.className = 'btn yellow';
    retryBtn.classList.add('hidden');
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

function handleWin() {
  state.phase = 'won';
  const stars = state.sim.stars;
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

function handleFail() {
  state.phase = 'lost';
  sfx.dogWhimper(state.sim?.failReason);
  sfx.err();
  shake($('#sd-stage'));
  updateHUD();
  showOverlay();
}

function startLoop() {
  if (state.rafId) return;
  state.lastTs = 0;
  const tick = (ts) => {
    if (document.hidden || state.modal) {
      state.lastTs = ts;
      state.rafId = requestAnimationFrame(tick);
      return;
    }
    if (!state.lastTs) state.lastTs = ts;
    const realDt = Math.min(0.05, Math.max(0, (ts - state.lastTs) / 1000));
    state.lastTs = ts;
    state.animTime += realDt;

    if (state.phase === 'sim' && state.sim) {
      state.accum += realDt;
      const fixed = 1 / 60;
      let steps = 0;
      while (state.accum >= fixed && steps < 3 && state.sim.status === 'running') {
        stepSim(state.sim, fixed);
        state.accum -= fixed;
        steps++;
      }
      const nowMs = performance.now();
      while (state.sim.spawnEvents.length > 0) {
        const sp = state.sim.spawnEvents.pop();
        spawnHivePuff(sp.x, sp.y);
        if (nowMs - state.lastHiveSfxAt >= 85) {
          state.lastHiveSfxAt = nowMs;
          sfx.hivePop(sp.heavy);
        }
      }
      while (state.sim.hitEvents.length > 0) {
        const hit = state.sim.hitEvents.pop();
        spawnImpactSparks(hit.x, hit.y, hit.nx, hit.ny, hit.heavy);
        if (nowMs - state.lastHitSfxAt >= 70) {
          state.lastHitSfxAt = nowMs;
          sfx.beeHit(hit.heavy);
        }
      }
      if (state.sim.status === 'won') handleWin();
      else if (state.sim.status === 'lost') handleFail();
      else updateHUD();
    }
    stepParticles(realDt);

    drawFrame();
    state.rafId = requestAnimationFrame(tick);
  };
  state.rafId = requestAnimationFrame(tick);
}

function loadLevel(id) {
  state.levelId = Math.max(1, Math.min(LEVELS.length, Number(id) || 1));
  state.level = getLevel(state.levelId);
  saved.level = state.levelId;
  saveProgress();

  state.phase = 'draw';
  state.rawPoints = [];
  state.previewStroke = { points: [], length: 0 };
  state.pointerDown = false;
  state.pointerId = null;
  state.showHint = false;
  state.sim = null;
  state.accum = 0;
  state.particles = [];
  state.lastDrawSfxLen = 0;
  state.lastDrawSfxAt = 0;
  state.cachedHintStroke = state.level.hintStroke ? buildStroke(state.level.hintStroke, state.level).points : null;

  buildStaticLayer();
  showOverlay();
  updateHUD();
  drawFrame();
}

function arenaCoordsFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: ARENA_W * 0.5, y: ARENA_H * 0.5 };
  return {
    x: ((e.clientX - rect.left) / rect.width) * ARENA_W,
    y: ((e.clientY - rect.top) / rect.height) * ARENA_H,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.phase !== 'draw' || state.modal) return;
  const pt = arenaCoordsFromPointer(e);
  state.pointerDown = true;
  state.pointerId = e.pointerId;
  state.pointerPos = pt;
  state.rawPoints = [[pt.x, pt.y]];
  state.previewStroke = { points: [], length: 0 };
  state.lastDrawSfxLen = 0;
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  const pt = arenaCoordsFromPointer(e);
  state.pointerPos = pt;
  if (!state.pointerDown || e.pointerId !== state.pointerId || state.phase !== 'draw') return;
  const last = state.rawPoints[state.rawPoints.length - 1];
  if (last && Math.hypot(pt.x - last[0], pt.y - last[1]) < 3) return;
  state.rawPoints.push([pt.x, pt.y]);
  state.previewStroke = buildStroke(state.rawPoints, state.level);
  const nowMs = performance.now();
  if (state.previewStroke.length - state.lastDrawSfxLen >= 28 && nowMs - state.lastDrawSfxAt >= 55) {
    state.lastDrawSfxLen = state.previewStroke.length;
    state.lastDrawSfxAt = nowMs;
    const remRatio = Math.max(0, 1 - state.previewStroke.length / starThresholds(state.level).inkMax);
    sfx.drawTick(remRatio);
  }
  updateHUD();
});

function finishStroke(e, launch) {
  if (!state.pointerDown) return;
  if (e && e.pointerId !== undefined && e.pointerId !== state.pointerId) return;
  state.pointerDown = false;
  state.pointerId = null;
  if (state.phase !== 'draw') return;

  const built = buildStroke(state.rawPoints, state.level);
  if (!launch || built.length < MIN_STROKE_LEN) {
    if (launch && state.rawPoints.length >= 2 && built.length < MIN_STROKE_LEN) {
      toast('Desenhe um traço um pouco maior em área livre!', 'err');
    }
    state.rawPoints = [];
    state.previewStroke = { points: [], length: 0 };
    updateHUD();
    return;
  }

  sfx.pop();
  state.sim = createSim(state.level, state.rawPoints);
  state.phase = 'sim';
  state.accum = 0;
  updateHUD();
}

canvas.addEventListener('pointerup', (e) => finishStroke(e, true));
canvas.addEventListener('pointercancel', (e) => finishStroke(e, false));

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
        const starsHtml = [1, 2, 3]
          .map((n) => `<span class="${n <= st ? 'on' : 'off'}">★</span>`)
          .join('');
        return `<button type="button" class="sd-lvl-tile${cur}${done}" data-act="pick-level" data-level="${l.id}" title="${l.title}"><span>${l.id}</span><span class="sd-tile-stars">${starsHtml}</span></button>`;
      })
      .join('');
    return `<div><h3 class="sd-chap-title">${ch.name}</h3><div class="sd-map-grid">${tiles}</div></div>`;
  }).join('');

  return modal(
    'rules',
    `<h2>Fases (${totalStars()} / ${LEVELS.length * 3} ★)</h2>
     <p class="hint">Escolha qualquer uma das 40 fases para jogar ou melhorar suas estrelas.</p>
     <div class="sd-chapters">${chaptersHtml}</div>
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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — física 2D e quebra-cabeças feitos na unha direto no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(2)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('bolt', 's')}Física real no traço</span>
             <p>O desenho ganha massa, centro de gravidade, atrito e torque ao soltar — cada arco, berço ou gancho nos pinos reage de verdade às abelhas e bolas de espinho.</p>
           </div>
         </div>
         <div class="rules-specials">
           <div class="spec-card">${ico('star', 'l')}<div><b>40 Fases Progressivas</b><span>4 capítulos passando por colmeias, pinos flutuantes, água, lava, duplas e bolas rolantes.</span></div></div>
           <div class="spec-card">${ico('bulb', 'l')}<div><b>Economia de tinta</b><span>Use menos tinta no traço para conquistar as 3 estrelas em todas as fases.</span></div></div>
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
           <b>Objetivo: manter o Caramelo ileso por 6 segundos!</b>
           <span>Trace uma única linha contínua para bloquear as abelhas, impedir quedas na lava/água e desviar bolas de espinhos.</span>
         </div>
       </div>

       <h3 class="rules-sec">1. Desenho e física</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('hand', 'l')}
           <b>1 Traço Contínuo</b>
           <small>Segure e arraste para desenhar. Ao soltar, a linha cai com gravidade real!</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('star', 'l')}
           <b>Tinta &amp; Estrelas</b>
           <small>Quanto menos tinta gastar na barreira, mais estrelas você garante (até 3 ★).</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('bolt', 'l')}
           <b>Enganche em Pinos</b>
           <small>Use pinos e beirais para pendurar ou travar seu escudo contra o enxame.</small>
         </div>
       </div>

       <h3 class="rules-sec">2. Dicas e Atalhos</h3>
       <div class="rules-specials">
         <div class="spec-card">${ico('bulb', 'l')}<div><b>Botão Dica (H)</b><span>Exibe uma linha pontilhada sugerindo um formato possível para a fase.</span></div></div>
         <div class="spec-card">${ico('reset', 'l')}<div><b>Teclas rápidas</b><span><b>R</b> reinicia na hora, <b>Espaço/Enter</b> avança ou tenta de novo, e as setas trocam de fase.</span></div></div>
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

// ---------- Inicialização de ícones & eventos ----------
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
$('#sd-pencil-ico').innerHTML =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20l4.2-1.1L19 8.1 15.9 5 5.1 15.8 4 20z" fill="#e5482f" stroke="#14202b" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 7.4l3.1 3.1" stroke="#f7b733" stroke-width="2"/></svg>';

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
    if (state.phase === 'won') {
      loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    } else {
      loadLevel(state.levelId);
    }
  } else if (act === 'hint') {
    sfx.click();
    state.showHint = !state.showHint;
    updateHUD();
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
    sfx.click();
    state.showHint = !state.showHint;
    updateHUD();
  } else if ((e.key === 'Enter' || e.key === ' ') && (state.phase === 'won' || state.phase === 'lost')) {
    e.preventDefault();
    sfx.click();
    if (state.phase === 'won') loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    else loadLevel(state.levelId);
  } else if (e.key === 'ArrowLeft' && state.levelId > 1) {
    e.preventDefault();
    sfx.click();
    loadLevel(state.levelId - 1);
  } else if (e.key === 'ArrowRight' && state.levelId < LEVELS.length) {
    e.preventDefault();
    sfx.click();
    loadLevel(state.levelId + 1);
  }
});

loadLevel(state.levelId);
startLoop();
