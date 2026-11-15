// Motor do mini-jogo Sol & Lua (Tango / Binairo+ 6x6):
// Gerador procedural garantido por dedução lógica (sem chute), validador de regras e sistema de dicas explicadas.

export const SIZE = 6;
export const HALF = SIZE / 2;
export const TOTAL = SIZE * SIZE;
export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: { name: 'Fácil', maxTier: 1, targetGivens: 13, targetSigns: 7 },
  medium: { name: 'Médio', maxTier: 2, targetGivens: 9, targetSigns: 8 },
  hard: { name: 'Difícil', maxTier: 3, targetGivens: 6, targetSigns: 9 },
  expert: { name: 'Mestre', maxTier: 4, targetGivens: 4, targetSigns: 10 },
};

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Todas as 14 linhas válidas de tamanho 6 (3 de cada símbolo, sem 3 seguidos).
export const VALID_LINES = [];
for (let m = 0; m < 1 << SIZE; m++) {
  const row = [];
  let ones = 0;
  let bad = false;
  for (let c = 0; c < SIZE; c++) {
    const bit = (m >> c) & 1;
    row.push(bit);
    ones += bit;
    if (c >= 2 && row[c] === row[c - 1] && row[c] === row[c - 2]) bad = true;
  }
  if (!bad && ones === HALF) VALID_LINES.push(row);
}

// Linhas e colunas pré-calculadas (índices de 0 a 35)
export const LINES = [];
for (let r = 0; r < SIZE; r++) {
  const idx = [];
  for (let c = 0; c < SIZE; c++) idx.push(r * SIZE + c);
  LINES.push({ kind: 'row', index: r, cells: idx, label: `linha ${r + 1}` });
}
for (let c = 0; c < SIZE; c++) {
  const idx = [];
  for (let r = 0; r < SIZE; r++) idx.push(r * SIZE + c);
  LINES.push({ kind: 'col', index: c, cells: idx, label: `coluna ${c + 1}` });
}

// Todas as 60 arestas internas possíveis entre células ortogonalmente vizinhas
export const ALL_EDGES = [];
for (let r = 0; r < SIZE; r++) {
  for (let c = 0; c < SIZE; c++) {
    const i = r * SIZE + c;
    if (c + 1 < SIZE) ALL_EDGES.push({ a: i, b: i + 1, dir: 'h', r, c });
    if (r + 1 < SIZE) ALL_EDGES.push({ a: i, b: i + SIZE, dir: 'v', r, c });
  }
}

export function generateSolution(rnd = Math.random) {
  const grid = new Array(TOTAL).fill(null);

  function colOk(c, upToRow) {
    let z = 0;
    let o = 0;
    for (let r = 0; r <= upToRow; r++) {
      const v = grid[r * SIZE + c];
      if (v === 0) z++;
      else o++;
      if (r >= 2) {
        const v1 = grid[(r - 1) * SIZE + c];
        const v2 = grid[(r - 2) * SIZE + c];
        if (v === v1 && v === v2) return false;
      }
    }
    return z <= HALF && o <= HALF;
  }

  function fillRow(r) {
    if (r === SIZE) return true;
    const candidates = shuffle([...VALID_LINES], rnd);
    for (const line of candidates) {
      for (let c = 0; c < SIZE; c++) grid[r * SIZE + c] = line[c];
      let ok = true;
      for (let c = 0; c < SIZE; c++) {
        if (!colOk(c, r)) {
          ok = false;
          break;
        }
      }
      if (ok && fillRow(r + 1)) return true;
    }
    return false;
  }

  fillRow(0);
  return grid;
}

// Matriz rápida de sinais entre duas células vizinhas (0 = nenhum, 1 = '=', 2 = 'x')
const SIGN_NONE = 0;
const SIGN_EQ = 1;
const SIGN_NEQ = 2;

function buildSignMatrix(signs) {
  const mat = new Int8Array(TOTAL * TOTAL);
  for (let idx = 0; idx < signs.length; idx++) {
    const s = signs[idx];
    const v = s.type === '=' ? SIGN_EQ : SIGN_NEQ;
    mat[s.a * TOTAL + s.b] = v;
    mat[s.b * TOTAL + s.a] = v;
  }
  return mat;
}

// Verifica se o estado parcial tem alguma contradição imediata
function hasContradiction(grid, signs) {
  for (const s of signs) {
    const va = grid[s.a];
    const vb = grid[s.b];
    if (va !== null && vb !== null) {
      if (s.type === '=' && va !== vb) return true;
      if (s.type === 'x' && va === vb) return true;
    }
  }
  for (const line of LINES) {
    const { cells } = line;
    let c0 = 0;
    let c1 = 0;
    for (let i = 0; i < SIZE; i++) {
      const v = grid[cells[i]];
      if (v === 0) c0++;
      else if (v === 1) c1++;
      if (i >= 2) {
        const v1 = grid[cells[i - 1]];
        const v2 = grid[cells[i - 2]];
        if (v !== null && v === v1 && v === v2) return true;
      }
    }
    if (c0 > HALF || c1 > HALF) return true;
  }
  return false;
}

// Encontra o próximo passo lógico sem adivinhação (até maxTier).
export function findNextDeduction(grid, signs, maxTier = 4, precomputedSignMat = null) {
  const signMat = precomputedSignMat || buildSignMatrix(signs);

  // ---------- TIER 1: Regras diretas ----------
  // 1a. Sinal direto (= ou × com um lado já preenchido)
  for (const s of signs) {
    const va = grid[s.a];
    const vb = grid[s.b];
    if (va !== null && vb === null) {
      const val = s.type === '=' ? va : 1 - va;
      return {
        cell: s.b,
        val,
        tier: 1,
        rule: 'sign-direct',
        cells: [s.a, s.b],
        reason:
          s.type === '='
            ? 'O sinal de = exige que as duas casas vizinhas tenham o mesmo símbolo.'
            : 'O sinal de × exige que as duas casas vizinhas tenham símbolos opostos.',
      };
    }
    if (vb !== null && va === null) {
      const val = s.type === '=' ? vb : 1 - vb;
      return {
        cell: s.a,
        val,
        tier: 1,
        rule: 'sign-direct',
        cells: [s.b, s.a],
        reason:
          s.type === '='
            ? 'O sinal de = exige que as duas casas vizinhas tenham o mesmo símbolo.'
            : 'O sinal de × exige que as duas casas vizinhas tenham símbolos opostos.',
      };
    }
  }

  // 1b. Dupla adjacente [v, v, _] ou [_, v, v] e Sanduíche [v, _, v]
  for (const line of LINES) {
    const { cells, label } = line;
    for (let i = 0; i < SIZE; i++) {
      if (grid[cells[i]] !== null) continue;
      // [v, v, _]
      if (i >= 2 && grid[cells[i - 1]] !== null && grid[cells[i - 1]] === grid[cells[i - 2]]) {
        const v = grid[cells[i - 1]];
        return {
          cell: cells[i],
          val: 1 - v,
          tier: 1,
          rule: 'pair',
          cells: [cells[i - 2], cells[i - 1], cells[i]],
          reason: `Já existem 2 símbolos iguais seguidos na ${label}; o próximo precisa ser o oposto para não formar 3.`,
        };
      }
      // [_, v, v]
      if (i + 2 < SIZE && grid[cells[i + 1]] !== null && grid[cells[i + 1]] === grid[cells[i + 2]]) {
        const v = grid[cells[i + 1]];
        return {
          cell: cells[i],
          val: 1 - v,
          tier: 1,
          rule: 'pair',
          cells: [cells[i], cells[i + 1], cells[i + 2]],
          reason: `Já existem 2 símbolos iguais seguidos na ${label}; o anterior precisa ser o oposto para não formar 3.`,
        };
      }
      // [v, _, v]
      if (i >= 1 && i + 1 < SIZE && grid[cells[i - 1]] !== null && grid[cells[i - 1]] === grid[cells[i + 1]]) {
        const v = grid[cells[i - 1]];
        return {
          cell: cells[i],
          val: 1 - v,
          tier: 1,
          rule: 'sandwich',
          cells: [cells[i - 1], cells[i], cells[i + 1]],
          reason: `Entre dois símbolos iguais na ${label} precisa ir o símbolo oposto para evitar 3 seguidos.`,
        };
      }
    }
  }

  // 1c. Cota da linha/coluna (já tem 3 de um símbolo)
  for (const line of LINES) {
    const { cells, label } = line;
    let c0 = 0;
    let c1 = 0;
    for (const idx of cells) {
      if (grid[idx] === 0) c0++;
      else if (grid[idx] === 1) c1++;
    }
    if (c0 === HALF || c1 === HALF) {
      const fullVal = c0 === HALF ? 0 : 1;
      const targetVal = 1 - fullVal;
      for (const idx of cells) {
        if (grid[idx] === null) {
          return {
            cell: idx,
            val: targetVal,
            tier: 1,
            rule: 'quota',
            cells: [...cells],
            reason: `A ${label} já tem 3 peças de um tipo; todas as casas restantes nela precisam ser do outro.`,
          };
        }
      }
    }
  }

  if (maxTier < 2) return null;

  // ---------- TIER 2: Sinais combinados com vizinhança e contagem ----------
  for (const line of LINES) {
    const { cells, label } = line;
    // 2a. [v, _ = _] ou [_ = _, v]
    for (let i = 0; i < SIZE - 2; i++) {
      const a = cells[i];
      const b = cells[i + 1];
      const c = cells[i + 2];
      if (signMat[b * TOTAL + c] === SIGN_EQ && grid[a] !== null && grid[b] === null && grid[c] === null) {
        return {
          cell: b,
          val: 1 - grid[a],
          tier: 2,
          rule: 'sign-adj',
          cells: [a, b, c],
          reason: `Como estas duas casas na ${label} têm um sinal de =, elas não podem repetir o símbolo vizinho sem formar 3 seguidos.`,
        };
      }
      if (signMat[a * TOTAL + b] === SIGN_EQ && grid[c] !== null && grid[a] === null && grid[b] === null) {
        return {
          cell: b,
          val: 1 - grid[c],
          tier: 2,
          rule: 'sign-adj',
          cells: [a, b, c],
          reason: `Como estas duas casas na ${label} têm um sinal de =, elas não podem repetir o símbolo vizinho sem formar 3 seguidos.`,
        };
      }
    }

    // 2b. Linha/coluna com 2 de um tipo + sinal = ou × nas casas vazias
    let c0 = 0;
    let c1 = 0;
    const empties = [];
    for (let i = 0; i < SIZE; i++) {
      const idx = cells[i];
      if (grid[idx] === 0) c0++;
      else if (grid[idx] === 1) c1++;
      else empties.push(idx);
    }
    for (let v = 0; v < 2; v++) {
      const count = v === 0 ? c0 : c1;
      if (count !== HALF - 1 || empties.length < 2) continue;
      for (let i = 0; i < SIZE - 1; i++) {
        const u = cells[i];
        const w = cells[i + 1];
        if (grid[u] !== null || grid[w] !== null) continue;
        const sg = signMat[u * TOTAL + w];
        if (sg === SIGN_NONE) continue;
        if (sg === SIGN_EQ) {
          // Falta apenas 1 do tipo v, então o par '=' não pode ser v!
          return {
            cell: u,
            val: 1 - v,
            tier: 2,
            rule: 'quota-sign-eq',
            cells: [...cells],
            reason: `Falta apenas 1 peça desse tipo na ${label}, então o par ligado por = precisa ser do símbolo oposto.`,
          };
        }
        if (sg === SIGN_NEQ) {
          // O par '×' vai consumir exatamente um 0 e um 1 (ou seja, o último v disponível!).
          for (let ei = 0; ei < empties.length; ei++) {
            const other = empties[ei];
            if (other !== u && other !== w) {
              return {
                cell: other,
                val: 1 - v,
                tier: 2,
                rule: 'quota-sign-neq',
                cells: [u, w, other],
                reason: `O par com × na ${label} já vai usar a última peça restante de um dos tipos; por isso esta casa precisa ser do oposto.`,
              };
            }
          }
        }
      }
    }
  }

  if (maxTier < 3) return null;

  // ---------- TIER 3: Eliminação completa por linha/coluna ----------
  for (const line of LINES) {
    const { cells, label } = line;
    let hasEmpty = false;
    for (let i = 0; i < SIZE; i++) {
      if (grid[cells[i]] === null) {
        hasEmpty = true;
        break;
      }
    }
    if (!hasEmpty) continue;

    const compatible = [];
    for (let p = 0; p < VALID_LINES.length; p++) {
      const pat = VALID_LINES[p];
      let ok = true;
      for (let i = 0; i < SIZE; i++) {
        const cur = grid[cells[i]];
        if (cur !== null && cur !== pat[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (let i = 0; i < SIZE - 1; i++) {
        const sg = signMat[cells[i] * TOTAL + cells[i + 1]];
        if (sg === SIGN_EQ && pat[i] !== pat[i + 1]) {
          ok = false;
          break;
        }
        if (sg === SIGN_NEQ && pat[i] === pat[i + 1]) {
          ok = false;
          break;
        }
      }
      if (ok) compatible.push(pat);
    }

    if (compatible.length > 0) {
      for (let i = 0; i < SIZE; i++) {
        if (grid[cells[i]] !== null) continue;
        const firstVal = compatible[0][i];
        let allSame = true;
        for (let k = 1; k < compatible.length; k++) {
          if (compatible[k][i] !== firstVal) {
            allSame = false;
            break;
          }
        }
        if (allSame) {
          return {
            cell: cells[i],
            val: firstVal,
            tier: 3,
            rule: 'line-elim',
            cells: [...cells],
            reason: `Analisando todas as combinações válidas para a ${label} (3 de cada símbolo sem 3 seguidos), esta casa só aceita este símbolo.`,
          };
        }
      }
    }
  }

  if (maxTier < 4) return null;

  // ---------- TIER 4: Lookahead de 1 passo ----------
  const sim = new Array(TOTAL);
  for (let cell = 0; cell < TOTAL; cell++) {
    if (grid[cell] !== null) continue;
    for (let tryVal = 0; tryVal < 2; tryVal++) {
      for (let k = 0; k < TOTAL; k++) sim[k] = grid[k];
      sim[cell] = tryVal;
      let bad = hasContradiction(sim, signs);
      for (let step = 0; !bad && step < 4; step++) {
        const next = findNextDeduction(sim, signs, 2, signMat);
        if (!next) break;
        sim[next.cell] = next.val;
        if (hasContradiction(sim, signs)) bad = true;
      }
      if (bad) {
        return {
          cell,
          val: 1 - tryVal,
          tier: 4,
          rule: 'lookahead',
          cells: [cell],
          reason: 'Colocar o outro símbolo nesta casa forçaria uma repetição ilegal ou excesso de peças logo em seguida.',
        };
      }
    }
  }

  return null;
}

export function solveByDeduction(initialGrid, signs, maxTier = 4) {
  const signMat = buildSignMatrix(signs);
  const grid = [...initialGrid];
  const steps = [];
  let maxTierUsed = 0;

  while (true) {
    if (hasContradiction(grid, signs)) {
      return { solved: false, grid, steps, maxTierUsed };
    }
    if (grid.every((v) => v !== null)) {
      return { solved: true, grid, steps, maxTierUsed };
    }
    const move = findNextDeduction(grid, signs, maxTier, signMat);
    if (!move) {
      return { solved: false, grid, steps, maxTierUsed };
    }
    grid[move.cell] = move.val;
    if (move.tier > maxTierUsed) maxTierUsed = move.tier;
    steps.push(move);
  }
}

// Valida o tabuleiro atual do jogador em tempo real
export function validateBoard(grid, signs) {
  const badCells = new Set();
  const badSigns = new Set();
  let reason = null;

  // 1. Sinais = e ×
  signs.forEach((s, idx) => {
    const va = grid[s.a];
    const vb = grid[s.b];
    if (va !== null && vb !== null) {
      if (s.type === '=' && va !== vb) {
        badCells.add(s.a);
        badCells.add(s.b);
        badSigns.add(idx);
        if (!reason) reason = 'Células separadas por = precisam ter o mesmo símbolo.';
      } else if (s.type === 'x' && va === vb) {
        badCells.add(s.a);
        badCells.add(s.b);
        badSigns.add(idx);
        if (!reason) reason = 'Células separadas por × precisam ter símbolos opostos.';
      }
    }
  });

  // 2. Trincas consecutivas (3 iguais seguidos)
  for (const line of LINES) {
    const { cells, label } = line;
    for (let i = 0; i < SIZE - 2; i++) {
      const a = cells[i];
      const b = cells[i + 1];
      const c = cells[i + 2];
      if (grid[a] !== null && grid[a] === grid[b] && grid[a] === grid[c]) {
        badCells.add(a);
        badCells.add(b);
        badCells.add(c);
        if (!reason) reason = `Não pode haver mais de 2 símbolos iguais seguidos (${label}).`;
      }
    }
  }

  // 3. Mais de 3 do mesmo símbolo na linha ou coluna
  for (const line of LINES) {
    const { cells, label } = line;
    const pos0 = [];
    const pos1 = [];
    for (const idx of cells) {
      if (grid[idx] === 0) pos0.push(idx);
      else if (grid[idx] === 1) pos1.push(idx);
    }
    if (pos0.length > HALF) {
      pos0.forEach((idx) => badCells.add(idx));
      if (!reason) reason = `Cada ${ line.kind === 'row' ? 'linha' : 'coluna' } só pode ter ${HALF} peças de cada tipo (${label}).`;
    }
    if (pos1.length > HALF) {
      pos1.forEach((idx) => badCells.add(idx));
      if (!reason) reason = `Cada ${ line.kind === 'row' ? 'linha' : 'coluna' } só pode ter ${HALF} peças de cada tipo (${label}).`;
    }
  }

  const isComplete = grid.every((v) => v !== null);
  const isSolved = isComplete && badCells.size === 0 && badSigns.size === 0;

  return { badCells, badSigns, reason, isComplete, isSolved };
}

// Gera um novo quebra-cabeça 6x6 garantidamente solucionável por dedução lógica para o nível escolhido.
export function generatePuzzle(level = 'medium', rnd = Math.random) {
  const lv = LEVELS.includes(level) ? level : 'medium';
  const cfg = LEVEL_INFO[lv];

  let best = null;
  let bestScore = -Infinity;

  const attempts = lv === 'easy' ? 4 : 6;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const solution = generateSolution(rnd);

    // Escolhe arestas para receber sinais '=' ou 'x' evitando aglomeração excessiva
    const edgePool = shuffle([...ALL_EDGES], rnd);
    const signs = [];
    const initialSignCount = cfg.targetSigns + 3;
    for (const e of edgePool) {
      if (signs.length >= initialSignCount) break;
      const type = solution[e.a] === solution[e.b] ? '=' : 'x';
      signs.push({ a: e.a, b: e.b, dir: e.dir, r: e.r, c: e.c, type });
    }

    // Começa com todas as células preenchidas e remove pistas enquanto continuar dedutível até cfg.maxTier
    const givens = [...solution];
    const cellOrder = shuffle(
      Array.from({ length: TOTAL }, (_, i) => i),
      rnd
    );
    let givenCount = TOTAL;

    for (const idx of cellOrder) {
      if (givenCount <= cfg.targetGivens) break;
      const backup = givens[idx];
      givens[idx] = null;
      const res = solveByDeduction(givens, signs, cfg.maxTier);
      if (res.solved) {
        givenCount--;
      } else {
        givens[idx] = backup;
      }
    }

    // Poda sinais redundantes até aproximar de targetSigns mantendo dedutibilidade
    for (let i = signs.length - 1; i >= 0; i--) {
      if (signs.length <= cfg.targetSigns) break;
      const removed = signs.splice(i, 1)[0];
      const res = solveByDeduction(givens, signs, cfg.maxTier);
      if (!res.solved) {
        signs.splice(i, 0, removed);
      }
    }

    const check = solveByDeduction(givens, signs, cfg.maxTier);
    if (!check.solved) continue;

    // Pontua o candidato para escolher o mais interessante para o nível
    const tierBonus = check.maxTierUsed * 10;
    const givenDiff = Math.abs(givenCount - cfg.targetGivens) * 3;
    const score = tierBonus - givenDiff + signs.length;

    if (score > bestScore) {
      bestScore = score;
      best = {
        size: SIZE,
        level: lv,
        solution,
        givens,
        signs,
        maxTierUsed: check.maxTierUsed,
      };
    }
  }

  return best;
}
