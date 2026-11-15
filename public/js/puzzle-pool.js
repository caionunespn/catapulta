// Reserva de tabuleiros pré-gerados num Web Worker.
// `take(level)` devolve na hora um tabuleiro já pronto (memória → localStorage → geração na hora)
// e já encomenda o próximo daquele nível em segundo plano, sem travar a interface.
const KEY = (slug, level) => `catapulta_pool_${slug}_${level}`;

function jsonReplacer(_k, v) {
  return v instanceof Set ? { __set: [...v] } : v;
}

function jsonReviver(_k, v) {
  return v && typeof v === 'object' && Array.isArray(v.__set) ? new Set(v.__set) : v;
}

function loadStored(slug, level) {
  try {
    const raw = localStorage.getItem(KEY(slug, level));
    if (!raw) return null;
    localStorage.removeItem(KEY(slug, level)); // cada tabuleiro guardado é usado uma única vez
    const p = JSON.parse(raw, jsonReviver);
    return p && p.level === level ? p : null;
  } catch {
    return null;
  }
}

function store(slug, level, puzzle) {
  try {
    localStorage.setItem(KEY(slug, level), JSON.stringify(puzzle, jsonReplacer));
  } catch {}
}

export function createPuzzlePool(slug, generateSync, levels = []) {
  let worker = null;
  let prefetched = false;
  let busy = false;
  let pumpTimer = null;
  const ready = {};
  const queue = [];

  function enqueue(level, front = false) {
    if (!worker || ready[level] || queue.includes(level)) return;
    if (front) queue.unshift(level);
    else queue.push(level);
    pump();
  }

  function pump() {
    if (!worker || busy || queue.length === 0) return;
    const nextLv = queue.shift();
    if (ready[nextLv]) {
      pump();
      return;
    }
    busy = true;
    worker.postMessage({ slug, level: nextLv });
  }

  try {
    worker = new Worker('/js/puzzle-worker.js', { type: 'module' });
    worker.onmessage = (e) => {
      busy = false;
      const { level, puzzle } = e.data || {};
      if (puzzle) {
        ready[level] = puzzle;
        store(slug, level, puzzle);
      }
      if (queue.length > 0) {
        clearTimeout(pumpTimer);
        pumpTimer = setTimeout(pump, 160);
      }
    };
    worker.onerror = () => {
      busy = false;
      worker = null;
    };
  } catch {
    worker = null;
  }

  return {
    take(level) {
      let puzzle = ready[level];
      ready[level] = null;
      if (puzzle) {
        try {
          localStorage.removeItem(KEY(slug, level));
        } catch {}
      } else {
        puzzle = loadStored(slug, level) || generateSync(level);
      }
      enqueue(level, true);
      if (!prefetched) {
        prefetched = true;
        setTimeout(() => {
          for (const lv of levels) {
            if (lv !== level) enqueue(lv, false);
          }
        }, 700);
      }
      return puzzle;
    },
  };
}
