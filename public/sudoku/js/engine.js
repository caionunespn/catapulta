// Motor do mini-jogo Sudoku 9×9
// Gerador de tabuleiros completos, remoção simétrica/assimétrica validada por
// solucionador dedutivo humano em 4 níveis de dificuldade (sem chute) e dicas explicadas.

export const SIZE = 9;
export const TOTAL = 81;
export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: {
    name: 'Fácil',
    targetGivens: 45,
    maxTier: 1,
  },
  medium: {
    name: 'Médio',
    targetGivens: 37,
    maxTier: 2,
  },
  hard: {
    name: 'Difícil',
    targetGivens: 32,
    maxTier: 3,
  },
  expert: {
    name: 'Mestre',
    targetGivens: 28,
    maxTier: 3,
  },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function boxOf(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function peersOf(idx) {
  const r = Math.floor(idx / 9);
  const c = idx % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const set = new Set();
  for (let k = 0; k < 9; k++) {
    if (k !== c) set.add(r * 9 + k);
    if (k !== r) set.add(k * 9 + c);
  }
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      const rr = br + dr;
      const cc = bc + dc;
      if (rr !== r || cc !== c) set.add(rr * 9 + cc);
    }
  }
  return [...set];
}

const PEERS = Array.from({ length: TOTAL }, (_, i) => peersOf(i));

const BOX_CELLS = Array.from({ length: 9 }, (_, b) => {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const out = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) {
      out.push((br + dr) * 9 + (bc + dc));
    }
  }
  return out;
});

const ROW_CELLS = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (__, c) => r * 9 + c)
);

const COL_CELLS = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (__, r) => r * 9 + c)
);

/**
 * Valida o tabuleiro procurando números repetidos na mesma linha, coluna ou bloco 3×3.
 */
export function validateBoard(grid) {
  const badCells = new Set();
  let reason = null;

  for (let i = 0; i < TOTAL; i++) {
    const val = grid[i];
    if (!val) continue;
    const r1 = Math.floor(i / 9);
    const c1 = i % 9;
    const b1 = boxOf(r1, c1);

    for (const p of PEERS[i]) {
      if (p <= i || grid[p] !== val) continue;
      badCells.add(i);
      badCells.add(p);
      const r2 = Math.floor(p / 9);
      const c2 = p % 9;
      if (r1 === r2) {
        reason ??= `O número <b>${val}</b> está repetido na <b>Linha ${r1 + 1}</b>.`;
      } else if (c1 === c2) {
        reason ??= `O número <b>${val}</b> está repetido na <b>Coluna ${c1 + 1}</b>.`;
      } else if (b1 === boxOf(r2, c2)) {
        reason ??= `O número <b>${val}</b> está repetido no mesmo <b>bloco 3×3</b>.`;
      }
    }
  }

  const filled = grid.filter((v) => v >= 1 && v <= 9).length;
  const isSolved = filled === TOTAL && badCells.size === 0;
  return {
    badCells,
    reason,
    filled,
    isSolved,
  };
}

/**
 * Inicializa as máscaras de candidatos (bits 1..9) para cada célula vazia.
 */
function initCandidates(grid) {
  const cands = new Int16Array(TOTAL);
  const ALL = 0x3fe; // bits 1..9 ligados (2..512)
  for (let i = 0; i < TOTAL; i++) {
    if (grid[i]) cands[i] = 0;
    else cands[i] = ALL;
  }
  for (let i = 0; i < TOTAL; i++) {
    const val = grid[i];
    if (!val) continue;
    const bit = 1 << val;
    for (const p of PEERS[i]) {
      cands[p] &= ~bit;
    }
  }
  return cands;
}

function popcount(mask) {
  let c = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    c++;
  }
  return c;
}

function singleBitValue(mask) {
  for (let v = 1; v <= 9; v++) {
    if (mask === 1 << v) return v;
  }
  return 0;
}

/**
 * Executa um passo de dedução lógica sobre `workGrid` e `cands`:
 * - Tier 1: Single em bloco 3×3 (Hidden Single no bloco) ou Naked Single em fila/bloco quase cheio
 * - Tier 2: Hidden Single em Linha/Coluna e Naked Single geral (único número possível na casa)
 * - Tier 3: Pointing Pairs (par apontador bloco->linha/coluna) e Naked Pairs (par isolado)
 */
function deduceStep(workGrid, cands, maxTier = 3) {
  // Checa contradições (casa vazia sem nenhum candidato possível)
  for (let i = 0; i < TOTAL; i++) {
    if (!workGrid[i] && cands[i] === 0) return { kind: 'contradiction' };
  }

  // ---------- TIER 1: Único lugar para um número num Bloco 3×3 ----------
  for (let b = 0; b < 9; b++) {
    const cells = BOX_CELLS[b];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (cells.some((idx) => workGrid[idx] === v)) continue;
      const spots = cells.filter((idx) => !workGrid[idx] && (cands[idx] & bit));
      if (spots.length === 0) return { kind: 'contradiction' };
      if (spots.length === 1) {
        return {
          kind: 'place',
          cell: spots[0],
          val: v,
          tier: 1,
          cells,
          reason: `Neste <b>bloco 3×3</b>, o número <b>${v}</b> só pode entrar nesta casa.`,
        };
      }
    }
  }

  // ---------- TIER 1B: Único candidato restante numa casa (Naked Single direto) ----------
  for (let i = 0; i < TOTAL; i++) {
    if (workGrid[i]) continue;
    if (popcount(cands[i]) === 1) {
      const v = singleBitValue(cands[i]);
      const r = Math.floor(i / 9) + 1;
      const c = (i % 9) + 1;
      return {
        kind: 'place',
        cell: i,
        val: v,
        tier: 1,
        cells: [i],
        reason: `Na <b>Linha ${r}, Coluna ${c}</b>, todos os outros números de 1 a 9 já aparecem na mesma linha, coluna ou bloco: só cabe o <b>${v}</b>.`,
      };
    }
  }

  if (maxTier < 2) return null;

  // ---------- TIER 2: Único lugar para um número numa Linha ou Coluna ----------
  for (let r = 0; r < 9; r++) {
    const cells = ROW_CELLS[r];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (cells.some((idx) => workGrid[idx] === v)) continue;
      const spots = cells.filter((idx) => !workGrid[idx] && (cands[idx] & bit));
      if (spots.length === 0) return { kind: 'contradiction' };
      if (spots.length === 1) {
        return {
          kind: 'place',
          cell: spots[0],
          val: v,
          tier: 2,
          cells,
          reason: `Na <b>Linha ${r + 1}</b>, o número <b>${v}</b> só pode ocupar esta posição.`,
        };
      }
    }
  }

  for (let c = 0; c < 9; c++) {
    const cells = COL_CELLS[c];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      if (cells.some((idx) => workGrid[idx] === v)) continue;
      const spots = cells.filter((idx) => !workGrid[idx] && (cands[idx] & bit));
      if (spots.length === 0) return { kind: 'contradiction' };
      if (spots.length === 1) {
        return {
          kind: 'place',
          cell: spots[0],
          val: v,
          tier: 2,
          cells,
          reason: `Na <b>Coluna ${c + 1}</b>, o número <b>${v}</b> só pode ocupar esta posição.`,
        };
      }
    }
  }

  if (maxTier < 3) return null;

  // ---------- TIER 3A: Pointing Pairs / Triples (Bloco -> Linha ou Coluna) ----------
  for (let b = 0; b < 9; b++) {
    const cells = BOX_CELLS[b];
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v;
      const spots = cells.filter((idx) => !workGrid[idx] && (cands[idx] & bit));
      if (spots.length < 2 || spots.length > 3) continue;

      const r0 = Math.floor(spots[0] / 9);
      if (spots.every((idx) => Math.floor(idx / 9) === r0)) {
        let changed = false;
        for (const idx of ROW_CELLS[r0]) {
          if (!cells.includes(idx) && (cands[idx] & bit)) {
            cands[idx] &= ~bit;
            changed = true;
          }
        }
        if (changed) return { kind: 'prune', tier: 3 };
      }

      const c0 = spots[0] % 9;
      if (spots.every((idx) => idx % 9 === c0)) {
        let changed = false;
        for (const idx of COL_CELLS[c0]) {
          if (!cells.includes(idx) && (cands[idx] & bit)) {
            cands[idx] &= ~bit;
            changed = true;
          }
        }
        if (changed) return { kind: 'prune', tier: 3 };
      }
    }
  }

  // ---------- TIER 3B: Naked Pairs (duas casas na mesma unidade com os mesmos 2 candidatos) ----------
  const units = [...BOX_CELLS, ...ROW_CELLS, ...COL_CELLS];
  for (const unit of units) {
    const pairs = unit.filter((idx) => !workGrid[idx] && popcount(cands[idx]) === 2);
    for (let a = 0; a < pairs.length; a++) {
      for (let b = a + 1; b < pairs.length; b++) {
        const i1 = pairs[a];
        const i2 = pairs[b];
        if (cands[i1] === cands[i2]) {
          const mask = cands[i1];
          let changed = false;
          for (const idx of unit) {
            if (idx !== i1 && idx !== i2 && (cands[idx] & mask)) {
              cands[idx] &= ~mask;
              changed = true;
            }
          }
          if (changed) return { kind: 'prune', tier: 3 };
        }
      }
    }
  }

  return null;
}

/**
 * Resolve o tabuleiro usando apenas dedução lógica até `maxTier`.
 */
export function solveByDeduction(givens, maxTier = 3) {
  const work = [...givens];
  const cands = initCandidates(work);
  let filled = work.filter((v) => v > 0).length;
  let maxTierUsed = 1;

  for (let steps = 0; steps < 220 && filled < TOTAL; steps++) {
    const step = deduceStep(work, cands, maxTier);
    if (!step || step.kind === 'contradiction') {
      return { solved: false, grid: work, maxTierUsed };
    }
    if (step.tier > maxTierUsed) maxTierUsed = step.tier;
    if (step.kind === 'place') {
      work[step.cell] = step.val;
      cands[step.cell] = 0;
      const bit = 1 << step.val;
      for (const p of PEERS[step.cell]) {
        cands[p] &= ~bit;
      }
      filled++;
    }
  }

  return {
    solved: filled === TOTAL,
    grid: work,
    maxTierUsed,
  };
}

/**
 * Encontra a próxima dica explicada a partir do estado atual do jogador.
 */
export function findNextDeduction(grid, maxTier = 3) {
  const work = [...grid];
  const cands = initCandidates(work);

  for (let iter = 0; iter < 50; iter++) {
    const step = deduceStep(work, cands, maxTier);
    if (!step || step.kind === 'contradiction') return null;
    if (step.kind === 'place') return step;
  }
  return null;
}

/**
 * Gera uma grade 9×9 completa e válida de Sudoku via backtracking aleatório.
 */
function generateFullSolution() {
  const grid = new Int8Array(TOTAL);
  const rowMask = new Int16Array(9);
  const colMask = new Int16Array(9);
  const boxMask = new Int16Array(9);

  function fill(idx) {
    if (idx === TOTAL) return true;
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const b = boxOf(r, c);
    const used = rowMask[r] | colMask[c] | boxMask[b];

    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const v of nums) {
      const bit = 1 << v;
      if (used & bit) continue;
      grid[idx] = v;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;
      if (fill(idx + 1)) return true;
      rowMask[r] &= ~bit;
      colMask[c] &= ~bit;
      boxMask[b] &= ~bit;
      grid[idx] = 0;
    }
    return false;
  }

  fill(0);
  return Array.from(grid);
}

/**
 * Gera um quebra-cabeça de Sudoku 100% solúvel por dedução humana para o nível escolhido.
 */
export function generatePuzzle(level = 'medium') {
  const cfg = LEVEL_INFO[level] || LEVEL_INFO.medium;
  const { targetGivens, maxTier } = cfg;

  const solution = generateFullSolution();
  const givens = [...solution];
  let currentGivens = TOTAL;

  // Remove pares simétricos primeiro e depois individuais, validando sempre com solveByDeduction
  const indices = shuffle(Array.from({ length: TOTAL }, (_, i) => i));

  for (const idx of indices) {
    if (currentGivens <= targetGivens) break;
    if (givens[idx] === 0) continue;

    const prev = givens[idx];
    givens[idx] = 0;

    const check = solveByDeduction(givens, maxTier);
    if (check.solved) {
      currentGivens--;
    } else {
      givens[idx] = prev;
    }
  }

  return {
    level,
    size: SIZE,
    givens,
    solution,
    givensCount: currentGivens,
  };
}
