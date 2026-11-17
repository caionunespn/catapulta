import { COLORS, avatar, ico, installSprite, SHAPES, BOULDER } from './art.js';
import { sfx } from './fx.js';

const params = new URLSearchParams(location.search);
if (params.has('sala')) {
  location.replace('/catapulta' + location.search);
}

installSprite();

const $ = (s) => document.querySelector(s);

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
    [8, 78, 1.1, 0],
    [16, 44, 0.85, 1],
    [24, 84, 1.25, 2],
    [35, 28, 0.75, 3],
    [48, 88, 1.0, 4],
    [62, 32, 0.9, 0],
    [74, 82, 1.2, 1],
    [84, 52, 0.8, 2],
    [92, 76, 1.15, 3],
    [12, 22, 0.7, 4],
    [88, 24, 0.95, 0],
    [54, 18, 0.8, 2],
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

function hexPts(cx, cy, r) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}

function buildCatapultaScene() {
  const el = $('#booth-scene');
  if (!el) return;

  const R = 36;
  const Ri = 30.5;
  const dx = +(Math.sqrt(3) * R).toFixed(1);
  const h1 = { x: -dx, y: 4 };
  const h2 = { x: 0, y: 4 };
  const h3 = { x: dx, y: 4 };

  const token = (cx, cy, num, hot = false) => {
    const k = 6 - Math.abs(7 - num);
    let dots = '';
    for (let i = 0; i < k; i++) {
      dots += `<circle class="pip" cx="${((i - (k - 1) / 2) * 3.4).toFixed(1)}" cy="7" r="1.15"/>`;
    }
    return (
      `<g class="token${hot ? ' hot' : ''}" transform="translate(${cx},${cy})">` +
      `<circle class="tk-shadow" cy="1.8" r="12.5"/><circle class="tk" r="12.5"/><circle class="tk-ring" r="10.2"/>` +
      `<text y="2.5" style="font-size:11.5px">${num}</text>${dots}` +
      `</g>`
    );
  };

  const shore1 = hexPts(h1.x, h1.y, R);
  const shore2 = hexPts(h2.x, h2.y, R);
  const shore3 = hexPts(h3.x, h3.y, R);

  const edgeX = -31.2;
  const edgeR = 31.2;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g class="foam"><polygon points="${shore1}"/><polygon points="${shore2}"/><polygon points="${shore3}"/></g>` +
    `<g class="shore-out"><polygon points="${shore1}"/><polygon points="${shore2}"/><polygon points="${shore3}"/></g>` +
    `<g class="shore"><polygon points="${shore1}"/><polygon points="${shore2}"/><polygon points="${shore3}"/></g>` +
    `<g class="tile t-forest">` +
    `<polygon class="hex" points="${shore1}"/>` +
    `<polygon class="hex-in" points="${hexPts(h1.x, h1.y, Ri)}"/>` +
    `<use href="#i-tree" x="${h1.x - 10}" y="${h1.y - 25}" width="20" height="20"/>` +
    token(h1.x, h1.y + 10, 8, true) +
    `</g>` +
    `<g class="tile t-garden">` +
    `<polygon class="hex" points="${shore2}"/>` +
    `<polygon class="hex-in" points="${hexPts(h2.x, h2.y, Ri)}"/>` +
    `<use href="#i-pumpkin" x="${h2.x - 10}" y="${h2.y - 25}" width="20" height="20"/>` +
    token(h2.x, h2.y + 10, 6, true) +
    `</g>` +
    `<g class="tile t-quarry">` +
    `<polygon class="hex" points="${shore3}"/>` +
    `<polygon class="hex-in" points="${hexPts(h3.x, h3.y, Ri)}"/>` +
    `<use href="#i-stone" x="${h3.x - 10}" y="${h3.y - 25}" width="20" height="20"/>` +
    `<g transform="translate(${h3.x},${h3.y + 10}) scale(0.92)">${BOULDER}</g>` +
    `</g>` +
    `<g class="road">` +
    `<line class="road-out" x1="${edgeX}" y1="-14" x2="${edgeX}" y2="22"/>` +
    `<line class="road-in" x1="${edgeX}" y1="-14" x2="${edgeX}" y2="22" stroke="${COLORS[0].hex}"/>` +
    `<line class="road-dash" x1="${edgeX}" y1="-14" x2="${edgeX}" y2="22"/>` +
    `</g>` +
    `<g transform="translate(${edgeX},-16) scale(0.9)">${SHAPES.castle(COLORS[0])}</g>` +
    `<g transform="translate(${edgeR},24) scale(0.9)">${SHAPES.village(COLORS[1])}</g>` +
    `<path d="M-136 -6 Q -28 -68 ${h3.x} -6" fill="none" stroke="#f7b733" stroke-width="2.2" stroke-dasharray="5 5" stroke-linecap="round"/>` +
    `<circle cx="-38" cy="-42" r="5" fill="#9fb0c4" stroke="#14202b" stroke-width="1.8"/>` +
    `<g transform="translate(-144,4)"><circle r="24" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-c-knight" x="-16" y="-16" width="32" height="32"/></g>` +
    `<g transform="translate(144,4)"><circle r="24" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-crown" x="-16" y="-16" width="32" height="32"/></g>` +
    `</svg>`;

  el.innerHTML = svg;
}

function buildSolLuaScene() {
  const el = $('#booth-scene-sol-lua');
  if (!el) return;

  const cw = 36;
  const ch = 36;
  const ox = -2 * cw;
  const oy = -1.5 * ch;

  const cells = [
    [0, 0, 'sun', true],
    [0, 1, 'moon', false],
    [0, 2, 'sun', false],
    [0, 3, 'moon', true],
    [1, 0, 'moon', false],
    [1, 1, 'moon', true],
    [1, 2, 'sun', false],
    [1, 3, 'sun', false],
    [2, 0, 'sun', true],
    [2, 1, 'sun', false],
    [2, 2, 'moon', true],
    [2, 3, 'moon', false],
  ];

  let gridSvg = `<rect x="${ox - 3}" y="${oy - 3}" width="${cw * 4 + 6}" height="${ch * 3 + 6}" rx="9" fill="#14202b"/>`;
  for (const [r, c, kind, given] of cells) {
    const x = ox + c * cw;
    const y = oy + r * ch;
    const bg = given ? '#e2cfa6' : '#fbf3df';
    gridSvg += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="3.5" fill="${bg}"/>`;
    gridSvg += `<use href="#i-${kind}" x="${x + 8}" y="${y + 8}" width="20" height="20"/>`;
  }

  const signPill = (x, y, txt) =>
    `<g transform="translate(${x},${y})"><circle r="8.5" fill="#f6e8c8" stroke="#14202b" stroke-width="1.8"/><text y="3.2" text-anchor="middle" font-family="Bungee, sans-serif" font-size="10" fill="#14202b">${txt}</text></g>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g transform="translate(-134,0)"><circle r="26" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-sun" x="-18" y="-18" width="36" height="36"/></g>` +
    `<g transform="translate(134,0)"><circle r="26" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-moon" x="-18" y="-18" width="36" height="36"/></g>` +
    gridSvg +
    signPill(ox + cw * 2, oy + ch * 0.5, '×') +
    signPill(ox + cw * 1, oy + ch * 1.5, '=') +
    signPill(ox + cw * 3, oy + ch * 2.5, '=') +
    `</svg>`;

  el.innerHTML = svg;
}

function buildCoroasScene() {
  const el = $('#booth-scene-coroas');
  if (!el) return;

  const cs = 29;
  const ox = -2 * cs;
  const oy = -2 * cs;

  const regs = [
    [0, 0, 1, 1],
    [0, 2, 2, 1],
    [3, 2, 2, 1],
    [3, 3, 3, 1],
  ];
  const colors = ['#b8a4e3', '#f9c793', '#b8e0a8', '#9dc3f2'];
  const queens = new Set(['0,1', '1,3', '2,0', '3,2']);
  const crosses = new Set(['0,0', '0,2', '0,3', '1,1', '2,2', '3,0', '3,3']);

  let gridSvg = `<rect x="${ox - 3}" y="${oy - 3}" width="${cs * 4 + 6}" height="${cs * 4 + 6}" rx="9" fill="#14202b"/>`;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = ox + c * cs;
      const y = oy + r * cs;
      const reg = regs[r][c];
      gridSvg += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" fill="${colors[reg]}" stroke="rgba(20,32,43,0.22)" stroke-width="1"/>`;
      const key = `${r},${c}`;
      if (queens.has(key)) {
        gridSvg += `<use href="#i-crown" x="${x + 5.5}" y="${y + 5.5}" width="18" height="18"/>`;
      } else if (crosses.has(key)) {
        gridSvg += `<text x="${x + cs / 2}" y="${y + cs / 2 + 4}" text-anchor="middle" font-family="Barlow, sans-serif" font-weight="700" font-size="13" fill="rgba(20,32,43,0.65)">×</text>`;
      }
    }
  }

  let borders = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = ox + c * cs;
      const y = oy + r * cs;
      if (c + 1 < 4 && regs[r][c] !== regs[r][c + 1]) {
        borders += `<line x1="${x + cs}" y1="${y}" x2="${x + cs}" y2="${y + cs}" stroke="#14202b" stroke-width="2.4" stroke-linecap="square"/>`;
      }
      if (r + 1 < 4 && regs[r][c] !== regs[r + 1][c]) {
        borders += `<line x1="${x}" y1="${y + cs}" x2="${x + cs}" y2="${y + cs}" stroke="#14202b" stroke-width="2.4" stroke-linecap="square"/>`;
      }
    }
  }
  borders += `<rect x="${ox}" y="${oy}" width="${cs * 4}" height="${cs * 4}" fill="none" stroke="#14202b" stroke-width="2.6" rx="4"/>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g transform="translate(-128,0)"><circle r="26" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-crown" x="-17" y="-17" width="34" height="34"/></g>` +
    `<g transform="translate(128,0)"><circle r="26" fill="#132635" stroke="#14202b" stroke-width="2.2"/><use href="#i-medal" x="-17" y="-17" width="34" height="34"/></g>` +
    gridSvg +
    borders +
    `</svg>`;

  el.innerHTML = svg;
}

function buildSerpentinaScene() {
  const el = $('#booth-scene-serpentina');
  if (!el) return;

  const cs = 29;
  const ox = -2 * cs;
  const oy = -2 * cs;

  let gridSvg = `<rect x="${ox - 3}" y="${oy - 3}" width="${cs * 4 + 6}" height="${cs * 4 + 6}" rx="12" fill="#14202b"/>`;
  gridSvg += `<rect x="${ox}" y="${oy}" width="${cs * 4}" height="${cs * 4}" rx="10" fill="#fbf3df"/>`;

  for (let i = 1; i < 4; i++) {
    const x = ox + i * cs;
    const y = oy + i * cs;
    gridSvg += `<line x1="${x}" y1="${oy}" x2="${x}" y2="${oy + cs * 4}" stroke="rgba(20,32,43,0.18)" stroke-width="1"/>`;
    gridSvg += `<line x1="${ox}" y1="${y}" x2="${ox + cs * 4}" y2="${y}" stroke="rgba(20,32,43,0.18)" stroke-width="1"/>`;
  }

  const pt = (r, c) => `${(ox + (c + 0.5) * cs).toFixed(1)} ${(oy + (r + 0.5) * cs).toFixed(1)}`;
  const cells = [
    [1, 1],
    [0, 1],
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [2, 2],
    [2, 3],
    [1, 3],
    [0, 3],
    [0, 2],
  ];
  const d = cells.map(([r, c], idx) => `${idx === 0 ? 'M' : 'L'}${pt(r, c)}`).join(' ');

  const cx = ox + 2 * cs;
  const cy = oy + 2 * cs;
  const crossSvg =
    `<line x1="${cx - cs}" y1="${cy}" x2="${cx + cs}" y2="${cy}" stroke="#14202b" stroke-width="4" stroke-linecap="square"/>` +
    `<line x1="${cx}" y1="${cy - cs}" x2="${cx}" y2="${cy + cs}" stroke="#14202b" stroke-width="4" stroke-linecap="square"/>`;

  const node = (r, c, num, ringColor = '#f7b733') => {
    const x = ox + (c + 0.5) * cs;
    const y = oy + (r + 0.5) * cs;
    return (
      `<g transform="translate(${x},${y})">` +
      `<circle r="9.5" fill="#14202b" stroke="${ringColor}" stroke-width="2"/>` +
      `<text y="3.4" text-anchor="middle" font-family="Bungee, sans-serif" font-size="10" fill="#fff8ea">${num}</text>` +
      `</g>`
    );
  };

  const pillBadge = (x, y, num, ring) =>
    `<g transform="translate(${x},${y})"><circle r="13" fill="#14202b" stroke="${ring}" stroke-width="2.4"/><text y="4.5" text-anchor="middle" font-family="Bungee, sans-serif" font-size="13" fill="#fff8ea">${num}</text></g>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="hub-sp-grad" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="#1fae96"/>` +
    `<stop offset="55%" stop-color="#3d7be0"/>` +
    `<stop offset="100%" stop-color="#f7b733"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<line x1="-150" y1="0" x2="-114" y2="0" stroke="#1fae96" stroke-width="9" stroke-linecap="round"/>` +
    pillBadge(-150, 0, 1, '#3bab6a') +
    pillBadge(-114, 0, 2, '#f7b733') +
    `<line x1="114" y1="0" x2="150" y2="0" stroke="#3d7be0" stroke-width="9" stroke-linecap="round"/>` +
    pillBadge(114, 0, 3, '#f7b733') +
    pillBadge(150, 0, 4, '#e5482f') +
    gridSvg +
    `<path d="${d}" fill="none" stroke="#14202b" stroke-width="13.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="url(#hub-sp-grad)" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    crossSvg +
    node(1, 1, 1, '#3bab6a') +
    node(2, 0, 2, '#f7b733') +
    node(2, 2, 3, '#f7b733') +
    node(0, 2, 4, '#1fae96') +
    `</svg>`;

  el.innerHTML = svg;
}

function buildRetalhosScene() {
  const el = $('#booth-scene-retalhos');
  if (!el) return;

  const cs = 29;
  const ox = -2 * cs;
  const oy = -2 * cs;

  const patches = [
    { r1: 0, c1: 0, r2: 1, c2: 1, fill: '#a9c8f7', hex: '#3d7be0', cr: 0, cc: 0, sh: 'sq', txt: '4' },
    { r1: 0, c1: 2, r2: 0, c2: 3, fill: '#f9d091', hex: '#d98218', cr: 0, cc: 2, sh: 'hz', txt: '' },
    { r1: 1, c1: 2, r2: 2, c2: 2, fill: '#cab6eb', hex: '#845ec2', cr: 1, cc: 2, sh: 'vt', txt: '2' },
    { r1: 1, c1: 3, r2: 3, c2: 3, fill: '#a4e3cb', hex: '#289e76', cr: 2, cc: 3, sh: 'vt', txt: '3' },
    { r1: 2, c1: 0, r2: 2, c2: 1, fill: '#f7b2a8', hex: '#e55947', cr: 2, cc: 1, sh: 'hz', txt: '' },
    { r1: 3, c1: 0, r2: 3, c2: 2, fill: '#a0dce6', hex: '#1f8a9c', cr: 3, cc: 0, sh: 'hz', txt: '3' },
  ];

  let svgRects = `<rect x="${ox - 3}" y="${oy - 3}" width="${cs * 4 + 6}" height="${cs * 4 + 6}" rx="9" fill="#14202b"/>`;
  for (const p of patches) {
    const x = ox + p.c1 * cs;
    const y = oy + p.r1 * cs;
    const w = (p.c2 - p.c1 + 1) * cs;
    const h = (p.r2 - p.r1 + 1) * cs;
    svgRects += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="4" fill="${p.fill}" stroke="#14202b" stroke-width="2"/>`;

    const cx = ox + (p.cc + 0.5) * cs;
    const cy = oy + (p.cr + 0.5) * cs;
    const bw = p.sh === 'hz' ? 20 : p.sh === 'vt' ? 14 : 17;
    const bh = p.sh === 'vt' ? 20 : p.sh === 'hz' ? 13 : 17;
    svgRects += `<rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="3.5" fill="${p.hex}" stroke="#14202b" stroke-width="1.6"/>`;
    if (p.txt) {
      svgRects += `<text x="${cx}" y="${cy + 3.6}" text-anchor="middle" font-family="Bungee, sans-serif" font-size="10" fill="#fff8ea">${p.txt}</text>`;
    }
  }

  const sideBadge = (x, y, bw, bh, hex, txt) =>
    `<g transform="translate(${x},${y})"><circle r="26" fill="#132635" stroke="#14202b" stroke-width="2.2"/><rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="5" fill="${hex}" stroke="#14202b" stroke-width="2"/><text y="4.5" text-anchor="middle" font-family="Bungee, sans-serif" font-size="13" fill="#fff8ea">${txt}</text></g>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    sideBadge(-128, 0, 26, 26, '#e55947', '4') +
    sideBadge(128, 0, 30, 20, '#3d7be0', '6') +
    svgRects +
    `</svg>`;

  el.innerHTML = svg;
}

function buildSudokuScene() {
  const el = $('#booth-scene-sudoku');
  if (!el) return;

  // Bloco 3x3 de Sudoku no centro com pistas fixas, números preenchidos e destaque
  const cs = 36;
  const ox = -1.5 * cs;
  const oy = -1.5 * cs;

  const cells = [
    { r: 0, c: 0, val: '5', given: true },
    { r: 0, c: 1, val: '3', given: true },
    { r: 0, c: 2, val: '4', given: false },
    { r: 1, c: 0, val: '6', given: true },
    { r: 1, c: 1, val: '7', given: false, focus: true },
    { r: 1, c: 2, val: '2', given: false },
    { r: 2, c: 0, val: '1', given: false },
    { r: 2, c: 1, val: '9', given: true },
    { r: 2, c: 2, val: '8', given: true },
  ];

  let gridSvg = `<rect x="${ox - 3}" y="${oy - 3}" width="${cs * 3 + 6}" height="${cs * 3 + 6}" rx="9" fill="#14202b"/>`;
  for (const cell of cells) {
    const x = ox + cell.c * cs;
    const y = oy + cell.r * cs;
    const bg = cell.focus ? '#ffe39a' : cell.given ? '#e2cfa6' : '#fbf3df';
    const fg = cell.given ? '#14202b' : '#1b5db8';
    gridSvg += `<rect x="${x + 1}" y="${y + 1}" width="${cs - 2}" height="${cs - 2}" rx="3.5" fill="${bg}"/>`;
    gridSvg += `<text x="${x + cs / 2}" y="${y + cs / 2 + 5.5}" text-anchor="middle" font-family="Bungee, sans-serif" font-size="16" fill="${fg}">${cell.val}</text>`;
  }

  const sideNum = (x, y, txt, ring) =>
    `<g transform="translate(${x},${y})"><circle r="24" fill="#132635" stroke="${ring}" stroke-width="2.4"/><text y="5.5" text-anchor="middle" font-family="Bungee, sans-serif" font-size="15" fill="#fff8ea">${txt}</text></g>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    sideNum(-126, 0, '1-9', '#f7b733') +
    sideNum(126, 0, '9×9', '#3bab6a') +
    gridSvg +
    `</svg>`;

  el.innerHTML = svg;
}

function buildPalavraScene() {
  const el = $('#booth-scene-palavra');
  if (!el) return;

  // 3 linhas x 5 colunas estilo Wordle/Termo com peças verdes, amarelas e escuras
  const cw = 30;
  const ch = 30;
  const gap = 4;
  const totalW = 5 * cw + 4 * gap;
  const totalH = 3 * ch + 2 * gap;
  const ox = -totalW / 2;
  const oy = -totalH / 2;

  const rows = [
    [
      ['F', '#3bab6a', '#fff'],
      ['A', '#1f3347', '#9bb0c4'],
      ['R', '#f7b733', '#1f1300'],
      ['O', '#1f3347', '#9bb0c4'],
      ['L', '#1f3347', '#9bb0c4'],
    ],
    [
      ['F', '#3bab6a', '#fff'],
      ['E', '#3bab6a', '#fff'],
      ['I', '#1f3347', '#9bb0c4'],
      ['R', '#f7b733', '#1f1300'],
      ['A', '#3bab6a', '#fff'],
    ],
    [
      ['F', '#3bab6a', '#fff'],
      ['E', '#3bab6a', '#fff'],
      ['S', '#3bab6a', '#fff'],
      ['T', '#3bab6a', '#fff'],
      ['A', '#3bab6a', '#fff'],
    ],
  ];

  let tilesSvg = `<rect x="${ox - 6}" y="${oy - 6}" width="${totalW + 12}" height="${totalH + 12}" rx="10" fill="#14202b"/>`;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 5; c++) {
      const [chTxt, bg, fg] = rows[r][c];
      const x = ox + c * (cw + gap);
      const y = oy + r * (ch + gap);
      tilesSvg += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="5" fill="${bg}" stroke="rgba(255,255,255,0.18)" stroke-width="1.2"/>`;
      tilesSvg += `<text x="${x + cw / 2}" y="${y + ch / 2 + 5}" text-anchor="middle" font-family="Bungee, sans-serif" font-size="14" fill="${fg}">${chTxt}</text>`;
    }
  }

  const sideTile = (x, y, letter, bg) =>
    `<g transform="translate(${x},${y})"><rect x="-20" y="-20" width="40" height="40" rx="9" fill="${bg}" stroke="#14202b" stroke-width="2.4"/><text y="6" text-anchor="middle" font-family="Bungee, sans-serif" font-size="18" fill="#fff8ea">${letter}</text></g>`;

  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    sideTile(-136, 0, 'A', '#3bab6a') +
    sideTile(136, 0, 'Z', '#f7b733') +
    tilesSvg +
    `</svg>`;

  el.innerHTML = svg;
}

function buildSalveCarameloScene() {
  const el = $('#booth-scene-salve-caramelo');
  if (!el) return;

  // Cena limpa sem sobreposições: colmeia à esquerda, Caramelo sob cúpula no centro e abelhas à direita
  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<g transform="translate(-128,-6)">` +
    `<ellipse cy="-14" rx="14" ry="5.5" fill="#f7c843" stroke="#14202b" stroke-width="2"/>` +
    `<ellipse cy="-6" rx="19" ry="6.5" fill="#f0b12b" stroke="#14202b" stroke-width="2"/>` +
    `<ellipse cy="3" rx="22" ry="7.5" fill="#f7c843" stroke="#14202b" stroke-width="2"/>` +
    `<ellipse cy="12" rx="18" ry="6" fill="#e09a1e" stroke="#14202b" stroke-width="2"/>` +
    `<ellipse cx="2" cy="4" rx="7" ry="8.5" fill="#2d1608" stroke="#14202b" stroke-width="1.8"/>` +
    `</g>` +
    `<rect x="-78" y="34" width="156" height="24" rx="6" fill="#cf7e4b" stroke="#14202b" stroke-width="2.4"/>` +
    `<rect x="-78" y="34" width="156" height="8" rx="4" fill="#70c93a" stroke="#14202b" stroke-width="2.2"/>` +
    `<path d="M-48 31 V-14 Q-48-40 0-40 Q48-40 48-14 V31" fill="none" stroke="#14202b" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M-48 31 V-14 Q-48-40 0-40 Q48-40 48-14 V31" fill="none" stroke="#3d7be0" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    // Vira-lata Caramelo com orelhas caídas e coleira vermelha dentro do arco
    `<g transform="translate(0,11)">` +
    `<ellipse cx="-18" cy="-1" rx="6.5" ry="11.5" transform="rotate(14 -18 -1)" fill="#a3551c" stroke="#14202b" stroke-width="2.2"/>` +
    `<ellipse cx="18" cy="-1" rx="6.5" ry="11.5" transform="rotate(-14 18 -1)" fill="#a3551c" stroke="#14202b" stroke-width="2.2"/>` +
    `<circle r="19" fill="#df8f3c" stroke="#14202b" stroke-width="2.4"/>` +
    `<ellipse cy="6.5" rx="13.5" ry="9.5" fill="#f7da9f"/>` +
    `<rect x="-10" y="14" width="20" height="4.5" rx="2" fill="#e5482f" stroke="#14202b" stroke-width="1.6"/>` +
    `<circle cy="17.5" r="2.6" fill="#f7b733" stroke="#14202b" stroke-width="1.3"/>` +
    `<rect x="-14" y="-8" width="12" height="7.5" rx="2.5" fill="#14202b"/>` +
    `<rect x="2" y="-8" width="12" height="7.5" rx="2.5" fill="#14202b"/>` +
    `<rect x="-2" y="-6" width="4" height="2.4" fill="#14202b"/>` +
    `<ellipse cy="2.5" rx="4" ry="2.7" fill="#14202b"/>` +
    `<path d="M-5 6.5q5 4.5 10 0" fill="none" stroke="#14202b" stroke-width="2" stroke-linecap="round"/>` +
    `</g>` +
    `<g transform="translate(122,-18)">` +
    `<ellipse cx="2" cy="-8" rx="4.5" ry="6.5" fill="#fff8ea" stroke="#14202b" stroke-width="1.5" opacity=".9"/>` +
    `<ellipse rx="9.5" ry="7" fill="#f7c843" stroke="#14202b" stroke-width="2"/>` +
    `<rect x="-4" y="-6" width="3" height="12" fill="#14202b"/><rect x="1.5" y="-6" width="3" height="12" fill="#14202b"/>` +
    `<circle cx="-5.5" cy="-1.5" r="2" fill="#14202b"/>` +
    `</g>` +
    `<g transform="translate(148,18) scale(0.85)">` +
    `<ellipse cx="2" cy="-8" rx="4.5" ry="6.5" fill="#fff8ea" stroke="#14202b" stroke-width="1.5" opacity=".9"/>` +
    `<ellipse rx="9.5" ry="7" fill="#f7c843" stroke="#14202b" stroke-width="2"/>` +
    `<rect x="-4" y="-6" width="3" height="12" fill="#14202b"/><rect x="1.5" y="-6" width="3" height="12" fill="#14202b"/>` +
    `<circle cx="-5.5" cy="-1.5" r="2" fill="#14202b"/>` +
    `</g>` +
    `</svg>`;

  el.innerHTML = svg;
}

function buildEstacionamentoScene() {
  const el = $('#booth-scene-estacionamento');
  if (!el) return;

  // Cena de pátio vista de cima sem sobreposição: caminhão vertical, carro saindo, moto e cones
  const svg =
    `<svg viewBox="-190 -72 380 144" preserveAspectRatio="xMidYMid meet" aria-hidden="true">` +
    `<rect x="-156" y="-56" width="312" height="112" rx="12" fill="#2d3f51" stroke="#14202b" stroke-width="2.6"/>` +
    `<path d="M-142 0 H142 M-42-48 V48 M42-48 V48" stroke="rgba(246,232,200,0.18)" stroke-width="1.5" stroke-dasharray="6 5"/>` +
    `<rect x="-32" y="46" width="64" height="8" rx="3" fill="#f7b733" stroke="#14202b" stroke-width="2"/>` +
    `<g transform="translate(-96,0)">` +
    `<rect x="-18" y="-42" width="36" height="54" rx="5" fill="#f6e8c8" stroke="#14202b" stroke-width="2.2"/>` +
    `<rect x="-13" y="-37" width="26" height="44" rx="3" fill="#1fae96"/>` +
    `<rect x="-17" y="15" width="34" height="24" rx="6" fill="#1fae96" stroke="#14202b" stroke-width="2.2"/>` +
    `<rect x="-12" y="25" width="24" height="9" rx="2.5" fill="#b9dcff" stroke="#14202b" stroke-width="1.5"/>` +
    `</g>` +
    `<g transform="translate(8,-24)">` +
    `<rect x="-36" y="-15" width="72" height="30" rx="9" fill="#e5482f" stroke="#14202b" stroke-width="2.2"/>` +
    `<rect x="-18" y="-10" width="38" height="20" rx="5" fill="#1c3144"/>` +
    `<rect x="-8" y="-8.5" width="18" height="17" rx="3.5" fill="#ffd2c9"/>` +
    `<circle cx="32" cy="-9" r="2.6" fill="#ffe57a"/><circle cx="32" cy="9" r="2.6" fill="#ffe57a"/>` +
    `</g>` +
    `<path d="M56-24h42l-7-7m7 7-7 7" fill="none" stroke="#f7b733" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<g transform="translate(-8,24)">` +
    `<rect x="-15" y="-20" width="30" height="40" rx="8" fill="#3d7be0" stroke="#14202b" stroke-width="2.2"/>` +
    `<rect x="-10" y="-10" width="20" height="20" rx="4" fill="#1c3144"/>` +
    `</g>` +
    `<g transform="translate(92,22)">` +
    `<rect x="-20" y="-7" width="40" height="14" rx="6" fill="#f7b733" stroke="#14202b" stroke-width="2"/>` +
    `<line x1="10" y1="-11" x2="10" y2="11" stroke="#14202b" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="17" cy="0" r="2.8" fill="#ffe57a"/>` +
    `</g>` +
    `<rect x="108" y="-48" width="42" height="16" rx="4" fill="#3bab6a" stroke="#14202b" stroke-width="1.8"/>` +
    `<text x="129" y="-37" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="10" fill="#fff8ea">SAÍDA ▶</text>` +
    `</svg>`;

  el.innerHTML = svg;
}

function buildTropaQuermesseScene() {
  const el = $('#booth-scene-tropa-quermesse');
  if (!el) return;

  const runner = (x, y, fill, crown = false) =>
    `<g transform="translate(${x},${y})">` +
    `<ellipse cx="0" cy="11" rx="8" ry="3" fill="rgba(0,0,0,0.32)"/>` +
    `<rect x="-6.5" y="-5" width="13" height="15" rx="5" fill="${fill}" stroke="#14202b" stroke-width="2"/>` +
    `<circle cx="0" cy="-10" r="6" fill="#ffe0be" stroke="#14202b" stroke-width="2"/>` +
    (crown
      ? `<path d="M-5-14l2.5-5 2.5 3.5 2.5-3.5 2.5 5Z" fill="#ffd75e" stroke="#14202b" stroke-width="1.4"/>`
      : `<ellipse cx="0" cy="-14.5" rx="8" ry="2.4" fill="#ffd166" stroke="#14202b" stroke-width="1.4"/>`) +
    `</g>`;

  const svg =
    `<svg viewBox="-160 -70 320 140" aria-hidden="true">` +
    `<defs>` +
    `<linearGradient id="trp-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#253b52"/><stop offset="1" stop-color="#45617d"/></linearGradient>` +
    `</defs>` +
    `<polygon points="-38,-62 38,-62 128,68 -128,68" fill="url(#trp-road)" stroke="#f7b733" stroke-width="2.5"/>` +
    `<line x1="0" y1="-60" x2="0" y2="66" stroke="rgba(255,248,234,0.22)" stroke-width="2" stroke-dasharray="6 6"/>` +
    // Portal vermelho esquerda (-6) e verde direita (×2)
    `<g transform="translate(-44,-14)">` +
    `<rect x="-32" y="-34" width="64" height="50" rx="8" fill="#d93d2b" fill-opacity="0.72" stroke="#14202b" stroke-width="2.4"/>` +
    `<rect x="-29" y="-31" width="58" height="44" rx="6" fill="none" stroke="#ff826c" stroke-width="1.8"/>` +
    `<text x="0" y="-4" text-anchor="middle" font-family="Bungee, sans-serif" font-size="16" fill="#fffaf0" stroke="#14202b" stroke-width="2.2" paint-order="stroke">-6</text>` +
    `</g>` +
    `<g transform="translate(44,-14)">` +
    `<rect x="-32" y="-34" width="64" height="50" rx="8" fill="#27b868" fill-opacity="0.78" stroke="#14202b" stroke-width="2.4"/>` +
    `<rect x="-29" y="-31" width="58" height="44" rx="6" fill="none" stroke="#6df0a4" stroke-width="1.8"/>` +
    `<text x="0" y="-11" text-anchor="middle" font-family="Bungee, sans-serif" font-size="16" fill="#fffaf0" stroke="#14202b" stroke-width="2.2" paint-order="stroke">×2</text>` +
    `<text x="0" y="7" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="9.5" fill="#ffd75e">GALA</text>` +
    `</g>` +
    // Tropa correndo na frente direita
    runner(28, 34, '#f7b733', true) +
    runner(48, 30, '#e5482f', false) +
    runner(64, 38, '#1fae96', true) +
    runner(42, 46, '#ffd75e', true) +
    // Barra de poder
    `<rect x="-148" y="-56" width="70" height="20" rx="6" fill="#14202b" stroke="#f7b733" stroke-width="1.6"/>` +
    `<text x="-113" y="-43" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="10.5" fill="#f7b733">TEMA ×1.6 ★</text>` +
    `</svg>`;

  el.innerHTML = svg;
}

function buildArsenalQuermesseScene() {
  const el = $('#booth-scene-arsenal-quermesse');
  if (!el) return;

  const cs = 28;
  const ox = -142;
  const oy = -44;

  // Grade 4x3 compacta à esquerda mostrando peças encaixadas + fusão brilhante
  let grid = `<rect x="${ox - 4}" y="${oy - 4}" width="${cs * 4 + 8}" height="${cs * 3 + 8}" rx="8" fill="#14202b"/>`;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      grid += `<rect x="${ox + c * cs + 1}" y="${oy + r * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="4" fill="#132635" stroke="#223d50" stroke-width="1"/>`;
    }
  }
  // Escudo 1x1 (0,0)
  grid += `<rect x="${ox + 2}" y="${oy + 2}" width="${cs - 4}" height="${cs - 4}" rx="5" fill="#1e3963" stroke="#3d7be0" stroke-width="2"/>`;
  grid += `<path d="M${ox + 8} ${oy + 7} L${ox + 14} ${oy + 5} L${ox + 20} ${oy + 7} V${oy + 15} C${ox + 20} ${oy + 19} ${ox + 14} ${oy + 22} ${ox + 14} ${oy + 22} C${ox + 14} ${oy + 22} ${ox + 8} ${oy + 19} ${ox + 8} ${oy + 15} Z" fill="#3d7be0" stroke="#14202b" stroke-width="1.5"/>`;

  // Bruxa 2x1 (1..2, 0) com brilho dourado de fusão Nv.2
  grid += `<rect x="${ox + cs + 2}" y="${oy + 2}" width="${cs * 2 - 4}" height="${cs - 4}" rx="5" fill="#1e4b3d" stroke="#6df0a4" stroke-width="2"/>`;
  grid += `<path d="M${ox + cs + 9} ${oy + 20} H${ox + cs + 23} L${ox + cs + 16} ${oy + 6} Z" fill="#9d5cf0" stroke="#14202b" stroke-width="1.5"/>`;
  grid += `<circle cx="${ox + cs * 2 + 12}" cy="${oy + 16}" r="7" fill="#6df0a4" stroke="#14202b" stroke-width="1.5"/>`;

  // Espada 3x1 (0..2, 1)
  grid += `<rect x="${ox + 2}" y="${oy + cs + 2}" width="${cs * 3 - 4}" height="${cs - 4}" rx="5" fill="#4e3c16" stroke="#f7b733" stroke-width="2"/>`;
  grid += `<rect x="${ox + 8}" y="${oy + cs + 11}" width="12" height="5" rx="2" fill="#8a5a34" stroke="#14202b" stroke-width="1.4"/>`;
  grid += `<rect x="${ox + 20}" y="${oy + cs + 6}" width="4" height="15" rx="1.5" fill="#f7b733" stroke="#14202b" stroke-width="1.4"/>`;
  grid += `<path d="M${ox + 24} ${oy + cs + 10} H${ox + 68} L${ox + 77} ${oy + cs + 13.5} L${ox + 68} ${oy + cs + 17} H${ox + 24} Z" fill="#dbe4ee" stroke="#14202b" stroke-width="1.4"/>`;

  // Tomo 2x1 (2..3, 2)
  grid += `<rect x="${ox + cs * 2 + 2}" y="${oy + cs * 2 + 2}" width="${cs * 2 - 4}" height="${cs - 4}" rx="5" fill="#1e3963" stroke="#78b4ff" stroke-width="2"/>`;
  grid += `<rect x="${ox + cs * 2 + 10}" y="${oy + cs * 2 + 6}" width="36" height="16" rx="3" fill="#f6e8c8" stroke="#14202b" stroke-width="1.5"/>`;
  grid += `<line x1="${ox + cs * 2 + 28}" y1="${oy + cs * 2 + 6}" x2="${ox + cs * 2 + 28}" y2="${oy + cs * 2 + 22}" stroke="#14202b" stroke-width="1.5"/>`;

  // Cena de batalha à direita: Muralha + raio arcano + Diabretes e Ogro marchando
  const svg =
    `<svg viewBox="-160 -70 320 140" aria-hidden="true">` +
    grid +
    // Seta / Raio de disparo da grade para a arena
    `<path d="M-18 -8 L24 -16 L18 -4 L46 -12" fill="none" stroke="#ffd75e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="48" cy="-12" r="5" fill="#6df0a4" stroke="#14202b" stroke-width="1.6"/>` +
    // Muralha mini à direita da grade
    `<rect x="0" y="-42" width="14" height="86" rx="4" fill="#263f54" stroke="#14202b" stroke-width="2"/>` +
    `<rect x="9" y="-36" width="6" height="18" fill="#e5482f" stroke="#14202b" stroke-width="1.2"/>` +
    `<rect x="9" y="-12" width="6" height="18" fill="#f7b733" stroke="#14202b" stroke-width="1.2"/>` +
    `<rect x="9" y="12" width="6" height="18" fill="#e5482f" stroke="#14202b" stroke-width="1.2"/>` +
    // Inimigos marchando
    `<g transform="translate(68,-10)"><circle r="11" fill="#43b06c" stroke="#14202b" stroke-width="2"/><circle cx="-4" cy="-2" r="2" fill="#fff8ea"/><circle cx="1" cy="-2" r="2" fill="#fff8ea"/></g>` +
    `<g transform="translate(106,14)"><circle r="15" fill="#8f9fb0" stroke="#14202b" stroke-width="2.2"/><path d="M-13-2 A13 13 0 0 1 13-2 Z" fill="#b8c7d8" stroke="#14202b" stroke-width="1.6"/><circle cx="-5" cy="1" r="2.3" fill="#fff8ea"/><circle cx="1" cy="1" r="2.3" fill="#fff8ea"/></g>` +
    `<g transform="translate(124,-24)"><path d="M-12-2 Q-18-10 -6-4 M12-2 Q18-10 6-4" stroke="#e0569d" stroke-width="3" stroke-linecap="round" fill="none"/><circle r="8" fill="#7355b8" stroke="#14202b" stroke-width="1.8"/></g>` +
    `<rect x="44" y="-56" width="96" height="19" rx="6" fill="#14202b" stroke="#6df0a4" stroke-width="1.6"/>` +
    `<text x="92" y="-43" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="10.5" fill="#6df0a4">SOMAR + FUNDIR ★★★</text>` +
    `</svg>`;

  el.innerHTML = svg;
}

function aboutModal() {
  return `<div class="modal" data-kind="rules" role="dialog" aria-modal="true">
    <h2>Sobre e créditos</h2>
    <div class="about-box">
      <div class="about-card">
        <div class="about-av">${avatar(0)}</div>
        <div class="about-copy">
          <b>Caio Nunes <small>@caionunespn</small></b>
          <p>Programador que claramente não sabe ouvir um "duvido" quieto. Em vez de só responder no grupo, preferiu passar o fim de semana fazendo um jogo inteiro do zero.</p>
        </div>
      </div>
      <div class="about-hero">
        <div class="about-av">${avatar(2)}</div>
        <div class="about-copy">
          <span class="about-kicker">${ico('bolt', 's')}Por que esse site existe?</span>
          <p>Tudo começou <b>porque o Iuri duvidou que eu era muito poderoso</b>. Depois de programar o Catapulta do zero, o domínio virou a nossa quermesse oficial de mini-jogos para jogar sozinho ou com a galera.</p>
        </div>
      </div>
      <div class="rules-specials">
        <div class="spec-card">${ico('bolt', 'l')}<div><b>Feito na unha</b><span>HTML, CSS e JavaScript puro, sem engine pronta nem biblioteca pesada.</span></div></div>
        <div class="spec-card">${ico('c-knight', 'l')}<div><b>Som e desenho caseiros</b><span>Arte em SVG e efeitos sonoros sintetizados na hora pelo navegador.</span></div></div>
        <div class="spec-card wide">${ico('crown', 'l')}<div><b>Agradecimento especial</b><span>Ao <b>Iuri</b>: se ele tivesse acreditado logo de cara, ninguém estaria tomando pedrada de catapulta agora.</span></div></div>
      </div>
    </div>
    <div class="row"><button class="btn yellow" data-act="close">Fechar</button></div>
  </div>`;
}

document.querySelectorAll('.garland').forEach(buildGarland);
document.querySelectorAll('.ambient').forEach(buildAmbient);

const castEl = $('#cast');
if (castEl) {
  castEl.innerHTML = COLORS.map((c, i) => `<span style="--i:${i}" title="${c.name}"><div class="cast-bob" style="--i:${i}">${avatar(i)}</div></span>`).join('');
}

const kickerEl = $('#hub-kicker');
if (kickerEl) kickerEl.innerHTML = `${ico('stall', 's')}Quermesse de Mini-Jogos`;

buildCatapultaScene();
buildSolLuaScene();
buildCoroasScene();
buildSerpentinaScene();
buildRetalhosScene();
buildSudokuScene();
buildPalavraScene();
buildSalveCarameloScene();
buildEstacionamentoScene();
buildTropaQuermesseScene();
buildArsenalQuermesseScene();

const featsCat = $('#booth-feats-catapulta');
if (featsCat) {
  featsCat.innerHTML =
    `<span class="booth-pill">${ico('crown', 's')}10 pts p/ vencer</span>` +
    `<span class="booth-pill">${ico('c-knight', 's')}Catapulta & Trapaças</span>` +
    `<span class="booth-pill">${ico('bot', 's')}Bots inclusos</span>` +
    `<span class="booth-pill">${ico('link', 's')}Salas por link</span>`;
}

const featsSL = $('#booth-feats-sol-lua');
if (featsSL) {
  featsSL.innerHTML =
    `<span class="booth-pill">${ico('sun', 's')}Grade 6×6</span>` +
    `<span class="booth-pill">${ico('star', 's')}4 dificuldades</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Dicas explicadas</span>` +
    `<span class="booth-pill">${ico('check', 's')}100% dedutível</span>`;
}

const featsCR = $('#booth-feats-coroas');
if (featsCR) {
  featsCR.innerHTML =
    `<span class="booth-pill">${ico('crown', 's')}6×6 até 9×9</span>` +
    `<span class="booth-pill">${ico('star', 's')}4 dificuldades</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Dicas explicadas</span>` +
    `<span class="booth-pill">${ico('check', 's')}Zero chute</span>`;
}

const featsSP = $('#booth-feats-serpentina');
if (featsSP) {
  featsSP.innerHTML =
    `<span class="booth-pill">${ico('road', 's')}5×5 até 8×8</span>` +
    `<span class="booth-pill">${ico('star', 's')}4 dificuldades</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Dicas passo a passo</span>` +
    `<span class="booth-pill">${ico('check', 's')}Trilha contínua</span>`;
}

const featsRT = $('#booth-feats-retalhos');
if (featsRT) {
  featsRT.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}5×5 até 8×8</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Dica c/ Mostre-me</span>` +
    `<span class="booth-pill">${ico('check', 's')}4 formatos</span>` +
    `<span class="booth-pill">${ico('crown', 's')}100% dedutível</span>`;
}

const featsSK = $('#booth-feats-sudoku');
if (featsSK) {
  featsSK.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}Grade 9×9</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Modo Notas</span>` +
    `<span class="booth-pill">${ico('check', 's')}4 dificuldades</span>` +
    `<span class="booth-pill">${ico('crown', 's')}100% dedutível</span>`;
}

const featsPL = $('#booth-feats-palavra');
if (featsPL) {
  featsPL.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}4 a 7 letras</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}6 tentativas</span>` +
    `<span class="booth-pill">${ico('check', 's')}Teclado virtual</span>` +
    `<span class="booth-pill">${ico('crown', 's')}Português</span>`;
}

const featsSD = $('#booth-feats-salve-caramelo');
if (featsSD) {
  featsSD.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}40 fases</span>` +
    `<span class="booth-pill">${ico('hand', 's')}Desenho livre</span>` +
    `<span class="booth-pill">${ico('bolt', 's')}Física 2D real</span>` +
    `<span class="booth-pill">${ico('crown', 's')}Até 3 estrelas</span>`;
}

const featsPK = $('#booth-feats-estacionamento');
if (featsPK) {
  featsPK.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}40 fases</span>` +
    `<span class="booth-pill">${ico('bolt', 's')}Motos a Caminhões</span>` +
    `<span class="booth-pill">${ico('nope', 's')}Até 3 batidas</span>` +
    `<span class="booth-pill">${ico('bulb', 's')}Dica lógica</span>`;
}

const featsTR = $('#booth-feats-tropa-quermesse');
if (featsTR) {
  featsTR.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}40 fases</span>` +
    `<span class="booth-pill">${ico('bolt', 's')}Portais + e ×</span>` +
    `<span class="booth-pill">${ico('crown', 's')}Trajes ×1.6</span>` +
    `<span class="booth-pill">${ico('check', 's')}Duelo no Coreto</span>`;
}

const featsAR = $('#booth-feats-arsenal-quermesse');
if (featsAR) {
  featsAR.innerHTML =
    `<span class="booth-pill">${ico('star', 's')}40 fases</span>` +
    `<span class="booth-pill">${ico('bolt', 's')}10 Peças &amp; Sinergias</span>` +
    `<span class="booth-pill">${ico('crown', 's')}Fusões até Nv.5</span>` +
    `<span class="booth-pill">${ico('check', 's')}Hordas &amp; Chefões</span>`;
}

const playCat = $('#btn-play-catapulta');
if (playCat) {
  if (location.search) playCat.href = '/catapulta' + location.search;
  playCat.innerHTML = `${ico('c-knight', 'l')}<span>Jogar Catapulta</span>${ico('next', 's')}`;
}

const playSL = $('#btn-play-sol-lua');
if (playSL) {
  playSL.innerHTML = `${ico('sun', 'l')}<span>Jogar Sol &amp; Lua</span>${ico('next', 's')}`;
}

const playCR = $('#btn-play-coroas');
if (playCR) {
  playCR.innerHTML = `${ico('crown', 'l')}<span>Jogar Coroas</span>${ico('next', 's')}`;
}

const playSP = $('#btn-play-serpentina');
if (playSP) {
  playSP.innerHTML = `${ico('road', 'l')}<span>Jogar Serpentina</span>${ico('next', 's')}`;
}

const playRT = $('#btn-play-retalhos');
if (playRT) {
  playRT.innerHTML = `${ico('star', 'l')}<span>Jogar Retalhos</span>${ico('next', 's')}`;
}

const playSK = $('#btn-play-sudoku');
if (playSK) {
  playSK.innerHTML = `${ico('star', 'l')}<span>Jogar Sudoku</span>${ico('next', 's')}`;
}

const playPL = $('#btn-play-palavra');
if (playPL) {
  playPL.innerHTML = `${ico('bulb', 'l')}<span>Jogar Palavra</span>${ico('next', 's')}`;
}

const playSD = $('#btn-play-salve-caramelo');
if (playSD) {
  playSD.innerHTML = `${ico('star', 'l')}<span>Jogar Salve o Caramelo</span>${ico('next', 's')}`;
}

const playPK = $('#btn-play-estacionamento');
if (playPK) {
  playPK.innerHTML = `${ico('bolt', 'l')}<span>Jogar Estacionamento</span>${ico('next', 's')}`;
}

const playTR = $('#btn-play-tropa-quermesse');
if (playTR) {
  playTR.innerHTML = `${ico('crown', 'l')}<span>Jogar Tropa da Quermesse</span>${ico('next', 's')}`;
}

const playAR = $('#btn-play-arsenal-quermesse');
if (playAR) {
  playAR.innerHTML = `${ico('bolt', 'l')}<span>Jogar Arsenal da Quermesse</span>${ico('next', 's')}`;
}

const aboutBtn = $('#btn-hub-about');
if (aboutBtn) aboutBtn.innerHTML = `${ico('info', 's')}Sobre e créditos`;

const modalRoot = $('#modal-root');
document.addEventListener('click', (e) => {
  if (e.target === modalRoot && modalRoot.innerHTML) {
    modalRoot.innerHTML = '';
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) {
    if (e.target.closest('.booth-cta')) sfx.click();
    return;
  }
  sfx.click();
  if (el.dataset.act === 'about') {
    modalRoot.innerHTML = aboutModal();
  } else if (el.dataset.act === 'close') {
    modalRoot.innerHTML = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalRoot?.innerHTML) {
    modalRoot.innerHTML = '';
  }
});
