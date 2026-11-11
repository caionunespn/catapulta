// Desenho do tabuleiro em SVG.
const TERRAIN_ICON = { forest: 'wood', quarry: 'stone', pasture: 'cheese', garden: 'pumpkin', cave: 'crystal', swamp: 'reed' };
const INK = '#2a1a3a';

const SHAPES = {
  village: (c) =>
    `<path d="M-10 9V-2L0-12 10-2V9Z" fill="${c}"/><path d="M-3 9V2h6v7Z" fill="${INK}" stroke-width="0"/>`,
  castle: (c) =>
    `<path d="M0-9V-21" fill="none"/><path d="M0-21l9 3.5-9 3.5Z" fill="#fff"/>` +
    `<path d="M-14 11V-9h5v4h4v-4h10v4h4v-4h5V11Z" fill="${c}"/>` +
    `<path d="M-4 11V4a4 4 0 0 1 8 0v7Z" fill="${INK}" stroke-width="0"/>`,
};

const BOULDER =
  `<ellipse cx="0" cy="15" rx="21" ry="6" fill="rgba(0,0,0,.3)"/>` +
  `<path d="M-17 7-14-8-3-17 10-14 18-2 14 12-4 15Z" fill="#6b7280" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
  `<path d="M-14-8-3-17 10-14 2-6Z" fill="#9ca3af"/>` +
  `<path d="M2-6 5 7M-8 2l5 4" stroke="#374151" stroke-width="2" stroke-linecap="round" fill="none"/>`;

export class BoardView {
  constructor(svg, onPick) {
    this.svg = svg;
    this.b = null;
    this.prev = new Set();
    this.ready = false;
    this.last = {};
    this.lastCat = null;
    svg.addEventListener('click', (e) => {
      const t = e.target.closest('[data-pick]');
      if (t) onPick(t.dataset.pick, Number(t.dataset.id));
    });
  }

  setBoard(b) {
    this.b = b;
    this.prev = new Set();
    this.ready = false;
    this.last = {};
    this.lastCat = null;
    const V = b.vertices;
    let shoreOut = '';
    let shore = '';
    let tiles = '';
    for (const t of b.tiles) {
      const pts = t.v.map((v) => `${V[v].x},${V[v].y}`).join(' ');
      const inner = t.v
        .map((v) => `${(t.x + (V[v].x - t.x) * 0.84).toFixed(1)},${(t.y + (V[v].y - t.y) * 0.84).toFixed(1)}`)
        .join(' ');
      shoreOut += `<polygon class="shore-out" points="${pts}"/>`;
      shore += `<polygon class="shore" points="${pts}"/>`;
      const ico = TERRAIN_ICON[t.terrain];
      const spots =
        t.terrain === 'swamp'
          ? [[-22, -10], [16, -20], [6, 22], [-12, 26]]
          : [[-23, -22], [21, -24], [-1, 31]];
      const decor = spots
        .map(([dx, dy], i) => {
          const sz = 25 + ((t.id * 7 + i * 5) % 3) * 3;
          return `<use href="#i-${ico}" x="${t.x + dx - sz / 2}" y="${t.y + dy - sz / 2}" width="${sz}" height="${sz}"/>`;
        })
        .join('');
      let token = '';
      if (t.number) {
        const k = 6 - Math.abs(7 - t.number);
        let dots = '';
        for (let i = 0; i < k; i++) dots += `<circle class="pip" cx="${((i - (k - 1) / 2) * 4.4).toFixed(1)}" cy="10" r="1.5" style="stroke:none"/>`;
        const hot = t.number === 6 || t.number === 8 ? ' hot' : '';
        token = `<g class="token${hot}" transform="translate(${t.x},${t.y})"><g class="token-in"><circle r="16.5"/><text y="4">${t.number}</text>${dots}</g></g>`;
      }
      tiles += `<g class="tile t-${t.terrain}" data-tile="${t.id}"><polygon class="hex" points="${pts}"/><polygon class="hex-in" points="${inner}"/><g class="decor">${decor}</g>${token}</g>`;
    }
    let ports = '';
    for (const p of b.ports) {
      const body =
        p.type === 'any'
          ? `<text class="big" y="5">3:1</text>`
          : `<use href="#i-${p.type}" x="-9" y="-14" width="18" height="18"/><text y="12">2:1</text>`;
      ports += `<g class="port"><line x1="${V[p.a].x}" y1="${V[p.a].y}" x2="${p.x}" y2="${p.y}"/><line x1="${V[p.b].x}" y1="${V[p.b].y}" x2="${p.x}" y2="${p.y}"/><g transform="translate(${p.x},${p.y})"><circle r="16"/>${body}</g></g>`;
    }
    this.svg.setAttribute('viewBox', '-325 -305 650 610');
    this.svg.innerHTML =
      `<g>${shoreOut}</g><g>${shore}</g><g class="l-ports">${ports}</g><g class="l-tiles">${tiles}</g>` +
      `<g class="l-roads"></g><g class="l-builds"></g><g class="l-cat"></g><g class="l-tg"></g>`;
  }

  layer(name, html) {
    if (this.last[name] === html) return;
    this.last[name] = html;
    this.svg.querySelector('.l-' + name).innerHTML = html;
  }

  update(G, tg, colorOf) {
    if (!this.b) return;
    const { vertices: V, edges: E, tiles: T } = this.b;
    const keys = new Set();
    const isNew = (k) => {
      keys.add(k);
      return this.ready && !this.prev.has(k);
    };

    let roads = '';
    for (const [e, p] of Object.entries(G.roads)) {
      const a = V[E[e].a];
      const b = V[E[e].b];
      const pop = isNew('r' + e) ? ' pop' : '';
      const c = `x1="${(a.x + (b.x - a.x) * 0.2).toFixed(1)}" y1="${(a.y + (b.y - a.y) * 0.2).toFixed(1)}" x2="${(a.x + (b.x - a.x) * 0.8).toFixed(1)}" y2="${(a.y + (b.y - a.y) * 0.8).toFixed(1)}"`;
      roads += `<line class="road road-out${pop}" ${c}/><line class="road road-in${pop}" ${c} stroke="${colorOf(p)}"/>`;
    }
    this.layer('roads', roads);

    let builds = '';
    for (const [v, b] of Object.entries(G.buildings)) {
      const pop = isNew('b' + v + b.kind) ? ' pop' : '';
      builds += `<g transform="translate(${V[v].x},${V[v].y})"><g class="piece${pop}">${SHAPES[b.kind](colorOf(b.p))}</g></g>`;
    }
    this.layer('builds', builds);

    const ct = T[G.catapult];
    const thud = this.lastCat !== null && this.lastCat !== G.catapult;
    this.layer('cat', `<g transform="translate(${ct.x},${ct.y - 2})"><g class="${thud ? 'boulder' : ''}" data-t="${G.catapult}">${BOULDER}</g></g>`);
    if (this.lastCat !== G.catapult) {
      this.svg.querySelectorAll('.tile.blocked').forEach((el) => el.classList.remove('blocked'));
      this.svg.querySelector(`.tile[data-tile="${G.catapult}"]`)?.classList.add('blocked');
      this.lastCat = G.catapult;
    }

    let tgs = '';
    for (const v of tg.vertices) {
      const up = tg.kind === 'castle';
      tgs += `<circle class="tg tg-v${up ? ' up' : ''}" data-pick="vertex" data-id="${v}" cx="${V[v].x}" cy="${V[v].y}" r="${up ? 18 : 10}"/>`;
    }
    for (const e of tg.edges) {
      const a = V[E[e].a];
      const b = V[E[e].b];
      tgs += `<line class="tg tg-e" data-pick="edge" data-id="${e}" x1="${(a.x + (b.x - a.x) * 0.24).toFixed(1)}" y1="${(a.y + (b.y - a.y) * 0.24).toFixed(1)}" x2="${(a.x + (b.x - a.x) * 0.76).toFixed(1)}" y2="${(a.y + (b.y - a.y) * 0.76).toFixed(1)}"/>`;
    }
    for (const t of tg.tiles) {
      tgs += `<g class="tg tg-t" data-pick="tile" data-id="${t}" transform="translate(${T[t].x},${T[t].y})"><circle r="28"/><path d="M-10 0h20M0-10v20" fill="none"/></g>`;
    }
    this.layer('tg', tgs);

    this.prev = keys;
    this.ready = true;
  }

  flash(sum, catapult) {
    if (!this.b) return;
    for (const t of this.b.tiles) {
      if (t.number !== sum || t.id === catapult) continue;
      const el = this.svg.querySelector(`.tile[data-tile="${t.id}"]`);
      if (!el) continue;
      el.classList.remove('flash');
      void el.getBoundingClientRect();
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    }
  }

  screen(x, y) {
    const m = this.svg.getScreenCTM();
    if (!m) return { x: innerWidth / 2, y: innerHeight / 2 };
    const p = new DOMPoint(x, y).matrixTransform(m);
    return { x: p.x, y: p.y };
  }

  tileScreen(id) {
    const t = this.b.tiles[id];
    return this.screen(t.x, t.y);
  }
}
