// Web Worker que gera tabuleiros fora da thread principal (sem travar a interface).
// Só aceita motores da lista abaixo.
const ENGINES = {
  'sol-e-lua': '/sol-e-lua/js/engine.js',
  coroas: '/coroas/js/engine.js',
  serpentina: '/serpentina/js/engine.js',
  retalhos: '/retalhos/js/engine.js',
  sudoku: '/sudoku/js/engine.js',
};

self.onmessage = async (e) => {
  const { slug, level } = e.data || {};
  const url = ENGINES[slug];
  if (!url) return;
  try {
    const mod = await import(url);
    self.postMessage({ level, puzzle: mod.generatePuzzle(level) });
  } catch (err) {
    self.postMessage({ level, error: String(err) });
  }
};
