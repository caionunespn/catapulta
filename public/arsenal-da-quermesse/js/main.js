import { ico, avatar, installSprite } from '../../js/art.js';
import { sfx, burst, confetti, shake, toast, isMuted, setMuted } from '../../js/fx.js';
import {
  GRID_COLS,
  GRID_ROWS,
  TRAY_SLOTS,
  SHOP_SLOTS,
  REROLL_COST,
  EXPAND_COST,
  MAX_TIER,
  ARENA_W,
  ARENA_H,
  TIERS,
  PIECES,
  PIECE_IDS,
  ENEMIES,
  CHAPTERS,
  LEVELS,
  clamp,
  pieceBounds,
  pieceCellsAt,
  isAdjacentToOpen,
  buildOccupancyMap,
  canPlacePiece,
  findMergeTarget,
  findFirstValidPlacement,
  computeGridSynergies,
  estimateGridDps,
  pieceSellValue,
  hasMatchingPiece,
  expandGridCell,
  createStageRun,
  rerollShop,
  toggleShopLock,
  buyShopToGrid,
  buyShopToTray,
  moveGridPiece,
  moveTrayToGrid,
  moveGridToTray,
  moveTrayToTray,
  rotateGridPiece,
  sellPiece,
  startWave,
  stepCombat,
  getLevel,
} from './engine.js';
import { hudIco, pieceSvg, shapeMiniSvg, drawArenaFrame } from './art.js';

installSprite();

const $ = (s) => document.querySelector(s);
const STORAGE_KEY = 'catapulta_arsenal_v1';

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
  run: null,
  speed: 1,
  selected: null, // { source: 'grid'|'tray'|'shop', uid?, trayIdx?, slotIdx?, rot }
  drag: null,
  hoverPreview: null, // { col, row, cells, kind: 'ok'|'merge'|'bad', synCells: Set }
  modal: null, // null | 'map' | 'rules'
  rulesTab: 'rules', // 'rules' | 'pieces' | 'about'
  animTime: 0,
  lastTs: 0,
  rafId: 0,
  lastSfxAt: 0,
  pieceDomCache: new Map(), // uid -> { el, cdEl }
};

const canvas = $('#ars-canvas');
const ctx = canvas.getContext('2d');
let renderDpr = 0;

function ensureCanvasScale() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (renderDpr === dpr) return;
  renderDpr = dpr;
  canvas.width = Math.round(ARENA_W * dpr);
  canvas.height = Math.round(ARENA_H * dpr);
}

function gridMetrics() {
  const gridEl = $('#ars-grid');
  const firstCell = gridEl.querySelector('.ars-cell');
  const gridRect = gridEl.getBoundingClientRect();
  if (!firstCell) {
    return { gridRect, cell: 48, gap: 5 };
  }
  const cellRect = firstCell.getBoundingClientRect();
  const cell = cellRect.width || 48;
  const gap = (gridRect.width - cell * GRID_COLS) / Math.max(1, GRID_COLS - 1);
  return { gridRect, cell, gap };
}

function pointToCell(clientX, clientY) {
  const { gridRect, cell, gap } = gridMetrics();
  if (
    clientX < gridRect.left - 8 ||
    clientX > gridRect.right + 8 ||
    clientY < gridRect.top - 8 ||
    clientY > gridRect.bottom + 8
  ) {
    return null;
  }
  const stride = cell + gap;
  const col = clamp(Math.floor((clientX - gridRect.left) / stride), 0, GRID_COLS - 1);
  const row = clamp(Math.floor((clientY - gridRect.top) / stride), 0, GRID_ROWS - 1);
  return { col, row };
}

function pointToAnchor(clientX, clientY, pieceId, rot) {
  const { gridRect, cell, gap } = gridMetrics();
  if (
    clientX < gridRect.left - 18 ||
    clientX > gridRect.right + 18 ||
    clientY < gridRect.top - 18 ||
    clientY > gridRect.bottom + 18
  ) {
    return null;
  }
  const { w, h } = pieceBounds(pieceId, rot);
  const stride = cell + gap;
  const rawCol = (clientX - gridRect.left) / stride - (w - 1) * 0.5;
  const rawRow = (clientY - gridRect.top) / stride - (h - 1) * 0.5;
  return {
    col: clamp(Math.round(rawCol), 0, Math.max(0, GRID_COLS - w)),
    row: clamp(Math.round(rawRow), 0, Math.max(0, GRID_ROWS - h)),
  };
}

function getSelectedPieceInfo() {
  const sel = state.selected;
  const run = state.run;
  if (!sel || !run) return null;
  if (sel.source === 'grid') {
    const p = run.grid.pieces.find((x) => x.uid === sel.uid);
    if (!p) return null;
    return { ...sel, piece: p, pieceId: p.pieceId, tier: p.tier, rot: p.rot };
  }
  if (sel.source === 'tray') {
    const p = run.tray[sel.trayIdx];
    if (!p) return null;
    return { ...sel, piece: p, pieceId: p.pieceId, tier: p.tier, rot: sel.rot ?? 0 };
  }
  if (sel.source === 'shop') {
    const o = run.shop[sel.slotIdx];
    if (!o) return null;
    return { ...sel, offer: o, pieceId: o.pieceId, tier: o.tier, rot: sel.rot ?? 0 };
  }
  return null;
}

function loadLevel(id) {
  state.levelId = clamp(Math.round(Number(id) || 1), 1, LEVELS.length);
  saved.level = state.levelId;
  saveProgress();
  state.run = createStageRun(state.levelId);
  state.selected = null;
  state.drag = null;
  state.hoverPreview = null;
  $('#ars-overlay').classList.add('hidden');
  renderAll();
  drawCanvas();
}

function drawCanvas() {
  ensureCanvasScale();
  ctx.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
  drawArenaFrame(ctx, state.run, state.animTime);
}

// ---------- Renderização da Interface ----------

function updateWallMeter(run) {
  const hpPct = clamp((run.wallHp / Math.max(1, run.wallMaxHp)) * 100, 0, 100);
  const armPct = clamp((run.wallArmor / Math.max(1, run.wallMaxHp)) * 100, 0, 100);
  const icoEl = $('#ars-wall-ico');
  if (icoEl && !icoEl.innerHTML) icoEl.innerHTML = hudIco('wall');

  $('#ars-wall-txt').innerHTML = `Muralha <b>${Math.ceil(run.wallHp)}/${run.wallMaxHp}</b>`;
  const armEl = $('#ars-armor-txt');
  if (run.wallArmor > 0) {
    armEl.classList.remove('hidden');
    armEl.textContent = `+${Math.ceil(run.wallArmor)} Escudo`;
  } else {
    armEl.classList.add('hidden');
  }

  const hpBar = $('#ars-bar-hp');
  hpBar.style.width = `${hpPct.toFixed(1)}%`;
  hpBar.classList.toggle('mid', hpPct < 65 && hpPct >= 35);
  hpBar.classList.toggle('low', hpPct < 35);
  $('#ars-bar-armor').style.width = `${armPct.toFixed(1)}%`;
}

function renderHeaderAndHud() {
  const run = state.run;
  const lv = run.level;

  $('#ars-wrap').dataset.phase = run.phase;

  $('#ars-level-num').textContent = `FASE ${lv.id} / ${LEVELS.length}`;
  $('#ars-level-name').textContent = lv.title;
  $('#ars-total-stars').textContent = `★ ${totalStars()}/${LEVELS.length * 3}`;
  $('#btn-prev').disabled = lv.id <= 1;
  $('#btn-next').disabled = lv.id >= LEVELS.length;

  updateWallMeter(run);

  $('#ars-gold-pill').innerHTML = `${hudIco('coin')}<b>${run.gold}</b> Ouro`;

  const est = estimateGridDps(run.grid);
  const synLabel = est.linkCount > 0 ? ` · ${est.linkCount}✦` : '';
  $('#ars-dps-pill').innerHTML = `${hudIco('dps')}<b>${est.dps}</b> DPS${synLabel}`;

  const pips = lv.waves
    .map((_, i) => `<i class="ars-wpip${i < run.waveIdx ? ' done' : i === run.waveIdx ? ' now' : ''}"></i>`)
    .join('');
  $('#ars-wave-pill').innerHTML =
    `${hudIco('wave')}Horda <b>${Math.min(run.waveIdx + 1, lv.waves.length)}/${lv.waves.length}</b>` +
    `<span class="ars-wave-pips">${pips}</span>`;

  const expPill = $('#ars-expand-pill');
  if (run.freeExpands > 0 && run.phase === 'prep') {
    expPill.classList.remove('hidden');
    expPill.textContent = `+${run.freeExpands} Espaço${run.freeExpands > 1 ? 's' : ''} Grátis`;
  } else {
    expPill.classList.add('hidden');
  }

  // Prévia da horda na preparação + barra de status no combate
  const wave = lv.waves[run.waveIdx];
  const prevEl = $('#ars-wave-preview');
  const combatStatusEl = $('#ars-combat-status');
  const gridHintEl = $('#ars-grid-hint');

  if (run.phase === 'combat' && run.combat) {
    const remSpawns = run.combat.spawners.reduce((s, sp) => s + sp.rem, 0);
    const totalLeft = remSpawns + run.combat.enemies.length;
    const total = Math.max(1, run.combat.totalEnemies || totalLeft);
    const pct = clamp(((total - totalLeft) / total) * 100, 0, 100);
    combatStatusEl.textContent = `Horda ${run.waveIdx + 1}/${lv.waves.length} · ${totalLeft} inimigos restantes`;
    $('#ars-wave-fill').style.width = `${pct.toFixed(1)}%`;
    gridHintEl.textContent = 'Disparando poderes para a lane!';
  } else {
    gridHintEl.textContent = 'Arraste ou toque para somar peças iguais';
    if (run.phase !== 'prep') {
      combatStatusEl.textContent = run.phase === 'won' ? 'Vitória!' : 'Muralha caída';
      $('#ars-wave-fill').style.width = run.phase === 'won' ? '100%' : '0%';
    }
    if (wave) {
      const counts = new Map();
      for (const g of wave.groups) {
        counts.set(g.type, (counts.get(g.type) || 0) + g.count);
      }
      const chips = Array.from(counts.entries())
        .map(([type, count]) => {
          const ed = ENEMIES[type];
          const tag = ed.boss ? ' · CHEFE' : ed.armor > 0 ? ' · Blindado' : ed.flying ? ' · Voador' : '';
          return `<span class="ars-enemy-chip"><i class="ars-enemy-dot" style="background:${ed.color}"></i>${count}× ${ed.name}${tag}</span>`;
        })
        .join('');
      prevEl.innerHTML = `<span><b>Próxima Horda (${run.waveIdx + 1}/${lv.waves.length}):</b></span><div class="ars-wave-chips">${chips}</div>`;
    }
  }

  // Botões de preparo & velocidade segmentada
  const fightBtn = $('#btn-fight');
  if (run.phase === 'prep') {
    fightBtn.disabled = false;
    fightBtn.textContent = `Chamar Horda ${run.waveIdx + 1}/${lv.waves.length}!`;
  } else {
    fightBtn.disabled = true;
    fightBtn.textContent = `Lutando (${state.speed}×)...`;
  }
  document.querySelectorAll('.ars-spd-btn').forEach((btn) => {
    btn.classList.toggle('on', Number(btn.dataset.spd) === state.speed);
  });
  $('#btn-reroll').disabled = run.phase !== 'prep' || run.gold < REROLL_COST;

  const selInfo = getSelectedPieceInfo();
  const canRot = run.phase === 'prep' && selInfo && PIECES[selInfo.pieceId].rotCount > 1;
  $('#btn-rotate-top').disabled = !canRot;
}

function renderGrid() {
  const run = state.run;
  const gridEl = $('#ars-grid');
  const syn = computeGridSynergies(run.grid);
  const selInfo = getSelectedPieceInfo();
  const isPrep = run.phase === 'prep';
  const hp = state.hoverPreview;

  // 1. Células 6×4
  let cellsHtml = '';
  const previewSet = new Set((hp?.cells || []).map(([c, r]) => `${c},${r}`));
  const synSet = hp?.synCells || new Set();

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const open = run.grid.open[r][c];
      const exp = isPrep && !open && isAdjacentToOpen(run.grid, c, r);
      const isFree = exp && run.freeExpands > 0;
      const canBuyExp = exp && run.freeExpands === 0 && run.gold >= EXPAND_COST;
      const key = `${c},${r}`;

      let cls = 'ars-cell ' + (open ? 'open' : 'locked');
      if (exp && (isFree || canBuyExp)) cls += ' expandable' + (isFree ? ' free' : '');
      if (previewSet.has(key)) cls += ` preview-${hp.kind}`;
      if (synSet.has(key)) cls += ' syn-glow';

      let inner = '';
      if (isFree) inner = `<span class="ars-expand-tag">+ABRIR<br>GRÁTIS</span>`;
      else if (canBuyExp) inner = `<span class="ars-expand-tag">+${EXPAND_COST}</span>`;

      cellsHtml += `<div class="${cls}" data-col="${c}" data-row="${r}">${inner}</div>`;
    }
  }

  gridEl.innerHTML = cellsHtml;

  // 2. Peças posicionadas (calculadas pelos spans reais das células)
  state.pieceDomCache.clear();
  const { cell, gap } = gridMetrics();
  const stride = cell + gap;

  for (const p of run.grid.pieces) {
    const def = PIECES[p.pieceId];
    const tInfo = TIERS[p.tier];
    const { w, h, cells } = pieceBounds(p.pieceId, p.rot);
    const pSyn = syn.byUid.get(p.uid);

    const el = document.createElement('div');
    el.className = 'ars-piece';
    if (selInfo?.source === 'grid' && selInfo.uid === p.uid) el.classList.add('selected');
    if (
      selInfo &&
      selInfo.pieceId === p.pieceId &&
      selInfo.tier === p.tier &&
      selInfo.tier < MAX_TIER &&
      !(selInfo.source === 'grid' && selInfo.uid === p.uid)
    ) {
      el.classList.add('merge-hint');
    }

    el.style.left = `${p.col * stride}px`;
    el.style.top = `${p.row * stride}px`;
    el.style.width = `${w * cell + (w - 1) * gap}px`;
    el.style.height = `${h * cell + (h - 1) * gap}px`;
    el.style.setProperty('--tier-border', tInfo.border);
    el.style.setProperty('--tier-bg', tInfo.bg);
    el.style.setProperty('--tier-color', tInfo.color);

    // Fundo individual de cada célula ocupada (preserva o canto aberto da peça L!)
    let tilesHtml = '';
    for (const [dc, dr] of cells) {
      tilesHtml += `<div class="ars-piece-tile" style="left:${dc * stride}px;top:${dr * stride}px;width:${cell}px;height:${cell}px"></div>`;
    }

    const synDot = pSyn?.buffed ? `<span class="ars-syn-dot" title="Recebendo sinergia">✦</span>` : '';
    const cdBar = def.cd > 0 ? `<div class="ars-cd-bar"><div class="ars-cd-fill"></div></div>` : '';

    el.innerHTML =
      tilesHtml +
      `<div class="ars-piece-svg-wrap">${pieceSvg(p.pieceId, p.tier, p.rot)}</div>` +
      `<span class="ars-tier-badge">Nv.${p.tier}${tInfo.stars}</span>` +
      synDot +
      cdBar;

    gridEl.appendChild(el);
    state.pieceDomCache.set(p.uid, { el, cdEl: el.querySelector('.ars-cd-fill') });
  }

  // 3. Linhas de sinergia brilhantes ligando Tomo, Lampião, Escudo e peças vizinhas
  if (isPrep && syn.links.length > 0) {
    const pieceMap = new Map(run.grid.pieces.map((p) => [p.uid, p]));
    const centerOf = (p) => {
      const { w, h } = pieceBounds(p.pieceId, p.rot);
      return {
        x: p.col * stride + (w * cell + (w - 1) * gap) * 0.5,
        y: p.row * stride + (h * cell + (h - 1) * gap) * 0.5,
      };
    };
    const gw = GRID_COLS * cell + (GRID_COLS - 1) * gap;
    const gh = GRID_ROWS * cell + (GRID_ROWS - 1) * gap;
    let linesSvg = '';
    for (const lk of syn.links) {
      const a = pieceMap.get(lk.from);
      const b = pieceMap.get(lk.to);
      if (!a || !b) continue;
      const ca = centerOf(a);
      const cb = centerOf(b);
      linesSvg += `<line x1="${ca.x.toFixed(1)}" y1="${ca.y.toFixed(1)}" x2="${cb.x.toFixed(1)}" y2="${cb.y.toFixed(1)}" stroke="#14202b" stroke-width="4.5" stroke-linecap="round" opacity=".6"/>`;
      linesSvg += `<line x1="${ca.x.toFixed(1)}" y1="${ca.y.toFixed(1)}" x2="${cb.x.toFixed(1)}" y2="${cb.y.toFixed(1)}" stroke="${lk.color}" stroke-width="2.2" stroke-dasharray="4 4" stroke-linecap="round"/>`;
    }
    const synSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    synSvg.setAttribute('class', 'ars-syn-svg');
    synSvg.setAttribute('viewBox', `0 0 ${gw.toFixed(1)} ${gh.toFixed(1)}`);
    synSvg.setAttribute('aria-hidden', 'true');
    synSvg.innerHTML = linesSvg;
    gridEl.appendChild(synSvg);
  }
}

function renderInspector() {
  const run = state.run;
  const el = $('#ars-inspector');
  const sel = getSelectedPieceInfo();

  if (!sel) {
    el.innerHTML = `<span class="ars-insp-empty">${run.level.hint}</span>`;
    return;
  }

  const def = PIECES[sel.pieceId];
  const tInfo = TIERS[sel.tier];
  const mult = tInfo.mult;

  let synText = '';
  if (sel.source === 'grid') {
    const syn = computeGridSynergies(run.grid).byUid.get(sel.uid);
    const parts = [];
    if (syn?.dmgMult > 1.01) parts.push(`+${Math.round((syn.dmgMult - 1) * 100)}% Poder`);
    if (syn?.spdMult > 1.01) parts.push(`+${Math.round((syn.spdMult - 1) * 100)}% Vel.`);
    if (syn?.armorMult > 1.01) parts.push(`+${Math.round((syn.armorMult - 1) * 100)}% Armad.`);
    if (syn?.critBonus > 0) parts.push(`+${Math.round(syn.critBonus * 100)}% Crít.`);
    if (parts.length > 0) synText = ` · Sinergias: ${parts.join(', ')}`;
  }

  let statLine = '';
  if (def.dmg) statLine += `Dano ${Math.round(def.dmg * mult)} `;
  if (def.armor) statLine += `Escudo +${Math.round(def.armor * mult)} `;
  if (def.bonusGold) statLine += `+${Math.round(def.bonusGold * Math.pow(1.75, sel.tier - 1))} Ouro/horda `;
  statLine += `· ${def.shapeLabel}${synText}`;

  let btns = '';
  if (run.phase === 'prep') {
    if (def.rotCount > 1) {
      btns += `<button type="button" class="btn ghost small" data-act="rotate-active">↻ Girar</button>`;
    }
    const mergePartner = hasMergePartnerFor(sel);
    if (mergePartner) {
      btns += `<button type="button" class="btn yellow small" data-act="quick-merge">⚡ Fundir</button>`;
    }
    if (sel.source === 'grid') {
      btns += `<button type="button" class="btn ghost small" data-act="to-tray">Reserva</button>`;
      btns += `<button type="button" class="btn red small" data-act="sell-active">+${pieceSellValue(sel.piece)} Ouro</button>`;
    } else if (sel.source === 'tray') {
      btns += `<button type="button" class="btn ghost small" data-act="to-grid">Grade</button>`;
      btns += `<button type="button" class="btn red small" data-act="sell-active">+${pieceSellValue(sel.piece)} Ouro</button>`;
    } else if (sel.source === 'shop') {
      btns += `<button type="button" class="btn yellow small" data-act="buy-auto">Comprar (${sel.offer.cost})</button>`;
    }
  }

  el.innerHTML =
    `<div class="ars-insp-info">` +
    `<div class="ars-insp-title">${def.name} <span class="ars-insp-tier" style="color:${tInfo.color};border-color:${tInfo.border}">Nv.${sel.tier} ${tInfo.name}</span></div>` +
    `<div class="ars-insp-desc">${statLine} — ${def.summary}</div>` +
    `</div>` +
    `<div class="ars-insp-btns">${btns}</div>`;
}

function renderTray() {
  const run = state.run;
  const trayEl = $('#ars-tray');
  const selInfo = getSelectedPieceInfo();

  let html = '';
  for (let i = 0; i < TRAY_SLOTS; i++) {
    const p = run.tray[i];
    if (!p) {
      html += `<div class="ars-tray-slot" data-tray="${i}" title="Espaço de reserva"></div>`;
      continue;
    }
    const tInfo = TIERS[p.tier];
    const isSel = selInfo?.source === 'tray' && selInfo.trayIdx === i;
    const isMergeHint =
      selInfo &&
      selInfo.pieceId === p.pieceId &&
      selInfo.tier === p.tier &&
      selInfo.tier < MAX_TIER &&
      !(selInfo.source === 'tray' && selInfo.trayIdx === i);

    html +=
      `<div class="ars-tray-slot filled${isSel ? ' selected' : ''}${isMergeHint ? ' merge-hint' : ''}" data-tray="${i}" ` +
      `style="--tier-border:${tInfo.border};--tier-bg:${tInfo.bg}" title="${PIECES[p.pieceId].name} Nv.${p.tier}">` +
      pieceSvg(p.pieceId, p.tier, 0) +
      `<span class="ars-tier-badge" style="color:${tInfo.color};border-color:${tInfo.border}">Nv.${p.tier}</span>` +
      `</div>`;
  }
  trayEl.innerHTML = html;
}

function renderShop() {
  const run = state.run;
  const shopEl = $('#ars-shop');
  const selInfo = getSelectedPieceInfo();

  let html = '';
  for (let i = 0; i < SHOP_SLOTS; i++) {
    const o = run.shop[i];
    if (!o) {
      html += `<div class="ars-shop-card empty" data-shop="${i}"><span>Vendido</span></div>`;
      continue;
    }
    const def = PIECES[o.pieceId];
    const tInfo = TIERS[o.tier];
    const poor = run.gold < o.cost || run.phase !== 'prep';
    const canMerge = hasMatchingPiece(run, o.pieceId, o.tier);
    const isSel = selInfo?.source === 'shop' && selInfo.slotIdx === i;

    const cls = ['ars-shop-card'];
    if (poor) cls.push('poor');
    if (canMerge) cls.push('can-merge');
    if (isSel) cls.push('selected');

    const mergeTag = canMerge ? `<span class="ars-merge-pill">⚡ FUNDE!</span>` : '';
    const tierTag = o.tier > 1 ? ` Nv.${o.tier}★` : '';

    html +=
      `<div class="${cls.join(' ')}" data-shop="${i}">` +
      mergeTag +
      `<div class="ars-shop-top">${shapeMiniSvg(o.pieceId, o.tier)}<button type="button" class="ars-lock-btn${o.locked ? ' on' : ''}" data-lock="${i}" title="Travar oferta">${o.locked ? '🔒' : '🔓'}</button></div>` +
      `<div class="ars-shop-art">${pieceSvg(o.pieceId, o.tier, 0)}</div>` +
      `<div class="ars-shop-name">${def.name}${tierTag}</div>` +
      `<div class="ars-shop-role">${def.role}</div>` +
      `<div class="ars-shop-price">${o.cost} Ouro</div>` +
      `</div>`;
  }
  shopEl.innerHTML = html;
}

function renderAll() {
  renderHeaderAndHud();
  renderGrid();
  renderInspector();
  renderTray();
  renderShop();
}

function updateCombatVisuals() {
  const run = state.run;
  if (!run.combat) return;
  for (const p of run.grid.pieces) {
    const dom = state.pieceDomCache.get(p.uid);
    if (!dom) continue;
    dom.el.classList.toggle('flash', p.flash > 0.14);
    if (dom.cdEl && p.cdTotal > 0) {
      const pct = clamp(1 - p.cdLeft / p.cdTotal, 0, 1) * 100;
      dom.cdEl.style.width = `${pct.toFixed(1)}%`;
    }
  }
  updateWallMeter(run);
  $('#ars-gold-pill').innerHTML = `${hudIco('coin')}<b>${run.gold}</b> Ouro`;

  const remSpawns = run.combat.spawners.reduce((s, sp) => s + sp.rem, 0);
  const totalLeft = remSpawns + run.combat.enemies.length;
  const total = Math.max(1, run.combat.totalEnemies || totalLeft);
  const pct = clamp(((total - totalLeft) / total) * 100, 0, 100);
  $('#ars-combat-status').textContent =
    `Horda ${run.waveIdx + 1}/${run.level.waves.length} · ${totalLeft} inimigos restantes`;
  $('#ars-wave-fill').style.width = `${pct.toFixed(1)}%`;
}

// ---------- Helpers de Sinergia e Fusão ----------

function hasMergePartnerFor(sel) {
  const run = state.run;
  if (!sel || sel.tier >= MAX_TIER) return null;
  for (const p of run.grid.pieces) {
    if (sel.source === 'grid' && p.uid === sel.uid) continue;
    if (p.pieceId === sel.pieceId && p.tier === sel.tier) return { target: 'grid', piece: p };
  }
  for (let i = 0; i < TRAY_SLOTS; i++) {
    if (sel.source === 'tray' && i === sel.trayIdx) continue;
    const tp = run.tray[i];
    if (tp && tp.pieceId === sel.pieceId && tp.tier === sel.tier) return { target: 'tray', trayIdx: i, piece: tp };
  }
  return null;
}

function previewSynergyCells(pieceId, col, row, rot, ignoreUid) {
  const synSet = new Set();
  const run = state.run;
  const occ = buildOccupancyMap(run.grid, ignoreUid);
  for (const [c, r] of pieceCellsAt(pieceId, col, row, rot)) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        const other = occ[nr][nc];
        if (!other) continue;
        const hitsBuff =
          pieceId === 'tome' ||
          pieceId === 'lantern' ||
          other.pieceId === 'tome' ||
          other.pieceId === 'lantern' ||
          (pieceId === 'shield' && (other.pieceId === 'shield' || other.pieceId === 'sword' || other.pieceId === 'axe')) ||
          (pieceId === 'sword' && other.pieceId === 'shield') ||
          (pieceId === 'dagger' && (other.pieceId === 'voodoo' || other.pieceId === 'witch'));
        if (hitsBuff) {
          for (const [oc, or] of pieceCellsAt(other.pieceId, other.col, other.row, other.rot)) {
            synSet.add(`${oc},${or}`);
          }
        }
      }
    }
  }
  return synSet;
}

function doMergeFx(col, row) {
  sfx.gateGood();
  const gridEl = $('#ars-grid');
  const rect = gridEl.getBoundingClientRect();
  const { cell, gap } = gridMetrics();
  burst(
    {
      x: rect.left + (col + 0.5) * (cell + gap),
      y: rect.top + (row + 0.5) * (cell + gap),
    },
    '#f7b733',
    12
  );
  toast('Peças somadas! Nível aumentado!');
}

function executeQuickMerge() {
  const sel = getSelectedPieceInfo();
  const run = state.run;
  if (!sel || run.phase !== 'prep') return;
  const partner = hasMergePartnerFor(sel);
  if (!partner) return;

  if (sel.source === 'shop') {
    if (run.gold < sel.offer.cost) {
      sfx.err();
      toast('Ouro insuficiente!', 'err');
      return;
    }
    const res =
      partner.target === 'grid'
        ? buyShopToGrid(run, sel.slotIdx, partner.piece.col, partner.piece.row, partner.piece.rot)
        : buyShopToTray(run, sel.slotIdx, partner.trayIdx);
    if (res.ok) {
      doMergeFx(partner.piece.col || 2, partner.piece.row || 1);
      state.selected = partner.target === 'grid' ? { source: 'grid', uid: res.piece.uid, rot: res.piece.rot } : null;
    }
  } else if (sel.source === 'grid') {
    const res =
      partner.target === 'grid'
        ? moveGridPiece(run, sel.uid, partner.piece.col, partner.piece.row, partner.piece.rot)
        : moveGridToTray(run, sel.uid, partner.trayIdx);
    if (res.ok) {
      doMergeFx(partner.piece.col || 2, partner.piece.row || 1);
      state.selected = partner.target === 'grid' ? { source: 'grid', uid: res.piece.uid, rot: res.piece.rot } : null;
    }
  } else if (sel.source === 'tray') {
    const res =
      partner.target === 'grid'
        ? moveTrayToGrid(run, sel.trayIdx, partner.piece.col, partner.piece.row, partner.piece.rot)
        : moveTrayToTray(run, sel.trayIdx, partner.trayIdx);
    if (res.ok) {
      doMergeFx(partner.piece.col || 2, partner.piece.row || 1);
      state.selected = partner.target === 'grid' ? { source: 'grid', uid: res.piece.uid, rot: res.piece.rot } : null;
    }
  }
  renderAll();
}

// ---------- Loop de Combate ----------

function showEndOverlay(won) {
  const run = state.run;
  const ov = $('#ars-overlay');
  ov.classList.remove('hidden');

  const titleEl = $('#ars-res-title');
  const starsEl = $('#ars-res-stars');
  const subEl = $('#ars-res-sub');
  const nextBtn = $('#btn-res-next');

  if (won) {
    const prevBest = getLevelStars(run.level.id);
    if (run.stars > prevBest) {
      saved.stars[String(run.level.id)] = run.stars;
      saveProgress();
    }
    titleEl.textContent = run.level.id === 40 ? 'Quermesse Salva!' : 'Muralha Protegida!';
    titleEl.classList.remove('fail');
    starsEl.innerHTML = [1, 2, 3]
      .map((n) => `<span class="ars-result-star${n <= run.stars ? '' : ' off'}">★</span>`)
      .join('');
    const hpPct = Math.round((run.wallHp / run.wallMaxHp) * 100);
    subEl.textContent = `Sobreviveu às ${run.level.waves.length} hordas com ${hpPct}% da Muralha e ${run.stats.merges} fusões!`;
    nextBtn.textContent = run.level.id < LEVELS.length ? 'Próxima Fase →' : 'Jogar Fase 1';
    sfx.win();
    confetti(run.level.id % 5 === 0 ? 110 : 60);
  } else {
    titleEl.textContent = 'Muralha Derrubada!';
    titleEl.classList.add('fail');
    starsEl.innerHTML = [1, 2, 3].map(() => `<span class="ars-result-star off">★</span>`).join('');
    subEl.textContent = `Caiu na Horda ${run.waveIdx + 1}/${run.level.waves.length}. Tente somar mais peças ou reforçar Escudos e Gelo!`;
    nextBtn.textContent = 'Tentar de novo';
    sfx.boom();
    shake($('#ars-stage'), 0.8);
  }
  renderAll();
}

function startBattleLoop() {
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.lastTs = performance.now();

  const tick = (now) => {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - state.lastTs) / 1000));
    state.lastTs = now;
    state.animTime += rawDt;

    const run = state.run;
    if (run && run.phase === 'combat') {
      const simTotal = rawDt * state.speed;
      const steps = Math.max(1, Math.ceil(simTotal / 0.033));
      const subDt = simTotal / steps;
      for (let s = 0; s < steps && run.phase === 'combat'; s++) {
        stepCombat(run, subDt);
      }

      // Efeitos sonoros leves sincronizados ao combate
      if (run.combat && run.combat.events.length > 0) {
        const nowMs = performance.now();
        for (const ev of run.combat.events) {
          if (nowMs - state.lastSfxAt >= 120) {
            if (ev.type === 'attack') {
              state.lastSfxAt = nowMs;
              sfx.click();
            } else if (ev.type === 'kill') {
              state.lastSfxAt = nowMs;
              sfx.pop();
            } else if (ev.type === 'armorBreak') {
              state.lastSfxAt = nowMs;
              sfx.clash();
            } else if (ev.type === 'wallHit') {
              state.lastSfxAt = nowMs;
              sfx.beeHit(false);
            }
          }
        }
        run.combat.events.length = 0;
      }

      updateCombatVisuals();
      drawCanvas();

      if (run.phase === 'prep') {
        // Onda vencida -> volta para preparo!
        sfx.turn();
        toast(`Horda vencida! +${run.level.freeExpandsPerWave} espaços grátis na grade!`);
        renderAll();
        drawCanvas();
        state.rafId = 0;
        return;
      }
      if (run.phase === 'won' || run.phase === 'lost') {
        showEndOverlay(run.phase === 'won');
        state.rafId = 0;
        return;
      }

      state.rafId = requestAnimationFrame(tick);
    } else {
      state.rafId = 0;
    }
  };
  state.rafId = requestAnimationFrame(tick);
}

function launchWave() {
  const run = state.run;
  if (!run) return;
  if (run.phase === 'won' || run.phase === 'lost') {
    loadLevel(state.levelId);
    return;
  }
  if (run.phase !== 'prep') return;

  if (run.grid.pieces.length === 0) {
    toast('Coloque pelo menos uma peça na grade antes da horda!', 'err');
    sfx.err();
    return;
  }

  state.selected = null;
  state.drag = null;
  state.hoverPreview = null;
  startWave(run);
  sfx.whoosh();
  renderAll();
  drawCanvas();
  startBattleLoop();
}

// ---------- Interação de Grade, Reserva, Loja & Arraste ----------

function updateDragGhost(clientX, clientY, isTouch) {
  const d = state.drag;
  if (!d) return;
  const ghost = $('#ars-drag-ghost');
  const yOffset = isTouch ? -30 : 0;
  const { cell } = gridMetrics();
  const { w, h } = pieceBounds(d.pieceId, d.rot);
  const gw = w * cell;
  const gh = h * cell;

  ghost.classList.remove('hidden');
  ghost.style.width = `${gw}px`;
  ghost.style.height = `${gh}px`;
  ghost.style.left = `${clientX - gw * 0.5}px`;
  ghost.style.top = `${clientY + yOffset - gh * 0.5}px`;
  ghost.innerHTML = pieceSvg(d.pieceId, d.tier, d.rot, { w: gw, h: gh });
}

function updateHoverPreview(clientX, clientY, isTouch) {
  const d = state.drag;
  if (!d) return;
  const yOffset = isTouch ? -30 : 0;
  const anchor = pointToAnchor(clientX, clientY + yOffset, d.pieceId, d.rot);
  if (!anchor) {
    if (state.hoverPreview) {
      state.hoverPreview = null;
      renderGrid();
    }
    return;
  }

  const run = state.run;
  const ignoreUid = d.source === 'grid' ? d.uid : null;
  const mergeTarget = findMergeTarget(run.grid, d.pieceId, d.tier, anchor.col, anchor.row, d.rot, ignoreUid);

  let cells;
  let kind;
  let synCells = new Set();

  if (mergeTarget) {
    cells = pieceCellsAt(mergeTarget.pieceId, mergeTarget.col, mergeTarget.row, mergeTarget.rot);
    kind = 'merge';
  } else {
    cells = pieceCellsAt(d.pieceId, anchor.col, anchor.row, d.rot);
    const ok = canPlacePiece(run.grid, d.pieceId, anchor.col, anchor.row, d.rot, ignoreUid);
    kind = ok ? 'ok' : 'bad';
    if (ok) synCells = previewSynergyCells(d.pieceId, anchor.col, anchor.row, d.rot, ignoreUid);
  }

  const prev = state.hoverPreview;
  if (prev && prev.col === anchor.col && prev.row === anchor.row && prev.kind === kind && prev.rot === d.rot) {
    return;
  }
  state.hoverPreview = { col: anchor.col, row: anchor.row, rot: d.rot, cells, kind, synCells };
  renderGrid();
}

function clearDrag() {
  state.drag = null;
  state.hoverPreview = null;
  $('#ars-drag-ghost').classList.add('hidden');
}

function handleGridClick(col, row) {
  const run = state.run;
  if (run.phase !== 'prep') return;

  // 1) Clicou em célula travada expansível?
  if (!run.grid.open[row][col]) {
    if (isAdjacentToOpen(run.grid, col, row)) {
      const res = expandGridCell(run, col, row);
      if (res.ok) {
        sfx.pop();
        renderAll();
      } else {
        sfx.err();
        toast(`Precisa de ${EXPAND_COST} ouro para expandir!`, 'err');
      }
    }
    return;
  }

  const occ = buildOccupancyMap(run.grid);
  const hitPiece = occ[row][col];
  const sel = getSelectedPieceInfo();

  // 2) Se há peça selecionada e clicou em peça igual -> Fundir!
  if (sel && hitPiece && sel.pieceId === hitPiece.pieceId && sel.tier === hitPiece.tier && hitPiece.tier < MAX_TIER) {
    if (sel.source === 'grid' && sel.uid === hitPiece.uid) {
      state.selected = null;
      renderAll();
      return;
    }
    let res;
    if (sel.source === 'shop') {
      if (run.gold < sel.offer.cost) {
        sfx.err();
        toast('Ouro insuficiente!', 'err');
        return;
      }
      res = buyShopToGrid(run, sel.slotIdx, hitPiece.col, hitPiece.row, hitPiece.rot);
    } else if (sel.source === 'grid') {
      res = moveGridPiece(run, sel.uid, hitPiece.col, hitPiece.row, hitPiece.rot);
    } else {
      res = moveTrayToGrid(run, sel.trayIdx, hitPiece.col, hitPiece.row, hitPiece.rot);
    }
    if (res.ok) {
      doMergeFx(hitPiece.col, hitPiece.row);
      state.selected = { source: 'grid', uid: res.piece.uid, rot: res.piece.rot };
      renderAll();
      return;
    }
  }

  // 3) Se clicou numa peça da grade -> seleciona
  if (hitPiece) {
    sfx.click();
    state.selected = { source: 'grid', uid: hitPiece.uid, rot: hitPiece.rot };
    renderAll();
    return;
  }

  // 4) Clicou numa célula aberta vazia enquanto tinha algo selecionado -> posiciona lá
  if (sel) {
    const rot = sel.rot || 0;
    let res;
    if (sel.source === 'shop') {
      if (run.gold < sel.offer.cost) {
        sfx.err();
        toast('Ouro insuficiente!', 'err');
        return;
      }
      res = buyShopToGrid(run, sel.slotIdx, col, row, rot);
    } else if (sel.source === 'tray') {
      res = moveTrayToGrid(run, sel.trayIdx, col, row, rot);
    } else if (sel.source === 'grid') {
      res = moveGridPiece(run, sel.uid, col, row, rot);
    }
    if (res && res.ok) {
      sfx.build();
      state.selected = { source: 'grid', uid: res.piece.uid, rot: res.piece.rot };
      renderAll();
    } else {
      sfx.err();
      toast('Não coube aqui — tente girar (R) ou liberar espaço.', 'err');
    }
  }
}

function handleDrop(clientX, clientY, isTouch) {
  const d = state.drag;
  if (!d) return;
  const run = state.run;
  const yOffset = isTouch ? -30 : 0;

  // Verifica se soltou sobre a Reserva
  const elUnder = document.elementFromPoint(clientX, clientY);
  const trayEl = elUnder?.closest?.('[data-tray]');
  if (trayEl) {
    const trayIdx = Number(trayEl.dataset.tray);
    let res = { ok: false };
    if (d.source === 'shop') res = buyShopToTray(run, d.slotIdx, trayIdx);
    else if (d.source === 'grid') res = moveGridToTray(run, d.uid, trayIdx);
    else if (d.source === 'tray') res = moveTrayToTray(run, d.trayIdx, trayIdx);

    if (res.ok) {
      if (res.merged) doMergeFx(2, 2);
      else sfx.build();
      state.selected = null;
    } else if (res.reason === 'no-gold') {
      sfx.err();
      toast('Ouro insuficiente!', 'err');
    }
    clearDrag();
    renderAll();
    return;
  }

  // Verifica se soltou sobre a Grade
  const anchor = pointToAnchor(clientX, clientY + yOffset, d.pieceId, d.rot);
  if (anchor) {
    let res = { ok: false };
    if (d.source === 'shop') res = buyShopToGrid(run, d.slotIdx, anchor.col, anchor.row, d.rot);
    else if (d.source === 'grid') res = moveGridPiece(run, d.uid, anchor.col, anchor.row, d.rot);
    else if (d.source === 'tray') res = moveTrayToGrid(run, d.trayIdx, anchor.col, anchor.row, d.rot);

    if (res.ok) {
      if (res.merged) doMergeFx(res.piece.col, res.piece.row);
      else sfx.build();
      state.selected = { source: 'grid', uid: res.piece.uid, rot: res.piece.rot };
    } else if (res.reason === 'no-gold') {
      sfx.err();
      toast('Ouro insuficiente!', 'err');
    } else {
      sfx.err();
    }
  }
  clearDrag();
  renderAll();
}

// Eventos de ponteiro unificados para Grade, Reserva e Loja
document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.modal || !state.run) return;
  const run = state.run;
  if (run.phase !== 'prep') return;

  // Ignora clique direto no cadeado da loja
  if (e.target.closest('[data-lock]')) return;

  const gridEl = e.target.closest('#ars-grid');
  if (gridEl) {
    const cellPt = pointToCell(e.clientX, e.clientY);
    if (!cellPt) return;
    const occ = buildOccupancyMap(run.grid);
    const hit = occ[cellPt.row][cellPt.col];
    if (hit) {
      state.drag = {
        source: 'grid',
        uid: hit.uid,
        pieceId: hit.pieceId,
        tier: hit.tier,
        rot: hit.rot,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        col: cellPt.col,
        row: cellPt.row,
        isTouch: e.pointerType === 'touch',
      };
    } else {
      handleGridClick(cellPt.col, cellPt.row);
    }
    return;
  }

  const trayEl = e.target.closest('[data-tray]');
  if (trayEl) {
    const idx = Number(trayEl.dataset.tray);
    const tp = run.tray[idx];
    if (tp) {
      state.drag = {
        source: 'tray',
        trayIdx: idx,
        pieceId: tp.pieceId,
        tier: tp.tier,
        rot: 0,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
        isTouch: e.pointerType === 'touch',
      };
    } else {
      const sel = getSelectedPieceInfo();
      if (sel?.source === 'grid') {
        const res = moveGridToTray(run, sel.uid, idx);
        if (res.ok) {
          sfx.build();
          state.selected = { source: 'tray', trayIdx: idx, rot: 0 };
          renderAll();
        }
      } else if (sel?.source === 'shop') {
        const res = buyShopToTray(run, sel.slotIdx, idx);
        if (res.ok) {
          sfx.build();
          state.selected = { source: 'tray', trayIdx: idx, rot: 0 };
          renderAll();
        } else if (res.reason === 'no-gold') {
          sfx.err();
          toast('Ouro insuficiente!', 'err');
        }
      }
    }
    return;
  }

  const shopEl = e.target.closest('[data-shop]');
  if (shopEl) {
    const idx = Number(shopEl.dataset.shop);
    const offer = run.shop[idx];
    if (!offer) return;
    if (run.gold < offer.cost) {
      state.selected = { source: 'shop', slotIdx: idx, rot: 0 };
      sfx.click();
      renderAll();
      return;
    }
    state.drag = {
      source: 'shop',
      slotIdx: idx,
      pieceId: offer.pieceId,
      tier: offer.tier,
      rot: 0,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      isTouch: e.pointerType === 'touch',
    };
  }
});

document.addEventListener('pointermove', (e) => {
  const d = state.drag;
  if (!d) return;
  d.lastX = e.clientX;
  d.lastY = e.clientY;
  if (!d.active) {
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
    d.active = true;
    state.selected = null;
  }
  updateDragGhost(e.clientX, e.clientY, d.isTouch);
  updateHoverPreview(e.clientX, e.clientY, d.isTouch);
});

document.addEventListener('pointerup', (e) => {
  const d = state.drag;
  if (!d) return;
  if (d.active) {
    handleDrop(e.clientX, e.clientY, d.isTouch);
    return;
  }
  // Foi um toque curto (sem arrastar)
  clearDrag();
  if (d.source === 'grid') {
    handleGridClick(d.col, d.row);
  } else if (d.source === 'tray') {
    const sel = getSelectedPieceInfo();
    const tp = state.run.tray[d.trayIdx];
    if (sel && tp && sel.pieceId === tp.pieceId && sel.tier === tp.tier && tp.tier < MAX_TIER) {
      if (sel.source === 'tray' && sel.trayIdx === d.trayIdx) {
        state.selected = null;
      } else if (sel.source === 'shop') {
        const res = buyShopToTray(state.run, sel.slotIdx, d.trayIdx);
        if (res.ok) {
          doMergeFx(2, 1);
          state.selected = { source: 'tray', trayIdx: d.trayIdx, rot: 0 };
        }
      } else if (sel.source === 'grid') {
        const res = moveGridToTray(state.run, sel.uid, d.trayIdx);
        if (res.ok) {
          doMergeFx(2, 1);
          state.selected = { source: 'tray', trayIdx: d.trayIdx, rot: 0 };
        }
      } else {
        const res = moveTrayToTray(state.run, sel.trayIdx, d.trayIdx);
        if (res.ok) {
          doMergeFx(2, 1);
          state.selected = { source: 'tray', trayIdx: d.trayIdx, rot: 0 };
        }
      }
    } else {
      sfx.click();
      state.selected = { source: 'tray', trayIdx: d.trayIdx, rot: 0 };
    }
    renderAll();
  } else if (d.source === 'shop') {
    sfx.click();
    state.selected = { source: 'shop', slotIdx: d.slotIdx, rot: 0 };
    renderAll();
  }
});

document.addEventListener('pointercancel', () => {
  if (state.drag) {
    clearDrag();
    renderAll();
  }
});

document.addEventListener('contextmenu', (e) => {
  if (state.drag?.active) {
    e.preventDefault();
    rotateActivePiece();
  }
});

function rotateActivePiece() {
  const run = state.run;
  if (!run || run.phase !== 'prep') return;
  if (state.drag) {
    const def = PIECES[state.drag.pieceId];
    if (def.rotCount > 1) {
      state.drag.rot = (state.drag.rot + 1) % def.rotCount;
      sfx.click();
      if (state.drag.active && state.drag.lastX !== undefined) {
        updateDragGhost(state.drag.lastX, state.drag.lastY, state.drag.isTouch);
        updateHoverPreview(state.drag.lastX, state.drag.lastY, state.drag.isTouch);
      }
    }
    return;
  }
  const sel = getSelectedPieceInfo();
  if (!sel) return;
  const def = PIECES[sel.pieceId];
  if (def.rotCount <= 1) return;
  if (sel.source === 'grid') {
    const res = rotateGridPiece(run, sel.uid);
    if (res.ok) {
      state.selected.rot = res.piece.rot;
      sfx.click();
      renderAll();
    } else {
      sfx.err();
      toast('Sem espaço ao lado para girar — mova para um canto livre.', 'err');
    }
  } else {
    state.selected.rot = ((state.selected.rot || 0) + 1) % def.rotCount;
    sfx.click();
    renderInspector();
  }
}

// ---------- Modais (Mapa 40 Fases, Regras, Catálogo das 10 Peças, Créditos) ----------

function modal(kind, body) {
  return `<div class="modal" data-kind="${kind}" role="dialog" aria-modal="true">${body}</div>`;
}

function mapModal() {
  const chaptersHtml = CHAPTERS.map((ch) => {
    const tiles = LEVELS.filter((l) => l.chapter === ch.id)
      .map((l) => {
        const st = getLevelStars(l.id);
        const cur = l.id === state.levelId ? ' current' : '';
        const done = st > 0 ? ' done' : '';
        const starsHtml = [1, 2, 3].map((n) => `<span class="${n <= st ? 'on' : 'off'}">★</span>`).join('');
        return `<button type="button" class="ars-lvl-tile${cur}${done}" data-act="pick-level" data-level="${l.id}" title="${l.title}"><span>${l.id}</span><span class="ars-tile-stars">${starsHtml}</span></button>`;
      })
      .join('');
    return `<div><h3 class="ars-chap-title">${ch.name}</h3><div class="ars-map-grid">${tiles}</div></div>`;
  }).join('');

  return modal(
    'rules',
    `<h2>Fases (${totalStars()} / ${LEVELS.length * 3} ★)</h2>
     <p class="hint">Defenda a Muralha através de 40 fases em 4 capítulos cada vez mais intensos.</p>
     <div class="ars-chapters">${chaptersHtml}</div>
     <div class="row"><button type="button" class="btn yellow" data-act="close">Fechar</button></div>`
  );
}

function rulesModal() {
  const tab = state.rulesTab;
  const tabs = `<div class="modal-tabs" role="tablist">
    <button class="tab-btn ${tab === 'rules' ? 'on' : ''}" data-act="rules-tab" data-tab="rules" role="tab" aria-selected="${tab === 'rules'}">${ico('help', 's')}Como joga</button>
    <button class="tab-btn ${tab === 'pieces' ? 'on' : ''}" data-act="rules-tab" data-tab="pieces" role="tab" aria-selected="${tab === 'pieces'}">${ico('bolt', 's')}10 Peças</button>
    <button class="tab-btn ${tab === 'about' ? 'on' : ''}" data-act="rules-tab" data-tab="about" role="tab" aria-selected="${tab === 'about'}">${ico('info', 's')}Sobre</button>
  </div>`;

  if (tab === 'pieces') {
    const cards = PIECE_IDS.map((id) => {
      const def = PIECES[id];
      return (
        `<div class="ars-cat-card">` +
        `<div class="ars-cat-art">${pieceSvg(id, 1, 0)}</div>` +
        `<div class="ars-cat-copy"><b>${def.name} <small>${def.shapeLabel} · ${def.cost} Ouro</small></b><span>${def.summary}</span></div>` +
        `</div>`
      );
    }).join('');
    return modal(
      'rules',
      `${tabs}
       <h2>Arsenal da Quermesse (10 Peças)</h2>
       <div class="ars-catalog-grid">${cards}</div>
       <div class="row"><button type="button" class="btn yellow" data-act="close">Fechar</button></div>`
    );
  }

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
             <p>Criador da quermesse de mini-jogos do <b>Catapulta Online</b> — estratégia, lógica e ação direto no navegador.</p>
           </div>
         </div>
         <div class="about-hero">
           <div class="about-av">${avatar(4)}</div>
           <div class="about-copy">
             <span class="about-kicker">${ico('crown', 's')}40 Fases Verificadas</span>
             <p>Todas as 40 fases foram balanceadas e testadas em simulação determinística — desde os Diabretes iniciais até o Colosso da Fase 40!</p>
           </div>
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
           <b>Objetivo: sobreviver a todas as hordas montando e somando peças na grade!</b>
           <span>Cada peça ocupa <b>1, 2 ou 3 espaços</b> (inclusive em <b>L</b>!). Posicione com inteligência e funda peças iguais para evoluir até <b>Nv.5 Mítico</b>!</span>
         </div>
       </div>

       <h3 class="rules-sec">1. Comprar, Somar e Posicionar</h3>
       <div class="rules-steps">
         <div class="step-card">
           <span class="step-num">1</span>
           ${ico('hand', 'l')}
           <b>Arraste ou Toque</b>
           <small>Arraste peças da <b>Loja</b> ou <b>Reserva</b> para a grade. Aperte <b>R</b> ou <b>↻ Girar</b> para rodar.</small>
         </div>
         <div class="step-card">
           <span class="step-num">2</span>
           ${ico('star', 'l')}
           <b>Some Peças Iguais</b>
           <small>Solte uma peça sobre outra igual do mesmo nível para fundi-las: <b>dobro+ de poder</b> na metade do espaço!</small>
         </div>
         <div class="step-card">
           <span class="step-num">3</span>
           ${ico('bolt', 'l')}
           <b>Sinergias &amp; Expansão</b>
           <small>Encoste armas no <b>Tomo</b> (+Poder) e <b>Lampião</b> (+Vel.). Clique nas casas tracejadas para abrir mais espaço!</small>
         </div>
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

// ---------- Decoração & Eventos Globais ----------

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
    svg += `<g class="amb-float" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${cx},${cy}) scale(${s})"><path d="M0-8 L6 0 L0 8 L-6 0 Z" fill="${col}" opacity=".24"/></g></g>`;
  });
  svg += '</svg>';
  el.innerHTML = svg;
}

document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);
$('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
$('#btn-rules').innerHTML = ico('help');
$('#btn-bottom-rules').innerHTML = `${ico('help', 's')}Como joga &amp; Peças`;
$('#btn-bottom-about').innerHTML = `${ico('info', 's')}Sobre e créditos`;

document.addEventListener('click', (e) => {
  if (e.target === $('#modal-root') && state.modal) {
    state.modal = null;
    sfx.click();
    renderModal();
    return;
  }

  const lockBtn = e.target.closest('[data-lock]');
  if (lockBtn) {
    const idx = Number(lockBtn.dataset.lock);
    toggleShopLock(state.run, idx);
    sfx.click();
    renderShop();
    return;
  }

  const actBtn = e.target.closest('[data-act]');
  if (!actBtn || actBtn.disabled) return;
  const act = actBtn.dataset.act;
  const run = state.run;

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
  } else if (act === 'fight') {
    launchWave();
  } else if (act === 'set-speed') {
    state.speed = clamp(Number(actBtn.dataset.spd) || 1, 1, 3);
    sfx.click();
    renderHeaderAndHud();
  } else if (act === 'retry') {
    sfx.click();
    loadLevel(state.levelId);
  } else if (act === 'advance') {
    sfx.click();
    if (run.phase === 'won') loadLevel(state.levelId < LEVELS.length ? state.levelId + 1 : 1);
    else loadLevel(state.levelId);
  } else if (act === 'reroll') {
    const res = rerollShop(run);
    if (res.ok) {
      sfx.deal();
      if (state.selected?.source === 'shop') state.selected = null;
      renderAll();
    } else {
      sfx.err();
    }
  } else if (act === 'rotate-active') {
    rotateActivePiece();
  } else if (act === 'quick-merge') {
    executeQuickMerge();
  } else if (act === 'buy-auto') {
    const sel = getSelectedPieceInfo();
    if (sel?.source === 'shop') {
      if (run.gold < sel.offer.cost) {
        sfx.err();
        toast('Ouro insuficiente!', 'err');
        return;
      }
      const pos = findFirstValidPlacement(run.grid, sel.pieceId, sel.rot);
      if (pos) {
        const res = buyShopToGrid(run, sel.slotIdx, pos.col, pos.row, pos.rot);
        if (res.ok) {
          sfx.build();
          state.selected = { source: 'grid', uid: res.piece.uid, rot: res.piece.rot };
          renderAll();
          return;
        }
      }
      const resTray = buyShopToTray(run, sel.slotIdx);
      if (resTray.ok) {
        sfx.build();
        state.selected = { source: 'tray', trayIdx: resTray.trayIdx, rot: 0 };
        renderAll();
      } else {
        sfx.err();
        toast('Sem espaço na grade nem na reserva!', 'err');
      }
    }
  } else if (act === 'to-tray') {
    const sel = getSelectedPieceInfo();
    if (sel?.source === 'grid') {
      const res = moveGridToTray(run, sel.uid);
      if (res.ok) {
        sfx.build();
        state.selected = { source: 'tray', trayIdx: res.trayIdx, rot: 0 };
        renderAll();
      } else {
        sfx.err();
        toast('Reserva cheia!', 'err');
      }
    }
  } else if (act === 'to-grid') {
    const sel = getSelectedPieceInfo();
    if (sel?.source === 'tray') {
      const pos = findFirstValidPlacement(run.grid, sel.pieceId, sel.rot);
      if (pos) {
        const res = moveTrayToGrid(run, sel.trayIdx, pos.col, pos.row, pos.rot);
        if (res.ok) {
          sfx.build();
          state.selected = { source: 'grid', uid: res.piece.uid, rot: res.piece.rot };
          renderAll();
        }
      } else {
        sfx.err();
        toast('Sem espaço livre na grade!', 'err');
      }
    }
  } else if (act === 'sell-active') {
    const sel = getSelectedPieceInfo();
    if (sel && (sel.source === 'grid' || sel.source === 'tray')) {
      const res = sellPiece(run, sel.source, sel.source === 'grid' ? sel.uid : sel.trayIdx);
      if (res.ok) {
        sfx.gain(0);
        toast(`Vendido por +${res.gold} Ouro!`);
        state.selected = null;
        renderAll();
      }
    }
  } else if (act === 'mute') {
    setMuted(!isMuted());
    $('#btn-mute').innerHTML = ico(isMuted() ? 'mute' : 'sound');
    sfx.click();
  } else if (act === 'rules') {
    sfx.click();
    state.rulesTab = 'rules';
    state.modal = state.modal === 'rules' ? null : 'rules';
    renderModal();
  } else if (act === 'about') {
    sfx.click();
    state.rulesTab = 'about';
    state.modal = 'rules';
    renderModal();
  } else if (act === 'rules-tab') {
    sfx.click();
    state.rulesTab = actBtn.dataset.tab;
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
    if (state.drag || state.selected) {
      e.preventDefault();
      rotateActivePiece();
    } else {
      e.preventDefault();
      sfx.click();
      loadLevel(state.levelId);
    }
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (state.run?.phase === 'prep') {
      e.preventDefault();
      launchWave();
    }
  }
});

window.addEventListener('resize', () => {
  if (state.run) renderGrid();
});

loadLevel(state.levelId);
