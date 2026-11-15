// Motor do mini-jogo Coroas (Queens / Star Battle 1-estrela)
// Tabuleiro N×N com N regiões coloridas conexas, 4 níveis de dificuldade,
// gerador com solução única e solucionador 100% dedutivo (sem chute).

export const EMPTY = 0;
export const CROSS = 1;
export const QUEEN = 2;

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: {
    name: 'Fácil',
    size: 6,
    maxTier: 2,
    minTier: 1,
    allowSingleCellRegion: true,
    maxAttempts: 45,
  },
  medium: {
    name: 'Médio',
    size: 7,
    maxTier: 3,
    minTier: 2,
    allowSingleCellRegion: true,
    maxAttempts: 55,
  },
  hard: {
    name: 'Difícil',
    size: 8,
    maxTier: 4,
    minTier: 3,
    allowSingleCellRegion: false,
    maxAttempts: 65,
  },
  expert: {
    name: 'Mestre',
    size: 9,
    maxTier: 4,
    minTier: 3,
    allowSingleCellRegion: false,
    maxAttempts: 75,
  },
};

export const REGION_COLORS = [
  { name: 'Verde', hex: '#b8e0a8' },
  { name: 'Areia', hex: '#c9bfa8' },
  { name: 'Azul', hex: '#9dc3f2' },
  { name: 'Rosa', hex: '#df9ec0' },
  { name: 'Lilás', hex: '#b8a4e3' },
  { name: 'Pêssego', hex: '#f9c793' },
  { name: 'Marfim', hex: '#e4e4de' },
  { name: 'Coral', hex: '#f28771' },
  { name: 'Limão', hex: '#e2ea88' },
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function cellsAttack(i1, i2, size, regions) {
  if (i1 === i2) return true;
  const r1 = Math.floor(i1 / size);
  const c1 = i1 % size;
  const r2 = Math.floor(i2 / size);
  const c2 = i2 % size;
  if (r1 === r2 || c1 === c2) return true;
  if (regions[i1] === regions[i2]) return true;
  if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) return true;
  return false;
}

/**
 * Valida o tabuleiro atual procurando conflitos diretos entre Coroas (QUEEN)
 * ou linhas/colunas/regiões inteiramente bloqueadas por X sem nenhuma Coroa.
 */
export function validateBoard(grid, regions, size) {
  const badCells = new Set();
  let reason = null;

  const queens = [];
  for (let i = 0; i < size * size; i++) {
    if (grid[i] === QUEEN) queens.push(i);
  }

  // 1. Conflitos entre duas Coroas
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const i1 = queens[a];
      const i2 = queens[b];
      const r1 = Math.floor(i1 / size);
      const c1 = i1 % size;
      const r2 = Math.floor(i2 / size);
      const c2 = i2 % size;

      if (r1 === r2) {
        badCells.add(i1);
        badCells.add(i2);
        reason ??= `A Linha ${r1 + 1} tem mais de uma coroa.`;
      } else if (c1 === c2) {
        badCells.add(i1);
        badCells.add(i2);
        reason ??= `A Coluna ${c1 + 1} tem mais de uma coroa.`;
      } else if (regions[i1] === regions[i2]) {
        badCells.add(i1);
        badCells.add(i2);
        const regName = REGION_COLORS[regions[i1]]?.name || `#${regions[i1] + 1}`;
        reason ??= `A região ${regName} tem mais de uma coroa.`;
      } else if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
        badCells.add(i1);
        badCells.add(i2);
        reason ??= 'Duas coroas não podem se tocar, nem mesmo na diagonal.';
      }
    }
  }

  // 2. Linha, coluna ou região 100% marcada com X e sem nenhuma coroa
  if (!reason) {
    for (let r = 0; r < size; r++) {
      let hasQueen = false;
      let hasEmpty = false;
      const rowCells = [];
      for (let c = 0; c < size; c++) {
        const idx = r * size + c;
        rowCells.push(idx);
        if (grid[idx] === QUEEN) hasQueen = true;
        else if (grid[idx] === EMPTY) hasEmpty = true;
      }
      if (!hasQueen && !hasEmpty) {
        rowCells.forEach((i) => badCells.add(i));
        reason ??= `A Linha ${r + 1} ficou sem nenhuma casa disponível para coroa.`;
      }
    }
    for (let c = 0; c < size; c++) {
      let hasQueen = false;
      let hasEmpty = false;
      const colCells = [];
      for (let r = 0; r < size; r++) {
        const idx = r * size + c;
        colCells.push(idx);
        if (grid[idx] === QUEEN) hasQueen = true;
        else if (grid[idx] === EMPTY) hasEmpty = true;
      }
      if (!hasQueen && !hasEmpty) {
        colCells.forEach((i) => badCells.add(i));
        reason ??= `A Coluna ${c + 1} ficou sem nenhuma casa disponível para coroa.`;
      }
    }
    for (let reg = 0; reg < size; reg++) {
      let hasQueen = false;
      let hasEmpty = false;
      const regCells = [];
      for (let i = 0; i < size * size; i++) {
        if (regions[i] !== reg) continue;
        regCells.push(i);
        if (grid[i] === QUEEN) hasQueen = true;
        else if (grid[i] === EMPTY) hasEmpty = true;
      }
      if (regCells.length > 0 && !hasQueen && !hasEmpty) {
        regCells.forEach((i) => badCells.add(i));
        const regName = REGION_COLORS[reg]?.name || `#${reg + 1}`;
        reason ??= `A região ${regName} ficou sem nenhuma casa disponível para coroa.`;
      }
    }
  }

  const isSolved = queens.length === size && badCells.size === 0;
  return {
    badCells,
    reason,
    isSolved,
    queenCount: queens.length,
  };
}

/**
 * Executa um passo de dedução lógica sobre os vetores `placedQueens` e `elim`.
 * Retorna:
 * - `{ kind: 'contradiction' }` se alguma unidade sem coroa ficou com 0 casas livres
 * - `{ kind: 'queen', cell, tier, reason, cells }` se uma casa de Coroa é forçada
 * - `{ kind: 'elim', cells, tier, reason, ctxCells }` se novas casas puderam ser eliminadas
 * - `null` se nenhum progresso pôde ser feito até `maxTier`
 */
const SIZE_GEOM_CACHE = new Map();

function getSizeGeom(size) {
  let geom = SIZE_GEOM_CACHE.get(size);
  if (geom) return geom;

  const total = size * size;
  const rowOf = new Uint8Array(total);
  const colOf = new Uint8Array(total);
  const rowCells = Array.from({ length: size }, () => []);
  const colCells = Array.from({ length: size }, () => []);

  for (let i = 0; i < total; i++) {
    const r = (i / size) | 0;
    const c = i % size;
    rowOf[i] = r;
    colOf[i] = c;
    rowCells[r].push(i);
    colCells[c].push(i);
  }

  const baseAttackMat = new Uint8Array(total * total);
  const baseAttackPeers = Array.from({ length: total }, () => []);
  for (let i = 0; i < total; i++) {
    const r1 = rowOf[i];
    const c1 = colOf[i];
    baseAttackMat[i * total + i] = 1;
    for (let j = i + 1; j < total; j++) {
      const r2 = rowOf[j];
      const c2 = colOf[j];
      if (r1 === r2 || c1 === c2 || (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1)) {
        baseAttackMat[i * total + j] = 1;
        baseAttackMat[j * total + i] = 1;
        baseAttackPeers[i].push(j);
        baseAttackPeers[j].push(i);
      }
    }
  }

  geom = { size, total, rowOf, colOf, rowCells, colCells, baseAttackMat, baseAttackPeers };
  SIZE_GEOM_CACHE.set(size, geom);
  return geom;
}

function buildPuzzleContext(regions, size) {
  const geom = getSizeGeom(size);
  const { total } = geom;
  const regCells = Array.from({ length: size }, () => []);
  for (let i = 0; i < total; i++) {
    regCells[regions[i]].push(i);
  }
  return { ...geom, regCells };
}

function deduceStep(placedQueens, elim, elimReasons, regions, size, maxTier = 4, ctx = null) {
  const cCtx = ctx || buildPuzzleContext(regions, size);
  const { total, rowOf, colOf, rowCells, colCells, regCells, baseAttackMat } = cCtx;

  const rowHasQ = new Uint8Array(size);
  const colHasQ = new Uint8Array(size);
  const regHasQ = new Uint8Array(size);

  const rowAvail = Array.from({ length: size }, () => []);
  const colAvail = Array.from({ length: size }, () => []);
  const regAvail = Array.from({ length: size }, () => []);

  const regRowMask = new Uint32Array(size);
  const regColMask = new Uint32Array(size);
  const rowRegMask = new Uint32Array(size);
  const colRegMask = new Uint32Array(size);

  for (let i = 0; i < total; i++) {
    const r = rowOf[i];
    const c = colOf[i];
    const reg = regions[i];
    if (placedQueens[i]) {
      rowHasQ[r] = 1;
      colHasQ[c] = 1;
      regHasQ[reg] = 1;
    } else if (!elim[i]) {
      rowAvail[r].push(i);
      colAvail[c].push(i);
      regAvail[reg].push(i);
      regRowMask[reg] |= 1 << r;
      regColMask[reg] |= 1 << c;
      rowRegMask[r] |= 1 << reg;
      colRegMask[c] |= 1 << reg;
    }
  }

  // Checa contradições (unidade sem coroa e sem casa disponível)
  for (let k = 0; k < size; k++) {
    if (!regHasQ[k] && regAvail[k].length === 0) return { kind: 'contradiction' };
    if (!rowHasQ[k] && rowAvail[k].length === 0) return { kind: 'contradiction' };
    if (!colHasQ[k] && colAvail[k].length === 0) return { kind: 'contradiction' };
  }

  // ---------- TIER 1: Casa única restante na Região, Linha ou Coluna ----------
  for (let reg = 0; reg < size; reg++) {
    if (!regHasQ[reg] && regAvail[reg].length === 1) {
      const cell = regAvail[reg][0];
      const rCells = regCells[reg];
      let maxElimTier = 1;
      let subReason = '';
      for (let k = 0; k < rCells.length; k++) {
        const i = rCells[k];
        if (elimReasons[i] && elimReasons[i].tier > maxElimTier) {
          maxElimTier = elimReasons[i].tier;
          subReason = elimReasons[i].reason;
        }
      }
      const regName = REGION_COLORS[reg]?.name || `#${reg + 1}`;
      const base = `Na região <b>${regName}</b>, só resta esta casa livre para a 👑.`;
      return {
        kind: 'queen',
        cell,
        tier: maxElimTier,
        cells: rCells.slice(),
        reason: subReason ? `${subReason} Por isso, na região <b>${regName}</b> só sobra esta casa para a 👑.` : base,
      };
    }
  }

  for (let r = 0; r < size; r++) {
    if (!rowHasQ[r] && rowAvail[r].length === 1) {
      const cell = rowAvail[r][0];
      const rCells = rowCells[r];
      let maxElimTier = 1;
      let subReason = '';
      for (let k = 0; k < size; k++) {
        const i = rCells[k];
        if (elimReasons[i] && elimReasons[i].tier > maxElimTier) {
          maxElimTier = elimReasons[i].tier;
          subReason = elimReasons[i].reason;
        }
      }
      const base = `Na <b>Linha ${r + 1}</b>, só sobrou esta casa disponível para a 👑.`;
      return {
        kind: 'queen',
        cell,
        tier: maxElimTier,
        cells: rCells.slice(),
        reason: subReason ? `${subReason} Assim, na <b>Linha ${r + 1}</b> só resta esta casa para a 👑.` : base,
      };
    }
  }

  for (let c = 0; c < size; c++) {
    if (!colHasQ[c] && colAvail[c].length === 1) {
      const cell = colAvail[c][0];
      const cCells = colCells[c];
      let maxElimTier = 1;
      let subReason = '';
      for (let k = 0; k < size; k++) {
        const i = cCells[k];
        if (elimReasons[i] && elimReasons[i].tier > maxElimTier) {
          maxElimTier = elimReasons[i].tier;
          subReason = elimReasons[i].reason;
        }
      }
      const base = `Na <b>Coluna ${c + 1}</b>, só sobrou esta casa disponível para a 👑.`;
      return {
        kind: 'queen',
        cell,
        tier: maxElimTier,
        cells: cCells.slice(),
        reason: subReason ? `${subReason} Assim, na <b>Coluna ${c + 1}</b> só resta esta casa para a 👑.` : base,
      };
    }
  }

  if (maxTier < 2) return null;

  // ---------- TIER 2: Confinamento (Linha/Coluna <-> Região) e Vizinhos de Região Pequena ----------
  // 2A: Todas as casas livres de uma região estão na mesma linha ou coluna
  for (let reg = 0; reg < size; reg++) {
    if (regHasQ[reg]) continue;
    const av = regAvail[reg];
    const mRow = regRowMask[reg];
    if ((mRow & (mRow - 1)) === 0) {
      const r0 = rowOf[av[0]];
      const toElim = [];
      for (const i of rowAvail[r0]) if (regions[i] !== reg) toElim.push(i);
      if (toElim.length > 0) {
        const regName = REGION_COLORS[reg]?.name || `#${reg + 1}`;
        return {
          kind: 'elim',
          cells: toElim,
          ctxCells: av,
          tier: 2,
          reason: `A região <b>${regName}</b> só tem casas livres na <b>Linha ${r0 + 1}</b>, bloqueando o resto dessa linha.`,
        };
      }
    }
    const mCol = regColMask[reg];
    if ((mCol & (mCol - 1)) === 0) {
      const c0 = colOf[av[0]];
      const toElim = [];
      for (const i of colAvail[c0]) if (regions[i] !== reg) toElim.push(i);
      if (toElim.length > 0) {
        const regName = REGION_COLORS[reg]?.name || `#${reg + 1}`;
        return {
          kind: 'elim',
          cells: toElim,
          ctxCells: av,
          tier: 2,
          reason: `A região <b>${regName}</b> só tem casas livres na <b>Coluna ${c0 + 1}</b>, bloqueando o resto dessa coluna.`,
        };
      }
    }
  }

  // 2B: Todas as casas livres de uma linha ou coluna estão na mesma região
  for (let r = 0; r < size; r++) {
    if (rowHasQ[r]) continue;
    const mReg = rowRegMask[r];
    if ((mReg & (mReg - 1)) === 0) {
      const av = rowAvail[r];
      const reg0 = regions[av[0]];
      const toElim = [];
      for (const i of regAvail[reg0]) if (rowOf[i] !== r) toElim.push(i);
      if (toElim.length > 0) {
        const regName = REGION_COLORS[reg0]?.name || `#${reg0 + 1}`;
        return {
          kind: 'elim',
          cells: toElim,
          ctxCells: av,
          tier: 2,
          reason: `A <b>Linha ${r + 1}</b> só tem casas livres na região <b>${regName}</b>, bloqueando o restante dessa região.`,
        };
      }
    }
  }

  for (let c = 0; c < size; c++) {
    if (colHasQ[c]) continue;
    const mReg = colRegMask[c];
    if ((mReg & (mReg - 1)) === 0) {
      const av = colAvail[c];
      const reg0 = regions[av[0]];
      const toElim = [];
      for (const i of regAvail[reg0]) if (colOf[i] !== c) toElim.push(i);
      if (toElim.length > 0) {
        const regName = REGION_COLORS[reg0]?.name || `#${reg0 + 1}`;
        return {
          kind: 'elim',
          cells: toElim,
          ctxCells: av,
          tier: 2,
          reason: `A <b>Coluna ${c + 1}</b> só tem casas livres na região <b>${regName}</b>, bloqueando o restante dessa região.`,
        };
      }
    }
  }

  if (maxTier < 3) return null;

  // ---------- TIER 3: Alcance de Coroa (1-step lookahead sobre qualquer unidade) ----------
  const units = [];
  for (let k = 0; k < size; k++) {
    if (!regHasQ[k]) units.push({ match: regions, id: k, av: regAvail[k], label: `região <b>${REGION_COLORS[k]?.name || k + 1}</b>` });
    if (!rowHasQ[k]) units.push({ match: rowOf, id: k, av: rowAvail[k], label: `<b>Linha ${k + 1}</b>` });
    if (!colHasQ[k]) units.push({ match: colOf, id: k, av: colAvail[k], label: `<b>Coluna ${k + 1}</b>` });
  }

  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui];
    const av = u.av;
    const avLen = av.length;
    const matchArr = u.match;
    const uId = u.id;
    const toElim = [];
    for (let i = 0; i < total; i++) {
      if (placedQueens[i] || elim[i] || matchArr[i] === uId) continue;
      const base = i * total;
      const regI = regions[i];
      let blocksAll = true;
      for (let t = 0; t < avLen; t++) {
        const tgt = av[t];
        if (!baseAttackMat[base + tgt] && regI !== regions[tgt]) {
          blocksAll = false;
          break;
        }
      }
      if (blocksAll) toElim.push(i);
    }
    if (toElim.length > 0) {
      return {
        kind: 'elim',
        cells: toElim,
        ctxCells: av,
        tier: 3,
        reason: `Uma 👑 ali bloquearia todas as casas restantes da ${u.label}.`,
      };
    }
  }

  if (maxTier < 4) return null;

  // ---------- TIER 4: Subconjuntos de 2 ou 3 regiões / linhas / colunas (Pigeonhole) ----------
  const activeRegs = [];
  const activeRows = [];
  const activeCols = [];
  for (let k = 0; k < size; k++) {
    if (!regHasQ[k]) activeRegs.push(k);
    if (!rowHasQ[k]) activeRows.push(k);
    if (!colHasQ[k]) activeCols.push(k);
  }

  // Par de regiões confinadas em 2 linhas ou 2 colunas
  for (let a = 0; a < activeRegs.length; a++) {
    const rA = activeRegs[a];
    for (let b = a + 1; b < activeRegs.length; b++) {
      const rB = activeRegs[b];
      const maskR = regRowMask[rA] | regRowMask[rB];
      const b0R = maskR & -maskR;
      const b1R = maskR ^ b0R;
      if (b1R !== 0 && (b1R & (b1R - 1)) === 0) {
        const r0 = 31 - Math.clz32(b0R);
        const r1 = 31 - Math.clz32(b1R);
        const toElim = [];
        for (const i of rowAvail[r0]) if (regions[i] !== rA && regions[i] !== rB) toElim.push(i);
        for (const i of rowAvail[r1]) if (regions[i] !== rA && regions[i] !== rB) toElim.push(i);
        if (toElim.length > 0) {
          const nA = REGION_COLORS[rA]?.name;
          const nB = REGION_COLORS[rB]?.name;
          return {
            kind: 'elim',
            cells: toElim,
            ctxCells: [...regAvail[rA], ...regAvail[rB]],
            tier: 4,
            reason: `As regiões <b>${nA}</b> e <b>${nB}</b> ocupam apenas as <b>Linhas ${r0 + 1} e ${r1 + 1}</b>, bloqueando as demais regiões nessas linhas.`,
          };
        }
      }
      const maskC = regColMask[rA] | regColMask[rB];
      const b0C = maskC & -maskC;
      const b1C = maskC ^ b0C;
      if (b1C !== 0 && (b1C & (b1C - 1)) === 0) {
        const c0 = 31 - Math.clz32(b0C);
        const c1 = 31 - Math.clz32(b1C);
        const toElim = [];
        for (const i of colAvail[c0]) if (regions[i] !== rA && regions[i] !== rB) toElim.push(i);
        for (const i of colAvail[c1]) if (regions[i] !== rA && regions[i] !== rB) toElim.push(i);
        if (toElim.length > 0) {
          const nA = REGION_COLORS[rA]?.name;
          const nB = REGION_COLORS[rB]?.name;
          return {
            kind: 'elim',
            cells: toElim,
            ctxCells: [...regAvail[rA], ...regAvail[rB]],
            tier: 4,
            reason: `As regiões <b>${nA}</b> e <b>${nB}</b> ocupam apenas as <b>Colunas ${c0 + 1} e ${c1 + 1}</b>, bloqueando as demais regiões nessas colunas.`,
          };
        }
      }
    }
  }

  // Par de linhas confinadas em 2 regiões
  for (let a = 0; a < activeRows.length; a++) {
    const rA = activeRows[a];
    for (let b = a + 1; b < activeRows.length; b++) {
      const rB = activeRows[b];
      const mask = rowRegMask[rA] | rowRegMask[rB];
      const b0 = mask & -mask;
      const b1 = mask ^ b0;
      if (b1 !== 0 && (b1 & (b1 - 1)) === 0) {
        const g0 = 31 - Math.clz32(b0);
        const g1 = 31 - Math.clz32(b1);
        const toElim = [];
        for (const i of regAvail[g0]) if (rowOf[i] !== rA && rowOf[i] !== rB) toElim.push(i);
        for (const i of regAvail[g1]) if (rowOf[i] !== rA && rowOf[i] !== rB) toElim.push(i);
        if (toElim.length > 0) {
          const nA = REGION_COLORS[g0]?.name;
          const nB = REGION_COLORS[g1]?.name;
          return {
            kind: 'elim',
            cells: toElim,
            ctxCells: [...rowAvail[rA], ...rowAvail[rB]],
            tier: 4,
            reason: `As <b>Linhas ${rA + 1} e ${rB + 1}</b> só têm casas nas regiões <b>${nA}</b> e <b>${nB}</b>, eliminando o resto dessas duas regiões.`,
          };
        }
      }
    }
  }

  // Par de colunas confinadas em 2 regiões
  for (let a = 0; a < activeCols.length; a++) {
    const cA = activeCols[a];
    for (let b = a + 1; b < activeCols.length; b++) {
      const cB = activeCols[b];
      const mask = colRegMask[cA] | colRegMask[cB];
      const b0 = mask & -mask;
      const b1 = mask ^ b0;
      if (b1 !== 0 && (b1 & (b1 - 1)) === 0) {
        const g0 = 31 - Math.clz32(b0);
        const g1 = 31 - Math.clz32(b1);
        const toElim = [];
        for (const i of regAvail[g0]) if (colOf[i] !== cA && colOf[i] !== cB) toElim.push(i);
        for (const i of regAvail[g1]) if (colOf[i] !== cA && colOf[i] !== cB) toElim.push(i);
        if (toElim.length > 0) {
          const nA = REGION_COLORS[g0]?.name;
          const nB = REGION_COLORS[g1]?.name;
          return {
            kind: 'elim',
            cells: toElim,
            ctxCells: [...colAvail[cA], ...colAvail[cB]],
            tier: 4,
            reason: `As <b>Colunas ${cA + 1} e ${cB + 1}</b> só têm casas nas regiões <b>${nA}</b> e <b>${nB}</b>, eliminando o resto dessas duas regiões.`,
          };
        }
      }
    }
  }

  // Trios de 3 unidades confinadas em 3 linhas, colunas ou regiões
  const checkTriple = (mask) => {
    const b0 = mask & -mask;
    const r1 = mask ^ b0;
    if (!r1) return null;
    const b1 = r1 & -r1;
    const r2 = r1 ^ b1;
    if (r2 !== 0 && (r2 & (r2 - 1)) === 0) {
      return [31 - Math.clz32(b0), 31 - Math.clz32(b1), 31 - Math.clz32(r2)];
    }
    return null;
  };

  if (activeRegs.length >= 4) {
    for (let a = 0; a < activeRegs.length; a++) {
      const rA = activeRegs[a];
      for (let b = a + 1; b < activeRegs.length; b++) {
        const rB = activeRegs[b];
        const mABr = regRowMask[rA] | regRowMask[rB];
        const mABc = regColMask[rA] | regColMask[rB];
        for (let c = b + 1; c < activeRegs.length; c++) {
          const rC = activeRegs[c];
          const rows = checkTriple(mABr | regRowMask[rC]);
          if (rows) {
            const toElim = [];
            for (const r of rows) {
              for (const i of rowAvail[r]) {
                const reg = regions[i];
                if (reg !== rA && reg !== rB && reg !== rC) toElim.push(i);
              }
            }
            if (toElim.length > 0) {
              return {
                kind: 'elim',
                cells: toElim,
                ctxCells: [...regAvail[rA], ...regAvail[rB], ...regAvail[rC]],
                tier: 4,
                reason: `Três regiões compartilham exatamente as <b>Linhas ${rows.map((r) => r + 1).join(', ')}</b>, bloqueando as demais regiões nessas linhas.`,
              };
            }
          }
          const cols = checkTriple(mABc | regColMask[rC]);
          if (cols) {
            const toElim = [];
            for (const col of cols) {
              for (const i of colAvail[col]) {
                const reg = regions[i];
                if (reg !== rA && reg !== rB && reg !== rC) toElim.push(i);
              }
            }
            if (toElim.length > 0) {
              return {
                kind: 'elim',
                cells: toElim,
                ctxCells: [...regAvail[rA], ...regAvail[rB], ...regAvail[rC]],
                tier: 4,
                reason: `Três regiões compartilham exatamente as <b>Colunas ${cols.map((col) => col + 1).join(', ')}</b>, bloqueando as demais regiões nessas colunas.`,
              };
            }
          }
        }
      }
    }
  }

  if (activeRows.length >= 4) {
    for (let a = 0; a < activeRows.length; a++) {
      const rA = activeRows[a];
      for (let b = a + 1; b < activeRows.length; b++) {
        const rB = activeRows[b];
        const mAB = rowRegMask[rA] | rowRegMask[rB];
        for (let c = b + 1; c < activeRows.length; c++) {
          const rC = activeRows[c];
          const regs = checkTriple(mAB | rowRegMask[rC]);
          if (regs) {
            const toElim = [];
            for (const g of regs) {
              for (const i of regAvail[g]) {
                const row = rowOf[i];
                if (row !== rA && row !== rB && row !== rC) toElim.push(i);
              }
            }
            if (toElim.length > 0) {
              return {
                kind: 'elim',
                cells: toElim,
                ctxCells: [...rowAvail[rA], ...rowAvail[rB], ...rowAvail[rC]],
                tier: 4,
                reason: `As <b>Linhas ${rA + 1}, ${rB + 1} e ${rC + 1}</b> usam apenas 3 regiões, liberando o restante dessas regiões.`,
              };
            }
          }
        }
      }
    }
  }

  if (activeCols.length >= 4) {
    for (let a = 0; a < activeCols.length; a++) {
      const cA = activeCols[a];
      for (let b = a + 1; b < activeCols.length; b++) {
        const cB = activeCols[b];
        const mAB = colRegMask[cA] | colRegMask[cB];
        for (let c = b + 1; c < activeCols.length; c++) {
          const cC = activeCols[c];
          const regs = checkTriple(mAB | colRegMask[cC]);
          if (regs) {
            const toElim = [];
            for (const g of regs) {
              for (const i of regAvail[g]) {
                const col = colOf[i];
                if (col !== cA && col !== cB && col !== cC) toElim.push(i);
              }
            }
            if (toElim.length > 0) {
              return {
                kind: 'elim',
                cells: toElim,
                ctxCells: [...colAvail[cA], ...colAvail[cB], ...colAvail[cC]],
                tier: 4,
                reason: `As <b>Colunas ${cA + 1}, ${cB + 1} e ${cC + 1}</b> usam apenas 3 regiões, liberando o restante dessas regiões.`,
              };
            }
          }
        }
      }
    }
  }

  return null;
}

function applyQueen(cell, placedQueens, elim, regions, size, ctx = null) {
  placedQueens[cell] = 1;
  if (ctx) {
    const peers = ctx.baseAttackPeers[cell];
    for (let k = 0; k < peers.length; k++) elim[peers[k]] = 1;
    const rCells = ctx.regCells[regions[cell]];
    for (let k = 0; k < rCells.length; k++) {
      const c = rCells[k];
      if (c !== cell) elim[c] = 1;
    }
    return;
  }
  for (let i = 0; i < size * size; i++) {
    if (i !== cell && cellsAttack(cell, i, size, regions)) {
      elim[i] = 1;
    }
  }
}

/**
 * Resolve o tabuleiro a partir do zero (ou de um estado parcial) usando apenas dedução lógica até `maxTier`.
 */
export function solveByDeduction(regions, size, maxTier = 4) {
  const ctx = buildPuzzleContext(regions, size);
  const placedQueens = new Uint8Array(ctx.total);
  const elim = new Uint8Array(ctx.total);
  const elimReasons = new Array(ctx.total).fill(null);

  let queensCount = 0;
  let maxTierUsed = 1;
  let steps = 0;

  while (queensCount < size) {
    const step = deduceStep(placedQueens, elim, elimReasons, regions, size, maxTier, ctx);
    if (!step || step.kind === 'contradiction') {
      return { solved: false, queensCount, maxTierUsed, steps, placedQueens };
    }
    steps++;
    if (step.tier > maxTierUsed) maxTierUsed = step.tier;

    if (step.kind === 'queen') {
      applyQueen(step.cell, placedQueens, elim, regions, size, ctx);
      queensCount++;
    } else if (step.kind === 'elim') {
      for (const c of step.cells) {
        elim[c] = 1;
        if (!elimReasons[c]) {
          elimReasons[c] = { tier: step.tier, reason: step.reason };
        }
      }
    }
  }

  return {
    solved: true,
    queensCount,
    maxTierUsed,
    steps,
    placedQueens,
  };
}

/**
 * Encontra a próxima Coroa dedutível a partir do tabuleiro atual para o botão de Dica.
 */
export function findNextDeduction(grid, regions, size, maxTier = 4) {
  const ctx = buildPuzzleContext(regions, size);
  const placedQueens = new Uint8Array(ctx.total);
  const elim = new Uint8Array(ctx.total);
  const elimReasons = new Array(ctx.total).fill(null);

  for (let i = 0; i < ctx.total; i++) {
    if (grid[i] === QUEEN) {
      applyQueen(i, placedQueens, elim, regions, size, ctx);
    } else if (grid[i] === CROSS) {
      elim[i] = 1;
    }
  }

  for (let iter = 0; iter < ctx.total * 2; iter++) {
    const step = deduceStep(placedQueens, elim, elimReasons, regions, size, maxTier, ctx);
    if (!step || step.kind === 'contradiction') return null;
    if (step.kind === 'queen') {
      return step;
    }
    if (step.kind === 'elim') {
      for (const c of step.cells) {
        elim[c] = 1;
        if (!elimReasons[c]) {
          elimReasons[c] = { tier: step.tier, reason: step.reason };
        }
      }
    }
  }
  return null;
}

/**
 * Gera uma disposição válida de N Coroas sem ataques mútuos (linha, coluna ou diagonal adjacente).
 */
function generateValidQueens(size) {
  const cols = new Int8Array(size).fill(-1);
  const usedCols = new Uint8Array(size);

  function backtrack(r) {
    if (r === size) return true;
    const order = shuffle(Array.from({ length: size }, (_, i) => i));
    for (const c of order) {
      if (usedCols[c]) continue;
      if (r > 0 && Math.abs(c - cols[r - 1]) <= 1) continue;
      cols[r] = c;
      usedCols[c] = 1;
      if (backtrack(r + 1)) return true;
      usedCols[c] = 0;
      cols[r] = -1;
    }
    return false;
  }

  backtrack(0);
  const solution = new Uint8Array(size * size);
  const queenCells = [];
  for (let r = 0; r < size; r++) {
    const idx = r * size + cols[r];
    solution[idx] = 1;
    queenCells.push(idx);
  }
  return { solution, queenCells };
}

/**
 * Cresce N regiões conexas em torno das N coroas usando limites de tamanho e orientação
 * para criar pontos de partida lógicos variados conforme a dificuldade.
 */
function growRegions(size, queenCells, allowSingleCellRegion) {
  const total = size * size;
  const regions = new Int8Array(total).fill(-1);

  // Define cotas máximas de tamanho para cada região para criar assimetria lógica natural
  const caps = new Int16Array(size);
  const order = shuffle(Array.from({ length: size }, (_, i) => i));

  if (allowSingleCellRegion && Math.random() < 0.55) {
    caps[order[0]] = 1 + Math.floor(Math.random() * 2); // 1 ou 2 casas
  } else {
    caps[order[0]] = 2; // região semente de 2 casas
  }
  caps[order[1]] = 2 + Math.floor(Math.random() * 2); // 2 ou 3 casas
  caps[order[2]] = 3 + Math.floor(Math.random() * 3); // 3 a 5 casas
  for (let k = 3; k < size; k++) {
    caps[order[k]] = size >= 8 && k <= 4 ? 3 + Math.floor(Math.random() * 3) : total;
  }

  // Algumas regiões preferem crescer só na horizontal ou só na vertical no início (confinamento de linha/coluna)
  const dirBias = new Array(size).fill('any');
  if (size >= 4) {
    dirBias[order[1]] = Math.random() < 0.5 ? 'h' : 'v';
    dirBias[order[2]] = Math.random() < 0.5 ? 'h' : 'v';
    if (size >= 8) dirBias[order[3]] = Math.random() < 0.5 ? 'h' : 'v';
  }

  const regSizes = new Int16Array(size);
  const frontier = [];

  const pushNeighbors = (cell, reg) => {
    const r = (cell / size) | 0;
    const c = cell % size;
    if (r > 0 && regions[(r - 1) * size + c] === -1) frontier.push({ cell: (r - 1) * size + c, reg, axis: 'v' });
    if (r + 1 < size && regions[(r + 1) * size + c] === -1) frontier.push({ cell: (r + 1) * size + c, reg, axis: 'v' });
    if (c > 0 && regions[r * size + c - 1] === -1) frontier.push({ cell: r * size + c - 1, reg, axis: 'h' });
    if (c + 1 < size && regions[r * size + c + 1] === -1) frontier.push({ cell: r * size + c + 1, reg, axis: 'h' });
  };

  for (let reg = 0; reg < size; reg++) {
    const qCell = queenCells[reg];
    regions[qCell] = reg;
    regSizes[reg] = 1;
  }

  let unassigned = total - size;

  if (!allowSingleCellRegion) {
    for (let reg = 0; reg < size; reg++) {
      const qCell = queenCells[reg];
      const r = (qCell / size) | 0;
      const c = qCell % size;
      const options = [];
      if (r > 0 && regions[(r - 1) * size + c] === -1) options.push({ cell: (r - 1) * size + c, axis: 'v' });
      if (r + 1 < size && regions[(r + 1) * size + c] === -1) options.push({ cell: (r + 1) * size + c, axis: 'v' });
      if (c > 0 && regions[r * size + c - 1] === -1) options.push({ cell: r * size + c - 1, axis: 'h' });
      if (c + 1 < size && regions[r * size + c + 1] === -1) options.push({ cell: r * size + c + 1, axis: 'h' });
      if (options.length === 0) return null;
      const preferred = dirBias[reg] !== 'any' ? options.filter((o) => o.axis === dirBias[reg]) : [];
      const pool = preferred.length > 0 ? preferred : options;
      const pick = pool[Math.floor(Math.random() * pool.length)].cell;
      regions[pick] = reg;
      regSizes[reg] = 2;
      unassigned--;
      pushNeighbors(pick, reg);
    }
  }

  for (let reg = 0; reg < size; reg++) {
    pushNeighbors(queenCells[reg], reg);
  }

  // Passada 1: respeita caps e vieses de linha/coluna
  while (unassigned > 0 && frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const item = frontier[idx];
    frontier[idx] = frontier[frontier.length - 1];
    frontier.pop();

    const { cell, reg, axis } = item;
    if (regions[cell] !== -1) continue;
    if (regSizes[reg] >= caps[reg]) continue;
    if (dirBias[reg] !== 'any' && dirBias[reg] !== axis && Math.random() < 0.82) continue;

    regions[cell] = reg;
    regSizes[reg]++;
    unassigned--;
    pushNeighbors(cell, reg);
  }

  // Passada 2: preenche quaisquer células órfãs conectando a um vizinho já colorido
  // (priorizando regiões maiores para preservar as regiões pequenas de ponto de partida)
  let guard = 0;
  while (unassigned > 0 && guard++ < total * 8) {
    for (let i = 0; i < total; i++) {
      if (regions[i] !== -1) continue;
      const r = (i / size) | 0;
      const c = i % size;
      let chosen = -1;
      const consider = (reg) => {
        if (reg === -1) return;
        if (
          chosen === -1 ||
          caps[reg] > caps[chosen] ||
          (caps[reg] === caps[chosen] && regSizes[reg] > regSizes[chosen])
        ) {
          chosen = reg;
        }
      };
      if (r > 0) consider(regions[(r - 1) * size + c]);
      if (r + 1 < size) consider(regions[(r + 1) * size + c]);
      if (c > 0) consider(regions[r * size + (c - 1)]);
      if (c + 1 < size) consider(regions[r * size + (c + 1)]);
      if (chosen === -1) continue;

      regions[i] = chosen;
      regSizes[chosen]++;
      unassigned--;
    }
  }

  if (!allowSingleCellRegion) {
    for (let reg = 0; reg < size; reg++) {
      if (regSizes[reg] < 2) return null;
    }
  }

  return Array.from(regions);
}

/**
 * Gera um quebra-cabeça completo de Coroas para o nível escolhido ('easy', 'medium', 'hard', 'expert').
 */
export function generatePuzzle(level = 'medium') {
  const cfg = LEVEL_INFO[level] || LEVEL_INFO.medium;
  const { size, maxTier, minTier, allowSingleCellRegion, maxAttempts } = cfg;

  let bestFallback = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { solution, queenCells } = generateValidQueens(size);
    const regions = growRegions(size, queenCells, allowSingleCellRegion);
    if (!regions) continue;

    const check = solveByDeduction(regions, size, maxTier);
    if (!check.solved) continue;

    // Garante que a solução deduzida bate exatamente com a solução gerada
    let matches = true;
    for (let i = 0; i < size * size; i++) {
      if (check.placedQueens[i] !== solution[i]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    const candidate = {
      level,
      size,
      regions,
      solution: Array.from(solution),
      tierUsed: check.maxTierUsed,
    };

    if (check.maxTierUsed >= minTier) {
      return candidate;
    }
    if (!bestFallback || check.maxTierUsed > bestFallback.tierUsed) {
      bestFallback = candidate;
    }
  }

  if (bestFallback) return bestFallback;

  // Fallback determinístico caso as tentativas aleatórias não atinjam o tier alvo
  while (true) {
    const { solution, queenCells } = generateValidQueens(size);
    const regions = growRegions(size, queenCells, true);
    if (!regions) continue;
    const check = solveByDeduction(regions, size, 4);
    if (check.solved) {
      return {
        level,
        size,
        regions,
        solution: Array.from(solution),
        tierUsed: check.maxTierUsed,
      };
    }
  }
}
