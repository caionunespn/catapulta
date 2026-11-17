// Motor de Tower Defense em Grade com Fusão de Peças — 40 Fases em 4 Capítulos.
// Zero dependências de DOM: roda igual no navegador e nos testes automatizados em Node.

export const GRID_COLS = 6;
export const GRID_ROWS = 6;
export const TRAY_SLOTS = 4;
export const SHOP_SLOTS = 3;
export const REROLL_COST = 2;
export const EXPAND_COST = 4;
export const MAX_TIER = 5;

export const ARENA_W = 360;
export const ARENA_H = 396;
export const WALL_Y = 358;
export const SPAWN_Y = -18;

export const TIERS = [
  null,
  { tier: 1, name: 'Comum', stars: '', mult: 1.0, color: '#f6e8c8', border: '#8f9fb0', bg: '#263f54' },
  { tier: 2, name: 'Raro', stars: '★', mult: 2.08, color: '#6df0a4', border: '#3bab6a', bg: '#1e4b3d' },
  { tier: 3, name: 'Épico', stars: '★★', mult: 4.3, color: '#78b4ff', border: '#3d7be0', bg: '#1e3963' },
  { tier: 4, name: 'Lendário', stars: '★★★', mult: 8.85, color: '#ffd75e', border: '#f7b733', bg: '#4e3c16' },
  { tier: 5, name: 'Mítico', stars: '★★★★', mult: 18.0, color: '#ff8fd8', border: '#e0569d', bg: '#4e2046' },
];

export const PIECES = {
  shield: {
    id: 'shield',
    name: 'Escudo',
    short: 'Escudo',
    spaces: 1,
    shapeLabel: '1 esp.',
    cost: 3,
    role: 'Defesa & Espinhos',
    color: '#3d7be0',
    accent: '#9cc5ff',
    baseCells: [[0, 0]],
    rotCount: 1,
    cd: 3.4,
    armor: 22,
    regen: 4,
    thorns: 9,
    summary: 'Dá Armadura à Muralha, regenera proteção e reflete espinhos. +22% por Escudo/Espada vizinhos.',
  },
  ice_orb: {
    id: 'ice_orb',
    name: 'Orbe Glacial',
    short: 'Gelo',
    spaces: 1,
    shapeLabel: '1 esp.',
    cost: 4,
    role: 'Lentidão em Área',
    color: '#46c6e8',
    accent: '#ccf6ff',
    baseCells: [[0, 0]],
    rotCount: 1,
    cd: 1.85,
    dmg: 10,
    aoe: 46,
    slowPct: 0.34,
    slowDur: 2.8,
    summary: 'Estilhaça gelo em área, desacelerando os inimigos para suas armas cobrarem caro.',
  },
  dagger: {
    id: 'dagger',
    name: 'Adaga Sombria',
    short: 'Adaga',
    spaces: 1,
    shapeLabel: '1 esp.',
    cost: 4,
    role: 'Crítico Veloz',
    color: '#9fb8c2',
    accent: '#e0569d',
    baseCells: [[0, 0]],
    rotCount: 1,
    cd: 0.68,
    dmg: 9,
    critChance: 0.25,
    critMult: 2.0,
    summary: 'Ataque super rápido com chance de Crítico ×2. +18% crítico ao lado de Voodoo ou Bruxa.',
  },
  lantern: {
    id: 'lantern',
    name: 'Lampião Dourado',
    short: 'Lampião',
    spaces: 1,
    shapeLabel: '1 esp.',
    cost: 4,
    role: 'Aura Veloz & Ouro',
    color: '#f7b733',
    accent: '#fff3cc',
    baseCells: [[0, 0]],
    rotCount: 1,
    cd: 0,
    hasteAura: 0.16,
    bonusGold: 2,
    summary: 'Acelera vizinhos (+16% ou mais de velocidade) e rende moedas extras ao fim de cada horda.',
  },
  witch: {
    id: 'witch',
    name: 'Bruxa',
    short: 'Bruxa',
    spaces: 2,
    shapeLabel: '2 esp.',
    cost: 5,
    role: 'Veneno em Área',
    color: '#9d5cf0',
    accent: '#6df0a4',
    baseCells: [[0, 0], [1, 0]],
    rotCount: 2,
    cd: 2.0,
    dmg: 14,
    aoe: 50,
    poisonDps: 4.5,
    poisonDur: 4.0,
    summary: 'Lança poções venenosas em área. O veneno acumula (até 3×) e ignora armadura!',
  },
  voodoo: {
    id: 'voodoo',
    name: 'Boneco de Voodoo',
    short: 'Voodoo',
    spaces: 2,
    shapeLabel: '2 esp.',
    cost: 5,
    role: 'Maldição & Cura',
    color: '#c9793a',
    accent: '#e5482f',
    baseCells: [[0, 0], [1, 0]],
    rotCount: 2,
    cd: 1.65,
    dmg: 16,
    heal: 1.5,
    curseAmp: 0.24,
    curseDur: 4.5,
    summary: 'Cura a Muralha e amaldiçoa o inimigo mais forte (+24% ou mais de dano recebido de todas as peças).',
  },
  tome: {
    id: 'tome',
    name: 'Tomo de Feitiços',
    short: 'Tomo',
    spaces: 2,
    shapeLabel: '2 esp.',
    cost: 6,
    role: 'Raio & Aura de Poder',
    color: '#7355b8',
    accent: '#f7b733',
    baseCells: [[0, 0], [1, 0]],
    rotCount: 2,
    cd: 2.1,
    dmg: 15,
    chains: 3,
    powerAura: 0.22,
    summary: 'Dispara raios em cadeia e dá +22% ou mais de Poder para todas as peças encostadas nele!',
  },
  crossbow: {
    id: 'crossbow',
    name: 'Besta Precisa',
    short: 'Besta',
    spaces: 2,
    shapeLabel: '2 esp.',
    cost: 5,
    role: 'Perfura & Anti-Voador',
    color: '#d98218',
    accent: '#f6e8c8',
    baseCells: [[0, 0], [1, 0]],
    rotCount: 2,
    cd: 1.35,
    dmg: 21,
    pierce: 2,
    airBonus: 1.48,
    summary: 'Virote veloz que perfura múltiplos inimigos e causa +48% de dano em Voadores.',
  },
  sword: {
    id: 'sword',
    name: 'Espada',
    short: 'Espada',
    spaces: 3,
    shapeLabel: '3 esp.',
    cost: 7,
    role: 'Corte Amplo & Empurrão',
    color: '#d4e2ef',
    accent: '#f7b733',
    baseCells: [[0, 0], [1, 0], [2, 0]],
    rotCount: 2,
    cd: 1.5,
    dmg: 34,
    maxTargets: 4,
    rangeY: 205,
    knockback: 18,
    summary: 'Onda cortante para cima que atinge até 4 inimigos e empurra para trás. +22% dano ao lado de Escudo.',
  },
  axe: {
    id: 'axe',
    name: 'Machado Rúnico',
    short: 'Machado',
    spaces: 3,
    shapeLabel: '3 esp. L',
    cost: 7,
    role: 'Quebra-Armadura & Stun',
    color: '#e5482f',
    accent: '#ffd75e',
    baseCells: [[0, 0], [1, 0], [0, 1]],
    rotCount: 4,
    cd: 2.15,
    dmg: 40,
    aoe: 42,
    armorMult: 1.85,
    stunDur: 0.7,
    summary: 'Formato em L! Destrói armadura de blindados e atordoa os alvos atingidos.',
  },
};

export const PIECE_IDS = Object.keys(PIECES);

export const ENEMIES = {
  goblin: {
    id: 'goblin',
    name: 'Diabrete',
    hp: 38,
    armor: 0,
    speed: 34,
    dmg: 6,
    atkCd: 1.05,
    gold: 1,
    radius: 11,
    flying: false,
    color: '#43b06c',
    trim: '#1f6440',
  },
  skeleton: {
    id: 'skeleton',
    name: 'Esqueleto',
    hp: 26,
    armor: 0,
    speed: 48,
    dmg: 5,
    atkCd: 0.85,
    gold: 1,
    radius: 10,
    flying: false,
    color: '#f6e8c8',
    trim: '#8f9fb0',
  },
  bat: {
    id: 'bat',
    name: 'Morcego',
    hp: 29,
    armor: 0,
    speed: 58,
    dmg: 6,
    atkCd: 0.9,
    gold: 1,
    radius: 10,
    flying: true,
    color: '#7355b8',
    trim: '#e0569d',
  },
  bomber: {
    id: 'bomber',
    name: 'Barril-Bomba',
    hp: 46,
    armor: 0,
    speed: 50,
    dmg: 22,
    atkCd: 1.0,
    gold: 1,
    radius: 12,
    flying: false,
    bomber: true,
    color: '#e5482f',
    trim: '#f7b733',
  },
  ogre: {
    id: 'ogre',
    name: 'Ogro Blindado',
    hp: 105,
    armor: 52,
    speed: 23,
    dmg: 12,
    atkCd: 1.35,
    gold: 2,
    radius: 15,
    flying: false,
    color: '#8f9fb0',
    trim: '#4d6073',
  },
  shaman: {
    id: 'shaman',
    name: 'Xamã Sombrio',
    hp: 68,
    armor: 14,
    speed: 30,
    dmg: 7,
    atkCd: 2.7,
    healCd: 3.6,
    rangedY: 215,
    gold: 2,
    radius: 13,
    flying: false,
    ranged: true,
    color: '#9d5cf0',
    trim: '#f7b733',
  },
  gargoyle: {
    id: 'gargoyle',
    name: 'Gárgula Ferro',
    hp: 78,
    armor: 36,
    speed: 45,
    dmg: 9,
    atkCd: 1.05,
    gold: 2,
    radius: 13,
    flying: true,
    color: '#5a728a',
    trim: '#3bab6a',
  },
  boss_goblin: {
    id: 'boss_goblin',
    name: 'Rei Diabrete',
    hp: 340,
    armor: 60,
    speed: 20,
    dmg: 16,
    atkCd: 1.25,
    summonCd: 5.5,
    summonKind: 'goblin',
    gold: 8,
    radius: 21,
    flying: false,
    boss: true,
    color: '#3bab6a',
    trim: '#f7b733',
  },
  boss_knight: {
    id: 'boss_knight',
    name: 'Cavaleiro Piche',
    hp: 460,
    armor: 190,
    speed: 19,
    dmg: 20,
    atkCd: 1.3,
    gold: 10,
    radius: 22,
    flying: false,
    boss: true,
    color: '#3c5268',
    trim: '#e5482f',
  },
  boss_voodoo: {
    id: 'boss_voodoo',
    name: 'Bruxo do Coreto',
    hp: 540,
    armor: 110,
    speed: 22,
    dmg: 13,
    atkCd: 2.2,
    healCd: 3.8,
    summonCd: 5.2,
    summonKind: 'bat',
    rangedY: 195,
    gold: 11,
    radius: 21,
    flying: false,
    ranged: true,
    boss: true,
    color: '#7355b8',
    trim: '#6df0a4',
  },
  boss_colossus: {
    id: 'boss_colossus',
    name: 'Colosso da Quermesse',
    hp: 820,
    armor: 260,
    speed: 17,
    dmg: 24,
    atkCd: 1.3,
    summonCd: 4.8,
    summonKind: 'skeleton',
    gold: 14,
    radius: 25,
    flying: false,
    boss: true,
    color: '#e5482f',
    trim: '#ffd75e',
  },
};

export const CHAPTERS = [
  { id: 1, name: 'Capítulo 1 · Portões da Quermesse', from: 1, to: 10 },
  { id: 2, name: 'Capítulo 2 · Beco das Bruxas', from: 11, to: 20 },
  { id: 3, name: 'Capítulo 3 · Cerco Noturno', from: 21, to: 30 },
  { id: 4, name: 'Capítulo 4 · Coreto Final', from: 31, to: 40 },
];

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function rotateCells(baseCells, rot = 0) {
  const steps = ((rot % 4) + 4) % 4;
  let pts = baseCells.map(([c, r]) => [c, r]);
  for (let s = 0; s < steps; s++) {
    pts = pts.map(([c, r]) => [-r, c]);
  }
  const minC = Math.min(...pts.map(([c]) => c));
  const minR = Math.min(...pts.map(([, r]) => r));
  return pts.map(([c, r]) => [c - minC, r - minR]);
}

export function pieceCells(pieceId, rot = 0) {
  const def = PIECES[pieceId];
  if (!def) return [[0, 0]];
  return rotateCells(def.baseCells, rot % def.rotCount);
}

export function pieceBounds(pieceId, rot = 0) {
  const cells = pieceCells(pieceId, rot);
  const w = Math.max(...cells.map(([c]) => c)) + 1;
  const h = Math.max(...cells.map(([, r]) => r)) + 1;
  return { w, h, cells };
}

export function pieceCellsAt(pieceId, col, row, rot = 0) {
  return pieceCells(pieceId, rot).map(([dc, dr]) => [col + dc, row + dr]);
}

export function emptyMask(cols = GRID_COLS, rows = GRID_ROWS) {
  return Array.from({ length: rows }, () => Array(cols).fill(false));
}

export function maskFromCoords(coords) {
  const m = emptyMask();
  for (const [c, r] of coords) {
    if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) m[r][c] = true;
  }
  return m;
}

function rectMask(c0, r0, c1, r1) {
  const coords = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) coords.push([c, r]);
  }
  return maskFromCoords(coords);
}

const GRID_PRESETS = {
  // 4×4 central (16 células) expansível até 6×6 (36 células)
  box_4x4: rectMask(1, 1, 4, 4),
  // 4×4 + asas laterais (18 células)
  cross_18: maskFromCoords([
    ...[1, 2, 3, 4].flatMap((c) => [1, 2, 3, 4].map((r) => [c, r])),
    [0, 2], [5, 2],
  ]),
  // 5×4 (20 células)
  box_5x4: rectMask(1, 1, 5, 4),
  // 5×5 quase completo (24 células)
  fort_24: maskFromCoords([
    ...[0, 1, 2, 3, 4].flatMap((c) => [1, 2, 3, 4, 5].map((r) => [c, r])).filter(([c, r]) => !(c === 0 && r === 5)),
  ]),
  // 5×5 central/lateral (25 células) expansível até 6×6
  box_5x5: rectMask(0, 1, 4, 5),
};

function buildWaveGroups(levelId, waveIdx, totalWaves) {
  // Progressão calibrada ao longo das 40 fases e dentro das hordas de cada fase:
  // Onda 1 abre espaço para montar o arsenal inicial; últimas ondas escalam forte para o clímax!
  const isFinalWave = waveIdx === totalWaves - 1;
  const stagePower =
    1 +
    (levelId - 1) * 0.25 +
    Math.pow(Math.max(0, levelId - 4), 1.17) * 0.082;
  const waveFrac = totalWaves <= 1 ? 1 : waveIdx / (totalWaves - 1);
  const waveMult = 0.23 + Math.pow(waveFrac, 1.24) * 1.48 + (isFinalWave ? 0.34 : 0);
  const waveScale = stagePower * waveMult;
  const groups = [];
  const theme = (levelId + waveIdx) % 5;

  if (levelId === 1) {
    if (waveIdx === 0) return [{ type: 'goblin', count: 5, interval: 1.2, scale: 0.78 }];
    if (waveIdx === 1) {
      return [
        { type: 'goblin', count: 6, interval: 1.0, scale: 0.88 },
        { type: 'bat', count: 3, interval: 0.9, scale: 0.85, delay: 1.8 },
      ];
    }
    return [
      { type: 'goblin', count: 8, interval: 0.82, scale: 0.98 },
      { type: 'bat', count: 5, interval: 0.75, scale: 0.96, delay: 1.5 },
    ];
  }

  if (levelId === 2) {
    if (waveIdx === 0) return [{ type: 'goblin', count: 6, interval: 1.05, scale: 0.9 }];
    if (waveIdx === 1) {
      return [
        { type: 'skeleton', count: 8, interval: 0.72, scale: 0.96 },
        { type: 'goblin', count: 4, interval: 0.95, scale: 0.96, delay: 1.4 },
      ];
    }
    return [
      { type: 'skeleton', count: 9, interval: 0.65, scale: 1.06 },
      { type: 'bat', count: 6, interval: 0.75, scale: 1.02, delay: 1.8 },
    ];
  }

  const baseCount = 5 + Math.floor(waveIdx * 1.6) + Math.floor(levelId * 0.16);
  const pace = clamp(0.98 - levelId * 0.011 - waveIdx * 0.038, 0.36, 1.0);

  if (levelId <= 5) {
    groups.push({ type: theme === 1 ? 'skeleton' : 'goblin', count: baseCount, interval: pace, scale: waveScale });
    if (waveIdx >= 1) {
      groups.push({
        type: theme % 2 === 0 ? 'bat' : 'skeleton',
        count: 3 + waveIdx,
        interval: pace * 0.85,
        scale: waveScale,
        delay: 1.6,
      });
    }
    if (levelId >= 4 && isFinalWave) {
      groups.push({ type: 'ogre', count: levelId === 4 ? 1 : 2, interval: 2.5, scale: waveScale * 0.96, delay: 2.0 });
    }
  } else if (levelId <= 10) {
    groups.push({ type: theme === 2 ? 'skeleton' : 'goblin', count: baseCount, interval: pace, scale: waveScale });
    if (waveIdx >= 1) {
      groups.push({
        type: theme === 0 ? 'ogre' : 'bat',
        count: theme === 0 ? 1 + Math.floor(waveIdx / 2) : 4 + waveIdx,
        interval: theme === 0 ? 2.3 : pace * 0.82,
        scale: waveScale,
        delay: 1.3,
      });
    }
    if (levelId >= 7 && waveIdx >= 2) {
      groups.push({ type: 'bomber', count: 2 + Math.floor(waveIdx / 2), interval: 1.5, scale: waveScale, delay: 2.0 });
    }
    if (levelId >= 8 && isFinalWave) {
      groups.push({ type: 'ogre', count: 2, interval: 2.1, scale: waveScale, delay: 1.7 });
    }
  } else if (levelId <= 20) {
    const opener = waveIdx === 0 ? 'goblin' : theme === 0 ? 'goblin' : theme === 1 ? 'skeleton' : 'bat';
    groups.push({ type: opener, count: baseCount + 1, interval: pace, scale: waveScale });
    if (waveIdx >= 1) {
      groups.push({
        type: theme % 2 === 0 ? 'ogre' : 'bomber',
        count: theme % 2 === 0 ? 2 + Math.floor(waveIdx / 2) : 3 + Math.floor(waveIdx / 2),
        interval: theme % 2 === 0 ? 2.0 : 1.25,
        scale: waveScale,
        delay: 1.2,
      });
    }
    if (waveIdx >= 2) {
      groups.push({ type: 'shaman', count: 1 + Math.floor((levelId - 9) / 5), interval: 2.2, scale: waveScale, delay: 2.2 });
    }
    if (isFinalWave) {
      groups.push({ type: 'bat', count: 5 + Math.floor(levelId / 5), interval: 0.62, scale: waveScale, delay: 1.0 });
    }
  } else {
    // Capítulos 3 e 4: Onda 1 entra firme sem rush impossível antes do jogador montar o grid
    const opener = waveIdx === 0 ? 'goblin' : theme === 0 ? 'skeleton' : theme === 1 ? 'goblin' : theme === 2 ? 'ogre' : 'bat';
    groups.push({
      type: opener,
      count: opener === 'ogre' ? 2 + Math.floor(waveIdx / 2) : baseCount + 2,
      interval: opener === 'ogre' ? 1.85 : waveIdx === 0 ? Math.max(0.62, pace) : pace,
      scale: waveScale,
    });
    if (waveIdx >= 1) {
      groups.push({
        type: theme % 2 === 0 ? 'gargoyle' : 'bomber',
        count: theme % 2 === 0 ? 2 + Math.floor(waveIdx / 2) : 3 + Math.floor(waveIdx / 2),
        interval: theme % 2 === 0 ? 1.45 : 1.12,
        scale: waveScale,
        delay: 1.3,
      });
    } else {
      groups.push({
        type: 'bat',
        count: 3 + Math.floor(levelId / 12),
        interval: 0.85,
        scale: waveScale * 0.9,
        delay: 1.8,
      });
    }
    if (waveIdx >= 2) {
      groups.push({
        type: waveIdx % 2 === 0 ? 'shaman' : 'ogre',
        count: waveIdx % 2 === 0 ? 2 + Math.floor(levelId / 18) : 2 + Math.floor(waveIdx / 2),
        interval: 1.95,
        scale: waveScale,
        delay: 1.8,
      });
    }
    if (isFinalWave) {
      groups.push({
        type: theme % 2 === 0 ? 'bat' : 'gargoyle',
        count: theme % 2 === 0 ? 5 + Math.floor((levelId - 20) / 4) : 3 + Math.floor((levelId - 20) / 5),
        interval: theme % 2 === 0 ? 0.65 : 1.05,
        scale: waveScale,
        delay: 0.9,
      });
    }
  }

  // Chefões em fases marcantes (5, 10, 15, 20, 25, 30, 35, 40)
  if (isFinalWave && levelId % 5 === 0) {
    const bossId =
      levelId <= 10
        ? 'boss_goblin'
        : levelId <= 20
          ? 'boss_knight'
          : levelId <= 30
            ? 'boss_voodoo'
            : 'boss_colossus';
    groups.push({
      type: bossId,
      count: 1,
      interval: 1.0,
      scale: waveScale * (levelId === 40 ? 1.12 : 0.95),
      delay: 2.6,
    });
    if (levelId === 40) {
      groups.push({ type: 'boss_knight', count: 1, interval: 1.0, scale: waveScale * 0.9, delay: 5.2 });
    }
  }

  return groups;
}

const STAGE_META = [
  ['Portão de Entrada', 'Monte seu arsenal na grade e some peças iguais!'],
  ['Primeira Fusão', 'Arraste duas peças de mesmo nível para evoluir para ★.'],
  ['Sinfonia da Espada', 'Encoste a Espada (3 esp.) num Escudo para +22% corte!'],
  ['Círculo do Tomo', 'O Tomo (2 esp.) turbina todas as peças vizinhas.'],
  ['Rei dos Diabretes', 'Primeiro Chefão! Boneco de Voodoo amplifica todo o dano.'],
  ['Marcha dos Blindados', 'Ogros têm Armadura: use Machado Rúnico ou Veneno da Bruxa!'],
  ['Pavio Curto', 'Barril-Bomba explode na Muralha — pare com Gelo ou Adagas.'],
  ['Asas na Noite', 'Morcegos voam rápido; a Besta causa +48% contra voadores!'],
  ['Mochila em Cruz', 'Expanda os espaços certos para encaixar Espada e Machado.'],
  ['Capitão Piche', 'Chefe do Capítulo 1! Prepare defesas contra invocações.'],

  ['Beco das Bruxas', 'Xamãs Sombrios curam aliados e atiram de longe!'],
  ['Névoa Venenosa', 'Empilhe poções de Bruxa para derreter tanques blindados.'],
  ['Ronda de Espinhos', 'Escudos em dupla reforçam a Muralha contra enxames.'],
  ['Chuva de Virotes', 'Combine Besta e Lampião Dourado para disparos frenéticos.'],
  ['Cavaleiro Piche', 'Chefão de Armadura pesada! Machado Rúnico brilha aqui.'],
  ['Encruzilhada Arcana', 'Posicione Tomos no centro para multiplicar 3+ armas.'],
  ['Estouro da Boiada', 'Barris-Bomba e Esqueletos correm juntos pela pista.'],
  ['Canto das Adagas', 'Adagas ao lado de Voodoo ganham crítico mortal!'],
  ['Vigilância Aérea', 'Onda forte de Morcegos liderada por Xamãs curandeiros.'],
  ['Duelo do Beco', 'Chefe Cavaleiro com escolta de Xamãs e Ogros.'],

  ['Cerco Noturno', 'Gárgulas de Ferro chegam pelos ares com armadura!'],
  ['Forja Acelerada', 'Lampiões dão velocidade e financiam fusões Nv.3 ★★.'],
  ['Frio Cortante', 'Orbes Glaciais seguram a onda enquanto a Bruxa age.'],
  ['Lâminas Gêmeas', 'Duas Espadas empurram a linha de frente inteira!'],
  ['Bruxo do Coreto', 'Chefão invocador! Corte a cura com foco em Voodoo.'],
  ['Muralha Viva', 'Horda longa de 5 ondas testando sustentabilidade e cura.'],
  ['Tempestade de Raios', 'Tomos em cadeia limpam enxames antes do meio da pista.'],
  ['Martelo e Bigorna', 'Machado Rúnico + Espada + Gelo formam a linha perfeita.'],
  ['Invasão Aérea', 'Gárgulas e Morcegos exigem Bestas e Orbes evoluídos.'],
  ['O Grande Bruxo', 'Chefe do Capítulo 3 com escolta pesada e enxame aéreo.'],

  ['Coreto Final', 'Bem-vindo ao ato final: mire em peças Lendárias ★★★!'],
  ['Alquimia Suprema', 'Múltiplas hordas mistas: veneno, controle e corte são vitais.'],
  ['Batalhão Blindado', 'Ogros e Gárgulas de elite marcham em fileira fechada.'],
  ['Ritual Sombrio', 'Xamãs curandeiros em massa — elimine com Voodoo e Besta.'],
  ['Titã da Barraca', 'Mini-final com o Colosso e tropa de choque explosiva!'],
  ['Corrida Contra o Relógio', 'Velocidade extrema: priorize Orbe Glacial e Espada.'],
  ['Ouro da Quermesse', 'Use Lampiões cedo para financiar um arsenal Nv.4!'],
  ['Barreira Inabalável', 'Escudos evoluídos + Voodoo seguram ondas implacáveis.'],
  ['Véspera do Juízo', '6 hordas brutais preparando para o grande chefe final.'],
  ['Grande Final do Coreto', '7 Hordas épicas culminando no Colosso + Cavaleiro Piche!'],
];

function createLevel(id) {
  const [title, hint] = STAGE_META[id - 1];
  const chapter = Math.ceil(id / 10);
  const waveCount = id <= 4 ? 3 : id <= 14 ? 4 : id <= 28 ? 5 : id <= 39 ? 6 : 7;
  const presetKey =
    id <= 8
      ? 'box_4x4'
      : id <= 16
        ? 'cross_18'
        : id <= 24
          ? 'box_5x4'
          : id <= 32
            ? 'fort_24'
            : 'box_5x5';

  const startGold =
    id === 1
      ? 11
      : id <= 4
        ? 14 + id
        : id <= 10
          ? 16 + id
          : id <= 20
            ? 22 + Math.round((id - 10) * 1.2)
            : id <= 30
              ? 34 + Math.round((id - 20) * 1.4)
              : 48 + Math.round((id - 30) * 1.6);

  const wallMaxHp = 100 + (chapter - 1) * 25 + (id === 40 ? 25 : 0);
  const freeExpandsPerWave = 3;

  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const groups = buildWaveGroups(id, w, waveCount);
    waves.push({
      index: w,
      groups,
      clearGold: 5 + Math.floor(id * 0.35) + w * 2,
    });
  }

  const starterPieces =
    id === 1
      ? [{ pieceId: 'shield', tier: 1, col: 1, row: 1, rot: 0 }]
      : [];

  return {
    id,
    chapter,
    title,
    hint,
    presetKey,
    startMask: GRID_PRESETS[presetKey],
    startGold,
    wallMaxHp,
    freeExpandsPerWave,
    starterPieces,
    waves,
  };
}

export const LEVELS = Array.from({ length: 40 }, (_, i) => createLevel(i + 1));

export function getLevel(id) {
  const n = clamp(Math.round(Number(id) || 1), 1, LEVELS.length);
  return LEVELS[n - 1];
}

// ---------- Operações na Grade, Expansão, Fusão & Sinergias ----------

export function createGridState(level) {
  const open = level.startMask.map((row) => row.slice());
  const pieces = [];
  let nextUid = 1;
  for (const sp of level.starterPieces || []) {
    pieces.push({
      uid: nextUid++,
      pieceId: sp.pieceId,
      tier: sp.tier || 1,
      col: sp.col,
      row: sp.row,
      rot: sp.rot || 0,
      cdLeft: 0,
      flash: 0,
    });
  }
  return { open, pieces, nextUid };
}

export function isAdjacentToOpen(grid, col, row) {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return false;
  if (grid.open[row][col]) return false;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dc, dr] of dirs) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS && grid.open[nr][nc]) {
      return true;
    }
  }
  return false;
}

export function countLockedAdjacent(grid) {
  let count = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (isAdjacentToOpen(grid, c, r)) count++;
    }
  }
  return count;
}

export function expandGridCell(run, col, row) {
  const grid = run.grid;
  if (!isAdjacentToOpen(grid, col, row)) return { ok: false, reason: 'not-adjacent' };
  if (run.freeExpands > 0) {
    run.freeExpands--;
    grid.open[row][col] = true;
    return { ok: true, free: true };
  }
  if (run.gold < EXPAND_COST) return { ok: false, reason: 'no-gold' };
  run.gold -= EXPAND_COST;
  grid.open[row][col] = true;
  return { ok: true, free: false };
}

export function autoSpendFreeExpands(run) {
  // Se sobrarem expansões grátis antes de iniciar a horda, abre casas estratégicas automaticamente
  let opened = 0;
  while (run.freeExpands > 0) {
    const candidates = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (isAdjacentToOpen(run.grid, c, r)) {
          // Prefere células centrais para facilitar peças de 2 e 3 espaços
          const centerScore = 7 - (Math.abs(c - 2.5) + Math.abs(r - 2.5));
          candidates.push({ c, r, centerScore });
        }
      }
    }
    if (candidates.length === 0) {
      run.freeExpands = 0;
      break;
    }
    candidates.sort((a, b) => b.centerScore - a.centerScore);
    run.grid.open[candidates[0].r][candidates[0].c] = true;
    run.freeExpands--;
    opened++;
  }
  return opened;
}

export function buildOccupancyMap(grid, ignoreUid = null) {
  const map = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
  for (const p of grid.pieces) {
    if (p.uid === ignoreUid) continue;
    for (const [c, r] of pieceCellsAt(p.pieceId, p.col, p.row, p.rot)) {
      if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
        map[r][c] = p;
      }
    }
  }
  return map;
}

export function canPlacePiece(grid, pieceId, col, row, rot = 0, ignoreUid = null) {
  const cells = pieceCellsAt(pieceId, col, row, rot);
  const occ = buildOccupancyMap(grid, ignoreUid);
  for (const [c, r] of cells) {
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return false;
    if (!grid.open[r][c]) return false;
    if (occ[r][c]) return false;
  }
  return true;
}

export function findMergeTarget(grid, pieceId, tier, col, row, rot = 0, ignoreUid = null) {
  if (tier >= MAX_TIER) return null;
  const cells = pieceCellsAt(pieceId, col, row, rot);
  const occ = buildOccupancyMap(grid, ignoreUid);
  for (const [c, r] of cells) {
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) continue;
    const hit = occ[r][c];
    if (hit && hit.pieceId === pieceId && hit.tier === tier) {
      return hit;
    }
  }
  return null;
}

export function findFirstValidPlacement(grid, pieceId, prefRot = null) {
  const def = PIECES[pieceId];
  if (!def) return null;
  const rots = [];
  if (prefRot !== null) rots.push(prefRot % def.rotCount);
  for (let r = 0; r < def.rotCount; r++) {
    if (!rots.includes(r)) rots.push(r);
  }
  for (const rot of rots) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (canPlacePiece(grid, pieceId, col, row, rot)) {
          return { col, row, rot };
        }
      }
    }
  }
  return null;
}

export function computeGridSynergies(grid) {
  const occ = buildOccupancyMap(grid);
  const neighborsOf = new Map();
  for (const p of grid.pieces) neighborsOf.set(p.uid, new Set());

  for (const p of grid.pieces) {
    const seen = neighborsOf.get(p.uid);
    for (const [c, r] of pieceCellsAt(p.pieceId, p.col, p.row, p.rot)) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
          const other = occ[nr][nc];
          if (other && other.uid !== p.uid) {
            seen.add(other);
          }
        }
      }
    }
  }

  const byUid = new Map();
  const links = [];

  for (const p of grid.pieces) {
    const neighs = Array.from(neighborsOf.get(p.uid));
    let dmgMult = 1.0;
    let spdMult = 1.0;
    let armorMult = 1.0;
    let critBonus = 0;

    for (const n of neighs) {
      const tBonus = 1 + (n.tier - 1) * 0.42;
      if (n.pieceId === 'tome') {
        dmgMult += PIECES.tome.powerAura * tBonus;
        if (p.uid < n.uid || p.pieceId !== 'tome') links.push({ from: n.uid, to: p.uid, color: '#a882ff' });
      }
      if (n.pieceId === 'lantern') {
        spdMult += PIECES.lantern.hasteAura * tBonus;
        if (p.uid < n.uid || p.pieceId !== 'lantern') links.push({ from: n.uid, to: p.uid, color: '#f7b733' });
      }
      if (p.pieceId === 'shield' && (n.pieceId === 'shield' || n.pieceId === 'sword' || n.pieceId === 'axe')) {
        armorMult += 0.22;
        links.push({ from: n.uid, to: p.uid, color: '#78b4ff' });
      }
      if (p.pieceId === 'sword' && n.pieceId === 'shield') {
        dmgMult += 0.22;
      }
      if (p.pieceId === 'dagger' && (n.pieceId === 'voodoo' || n.pieceId === 'witch')) {
        critBonus += 0.18;
        links.push({ from: n.uid, to: p.uid, color: '#6df0a4' });
      }
    }

    byUid.set(p.uid, {
      dmgMult,
      spdMult,
      armorMult,
      critBonus,
      buffed: dmgMult > 1.01 || spdMult > 1.01 || armorMult > 1.01 || critBonus > 0,
    });
  }

  return { byUid, links };
}

export function estimateGridDps(grid) {
  const syn = computeGridSynergies(grid);
  let dps = 0;
  let startArmor = 0;
  for (const p of grid.pieces) {
    const def = PIECES[p.pieceId];
    const mult = TIERS[p.tier].mult;
    const s = syn.byUid.get(p.uid);
    if (p.pieceId === 'shield') {
      startArmor += Math.round(def.armor * mult * s.armorMult);
      continue;
    }
    if (!def.dmg || def.cd <= 0) continue;
    const effCd = def.cd / s.spdMult;
    let avgHit = def.dmg * mult * s.dmgMult;
    if (def.critChance) {
      const cc = clamp(def.critChance + (p.tier - 1) * 0.06 + s.critBonus, 0, 0.95);
      avgHit *= 1 + cc;
    }
    if (def.poisonDps) avgHit += def.poisonDps * mult * s.dmgMult * 2.5;
    if (def.chains) avgHit *= 1.8;
    if (def.pierce) avgHit *= 1.45;
    if (def.aoe) avgHit *= 1.35;
    if (def.maxTargets) avgHit *= 1.65;
    dps += avgHit / effCd;
  }
  return { dps: Math.round(dps), startArmor, linkCount: syn.links.length };
}

export function pieceSellValue(piece) {
  const base = PIECES[piece.pieceId]?.cost || 3;
  const totalInvested = base * Math.pow(2, (piece.tier || 1) - 1);
  return Math.max(2, Math.round(totalInvested * 0.7));
}

export function pieceEffectiveCost(pieceId, tier = 1) {
  const base = PIECES[pieceId].cost;
  if (tier <= 1) return base;
  return Math.round(base * 1.85 * Math.pow(2, tier - 2));
}

// ---------- Loja & Economia ----------

export function rollShop(run) {
  const ownedIds = new Set([
    ...run.grid.pieces.map((p) => p.pieceId),
    ...run.tray.filter(Boolean).map((p) => p.pieceId),
  ]);

  const prevShop = run.shop || [];
  const nextShop = [];

  for (let i = 0; i < SHOP_SLOTS; i++) {
    const prev = prevShop[i];
    if (prev && prev.locked) {
      nextShop.push({ ...prev });
      continue;
    }

    // Bias justo para favorecer fusões com peças que o jogador já possui (~40% de chance)
    let pieceId;
    if (ownedIds.size > 0 && run.rng() < 0.42) {
      const ownedArr = Array.from(ownedIds);
      pieceId = ownedArr[Math.floor(run.rng() * ownedArr.length)];
    } else {
      pieceId = PIECE_IDS[Math.floor(run.rng() * PIECE_IDS.length)];
    }

    // A partir da onda 2 (ou fases médias/altas já na onda 1), chance crescente de vir peça Nv.2 na loja
    // Na onda 1 (slot 0 e 1) garante ofertas Nv.1 acessíveis e pelo menos uma peça ofensiva direta
    let tier = 1;
    const t2Chance = clamp(run.waveIdx * 0.065 + Math.max(0, run.level.id - 12) * 0.01, 0, 0.4);
    if ((run.waveIdx >= 1 || (run.level.id >= 14 && i === 2)) && run.rng() < t2Chance) {
      tier = 2;
    }

    if (run.waveIdx === 0 && i === 0 && (pieceId === 'lantern' || pieceId === 'shield')) {
      const attackers = ['witch', 'sword', 'crossbow', 'dagger', 'voodoo', 'axe', 'tome'];
      pieceId = attackers[Math.floor(run.rng() * attackers.length)];
    }

    nextShop.push({
      slot: i,
      pieceId,
      tier,
      cost: pieceEffectiveCost(pieceId, tier),
      locked: false,
    });
  }

  run.shop = nextShop;
  return nextShop;
}

export function createStageRun(levelOrId, rngFn = Math.random) {
  const level = typeof levelOrId === 'number' ? getLevel(levelOrId) : levelOrId;
  const grid = createGridState(level);
  const run = {
    level,
    rng: rngFn,
    grid,
    tray: Array(TRAY_SLOTS).fill(null),
    shop: [],
    gold: level.startGold,
    freeExpands: 0,
    wallHp: level.wallMaxHp,
    wallMaxHp: level.wallMaxHp,
    wallArmor: 0,
    waveIdx: 0,
    phase: 'prep', // 'prep' | 'combat' | 'won' | 'lost'
    stars: 0,
    combat: null,
    stats: {
      kills: 0,
      merges: 0,
      dmgTotal: 0,
    },
  };
  rollShop(run);
  return run;
}

export function rerollShop(run) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  if (run.gold < REROLL_COST) return { ok: false, reason: 'no-gold' };
  run.gold -= REROLL_COST;
  rollShop(run);
  return { ok: true };
}

export function toggleShopLock(run, slotIdx) {
  const item = run.shop[slotIdx];
  if (!item) return false;
  item.locked = !item.locked;
  return item.locked;
}

export function hasMatchingPiece(run, pieceId, tier) {
  if (tier >= MAX_TIER) return false;
  return (
    run.grid.pieces.some((p) => p.pieceId === pieceId && p.tier === tier) ||
    run.tray.some((p) => p && p.pieceId === pieceId && p.tier === tier)
  );
}

export function buyShopToGrid(run, slotIdx, col, row, rot = 0) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  const offer = run.shop[slotIdx];
  if (!offer) return { ok: false, reason: 'empty-slot' };
  if (run.gold < offer.cost) return { ok: false, reason: 'no-gold' };

  const mergeTarget = findMergeTarget(run.grid, offer.pieceId, offer.tier, col, row, rot);
  if (mergeTarget) {
    run.gold -= offer.cost;
    mergeTarget.tier = Math.min(MAX_TIER, mergeTarget.tier + 1);
    mergeTarget.flash = 0.6;
    run.shop[slotIdx] = null;
    run.stats.merges++;
    return { ok: true, merged: true, piece: mergeTarget };
  }

  if (!canPlacePiece(run.grid, offer.pieceId, col, row, rot)) {
    return { ok: false, reason: 'invalid-pos' };
  }

  run.gold -= offer.cost;
  const piece = {
    uid: run.grid.nextUid++,
    pieceId: offer.pieceId,
    tier: offer.tier,
    col,
    row,
    rot: rot % PIECES[offer.pieceId].rotCount,
    cdLeft: 0,
    flash: 0.35,
  };
  run.grid.pieces.push(piece);
  run.shop[slotIdx] = null;
  return { ok: true, merged: false, piece };
}

export function buyShopToTray(run, slotIdx, trayIdx = -1) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  const offer = run.shop[slotIdx];
  if (!offer) return { ok: false, reason: 'empty-slot' };
  if (run.gold < offer.cost) return { ok: false, reason: 'no-gold' };

  if (trayIdx >= 0 && trayIdx < TRAY_SLOTS) {
    const existing = run.tray[trayIdx];
    if (existing && existing.pieceId === offer.pieceId && existing.tier === offer.tier && existing.tier < MAX_TIER) {
      run.gold -= offer.cost;
      existing.tier++;
      run.shop[slotIdx] = null;
      run.stats.merges++;
      return { ok: true, merged: true, piece: existing };
    }
    if (existing) return { ok: false, reason: 'tray-occupied' };
  } else {
    trayIdx = run.tray.findIndex((x) => x === null);
    if (trayIdx < 0) return { ok: false, reason: 'tray-full' };
  }

  run.gold -= offer.cost;
  const piece = {
    uid: run.grid.nextUid++,
    pieceId: offer.pieceId,
    tier: offer.tier,
    col: 0,
    row: 0,
    rot: 0,
    cdLeft: 0,
    flash: 0.35,
  };
  run.tray[trayIdx] = piece;
  run.shop[slotIdx] = null;
  return { ok: true, merged: false, piece, trayIdx };
}

export function moveGridPiece(run, uid, col, row, rot) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  const idx = run.grid.pieces.findIndex((p) => p.uid === uid);
  if (idx < 0) return { ok: false, reason: 'not-found' };
  const piece = run.grid.pieces[idx];
  const rNorm = rot % PIECES[piece.pieceId].rotCount;

  const mergeTarget = findMergeTarget(run.grid, piece.pieceId, piece.tier, col, row, rNorm, piece.uid);
  if (mergeTarget) {
    mergeTarget.tier = Math.min(MAX_TIER, mergeTarget.tier + 1);
    mergeTarget.flash = 0.6;
    run.grid.pieces.splice(idx, 1);
    run.stats.merges++;
    return { ok: true, merged: true, piece: mergeTarget };
  }

  if (!canPlacePiece(run.grid, piece.pieceId, col, row, rNorm, piece.uid)) {
    return { ok: false, reason: 'invalid-pos' };
  }

  piece.col = col;
  piece.row = row;
  piece.rot = rNorm;
  return { ok: true, merged: false, piece };
}

export function moveTrayToGrid(run, trayIdx, col, row, rot = 0) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  const piece = run.tray[trayIdx];
  if (!piece) return { ok: false, reason: 'empty-tray' };
  const rNorm = rot % PIECES[piece.pieceId].rotCount;

  const mergeTarget = findMergeTarget(run.grid, piece.pieceId, piece.tier, col, row, rNorm);
  if (mergeTarget) {
    mergeTarget.tier = Math.min(MAX_TIER, mergeTarget.tier + 1);
    mergeTarget.flash = 0.6;
    run.tray[trayIdx] = null;
    run.stats.merges++;
    return { ok: true, merged: true, piece: mergeTarget };
  }

  if (!canPlacePiece(run.grid, piece.pieceId, col, row, rNorm)) {
    return { ok: false, reason: 'invalid-pos' };
  }

  piece.col = col;
  piece.row = row;
  piece.rot = rNorm;
  run.grid.pieces.push(piece);
  run.tray[trayIdx] = null;
  return { ok: true, merged: false, piece };
}

export function moveGridToTray(run, uid, trayIdx = -1) {
  if (run.phase !== 'prep') return { ok: false, reason: 'not-prep' };
  const idx = run.grid.pieces.findIndex((p) => p.uid === uid);
  if (idx < 0) return { ok: false, reason: 'not-found' };
  const piece = run.grid.pieces[idx];

  if (trayIdx >= 0 && trayIdx < TRAY_SLOTS) {
    const existing = run.tray[trayIdx];
    if (existing && existing.pieceId === piece.pieceId && existing.tier === piece.tier && existing.tier < MAX_TIER) {
      existing.tier++;
      run.grid.pieces.splice(idx, 1);
      run.stats.merges++;
      return { ok: true, merged: true, piece: existing };
    }
    if (existing) return { ok: false, reason: 'tray-occupied' };
  } else {
    trayIdx = run.tray.findIndex((x) => x === null);
    if (trayIdx < 0) return { ok: false, reason: 'tray-full' };
  }

  run.grid.pieces.splice(idx, 1);
  run.tray[trayIdx] = piece;
  return { ok: true, merged: false, piece, trayIdx };
}

export function moveTrayToTray(run, fromIdx, toIdx) {
  if (run.phase !== 'prep' || fromIdx === toIdx) return { ok: false };
  const src = run.tray[fromIdx];
  if (!src) return { ok: false };
  const dst = run.tray[toIdx];
  if (dst && dst.pieceId === src.pieceId && dst.tier === src.tier && dst.tier < MAX_TIER) {
    dst.tier++;
    run.tray[fromIdx] = null;
    run.stats.merges++;
    return { ok: true, merged: true, piece: dst };
  }
  run.tray[toIdx] = src;
  run.tray[fromIdx] = dst || null;
  return { ok: true, merged: false, piece: src };
}

export function rotateGridPiece(run, uid) {
  if (run.phase !== 'prep') return { ok: false };
  const p = run.grid.pieces.find((x) => x.uid === uid);
  if (!p) return { ok: false };
  const def = PIECES[p.pieceId];
  if (def.rotCount <= 1) return { ok: false };
  const nextRot = (p.rot + 1) % def.rotCount;
  // Tenta no mesmo ponto ou com pequeno deslocamento para caber perto das bordas
  const offsets = [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-2, 0], [0, -2]];
  for (const [dc, dr] of offsets) {
    if (canPlacePiece(run.grid, p.pieceId, p.col + dc, p.row + dr, nextRot, p.uid)) {
      p.col += dc;
      p.row += dr;
      p.rot = nextRot;
      return { ok: true, piece: p };
    }
  }
  return { ok: false, reason: 'blocked' };
}

export function sellPiece(run, source, idOrSlot) {
  if (run.phase !== 'prep') return { ok: false };
  if (source === 'grid') {
    const idx = run.grid.pieces.findIndex((p) => p.uid === idOrSlot);
    if (idx < 0) return { ok: false };
    const [removed] = run.grid.pieces.splice(idx, 1);
    const val = pieceSellValue(removed);
    run.gold += val;
    return { ok: true, gold: val };
  }
  if (source === 'tray') {
    const p = run.tray[idOrSlot];
    if (!p) return { ok: false };
    const val = pieceSellValue(p);
    run.tray[idOrSlot] = null;
    run.gold += val;
    return { ok: true, gold: val };
  }
  return { ok: false };
}

// ---------- Simulação de Combate Vertical (Topo -> Base) ----------

const LANE_XS = [82, 180, 278];

function spawnEnemy(combat, type, scale, rng) {
  const def = ENEMIES[type];
  const lane = Math.floor(rng() * LANE_XS.length);
  const x = LANE_XS[lane] + (rng() - 0.5) * 28;
  const maxHp = Math.round(def.hp * scale);
  const maxArmor = Math.round((def.armor || 0) * scale);
  const enemy = {
    id: combat.nextEnemyId++,
    type,
    def,
    x,
    y: SPAWN_Y - rng() * 14,
    hp: maxHp,
    maxHp,
    armor: maxArmor,
    maxArmor,
    dmg: Math.max(2, Math.round(def.dmg * (0.8 + scale * 0.2))),
    atkLeft: 0.4,
    healLeft: def.healCd || 0,
    summonLeft: def.summonCd || 0,
    slowLeft: 0,
    slowPct: 0,
    stunLeft: 0,
    poisonStacks: [], // { dps, left }
    curseLeft: 0,
    curseAmp: 0,
    hitFlash: 0,
    walkPhase: rng() * Math.PI * 2,
  };
  combat.enemies.push(enemy);
  return enemy;
}

export function startWave(run) {
  if (run.phase !== 'prep') return false;
  if (run.freeExpands > 0) autoSpendFreeExpands(run);

  const wave = run.level.waves[run.waveIdx];
  if (!wave) return false;

  const syn = computeGridSynergies(run.grid);
  let startArmor = 0;

  run.grid.pieces.forEach((p, idx) => {
    const def = PIECES[p.pieceId];
    const mult = TIERS[p.tier].mult;
    const s = syn.byUid.get(p.uid);
    if (p.pieceId === 'shield') {
      startArmor += Math.round(def.armor * mult * s.armorMult);
    }
    p.cdLeft = def.cd > 0 ? Math.min(0.45, 0.06 + idx * 0.07) : 0;
    p.cdTotal = def.cd > 0 ? def.cd / s.spdMult : 1;
    p.flash = 0;
  });

  run.wallArmor = startArmor;

  const spawners = wave.groups.map((g) => ({
    type: g.type,
    rem: g.count,
    interval: g.interval,
    timer: g.delay || 0.2,
    scale: g.scale,
  }));
  const totalEnemies = wave.groups.reduce((s, g) => s + g.count, 0);

  run.combat = {
    t: 0,
    wave,
    spawners,
    totalEnemies,
    waveKills: 0,
    enemies: [],
    projectiles: [],
    slashes: [],
    beams: [],
    zones: [],
    shockwaves: [],
    popups: [],
    particles: [],
    nextEnemyId: 1,
    synergies: syn,
    wallFlash: 0,
    events: [],
  };
  run.phase = 'combat';
  return true;
}

function addPopup(combat, x, y, text, color = '#fff8ea', big = false) {
  if (combat.popups.length > 48) return;
  combat.popups.push({ x, y, text, color, big, life: 0.72, maxLife: 0.72 });
}

function addBurst(combat, x, y, color, count = 6) {
  if (combat.particles.length > 140) return;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 28 + Math.random() * 68;
    combat.particles.push({
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 14,
      color,
      life: 0.38 + Math.random() * 0.22,
      maxLife: 0.55,
      size: 2.2 + Math.random() * 2,
    });
  }
}

function dealDamageToEnemy(run, combat, enemy, rawDmg, opts = {}) {
  if (!enemy || enemy.hp <= 0) return 0;
  const {
    ignoreArmor = false,
    armorMult = 1.0,
    isCrit = false,
    color = '#fff8ea',
    silentPopup = false,
  } = opts;

  let dmg = rawDmg;
  if (enemy.curseLeft > 0) {
    dmg *= 1 + enemy.curseAmp;
  }
  dmg = Math.max(1, Math.round(dmg));

  let dealt = 0;
  if (!ignoreArmor && enemy.armor > 0) {
    const armDmg = Math.round(dmg * armorMult);
    if (armDmg >= enemy.armor) {
      const leftoverRatio = (armDmg - enemy.armor) / Math.max(1, armDmg);
      dealt += enemy.armor;
      enemy.armor = 0;
      const hpDmg = Math.round(dmg * leftoverRatio);
      enemy.hp -= hpDmg;
      dealt += hpDmg;
      addPopup(combat, enemy.x, enemy.y - 16, 'QUEBROU!', '#ffd75e', true);
      combat.events.push({ type: 'armorBreak', x: enemy.x, y: enemy.y });
    } else {
      enemy.armor -= armDmg;
      dealt += armDmg;
    }
  } else {
    enemy.hp -= dmg;
    dealt += dmg;
  }

  enemy.hitFlash = 0.14;
  run.stats.dmgTotal += dealt;

  if (!silentPopup) {
    addPopup(
      combat,
      enemy.x + (Math.random() - 0.5) * 10,
      enemy.y - enemy.def.radius - 6,
      isCrit ? `CRÍT ${dealt}!` : `-${dealt}`,
      isCrit ? '#ffd75e' : color,
      isCrit
    );
  }
  return dealt;
}

function damageWall(run, combat, rawDmg) {
  let rem = Math.max(1, Math.round(rawDmg));
  if (run.wallArmor > 0) {
    const abs = Math.min(run.wallArmor, rem);
    run.wallArmor -= abs;
    rem -= abs;
  }
  if (rem > 0) {
    run.wallHp = Math.max(0, run.wallHp - rem);
  }
  combat.wallFlash = 0.22;
  combat.events.push({ type: 'wallHit', dmg: rawDmg });
  if (run.wallHp <= 0) {
    run.phase = 'lost';
  }
}

function pieceOriginX(p) {
  const { w } = pieceBounds(p.pieceId, p.rot);
  return 28 + ((p.col + w * 0.5) / GRID_COLS) * (ARENA_W - 56);
}

function pickBestTarget(enemies, mode = 'nearest', filterFn = null) {
  let best = null;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (filterFn && !filterFn(e)) continue;
    if (!best) {
      best = e;
      continue;
    }
    if (mode === 'nearest' && e.y > best.y) best = e;
    else if (mode === 'strongest' && e.hp + e.armor > best.hp + best.armor) best = e;
    else if (mode === 'armored' && (e.armor > best.armor || (e.armor === best.armor && e.y > best.y))) best = e;
    else if (mode === 'flying' && ((e.def.flying && !best.def.flying) || (e.def.flying === best.def.flying && e.y > best.y))) {
      best = e;
    }
  }
  return best;
}

function triggerPiece(run, combat, p) {
  const def = PIECES[p.pieceId];
  const tier = p.tier;
  const mult = TIERS[tier].mult;
  const syn = combat.synergies.byUid.get(p.uid) || { dmgMult: 1, spdMult: 1, armorMult: 1, critBonus: 0 };
  const enemies = combat.enemies;
  const ox = pieceOriginX(p);
  const oy = WALL_Y - 2;

  if (p.pieceId === 'shield') {
    const gain = Math.round(def.regen * mult * syn.armorMult);
    run.wallArmor += gain;
    p.flash = 0.32;
    addPopup(combat, ox, WALL_Y + 12, `+${gain} 🛡️`, '#78b4ff');
    combat.events.push({ type: 'shield', uid: p.uid });
    return;
  }

  if (enemies.length === 0) {
    p.cdLeft = 0.08;
    return;
  }

  if (p.pieceId === 'sword') {
    const reach = def.rangeY + (tier - 1) * 18;
    const minY = WALL_Y - reach;
    const inRange = enemies
      .filter((e) => e.hp > 0 && e.y >= minY)
      .sort((a, b) => b.y - a.y);
    if (inRange.length === 0) {
      p.cdLeft = 0.08;
      return;
    }
    const maxHits = def.maxTargets + (tier - 1);
    const dmg = def.dmg * mult * syn.dmgMult;
    const kb = def.knockback + (tier - 1) * 4;
    const targets = inRange.slice(0, maxHits);
    for (const e of targets) {
      dealDamageToEnemy(run, combat, e, dmg, { color: '#fff8ea' });
      e.y = Math.max(SPAWN_Y + 10, e.y - (e.def.boss ? kb * 0.35 : kb));
    }
    combat.slashes.push({
      x: ox,
      y: WALL_Y - 12,
      reach: Math.min(reach, 180),
      life: 0.24,
      maxLife: 0.24,
      color: TIERS[tier].color,
    });
    p.flash = 0.35;
    combat.events.push({ type: 'attack', pieceId: 'sword', uid: p.uid });
    return;
  }

  if (p.pieceId === 'tome') {
    const first = pickBestTarget(enemies, 'nearest');
    if (!first) return;
    const jumps = def.chains + (tier - 1);
    const dmg = def.dmg * mult * syn.dmgMult;
    const hitIds = new Set();
    const pts = [{ x: ox, y: oy }];
    let cur = first;
    for (let j = 0; j < jumps && cur; j++) {
      hitIds.add(cur.id);
      pts.push({ x: cur.x, y: cur.y });
      dealDamageToEnemy(run, combat, cur, dmg, { color: '#c7a6ff' });
      let next = null;
      let bestDist = Infinity;
      for (const cand of enemies) {
        if (cand.hp <= 0 || hitIds.has(cand.id)) continue;
        const d = Math.hypot(cand.x - cur.x, cand.y - cur.y);
        if (d < 135 && d < bestDist) {
          bestDist = d;
          next = cand;
        }
      }
      cur = next;
    }
    combat.beams.push({ pts, life: 0.25, maxLife: 0.25, color: '#b48cff' });
    p.flash = 0.35;
    combat.events.push({ type: 'attack', pieceId: 'tome', uid: p.uid });
    return;
  }

  if (p.pieceId === 'dagger') {
    const target = pickBestTarget(enemies, 'nearest');
    if (!target) return;
    const isCrit = run.rng() < def.critChance + (tier - 1) * 0.06 + syn.critBonus;
    const dmg = def.dmg * mult * syn.dmgMult * (isCrit ? def.critMult : 1);
    combat.projectiles.push({
      kind: 'dagger',
      x: ox,
      y: oy,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      speed: 440,
      dmg,
      isCrit,
      color: isCrit ? '#ffd75e' : '#e6eff7',
    });
    p.flash = 0.22;
    combat.events.push({ type: 'attack', pieceId: 'dagger', uid: p.uid });
    return;
  }

  if (p.pieceId === 'witch') {
    const target = pickBestTarget(enemies, 'nearest');
    if (!target) return;
    const dmg = def.dmg * mult * syn.dmgMult;
    const poisonDps = def.poisonDps * mult * syn.dmgMult;
    combat.projectiles.push({
      kind: 'witch',
      x: ox,
      y: oy,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      speed: 250,
      arc: 28,
      dmg,
      aoe: def.aoe + (tier - 1) * 6,
      poisonDps,
      poisonDur: def.poisonDur,
      color: '#6df0a4',
      progress: 0,
      sx: ox,
      sy: oy,
    });
    p.flash = 0.35;
    combat.events.push({ type: 'attack', pieceId: 'witch', uid: p.uid });
    return;
  }

  if (p.pieceId === 'voodoo') {
    const target = pickBestTarget(enemies, 'strongest');
    if (!target) return;
    const dmg = def.dmg * mult * syn.dmgMult;
    const heal = Math.round(def.heal * mult * syn.dmgMult);
    const curseAmp = def.curseAmp + (tier - 1) * 0.09;
    dealDamageToEnemy(run, combat, target, dmg, { ignoreArmor: true, color: '#ff8fd8' });
    target.curseLeft = def.curseDur;
    target.curseAmp = Math.max(target.curseAmp, curseAmp);
    run.wallHp = Math.min(run.wallMaxHp, run.wallHp + heal);
    combat.beams.push({
      pts: [{ x: ox, y: oy }, { x: target.x, y: target.y }],
      life: 0.24,
      maxLife: 0.24,
      color: '#ff6d9c',
    });
    addPopup(combat, ox, WALL_Y + 10, `+${heal} ♥`, '#6df0a4');
    p.flash = 0.35;
    combat.events.push({ type: 'attack', pieceId: 'voodoo', uid: p.uid });
    return;
  }

  if (p.pieceId === 'ice_orb') {
    const target = pickBestTarget(enemies, 'nearest');
    if (!target) return;
    const dmg = def.dmg * mult * syn.dmgMult;
    const slowPct = clamp(def.slowPct + (tier - 1) * 0.06, 0.25, 0.62);
    combat.projectiles.push({
      kind: 'ice',
      x: ox,
      y: oy,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      speed: 290,
      dmg,
      aoe: def.aoe + (tier - 1) * 5,
      slowPct,
      slowDur: def.slowDur,
      color: '#7ceeff',
    });
    p.flash = 0.32;
    combat.events.push({ type: 'attack', pieceId: 'ice_orb', uid: p.uid });
    return;
  }

  if (p.pieceId === 'crossbow') {
    const target = pickBestTarget(enemies, 'flying');
    if (!target) return;
    const dmg = def.dmg * mult * syn.dmgMult;
    const dx = target.x - ox;
    const dy = target.y - oy;
    const len = Math.max(1, Math.hypot(dx, dy));
    combat.projectiles.push({
      kind: 'bolt',
      x: ox,
      y: oy,
      vx: (dx / len) * 500,
      vy: (dy / len) * 500,
      dmg,
      airBonus: def.airBonus,
      pierceLeft: def.pierce + (tier >= 3 ? 1 : 0) + (tier >= 5 ? 1 : 0),
      hitIds: new Set(),
      color: '#ffd75e',
    });
    p.flash = 0.28;
    combat.events.push({ type: 'attack', pieceId: 'crossbow', uid: p.uid });
    return;
  }

  if (p.pieceId === 'axe') {
    const target = pickBestTarget(enemies, 'armored');
    if (!target) return;
    const dmg = def.dmg * mult * syn.dmgMult;
    combat.projectiles.push({
      kind: 'axe',
      x: ox,
      y: oy,
      targetId: target.id,
      tx: target.x,
      ty: target.y,
      speed: 260,
      dmg,
      aoe: def.aoe + (tier - 1) * 5,
      armorMult: def.armorMult,
      stunDur: def.stunDur + (tier - 1) * 0.14,
      color: '#ff7a5c',
      spin: 0,
    });
    p.flash = 0.35;
    combat.events.push({ type: 'attack', pieceId: 'axe', uid: p.uid });
  }
}

function addShockwave(combat, x, y, maxR, color) {
  if (combat.shockwaves.length > 24) return;
  combat.shockwaves.push({ x, y, maxR, color, life: 0.34, maxLife: 0.34 });
}

function addZone(combat, kind, x, y, r, color) {
  if (combat.zones.length > 16) combat.zones.shift();
  combat.zones.push({ kind, x, y, r, color, life: 1.5, maxLife: 1.5 });
}

function resolveProjectileHit(run, combat, proj) {
  const enemies = combat.enemies;
  if (proj.kind === 'witch') {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - proj.tx, e.y - proj.ty) <= proj.aoe + e.def.radius) {
        dealDamageToEnemy(run, combat, e, proj.dmg, { color: '#9cf0b8' });
        if (e.poisonStacks.length < 3) {
          e.poisonStacks.push({ dps: proj.poisonDps, left: proj.poisonDur });
        } else {
          // Renova a carga mais antiga
          e.poisonStacks.sort((a, b) => a.left - b.left);
          e.poisonStacks[0] = { dps: Math.max(e.poisonStacks[0].dps, proj.poisonDps), left: proj.poisonDur };
        }
      }
    }
    addZone(combat, 'poison', proj.tx, proj.ty, proj.aoe * 0.72, '#6df0a4');
    addShockwave(combat, proj.tx, proj.ty, proj.aoe, '#6df0a4');
    addBurst(combat, proj.tx, proj.ty, '#6df0a4', 10);
  } else if (proj.kind === 'ice') {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - proj.tx, e.y - proj.ty) <= proj.aoe + e.def.radius) {
        dealDamageToEnemy(run, combat, e, proj.dmg, { color: '#7ceeff' });
        e.slowLeft = Math.max(e.slowLeft, proj.slowDur);
        e.slowPct = Math.max(e.slowPct, proj.slowPct);
      }
    }
    addZone(combat, 'frost', proj.tx, proj.ty, proj.aoe * 0.78, '#7ceeff');
    addShockwave(combat, proj.tx, proj.ty, proj.aoe, '#9ff0ff');
    addBurst(combat, proj.tx, proj.ty, '#7ceeff', 10);
  } else if (proj.kind === 'axe') {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - proj.tx, e.y - proj.ty) <= proj.aoe + e.def.radius) {
        dealDamageToEnemy(run, combat, e, proj.dmg, { armorMult: proj.armorMult, color: '#ff8e78' });
        e.stunLeft = Math.max(e.stunLeft, e.def.boss ? proj.stunDur * 0.45 : proj.stunDur);
      }
    }
    addShockwave(combat, proj.tx, proj.ty, proj.aoe * 1.1, '#f7b733');
    addBurst(combat, proj.tx, proj.ty, '#f7b733', 12);
  } else if (proj.kind === 'dagger') {
    const target = enemies.find((e) => e.id === proj.targetId && e.hp > 0) || pickBestTarget(enemies, 'nearest');
    if (target) {
      dealDamageToEnemy(run, combat, target, proj.dmg, { isCrit: proj.isCrit, color: '#f6e8c8' });
      if (proj.isCrit) addShockwave(combat, target.x, target.y, 24, '#ffd75e');
      addBurst(combat, target.x, target.y, proj.isCrit ? '#ffd75e' : '#f6e8c8', proj.isCrit ? 7 : 4);
    }
  }
}

export function stepCombat(run, rawDt) {
  if (run.phase !== 'combat' || !run.combat) return;
  const dt = Math.min(0.05, Math.max(0, rawDt));
  const combat = run.combat;
  combat.t += dt;
  combat.wallFlash = Math.max(0, combat.wallFlash - dt);

  // 1. Spawners da horda
  let anyRemainingToSpawn = false;
  for (const sp of combat.spawners) {
    if (sp.rem <= 0) continue;
    anyRemainingToSpawn = true;
    sp.timer -= dt;
    if (sp.timer <= 0) {
      spawnEnemy(combat, sp.type, sp.scale, run.rng);
      sp.rem--;
      sp.timer += sp.interval;
    }
  }

  // 2. Peças na grade disparam ataques/regeneração
  for (const p of run.grid.pieces) {
    p.flash = Math.max(0, p.flash - dt);
    const def = PIECES[p.pieceId];
    if (def.cd <= 0) continue;
    p.cdLeft -= dt;
    if (p.cdLeft <= 0) {
      p.cdLeft = p.cdTotal;
      triggerPiece(run, combat, p);
    }
  }

  // 3. Projéteis
  for (let i = combat.projectiles.length - 1; i >= 0; i--) {
    const pr = combat.projectiles[i];
    if (pr.kind === 'bolt') {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      for (const e of combat.enemies) {
        if (e.hp <= 0 || pr.hitIds.has(e.id)) continue;
        if (Math.hypot(e.x - pr.x, e.y - pr.y) <= e.def.radius + 7) {
          pr.hitIds.add(e.id);
          const dmg = e.def.flying ? pr.dmg * pr.airBonus : pr.dmg;
          dealDamageToEnemy(run, combat, e, dmg, { isCrit: e.def.flying, color: '#ffd75e' });
          addBurst(combat, e.x, e.y, '#ffd75e', 4);
          pr.pierceLeft--;
          if (pr.pierceLeft <= 0) break;
        }
      }
      if (pr.pierceLeft <= 0 || pr.x > ARENA_W + 20 || pr.x < -20 || pr.y < SPAWN_Y - 20 || pr.y > ARENA_H) {
        combat.projectiles.splice(i, 1);
      }
      continue;
    }

    if (pr.kind === 'enemyBolt') {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.y >= WALL_Y - 4) {
        damageWall(run, combat, pr.dmg);
        addBurst(combat, pr.x, WALL_Y - 4, '#b48cff', 6);
        combat.projectiles.splice(i, 1);
      }
      continue;
    }

    // Projétil teleguiado / arco vertical
    const target = combat.enemies.find((e) => e.id === pr.targetId && e.hp > 0);
    if (target) {
      pr.tx = target.x;
      pr.ty = target.y;
    }
    if (pr.kind === 'witch') {
      const totalDist = Math.max(40, Math.hypot(pr.tx - pr.sx, pr.ty - pr.sy));
      pr.progress += (pr.speed * dt) / totalDist;
      const t = Math.min(1, pr.progress);
      pr.x = pr.sx + (pr.tx - pr.sx) * t + Math.sin(t * Math.PI) * 14;
      pr.y = pr.sy + (pr.ty - pr.sy) * t;
      if (t >= 1) {
        resolveProjectileHit(run, combat, pr);
        combat.projectiles.splice(i, 1);
      }
    } else {
      const dx = pr.tx - pr.x;
      const dy = pr.ty - pr.y;
      const dist = Math.hypot(dx, dy);
      const step = pr.speed * dt;
      if (pr.kind === 'axe') pr.spin += dt * 16;
      if (dist <= step + 8) {
        pr.x = pr.tx;
        pr.y = pr.ty;
        resolveProjectileHit(run, combat, pr);
        combat.projectiles.splice(i, 1);
      } else {
        pr.x += (dx / dist) * step;
        pr.y += (dy / dist) * step;
      }
    }
  }

  // 4. Inimigos: veneno, movimento, ataques na muralha, cura de xamã e morte
  const activeShieldPieces = run.grid.pieces.filter((p) => p.pieceId === 'shield');
  let wallThorns = 0;
  for (const sp of activeShieldPieces) {
    const s = combat.synergies.byUid.get(sp.uid);
    wallThorns += PIECES.shield.thorns * TIERS[sp.tier].mult * (s ? s.armorMult : 1);
  }
  wallThorns = Math.round(wallThorns);

  for (let i = combat.enemies.length - 1; i >= 0; i--) {
    const e = combat.enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.slowLeft = Math.max(0, e.slowLeft - dt);
    e.stunLeft = Math.max(0, e.stunLeft - dt);
    e.curseLeft = Math.max(0, e.curseLeft - dt);
    if (e.slowLeft <= 0) e.slowPct = 0;
    if (e.curseLeft <= 0) e.curseAmp = 0;

    // Veneno contínuo (ignora armadura!)
    if (e.poisonStacks.length > 0) {
      let pDmg = 0;
      for (let j = e.poisonStacks.length - 1; j >= 0; j--) {
        const st = e.poisonStacks[j];
        pDmg += st.dps * dt;
        st.left -= dt;
        if (st.left <= 0) e.poisonStacks.splice(j, 1);
      }
      if (pDmg > 0) {
        e.hp -= pDmg;
        run.stats.dmgTotal += pDmg;
      }
    }

    if (e.hp <= 0) {
      run.gold += e.def.gold;
      run.stats.kills++;
      combat.waveKills++;
      addShockwave(combat, e.x, e.y, e.def.boss ? 56 : 24, e.def.color);
      addBurst(combat, e.x, e.y, e.def.color, e.def.boss ? 20 : 8);
      if (e.curseLeft > 0) {
        const boom = Math.round(e.maxHp * 0.25);
        addShockwave(combat, e.x, e.y, 58, '#ff8fd8');
        for (const other of combat.enemies) {
          if (other !== e && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 58) {
            dealDamageToEnemy(run, combat, other, boom, { ignoreArmor: true, color: '#ff8fd8' });
          }
        }
      }
      combat.events.push({ type: 'kill', enemy: e.type, gold: e.def.gold });
      combat.enemies.splice(i, 1);
      continue;
    }

    if (e.stunLeft > 0) continue;

    // Habilidades de Xamã / Chefe
    if (e.def.healCd && e.healLeft !== undefined) {
      e.healLeft -= dt;
      if (e.healLeft <= 0) {
        e.healLeft = e.def.healCd;
        for (const ally of combat.enemies) {
          if (ally.hp > 0 && ally.hp < ally.maxHp && Math.hypot(ally.x - e.x, ally.y - e.y) <= 95) {
            const healAmt = Math.min(55, Math.max(8, Math.round(ally.maxHp * 0.08)));
            ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
            addPopup(combat, ally.x, ally.y - 14, `+${healAmt}`, '#6df0a4');
          }
        }
      }
    }

    if (e.def.summonCd && e.summonLeft !== undefined) {
      e.summonLeft -= dt;
      if (e.summonLeft <= 0) {
        e.summonLeft = e.def.summonCd;
        const count = e.type === 'boss_colossus' ? 2 : 1;
        for (let s = 0; s < count; s++) {
          const min = spawnEnemy(combat, e.def.summonKind, 0.8 + run.level.id * 0.08, run.rng);
          min.y = Math.max(SPAWN_Y, e.y - 18 - s * 14);
          min.x = clamp(e.x + (s === 0 ? -24 : 24), 48, ARENA_W - 48);
        }
      }
    }

    const stopY = e.def.ranged ? e.def.rangedY : WALL_Y - e.def.radius - 4;
    if (e.y < stopY) {
      const spd = e.def.speed * 0.88 * (1 - e.slowPct);
      e.y = Math.min(stopY, e.y + spd * dt);
      e.walkPhase += dt * (spd * 0.25);
    } else if (e.def.bomber) {
      // Barril-bomba explode na Muralha
      damageWall(run, combat, e.dmg);
      combat.waveKills++;
      addShockwave(combat, e.x, WALL_Y - 6, 42, '#e5482f');
      addBurst(combat, e.x, WALL_Y - 6, '#e5482f', 14);
      addPopup(combat, e.x, WALL_Y - 18, `BOOM -${e.dmg}`, '#ff7b66', true);
      combat.enemies.splice(i, 1);
    } else if (e.def.ranged) {
      e.atkLeft -= dt;
      if (e.atkLeft <= 0) {
        e.atkLeft = e.def.atkCd;
        combat.projectiles.push({
          kind: 'enemyBolt',
          x: e.x,
          y: e.y + 10,
          vx: 0,
          vy: 210,
          dmg: e.dmg,
          color: '#ff6d9c',
        });
      }
    } else {
      e.atkLeft -= dt;
      if (e.atkLeft <= 0) {
        e.atkLeft = e.def.atkCd;
        damageWall(run, combat, e.dmg);
        if (wallThorns > 0) {
          dealDamageToEnemy(run, combat, e, wallThorns, { color: '#78b4ff' });
        }
      }
    }
  }

  // 5. Efeitos visuais transitórios
  for (let i = combat.slashes.length - 1; i >= 0; i--) {
    combat.slashes[i].life -= dt;
    if (combat.slashes[i].life <= 0) combat.slashes.splice(i, 1);
  }
  for (let i = combat.beams.length - 1; i >= 0; i--) {
    combat.beams[i].life -= dt;
    if (combat.beams[i].life <= 0) combat.beams.splice(i, 1);
  }
  for (let i = combat.zones.length - 1; i >= 0; i--) {
    combat.zones[i].life -= dt;
    if (combat.zones[i].life <= 0) combat.zones.splice(i, 1);
  }
  for (let i = combat.shockwaves.length - 1; i >= 0; i--) {
    combat.shockwaves[i].life -= dt;
    if (combat.shockwaves[i].life <= 0) combat.shockwaves.splice(i, 1);
  }
  for (let i = combat.popups.length - 1; i >= 0; i--) {
    combat.popups[i].life -= dt;
    combat.popups[i].y -= 26 * dt;
    if (combat.popups[i].life <= 0) combat.popups.splice(i, 1);
  }
  for (let i = combat.particles.length - 1; i >= 0; i--) {
    const pt = combat.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 150 * dt;
    if (pt.life <= 0) combat.particles.splice(i, 1);
  }

  // 6. Fim da horda ou derrota
  if (run.phase === 'lost') {
    run.stars = 0;
    return;
  }

  if (!anyRemainingToSpawn && combat.enemies.length === 0 && combat.projectiles.every((p) => p.kind !== 'enemyBolt')) {
    const wave = combat.wave;
    let lanternGold = 0;
    for (const p of run.grid.pieces) {
      if (p.pieceId === 'lantern') {
        lanternGold += Math.round(PIECES.lantern.bonusGold * Math.pow(1.75, p.tier - 1));
      }
    }
    run.gold += wave.clearGold + lanternGold;

    if (run.waveIdx >= run.level.waves.length - 1) {
      const hpRatio = run.wallHp / run.wallMaxHp;
      run.stars = hpRatio >= 0.8 ? 3 : hpRatio >= 0.4 ? 2 : 1;
      run.phase = 'won';
    } else {
      run.waveIdx++;
      run.freeExpands += run.level.freeExpandsPerWave;
      run.phase = 'prep';
      rollShop(run);
    }
  }
}
