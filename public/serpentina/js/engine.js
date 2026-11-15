// Motor do mini-jogo Serpentina (Zip / Caminho Hamiltoniano com números e barreiras)
// Tabuleiros 5×5, 6×6, 7×7 e 8×8 com paredes em cruz (+) e segmentos de barreira,
// gerador rápido com solução garantida e dicas explicadas passo a passo.

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];

export const LEVEL_INFO = {
  easy: {
    name: 'Fácil',
    size: 5,
    numClues: 6,
    crosses: 1,
    extraWalls: 2,
  },
  medium: {
    name: 'Médio',
    size: 6,
    numClues: 7,
    crosses: 2,
    extraWalls: 3,
  },
  hard: {
    name: 'Difícil',
    size: 7,
    numClues: 8,
    crosses: 3,
    extraWalls: 4,
  },
  expert: {
    name: 'Mestre',
    size: 8,
    numClues: 8,
    crosses: 4,
    extraWalls: 5,
  },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function areAdjacent(a, b, size) {
  const r1 = Math.floor(a / size);
  const c1 = a % size;
  const r2 = Math.floor(b / size);
  const c2 = b % size;
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

export function canMove(a, b, size, wallSet) {
  if (!areAdjacent(a, b, size)) return false;
  return !wallSet.has(edgeKey(a, b));
}

function getOrthoNeighbors(idx, size, wallSet = null) {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const out = [];
  if (r > 0) {
    const up = (r - 1) * size + c;
    if (!wallSet || !wallSet.has(edgeKey(idx, up))) out.push(up);
  }
  if (r + 1 < size) {
    const dn = (r + 1) * size + c;
    if (!wallSet || !wallSet.has(edgeKey(idx, dn))) out.push(dn);
  }
  if (c > 0) {
    const lf = r * size + (c - 1);
    if (!wallSet || !wallSet.has(edgeKey(idx, lf))) out.push(lf);
  }
  if (c + 1 < size) {
    const rt = r * size + (c + 1);
    if (!wallSet || !wallSet.has(edgeKey(idx, rt))) out.push(rt);
  }
  return out;
}

/**
 * Gera um caminho Hamiltoniano na grade size×size usando heurística de Warnsdorff
 * com desempate aleatório e poda rápida.
 */
function findHamiltonianPath(size, preWalls = new Set(), maxSteps = 2200) {
  const total = size * size;
  const adj = Array.from({ length: total }, (_, i) => getOrthoNeighbors(i, size, preWalls));
  if (adj.some((list) => list.length === 0)) return null;

  const deg1 = [];
  for (let i = 0; i < total; i++) {
    if (adj[i].length === 1) deg1.push(i);
  }
  if (deg1.length > 2) return null;

  // Escolhe célula inicial (se houver grau 1, precisa começar nela)
  const startCandidates =
    deg1.length > 0 ? [deg1[0]] : shuffle(Array.from({ length: total }, (_, i) => i));

  for (let sIdx = 0; sIdx < Math.min(startCandidates.length, 6); sIdx++) {
    const start = startCandidates[sIdx];
    const visited = new Uint8Array(total);
    const path = new Int16Array(total);
    const curDeg = new Int8Array(total);
    for (let i = 0; i < total; i++) curDeg[i] = adj[i].length;

    let steps = 0;

    const dfs = (u, depth) => {
      visited[u] = 1;
      path[depth] = u;
      if (depth + 1 === total) return true;
      if (++steps > maxSteps) {
        visited[u] = 0;
        return false;
      }

      // Atualiza graus dos vizinhos livres e checa becos sem saída
      let forcedNext = -1;
      let deadEnd = false;
      for (const nb of adj[u]) {
        if (visited[nb]) continue;
        curDeg[nb]--;
        if (curDeg[nb] === 0 && depth + 2 < total) {
          deadEnd = true;
        } else if (curDeg[nb] === 1 && depth + 2 < total) {
          // Só pode haver no máximo 1 vizinho que cai para grau 1 (a menos que seja o fim do caminho)
          if (forcedNext === -1) forcedNext = nb;
        }
      }

      if (!deadEnd) {
        let candidates;
        if (forcedNext !== -1) {
          candidates = [forcedNext];
        } else {
          candidates = adj[u].filter((nb) => !visited[nb]);
          shuffle(candidates);
          candidates.sort((a, b) => curDeg[a] - curDeg[b]);
        }

        for (const nb of candidates) {
          if (dfs(nb, depth + 1)) return true;
        }
      }

      for (const nb of adj[u]) {
        if (!visited[nb]) curDeg[nb]++;
      }
      visited[u] = 0;
      return false;
    };

    if (dfs(start, 0)) {
      return Array.from(path);
    }
  }

  return null;
}

/**
 * Escolhe vértices internos espaçados para colocar cruzes (+) de paredes, como no print.
 * Cada cruz no vértice interno (vr, vc) bloqueia as 4 arestas que se encontram naquele ponto.
 */
function placeCrossWalls(size, targetCrosses) {
  const walls = new Set();
  const candidates = [];
  for (let vr = 1; vr <= size - 3; vr++) {
    for (let vc = 1; vc <= size - 3; vc++) {
      candidates.push([vr, vc]);
    }
  }
  shuffle(candidates);

  const chosen = [];
  for (const [vr, vc] of candidates) {
    if (chosen.length >= targetCrosses) break;
    // Mantém distância mínima entre os centros das cruzes para não isolar casas
    if (chosen.some(([r2, c2]) => Math.abs(vr - r2) <= 1 && Math.abs(vc - c2) <= 1)) continue;
    chosen.push([vr, vc]);

    const tl = vr * size + vc;
    const tr = vr * size + (vc + 1);
    const bl = (vr + 1) * size + vc;
    const br = (vr + 1) * size + (vc + 1);
    walls.add(edgeKey(tl, tr));
    walls.add(edgeKey(bl, br));
    walls.add(edgeKey(tl, bl));
    walls.add(edgeKey(tr, br));
  }

  return { walls, crosses: chosen };
}

/**
 * Completa as paredes (cruzes + paredes extras que não cortam o caminho)
 * e posiciona os números de 1..numClues em pontos estratégicos (incluindo cantos das cruzes).
 */
export function generatePuzzle(level = 'medium') {
  const cfg = LEVEL_INFO[level] || LEVEL_INFO.medium;
  const { size, numClues, crosses: wantCrosses, extraWalls } = cfg;
  const total = size * size;

  let path = null;
  let wallSet = null;
  let crosses = [];

  // Tenta gerar o caminho já respeitando cruzes (+) completas
  for (let attempt = 0; attempt < 60; attempt++) {
    const targetC = attempt < 35 ? wantCrosses : Math.max(0, wantCrosses - 1);
    const placed = placeCrossWalls(size, targetC);
    const p = findHamiltonianPath(size, placed.walls, 2600);
    if (p) {
      path = p;
      wallSet = placed.walls;
      crosses = placed.crosses;
      break;
    }
  }

  // Fallback sem pré-paredes se necessário
  if (!path) {
    while (!path) {
      path = findHamiltonianPath(size, new Set(), 4000);
    }
    wallSet = new Set();
    crosses = [];
  }

  // Conjunto de arestas usadas pelo caminho Hamiltoniano
  const usedEdges = new Set();
  for (let i = 0; i < total - 1; i++) {
    usedEdges.add(edgeKey(path[i], path[i + 1]));
  }

  // Se faltou alguma cruz visual, tenta montar cruzes/meias-cruzes usando arestas não usadas pelo caminho
  for (let vr = 0; vr < size - 1; vr++) {
    for (let vc = 0; vc < size - 1; vc++) {
      if (crosses.length >= wantCrosses) break;
      if (crosses.some(([r2, c2]) => Math.abs(vr - r2) <= 1 && Math.abs(vc - c2) <= 1)) continue;
      const tl = vr * size + vc;
      const tr = vr * size + (vc + 1);
      const bl = (vr + 1) * size + vc;
      const br = (vr + 1) * size + (vc + 1);
      const four = [edgeKey(tl, tr), edgeKey(bl, br), edgeKey(tl, bl), edgeKey(tr, br)];
      const freeEdges = four.filter((e) => !usedEdges.has(e));
      if (freeEdges.length >= 3) {
        freeEdges.forEach((e) => wallSet.add(e));
        crosses.push([vr, vc]);
      }
    }
  }

  // Adiciona algumas paredes extras em arestas não usadas pelo caminho para enriquecer a dedução
  const allNonPathEdges = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const u = r * size + c;
      if (c + 1 < size) {
        const e = edgeKey(u, u + 1);
        if (!usedEdges.has(e) && !wallSet.has(e)) allNonPathEdges.push(e);
      }
      if (r + 1 < size) {
        const e = edgeKey(u, u + size);
        if (!usedEdges.has(e) && !wallSet.has(e)) allNonPathEdges.push(e);
      }
    }
  }
  shuffle(allNonPathEdges);
  for (let i = 0; i < Math.min(extraWalls, allNonPathEdges.length); i++) {
    wallSet.add(allNonPathEdges[i]);
  }

  // Escolhe onde ficam os números 1 .. numClues ao longo do caminho:
  // 1 fica sempre em path[0] e numClues fica sempre em path[total - 1].
  // Os intermediários priorizam casas encostadas nas cruzes/paredes (como no print!) bem distribuídas pelo caminho.
  const clues = new Int16Array(total).fill(0);
  const cluePositions = [0];

  const interiorCount = numClues - 2;
  for (let k = 1; k <= interiorCount; k++) {
    const idealStart = Math.floor((k * (total - 1)) / (interiorCount + 1)) - 2;
    const idealEnd = Math.min(total - 2, idealStart + 5);
    let bestStep = Math.max(1, Math.min(total - 2, Math.round((k * (total - 1)) / (interiorCount + 1))));
    let bestScore = -1;

    for (let step = Math.max(1, idealStart); step <= idealEnd; step++) {
      if (cluePositions.includes(step)) continue;
      const cell = path[step];
      const openNbs = getOrthoNeighbors(cell, size, wallSet).length;
      const wallScore = 4 - openNbs; // Quanto mais paredes ao redor da casa, melhor âncora visual!
      if (wallScore > bestScore) {
        bestScore = wallScore;
        bestStep = step;
      }
    }
    cluePositions.push(bestStep);
  }
  cluePositions.push(total - 1);
  cluePositions.sort((a, b) => a - b);

  const clueCells = [];
  cluePositions.forEach((stepIdx, idx) => {
    const num = idx + 1;
    const cell = path[stepIdx];
    clues[cell] = num;
    clueCells.push({ num, cell, stepIdx });
  });

  // Converte wallSet em lista estruturada de paredes para renderização
  const walls = [...wallSet].map((key) => {
    const [a, b] = key.split('-').map(Number);
    const r1 = Math.floor(a / size);
    const c1 = a % size;
    const r2 = Math.floor(b / size);
    const c2 = b % size;
    return {
      key,
      a,
      b,
      dir: r1 === r2 ? 'v' : 'h', // 'v' = parede vertical entre (r1,c1) e (r1,c1+1); 'h' = parede horizontal entre (r1,c1) e (r1+1,c1)
      r: r1,
      c: c1,
    };
  });

  return {
    level,
    size,
    total,
    numClues: clueCells.length,
    clues: Array.from(clues),
    clueCells,
    walls,
    wallSet,
    solution: path,
  };
}

/**
 * Valida o caminho atual desenhado pelo jogador:
 * - Deve começar na casa do número 1
 * - Passos consecutivos devem ser ortogonalmente adjacentes e sem parede entre eles
 * - Números visitados devem estar na ordem estrita 1 -> 2 -> 3 -> ... -> K
 * - Não pode chegar ao último número K antes de preencher todas as casas
 * - Não pode isolar casas vazias sem saída
 */
export function validateBoard(userPath, puzzle) {
  const { size, total, clues, numClues, wallSet } = puzzle;
  const badCells = new Set();
  let reason = null;

  if (!userPath || userPath.length === 0) {
    return { badCells, reason: null, isSolved: false, nextTargetNum: 1 };
  }

  const startCell = puzzle.clueCells[0].cell;
  if (userPath[0] !== startCell) {
    badCells.add(userPath[0]);
    return {
      badCells,
      reason: 'O caminho deve começar no número <b>1</b>.',
      isSolved: false,
      nextTargetNum: 1,
    };
  }

  let expectedNum = 1;
  const visited = new Uint8Array(total);

  for (let i = 0; i < userPath.length; i++) {
    const cell = userPath[i];
    visited[cell] = 1;

    if (i > 0) {
      const prev = userPath[i - 1];
      if (!canMove(prev, cell, size, wallSet)) {
        badCells.add(prev);
        badCells.add(cell);
        reason ??= 'O caminho não pode atravessar uma barreira.';
      }
    }

    const num = clues[cell];
    if (num > 0) {
      if (num === expectedNum) {
        expectedNum++;
      } else if (num > expectedNum) {
        badCells.add(cell);
        reason ??= `Você passou pelo número <b>${num}</b> antes de conectar o <b>${expectedNum}</b>!`;
      }
    }
  }

  const tip = userPath[userPath.length - 1];
  const tipNum = clues[tip];

  // Se chegou no último número mas ainda faltam casas vazias
  if (!reason && tipNum === numClues && userPath.length < total) {
    badCells.add(tip);
    reason = `Você chegou ao número final (<b>${numClues}</b>), mas ainda faltam <b>${total - userPath.length}</b> casas para preencher!`;
  }

  // Checa se o jogador deixou alguma casa vazia completamente isolada (0 vizinhos livres e não adjacente à ponta)
  if (!reason && userPath.length < total) {
    for (let c = 0; c < total; c++) {
      if (visited[c]) continue;
      const nbs = getOrthoNeighbors(c, size, wallSet);
      const openNbs = nbs.filter((nb) => !visited[nb] || nb === tip);
      if (openNbs.length === 0) {
        badCells.add(c);
        reason = 'Uma casa vazia ficou completamente isolada sem saída!';
        break;
      }
    }
  }

  const isSolved = userPath.length === total && badCells.size === 0 && expectedNum > numClues;
  return {
    badCells,
    reason,
    isSolved,
    nextTargetNum: Math.min(numClues, expectedNum),
  };
}

/**
 * Calcula a próxima dica explicada comparando o caminho do jogador com a solução
 * e identificando o motivo lógico do próximo movimento.
 */
export function findNextDeduction(userPath, puzzle) {
  const { size, total, solution, clues, wallSet } = puzzle;

  // Descobre até onde o caminho atual do jogador coincide com o início da solução
  let matchLen = 0;
  while (matchLen < userPath.length && userPath[matchLen] === solution[matchLen]) {
    matchLen++;
  }

  // Se o jogador desviou da rota correta, sugere voltar até o último ponto certo e dar o passo correto
  if (matchLen < userPath.length) {
    const lastGoodIdx = Math.max(0, matchLen - 1);
    const nextCorrectCell = solution[matchLen];
    const targetPath = solution.slice(0, matchLen + 1);
    return {
      kind: 'rewind',
      cell: nextCorrectCell,
      pivotCell: solution[lastGoodIdx],
      targetPath,
      cells: [solution[lastGoodIdx], nextCorrectCell],
      reason: 'O traçado atual fecha o caminho mais à frente. Volte até a casa destacada e siga por aqui!',
    };
  }

  if (matchLen >= total) return null;

  // Jogador está no caminho certo (ou ainda não começou): avança até 3 casas ou até o próximo número
  const stepStart = matchLen === 0 ? 0 : matchLen;
  const nextCell = solution[stepStart];
  const prevCell = stepStart > 0 ? solution[stepStart - 1] : nextCell;

  let endIdx = Math.min(total - 1, stepStart + 2);
  for (let i = stepStart; i <= endIdx; i++) {
    if (clues[solution[i]] > 0 && i > stepStart) {
      endIdx = i;
      break;
    }
  }

  const previewCells = solution.slice(Math.max(0, stepStart - 1), endIdx + 1);
  const targetPath = solution.slice(0, endIdx + 1);

  // Gera explicação humana para o passo
  const visitedSet = new Set(solution.slice(0, stepStart));
  const openMoves = stepStart > 0
    ? getOrthoNeighbors(prevCell, size, wallSet).filter((nb) => !visitedSet.has(nb))
    : [nextCell];

  let reason;
  if (stepStart === 0) {
    reason = 'Comece no número <b>1</b> e siga pelas casas destacadas.';
  } else if (openMoves.length === 1) {
    reason = 'Esta é a <b>única saída livre</b> a partir da ponta atual sem bater nas paredes ou no próprio rastro.';
  } else {
    const nextNbs = getOrthoNeighbors(nextCell, size, wallSet).filter((nb) => !visitedSet.has(nb));
    if (nextNbs.length <= 1) {
      reason = 'Precisamos entrar nesta casa agora — se passarmos direto, ela ficará sem saída!';
    } else {
      // Descobre qual é o próximo número alvo
      let nextClueNum = null;
      for (let i = stepStart; i < total; i++) {
        if (clues[solution[i]] > 0) {
          nextClueNum = clues[solution[i]];
          break;
        }
      }
      reason = `Contorne por este trecho para cobrir as casas livres rumo ao número <b>${nextClueNum}</b>.`;
    }
  }

  return {
    kind: 'advance',
    cell: solution[endIdx],
    nextCell,
    targetPath,
    cells: previewCells,
    reason,
  };
}
