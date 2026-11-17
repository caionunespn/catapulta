// Motor de simulação 2.5D (~60s/run), combate contínuo na pista, escalonamento até milhões e 40 fases verificadas.

export const TRACK_HALF_W = 1.0;
export const PLAYER_MAX_X = 0.86;
export const PLAYER_LAT_SPEED = 2.75;

export const STYLES = {
  basico: { id: 'basico', name: 'Bonde Comum', tag: 'COMUM', body: '#f6e8c8', trim: '#7a8ea3', dark: '#546475' },
  junino: { id: 'junino', name: 'Traje Junino', tag: 'JUNINO', body: '#f7b733', trim: '#e5482f', dark: '#a85d12' },
  gala: { id: 'gala', name: 'Gala Dourada', tag: 'GALA', body: '#ffd75e', trim: '#e5482f', dark: '#9e6b14' },
  rock: { id: 'rock', name: 'Rock da Praça', tag: 'ROCK', body: '#273444', trim: '#e5482f', dark: '#111922' },
  neon: { id: 'neon', name: 'Neon Pop', tag: 'NEON', body: '#1fae96', trim: '#ff4fa3', dark: '#106b5b' },
};

export const CHAPTERS = [
  { id: 1, name: 'Capítulo 1 · Rua das Barracas', from: 1, to: 10 },
  { id: 2, name: 'Capítulo 2 · Noite Neon & Gala', from: 11, to: 20 },
  { id: 3, name: 'Capítulo 3 · Gincana dos Milhares', from: 21, to: 30 },
  { id: 4, name: 'Capítulo 4 · Coreto dos Milhões', from: 31, to: 40 },
];

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function fmtNum(n) {
  const neg = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  if (abs < 1000) return `${neg}${abs}`;
  if (abs < 1_000_000) {
    const k = abs >= 100_000 ? Math.round(abs / 1000) : +(abs / 1000).toFixed(1);
    return `${neg}${String(k).replace(/\.0$/, '')}k`;
  }
  const m = abs >= 100_000_000 ? Math.round(abs / 1_000_000) : +(abs / 1_000_000).toFixed(2);
  return `${neg}${String(m).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')}M`;
}

export function crowdRadius(count) {
  const n = Math.max(1, Math.min(45, count));
  return clamp(0.085 + Math.sqrt(n) * 0.025, 0.10, 0.24);
}

export function eventXAt(ev, t) {
  const base = ev.x || 0;
  if (!ev.moveAmp || !ev.moveSpeed) return base;
  return clamp(base + Math.sin(t * ev.moveSpeed + (ev.movePhase || 0)) * ev.moveAmp, -0.82, 0.82);
}

export function gateSnapshot(gate, t) {
  if (!gate) return null;
  if (gate.kind === 'charge') {
    const v = gate.chargeVal ?? gate.startVal ?? 0;
    return { kind: 'math', op: v >= 0 ? '+' : '-', val: Math.abs(v), isCharge: true, rawVal: v, positive: v >= 0 };
  }
  if (gate.kind === 'math' && gate.oscPeriod > 0) {
    const flip = Math.sin((t + (gate.oscPhase || 0)) * ((Math.PI * 2) / gate.oscPeriod)) >= 0;
    const op = flip ? gate.op : gate.oscOp;
    const val = flip ? gate.val : gate.oscVal;
    return { kind: 'math', op, val, positive: op === '+' || op === '×', oscillating: true };
  }
  if (gate.kind === 'style') {
    return { kind: 'style', style: gate.style, val: gate.val || 0, positive: true };
  }
  if (gate.kind === 'clean') {
    return { kind: 'clean', val: gate.val || 0, positive: true };
  }
  return {
    kind: 'math',
    op: gate.op,
    val: gate.val,
    positive: gate.op === '+' || gate.op === '×',
  };
}

export function applyGateEffect(run, gateSnap) {
  const prevCount = run.count;
  const prevStyle = run.style;
  if (gateSnap.kind === 'style') {
    run.style = gateSnap.style;
    run.count = clamp(run.count + (gateSnap.val || 0), 0, 99_999_999);
    return {
      good: gateSnap.style === run.level.targetStyle || (gateSnap.val > 0 && gateSnap.style !== run.level.avoidStyle),
      delta: run.count - prevCount,
      styleChanged: run.style !== prevStyle,
    };
  }
  if (gateSnap.kind === 'clean') {
    run.muddy = false;
    run.count = clamp(run.count + (gateSnap.val || 0), 0, 99_999_999);
    return { good: true, delta: run.count - prevCount, cleaned: true };
  }

  let next = run.count;
  if (gateSnap.op === '+') next = run.count + gateSnap.val;
  else if (gateSnap.op === '×') next = run.count * gateSnap.val;
  else if (gateSnap.op === '-') next = run.count - gateSnap.val;
  else if (gateSnap.op === '÷') next = Math.floor(run.count / Math.max(1, gateSnap.val));

  run.count = clamp(Math.round(next), 0, 99_999_999);
  return { good: run.count >= prevCount && run.count > 0, delta: run.count - prevCount };
}

export function styleMultiplier(level, style) {
  if (style === level.targetStyle) return 1.6;
  if (level.avoidStyle && style === level.avoidStyle) return 0.72;
  if (style === 'basico') return 1.0;
  return 1.08;
}

export function evaluatePower(run) {
  const lv = run.level;
  const sMult = styleMultiplier(lv, run.style);
  const cMult = run.muddy ? 0.78 : 1.0;
  const baseScore = Math.round(run.count * sMult * cMult);
  const totalPower = Math.max(0, baseScore + run.bonusPts);
  const won = run.count >= 1 && totalPower >= lv.rivalPower;
  const stars = !won ? 0 : totalPower >= lv.star3Power ? 3 : totalPower >= lv.star2Power ? 2 : 1;
  return {
    baseScore,
    bonusPts: run.bonusPts,
    totalPower,
    styleMult: sMult,
    cleanMult: cMult,
    won,
    stars,
  };
}

export function createRun(level) {
  const events = (level.events || [])
    .map((ev, idx) => ({
      ...ev,
      _idx: idx,
      triggered: false,
      hp: ev.hp ?? 0,
      maxHp: ev.maxHp ?? ev.hp ?? 0,
      chipAcc: 0,
      shotAccum: 0,
      left: ev.left ? { ...ev.left, chargeVal: ev.left.startVal ?? ev.left.val ?? 0, chargeAcc: 0, shotTicks: 0 } : undefined,
      right: ev.right ? { ...ev.right, chargeVal: ev.right.startVal ?? ev.right.val ?? 0, chargeAcc: 0, shotTicks: 0 } : undefined,
      gate: ev.gate ? { ...ev.gate, chargeVal: ev.gate.startVal ?? ev.gate.val ?? 0, chargeAcc: 0, shotTicks: 0 } : undefined,
    }))
    .sort((a, b) => a.z - b.z);

  return {
    level,
    t: 0,
    z: 0,
    x: 0,
    speed: level.speed,
    count: level.startCount,
    style: level.startStyle || 'basico',
    muddy: false,
    bonusPts: 0,
    events,
    nextEventIdx: 0,
    recentEvents: [],
    status: 'running', // 'running' | 'won' | 'lost'
    failReason: null,
    finalEval: null,
    activeTargetZ: null,
    activeTargetX: null,
  };
}

export function stepRun(run, dt, targetX = run.x) {
  if (run.status !== 'running') return run;
  const stepDt = clamp(dt, 0, 0.068);
  run.t += stepDt;
  run.activeTargetZ = null;
  run.activeTargetX = null;

  // Movimento lateral com empurrão de esteiras ativas
  let beltPush = 0;
  for (let i = 0; i < run.events.length; i++) {
    const ev = run.events[i];
    if (ev.type === 'belt' && run.z >= ev.zStart && run.z <= ev.zEnd) {
      beltPush += ev.pushX;
    }
  }

  const desired = clamp(targetX, -PLAYER_MAX_X, PLAYER_MAX_X);
  const dx = desired - run.x;
  const maxStep = PLAYER_LAT_SPEED * stepDt;
  if (Math.abs(dx) <= maxStep) run.x = desired;
  else run.x += Math.sign(dx) * maxStep;
  run.x = clamp(run.x + beltPush * stepDt, -PLAYER_MAX_X, PLAYER_MAX_X);

  const prevZ = run.z;
  run.z += run.speed * stepDt;

  // Tiro contínuo da tropa no alvo mais próximo à frente (charge gate, horda rival ou baú)
  const fireDps = Math.max(2, run.count * 0.24);
  const rCrowd = crowdRadius(run.count);
  for (let i = run.nextEventIdx; i < run.events.length; i++) {
    const ev = run.events[i];
    const relZ = ev.z - run.z;
    if (relZ > 24) break;
    if (ev.triggered || relZ <= 0.3) continue;

    if (ev.type === 'enemy' || ev.type === 'crate') {
      const ox = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.36;
      if (Math.abs(run.x - ox) <= hw + rCrowd * 0.72) {
        const dmg = fireDps * stepDt;
        ev.hp = Math.max(0, ev.hp - dmg);
        ev.chipAcc += dmg;
        run.activeTargetZ = ev.z;
        run.activeTargetX = ox;

        if (ev.hp <= 0) {
          ev.triggered = true;
          let bonus = 0;
          if (ev.type === 'enemy') {
            bonus = ev.rewardVal || 0;
            if (bonus > 0) run.count = clamp(run.count + bonus, 0, 99_999_999);
          } else if (ev.type === 'crate') {
            const rewardSnap = {
              kind: ev.rewardStyle ? 'style' : 'math',
              op: ev.rewardOp || '+',
              val: ev.rewardVal || 0,
              style: ev.rewardStyle,
            };
            applyGateEffect(run, rewardSnap);
            bonus = ev.rewardVal || 0;
          }
          if (run.recentEvents.length < 24) {
            run.recentEvents.push({
              type: 'break',
              kind: ev.type,
              x: ox,
              z: ev.z,
              rewardOp: ev.rewardOp,
              rewardVal: ev.rewardVal,
              rewardStyle: ev.rewardStyle,
              bonus,
            });
          }
        } else if (ev.chipAcc >= Math.max(2, ev.maxHp * 0.18)) {
          const shown = Math.round(ev.chipAcc);
          ev.chipAcc = 0;
          if (run.recentEvents.length < 24) {
            run.recentEvents.push({ type: 'chip', x: ox, z: ev.z, dmg: shown });
          }
        }
        break; // Atira apenas no obstáculo mais à frente na linha
      }
    } else if (ev.type === 'gatePair') {
      const splitX = ev.splitX ?? 0;
      const inLeft = run.x < splitX;
      const activeGate = inLeft ? ev.left : ev.right;
      if (activeGate && activeGate.kind === 'charge') {
        const stepRate = Math.max(1, (activeGate.rate || 15) * (1 + Math.log10(Math.max(1, run.count)) * 0.12));
        activeGate.chargeAcc += stepRate * stepDt;
        const unit = activeGate.stepUnit || 1;
        const gained = Math.floor(activeGate.chargeAcc / unit) * unit;
        const nextVal = Math.min(activeGate.maxVal ?? 16, (activeGate.startVal ?? 0) + gained);
        run.activeTargetZ = ev.z;
        run.activeTargetX = inLeft ? -0.5 : 0.5;
        if (nextVal !== activeGate.chargeVal) {
          activeGate.chargeVal = nextVal;
          activeGate.shotTicks++;
          if (run.recentEvents.length < 24) {
            run.recentEvents.push({ type: 'charge', x: run.activeTargetX, z: ev.z, val: nextVal });
          }
        }
        break;
      }
    } else if (ev.type === 'singleGate' && ev.gate?.kind === 'charge') {
      const gx = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.34;
      if (Math.abs(run.x - gx) <= hw + 0.16) {
        const stepRate = Math.max(1, (ev.gate.rate || 15) * (1 + Math.log10(Math.max(1, run.count)) * 0.12));
        ev.gate.chargeAcc += stepRate * stepDt;
        const unit = ev.gate.stepUnit || 1;
        const gained = Math.floor(ev.gate.chargeAcc / unit) * unit;
        const nextVal = Math.min(ev.gate.maxVal ?? 16, (ev.gate.startVal ?? 0) + gained);
        run.activeTargetZ = ev.z;
        run.activeTargetX = gx;
        if (nextVal !== ev.gate.chargeVal) {
          ev.gate.chargeVal = nextVal;
          ev.gate.shotTicks++;
          if (run.recentEvents.length < 24) {
            run.recentEvents.push({ type: 'charge', x: gx, z: ev.z, val: nextVal });
          }
        }
        break;
      }
    }
  }

  // Dispara eventos cruzados neste quadro
  while (run.nextEventIdx < run.events.length) {
    const ev = run.events[run.nextEventIdx];
    if (ev.z > run.z) break;
    run.nextEventIdx++;
    if (ev.triggered || ev.z < prevZ - 0.15) continue;
    ev.triggered = true;

    if (ev.type === 'gatePair') {
      const splitX = ev.splitX ?? 0;
      const side = run.x < splitX ? 'left' : 'right';
      const chosen = ev[side];
      if (chosen) {
        const snap = gateSnapshot(chosen, run.t);
        const eff = applyGateEffect(run, snap);
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({
            type: 'gate',
            good: eff.good,
            x: side === 'left' ? -0.5 : 0.5,
            z: ev.z,
            delta: eff.delta,
            styleChanged: eff.styleChanged,
            cleaned: eff.cleaned,
          });
        }
      }
    } else if (ev.type === 'singleGate') {
      const gx = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.34;
      const r = crowdRadius(run.count);
      if (Math.abs(run.x - gx) <= hw + r * 0.45) {
        const snap = gateSnapshot(ev.gate, run.t);
        const eff = applyGateEffect(run, snap);
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({
            type: 'gate',
            good: eff.good,
            x: gx,
            z: ev.z,
            delta: eff.delta,
            styleChanged: eff.styleChanged,
            cleaned: eff.cleaned,
          });
        }
      }
    } else if (ev.type === 'enemy') {
      const ox = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.38;
      const r = crowdRadius(run.count);
      const overlap = hw >= 0.85 ? 1 : Math.min(run.x + r, ox + hw) - Math.max(run.x - r, ox - hw);
      if (overlap > 0.01 && ev.hp > 0) {
        const ratio = hw >= 0.85 ? 1 : clamp(overlap / (2 * r), 0.25, 1);
        const loss = Math.max(1, Math.round(ev.hp * ratio));
        run.count = Math.max(0, run.count - loss);
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({ type: 'clash', x: ox, z: ev.z, loss });
        }
      }
    } else if (ev.type === 'crate') {
      const ox = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.28;
      const r = crowdRadius(run.count);
      const overlap = Math.min(run.x + r, ox + hw) - Math.max(run.x - r, ox - hw);
      if (overlap > 0.01 && ev.hp > 0) {
        const loss = Math.max(1, Math.round(ev.hp * 0.42));
        run.count = Math.max(0, run.count - loss);
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({ type: 'hit', variant: 'barrel', x: ox, z: ev.z, loss });
        }
      }
    } else if (ev.type === 'obstacle') {
      const ox = eventXAt(ev, run.t);
      const hw = ev.hw ?? 0.26;
      const r = crowdRadius(run.count);
      const overlap = Math.min(run.x + r, ox + hw) - Math.max(run.x - r, ox - hw);
      if (overlap > 0.01) {
        const ratio = clamp(overlap / (2 * r), 0.18, 1);
        const pct = ev.variant === 'mud' ? 0.22 : ev.variant === 'saw' ? 0.36 : 0.30;
        const loss = Math.max(1, Math.round(run.count * pct * ratio));
        run.count = Math.max(0, run.count - loss);
        if (ev.variant === 'mud') run.muddy = true;
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({ type: 'hit', variant: ev.variant, x: ox, z: ev.z, loss });
        }
      }
    } else if (ev.type === 'pickup') {
      const px = eventXAt(ev, run.t);
      const pr = ev.r ?? 0.18;
      const r = crowdRadius(run.count);
      if (Math.abs(run.x - px) <= r + pr) {
        if (ev.kind === 'star') run.bonusPts += ev.val || 10;
        else if (ev.kind === 'clean') {
          run.muddy = false;
          run.count = clamp(run.count + (ev.val || 0), 0, 99_999_999);
        } else run.count = clamp(run.count + (ev.val || 2), 0, 99_999_999);
        if (run.recentEvents.length < 24) {
          run.recentEvents.push({ type: 'pickup', kind: ev.kind, x: px, z: ev.z, val: ev.val });
        }
      }
    }

    if (run.count <= 0) {
      run.status = 'lost';
      run.failReason = 'wiped';
      run.finalEval = evaluatePower(run);
      return run;
    }
  }

  // Chegou ao Coreto!
  if (run.z >= run.level.length) {
    const ev = evaluatePower(run);
    run.finalEval = ev;
    if (ev.won) {
      run.status = 'won';
      run.failReason = null;
    } else {
      run.status = 'lost';
      run.failReason = run.muddy
        ? 'muddy'
        : run.style !== run.level.targetStyle
          ? 'wrong-style'
          : 'outnumbered';
    }
  }

  return run;
}

// =========================================================================
// Solucionador determinístico em feixe (prova 3★ vencível e não-trivialidade)
// =========================================================================

export function simulateFixedPolicy(level, policyFn) {
  const run = createRun(level);
  const dt = 1 / 15;
  let steps = 0;
  while (run.status === 'running' && steps < 2400) {
    stepRun(run, dt, policyFn(run));
    steps++;
  }
  return run;
}

export function solveTropaLevel(level, beamWidth = 10) {
  const evList = [...(level.events || [])].filter((e) => e.type !== 'belt').sort((a, b) => a.z - b.z);
  const anchors = [];
  for (const e of evList) {
    if (anchors.length === 0 || e.z - anchors[anchors.length - 1] >= 10) {
      anchors.push(e.z);
    }
  }
  if (anchors.length === 0 || level.length - anchors[anchors.length - 1] > 4) {
    anchors.push(level.length);
  }

  const lanes = [-0.72, -0.4, 0, 0.4, 0.72];
  const dt = 1 / 15;

  const cloneState = (run) => ({
    ...run,
    events: run.events.map((ev) => ({
      ...ev,
      left: ev.left ? { ...ev.left } : undefined,
      right: ev.right ? { ...ev.right } : undefined,
      gate: ev.gate ? { ...ev.gate } : undefined,
    })),
    recentEvents: [],
  });

  let frontier = [{ run: createRun(level), path: [] }];

  for (const targetZ of anchors) {
    const nextMap = new Map();
    for (const node of frontier) {
      for (const lx of lanes) {
        const sim = cloneState(node.run);
        let guard = 0;
        while (sim.status === 'running' && sim.z < targetZ && guard < 240) {
          stepRun(sim, dt, lx);
          guard++;
        }
        if (sim.status === 'lost' && sim.count <= 0) continue;
        const evNow = evaluatePower(sim);
        const bucket = sim.count > 0 ? Math.floor(Math.log2(sim.count + 1) * 4) : 0;
        const key = `${Math.round(sim.x * 3)}|${sim.style}|${sim.muddy ? 1 : 0}|${bucket}`;
        const prevBest = nextMap.get(key);
        const score = evNow.totalPower * (1 + (sim.style === level.targetStyle ? 0.15 : 0)) - (sim.muddy ? evNow.totalPower * 0.1 : 0);
        if (!prevBest || score > prevBest.score) {
          nextMap.set(key, {
            run: sim,
            path: [...node.path, { z: targetZ, x: lx }],
            score,
          });
        }
      }
    }
    frontier = [...nextMap.values()].sort((a, b) => b.score - a.score).slice(0, beamWidth);
    if (frontier.length === 0) break;
  }

  let best = null;
  for (const node of frontier) {
    const sim = cloneState(node.run);
    let guard = 0;
    while (sim.status === 'running' && guard < 240) {
      stepRun(sim, dt, sim.x);
      guard++;
    }
    const power = sim.finalEval?.totalPower || 0;
    if (!best || (sim.status === 'won' && best.status !== 'won') || (sim.status === best.status && power > best.power)) {
      best = {
        status: sim.status,
        stars: sim.finalEval?.stars || 0,
        power,
        count: sim.count,
        style: sim.style,
        muddy: sim.muddy,
        path: node.path,
      };
    }
  }

  return best || { status: 'lost', stars: 0, power: 0, count: 0, style: level.startStyle || 'basico', muddy: false, path: [] };
}

// =========================================================================
// Construtores e gerador curado de 40 maratonas (~60s e escala até milhões!)
// =========================================================================

const pair = (z, left, right, extra = {}) => ({ type: 'gatePair', z, left, right, ...extra });
const single = (z, x, gate, extra = {}) => ({ type: 'singleGate', z, x, hw: 0.32, gate, ...extra });
const math = (op, val, extra = {}) => ({ kind: 'math', op, val, ...extra });
const osc = (op, val, oscOp, oscVal, oscPeriod = 2.0, oscPhase = 0) => ({
  kind: 'math',
  op,
  val,
  oscOp,
  oscVal,
  oscPeriod,
  oscPhase,
});
const styleGate = (style, val = 0) => ({ kind: 'style', style, val });
const cleanGate = (val = 4) => ({ kind: 'clean', val });
const charge = (startVal, maxVal, rate = 15, stepUnit = 1) => ({ kind: 'charge', startVal, maxVal, rate, stepUnit });

const obs = (z, x, variant, extra = {}) => ({
  type: 'obstacle',
  z,
  x,
  hw: variant === 'barrel' ? 0.25 : variant === 'saw' ? 0.22 : variant === 'mud' ? 0.3 : 0.2,
  variant,
  ...extra,
});
const enemy = (z, x, hw, hp, extra = {}) => ({
  type: 'enemy',
  z,
  x,
  hw,
  hp,
  maxHp: hp,
  ...extra,
});
const crate = (z, x, hp, rewardOp, rewardVal, extra = {}) => ({
  type: 'crate',
  z,
  x,
  hw: 0.28,
  hp,
  maxHp: hp,
  rewardOp,
  rewardVal,
  ...extra,
});
const star = (z, x, val = 10, extra = {}) => ({ type: 'pickup', kind: 'star', z, x, val, ...extra });
const mates = (z, x, val = 3, extra = {}) => ({ type: 'pickup', kind: 'squad', z, x, val, ...extra });
const soap = (z, x, val = 2) => ({ type: 'pickup', kind: 'clean', z, x, val });
const belt = (zStart, zEnd, pushX) => ({ type: 'belt', zStart, zEnd, pushX });

const STAGE_SPECS = [
  // Cap 1: Rua das Barracas (~750 -> ~8.1k)
  { id: 1, title: 'Portais da Entrada', targetStyle: 'junino', avoidStyle: null, rival: 740, s2: 910, s3: 1060 },
  { id: 2, title: 'Barril & Tiroteio', targetStyle: 'junino', avoidStyle: null, rival: 870, s2: 1070, s3: 1240 },
  { id: 3, title: 'Baú Multiplicador', targetStyle: 'junino', avoidStyle: 'rock', rival: 980, s2: 1200, s3: 1400 },
  { id: 4, title: 'Armadilha do Número Grande', targetStyle: 'junino', avoidStyle: 'rock', rival: 1350, s2: 1650, s3: 1940 },
  { id: 5, title: 'Lama das Quadrilhas', targetStyle: 'junino', avoidStyle: 'gala', rival: 1600, s2: 1960, s3: 2300 },
  { id: 6, title: 'Serra do Pau-de-Sebo', targetStyle: 'junino', avoidStyle: 'rock', rival: 2100, s2: 2580, s3: 3020 },
  { id: 7, title: 'Portal Oscilante', targetStyle: 'junino', avoidStyle: 'neon', rival: 2500, s2: 3100, s3: 3650 },
  { id: 8, title: 'Choque na Avenida', targetStyle: 'junino', avoidStyle: 'rock', rival: 3100, s2: 3800, s3: 4450 },
  { id: 9, title: 'Corredor Estreito', targetStyle: 'junino', avoidStyle: 'gala', rival: 4450, s2: 5450, s3: 6400 },
  { id: 10, title: 'Rei da Rua das Barracas', targetStyle: 'junino', avoidStyle: 'rock', rival: 5000, s2: 6150, s3: 7200 },

  // Cap 2: Noite Neon & Gala (~11k -> ~92k)
  { id: 11, title: 'Estreia de Gala', targetStyle: 'gala', avoidStyle: 'junino', rival: 7000, s2: 8600, s3: 10100 },
  { id: 12, title: 'Portal de Fogos', targetStyle: 'gala', avoidStyle: 'junino', rival: 8300, s2: 10200, s3: 12000 },
  { id: 13, title: 'Neon da Madrugada', targetStyle: 'neon', avoidStyle: 'rock', rival: 10800, s2: 13200, s3: 15500 },
  { id: 14, title: 'Risco Duplo', targetStyle: 'gala', avoidStyle: 'neon', rival: 14600, s2: 18000, s3: 21000 },
  { id: 15, title: 'Batalha de Estrelas', targetStyle: 'neon', avoidStyle: 'junino', rival: 16800, s2: 20700, s3: 24200 },
  { id: 16, title: 'Rock da Praça', targetStyle: 'rock', avoidStyle: 'gala', rival: 23500, s2: 29000, s3: 34000 },
  { id: 17, title: 'Lama ou Atalho', targetStyle: 'neon', avoidStyle: 'rock', rival: 28000, s2: 34500, s3: 40500 },
  { id: 18, title: 'Troca de Rumo', targetStyle: 'gala', avoidStyle: 'rock', rival: 38000, s2: 46800, s3: 54800 },
  { id: 19, title: 'Labirinto Iluminado', targetStyle: 'neon', avoidStyle: 'gala', rival: 49500, s2: 60800, s3: 71200 },
  { id: 20, title: 'Rainha do Palco Neon', targetStyle: 'neon', avoidStyle: 'junino', rival: 56500, s2: 69500, s3: 81500 },

  // Cap 3: Gincana dos Milhares (~110k -> ~1.44M)
  { id: 21, title: 'Esteira Traiçoeira', targetStyle: 'rock', avoidStyle: 'gala', rival: 110000, s2: 136000, s3: 160000 },
  { id: 22, title: 'Serras Cruzadas', targetStyle: 'junino', avoidStyle: 'rock', rival: 125000, s2: 154000, s3: 180000 },
  { id: 23, title: 'Dilema do Multiplicador', targetStyle: 'gala', avoidStyle: 'neon', rival: 180000, s2: 222000, s3: 260000 },
  { id: 24, title: 'Pista Ensaboada', targetStyle: 'neon', avoidStyle: 'junino', rival: 222000, s2: 274000, s3: 320000 },
  { id: 25, title: 'Fogo Cruzado', targetStyle: 'rock', avoidStyle: 'junino', rival: 290000, s2: 356000, s3: 416000 },
  { id: 26, title: 'Portais Gêmeos Móveis', targetStyle: 'gala', avoidStyle: 'rock', rival: 368000, s2: 452000, s3: 530000 },
  { id: 27, title: 'Passagem do Funil', targetStyle: 'junino', avoidStyle: 'neon', rival: 470000, s2: 576000, s3: 675000 },
  { id: 28, title: 'Oscilação Frenética', targetStyle: 'neon', avoidStyle: 'gala', rival: 580000, s2: 715000, s3: 838000 },
  { id: 29, title: 'A Escolha Invertida', targetStyle: 'rock', avoidStyle: 'junino', rival: 810000, s2: 995000, s3: 1165000 },
  { id: 30, title: 'Campeão da Gincana', targetStyle: 'gala', avoidStyle: 'neon', rival: 890000, s2: 1090000, s3: 1280000 },

  // Cap 4: Coreto dos Milhões (~1.3M -> ~17.5M)
  { id: 31, title: 'Desfile de Abertura', targetStyle: 'junino', avoidStyle: 'rock', rival: 1320000, s2: 1620000, s3: 1890000 },
  { id: 32, title: 'Chuva de Estrelas', targetStyle: 'neon', avoidStyle: 'junino', rival: 1480000, s2: 1820000, s3: 2130000 },
  { id: 33, title: 'Esteira do Caos', targetStyle: 'rock', avoidStyle: 'gala', rival: 2150000, s2: 2640000, s3: 3090000 },
  { id: 34, title: 'Dupla Carga Elétrica', targetStyle: 'gala', avoidStyle: 'rock', rival: 2540000, s2: 3120000, s3: 3650000 },
  { id: 35, title: 'Serras Sincronizadas', targetStyle: 'junino', avoidStyle: 'neon', rival: 3480000, s2: 4270000, s3: 5000000 },
  { id: 36, title: 'Ilusão do Brilho', targetStyle: 'neon', avoidStyle: 'rock', rival: 4120000, s2: 5060000, s3: 5920000 },
  { id: 37, title: 'Corredor Polonês', targetStyle: 'rock', avoidStyle: 'gala', rival: 5350000, s2: 6570000, s3: 7690000 },
  { id: 38, title: 'Quase Impossível', targetStyle: 'gala', avoidStyle: 'junino', rival: 6670000, s2: 8180000, s3: 9580000 },
  { id: 39, title: 'Semifinal do Coreto', targetStyle: 'neon', avoidStyle: 'rock', rival: 9600000, s2: 11790000, s3: 13800000 },
  { id: 40, title: 'Grande Rainha da Quermesse', targetStyle: 'gala', avoidStyle: 'rock', rival: 10900000, s2: 13360000, s3: 15640000 },
];

function buildStageEvents(spec) {
  const i = spec.id;
  const chap = Math.ceil(i / 10);
  const speed = +(11.5 + (i - 1) * 0.08).toFixed(2);
  // >= 60s de corrida contínua por fase (~60.5s a ~64s)
  const length = Math.round(speed * (60.5 + (i % 5) * 0.7));
  const ev = [];

  // Escala calibrada entre fases (de centenas na Fase 1 até milhões na Fase 40!)
  const baseScale = Math.pow(1.27, i - 1);
  const add = (k) => Math.max(3, Math.round(k * baseScale));
  const cHp = (k) => Math.max(4, Math.round(k * baseScale));
  const eHp = (k) => Math.max(4, Math.round(k * baseScale));

  const wrong = spec.avoidStyle || (spec.targetStyle === 'junino' ? 'rock' : 'junino');
  const other = spec.targetStyle === 'gala' ? 'neon' : 'gala';

  const slots = 22;
  const span = length - 56;
  const stepZ = span / slots;
  const zz = (s) => Math.round(28 + s * stepZ);
  // Alterna lados + centro para impedir vitória com pista parada (0, L ou R)!
  const sideFlip = (slot) => ((i * 5 + slot * 7) % 2 === 0);
  const mkPair = (z, a, b, slot) => (sideFlip(slot) ? pair(z, a, b) : pair(z, b, a));

  // S0: Abertura (+ soma inicial vs penalidade clara)
  ev.push(mkPair(zz(0), math('+', add(8)), math('-', Math.max(2, add(3))), 0));

  // S1: Primeiro pelotão rival + serra central para impedir x=0 passivo
  const e1x = sideFlip(1) ? -0.45 : 0.45;
  ev.push(enemy(zz(1), e1x, 0.36, eHp(9), { rewardVal: add(5) }));

  // S2: Dilema de Traje (traje errado com + grande vs traje certo do tema)
  ev.push(mkPair(zz(2), styleGate(spec.targetStyle, add(4)), styleGate(wrong, add(16)), 2));

  // S3: Barril/Serra no centro/lateral + Estrela bônus
  ev.push(obs(zz(3), 0, i >= 12 ? 'saw' : 'barrel', { moveAmp: i >= 8 ? 0.35 : 0, moveSpeed: 2.0 }));
  ev.push(star(zz(3) + 6, sideFlip(3) ? -0.52 : 0.52, Math.max(8, Math.round(spec.rival * 0.05))));

  // S4: Primeiro ×2 (ou Carga!)
  if (i >= 4 && i % 2 === 0) {
    ev.push(mkPair(zz(4), charge(-add(8), add(18), Math.max(12, add(15)), Math.max(1, Math.round(baseScale * 0.7))), math('+', add(4)), 4));
  } else {
    ev.push(mkPair(zz(4), math('×', 2), math('-', add(6)), 4));
  }

  // S5: Baú premiado (+ bônus grande ao quebrar) + companheiros do outro lado
  const c5x = sideFlip(5) ? 0.46 : -0.46;
  ev.push(crate(zz(5), c5x, cHp(14), '+', add(18)));
  ev.push(mates(zz(5) + 4, -c5x, add(6)));

  // S6: Horda rival forte (atire antes para diminuir a perda!)
  ev.push(
    enemy(zz(6), 0, 0.52, eHp(22), {
      moveAmp: i >= 6 ? 0.36 : 0,
      moveSpeed: 1.9 + chap * 0.2,
      rewardVal: add(8),
    })
  );

  // S7: Lama + Portal oscilante (+ / -)
  ev.push(obs(zz(7) - 5, sideFlip(7) ? -0.46 : 0.46, 'mud'));
  if (i >= 5) {
    ev.push(mkPair(zz(7) + 4, osc('+', add(20), '-', Math.max(4, add(12)), 2.0, 0), math('-', add(8)), 7));
  } else {
    ev.push(mkPair(zz(7) + 4, math('+', add(16)), math('-', Math.max(3, add(10))), 7));
  }

  // S8: Cabine de limpeza vs corte de ÷2
  ev.push(mkPair(zz(8), cleanGate(add(10)), math('÷', 2), 8));

  // S9: Esteira + Cones/Serras
  if (i >= 6) {
    const dir = i % 2 === 0 ? 1 : -1;
    ev.push(belt(zz(9) - 10, zz(9) + 12, dir * (1.25 + chap * 0.14)));
  }
  ev.push(obs(zz(9), -0.52, i >= 15 ? 'saw' : 'cone'));
  ev.push(obs(zz(9), 0.52, i >= 15 ? 'saw' : 'cone'));

  // S10: Segunda chance de Traje Certo vs Soma maior no Traje Errado
  ev.push(mkPair(zz(10), styleGate(spec.targetStyle, add(12)), styleGate(wrong, add(28)), 10));

  // S11: Sub-chefe de Meio de Pista (barreira inteira que exige boa tropa + tiro!)
  ev.push(enemy(zz(11), 0, 0.92, eHp(46), { rewardVal: add(14) }));

  // S12: Portal móvel bônus + Barril no centro
  ev.push(single(zz(12), 0, math('+', add(26)), { moveAmp: 0.54, moveSpeed: 2.0 + chap * 0.2 }));
  ev.push(obs(zz(12) + 8, 0, 'barrel'));

  // S13: Dilema Traje Oposto vs Soma positiva vs Corte
  ev.push(mkPair(zz(13), math('+', add(24)), styleGate(other, add(14)), 13));

  // S14: Segundo Baú Valioso (+ grande!) + Estrela
  const c14x = sideFlip(14) ? -0.46 : 0.46;
  ev.push(crate(zz(14), c14x, cHp(32), '+', add(38)));
  ev.push(star(zz(14) + 5, -c14x, Math.max(12, Math.round(spec.rival * 0.05))));

  // S15: Portal de Carga potente vs Divisão!
  ev.push(
    mkPair(
      zz(15),
      charge(-add(18), add(52), Math.max(20, add(44)), Math.max(1, Math.round(baseScale * 1.4))),
      math('-', add(14)),
      15
    )
  );

  // S16: Serra central móvel + Lama + Sabão limpo
  ev.push(obs(zz(16) - 4, 0, 'saw', { moveAmp: 0.52, moveSpeed: 2.3 + chap * 0.22 }));
  ev.push(obs(zz(16) + 7, sideFlip(16) ? 0.45 : -0.45, 'mud'));
  ev.push(soap(zz(16) + 14, sideFlip(16) ? -0.48 : 0.48, add(10)));

  // S17: Última recuperação de Traje do Tema vs ÷2!
  ev.push(mkPair(zz(17), styleGate(spec.targetStyle, add(16)), math('÷', 2), 17));

  // S18: Horda rival pesada antes da reta final
  ev.push(enemy(zz(18), sideFlip(18) ? 0.35 : -0.35, 0.48, eHp(64), { rewardVal: add(24) }));

  // S19: Esteira + Portal móvel de divisão (fuja do ÷2!)
  if (i >= 8) {
    ev.push(belt(zz(19) - 10, zz(19) + 8, (i % 2 === 0 ? -1 : 1) * (1.28 + chap * 0.16)));
  }
  ev.push(single(zz(19), 0, math('÷', 2), { moveAmp: 0.58, moveSpeed: 2.2 + chap * 0.22, movePhase: 1.2 }));

  // S20: Penúltimo par — segundo ×2 / ×3 vs corte pesado!
  ev.push(mkPair(zz(20), math('×', chap >= 3 ? 3 : 2), math('-', add(45)), 20));

  // S21: Guarda do Coreto (barreira larga!) + par final decisivo!
  ev.push(enemy(zz(21), 0, 0.92, eHp(96), { rewardVal: add(35) }));
  ev.push(
    mkPair(
      Math.min(length - 18, zz(22)),
      osc('+', add(120), '-', add(65), 1.95, 0),
      math('+', add(65)),
      22
    )
  );

  return { length, speed, events: ev };
}

export const LEVELS = STAGE_SPECS.map((spec) => {
  const chap = Math.ceil(spec.id / 10);
  const { length, speed, events } = buildStageEvents(spec);
  const startCount = Math.max(6, Math.round(6 * Math.pow(1.315, spec.id - 1)));
  return {
    id: spec.id,
    chapter: chap,
    title: spec.title,
    subtitle: `Vista ${STYLES[spec.targetStyle].name} (×1.6) e vença a Rival de ${fmtNum(spec.rival)} no Coreto!`,
    hint: `Atire nos baús e hordas para crescer, busque ${STYLES[spec.targetStyle].name}${spec.avoidStyle ? ` (evite ${STYLES[spec.avoidStyle].tag})` : ''} e acerte os × antes do palco.`,
    length,
    speed,
    startCount,
    startStyle: 'basico',
    targetStyle: spec.targetStyle,
    avoidStyle: spec.avoidStyle,
    rivalPower: spec.rival,
    star2Power: spec.s2,
    star3Power: spec.s3,
    events,
  };
});

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}
