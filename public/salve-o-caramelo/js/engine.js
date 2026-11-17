// Motor físico 2D (corpos rígidos, cápsulas, colmeias e abelhas) + 40 fases para Salve o Caramelo.

export const ARENA_W = 360;
export const ARENA_H = 540;
export const WALL_T = 14;
export const STROKE_RADIUS = 5.5;
export const MIN_STROKE_LEN = 12;
export const MAX_SEG_LEN = 8;
export const SURVIVE_TIME = 6.0;
export const GRAVITY = 680;
export const DOGE_RADIUS = 22;
export const BEE_RADIUS = 7.5;

export const CHAPTERS = [
  { id: 1, name: 'Capítulo 1 · Primeiro Enxame', from: 1, to: 10 },
  { id: 2, name: 'Capítulo 2 · Pinos & Abismos', from: 11, to: 20 },
  { id: 3, name: 'Capítulo 3 · Duplas & Pedras', from: 21, to: 30 },
  { id: 4, name: 'Capítulo 4 · Mestre da Quermesse', from: 31, to: 40 },
];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const BOX_HIT_BUF = { nx: 0, ny: 0, pen: 0, cx: 0, cy: 0 };
const SEG_CP_BUF = { x: 0, y: 0, t: 0 };

function pointVsBoxInto(px, py, r, b, out) {
  const ang = b.angle || 0;
  const hw = b.w * 0.5;
  const hh = b.h * 0.5;
  const cx = b.x + hw;
  const cy = b.y + hh;

  if (ang === 0) {
    if (px + r <= b.x || px - r >= b.x + b.w || py + r <= b.y || py - r >= b.y + b.h) {
      return false;
    }
    const lx = px - cx;
    const ly = py - cy;
    const qx = clamp(lx, -hw, hw);
    const qy = clamp(ly, -hh, hh);
    const rx = lx - qx;
    const ry = ly - qy;

    if (rx === 0 && ry === 0) {
      const penX = hw - Math.abs(lx);
      const penY = hh - Math.abs(ly);
      if (penX < penY) {
        out.nx = lx >= 0 ? 1 : -1;
        out.ny = 0;
        out.pen = penX + r;
      } else {
        out.nx = 0;
        out.ny = ly >= 0 ? 1 : -1;
        out.pen = penY + r;
      }
    } else {
      const d2 = rx * rx + ry * ry;
      if (d2 >= r * r) return false;
      const d = Math.sqrt(d2);
      out.nx = rx / d;
      out.ny = ry / d;
      out.pen = r - d;
    }
    out.cx = cx + qx;
    out.cy = cy + qy;
    return true;
  }

  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const dx = px - cx;
  const dy = py - cy;
  const lx = dx * ca + dy * sa;
  const ly = -dx * sa + dy * ca;
  const qx = clamp(lx, -hw, hw);
  const qy = clamp(ly, -hh, hh);
  const rx = lx - qx;
  const ry = ly - qy;

  let nlx = 0;
  let nly = 0;
  let pen = 0;

  if (rx === 0 && ry === 0) {
    const penX = hw - Math.abs(lx);
    const penY = hh - Math.abs(ly);
    if (penX < penY) {
      nlx = lx >= 0 ? 1 : -1;
      pen = penX + r;
    } else {
      nly = ly >= 0 ? 1 : -1;
      pen = penY + r;
    }
  } else {
    const d2 = rx * rx + ry * ry;
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2);
    nlx = rx / d;
    nly = ry / d;
    pen = r - d;
  }

  out.nx = nlx * ca - nly * sa;
  out.ny = nlx * sa + nly * ca;
  out.pen = pen;
  out.cx = cx + qx * ca - qy * sa;
  out.cy = cy + qx * sa + qy * ca;
  return true;
}

export function pointVsBox(px, py, r, b) {
  if (!pointVsBoxInto(px, py, r, b, BOX_HIT_BUF)) return null;
  return { ...BOX_HIT_BUF };
}

function closestPointOnSegInto(px, py, ax, ay, bx, by, out) {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 <= 1e-8) {
    out.x = ax;
    out.y = ay;
    out.t = 0;
    return out;
  }
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  out.x = ax + abx * t;
  out.y = ay + aby * t;
  out.t = t;
  return out;
}

export function closestPointOnSeg(px, py, ax, ay, bx, by) {
  closestPointOnSegInto(px, py, ax, ay, bx, by, SEG_CP_BUF);
  return { ...SEG_CP_BUF };
}

function pointVsHazard(px, py, r, hz) {
  const pad = hz.type === 'spikes' ? -2 : -3;
  const hr = Math.max(4, r + pad);
  if (px + hr <= hz.x || px - hr >= hz.x + hz.w) return false;
  if (py + hr <= hz.y || py - hr >= hz.y + hz.h) return false;
  return true;
}

export function starThresholds(level) {
  const inkMax = level.inkMax || 480;
  return {
    inkMax,
    ink3: level.ink3 ?? Math.round(inkMax * 0.34),
    ink2: level.ink2 ?? Math.round(inkMax * 0.67),
  };
}

export function computeStars(inkUsed, level) {
  const { ink3, ink2 } = starThresholds(level);
  if (inkUsed <= ink3) return 3;
  if (inkUsed <= ink2) return 2;
  return 1;
}

export function isPointBlocked(x, y, level, margin = STROKE_RADIUS) {
  if (
    x < WALL_T + margin + 0.5 ||
    x > ARENA_W - WALL_T - margin - 0.5 ||
    y < WALL_T + margin + 0.5 ||
    y > ARENA_H - margin - 0.5
  ) {
    return true;
  }
  for (const d of level.doges) {
    const dr = (d.r || DOGE_RADIUS) + margin + 2;
    if ((x - d.x) ** 2 + (y - d.y) ** 2 < dr * dr) return true;
  }
  for (const p of level.pins || []) {
    const pr = p.r + margin + 1.5;
    if ((x - p.x) ** 2 + (y - p.y) ** 2 < pr * pr) return true;
  }
  for (const h of level.hives) {
    const hr = (h.r || 24) + margin + 1.5;
    if ((x - h.x) ** 2 + (y - h.y) ** 2 < hr * hr) return true;
  }
  for (const b of level.boulders || []) {
    const br = b.r + margin + 1.5;
    if ((x - b.x) ** 2 + (y - b.y) ** 2 < br * br) return true;
  }
  for (const bx of level.boxes || []) {
    if (pointVsBox(x, y, margin + 1, bx)) return true;
  }
  return false;
}

function nudgePointOut(x, y, level) {
  let nx = clamp(x, WALL_T + STROKE_RADIUS + 0.8, ARENA_W - WALL_T - STROKE_RADIUS - 0.8);
  let ny = clamp(y, WALL_T + STROKE_RADIUS + 0.8, ARENA_H - STROKE_RADIUS - 0.8);
  if (!isPointBlocked(nx, ny, level)) return { x: nx, y: ny };

  // Desliza suavemente para fora de pisos/caixas (até 26px) e círculos (Doge / pino)
  for (const bx of level.boxes || []) {
    const hit = pointVsBox(nx, ny, STROKE_RADIUS + 1.2, bx);
    if (hit && hit.pen <= 26) {
      const cx = nx + hit.nx * (hit.pen + 0.5);
      const cy = ny + hit.ny * (hit.pen + 0.5);
      if (!isPointBlocked(cx, cy, level)) return { x: cx, y: cy };
    }
  }
  const circles = [
    ...level.doges.map((d) => ({ x: d.x, y: d.y, r: (d.r || DOGE_RADIUS) + STROKE_RADIUS + 2.5 })),
    ...(level.pins || []).map((p) => ({ x: p.x, y: p.y, r: p.r + STROKE_RADIUS + 2 })),
  ];
  for (const c of circles) {
    const cdx = nx - c.x;
    const cdy = ny - c.y;
    const cd = Math.hypot(cdx, cdy);
    if (cd > 0.1 && cd < c.r) {
      const cx = c.x + (cdx / cd) * (c.r + 0.6);
      const cy = c.y + (cdy / cd) * (c.r + 0.6);
      if (!isPointBlocked(cx, cy, level)) return { x: cx, y: cy };
    }
  }
  return null;
}

/**
 * Converte uma sequência de pontos brutos numa polilinha segmentada válida (<= inkMax).
 */
export function buildStroke(rawPoints, level) {
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) {
    return { points: [], length: 0 };
  }
  const { inkMax } = starThresholds(level);
  const pts = [];
  let totalLen = 0;

  // Encontra primeiro ponto válido (projetando para fora da borda se começar raspando no chão/Doge)
  let startIdx = -1;
  for (let i = 0; i < rawPoints.length; i++) {
    const [rx, ry] = Array.isArray(rawPoints[i]) ? rawPoints[i] : [rawPoints[i].x, rawPoints[i].y];
    const valid = !isPointBlocked(rx, ry, level) ? { x: rx, y: ry } : nudgePointOut(rx, ry, level);
    if (valid) {
      pts.push(valid);
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return { points: [], length: 0 };

  for (let i = startIdx + 1; i < rawPoints.length; i++) {
    const [tx, ty] = Array.isArray(rawPoints[i]) ? rawPoints[i] : [rawPoints[i].x, rawPoints[i].y];
    const prev = pts[pts.length - 1];
    const dx = tx - prev.x;
    const dy = ty - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) continue;

    const steps = Math.max(1, Math.ceil(dist / MAX_SEG_LEN));
    const stepDx = dx / steps;
    const stepDy = dy / steps;

    for (let s = 1; s <= steps; s++) {
      const cur = pts[pts.length - 1];
      let nx = cur.x + stepDx;
      let ny = cur.y + stepDy;
      const segLen = Math.hypot(nx - cur.x, ny - cur.y);
      if (totalLen + segLen > inkMax) {
        const rem = inkMax - totalLen;
        if (rem > 1.5) {
          const ratio = rem / segLen;
          const fx = cur.x + (nx - cur.x) * ratio;
          const fy = cur.y + (ny - cur.y) * ratio;
          if (!isPointBlocked(fx, fy, level)) {
            pts.push({ x: fx, y: fy });
            totalLen = inkMax;
          }
        }
        return { points: pts, length: totalLen };
      }

      if (isPointBlocked(nx, ny, level)) {
        const nudged = nudgePointOut(nx, ny, level);
        if (!nudged || Math.hypot(nudged.x - cur.x, nudged.y - cur.y) > MAX_SEG_LEN * 3) continue;
        nx = nudged.x;
        ny = nudged.y;
      }

      const addLen = Math.hypot(nx - cur.x, ny - cur.y);
      if (addLen < 1.5) continue;
      if (totalLen + addLen > inkMax) break;
      pts.push({ x: nx, y: ny });
      totalLen += addLen;
    }
  }

  return { points: pts, length: totalLen };
}

function createRigidStroke(points) {
  if (!points || points.length < 2) return null;
  let totalLen = 0;
  let sumX = 0;
  let sumY = 0;
  const segMeta = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.5) continue;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    segMeta.push({ i0: i, i1: i + 1, len, mx, my });
    totalLen += len;
    sumX += mx * len;
    sumY += my * len;
  }
  if (totalLen < MIN_STROKE_LEN * 0.5 || segMeta.length === 0) return null;

  const cx = sumX / totalLen;
  const cy = sumY / totalLen;
  const mass = clamp(totalLen * 0.025, 1.35, 8.5);

  let inertia = 0;
  for (const s of segMeta) {
    const sm = mass * (s.len / totalLen);
    const dx = s.mx - cx;
    const dy = s.my - cy;
    inertia += sm * ((s.len * s.len) / 12 + dx * dx + dy * dy);
  }
  inertia = Math.max(inertia, mass * 220);

  const localPts = points.map((p) => ({ lx: p.x - cx, ly: p.y - cy }));
  const worldPts = points.map((p) => ({ x: p.x, y: p.y }));

  return {
    cx,
    cy,
    vx: 0,
    vy: 0,
    angle: 0,
    angVel: 0,
    mass,
    invMass: 1 / mass,
    inertia,
    invInertia: 1 / inertia,
    length: totalLen,
    localPts,
    worldPts,
    segs: segMeta.map((s) => ({ i0: s.i0, i1: s.i1 })),
  };
}

function syncStrokeWorld(body) {
  if (!body) return;
  const ca = Math.cos(body.angle);
  const sa = Math.sin(body.angle);
  for (let i = 0; i < body.localPts.length; i++) {
    const lp = body.localPts[i];
    body.worldPts[i].x = body.cx + lp.lx * ca - lp.ly * sa;
    body.worldPts[i].y = body.cy + lp.lx * sa + lp.ly * ca;
  }
}

export function createSim(level, strokePoints) {
  const built = buildStroke(strokePoints, level);
  const strokeBody = built.length >= MIN_STROKE_LEN ? createRigidStroke(built.points) : null;

  const doges = level.doges.map((d, i) => ({
    id: i,
    x: d.x,
    y: d.y,
    cx: d.x,
    cy: d.y,
    vx: 0,
    vy: 0,
    angle: 0,
    angVel: 0,
    r: d.r || DOGE_RADIUS,
    mass: 1.5,
    invMass: 1 / 1.5,
    invInertia: 1 / (0.5 * 1.5 * 22 * 22),
    mood: 'scared',
  }));

  const boulders = (level.boulders || []).map((b, i) => {
    const mass = b.mass || (b.r * b.r) / 220;
    return {
      id: i,
      x: b.x,
      y: b.y,
      cx: b.x,
      cy: b.y,
      vx: b.vx || 0,
      vy: b.vy || 0,
      angle: 0,
      angVel: 0,
      r: b.r,
      hazard: !!b.hazard,
      mass,
      invMass: 1 / mass,
      invInertia: 1 / (0.5 * mass * b.r * b.r),
    };
  });

  const hives = level.hives.map((h, i) => {
    const total = h.count ?? 6;
    const heavy = h.heavy ?? (level.id >= 3 && total >= 5 ? 1 : 0);
    return {
      id: i,
      x: h.x,
      y: h.y,
      r: h.r || 24,
      total,
      heavy: Math.min(total, heavy),
      spawned: 0,
      speed: h.speed || 235,
      nextSpawnAt: 0.05 + i * 0.07,
      interval: h.interval || 0.14,
      shake: 0,
    };
  });

  return {
    level,
    inkUsed: built.length,
    stars: computeStars(built.length, level),
    stroke: strokeBody,
    doges,
    boulders,
    circles: [...doges, ...boulders],
    hives,
    bees: [],
    hitEvents: [],
    spawnEvents: [],
    elapsed: 0,
    status: 'running', // 'running' | 'won' | 'lost'
    failReason: null,
    failPos: null,
    rng: (level.id * 2654435761 + 1013904223) >>> 0,
  };
}

function nextRand(sim) {
  let x = sim.rng || 123456789;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  sim.rng = x >>> 0;
  return (sim.rng & 0xffffff) / 0x1000000;
}

function resolveRigidDynamicContact(bodyA, bodyB, px, py, nx, ny, pen, restitution, friction) {
  // Normal aponta de A -> B
  const invMA = bodyA ? bodyA.invMass : 0;
  const invIA = bodyA ? bodyA.invInertia : 0;
  const invMB = bodyB ? bodyB.invMass : 0;
  const invIB = bodyB ? bodyB.invInertia : 0;
  const totalInvM = invMA + invMB;
  if (totalInvM <= 0) return;

  const rAx = bodyA ? px - bodyA.cx : 0;
  const rAy = bodyA ? py - bodyA.cy : 0;
  const rBx = bodyB ? px - bodyB.cx : 0;
  const rBy = bodyB ? py - bodyB.cy : 0;

  const vAx = bodyA ? bodyA.vx - bodyA.angVel * rAy : 0;
  const vAy = bodyA ? bodyA.vy + bodyA.angVel * rAx : 0;
  const vBx = bodyB ? bodyB.vx - bodyB.angVel * rBy : 0;
  const vBy = bodyB ? bodyB.vy + bodyB.angVel * rBx : 0;

  const rvx = vBx - vAx;
  const rvy = vBy - vAy;
  const vn = rvx * nx + rvy * ny;

  // Correção posicional gentil (Baumgarte explícito por slop)
  const slop = 0.2;
  const penCorr = Math.max(0, pen - slop) * 0.42;
  if (penCorr > 0) {
    const corrPerInvM = penCorr / totalInvM;
    if (bodyA) {
      bodyA.cx -= nx * corrPerInvM * invMA;
      bodyA.cy -= ny * corrPerInvM * invMA;
    }
    if (bodyB) {
      bodyB.cx += nx * corrPerInvM * invMB;
      bodyB.cy += ny * corrPerInvM * invMB;
    }
  }

  if (vn > 0) return;

  const rACrossN = rAx * ny - rAy * nx;
  const rBCrossN = rBx * ny - rBy * nx;
  const kNormal = invMA + invMB + rACrossN * rACrossN * invIA + rBCrossN * rBCrossN * invIB;
  if (kNormal <= 1e-8) return;

  const e = -vn > 45 ? restitution : 0;
  const j = (-(1 + e) * vn) / kNormal;
  const impX = j * nx;
  const impY = j * ny;

  if (bodyA) {
    bodyA.vx -= impX * invMA;
    bodyA.vy -= impY * invMA;
    bodyA.angVel -= rACrossN * j * invIA;
  }
  if (bodyB) {
    bodyB.vx += impX * invMB;
    bodyB.vy += impY * invMB;
    bodyB.angVel += rBCrossN * j * invIB;
  }

  // Atrito tangencial de Coulomb
  if (friction > 0) {
    const vAx2 = bodyA ? bodyA.vx - bodyA.angVel * rAy : 0;
    const vAy2 = bodyA ? bodyA.vy + bodyA.angVel * rAx : 0;
    const vBx2 = bodyB ? bodyB.vx - bodyB.angVel * rBy : 0;
    const vBy2 = bodyB ? bodyB.vy + bodyB.angVel * rBx : 0;
    const rvx2 = vBx2 - vAx2;
    const rvy2 = vBy2 - vAy2;
    const tx = -ny;
    const ty = nx;
    const vt = rvx2 * tx + rvy2 * ty;
    const rACrossT = rAx * ty - rAy * tx;
    const rBCrossT = rBx * ty - rBy * tx;
    const kTan = invMA + invMB + rACrossT * rACrossT * invIA + rBCrossT * rBCrossT * invIB;
    if (kTan > 1e-8) {
      const jt = clamp(-vt / kTan, -friction * j, friction * j);
      const tfx = jt * tx;
      const tfy = jt * ty;
      if (bodyA) {
        bodyA.vx -= tfx * invMA;
        bodyA.vy -= tfy * invMA;
        bodyA.angVel -= rACrossT * jt * invIA;
      }
      if (bodyB) {
        bodyB.vx += tfx * invMB;
        bodyB.vy += tfy * invMB;
        bodyB.angVel += rBCrossT * jt * invIB;
      }
    }
  }
}

function collectContacts(sim) {
  const { level, stroke, doges, circles } = sim;
  const boxes = level.boxes || [];
  const pins = level.pins || [];

  // 1) Linha desenhada contra obstáculos estáticos
  if (stroke) {
    syncStrokeWorld(stroke);
    const pts = stroke.worldPts;
    const len = pts.length;
    const step = len > 45 ? 2 : 1;

    // Pontos vs paredes e caixas (inclui primeiro e último garantidos)
    for (let i = 0; i < len; i += i === len - 1 ? 1 : step) {
      const idx = i >= len ? len - 1 : i;
      const p = pts[idx];
      if (p.x - STROKE_RADIUS < WALL_T) {
        resolveRigidDynamicContact(null, stroke, WALL_T, p.y, 1, 0, WALL_T - (p.x - STROKE_RADIUS), 0.1, 0.45);
      } else if (p.x + STROKE_RADIUS > ARENA_W - WALL_T) {
        resolveRigidDynamicContact(null, stroke, ARENA_W - WALL_T, p.y, -1, 0, p.x + STROKE_RADIUS - (ARENA_W - WALL_T), 0.1, 0.45);
      }
      if (p.y - STROKE_RADIUS < WALL_T) {
        resolveRigidDynamicContact(null, stroke, p.x, WALL_T, 0, 1, WALL_T - (p.y - STROKE_RADIUS), 0.1, 0.45);
      } else if (p.y + STROKE_RADIUS > ARENA_H) {
        resolveRigidDynamicContact(null, stroke, p.x, ARENA_H, 0, -1, p.y + STROKE_RADIUS - ARENA_H, 0.05, 0.52);
      }

      for (let bi = 0; bi < boxes.length; bi++) {
        if (pointVsBoxInto(p.x, p.y, STROKE_RADIUS, boxes[bi], BOX_HIT_BUF)) {
          resolveRigidDynamicContact(null, stroke, BOX_HIT_BUF.cx, BOX_HIT_BUF.cy, BOX_HIT_BUF.nx, BOX_HIT_BUF.ny, BOX_HIT_BUF.pen, 0.08, 0.58);
        }
      }
    }

    // Segmentos exatos contra pinos circulares
    for (let pi = 0; pi < pins.length; pi++) {
      const pin = pins[pi];
      const minD = pin.r + STROKE_RADIUS;
      const minD2 = minD * minD;
      for (let si = 0; si < stroke.segs.length; si++) {
        const s = stroke.segs[si];
        const a = pts[s.i0];
        const b = pts[s.i1];
        const cp = closestPointOnSegInto(pin.x, pin.y, a.x, a.y, b.x, b.y, SEG_CP_BUF);
        const dx = cp.x - pin.x;
        const dy = cp.y - pin.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) {
          const d = Math.sqrt(d2) || 0.001;
          resolveRigidDynamicContact(
            null,
            stroke,
            pin.x + (dx / d) * pin.r,
            pin.y + (dy / d) * pin.r,
            dx / d,
            dy / d,
            minD - d,
            0.12,
            0.46
          );
        }
      }
    }

    syncStrokeWorld(stroke);
  }

  // 2) Círculos dinâmicos (Caramelos e Pedras) contra mundo, pinos, linha e entre si
  for (let ci = 0; ci < circles.length; ci++) {
    const c = circles[ci];
    if (c.cx - c.r < WALL_T) {
      resolveRigidDynamicContact(null, c, WALL_T, c.cy, 1, 0, WALL_T - (c.cx - c.r), 0.2, 0.45);
    } else if (c.cx + c.r > ARENA_W - WALL_T) {
      resolveRigidDynamicContact(null, c, ARENA_W - WALL_T, c.cy, -1, 0, c.cx + c.r - (ARENA_W - WALL_T), 0.2, 0.45);
    }
    if (c.cy - c.r < WALL_T) {
      resolveRigidDynamicContact(null, c, c.cx, WALL_T, 0, 1, WALL_T - (c.cy - c.r), 0.2, 0.4);
    }

    for (let bi = 0; bi < boxes.length; bi++) {
      if (pointVsBoxInto(c.cx, c.cy, c.r, boxes[bi], BOX_HIT_BUF)) {
        resolveRigidDynamicContact(null, c, BOX_HIT_BUF.cx, BOX_HIT_BUF.cy, BOX_HIT_BUF.nx, BOX_HIT_BUF.ny, BOX_HIT_BUF.pen, 0.12, 0.52);
      }
    }

    for (let pi = 0; pi < pins.length; pi++) {
      const pin = pins[pi];
      const dx = c.cx - pin.x;
      const dy = c.cy - pin.y;
      const minD = pin.r + c.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 0.001;
        resolveRigidDynamicContact(null, c, pin.x + (dx / d) * pin.r, pin.y + (dy / d) * pin.r, dx / d, dy / d, minD - d, 0.2, 0.4);
      }
    }

    if (stroke) {
      const pts = stroke.worldPts;
      const minD = c.r + STROKE_RADIUS;
      const minD2 = minD * minD;
      for (let si = 0; si < stroke.segs.length; si++) {
        const s = stroke.segs[si];
        const a = pts[s.i0];
        const b = pts[s.i1];
        const cp = closestPointOnSegInto(c.cx, c.cy, a.x, a.y, b.x, b.y, SEG_CP_BUF);
        const dx = c.cx - cp.x;
        const dy = c.cy - cp.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) {
          const d = Math.sqrt(d2) || 0.001;
          resolveRigidDynamicContact(stroke, c, cp.x, cp.y, dx / d, dy / d, minD - d, 0.14, 0.34);
        }
      }
      syncStrokeWorld(stroke);
    }
  }

  // 3) Pares de círculos dinâmicos entre si (bola com espinhos atravessa direto para causar dano)
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i];
    for (let j = i + 1; j < circles.length; j++) {
      const b = circles[j];
      if ((i < doges.length && b.hazard) || (j < doges.length && a.hazard)) continue;
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const minD = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        resolveRigidDynamicContact(a, b, a.cx + nx * a.r, a.cy + ny * a.r, nx, ny, minD - d, 0.25, 0.35);
      }
    }
  }
}

function triggerBeeFlank(bee, nx, ny, toDx, toDy) {
  // Só flanqueia quando o obstáculo realmente bloqueia o caminho em direção ao Caramelo
  const dot = nx * toDx + ny * toDy;
  if (dot < 0.25) {
    bee.wallNx = nx;
    bee.wallNy = ny;
    if (bee.flankTimer <= 0.04) {
      // Escolhe lado preferencial coerente ou alterna se ficou presa no mesmo canto
      bee.wallHits++;
      if (bee.wallHits % 3 === 0) bee.flankDir = -bee.flankDir;
    }
    bee.flankTimer = 0.48;
  }
}

function stepBeesSub(sim, dt) {
  const { level, stroke, doges, bees } = sim;

  for (let bi = 0; bi < bees.length; bi++) {
    const bee = bees[bi];
    if (bee.bounceCool > 0) bee.bounceCool = Math.max(0, bee.bounceCool - dt);
    if (bee.flankTimer > 0) bee.flankTimer = Math.max(0, bee.flankTimer - dt);
    if (bee.dashCool > 0) bee.dashCool = Math.max(0, bee.dashCool - dt);
    if (bee.windupTimer > 0) {
      bee.windupTimer = Math.max(0, bee.windupTimer - dt);
      if (bee.windupTimer === 0) {
        bee.dashTimer = 0.3;
      }
    } else if (bee.dashTimer > 0) {
      bee.dashTimer = Math.max(0, bee.dashTimer - dt);
    }

    // Procura Doge mais próximo
    let target = doges[0];
    let bestD2 = Infinity;
    for (const d of doges) {
      const dd2 = (d.x - bee.x) ** 2 + (d.y - bee.y) ** 2;
      if (dd2 < bestD2) {
        bestD2 = dd2;
        target = d;
      }
    }

    const toDx = target.x - bee.x;
    const toDy = target.y - bee.y;
    const dist = Math.hypot(toDx, toDy) || 1;
    const dirX = toDx / dist;
    const dirY = toDy / dist;

    // Inicia preparação de investida ("windup" -> "dash") perto do alvo
    if (bee.windupTimer === 0 && bee.dashTimer === 0 && bee.dashCool === 0 && dist < 195 && bee.flankTimer <= 0.05) {
      bee.windupTimer = bee.heavy ? 0.24 : 0.18;
      bee.dashCool = bee.heavy ? 1.25 : 1.7;
      bee.dashDirX = dirX;
      bee.dashDirY = dirY;
    }

    let desiredVx;
    let desiredVy;
    let steerRate = 9.2;

    if (bee.windupTimer > 0) {
      // Recua vibrando antes de dar o bote
      desiredVx = -dirX * bee.speed * 0.35;
      desiredVy = -dirY * bee.speed * 0.35;
      steerRate = 12;
    } else if (bee.dashTimer > 0) {
      const mul = bee.heavy ? 1.72 : 1.56;
      desiredVx = (bee.dashDirX * 0.72 + dirX * 0.28) * bee.speed * mul;
      desiredVy = (bee.dashDirY * 0.72 + dirY * 0.28) * bee.speed * mul;
      steerRate = 13;
    } else if (bee.flankTimer > 0) {
      // Desliza pela tangente do obstáculo contornando quinas para tentar entrar por brechas
      const tx = -bee.wallNy * bee.flankDir;
      const ty = bee.wallNx * bee.flankDir;
      const fx = tx * 0.86 + dirX * 0.32 - bee.wallNx * 0.22;
      const fy = ty * 0.86 + dirY * 0.32 - bee.wallNy * 0.22;
      const fn = Math.hypot(fx, fy) || 1;
      desiredVx = (fx / fn) * bee.speed * 1.12;
      desiredVy = (fy / fn) * bee.speed * 1.12;
      steerRate = 11;
    } else {
      const swoop = Math.sin(sim.elapsed * bee.wobbleFreq + bee.phase) * 0.44;
      const seekX = dirX - dirY * swoop;
      const seekY = dirY + dirX * swoop;
      const sNorm = Math.hypot(seekX, seekY) || 1;
      desiredVx = (seekX / sNorm) * bee.speed;
      desiredVy = (seekY / sNorm) * bee.speed;
      if (bee.bounceCool > 0) steerRate = 4.5;
    }

    bee.vx += (desiredVx - bee.vx) * Math.min(1, steerRate * dt);
    bee.vy += (desiredVy - bee.vy) * Math.min(1, steerRate * dt);

    // Separação entre abelhas para espalhar e testar múltiplos cantos do escudo
    for (let bj = bi + 1; bj < bees.length; bj++) {
      const other = bees[bj];
      const sdx = bee.x - other.x;
      const sdy = bee.y - other.y;
      const minSep = (bee.r + other.r) * 1.2;
      const sd2 = sdx * sdx + sdy * sdy;
      if (sd2 > 0.01 && sd2 < minSep * minSep) {
        const sd = Math.sqrt(sd2);
        const push = ((minSep - sd) / minSep) * 230 * dt;
        const px = (sdx / sd) * push;
        const py = (sdy / sd) * push;
        bee.vx += px;
        bee.vy += py;
        other.vx -= px;
        other.vy -= py;
      }
    }

    bee.x += bee.vx * dt;
    bee.y += bee.vy * dt;

    // Colisão com paredes da arena
    if (bee.x - bee.r < WALL_T) {
      bee.x = WALL_T + bee.r;
      bee.vx = Math.abs(bee.vx) * 0.72;
      bee.flankDir = 1;
    } else if (bee.x + bee.r > ARENA_W - WALL_T) {
      bee.x = ARENA_W - WALL_T - bee.r;
      bee.vx = -Math.abs(bee.vx) * 0.72;
      bee.flankDir = -1;
    }
    if (bee.y - bee.r < WALL_T) {
      bee.y = WALL_T + bee.r;
      bee.vy = Math.abs(bee.vy) * 0.72;
    } else if (bee.y + bee.r > ARENA_H - 6) {
      bee.y = ARENA_H - 6 - bee.r;
      bee.vy = -Math.abs(bee.vy) * 0.72;
    }

    // Colisão abelha vs obstáculos estáticos
    for (let bi2 = 0; bi2 < level.boxes.length; bi2++) {
      if (pointVsBoxInto(bee.x, bee.y, bee.r, level.boxes[bi2], BOX_HIT_BUF)) {
        bee.x += BOX_HIT_BUF.nx * BOX_HIT_BUF.pen;
        bee.y += BOX_HIT_BUF.ny * BOX_HIT_BUF.pen;
        const vn = bee.vx * BOX_HIT_BUF.nx + bee.vy * BOX_HIT_BUF.ny;
        if (vn < 0) {
          bee.vx -= 1.42 * vn * BOX_HIT_BUF.nx;
          bee.vy -= 1.42 * vn * BOX_HIT_BUF.ny;
          triggerBeeFlank(bee, BOX_HIT_BUF.nx, BOX_HIT_BUF.ny, dirX, dirY);
        }
      }
    }

    for (const pin of level.pins || []) {
      const dx = bee.x - pin.x;
      const dy = bee.y - pin.y;
      const minD = pin.r + bee.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d;
        const ny = dy / d;
        bee.x += nx * (minD - d);
        bee.y += ny * (minD - d);
        const vn = bee.vx * nx + bee.vy * ny;
        if (vn < 0) {
          bee.vx -= 1.45 * vn * nx;
          bee.vy -= 1.45 * vn * ny;
          triggerBeeFlank(bee, nx, ny, dirX, dirY);
        }
      }
    }

    // Colisão abelha vs linha desenhada (aplica impacto real + torque + efeito de faísca)
    if (stroke) {
      const pts = stroke.worldPts;
      const minD = bee.r + STROKE_RADIUS;
      const minD2 = minD * minD;
      for (let si = 0; si < stroke.segs.length; si++) {
        const s = stroke.segs[si];
        const a = pts[s.i0];
        const b = pts[s.i1];
        const cp = closestPointOnSegInto(bee.x, bee.y, a.x, a.y, b.x, b.y, SEG_CP_BUF);
        const dx = bee.x - cp.x;
        const dy = bee.y - cp.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minD2) {
          const d = Math.sqrt(d2) || 0.001;
          const nx = dx / d;
          const ny = dy / d;
          const pen = minD - d;
          bee.x += nx * pen;
          bee.y += ny * pen;

          const rAx = cp.x - stroke.cx;
          const rAy = cp.y - stroke.cy;
          const svx = stroke.vx - stroke.angVel * rAy;
          const svy = stroke.vy + stroke.angVel * rAx;
          const vn = (bee.vx - svx) * nx + (bee.vy - svy) * ny;
          if (vn < 0) {
            const invMBee = 1 / bee.mass;
            const rCrossN = rAx * ny - rAy * nx;
            const denom = invMBee + stroke.invMass + rCrossN * rCrossN * stroke.invInertia;
            const j = (-(1 + 0.72) * vn) / denom;
            bee.vx += j * invMBee * nx;
            bee.vy += j * invMBee * ny;

            // Abelhas empurram com força proporcional ao zangão/dash para arrastar traços mal apoiados
            const pushScale = bee.heavy ? 1.48 : bee.dashTimer > 0 ? 1.32 : 1.05;
            stroke.vx -= j * stroke.invMass * nx * pushScale;
            stroke.vy -= j * stroke.invMass * ny * pushScale * 0.85;
            stroke.angVel -= rCrossN * j * stroke.invInertia * pushScale;
            bee.bounceCool = 0.14;
            bee.dashTimer = 0;
            triggerBeeFlank(bee, nx, ny, dirX, dirY);

            if (-vn > 85 && sim.hitEvents.length < 24) {
              sim.hitEvents.push({ x: cp.x, y: cp.y, nx, ny, heavy: bee.heavy });
            }
          }
        }
      }
    }
  }
}

function stepBees(sim, dt) {
  const { bees } = sim;

  // Spawn rápido em ondas pelas colmeias (operárias + zangão pesado no fim)
  for (const h of sim.hives) {
    if (h.shake > 0) h.shake = Math.max(0, h.shake - dt * 4);
    while (h.spawned < h.total && sim.elapsed >= h.nextSpawnAt) {
      const idx = h.spawned;
      h.spawned++;
      h.nextSpawnAt += h.interval;
      h.shake = 1;
      const isHeavy = idx >= h.total - h.heavy;
      const ang = (idx * 1.9 + h.id * 1.1) % (Math.PI * 2);
      const bee = {
        x: h.x + Math.cos(ang) * 9,
        y: h.y + Math.sin(ang) * 9,
        vx: Math.cos(ang) * 105,
        vy: Math.sin(ang) * 105,
        r: isHeavy ? BEE_RADIUS + 2 : BEE_RADIUS,
        mass: isHeavy ? 0.72 : 0.38,
        heavy: isHeavy,
        speed: isHeavy ? h.speed * 0.95 : h.speed,
        phase: nextRand(sim) * Math.PI * 2,
        wobbleFreq: 7.5 + nextRand(sim) * 4.5,
        bounceCool: 0,
        flankTimer: 0,
        flankDir: (idx + h.id) % 2 === 0 ? 1 : -1,
        wallNx: 0,
        wallNy: 0,
        wallHits: 0,
        windupTimer: 0,
        dashTimer: 0,
        dashCool: 0.5 + (idx % 3) * 0.4,
        dashDirX: 0,
        dashDirY: 1,
      };
      bees.push(bee);
      if (sim.spawnEvents.length < 16) sim.spawnEvents.push({ x: h.x, y: h.y, heavy: isHeavy });
    }
  }

  // 2 substeps evitam tunneling durante investidas ("dash")
  stepBeesSub(sim, dt * 0.5);
  stepBeesSub(sim, dt * 0.5);
}

export function stepSim(sim, dt = 1 / 60) {
  if (sim.status !== 'running') return sim;

  const subSteps = 4;
  const subDt = dt / subSteps;

  for (let step = 0; step < subSteps; step++) {
    // Gravidade e integração inicial
    if (sim.stroke) {
      const s = sim.stroke;
      s.vy += GRAVITY * subDt;
      s.vx = clamp(s.vx * 0.997, -1000, 1000);
      s.vy = clamp(s.vy * 0.997, -1000, 1000);
      s.angVel = clamp(s.angVel * 0.994, -10, 10);
      s.cx += s.vx * subDt;
      s.cy += s.vy * subDt;
      s.angle += s.angVel * subDt;
    }

    for (const d of sim.doges) {
      d.vy += GRAVITY * subDt;
      d.vx = clamp(d.vx * 0.996, -950, 950);
      d.vy = clamp(d.vy * 0.996, -950, 950);
      d.angVel = clamp(d.angVel * 0.99, -12, 12);
      d.cx += d.vx * subDt;
      d.cy += d.vy * subDt;
      d.angle += d.angVel * subDt;
    }

    for (const b of sim.boulders) {
      b.vy += GRAVITY * subDt;
      b.vx = clamp(b.vx * 0.998, -1000, 1000);
      b.vy = clamp(b.vy * 0.998, -1000, 1000);
      b.angVel = clamp(b.angVel * 0.995, -14, 14);
      b.cx += b.vx * subDt;
      b.cy += b.vy * subDt;
      b.angle += b.angVel * subDt;
    }

    // 3 iterações do resolvedor de contatos por substep para estabilidade de pontes e cúpulas
    for (let iter = 0; iter < 3; iter++) {
      collectContacts(sim);
    }

    // Amortecimento suave para repouso estável
    if (sim.stroke && Math.hypot(sim.stroke.vx, sim.stroke.vy) < 4 && Math.abs(sim.stroke.angVel) < 0.08) {
      sim.stroke.vx *= 0.85;
      sim.stroke.vy *= 0.85;
      sim.stroke.angVel *= 0.8;
    }
  }

  for (const d of sim.doges) {
    d.x = d.cx;
    d.y = d.cy;
  }
  for (const b of sim.boulders) {
    b.x = b.cx;
    b.y = b.cy;
  }

  sim.elapsed += dt;
  stepBees(sim, dt);

  // Checa derrota (abelha, lava, água, espinho, bola de espinhos ou queda)
  for (const d of sim.doges) {
    if (d.y > ARENA_H + 14) {
      sim.status = 'lost';
      sim.failReason = 'fell';
      sim.failPos = { x: d.x, y: ARENA_H - 16 };
      d.mood = 'stung';
      return sim;
    }

    for (const hz of sim.level.hazards || []) {
      if (pointVsHazard(d.x, d.y, d.r, hz)) {
        sim.status = 'lost';
        sim.failReason = hz.type;
        sim.failPos = { x: d.x, y: d.y };
        d.mood = hz.type;
        return sim;
      }
    }

    for (const b of sim.boulders) {
      if (!b.hazard) continue;
      const md = d.r + b.r - 2;
      if ((d.x - b.x) ** 2 + (d.y - b.y) ** 2 < md * md) {
        sim.status = 'lost';
        sim.failReason = 'crushed';
        sim.failPos = { x: d.x, y: d.y };
        d.mood = 'stung';
        return sim;
      }
    }

    for (const bee of sim.bees) {
      const md = d.r + bee.r - 2;
      if ((d.x - bee.x) ** 2 + (d.y - bee.y) ** 2 < md * md) {
        sim.status = 'lost';
        sim.failReason = 'stung';
        sim.failPos = { x: d.x, y: d.y };
        d.mood = 'stung';
        return sim;
      }
    }
  }

  if (sim.elapsed >= SURVIVE_TIME) {
    sim.status = 'won';
    for (const d of sim.doges) d.mood = 'cool';
  }

  return sim;
}

// =========================================================================
// 40 FASES FEITAS À MÃO (progressão em 4 capítulos)
// =========================================================================

const GROUND = (y = 424) => ({ x: 14, y, w: 332, h: ARENA_H - y, kind: 'ground' });

export const LEVELS = [
  // ---------- CAPÍTULO 1: PRIMEIRO ENXAME (1..10) ----------
  {
    id: 1,
    chapter: 1,
    title: 'Primeiro Enxame',
    subtitle: 'Desenhe um arco fechado protegendo o Caramelo.',
    tutorialRect: { x: 168, y: 348, w: 94, h: 76 },
    inkMax: 600,
    doges: [{ x: 215, y: 402 }],
    hives: [{ x: 96, y: 210, count: 7, speed: 225 }],
    boxes: [GROUND(424)],
    pins: [],
    hazards: [],
    hintStroke: [[172, 415], [172, 355], [258, 355], [258, 415]],
  },
  {
    id: 2,
    chapter: 1,
    title: 'Plataforma dos Espetos',
    subtitle: 'Feche até a base sem deixar brecha nem cair pros lados!',
    inkMax: 580,
    doges: [{ x: 180, y: 374 }],
    hives: [
      { x: 94, y: 125, count: 5, speed: 235 },
      { x: 266, y: 125, count: 5, speed: 235, heavy: 1 },
    ],
    boxes: [
      { x: 122, y: 396, w: 116, h: 144, kind: 'ground' },
      { x: 14, y: 468, w: 108, h: 72, kind: 'brick' },
      { x: 238, y: 468, w: 108, h: 72, kind: 'brick' },
    ],
    pins: [],
    hazards: [
      { type: 'spikes', x: 14, y: 448, w: 108, h: 20, dir: 'up' },
      { type: 'spikes', x: 238, y: 448, w: 108, h: 20, dir: 'up' },
    ],
    hintStroke: [[132, 388], [134, 326], [226, 326], [228, 388]],
  },
  {
    id: 3,
    chapter: 1,
    title: 'Cerco na Lava',
    subtitle: 'Duas colmeias baixas tentam levantar e empurrar seu escudo.',
    inkMax: 600,
    doges: [{ x: 180, y: 368 }],
    hives: [
      { x: 70, y: 215, count: 6, speed: 240, heavy: 1 },
      { x: 290, y: 215, count: 6, speed: 240, heavy: 1 },
    ],
    boxes: [
      { x: 120, y: 390, w: 120, h: 150, kind: 'ground' },
      { x: 14, y: 472, w: 106, h: 68, kind: 'brick' },
      { x: 240, y: 472, w: 106, h: 68, kind: 'brick' },
    ],
    pins: [],
    hazards: [
      { type: 'lava', x: 14, y: 432, w: 106, h: 40 },
      { type: 'lava', x: 240, y: 432, w: 106, h: 40 },
    ],
    hintStroke: [[130, 382], [134, 320], [226, 320], [230, 382]],
  },
  {
    id: 4,
    chapter: 1,
    title: 'No Fundo do Poço',
    subtitle: 'Apoie a tampa nos dois muros para aguentar o zangão!',
    inkMax: 440,
    doges: [{ x: 180, y: 422 }],
    hives: [
      { x: 82, y: 145, count: 6, speed: 240, heavy: 1 },
      { x: 278, y: 145, count: 6, speed: 240, heavy: 1 },
    ],
    boxes: [
      { x: 14, y: 444, w: 332, h: 96, kind: 'ground' },
      { x: 14, y: 318, w: 112, h: 126, kind: 'brick' },
      { x: 234, y: 318, w: 112, h: 126, kind: 'brick' },
    ],
    pins: [],
    hazards: [],
    hintStroke: [[112, 308], [248, 308]],
  },
  {
    id: 5,
    chapter: 1,
    title: 'Rampa dos Espinhos',
    subtitle: 'Trave o Caramelo na descida antes que role nos espetos!',
    inkMax: 560,
    doges: [{ x: 108, y: 242 }],
    hives: [
      { x: 272, y: 125, count: 6, speed: 240, heavy: 1 },
      { x: 288, y: 270, count: 4, speed: 235 },
    ],
    boxes: [
      { x: 50, y: 290, w: 174, h: 24, angle: 0.28, kind: 'brick' },
      { x: 220, y: 400, w: 126, h: 140, kind: 'brick' },
      { x: 14, y: 448, w: 206, h: 92, kind: 'ground' },
    ],
    pins: [{ x: 158, y: 266, r: 9 }],
    hazards: [{ type: 'spikes', x: 224, y: 382, w: 118, h: 18, dir: 'up' }],
    hintStroke: [[66, 254], [68, 192], [166, 206], [166, 250]],
  },
  {
    id: 6,
    chapter: 1,
    title: 'Vizinho Barulhento',
    subtitle: 'Espetos atrás e enxame baixo vindo da direita!',
    inkMax: 560,
    doges: [{ x: 112, y: 392 }],
    hives: [{ x: 284, y: 336, count: 9, speed: 248, heavy: 2 }],
    boxes: [
      { x: 64, y: 414, w: 282, h: 126, kind: 'ground' },
      { x: 14, y: 466, w: 50, h: 74, kind: 'brick' },
    ],
    pins: [],
    hazards: [{ type: 'spikes', x: 14, y: 446, w: 50, h: 20, dir: 'up' }],
    hintStroke: [[72, 406], [72, 342], [154, 342], [154, 406]],
  },
  {
    id: 7,
    chapter: 1,
    title: 'Ilha na Lava',
    subtitle: 'Ilha apertada entre tanques de lava borbulhante.',
    inkMax: 580,
    doges: [{ x: 180, y: 372 }],
    hives: [
      { x: 74, y: 145, count: 6, speed: 245, heavy: 1 },
      { x: 286, y: 245, count: 6, speed: 245, heavy: 1 },
    ],
    boxes: [
      { x: 134, y: 394, w: 92, h: 146, kind: 'ground' },
      { x: 14, y: 464, w: 120, h: 76, kind: 'brick' },
      { x: 226, y: 464, w: 120, h: 76, kind: 'brick' },
    ],
    pins: [],
    hazards: [
      { type: 'lava', x: 14, y: 424, w: 120, h: 40 },
      { type: 'lava', x: 226, y: 424, w: 120, h: 40 },
    ],
    hintStroke: [[140, 386], [140, 322], [220, 322], [220, 386]],
  },
  {
    id: 8,
    chapter: 1,
    title: 'Beira do Lago',
    subtitle: 'Ponte estreita e abelhas tentando derrubar você na água.',
    inkMax: 560,
    doges: [{ x: 180, y: 354 }],
    hives: [
      { x: 84, y: 124, count: 6, speed: 245, heavy: 1 },
      { x: 284, y: 270, count: 5, speed: 245 },
    ],
    boxes: [
      { x: 138, y: 376, w: 84, h: 164, kind: 'ground' },
      { x: 14, y: 466, w: 124, h: 74, kind: 'brick' },
      { x: 222, y: 466, w: 124, h: 74, kind: 'brick' },
    ],
    pins: [],
    hazards: [
      { type: 'water', x: 14, y: 416, w: 124, h: 50 },
      { type: 'water', x: 222, y: 416, w: 124, h: 50 },
    ],
    hintStroke: [[130, 404], [134, 306], [226, 306], [230, 404]],
  },
  {
    id: 9,
    chapter: 1,
    title: 'Plataforma Suspensa',
    subtitle: 'As abelhas contornam a prancha por baixo se houver fresta!',
    inkMax: 600,
    doges: [{ x: 180, y: 294 }],
    hives: [
      { x: 70, y: 150, count: 5, speed: 245 },
      { x: 290, y: 150, count: 5, speed: 245, heavy: 1 },
      { x: 78, y: 382, count: 4, speed: 245 },
    ],
    boxes: [
      { x: 124, y: 316, w: 112, h: 24, kind: 'ground' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [],
    hazards: [{ type: 'spikes', x: 14, y: 466, w: 332, h: 20, dir: 'up' }],
    hintStroke: [[132, 308], [134, 240], [226, 240], [228, 308]],
  },
  {
    id: 10,
    chapter: 1,
    title: 'Teto Furado',
    subtitle: 'Tampe a fresta antes do bote dos zangões!',
    inkMax: 480,
    doges: [{ x: 180, y: 402 }],
    hives: [
      { x: 96, y: 112, count: 6, speed: 245, heavy: 1 },
      { x: 264, y: 112, count: 6, speed: 245, heavy: 1 },
    ],
    boxes: [
      { x: 96, y: 424, w: 168, h: 116, kind: 'ground' },
      { x: 14, y: 466, w: 82, h: 74, kind: 'brick' },
      { x: 264, y: 466, w: 82, h: 74, kind: 'brick' },
      { x: 14, y: 245, w: 118, h: 28, kind: 'brick' },
      { x: 228, y: 245, w: 118, h: 28, kind: 'brick' },
    ],
    pins: [],
    hazards: [
      { type: 'spikes', x: 14, y: 446, w: 82, h: 20, dir: 'up' },
      { type: 'spikes', x: 264, y: 446, w: 82, h: 20, dir: 'up' },
    ],
    hintStroke: [[118, 236], [242, 236]],
  },

  // ---------- CAPÍTULO 2: PINOS & ABISMOS (11..20) ----------
  {
    id: 11,
    chapter: 2,
    title: 'O Primeiro Pino',
    subtitle: 'Enganche sua linha no pino flutuante!',
    inkMax: 580,
    doges: [{ x: 180, y: 372 }],
    hives: [
      { x: 78, y: 130, count: 5, speed: 225 },
      { x: 282, y: 130, count: 5, speed: 225 },
    ],
    boxes: [
      { x: 144, y: 394, w: 72, h: 146, kind: 'ground' },
      { x: 14, y: 476, w: 130, h: 64, kind: 'brick' },
      { x: 216, y: 476, w: 130, h: 64, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 294, r: 10 }],
    hazards: [
      { type: 'lava', x: 14, y: 438, w: 130, h: 38 },
      { type: 'lava', x: 216, y: 438, w: 130, h: 38 },
    ],
    hintStroke: [[148, 386], [148, 276], [212, 276], [212, 386]],
  },
  {
    id: 12,
    chapter: 2,
    title: 'Âncora na Beira',
    subtitle: 'Prenda no pino para resistir ao empurrão.',
    inkMax: 520,
    doges: [{ x: 112, y: 374 }],
    hives: [{ x: 266, y: 150, count: 8, speed: 235 }],
    boxes: [
      { x: 56, y: 396, w: 102, h: 144, kind: 'ground' },
      { x: 158, y: 472, w: 188, h: 68, kind: 'brick' },
    ],
    pins: [{ x: 88, y: 304, r: 10 }],
    hazards: [
      { type: 'water', x: 158, y: 422, w: 188, h: 50 },
      { type: 'spikes', x: 14, y: 454, w: 42, h: 18, dir: 'up' },
    ],
    hintStroke: [[64, 388], [64, 286], [148, 286], [148, 388]],
  },
  {
    id: 13,
    chapter: 2,
    title: 'Berço Suspenso',
    subtitle: 'Use os dois pinos para formar uma rede.',
    inkMax: 920,
    doges: [{ x: 180, y: 290 }],
    hives: [
      { x: 75, y: 120, count: 5, speed: 230 },
      { x: 285, y: 120, count: 5, speed: 230 },
    ],
    boxes: [
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [
      { x: 132, y: 320, r: 10 },
      { x: 228, y: 320, r: 10 },
    ],
    hazards: [
      { type: 'lava', x: 14, y: 446, w: 332, h: 40 },
    ],
    hintStroke: [[124, 342], [110, 304], [140, 240], [220, 240], [250, 304], [236, 342], [124, 342]],
  },
  {
    id: 14,
    chapter: 2,
    title: 'Lacrar a Origem',
    subtitle: 'Sem espaço perto do Caramelo? Isole a colmeia!',
    inkMax: 480,
    doges: [{ x: 256, y: 416 }],
    hives: [{ x: 96, y: 170, count: 8, speed: 235 }],
    boxes: [
      { x: 14, y: 438, w: 332, h: 102, kind: 'ground' },
      { x: 14, y: 242, w: 162, h: 24, kind: 'brick' },
    ],
    pins: [{ x: 96, y: 120, r: 9 }],
    hazards: [
      { type: 'spikes', x: 186, y: 420, w: 34, h: 18, dir: 'up' },
      { type: 'spikes', x: 294, y: 420, w: 46, h: 18, dir: 'up' },
    ],
    hintStroke: [[54, 234], [54, 134], [138, 134], [138, 234]],
  },
  {
    id: 15,
    chapter: 2,
    title: 'Descida Íngreme',
    subtitle: 'O Caramelo escorrega pela rampa rumo à lava.',
    inkMax: 520,
    doges: [{ x: 96, y: 230 }],
    hives: [{ x: 280, y: 115, count: 7, speed: 230 }],
    boxes: [
      { x: 40, y: 274, w: 180, h: 24, angle: 0.34, kind: 'brick' },
      { x: 14, y: 484, w: 332, h: 56, kind: 'brick' },
    ],
    pins: [{ x: 142, y: 246, r: 9 }],
    hazards: [{ type: 'lava', x: 14, y: 446, w: 332, h: 38 }],
    hintStroke: [[64, 240], [64, 180], [158, 198], [158, 250]],
  },
  {
    id: 16,
    chapter: 2,
    title: 'Empurrão por Baixo',
    subtitle: 'Abelhas tentam erguer seu escudo por baixo!',
    inkMax: 600,
    doges: [{ x: 180, y: 242 }],
    hives: [
      { x: 74, y: 370, count: 5, speed: 235 },
      { x: 286, y: 370, count: 5, speed: 235 },
    ],
    boxes: [
      { x: 128, y: 264, w: 104, h: 24, kind: 'ground' },
      { x: 14, y: 488, w: 332, h: 52, kind: 'brick' },
    ],
    pins: [
      { x: 128, y: 204, r: 9 },
      { x: 232, y: 204, r: 9 },
    ],
    hazards: [{ type: 'water', x: 14, y: 448, w: 332, h: 40 }],
    hintStroke: [[134, 256], [116, 186], [244, 186], [226, 256]],
  },
  {
    id: 17,
    chapter: 2,
    title: 'Piso de Pregos',
    subtitle: 'Paredes protegem se fechadas no topo e nos lados.',
    inkMax: 560,
    doges: [{ x: 180, y: 294 }],
    hives: [
      { x: 64, y: 125, count: 5, speed: 235 },
      { x: 296, y: 125, count: 5, speed: 235 },
    ],
    boxes: [
      { x: 132, y: 316, w: 96, h: 24, kind: 'ground' },
      { x: 14, y: 484, w: 332, h: 56, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 222, r: 9 }],
    hazards: [{ type: 'spikes', x: 14, y: 464, w: 332, h: 20, dir: 'up' }],
    hintStroke: [[138, 308], [138, 206], [222, 206], [222, 308]],
  },
  {
    id: 18,
    chapter: 2,
    title: 'Fogo Cruzado',
    subtitle: 'Enxames de cantos opostos sobre uma ponte fina.',
    inkMax: 600,
    doges: [{ x: 180, y: 280 }],
    hives: [
      { x: 66, y: 112, count: 5, speed: 235 },
      { x: 294, y: 382, count: 5, speed: 235 },
    ],
    boxes: [
      { x: 134, y: 302, w: 92, h: 22, kind: 'ground' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 208, r: 9 }],
    hazards: [{ type: 'lava', x: 14, y: 446, w: 332, h: 40 }],
    hintStroke: [[140, 294], [140, 190], [220, 190], [220, 294]],
  },
  {
    id: 19,
    chapter: 2,
    title: 'Ilha Minúscula',
    subtitle: 'Apoie o arco no pino de cima, a ilha mal cabe você!',
    inkMax: 580,
    doges: [{ x: 180, y: 344 }],
    hives: [
      { x: 72, y: 180, count: 5, speed: 240 },
      { x: 288, y: 180, count: 5, speed: 240 },
    ],
    boxes: [
      { x: 152, y: 366, w: 56, h: 174, kind: 'ground' },
      { x: 14, y: 486, w: 138, h: 54, kind: 'brick' },
      { x: 208, y: 486, w: 138, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 266, r: 10 }],
    hazards: [
      { type: 'water', x: 14, y: 444, w: 138, h: 42 },
      { type: 'water', x: 208, y: 444, w: 138, h: 42 },
    ],
    hintStroke: [[146, 360], [146, 248], [214, 248], [214, 360], [156, 360]],
  },
  {
    id: 20,
    chapter: 2,
    title: 'Fortaleza do Pino',
    subtitle: 'Três colmeias, plataforma curta e lava abaixo.',
    inkMax: 620,
    doges: [{ x: 180, y: 326 }],
    hives: [
      { x: 64, y: 120, count: 4, speed: 235 },
      { x: 180, y: 92, count: 4, speed: 240 },
      { x: 296, y: 120, count: 4, speed: 235 },
    ],
    boxes: [
      { x: 134, y: 348, w: 92, h: 24, kind: 'ground' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [
      { x: 126, y: 274, r: 9 },
      { x: 234, y: 274, r: 9 },
    ],
    hazards: [{ type: 'lava', x: 14, y: 446, w: 332, h: 40 }],
    hintStroke: [[142, 340], [108, 260], [180, 242], [252, 260], [218, 340]],
  },

  // ---------- CAPÍTULO 3: DUPLAS & PEDRAS (21..30) ----------
  {
    id: 21,
    chapter: 3,
    title: 'Irmãos Caramelo',
    subtitle: 'Proteja os dois Caramelos com um traço único!',
    inkMax: 680,
    doges: [
      { x: 138, y: 402 },
      { x: 222, y: 402 },
    ],
    hives: [
      { x: 70, y: 145, count: 5, speed: 230 },
      { x: 290, y: 145, count: 5, speed: 230 },
    ],
    boxes: [GROUND(424)],
    pins: [],
    hazards: [],
    hintStroke: [[102, 415], [102, 352], [258, 352], [258, 415]],
  },
  {
    id: 22,
    chapter: 3,
    title: 'Ilhas Gêmeas',
    subtitle: 'Conecte e proteja as duas ilhas sobre a lava.',
    inkMax: 720,
    doges: [
      { x: 100, y: 374 },
      { x: 260, y: 374 },
    ],
    hives: [{ x: 180, y: 112, count: 8, speed: 235 }],
    boxes: [
      { x: 52, y: 396, w: 96, h: 144, kind: 'ground' },
      { x: 212, y: 396, w: 96, h: 144, kind: 'ground' },
      { x: 148, y: 482, w: 64, h: 58, kind: 'brick' },
      { x: 14, y: 482, w: 38, h: 58, kind: 'brick' },
      { x: 308, y: 482, w: 38, h: 58, kind: 'brick' },
    ],
    pins: [],
    hazards: [{ type: 'lava', x: 148, y: 444, w: 64, h: 38 }],
    hintStroke: [[60, 388], [60, 326], [300, 326], [300, 388]],
  },
  {
    id: 23,
    chapter: 3,
    title: 'Pedra Rolante',
    subtitle: 'Segure a bola com espinhos antes que esmague o Caramelo!',
    inkMax: 580,
    doges: [{ x: 256, y: 402 }],
    hives: [{ x: 284, y: 120, count: 6, speed: 230 }],
    boulders: [{ x: 76, y: 150, r: 22, vx: 95, hazard: true }],
    boxes: [
      GROUND(424),
      { x: 42, y: 204, w: 148, h: 22, angle: 0.34, kind: 'brick' },
    ],
    pins: [],
    hazards: [],
    hintStroke: [[212, 415], [212, 344], [300, 344], [300, 415]],
  },
  {
    id: 24,
    chapter: 3,
    title: 'Dois Andares',
    subtitle: 'Um no degrau alto, outro no chão — feche ambos em um traço.',
    inkMax: 720,
    doges: [
      { x: 108, y: 274 },
      { x: 256, y: 402 },
    ],
    hives: [
      { x: 266, y: 120, count: 6, speed: 245, heavy: 1 },
      { x: 300, y: 265, count: 5, speed: 245, heavy: 1 },
    ],
    boxes: [
      GROUND(424),
      { x: 14, y: 296, w: 170, h: 128, kind: 'brick' },
    ],
    pins: [],
    hazards: [],
    hintStroke: [[60, 288], [60, 224], [174, 224], [194, 348], [300, 348], [300, 415]],
  },
  {
    id: 25,
    chapter: 3,
    title: 'Emboscada no Beiral',
    subtitle: 'Cuidado: as abelhas vêm de baixo da plataforma!',
    inkMax: 600,
    doges: [{ x: 180, y: 248 }],
    hives: [
      { x: 88, y: 376, count: 5, speed: 240 },
      { x: 272, y: 376, count: 5, speed: 240 },
    ],
    boxes: [
      { x: 126, y: 270, w: 108, h: 24, kind: 'ground' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 182, r: 9 }],
    hazards: [{ type: 'water', x: 14, y: 444, w: 332, h: 42 }],
    hintStroke: [[134, 262], [134, 166], [226, 166], [226, 262]],
  },
  {
    id: 26,
    chapter: 3,
    title: 'Entre Fogo e Água',
    subtitle: 'Qualquer escorregão pros lados é fatal!',
    inkMax: 580,
    doges: [{ x: 180, y: 364 }],
    hives: [
      { x: 70, y: 140, count: 5, speed: 235 },
      { x: 290, y: 140, count: 5, speed: 235 },
    ],
    boxes: [
      { x: 136, y: 386, w: 88, h: 154, kind: 'ground' },
      { x: 14, y: 482, w: 122, h: 58, kind: 'brick' },
      { x: 224, y: 482, w: 122, h: 58, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 286, r: 9 }],
    hazards: [
      { type: 'lava', x: 14, y: 442, w: 122, h: 40 },
      { type: 'water', x: 224, y: 442, w: 122, h: 40 },
    ],
    hintStroke: [[142, 378], [142, 268], [218, 268], [218, 378]],
  },
  {
    id: 27,
    chapter: 3,
    title: 'Quatro Cantos',
    subtitle: 'Cerco completo em todas as direções.',
    inkMax: 640,
    doges: [{ x: 180, y: 280 }],
    hives: [
      { x: 66, y: 120, count: 3, speed: 230 },
      { x: 294, y: 120, count: 3, speed: 230 },
      { x: 66, y: 400, count: 3, speed: 230 },
      { x: 294, y: 400, count: 3, speed: 230 },
    ],
    boxes: [
      { x: 126, y: 302, w: 108, h: 26, kind: 'ground' },
      { x: 14, y: 492, w: 332, h: 48, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 210, r: 9 }],
    hazards: [{ type: 'spikes', x: 14, y: 472, w: 332, h: 20, dir: 'up' }],
    hintStroke: [[134, 294], [134, 194], [226, 194], [226, 294]],
  },
  {
    id: 28,
    chapter: 3,
    title: 'Meteoro de Espinhos',
    subtitle: 'Aguente a pancada da bola lá de cima!',
    inkMax: 600,
    doges: [{ x: 180, y: 402 }],
    hives: [{ x: 74, y: 185, count: 6, speed: 235 }],
    boulders: [{ x: 180, y: 92, r: 26, hazard: true }],
    boxes: [GROUND(424)],
    pins: [{ x: 126, y: 330, r: 9 }, { x: 234, y: 330, r: 9 }],
    hazards: [],
    hintStroke: [[112, 415], [112, 314], [248, 314], [248, 415]],
  },
  {
    id: 29,
    chapter: 3,
    title: 'O Corredor',
    subtitle: 'Economize tinta fechando só a passagem certa.',
    inkMax: 420,
    doges: [{ x: 274, y: 402 }],
    hives: [{ x: 118, y: 112, count: 8, speed: 245 }],
    boxes: [
      GROUND(424),
      { x: 148, y: 228, w: 26, h: 196, kind: 'brick' },
      { x: 246, y: 228, w: 100, h: 26, kind: 'brick' },
    ],
    pins: [],
    hazards: [],
    hintStroke: [[148, 218], [272, 218]],
  },
  {
    id: 30,
    chapter: 3,
    title: 'Casal na Corda Bamba',
    subtitle: 'Dois Caramelos e um único pino salvador.',
    inkMax: 720,
    doges: [
      { x: 132, y: 344 },
      { x: 228, y: 344 },
    ],
    hives: [
      { x: 64, y: 120, count: 5, speed: 240 },
      { x: 296, y: 120, count: 5, speed: 240 },
    ],
    boxes: [
      { x: 86, y: 366, w: 188, h: 26, kind: 'ground' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 266, r: 10 }],
    hazards: [{ type: 'water', x: 14, y: 446, w: 332, h: 40 }],
    hintStroke: [[94, 358], [94, 248], [266, 248], [266, 358]],
  },

  // ---------- CAPÍTULO 4: MESTRE DA QUERMESSE (31..40) ----------
  {
    id: 31,
    chapter: 4,
    title: 'Teto de Espinhos',
    subtitle: 'Se o escudo levantar demais, o teto machuca!',
    inkMax: 580,
    doges: [{ x: 180, y: 392 }],
    hives: [
      { x: 68, y: 286, count: 6, speed: 240 },
      { x: 292, y: 286, count: 6, speed: 240 },
    ],
    boxes: [
      GROUND(414),
      { x: 100, y: 256, w: 160, h: 22, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 318, r: 9 }],
    hazards: [{ type: 'spikes', x: 104, y: 278, w: 152, h: 18, dir: 'down' }],
    hintStroke: [[138, 406], [138, 336], [222, 336], [222, 406]],
  },
  {
    id: 32,
    chapter: 4,
    title: 'Avalanche Cruzada',
    subtitle: 'Bola pesada à esquerda, enxame à direita.',
    inkMax: 620,
    doges: [{ x: 180, y: 402 }],
    hives: [{ x: 294, y: 155, count: 7, speed: 245 }],
    boulders: [{ x: 42, y: 298, r: 23, vx: 42, hazard: true }],
    boxes: [
      GROUND(424),
      { x: 14, y: 344, w: 108, h: 22, angle: 0.22, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 318, r: 9 }],
    hazards: [],
    hintStroke: [[134, 415], [134, 300], [226, 300], [226, 415]],
  },
  {
    id: 33,
    chapter: 4,
    title: 'O Muro no Meio',
    subtitle: 'Salve os dois Caramelos separados por um paredão!',
    inkMax: 760,
    doges: [
      { x: 108, y: 402 },
      { x: 252, y: 402 },
    ],
    hives: [
      { x: 64, y: 115, count: 5, speed: 240 },
      { x: 296, y: 115, count: 5, speed: 240 },
    ],
    boxes: [
      GROUND(424),
      { x: 164, y: 314, w: 32, h: 110, kind: 'brick' },
    ],
    pins: [],
    hazards: [],
    hintStroke: [[68, 415], [68, 294], [292, 294], [292, 415]],
  },
  {
    id: 34,
    chapter: 4,
    title: 'Chuva de Espinhos',
    subtitle: 'Duas bolas perigosas caem juntas com o enxame!',
    inkMax: 680,
    doges: [{ x: 180, y: 402 }],
    hives: [{ x: 180, y: 160, count: 7, speed: 245 }],
    boulders: [
      { x: 144, y: 78, r: 20, hazard: true },
      { x: 216, y: 78, r: 20, hazard: true },
    ],
    boxes: [GROUND(424)],
    pins: [
      { x: 132, y: 322, r: 9 },
      { x: 228, y: 322, r: 9 },
    ],
    hazards: [],
    hintStroke: [[116, 415], [116, 304], [244, 304], [244, 415]],
  },
  {
    id: 35,
    chapter: 4,
    title: 'Enxame Econômico',
    subtitle: 'Tinta curta: engate no pino e feche até o chão!',
    inkMax: 380,
    doges: [{ x: 62, y: 402 }],
    hives: [
      { x: 274, y: 135, count: 7, speed: 255, heavy: 1 },
      { x: 290, y: 290, count: 6, speed: 255, heavy: 1 },
    ],
    boxes: [
      GROUND(424),
      { x: 14, y: 320, w: 104, h: 24, kind: 'brick' },
    ],
    pins: [{ x: 96, y: 298, r: 8 }],
    hazards: [],
    hintStroke: [[82, 312], [82, 282], [126, 282], [126, 415]],
  },
  {
    id: 36,
    chapter: 4,
    title: 'Vale Escorregadio',
    subtitle: 'Duas rampas apontam o Caramelo para os espinhos laterais!',
    inkMax: 600,
    doges: [{ x: 180, y: 304 }],
    hives: [{ x: 180, y: 108, count: 9, speed: 245 }],
    boxes: [
      { x: 74, y: 342, w: 110, h: 22, angle: -0.22, kind: 'brick' },
      { x: 176, y: 342, w: 110, h: 22, angle: 0.22, kind: 'brick' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 230, r: 9 }],
    hazards: [{ type: 'spikes', x: 14, y: 466, w: 332, h: 20, dir: 'up' }],
    hintStroke: [[138, 332], [138, 212], [222, 212], [222, 332]],
  },
  {
    id: 37,
    chapter: 4,
    title: 'Gêmeos na Rampa',
    subtitle: 'Ambos escorregam para lados opostos em direção à lava!',
    inkMax: 740,
    doges: [
      { x: 126, y: 280 },
      { x: 234, y: 280 },
    ],
    hives: [{ x: 180, y: 105, count: 9, speed: 245 }],
    boxes: [
      { x: 54, y: 322, w: 126, h: 22, angle: -0.24, kind: 'brick' },
      { x: 180, y: 322, w: 126, h: 22, angle: 0.24, kind: 'brick' },
      { x: 14, y: 486, w: 332, h: 54, kind: 'brick' },
    ],
    pins: [
      { x: 90, y: 274, r: 9 },
      { x: 270, y: 274, r: 9 },
    ],
    hazards: [{ type: 'lava', x: 14, y: 446, w: 332, h: 40 }],
    hintStroke: [[72, 304], [72, 224], [288, 224], [288, 304]],
  },
  {
    id: 38,
    chapter: 4,
    title: 'Caixa de Espinhos',
    subtitle: 'Espinhas em cima e embaixo exigem precisão cirúrgica.',
    inkMax: 560,
    doges: [{ x: 180, y: 334 }],
    hives: [
      { x: 64, y: 130, count: 6, speed: 245 },
      { x: 296, y: 130, count: 6, speed: 245 },
    ],
    boxes: [
      { x: 112, y: 356, w: 136, h: 24, kind: 'ground' },
      { x: 108, y: 214, w: 144, h: 22, kind: 'brick' },
      { x: 14, y: 488, w: 332, h: 52, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 272, r: 9 }],
    hazards: [
      { type: 'spikes', x: 112, y: 236, w: 136, h: 16, dir: 'down' },
      { type: 'spikes', x: 14, y: 468, w: 332, h: 20, dir: 'up' },
    ],
    hintStroke: [[134, 348], [134, 286], [226, 286], [226, 348]],
  },
  {
    id: 39,
    chapter: 4,
    title: 'Cerco Supremo',
    subtitle: 'Bola de espinhos + 3 colmeias + água ao redor!',
    inkMax: 680,
    doges: [{ x: 180, y: 364 }],
    hives: [
      { x: 66, y: 160, count: 4, speed: 245 },
      { x: 294, y: 160, count: 4, speed: 245 },
      { x: 180, y: 145, count: 5, speed: 250 },
    ],
    boulders: [{ x: 152, y: 74, r: 21, vx: 16, hazard: true }],
    boxes: [
      { x: 124, y: 386, w: 112, h: 154, kind: 'ground' },
      { x: 14, y: 482, w: 110, h: 58, kind: 'brick' },
      { x: 236, y: 482, w: 110, h: 58, kind: 'brick' },
    ],
    pins: [
      { x: 136, y: 278, r: 9 },
      { x: 224, y: 278, r: 9 },
    ],
    hazards: [
      { type: 'water', x: 14, y: 440, w: 110, h: 42 },
      { type: 'water', x: 236, y: 440, w: 110, h: 42 },
    ],
    hintStroke: [[126, 378], [126, 260], [234, 260], [234, 378]],
  },
  {
    id: 40,
    chapter: 4,
    title: 'Grande Final da Quermesse',
    subtitle: 'Dois Caramelos, lava no centro, 4 colmeias e pinos!',
    inkMax: 780,
    doges: [
      { x: 102, y: 364 },
      { x: 258, y: 364 },
    ],
    hives: [
      { x: 62, y: 112, count: 4, speed: 245 },
      { x: 298, y: 112, count: 4, speed: 245 },
      { x: 132, y: 196, count: 4, speed: 245 },
      { x: 228, y: 196, count: 4, speed: 245 },
    ],
    boxes: [
      { x: 54, y: 386, w: 94, h: 154, kind: 'ground' },
      { x: 212, y: 386, w: 94, h: 154, kind: 'ground' },
      { x: 148, y: 486, w: 64, h: 54, kind: 'brick' },
      { x: 14, y: 486, w: 40, h: 54, kind: 'brick' },
      { x: 306, y: 486, w: 40, h: 54, kind: 'brick' },
    ],
    pins: [{ x: 180, y: 280, r: 10 }],
    hazards: [
      { type: 'lava', x: 148, y: 442, w: 64, h: 44 },
      { type: 'spikes', x: 14, y: 468, w: 40, h: 18, dir: 'up' },
      { type: 'spikes', x: 306, y: 468, w: 40, h: 18, dir: 'up' },
    ],
    hintStroke: [[62, 378], [62, 260], [298, 260], [298, 378]],
  },
];

export function getLevel(idOrIndex) {
  const num = Number(idOrIndex);
  if (Number.isFinite(num) && num >= 1 && num <= LEVELS.length) {
    return LEVELS[num - 1];
  }
  return LEVELS[0];
}
