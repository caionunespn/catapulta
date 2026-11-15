// Motor do mini-jogo Retalhos (Patches / Shikaku com formas e áreas)
// Tabuleiros 5×5, 6×6, 7×7 e 8×8 divididos em retângulos/quadrados sem sobreposição,
// 4 níveis de dificuldade, gerador com redução dedutiva e solucionador 100% lógico.

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: {
    name: 'Fácil',
    size: 5,
    maxTier: 2,
    hideAreaProb: 0.25,
    anyShapeProb: 0.35,
  },
  medium: {
    name: 'Médio',
    size: 6,
    maxTier: 2,
    hideAreaProb: 0.35,
    anyShapeProb: 0.45,
  },
  hard: {
    name: 'Difícil',
    size: 7,
    maxTier: 3,
    hideAreaProb: 0.42,
    anyShapeProb: 0.5,
  },
  expert: {
    name: 'Mestre',
    size: 8,
    maxTier: 3,
    hideAreaProb: 0.48,
    anyShapeProb: 0.55,
  },
};

export const PALETTE = [
  { name: 'Carmim', hex: '#e55947', fill: '#f7b2a8', dark: '#7a2218' },
  { name: 'Azul', hex: '#3d7be0', fill: '#a9c8f7', dark: '#1a3b75' },
  { name: 'Esmeralda', hex: '#289e76', fill: '#a4e3cb', dark: '#114f3a' },
  { name: 'Âmbar', hex: '#d98218', fill: '#f9d091', dark: '#6b3c05' },
  { name: 'Violeta', hex: '#845ec2', fill: '#cab6eb', dark: '#3e2569' },
  { name: 'Turquesa', hex: '#1f8a9c', fill: '#a0dce6', dark: '#0e4650' },
  { name: 'Rosa', hex: '#c7528b', fill: '#f0b4d1', dark: '#631d40' },
  { name: 'Oliva', hex: '#6c9a38', fill: '#c7e3a3', dark: '#324d14' },
  { name: 'Cobre', hex: '#b36236', fill: '#ebc0a6', dark: '#592b12' },
  { name: 'Índigo', hex: '#5265c7', fill: '#b6c1f2', dark: '#222d66' },
];

export const SHAPE_NAMES = {
  square: 'Quadrado',
  horiz: 'Retângulo horizontal',
  vert: 'Retângulo vertical',
  any: 'Qualquer formato',
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function rectWidth(rect) {
  return rect.c2 - rect.c1 + 1;
}

export function rectHeight(rect) {
  return rect.r2 - rect.r1 + 1;
}

export function rectArea(rect) {
  return rectWidth(rect) * rectHeight(rect);
}

export function rectsOverlap(a, b) {
  return !(a.r2 < b.r1 || a.r1 > b.r2 || a.c2 < b.c1 || a.c1 > b.c2);
}

export function cellInRect(r, c, rect) {
  return r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
}

export function sameRect(a, b) {
  if (!a || !b) return false;
  return a.r1 === b.r1 && a.c1 === b.c1 && a.r2 === b.r2 && a.c2 === b.c2;
}

export function matchesClueConstraint(rect, clue) {
  const w = rectWidth(rect);
  const h = rectHeight(rect);
  const area = w * h;
  if (clue.area !== null && area !== clue.area) return false;
  if (clue.shape === 'square' && w !== h) return false;
  if (clue.shape === 'horiz' && w <= h) return false;
  if (clue.shape === 'vert' && h <= w) return false;
  return true;
}

/**
 * Enumera todos os retângulos candidatos válidos para a pista `clueIdx`
 * levando em conta as pistas vizinhas e os retângulos já fixados em `fixedRects`.
 */
export function getCandidatesForClue(clueIdx, clues, size, fixedRects) {
  const clue = clues[clueIdx];
  const out = [];

  // Determina possíveis dimensões (w, h)
  const dims = [];
  for (let h = 1; h <= size; h++) {
    for (let w = 1; w <= size; w++) {
      const area = w * h;
      if (area < 2) continue;
      if (clue.area !== null && area !== clue.area) continue;
      if (clue.shape === 'square' && w !== h) continue;
      if (clue.shape === 'horiz' && w <= h) continue;
      if (clue.shape === 'vert' && h <= w) continue;
      dims.push([w, h]);
    }
  }

  for (const [w, h] of dims) {
    const rMin = Math.max(0, clue.r - h + 1);
    const rMax = Math.min(size - h, clue.r);
    const cMin = Math.max(0, clue.c - w + 1);
    const cMax = Math.min(size - w, clue.c);

    for (let r1 = rMin; r1 <= rMax; r1++) {
      const r2 = r1 + h - 1;
      for (let c1 = cMin; c1 <= cMax; c1++) {
        const c2 = c1 + w - 1;
        const rect = { r1, c1, r2, c2 };

        // Não pode conter outra pista
        let hitsOtherClue = false;
        for (let j = 0; j < clues.length; j++) {
          if (j === clueIdx) continue;
          if (cellInRect(clues[j].r, clues[j].c, rect)) {
            hitsOtherClue = true;
            break;
          }
        }
        if (hitsOtherClue) continue;

        // Não pode sobrepor retângulos já fixados
        let hitsFixed = false;
        for (let j = 0; j < clues.length; j++) {
          if (j === clueIdx || !fixedRects[j]) continue;
          if (rectsOverlap(rect, fixedRects[j])) {
            hitsFixed = true;
            break;
          }
        }
        if (hitsFixed) continue;

        out.push(rect);
      }
    }
  }

  return out;
}

/**
 * Executa um passo de dedução lógica sobre `fixedRects` e `cands`.
 */
function deduceStep(clues, size, fixedRects, cands, maxTier = 3) {
  const nClues = clues.length;

  // Filtra candidatos que colidem com retângulos recém-fixados
  for (let i = 0; i < nClues; i++) {
    if (fixedRects[i]) continue;
    cands[i] = cands[i].filter((r) => {
      for (let j = 0; j < nClues; j++) {
        if (fixedRects[j] && rectsOverlap(r, fixedRects[j])) return false;
      }
      return true;
    });
    if (cands[i].length === 0) return { kind: 'contradiction' };
  }

  // ---------- TIER 1: Pista com apenas 1 retângulo candidato válido ----------
  for (let i = 0; i < nClues; i++) {
    if (fixedRects[i]) continue;
    if (cands[i].length === 1) {
      const rect = cands[i][0];
      const w = rectWidth(rect);
      const h = rectHeight(rect);
      return {
        kind: 'place',
        clueIdx: i,
        rect,
        tier: 1,
        reason: `A forma demarcada tem apenas uma posição válida (<b>${w}×${h}</b>). Todos os outros posicionamentos entram em conflito com outra pista ou borda.`,
      };
    }
  }

  if (maxTier < 2) return null;

  // ---------- TIER 2: Casa que só pode ser coberta por uma única pista ----------
  const covered = new Uint8Array(size * size);
  for (let i = 0; i < nClues; i++) {
    const r = fixedRects[i];
    if (!r) continue;
    for (let rr = r.r1; rr <= r.r2; rr++) {
      for (let cc = r.c1; cc <= r.c2; cc++) {
        covered[rr * size + cc] = 1;
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (covered[r * size + c]) continue;
      let ownerClue = -1;
      let countClues = 0;
      let matchingRects = null;

      for (let i = 0; i < nClues; i++) {
        if (fixedRects[i]) continue;
        const covering = cands[i].filter((rect) => cellInRect(r, c, rect));
        if (covering.length > 0) {
          countClues++;
          ownerClue = i;
          matchingRects = covering;
          if (countClues > 1) break;
        }
      }

      if (countClues === 0) return { kind: 'contradiction' };
      if (countClues === 1) {
        if (matchingRects.length === 1) {
          const rect = matchingRects[0];
          return {
            kind: 'place',
            clueIdx: ownerClue,
            rect,
            tier: 2,
            reason: `A casa na <b>Linha ${r + 1}, Coluna ${c + 1}</b> só pode ser alcançada por esta pista, definindo sua única posição válida!`,
          };
        }
        if (matchingRects.length < cands[ownerClue].length) {
          cands[ownerClue] = matchingRects;
          return {
            kind: 'prune',
            clueIdx: ownerClue,
            tier: 2,
          };
        }
      }
    }
  }

  if (maxTier < 3) return null;

  // ---------- TIER 3: Eliminação por conflito direto com outra pista (Lookahead) ----------
  for (let i = 0; i < nClues; i++) {
    if (fixedRects[i] || cands[i].length <= 1) continue;
    const validAfterLookahead = cands[i].filter((candRect) => {
      // Se escolhermos candRect para a pista i, toda outra pista j ainda precisa ter >= 1 candidato sem sobrepor candRect
      for (let j = 0; j < nClues; j++) {
        if (j === i || fixedRects[j]) continue;
        const hasCompatible = cands[j].some((otherRect) => !rectsOverlap(candRect, otherRect));
        if (!hasCompatible) return false;
      }
      return true;
    });

    if (validAfterLookahead.length === 0) return { kind: 'contradiction' };
    if (validAfterLookahead.length === 1) {
      return {
        kind: 'place',
        clueIdx: i,
        rect: validAfterLookahead[0],
        tier: 3,
        reason: 'Qualquer outra posição para esta forma deixaria uma pista vizinha sem nenhum espaço válido.',
      };
    }
    if (validAfterLookahead.length < cands[i].length) {
      cands[i] = validAfterLookahead;
      return {
        kind: 'prune',
        clueIdx: i,
        tier: 3,
      };
    }
  }

  return null;
}

/**
 * Resolve o tabuleiro usando apenas dedução lógica até `maxTier`.
 */
export function solveByDeduction(clues, size, maxTier = 3) {
  const nClues = clues.length;
  const fixedRects = new Array(nClues).fill(null);
  const cands = clues.map((_, i) => getCandidatesForClue(i, clues, size, fixedRects));

  let placedCount = 0;
  let maxTierUsed = 1;

  for (let stepLimit = 0; stepLimit < nClues * 10 && placedCount < nClues; stepLimit++) {
    const step = deduceStep(clues, size, fixedRects, cands, maxTier);
    if (!step || step.kind === 'contradiction') {
      return { solved: false, placedCount, maxTierUsed, fixedRects };
    }
    if (step.tier > maxTierUsed) maxTierUsed = step.tier;
    if (step.kind === 'place') {
      fixedRects[step.clueIdx] = step.rect;
      placedCount++;
    }
  }

  // Confirma que todas as células da grade foram cobertas
  if (placedCount === nClues) {
    const totalArea = fixedRects.reduce((acc, r) => acc + rectArea(r), 0);
    if (totalArea !== size * size) {
      return { solved: false, placedCount, maxTierUsed, fixedRects };
    }
  }

  return {
    solved: placedCount === nClues,
    placedCount,
    maxTierUsed,
    fixedRects,
  };
}

/**
 * Encontra a próxima dica explicada a partir dos retângulos atualmente desenhados pelo jogador.
 */
export function findNextDeduction(userRects, puzzle) {
  const { clues, size } = puzzle;
  const nClues = clues.length;

  // Mantém apenas os retângulos do jogador que coincidem com a solução correta
  const fixedRects = new Array(nClues).fill(null);
  for (let i = 0; i < nClues; i++) {
    if (userRects[i] && sameRect(userRects[i], puzzle.solution[i])) {
      fixedRects[i] = userRects[i];
    }
  }

  const cands = clues.map((_, i) =>
    fixedRects[i] ? [fixedRects[i]] : getCandidatesForClue(i, clues, size, fixedRects)
  );

  for (let iter = 0; iter < nClues * 8; iter++) {
    const step = deduceStep(clues, size, fixedRects, cands, 3);
    if (!step || step.kind === 'contradiction') break;
    if (step.kind === 'place') {
      return step;
    }
  }

  // Fallback pela solução única
  for (let i = 0; i < nClues; i++) {
    if (!fixedRects[i]) {
      const rect = puzzle.solution[i];
      const w = rectWidth(rect);
      const h = rectHeight(rect);
      return {
        kind: 'place',
        clueIdx: i,
        rect,
        tier: 3,
        reason: `Esta pista forma um retângulo <b>${w}×${h}</b> nesta posição única.`,
      };
    }
  }
  return null;
}

/**
 * Valida os retângulos desenhados pelo jogador no tabuleiro.
 */
export function validateBoard(userRects, puzzle) {
  const { size, clues } = puzzle;
  const badClues = new Set();
  const badCells = new Set();
  let reason = null;

  let coveredCount = 0;

  for (let i = 0; i < clues.length; i++) {
    const rect = userRects[i];
    if (!rect) continue;
    const clue = clues[i];
    const w = rectWidth(rect);
    const h = rectHeight(rect);
    const area = w * h;
    coveredCount += area;

    // 1. Verifica se contém a própria pista
    if (!cellInRect(clue.r, clue.c, rect)) {
      badClues.add(i);
      reason ??= 'Cada forma deve cobrir a sua própria pista.';
    }

    // 2. Verifica se invadiu a casa de outra pista
    for (let j = 0; j < clues.length; j++) {
      if (j === i) continue;
      if (cellInRect(clues[j].r, clues[j].c, rect)) {
        badClues.add(i);
        reason ??= 'Um retângulo não pode cobrir duas pistas ao mesmo tempo.';
      }
    }

    // 3. Verifica formato exigido pela pista
    if (clue.shape === 'square' && w !== h) {
      badClues.add(i);
      reason ??= `Esta pista exige um <b>Quadrado</b> (lados iguais), mas está ${w}×${h}.`;
    } else if (clue.shape === 'horiz' && w <= h) {
      badClues.add(i);
      reason ??= `Esta pista exige um <b>Retângulo horizontal</b> (mais largo que alto), mas está ${w}×${h}.`;
    } else if (clue.shape === 'vert' && h <= w) {
      badClues.add(i);
      reason ??= `Esta pista exige um <b>Retângulo vertical</b> (mais alto que largo), mas está ${w}×${h}.`;
    }

    // 4. Verifica tamanho (área) exigido pela pista
    if (clue.area !== null && area !== clue.area) {
      badClues.add(i);
      reason ??= `Esta pista exige tamanho <b>${clue.area}</b>, mas a forma desenhada tem <b>${area}</b> casas.`;
    }
  }

  for (const idx of badClues) {
    const r = userRects[idx];
    if (!r) continue;
    for (let rr = r.r1; rr <= r.r2; rr++) {
      for (let cc = r.c1; cc <= r.c2; cc++) {
        badCells.add(rr * size + cc);
      }
    }
  }

  const allPlaced = userRects.every((r) => r !== null);
  const isSolved = allPlaced && badClues.size === 0 && coveredCount === size * size;

  return {
    badClues,
    badCells,
    reason,
    coveredCount,
    isSolved,
  };
}

/**
 * Particiona a grade size×size em retângulos de área 2..9 sem deixar buracos 1×1.
 */
function partitionGrid(size) {
  const total = size * size;
  const used = new Uint8Array(total);
  const rects = [];

  // Lista base de dimensões candidatas (w, h) com área entre 2 e 9
  const allDims = [];
  for (let h = 1; h <= 4; h++) {
    for (let w = 1; w <= 4; w++) {
      const area = w * h;
      if (area >= 2 && area <= 9) allDims.push([w, h]);
    }
  }

  function hasIsolatedSingleCell() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (used[r * size + c]) continue;
        const up = r > 0 && !used[(r - 1) * size + c];
        const dn = r + 1 < size && !used[(r + 1) * size + c];
        const lf = c > 0 && !used[r * size + (c - 1)];
        const rt = c + 1 < size && !used[r * size + (c + 1)];
        if (!up && !dn && !lf && !rt) return true;
      }
    }
    return false;
  }

  let steps = 0;
  function backtrack() {
    if (++steps > 1500) return false;
    let first = -1;
    for (let i = 0; i < total; i++) {
      if (!used[i]) {
        first = i;
        break;
      }
    }
    if (first === -1) return true;

    const r1 = Math.floor(first / size);
    const c1 = first % size;
    const dims = shuffle([...allDims]);

    for (const [w, h] of dims) {
      const r2 = r1 + h - 1;
      const c2 = c1 + w - 1;
      if (r2 >= size || c2 >= size) continue;

      let fits = true;
      for (let rr = r1; rr <= r2 && fits; rr++) {
        for (let cc = c1; cc <= c2; cc++) {
          if (used[rr * size + cc]) {
            fits = false;
            break;
          }
        }
      }
      if (!fits) continue;

      for (let rr = r1; rr <= r2; rr++) {
        for (let cc = c1; cc <= c2; cc++) {
          used[rr * size + cc] = 1;
        }
      }

      if (!hasIsolatedSingleCell()) {
        rects.push({ r1, c1, r2, c2 });
        if (backtrack()) return true;
        rects.pop();
      }

      for (let rr = r1; rr <= r2; rr++) {
        for (let cc = c1; cc <= c2; cc++) {
          used[rr * size + cc] = 0;
        }
      }
    }
    return false;
  }

  if (backtrack()) return rects;
  return null;
}

function trueShapeOf(rect) {
  const w = rectWidth(rect);
  const h = rectHeight(rect);
  if (w === h) return 'square';
  return w > h ? 'horiz' : 'vert';
}

/**
 * Gera um quebra-cabeça completo de Retalhos para o nível escolhido ('easy', 'medium', 'hard', 'expert').
 */
export function generatePuzzle(level = 'medium') {
  const cfg = LEVEL_INFO[level] || LEVEL_INFO.medium;
  const { size, maxTier, hideAreaProb, anyShapeProb } = cfg;

  for (let attempt = 0; attempt < 80; attempt++) {
    const rects = partitionGrid(size);
    if (!rects) continue;

    // Cria as pistas iniciais completas (com área e formato verdadeiros) em uma casa aleatória de cada retângulo
    const clues = rects.map((rect, idx) => {
      const r = rect.r1 + Math.floor(Math.random() * (rect.r2 - rect.r1 + 1));
      const c = rect.c1 + Math.floor(Math.random() * (rect.c2 - rect.c1 + 1));
      const col = PALETTE[idx % PALETTE.length];
      return {
        id: idx,
        r,
        c,
        cell: r * size + c,
        shape: trueShapeOf(rect),
        area: rectArea(rect),
        color: col,
      };
    });

    // Verifica se o tabuleiro já é dedutível com as pistas completas
    const baseCheck = solveByDeduction(clues, size, maxTier);
    if (!baseCheck.solved) continue;
    if (!baseCheck.fixedRects.every((r, i) => sameRect(r, rects[i]))) continue;

    // Redução dedutiva (como no print!):
    // Para parte das pistas, tenta:
    // - Trocar o formato específico ('square'|'horiz'|'vert') por 'any' (formato tracejado com número), OU
    // - Ocultar o número (area = null), mantendo apenas o formato ('square'|'horiz'|'vert'|'any'),
    // desde que o tabuleiro continue 100% solúvel por dedução sem chute!
    const order = shuffle(Array.from({ length: clues.length }, (_, i) => i));
    for (const idx of order) {
      const prevShape = clues[idx].shape;
      const prevArea = clues[idx].area;

      if (Math.random() < hideAreaProb) {
        // Tenta ocultar o número (fica só a forma colorida sem número, igual ao print)
        clues[idx].area = null;
        const chk = solveByDeduction(clues, size, maxTier);
        if (!chk.solved || !chk.fixedRects.every((r, i) => sameRect(r, rects[i]))) {
          clues[idx].area = prevArea;
        }
      } else if (Math.random() < anyShapeProb) {
        // Tenta usar o selo "Qualquer formato" ('any') com o número dentro (igual aos selos tracejados do print)
        clues[idx].shape = 'any';
        const chk = solveByDeduction(clues, size, maxTier);
        if (!chk.solved || !chk.fixedRects.every((r, i) => sameRect(r, rects[i]))) {
          clues[idx].shape = prevShape;
        }
      }
    }

    return {
      level,
      size,
      total: size * size,
      clues,
      solution: rects,
    };
  }

  // Fallback rápido garantido
  while (true) {
    const rects = partitionGrid(size);
    if (!rects) continue;
    const clues = rects.map((rect, idx) => {
      const r = rect.r1 + Math.floor(Math.random() * (rect.r2 - rect.r1 + 1));
      const c = rect.c1 + Math.floor(Math.random() * (rect.c2 - rect.c1 + 1));
      return {
        id: idx,
        r,
        c,
        cell: r * size + c,
        shape: trueShapeOf(rect),
        area: rectArea(rect),
        color: PALETTE[idx % PALETTE.length],
      };
    });
    const chk = solveByDeduction(clues, size, 3);
    if (chk.solved) {
      return {
        level,
        size,
        total: size * size,
        clues,
        solution: rects,
      };
    }
  }
}
