// Geração do tabuleiro: 19 hexágonos (raio 2), vértices, arestas e portos.

export const RES = ['wood', 'stone', 'cheese', 'pumpkin', 'crystal'];

export const TERRAIN_RES = {
  forest: 'wood',
  quarry: 'stone',
  pasture: 'cheese',
  garden: 'pumpkin',
  cave: 'crystal',
  swamp: null,
};

const HEX = 60;

export function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const rep = (v, n) => Array(n).fill(v);
export const pips = (n) => (n ? 6 - Math.abs(7 - n) : 0);

export function makeBoard(rnd = Math.random) {
  const tiles = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      if (Math.abs(q + r) > 2) continue;
      tiles.push({
        id: tiles.length,
        x: +(HEX * Math.sqrt(3) * (q + r / 2)).toFixed(2),
        y: +(HEX * 1.5 * r).toFixed(2),
        v: [],
        terrain: null,
        number: null,
      });
    }
  }

  const vertices = [];
  const edges = [];
  const vmap = new Map();
  const emap = new Map();

  for (const t of tiles) {
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 90);
      const x = t.x + HEX * Math.cos(ang);
      const y = t.y + HEX * Math.sin(ang);
      const key = Math.round(x) + ',' + Math.round(y);
      let id = vmap.get(key);
      if (id === undefined) {
        id = vertices.length;
        vmap.set(key, id);
        vertices.push({ id, x: +x.toFixed(2), y: +y.toFixed(2), tiles: [], adj: [], edges: [], port: null });
      }
      t.v.push(id);
      vertices[id].tiles.push(t.id);
    }
    for (let i = 0; i < 6; i++) {
      const a = t.v[i];
      const b = t.v[(i + 1) % 6];
      const key = a < b ? a + '-' + b : b + '-' + a;
      let id = emap.get(key);
      if (id === undefined) {
        id = edges.length;
        emap.set(key, id);
        edges.push({ id, a, b, tiles: [] });
        vertices[a].adj.push(b);
        vertices[b].adj.push(a);
        vertices[a].edges.push(id);
        vertices[b].edges.push(id);
      }
      edges[id].tiles.push(t.id);
    }
  }

  // Terrenos
  const terrains = shuffle(
    [...rep('forest', 4), ...rep('quarry', 3), ...rep('pasture', 4), ...rep('garden', 4), ...rep('cave', 3), 'swamp'],
    rnd
  );
  tiles.forEach((t, i) => (t.terrain = terrains[i]));

  // Números: evita 6 e 8 vizinhos
  const base = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const inner = edges.filter((e) => e.tiles.length === 2);
  for (let attempt = 0; attempt < 300; attempt++) {
    const nums = shuffle([...base], rnd);
    let k = 0;
    for (const t of tiles) t.number = t.terrain === 'swamp' ? null : nums[k++];
    const hot = (n) => n === 6 || n === 8;
    if (!inner.some((e) => hot(tiles[e.tiles[0]].number) && hot(tiles[e.tiles[1]].number))) break;
  }

  // Portos: 9 arestas costeiras bem espaçadas
  const coast = edges
    .filter((e) => e.tiles.length === 1)
    .map((e) => {
      const mx = (vertices[e.a].x + vertices[e.b].x) / 2;
      const my = (vertices[e.a].y + vertices[e.b].y) / 2;
      return { e, mx, my, ang: Math.atan2(my, mx) };
    })
    .sort((p, q) => p.ang - q.ang);
  const offset = Math.floor(rnd() * coast.length);
  const types = shuffle(['any', 'any', 'any', 'any', ...RES], rnd);
  const ports = [0, 3, 6, 10, 13, 16, 20, 23, 26].map((idx, i) => {
    const c = coast[(idx + offset) % coast.length];
    const t = tiles[c.e.tiles[0]];
    const dx = c.mx - t.x;
    const dy = c.my - t.y;
    const len = Math.hypot(dx, dy);
    vertices[c.e.a].port = types[i];
    vertices[c.e.b].port = types[i];
    return {
      edge: c.e.id,
      a: c.e.a,
      b: c.e.b,
      type: types[i],
      x: +(c.mx + (dx / len) * 34).toFixed(2),
      y: +(c.my + (dy / len) * 34).toFixed(2),
    };
  });

  return { tiles, vertices, edges, ports };
}
